import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { env } from "~/lib/env"
import { createLogger } from "~/lib/logger"
import { bearerAuth } from "./middleware/auth"
import { errorHandler } from "./middleware/error"
import { requestLogger } from "./middleware/logger"
import { healthRouter } from "./routes/health"
import { buildThoughtsRouter } from "./routes/thoughts"
import { buildFactsRouter } from "./routes/facts"
import { buildRecallRouter } from "./routes/recall"
import { buildAdminRouter } from "./routes/admin"
import type { ThoughtsService } from "~/services/thoughts"
import type { FactsService } from "~/services/facts"
import type { RecallService } from "~/services/recall"
import type { getDb } from "~/db/client"
import { getDb as getDbImpl } from "~/db/client"
import { createPgEmbeddingCache } from "~/lib/embedding-cache"
import { createOpenAIClient } from "~/lib/openai"
import { createLightRAGClient } from "~/lib/lightrag"
import { createThoughtsService } from "~/services/thoughts"
import { createFactsService } from "~/services/facts"
import { createRecallService } from "~/services/recall"

export interface BuildAppOptions {
  apiKey: string
  logLevel: "debug" | "info" | "warn" | "error"
  halfLifeDays?: number
  db?: ReturnType<typeof getDb>
  services?: {
    thoughts?: ThoughtsService
    facts?: FactsService
    recall?: RecallService
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
  if (opts.db) {
    v1.route("/", buildAdminRouter(opts.db))
  }
  if (opts.services?.thoughts) {
    v1.route("/", buildThoughtsRouter(opts.services.thoughts))
  }
  if (opts.services?.facts) {
    v1.route("/", buildFactsRouter(opts.services.facts))
  }
  if (opts.services?.recall) {
    v1.route("/", buildRecallRouter(opts.services.recall, opts.halfLifeDays ?? 30))
  }
  app.route("/v1", v1)

  return app
}

if (import.meta.main) {
  const e = env()
  const db = getDbImpl()
  const cache = createPgEmbeddingCache()
  const openai = createOpenAIClient({
    apiKey: e.OPENAI_API_KEY,
    embeddingModel: e.EMBEDDING_MODEL,
    consolidationModel: e.CONSOLIDATION_MODEL,
    cache,
  })
  const lightrag = createLightRAGClient({ baseUrl: e.LIGHTRAG_URL })
  const thoughts = createThoughtsService({
    db,
    embedder: openai,
    lightrag,
    similarityThreshold: e.SIMILARITY_THRESHOLD,
  })
  const facts = createFactsService({ db, embedder: openai })
  const recall = createRecallService({ db, embedder: openai, lightrag })

  const app = buildApp({
    apiKey: e.BRAIN_API_KEY,
    logLevel: e.LOG_LEVEL,
    halfLifeDays: e.RECENCY_HALF_LIFE_DAYS,
    db,
    services: { thoughts, facts, recall },
  })
  serve({ fetch: app.fetch, port: e.API_PORT, hostname: e.API_HOST })
  console.log(JSON.stringify({ msg: "api listening", host: e.API_HOST, port: e.API_PORT }))
}
