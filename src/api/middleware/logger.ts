import { createMiddleware } from "hono/factory"
import type { Logger } from "~/lib/logger"

export function requestLogger(logger: Logger) {
  return createMiddleware(async (c, next) => {
    const start = Date.now()
    await next()
    logger.info("request", {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration_ms: Date.now() - start,
    })
  })
}
