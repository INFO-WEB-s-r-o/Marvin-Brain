import { and, eq, sql as raw } from "drizzle-orm"
import { ulid } from "ulid"
import { thoughts } from "~/db/schema"
import type { getDb } from "~/db/client"
import type { Embedder } from "~/lib/openai"
import type { LightRAGClient } from "~/lib/lightrag"
import { contentHash, normalizeContent } from "~/lib/content"

export interface RecordThoughtArgs {
  content: string
  containerTag?: string
  metadata?: Record<string, unknown>
}

export interface RecordResult {
  id: string
  kind: "new" | "merged_exact" | "merged_similar"
  weight: number
  mentionCount: number
  similarityScore?: number
}

export interface ThoughtsServiceOptions {
  db: ReturnType<typeof getDb>
  embedder: Embedder
  lightrag: LightRAGClient
  similarityThreshold: number
}

export interface ThoughtsService {
  record: (args: RecordThoughtArgs) => Promise<RecordResult>
}

function vectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`
}

export function createThoughtsService(opts: ThoughtsServiceOptions): ThoughtsService {
  return {
    async record(args) {
      const normalized = normalizeContent(args.content)
      const hash = contentHash(args.content)

      // 1. exact-hash dedup
      const existing = await opts.db
        .select()
        .from(thoughts)
        .where(and(eq(thoughts.contentHash, hash), eq(thoughts.isForgotten, false)))
        .limit(1)

      if (existing[0]) {
        const updated = await opts.db
          .update(thoughts)
          .set({
            weight: raw`${thoughts.weight} + 1`,
            mentionCount: raw`${thoughts.mentionCount} + 1`,
            lastMentionedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(thoughts.id, existing[0].id))
          .returning()
        const u = updated[0]!
        return {
          id: u.id,
          kind: "merged_exact",
          weight: u.weight,
          mentionCount: u.mentionCount,
        }
      }

      // 2. embed + similarity check
      const emb = await opts.embedder.embed(normalized)
      const embJson = JSON.stringify(emb)
      const embVec = vectorLiteral(emb)

      const near = await opts.db.execute(raw`
        SELECT id, weight, mention_count,
               1 - (embedding_vec <=> ${embVec}::vector) AS sim
          FROM thoughts
         WHERE NOT is_forgotten
           AND embedding_vec IS NOT NULL
         ORDER BY embedding_vec <=> ${embVec}::vector
         LIMIT 1
      `)

      const candidate = (near as unknown as Array<{ id: string; sim: number }>)[0]
      if (candidate && candidate.sim >= opts.similarityThreshold) {
        const updated = await opts.db
          .update(thoughts)
          .set({
            weight: raw`${thoughts.weight} + 1`,
            mentionCount: raw`${thoughts.mentionCount} + 1`,
            lastMentionedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(thoughts.id, candidate.id))
          .returning()
        const u = updated[0]!
        return {
          id: u.id,
          kind: "merged_similar",
          weight: u.weight,
          mentionCount: u.mentionCount,
          similarityScore: candidate.sim,
        }
      }

      // 3. insert new
      const id = ulid()
      await opts.db.insert(thoughts).values({
        id,
        content: normalized,
        contentHash: hash,
        embedding: embJson,
        embeddingModel: "text-embedding-3-small",
        containerTag: args.containerTag,
        metadata: args.metadata,
      })
      // also update embedding_vec column
      await opts.db.execute(raw`
        UPDATE thoughts SET embedding_vec = ${embVec}::vector WHERE id = ${id}
      `)

      // fire-and-forget graph index
      void opts.lightrag.index(id, normalized)

      return { id, kind: "new", weight: 0, mentionCount: 1 }
    },
  }
}
