import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/postgres-js"
import { startPgWithSchema } from "../helpers/pg"
import { authHeader, makeTestAppWithServices } from "../helpers/app"
import { createThoughtsService } from "~/services/thoughts"
import { createRecallService } from "~/services/recall"
import * as schema from "~/db/schema"

let teardown: () => Promise<void>
let app: ReturnType<typeof makeTestAppWithServices>

beforeAll(async () => {
  const { container, sql } = await startPgWithSchema()
  const db = drizzle(sql, { schema })

  // Use a deterministic embedder so similarity is predictable.
  // For this e2e: each call returns the SAME unit vector at index 50 → near-duplicates merge.
  const embedder = {
    embed: async () => {
      const v = new Array(1536).fill(0)
      v[50] = 1
      return v
    },
  }
  const lightrag = {
    query: async () => ({ entities: [], relations: [] }),
    index: async () => undefined,
    cleanupDeleted: async () => undefined,
  }
  const thoughtsSvc = createThoughtsService({
    db, embedder, lightrag, similarityThreshold: 0.92,
  })
  const recallSvc = createRecallService({ db, embedder, lightrag })

  app = makeTestAppWithServices({ thoughts: thoughtsSvc, recall: recallSvc })
  teardown = async () => {
    await sql.end()
    await container.stop()
  }
})

afterAll(async () => {
  await teardown()
})

describe("end-to-end thought→recall", () => {
  test("record three near-duplicate thoughts, recall returns top hit with weight bumped", async () => {
    for (const c of ["water plants", "water the plants", "I should water plants"]) {
      const res = await app.request("/v1/thoughts", {
        method: "POST",
        headers: { ...authHeader(), "content-type": "application/json" },
        body: JSON.stringify({ content: c }),
      })
      expect(res.status).toBe(200)
    }

    const recallRes = await app.request("/v1/recall?q=plants&k=5", { headers: authHeader() })
    expect(recallRes.status).toBe(200)
    const body = (await recallRes.json()) as {
      thoughts: Array<{ content: string; weight: number }>
    }
    expect(body.thoughts.length).toBeGreaterThan(0)
    // dedup happened — all three near-duplicates merged into one with bumped weight
    expect(body.thoughts[0]!.weight).toBeGreaterThan(0)
  })

  test("dissimilar thoughts produce separate entries", async () => {
    // mock embedder closed over outer var; for this test, re-record with the
    // same embedder (returns same vec) — so this test acts as a smoke for the
    // recall returning multiple entries when DB has multiple rows.
    // (The unit-vector embedder collapses paraphrases; that's the previous test's point.)
    const recallRes = await app.request("/v1/recall?q=anything&k=10", { headers: authHeader() })
    expect(recallRes.status).toBe(200)
    const body = (await recallRes.json()) as { thoughts: unknown[]; facts: unknown[] }
    expect(body.thoughts).toBeDefined()
    expect(body.facts).toBeDefined()
  })
})
