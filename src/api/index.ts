import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { env } from "~/lib/env"
import { createLogger } from "~/lib/logger"
import { bearerAuth } from "./middleware/auth"
import { errorHandler } from "./middleware/error"
import { requestLogger } from "./middleware/logger"
import { healthRouter } from "./routes/health"
import { buildThoughtsRouter } from "./routes/thoughts"
import type { ThoughtsService } from "~/services/thoughts"

export interface BuildAppOptions {
  apiKey: string
  logLevel: "debug" | "info" | "warn" | "error"
  services?: {
    thoughts?: ThoughtsService
  }
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
  if (opts.services?.thoughts) {
    v1.route("/", buildThoughtsRouter(opts.services.thoughts))
  }
  app.route("/v1", v1)

  return app
}

if (import.meta.main) {
  // Production wiring deferred to a later task — for now, boot the app without
  // services so /health and /v1 auth boundary work. Full wiring with DB+OpenAI+
  // LightRAG is added in T28+ once those services exist.
  const e = env()
  const app = buildApp({ apiKey: e.BRAIN_API_KEY, logLevel: e.LOG_LEVEL })
  serve({ fetch: app.fetch, port: e.API_PORT, hostname: "127.0.0.1" })
  console.log(JSON.stringify({ msg: "api listening", port: e.API_PORT }))
}
