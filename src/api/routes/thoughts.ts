import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { RecordThoughtReqSchema } from "~/lib/validation"
import type { ThoughtsService } from "~/services/thoughts"

export function buildThoughtsRouter(svc: ThoughtsService) {
  const r = new Hono()

  r.post("/thoughts", async (c) => {
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
  })

  return r
}
