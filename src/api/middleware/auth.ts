import { timingSafeEqual } from "node:crypto"
import { createMiddleware } from "hono/factory"

export interface BearerAuthOptions {
  apiKey: string
}

export function bearerAuth(opts: BearerAuthOptions) {
  const expected = Buffer.from(opts.apiKey, "utf8")
  return createMiddleware(async (c, next) => {
    const header = c.req.header("authorization") ?? ""
    if (!header.toLowerCase().startsWith("bearer ")) {
      return c.json({ error: "unauthorized" }, 401)
    }
    const token = header.slice(7).trim()
    const provided = Buffer.from(token, "utf8")
    if (provided.length !== expected.length) {
      return c.json({ error: "unauthorized" }, 401)
    }
    if (!timingSafeEqual(provided, expected)) {
      return c.json({ error: "unauthorized" }, 401)
    }
    return next()
  })
}
