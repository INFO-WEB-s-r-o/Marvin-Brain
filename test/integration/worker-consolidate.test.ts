import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/postgres-js"
import { ulid } from "ulid"
import { contentHash } from "~/lib/content"
import { startPgWithSchema } from "../helpers/pg"
import { consolidate } from "~/worker/consolidate"
import * as schema from "~/db/schema"

let teardown: () => Promise<void>
let db: ReturnType<typeof drizzle<typeof schema>>

function unitVec(idx: number): number[] {
  const v = new Array(1536).fill(0)
  v[idx] = 1
  return v
}

/** Insert a thought row directly, bypassing the service dedup logic */
async function insertThought(content: string, vec: number[], weight = 0): Promise<void> {
  const id = ulid()
  await db.insert(schema.thoughts).values({
    id,
    content,
    contentHash: contentHash(content + id), // unique hash per row to prevent dedup
    embedding: JSON.stringify(vec),
    embeddingModel: "text-embedding-3-small",
    weight,
  })
}

beforeAll(async () => {
  const { container, sql } = await startPgWithSchema()
  db = drizzle(sql, { schema })

  teardown = async () => {
    await sql.end()
    await container.stop()
  }
}, 180_000)

afterAll(async () => {
  await teardown()
})

// Truncate shared tables before each test so state doesn't leak across tests
beforeEach(async () => {
  await db.delete(schema.facts)
  await db.delete(schema.consolidationRuns)
  await db.delete(schema.thoughts)
})

describe("consolidate", () => {
  test("clusters similar thoughts and emits a fact", async () => {
    // Insert 4 thoughts directly with identical vectors (bypassing dedup service)
    await insertThought("water plants in morning", unitVec(50))
    await insertThought("plants need watering", unitVec(50))
    await insertThought("morning watering routine", unitVec(50))
    await insertThought("schedule plant watering", unitVec(50))

    // Verify 4 rows exist before running consolidation
    const rows = await db.select().from(schema.thoughts)
    expect(rows.length).toBe(4)

    const openai = {
      embed: async () => unitVec(50),
      complete: async () =>
        JSON.stringify({
          fact_text: "Plants need watering routinely",
          confidence: 0.9,
          supersedes_facts: [],
        }),
    }
    const lightrag = {
      query: async () => ({ entities: [], relations: [] }),
      index: async () => undefined,
      cleanupDeleted: async () => undefined,
    }

    const result = await consolidate({
      db,
      openai,
      lightrag,
      weightFloor: 0,
      clusterSimThreshold: 0.85,
      minClusterSize: 3,
      minClusterWeight: 5,
      confidenceFloor: 0.7,
      consolidationModel: "gpt-4o-mini",
    })

    expect(result.factsCreated).toBeGreaterThanOrEqual(1)
    expect(result.candidates).toBe(4)

    // Verify a fact row was written with the expected content
    const factRows = await db.select().from(schema.facts)
    expect(factRows.length).toBeGreaterThanOrEqual(1)
    expect(factRows[0]?.statement).toBe("Plants need watering routinely")
    expect(factRows[0]?.confidence).toBeCloseTo(0.9, 5)

    // Verify the consolidation run was recorded as success
    const runs = await db.select().from(schema.consolidationRuns)
    expect(runs.length).toBe(1)
    expect(runs[0]?.status).toBe("success")
  })

  test("skips clusters with low confidence", async () => {
    await insertThought("isolated thought", unitVec(100))

    const openai = {
      embed: async () => unitVec(100),
      complete: async () =>
        JSON.stringify({ fact_text: "x", confidence: 0.1, supersedes_facts: [] }),
    }
    const lightrag = {
      query: async () => ({ entities: [], relations: [] }),
      index: async () => undefined,
      cleanupDeleted: async () => undefined,
    }

    const result = await consolidate({
      db,
      openai,
      lightrag,
      weightFloor: 0,
      clusterSimThreshold: 0.85,
      minClusterSize: 1, // allow single-thought clusters for this test
      minClusterWeight: 0,
      confidenceFloor: 0.7,
      consolidationModel: "gpt-4o-mini",
    })

    const factRows = await db.select().from(schema.facts)
    // confidence=0.1 < floor=0.7 → no new fact
    expect(factRows.length).toBe(0)
    expect(result.factsCreated).toBe(0)
    expect(result.candidates).toBe(1)
  })
})
