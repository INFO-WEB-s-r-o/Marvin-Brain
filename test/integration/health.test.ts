import { describe, expect, test } from "bun:test"
import { buildApp } from "~/api/index"

describe("GET /health", () => {
  test("returns 200 ok without auth", async () => {
    const app = buildApp({ apiKey: "x".repeat(32), logLevel: "warn" })
    const res = await app.request("/health")
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string }
    expect(body.status).toBe("ok")
  })
})
