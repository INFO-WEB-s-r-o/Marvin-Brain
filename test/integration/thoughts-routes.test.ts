import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/postgres-js"
import { startPgWithSchema } from "../helpers/pg"
import { authHeader, makeTestAppWithServices } from "../helpers/app"
import { createThoughtsService } from "~/services/thoughts"
import * as schema from "~/db/schema"

let teardown: () => Promise<void>
let app: ReturnType<typeof makeTestAppWithServices>

beforeAll(async () => {
  const { container, sql } = await startPgWithSchema()
  const db = drizzle(sql, { schema })
  const fakeEmbedder = {
    embed: async () => {
      const v = new Array(1536).fill(0)
      v[0] = 1
      return v
    },
  }
  const fakeLightrag = {
    query: async () => ({ entities: [], relations: [] }),
    index: async () => undefined,
    cleanupDeleted: async () => undefined,
  }
  const thoughts = createThoughtsService({
    db,
    embedder: fakeEmbedder,
    lightrag: fakeLightrag,
    similarityThreshold: 0.92,
  })
  app = makeTestAppWithServices({ thoughts })
  teardown = async () => {
    await sql.end()
    await container.stop()
  }
})

afterAll(async () => {
  await teardown()
})

describe("POST /v1/thoughts", () => {
  test("inserts a new thought (200)", async () => {
    const res = await app.request("/v1/thoughts", {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ content: "I should water the plants" }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { kind: string; weight: number }
    expect(body.kind).toBe("new")
    expect(body.weight).toBe(0)
  })

  test("rejects empty content (400)", async () => {
    const res = await app.request("/v1/thoughts", {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ content: "" }),
    })
    expect(res.status).toBe(400)
  })

  test("rejects no auth (401)", async () => {
    const res = await app.request("/v1/thoughts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "x" }),
    })
    expect(res.status).toBe(401)
  })
})
