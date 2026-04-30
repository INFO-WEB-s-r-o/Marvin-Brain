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
  let nextEmb = 0
  const fakeEmbedder = {
    embed: async () => {
      const v = new Array(1536).fill(0)
      v[nextEmb++ % 1536] = 1
      return v
    },
  }
  const fakeLightrag = {
    query: async () => ({ entities: [], relations: [] }),
    index: async () => undefined,
    cleanupDeleted: async () => undefined,
  }
  const thoughts = createThoughtsService({
    db, embedder: fakeEmbedder, lightrag: fakeLightrag, similarityThreshold: 0.92,
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

describe("POST /v1/thoughts/:id/forget", () => {
  test("marks thought forgotten and excludes from get/recent", async () => {
    const post = await app.request("/v1/thoughts", {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ content: "to be forgotten" }),
    })
    const { id } = (await post.json()) as { id: string }

    const f = await app.request(`/v1/thoughts/${id}/forget`, {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ reason: "stale" }),
    })
    expect(f.status).toBe(200)

    const get = await app.request(`/v1/thoughts/${id}`, { headers: authHeader() })
    expect(get.status).toBe(404)
  })

  test("requires reason", async () => {
    const post = await app.request("/v1/thoughts", {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ content: "needs reason" }),
    })
    const { id } = (await post.json()) as { id: string }
    const res = await app.request(`/v1/thoughts/${id}/forget`, {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  test("returns 404 for unknown id", async () => {
    const res = await app.request(`/v1/thoughts/nope/forget`, {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ reason: "x" }),
    })
    expect(res.status).toBe(404)
  })
})
