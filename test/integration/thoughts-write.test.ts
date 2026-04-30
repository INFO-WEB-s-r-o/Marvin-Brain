import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import { startPgWithSchema } from "../helpers/pg"
import { createThoughtsService, type ThoughtsService } from "~/services/thoughts"
import * as schema from "~/db/schema"

let teardown: () => Promise<void>
let svc: ThoughtsService
let nextEmbedding: number[] = new Array(1536).fill(0).map((_, i) => Math.sin(i))

function setNextEmbedding(vec: number[]) {
  // pad/truncate to 1536 dims so pgvector accepts it
  const padded = vec.slice(0, 1536)
  while (padded.length < 1536) padded.push(0)
  nextEmbedding = padded
}

beforeAll(async () => {
  const { container, sql } = await startPgWithSchema()
  const db = drizzle(sql, { schema })

  const fakeEmbedder = {
    embed: async (_content: string) => nextEmbedding.slice(),
  }
  const fakeLightrag = {
    query: async () => ({ entities: [], relations: [] }),
    index: async () => undefined,
    cleanupDeleted: async () => undefined,
  }
  svc = createThoughtsService({
    db,
    embedder: fakeEmbedder,
    lightrag: fakeLightrag,
    similarityThreshold: 0.92,
  })

  teardown = async () => {
    await sql.end()
    await container.stop()
  }
}, 180_000)

afterAll(async () => {
  await teardown()
})

function vec(dominantIndex: number): number[] {
  // unit vector with a single 1.0 in the chosen index, rest zeros — easy similarity control
  const v = new Array(1536).fill(0)
  v[dominantIndex] = 1
  return v
}

describe("thoughts.record", () => {
  test("inserts a new thought with weight 0", async () => {
    setNextEmbedding(vec(10))
    const r = await svc.record({ content: "I should water the plants" })
    expect(r.kind).toBe("new")
    expect(r.weight).toBe(0)
  })

  test("verbatim repeat → merged_exact, weight bumps", async () => {
    setNextEmbedding(vec(11))
    const a = await svc.record({ content: "Same thought verbatim" })
    setNextEmbedding(vec(11))
    const b = await svc.record({ content: "Same thought verbatim" })
    expect(b.kind).toBe("merged_exact")
    expect(b.weight).toBe(1)
    expect(b.id).toBe(a.id)
  })

  test("near-duplicate via embedding similarity → merged_similar", async () => {
    setNextEmbedding(vec(12))
    await svc.record({ content: "I need to renew the SSL cert" })
    setNextEmbedding(vec(12)) // same vector → cosine 1.0 → merged_similar
    const b = await svc.record({ content: "Need to renew SSL certificate" })
    expect(b.kind).toBe("merged_similar")
    expect(b.weight).toBe(1)
  })

  test("dissimilar embedding → new", async () => {
    setNextEmbedding(vec(20))
    await svc.record({ content: "Plants need water" })
    setNextEmbedding(vec(21)) // orthogonal → cosine 0 → new
    const b = await svc.record({ content: "Reboot the database" })
    expect(b.kind).toBe("new")
  })
})
