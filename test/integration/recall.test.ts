import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/postgres-js"
import { startPgWithSchema } from "../helpers/pg"
import { createThoughtsService } from "~/services/thoughts"
import { createRecallService } from "~/services/recall"
import * as schema from "~/db/schema"

let teardown: () => Promise<void>
let recall: ReturnType<typeof createRecallService>["recall"]
let nextEmbedding: number[] = new Array(1536).fill(0)

function setNextEmbedding(vec: number[]) {
  const padded = vec.slice(0, 1536)
  while (padded.length < 1536) padded.push(0)
  nextEmbedding = padded
}

function unitVec(idx: number): number[] {
  const v = new Array(1536).fill(0)
  v[idx] = 1
  return v
}

beforeAll(async () => {
  const { container, sql } = await startPgWithSchema()
  const db = drizzle(sql, { schema })

  const embedder = {
    embed: async (_content: string) => nextEmbedding.slice(),
  }
  const lightrag = {
    query: async () => ({ entities: [], relations: [] }),
    index: async () => undefined,
    cleanupDeleted: async () => undefined,
  }

  const thoughtsSvc = createThoughtsService({
    db,
    embedder,
    lightrag,
    similarityThreshold: 0.92,
  })

  const recallSvc = createRecallService({ db, embedder, lightrag })
  recall = recallSvc.recall.bind(recallSvc)

  // Pre-populate: record two thoughts with distinct unit vectors
  setNextEmbedding(unitVec(50))
  await thoughtsSvc.record({ content: "water plants" })
  setNextEmbedding(unitVec(100))
  await thoughtsSvc.record({ content: "reboot database" })

  teardown = async () => {
    await sql.end()
    await container.stop()
  }
}, 180_000)

afterAll(async () => {
  await teardown()
})

describe("recall", () => {
  test("returns nearest thoughts — vector at idx 50 ranks first when query matches", async () => {
    // Set the embedder to return unitVec(50) for the query — matches "water plants" exactly
    setNextEmbedding(unitVec(50))
    const result = await recall({
      query: "anything",
      k: 5,
      kinds: ["thoughts"],
      halfLifeDays: 30,
    })

    expect(result.thoughts.length).toBeGreaterThan(0)
    // The thought with unitVec(50) embedding should rank highest
    expect(result.thoughts[0]!.content).toBe("water plants")
    // All returned rows have a numeric score
    for (const t of result.thoughts) {
      expect(typeof t.score).toBe("number")
      expect(t.score).toBeGreaterThanOrEqual(0)
    }
  })

  test("returns lower-similarity thought second", async () => {
    setNextEmbedding(unitVec(50))
    const result = await recall({
      query: "anything",
      k: 5,
      kinds: ["thoughts"],
      halfLifeDays: 30,
    })

    expect(result.thoughts.length).toBeGreaterThanOrEqual(2)
    // Scores should be in descending order
    const scores = result.thoughts.map((t) => t.score)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]!).toBeGreaterThanOrEqual(scores[i]!)
    }
  })

  test("kinds=facts only — no thoughts or chunks returned", async () => {
    setNextEmbedding(unitVec(50))
    const result = await recall({
      query: "x",
      k: 5,
      kinds: ["facts"],
      halfLifeDays: 30,
    })
    expect(result.thoughts.length).toBe(0)
    expect(result.chunks.length).toBe(0)
    // facts may be empty (none inserted) but the array must exist
    expect(Array.isArray(result.facts)).toBe(true)
  })

  test("kinds=documents only — no thoughts or facts returned", async () => {
    setNextEmbedding(unitVec(50))
    const result = await recall({
      query: "x",
      k: 5,
      kinds: ["documents"],
      halfLifeDays: 30,
    })
    expect(result.thoughts.length).toBe(0)
    expect(result.facts.length).toBe(0)
    expect(Array.isArray(result.chunks)).toBe(true)
  })

  test("graph fields always present even when lightrag returns nothing", async () => {
    setNextEmbedding(unitVec(50))
    const result = await recall({
      query: "x",
      k: 5,
      kinds: ["thoughts"],
      halfLifeDays: 30,
    })
    expect(Array.isArray(result.graph.entities)).toBe(true)
    expect(Array.isArray(result.graph.relations)).toBe(true)
  })

  test("k limit respected — never more than k results per kind", async () => {
    setNextEmbedding(unitVec(50))
    const result = await recall({
      query: "x",
      k: 1,
      kinds: ["thoughts"],
      halfLifeDays: 30,
    })
    expect(result.thoughts.length).toBeLessThanOrEqual(1)
  })
})
