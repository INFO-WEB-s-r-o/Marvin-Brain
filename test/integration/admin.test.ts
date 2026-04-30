import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/postgres-js"
import { startPgWithSchema } from "../helpers/pg"
import { authHeader, makeTestAppWithDb } from "../helpers/app"
import * as schema from "~/db/schema"

let teardown: () => Promise<void>
let app: ReturnType<typeof makeTestAppWithDb>

beforeAll(async () => {
  const { container, sql } = await startPgWithSchema()
  const db = drizzle(sql, { schema })
  app = makeTestAppWithDb(db)
  teardown = async () => {
    await sql.end()
    await container.stop()
  }
})

afterAll(async () => {
  await teardown()
})

describe("POST /v1/admin/consolidate-now", () => {
  test("requires auth", async () => {
    const res = await app.request("/v1/admin/consolidate-now", { method: "POST" })
    expect(res.status).toBe(401)
  })

  test("returns 200 with run_id", async () => {
    const res = await app.request("/v1/admin/consolidate-now", {
      method: "POST",
      headers: authHeader(),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { run_id: string; status: string }
    expect(body.status).toBe("pending")
    expect(body.run_id).toMatch(/^[0-9A-Z]{26}$/)
  })
})
