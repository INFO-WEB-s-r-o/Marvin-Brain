import { eq } from "drizzle-orm"
import { embeddingCache } from "~/db/schema"
import { getDb } from "~/db/client"
import type { EmbeddingCache } from "~/lib/openai"

export function createPgEmbeddingCache(): EmbeddingCache {
  const db = getDb()
  return {
    async get(hash: string): Promise<number[] | null> {
      const rows = await db
        .select({ embedding: embeddingCache.embedding })
        .from(embeddingCache)
        .where(eq(embeddingCache.contentHash, hash))
        .limit(1)
      const row = rows[0]
      if (!row) return null
      return JSON.parse(row.embedding) as number[]
    },
    async put(hash: string, embedding: number[], model: string): Promise<void> {
      await db
        .insert(embeddingCache)
        .values({ contentHash: hash, embedding: JSON.stringify(embedding), model })
        .onConflictDoNothing({ target: embeddingCache.contentHash })
    },
  }
}
