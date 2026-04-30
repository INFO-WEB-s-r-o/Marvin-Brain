import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/postgres-js"
import { startPgWithSchema } from "../helpers/pg"
import { authHeader, makeTestAppWithServices } from "../helpers/app"
import { createFactsService } from "~/services/facts"
import * as schema from "~/db/schema"

let teardown: () => Promise<void>
let app: ReturnType<typeof makeTestAppWithServices>

beforeAll(async () => {
  const { container, sql } = await startPgWithSchema()
  const db = drizzle(sql, { schema })
  const fakeEmbedder = {
    embed: async () => new Array(1536).fill(0).map(() => Math.random()),
  }
  const factsSvc = createFactsService({ db, embedder: fakeEmbedder })
  app = makeTestAppWithServices({ facts: factsSvc })
  teardown = async () => {
    await sql.end()
    await container.stop()
  }
})

afterAll(async () => {
  await teardown()
})

describe("POST /v1/facts", () => {
  test("inserts a fact with isLatest=true", async () => {
    const res = await app.request("/v1/facts", {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ statement: "Pavel lives in Prague" }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: string; isLatest: boolean }
    expect(body.isLatest).toBe(true)
    expect(body.id).toMatch(/^[0-9A-Z]{26}$/) // ULID shape
  })
})

describe("GET /v1/facts/:id", () => {
  test("returns 404 for unknown id", async () => {
    const res = await app.request("/v1/facts/nope", { headers: authHeader() })
    expect(res.status).toBe(404)
  })
})

describe("POST /v1/facts/:id/forget", () => {
  test("forgets a fact", async () => {
    const post = await app.request("/v1/facts", {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ statement: "to forget" }),
    })
    const { id } = (await post.json()) as { id: string }
    const res = await app.request(`/v1/facts/${id}/forget`, {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ reason: "stale" }),
    })
    expect(res.status).toBe(200)
  })
})
