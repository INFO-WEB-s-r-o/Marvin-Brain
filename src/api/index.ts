import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { env } from "~/lib/env"
import { createLogger } from "~/lib/logger"
import { bearerAuth } from "./middleware/auth"
import { errorHandler } from "./middleware/error"
import { requestLogger } from "./middleware/logger"
import { healthRouter } from "./routes/health"

export interface BuildAppOptions {
  apiKey: string
  logLevel: "debug" | "info" | "warn" | "error"
}

export function buildApp(opts: BuildAppOptions) {
  const logger = createLogger({ level: opts.logLevel })
  const app = new Hono()

  app.onError(errorHandler(logger))
  app.use("*", requestLogger(logger))

  // health is unauthenticated
  app.route("/", healthRouter)

  // everything under /v1 requires bearer
  const v1 = new Hono()
  v1.use("*", bearerAuth({ apiKey: opts.apiKey }))
  // routes mounted in later tasks
  app.route("/v1", v1)

  return app
}

if (import.meta.main) {
  const e = env()
  const app = buildApp({ apiKey: e.BRAIN_API_KEY, logLevel: e.LOG_LEVEL })
  serve({ fetch: app.fetch, port: e.API_PORT, hostname: "127.0.0.1" })
  console.log(JSON.stringify({ msg: "api listening", port: e.API_PORT }))
}
