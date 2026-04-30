import { sql as raw, eq, and, gte, or, isNull } from "drizzle-orm"
import { ulid } from "ulid"
import { thoughts, facts, consolidationRuns } from "~/db/schema"
import type { getDb } from "~/db/client"
import type { Embedder, ChatClient } from "~/lib/openai"
import type { LightRAGClient } from "~/lib/lightrag"
import { cosine } from "~/lib/similarity"

export interface ConsolidateOptions {
  db: ReturnType<typeof getDb>
  openai: Embedder & ChatClient
  lightrag: LightRAGClient
  weightFloor: number
  clusterSimThreshold: number
  minClusterSize: number
  minClusterWeight: number
  confidenceFloor: number
  consolidationModel: string
}

export interface ConsolidateRunResult {
  runId: string
  candidates: number
  clusters: number
  factsCreated: number
}

export async function consolidate(opts: ConsolidateOptions): Promise<ConsolidateRunResult> {
  const runId = ulid()
  await opts.db.insert(consolidationRuns).values({ id: runId, status: "running" })

  try {
    // 1. last successful run timestamp
    const lastSuccess = await opts.db
      .select()
      .from(consolidationRuns)
      .where(eq(consolidationRuns.status, "success"))
      .orderBy(raw`${consolidationRuns.startedAt} DESC`)
      .limit(1)
    const since = lastSuccess[0]?.startedAt ?? new Date(0)

    // 2. candidates: any of (created since, accessed since, weight >= floor)
    const candRows = await opts.db
      .select()
      .from(thoughts)
      .where(
        and(
          eq(thoughts.isForgotten, false),
          or(
            gte(thoughts.createdAt, since),
            // lastAccessedAt can be null; treat null as "never accessed" → not a candidate via this path
            and(
              raw`${thoughts.lastAccessedAt} IS NOT NULL`,
              gte(thoughts.lastAccessedAt, since),
            ),
            gte(thoughts.weight, opts.weightFloor),
          ),
        ),
      )

    // 3. parse embeddings
    const cands = candRows
      .filter((r) => r.embedding)
      .map((r) => ({ ...r, vec: JSON.parse(r.embedding!) as number[] }))

    // 4. greedy clustering
    const clusters: (typeof cands)[] = []
    for (const c of cands) {
      const found = clusters.find((cluster) =>
        cluster.some((member) => cosine(member.vec, c.vec) >= opts.clusterSimThreshold),
      )
      if (found) found.push(c)
      else clusters.push([c])
    }

    // 5. summarize qualifying clusters
    let factsCreated = 0
    for (const cluster of clusters) {
      const cumWeight = cluster.reduce((s, t) => s + t.weight, 0)
      if (cluster.length < opts.minClusterSize && cumWeight < opts.minClusterWeight) continue

      const promptUser = cluster.map((t, i) => `${i + 1}. ${t.content}`).join("\n")
      const llmJson = await opts.openai.complete({
        model: opts.consolidationModel,
        responseFormat: "json_object",
        system:
          'You consolidate recurring thoughts into a single durable fact. Reply ONLY with JSON: {"fact_text": string, "confidence": number 0..1, "supersedes_facts": string[]}.',
        user: `Recurring thoughts:\n${promptUser}\n\nProduce one summarizing fact.`,
        temperature: 0.2,
      })
      let llm: { fact_text: string; confidence: number; supersedes_facts?: string[] }
      try {
        llm = JSON.parse(llmJson)
      } catch {
        continue // skip malformed
      }
      if (llm.confidence < opts.confidenceFloor) continue

      const factId = ulid()
      const factEmb = await opts.openai.embed(llm.fact_text)
      await opts.db.insert(facts).values({
        id: factId,
        statement: llm.fact_text,
        embedding: JSON.stringify(factEmb),
        embeddingModel: "text-embedding-3-small",
        isLatest: true,
        rootFactId: factId,
        confidence: llm.confidence,
      })
      // mark thoughts as consolidated (additive, not forgotten)
      for (const t of cluster) {
        await opts.db
          .update(thoughts)
          .set({
            metadata: raw`COALESCE(${thoughts.metadata}, '{}'::jsonb) || ${JSON.stringify({ consolidated_into: factId, consolidation_run_id: runId })}::jsonb`,
            updatedAt: new Date(),
          })
          .where(eq(thoughts.id, t.id))
      }
      // graph index the new fact
      void opts.lightrag.index(factId, llm.fact_text)
      factsCreated++
    }

    await opts.db
      .update(consolidationRuns)
      .set({
        finishedAt: new Date(),
        status: "success",
        candidatesCount: cands.length,
        clustersCount: clusters.length,
        factsCreated,
      })
      .where(eq(consolidationRuns.id, runId))

    return { runId, candidates: cands.length, clusters: clusters.length, factsCreated }
  } catch (e) {
    await opts.db
      .update(consolidationRuns)
      .set({ finishedAt: new Date(), status: "error", errors: { message: String(e) } })
      .where(eq(consolidationRuns.id, runId))
    throw e
  }
}
