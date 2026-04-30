import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { RecallReqSchema } from "~/lib/validation"
import type { RecallService } from "~/services/recall"

export function buildRecallRouter(svc: RecallService, halfLifeDays: number) {
  const r = new Hono()
  r.get("/recall", async (c) => {
    const parsed = RecallReqSchema.safeParse({
      q: c.req.query("q"),
      k: c.req.query("k"),
      container_tag: c.req.query("container_tag"),
      kinds: c.req.query("kinds"),
    })
    if (!parsed.success)
      throw new HTTPException(400, { message: parsed.error.issues.map((i) => i.message).join("; ") })

    const result = await svc.recall({
      query: parsed.data.q,
      k: parsed.data.k,
      containerTag: parsed.data.container_tag,
      kinds: parsed.data.kinds,
      halfLifeDays,
    })
    return c.json(result)
  })
  return r
}
