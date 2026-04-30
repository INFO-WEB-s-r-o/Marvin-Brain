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

describe("fact versioning", () => {
  test("posting with parent_fact_id marks the previous fact non-latest", async () => {
    const a = await app.request("/v1/facts", {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ statement: "It is sunny" }),
    })
    const { id: aId } = (await a.json()) as { id: string }

    const b = await app.request("/v1/facts", {
      method: "POST",
      headers: { ...authHeader(), "content-type": "application/json" },
      body: JSON.stringify({ statement: "It is raining", parent_fact_id: aId }),
    })
    expect(b.status).toBe(200)

    const aGet = await (
      await app.request(`/v1/facts/${aId}`, { headers: authHeader() })
    ).json() as { isLatest: boolean }
    expect(aGet.isLatest).toBe(false)
  })
})
