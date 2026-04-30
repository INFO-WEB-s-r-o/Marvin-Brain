import cron from "node-cron"
import { eq } from "drizzle-orm"
import { consolidationRuns } from "~/db/schema"
import { getDb, closeDb } from "~/db/client"
import { env } from "~/lib/env"
import { createLogger } from "~/lib/logger"
import { createOpenAIClient } from "~/lib/openai"
import { createPgEmbeddingCache } from "~/lib/embedding-cache"
import { createLightRAGClient } from "~/lib/lightrag"
import { consolidate } from "./consolidate"
import { prune } from "./prune"

async function runOnce(triggeredRunId?: string) {
  const e = env()
  const db = getDb()
  const logger = createLogger({ level: e.LOG_LEVEL })
  const cache = createPgEmbeddingCache()
  const openai = createOpenAIClient({
    apiKey: e.OPENAI_API_KEY,
    embeddingModel: e.EMBEDDING_MODEL,
    consolidationModel: e.CONSOLIDATION_MODEL,
    cache,
  })
  const lightrag = createLightRAGClient({ baseUrl: e.LIGHTRAG_URL })

  logger.info("worker_run_start", { triggeredRunId })
  const result = await consolidate({
    db,
    openai,
    lightrag,
    weightFloor: e.CONSOLIDATION_WEIGHT_FLOOR,
    clusterSimThreshold: e.CLUSTER_SIM_THRESHOLD,
    minClusterSize: e.MIN_CLUSTER_SIZE,
    minClusterWeight: e.MIN_CLUSTER_WEIGHT,
    confidenceFloor: e.CONFIDENCE_FLOOR,
    consolidationModel: e.CONSOLIDATION_MODEL,
  })
  logger.info("consolidate_done", { ...result })

  const pruneRes = await prune({
    db,
    lightrag,
    pruneAfterDays: e.PRUNE_AFTER_DAYS,
    currentRunId: result.runId,
  })
  logger.info("prune_done", { ...pruneRes })

  // if API queued a manual trigger, mark it done
  if (triggeredRunId) {
    await db
      .update(consolidationRuns)
      .set({ status: "success", finishedAt: new Date() })
      .where(eq(consolidationRuns.id, triggeredRunId))
  }
}

async function pollForManualTriggers() {
  const db = getDb()
  const pending = await db
    .select()
    .from(consolidationRuns)
    .where(eq(consolidationRuns.status, "pending"))
    .limit(1)
  if (pending[0]) await runOnce(pending[0].id)
}

if (import.meta.main) {
  const e = env()
  const logger = createLogger({ level: e.LOG_LEVEL })

  // nightly @ 03:00 UTC
  cron.schedule(
    "0 3 * * *",
    () => {
      runOnce().catch((err) =>
        logger.error("nightly_run_error", { error: String(err) }),
      )
    },
    { timezone: "UTC" },
  )

  // poll every 30s for admin-triggered runs
  setInterval(() => {
    pollForManualTriggers().catch((err) =>
      logger.error("poll_error", { error: String(err) }),
    )
  }, 30_000)

  logger.info("worker_started")

  // keep process alive
  process.on("SIGTERM", async () => {
    await closeDb()
    process.exit(0)
  })
}
