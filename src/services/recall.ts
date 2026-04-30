import { sql as raw } from "drizzle-orm"
import type { getDb } from "~/db/client"
import type { Embedder } from "~/lib/openai"
import type { LightRAGClient } from "~/lib/lightrag"
import { finalScore } from "~/lib/similarity"

export interface RecallArgs {
  query: string
  k: number
  containerTag?: string
  kinds: ("thoughts" | "facts" | "documents")[]
  halfLifeDays: number
}

export interface RecallResult {
  thoughts: Array<{
    id: string
    content: string
    weight: number
    score: number
    lastMentionedAt: string
    containerTag: string | null
  }>
  facts: Array<{ id: string; statement: string; score: number; isLatest: boolean }>
  chunks: Array<{ documentId: string; content: string; score: number; position: number }>
  graph: { entities: unknown[]; relations: unknown[] }
}

export interface RecallService {
  recall: (args: RecallArgs) => Promise<RecallResult>
}

export function createRecallService(deps: {
  db: ReturnType<typeof getDb>
  embedder: Embedder
  lightrag: LightRAGClient
}): RecallService {
  return {
    async recall(args) {
      const emb = await deps.embedder.embed(args.query)
      const embVec = `[${emb.join(",")}]`
      const overFetch = args.k * 3

      const wantThoughts = args.kinds.includes("thoughts")
      const wantFacts = args.kinds.includes("facts")
      const wantDocs = args.kinds.includes("documents")

      const [tRows, fRows, cRows, graph] = await Promise.all([
        wantThoughts
          ? args.containerTag
            ? deps.db.execute(raw`
                SELECT id, content, weight, last_mentioned_at, container_tag,
                       1 - (embedding_vec <=> ${embVec}::vector) AS sim
                  FROM thoughts
                 WHERE NOT is_forgotten
                   AND embedding_vec IS NOT NULL
                   AND container_tag = ${args.containerTag}
                 ORDER BY embedding_vec <=> ${embVec}::vector
                 LIMIT ${overFetch}
              `)
            : deps.db.execute(raw`
                SELECT id, content, weight, last_mentioned_at, container_tag,
                       1 - (embedding_vec <=> ${embVec}::vector) AS sim
                  FROM thoughts
                 WHERE NOT is_forgotten
                   AND embedding_vec IS NOT NULL
                 ORDER BY embedding_vec <=> ${embVec}::vector
                 LIMIT ${overFetch}
              `)
          : Promise.resolve([] as never[]),
        wantFacts
          ? deps.db.execute(raw`
              SELECT id, statement, is_latest,
                     1 - (embedding_vec <=> ${embVec}::vector) AS sim
                FROM memory_entries
               WHERE NOT is_forgotten
                 AND embedding_vec IS NOT NULL
               ORDER BY embedding_vec <=> ${embVec}::vector
               LIMIT ${overFetch}
            `)
          : Promise.resolve([] as never[]),
        wantDocs
          ? deps.db.execute(raw`
              SELECT id, document_id, content, position,
                     1 - (embedding_vec <=> ${embVec}::vector) AS sim
                FROM chunks
               WHERE embedding_vec IS NOT NULL
               ORDER BY embedding_vec <=> ${embVec}::vector
               LIMIT ${overFetch}
            `)
          : Promise.resolve([] as never[]),
        deps.lightrag.query(args.query, { topK: overFetch }).catch(() => ({
          entities: [] as unknown[],
          relations: [] as unknown[],
          thought_ids: [] as string[],
          fact_ids: [] as string[],
        })),
      ])

      const graphThoughtIds = new Set((graph.thought_ids ?? []) as string[])
      const graphFactIds = new Set((graph.fact_ids ?? []) as string[])

      const tScored = (tRows as unknown as Array<{
        id: string
        content: string
        weight: number
        last_mentioned_at: Date
        container_tag: string | null
        sim: number
      }>)
        .map((r) => ({
          id: r.id,
          content: r.content,
          weight: r.weight,
          lastMentionedAt:
            r.last_mentioned_at instanceof Date
              ? r.last_mentioned_at.toISOString()
              : new Date(r.last_mentioned_at).toISOString(),
          containerTag: r.container_tag,
          score: finalScore({
            sim: r.sim,
            weight: r.weight,
            lastMentionedAt:
              r.last_mentioned_at instanceof Date
                ? r.last_mentioned_at
                : new Date(r.last_mentioned_at),
            inGraph: graphThoughtIds.has(r.id),
            halfLifeDays: args.halfLifeDays,
          }),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, args.k)

      const fScored = (fRows as unknown as Array<{
        id: string
        statement: string
        is_latest: boolean
        sim: number
      }>)
        .map((r) => ({
          id: r.id,
          statement: r.statement,
          isLatest: r.is_latest,
          score: r.sim * (graphFactIds.has(r.id) ? 1.15 : 1),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, args.k)

      const cScored = (cRows as unknown as Array<{
        document_id: string
        content: string
        position: number
        sim: number
      }>)
        .map((r) => ({
          documentId: r.document_id,
          content: r.content,
          position: r.position,
          score: r.sim,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, args.k)

      // side effect: bump access counters for returned ids
      const returnedThoughtIds = tScored.map((r) => r.id)
      const returnedFactIds = fScored.map((r) => r.id)
      if (returnedThoughtIds.length > 0) {
        // Format as a postgres array literal to avoid parameter cast issues
        const tIdLiteral = `{${returnedThoughtIds.map((id) => id.replace(/'/g, "''")).join(",")}}`
        await deps.db.execute(raw`
          UPDATE thoughts
             SET access_count = access_count + 1, last_accessed_at = now()
           WHERE id = ANY(${tIdLiteral}::text[])
        `)
      }
      if (returnedFactIds.length > 0) {
        const fIdLiteral = `{${returnedFactIds.map((id) => id.replace(/'/g, "''")).join(",")}}`
        await deps.db.execute(raw`
          UPDATE memory_entries
             SET access_count = access_count + 1, last_accessed_at = now()
           WHERE id = ANY(${fIdLiteral}::text[])
        `)
      }

      return {
        thoughts: tScored,
        facts: fScored,
        chunks: cScored,
        graph: { entities: graph.entities, relations: graph.relations },
      }
    },
  }
}
