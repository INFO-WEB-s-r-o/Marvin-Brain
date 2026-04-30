import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { ForgetReqSchema, RecordFactReqSchema } from "~/lib/validation"
import type { FactsService } from "~/services/facts"

export function buildFactsRouter(svc: FactsService) {
  const r = new Hono()

  r.post("/facts", async (c) => {
    const json = await c.req.json().catch(() => null)
    const parsed = RecordFactReqSchema.safeParse(json)
    if (!parsed.success)
      throw new HTTPException(400, { message: parsed.error.issues.map((i) => i.message).join("; ") })
    const result = await svc.record({
      statement: parsed.data.statement,
      sources: parsed.data.sources,
      parentFactId: parsed.data.parent_fact_id,
      confidence: parsed.data.confidence,
    })
    return c.json(result, 200)
  })

  r.get("/facts/:id", async (c) => {
    const f = await svc.getById(c.req.param("id"))
    if (!f) throw new HTTPException(404, { message: "not_found" })
    return c.json(f)
  })

  r.post("/facts/:id/forget", async (c) => {
    const json = await c.req.json().catch(() => null)
    const parsed = ForgetReqSchema.safeParse(json)
    if (!parsed.success) throw new HTTPException(400, { message: "reason required" })
    const result = await svc.forget(c.req.param("id"), parsed.data.reason)
    if (!result) throw new HTTPException(404, { message: "not_found" })
    return c.json({ ok: true })
  })

  return r
}
