import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { rateLimit, _resetBucketsForTests } from "~/api/middleware/rate-limit"

describe("rateLimit", () => {
  test("allows up to N within window then 429", async () => {
    _resetBucketsForTests()
    const app = new Hono()
    app.use("*", rateLimit({ key: "test", capacity: 2, refillPerSecond: 0 }))
    app.get("/", (c) => c.text("ok"))

    expect((await app.request("/")).status).toBe(200)
    expect((await app.request("/")).status).toBe(200)
    expect((await app.request("/")).status).toBe(429)
  })

  test("refill replenishes tokens over time", async () => {
    _resetBucketsForTests()
    const app = new Hono()
    app.use("*", rateLimit({ key: "test2", capacity: 1, refillPerSecond: 1000 })) // 1 token / ms
    app.get("/", (c) => c.text("ok"))

    expect((await app.request("/")).status).toBe(200)
    // bucket exhausted; wait 50ms which at 1000/s would refill ~50 tokens
    await new Promise((r) => setTimeout(r, 50))
    expect((await app.request("/")).status).toBe(200)
  })
})
