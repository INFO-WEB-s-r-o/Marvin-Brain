import type { ErrorHandler } from "hono"
import { HTTPException } from "hono/http-exception"
import type { Logger } from "~/lib/logger"

export function errorHandler(logger: Logger): ErrorHandler {
  return (err, c) => {
    if (err instanceof HTTPException) {
      logger.warn("http_exception", { status: err.status, message: err.message, path: c.req.path })
      return c.json({ error: err.message }, err.status)
    }
    logger.error("unhandled_error", { error: String(err), path: c.req.path })
    return c.json({ error: "internal_server_error" }, 500)
  }
}
