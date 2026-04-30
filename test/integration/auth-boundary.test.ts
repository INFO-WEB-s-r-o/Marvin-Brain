import { describe, expect, test } from "bun:test"
import { makeTestApp, authHeader } from "../helpers/app"

describe("auth boundary on /v1", () => {
  test("/v1/anything without auth → 401", async () => {
    const app = makeTestApp()
    // mount a probe route inside the test by adding to v1 — but since v1 has no
    // routes yet, hitting any /v1/... path returns 404 AFTER auth runs.
    // Confirm the response is 401, NOT 404.
    const res = await app.request("/v1/probe")
    expect(res.status).toBe(401)
  })
  test("/v1 with auth → 404 for unmounted route (passes auth)", async () => {
    const app = makeTestApp()
    const res = await app.request("/v1/probe", { headers: authHeader() })
    expect(res.status).toBe(404)
  })
})
