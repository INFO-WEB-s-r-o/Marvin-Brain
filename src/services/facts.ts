import { eq, sql as raw } from "drizzle-orm"
import { ulid } from "ulid"
import { facts, factSources } from "~/db/schema"
import type { getDb } from "~/db/client"
import type { Embedder } from "~/lib/openai"

export interface RecordFactArgs {
  statement: string
  sources?: string[]
  confidence?: number
  parentFactId?: string
}

export interface FactRow {
  id: string
  statement: string
  isLatest: boolean
  parentFactId: string | null
  rootFactId: string | null
  confidence: number | null
  createdAt: Date
}

export interface FactsService {
  record: (args: RecordFactArgs) => Promise<FactRow>
  getById: (id: string) => Promise<FactRow | null>
  forget: (id: string, reason: string) => Promise<{ ok: true } | null>
}

function rowToFact(row: typeof facts.$inferSelect): FactRow {
  return {
    id: row.id,
    statement: row.statement,
    isLatest: row.isLatest,
    parentFactId: row.parentFactId,
    rootFactId: row.rootFactId,
    confidence: row.confidence,
    createdAt: row.createdAt,
  }
}

export function createFactsService(deps: {
  db: ReturnType<typeof getDb>
  embedder: Embedder
}): FactsService {
  return {
    async record(args) {
      const id = ulid()
      const emb = await deps.embedder.embed(args.statement)
      const embVec = `[${emb.join(",")}]`
      const inserted = await deps.db
        .insert(facts)
        .values({
          id,
          statement: args.statement,
          embedding: JSON.stringify(emb),
          embeddingModel: "text-embedding-3-small",
          isLatest: true,
          parentFactId: args.parentFactId,
          rootFactId: args.parentFactId ?? id,
          confidence: args.confidence,
        })
        .returning()
      // populate the pgvector column
      await deps.db.execute(raw`
        UPDATE memory_entries SET embedding_vec = ${embVec}::vector WHERE id = ${id}
      `)
      // mark previous fact non-latest if updating
      if (args.parentFactId) {
        await deps.db
          .update(facts)
          .set({ isLatest: false })
          .where(eq(facts.id, args.parentFactId))
      }
      // attach sources
      if (args.sources?.length) {
        await deps.db.insert(factSources).values(
          args.sources.map((docId) => ({
            id: ulid(),
            factId: id,
            documentId: docId,
            relevanceScore: 1.0,
          })),
        )
      }
      return rowToFact(inserted[0]!)
    },
    async getById(id) {
      const rows = await deps.db.select().from(facts).where(eq(facts.id, id)).limit(1)
      return rows[0] ? rowToFact(rows[0]) : null
    },
    async forget(id, reason) {
      const updated = await deps.db
        .update(facts)
        .set({ isForgotten: true, forgetReason: reason, updatedAt: new Date() })
        .where(eq(facts.id, id))
        .returning({ id: facts.id })
      return updated[0] ? { ok: true as const } : null
    },
  }
}
