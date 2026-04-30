import { desc, eq, lt, ne, or } from "drizzle-orm"
import { thoughts, consolidationRuns } from "~/db/schema"
import type { getDb } from "~/db/client"
import type { LightRAGClient } from "~/lib/lightrag"

export interface PruneOptions {
  db: ReturnType<typeof getDb>
  lightrag: LightRAGClient
  pruneAfterDays: number
  currentRunId: string
}

export interface PruneResult {
  skipped: boolean
  reason?: string
  pruned: number
}

export async function prune(opts: PruneOptions): Promise<PruneResult> {
  // guard: previous run must have status='success' (or no previous run)
  const prev = await opts.db
    .select()
    .from(consolidationRuns)
    .where(ne(consolidationRuns.id, opts.currentRunId))
    .orderBy(desc(consolidationRuns.startedAt))
    .limit(1)

  if (prev[0] && prev[0].status !== "success") {
    return {
      skipped: true,
      reason: `previous run ${prev[0].id} status=${prev[0].status}`,
      pruned: 0,
    }
  }

  const cutoffMs = Date.now() - opts.pruneAfterDays * 24 * 60 * 60 * 1000
  const cutoff = new Date(cutoffMs)

  const rows = await opts.db
    .delete(thoughts)
    .where(or(lt(thoughts.lastMentionedAt, cutoff), eq(thoughts.isForgotten, true)))
    .returning({ id: thoughts.id })

  if (rows.length > 0) {
    await opts.lightrag.cleanupDeleted(rows.map((r) => r.id))
  }

  await opts.db
    .update(consolidationRuns)
    .set({ thoughtsPruned: rows.length })
    .where(eq(consolidationRuns.id, opts.currentRunId))

  return { skipped: false, pruned: rows.length }
}
