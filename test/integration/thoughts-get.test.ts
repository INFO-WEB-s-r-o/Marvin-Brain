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
      // produce orthogonal vectors so each insert is distinct
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

describe("GET /v1/thoughts/:id", () => {
  test("returns 404 for unknown id", async () => {
    const res = await app.request("/v1/thoughts/does-not-exist", { headers: authHeader() })
    expect(res.status).toBe(404)
  })

  test("returns the thought after creation", async () => {
    const post = await app.request("/v1/thoughts", {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ content: "fetchable thought" }),
    })
    const { id } = (await post.json()) as { id: string }
    const res = await app.request(`/v1/thoughts/${id}`, { headers: authHeader() })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { content: string }
    expect(body.content).toBe("fetchable thought")
  })
})

describe("GET /v1/thoughts/recent", () => {
  test("returns most-recently-mentioned first", async () => {
    await app.request("/v1/thoughts", {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ content: "older thought xy" }),
    })
    // wait a tiny bit so timestamps differ
    await new Promise((r) => setTimeout(r, 50))
    await app.request("/v1/thoughts", {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ content: "newer thought yz" }),
    })
    const res = await app.request("/v1/thoughts/recent?limit=2", { headers: authHeader() })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { thoughts: Array<{ content: string }> }
    expect(body.thoughts[0]!.content).toContain("newer")
  })
})
