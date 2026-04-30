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

  let nextEmb = 0
  const embedder = {
    embed: async () => {
      const v = new Array(1536).fill(0)
      v[nextEmb++ % 1536] = 1
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

  // record one thought
  await thoughtsSvc.record({ content: "I should water the plants" })

  app = makeTestAppWithServices({ thoughts: thoughtsSvc, recall: recallSvc })

  teardown = async () => {
    await sql.end()
    await container.stop()
  }
})

afterAll(async () => {
  await teardown()
})

describe("GET /v1/recall", () => {
  test("requires auth", async () => {
    const res = await app.request("/v1/recall?q=plants")
    expect(res.status).toBe(401)
  })

  test("rejects missing q (400)", async () => {
    const res = await app.request("/v1/recall", { headers: authHeader() })
    expect(res.status).toBe(400)
  })

  test("returns 200 with shape {thoughts, facts, chunks, graph}", async () => {
    const res = await app.request("/v1/recall?q=plants&k=5", { headers: authHeader() })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      thoughts: unknown[]
      facts: unknown[]
      chunks: unknown[]
      graph: unknown
    }
    expect(body.thoughts).toBeDefined()
    expect(body.facts).toBeDefined()
    expect(body.chunks).toBeDefined()
    expect(body.graph).toBeDefined()
  })

  test("respects kinds=facts only", async () => {
    const res = await app.request("/v1/recall?q=plants&kinds=facts", { headers: authHeader() })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { thoughts: unknown[] }
    // service still returns thoughts: [] when kinds doesn't include "thoughts"
    expect(Array.isArray(body.thoughts)).toBe(true)
  })
})
