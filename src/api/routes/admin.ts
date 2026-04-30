import { Hono } from "hono"
import { ulid } from "ulid"
import { consolidationRuns } from "~/db/schema"
import type { getDb } from "~/db/client"

export function buildAdminRouter(db: ReturnType<typeof getDb>) {
  const r = new Hono()
  r.post("/admin/consolidate-now", async (c) => {
    const id = ulid()
    await db.insert(consolidationRuns).values({ id, status: "pending" })
    return c.json({ run_id: id, status: "pending" }, 200)
  })
  return r
}
