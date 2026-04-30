import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { rateLimit } from "~/api/middleware/rate-limit"
import { ForgetReqSchema, RecordThoughtReqSchema } from "~/lib/validation"
import type { ThoughtsService } from "~/services/thoughts"

export function buildThoughtsRouter(svc: ThoughtsService) {
  const r = new Hono()

  r.get("/thoughts/recent", async (c) => {
    const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 20)))
    const list = await svc.recent(limit)
    return c.json({ thoughts: list })
  })

  r.get("/thoughts/:id", async (c) => {
    const t = await svc.getById(c.req.param("id"))
    if (!t) throw new HTTPException(404, { message: "not_found" })
    return c.json(t)
  })

  r.post("/thoughts/:id/forget", async (c) => {
    const json = await c.req.json().catch(() => null)
    const parsed = ForgetReqSchema.safeParse(json)
    if (!parsed.success) throw new HTTPException(400, { message: "reason required" })
    const result = await svc.forget(c.req.param("id"), parsed.data.reason)
    if (!result) throw new HTTPException(404, { message: "not_found" })
    return c.json({ ok: true })
  })

  r.post(
    "/thoughts",
    rateLimit({ key: "post-thoughts", capacity: 60, refillPerSecond: 1 }),
    async (c) => {
      const json = await c.req.json().catch(() => null)
      const parsed = RecordThoughtReqSchema.safeParse(json)
      if (!parsed.success) {
        throw new HTTPException(400, { message: parsed.error.issues.map((i) => i.message).join("; ") })
      }
      const result = await svc.record({
        content: parsed.data.content,
        containerTag: parsed.data.container_tag,
        metadata: parsed.data.metadata,
      })
      return c.json(result, 200)
    }
  )

  return r
}
