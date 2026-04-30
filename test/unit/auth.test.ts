import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { bearerAuth } from "~/api/middleware/auth"

describe("bearerAuth", () => {
  function makeApp(key: string) {
    const app = new Hono()
    app.use("*", bearerAuth({ apiKey: key }))
    app.get("/", (c) => c.text("ok"))
    return app
  }

  test("rejects missing header → 401", async () => {
    const res = await makeApp("k".repeat(32)).request("/")
    expect(res.status).toBe(401)
  })

  test("rejects wrong scheme → 401", async () => {
    const res = await makeApp("k".repeat(32)).request("/", {
      headers: { authorization: `Basic xxx` },
    })
    expect(res.status).toBe(401)
  })

  test("rejects wrong token → 401", async () => {
    const res = await makeApp("k".repeat(32)).request("/", {
      headers: { authorization: `Bearer wrong` },
    })
    expect(res.status).toBe(401)
  })

  test("accepts correct bearer → 200", async () => {
    const key = "k".repeat(32)
    const res = await makeApp(key).request("/", { headers: { authorization: `Bearer ${key}` } })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("ok")
  })
})
