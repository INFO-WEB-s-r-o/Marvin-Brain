import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/postgres-js"
import { ulid } from "ulid"
import { startPgWithSchema } from "../helpers/pg"
import { prune } from "~/worker/prune"
import { contentHash } from "~/lib/content"
import * as schema from "~/db/schema"

let teardown: () => Promise<void>
let db: ReturnType<typeof drizzle<typeof schema>>

beforeAll(async () => {
  const { container, sql } = await startPgWithSchema()
  db = drizzle(sql, { schema })
  teardown = async () => {
    await sql.end()
    await container.stop()
  }
})

afterAll(async () => {
  await teardown()
})

beforeEach(async () => {
  await db.delete(schema.thoughts)
  await db.delete(schema.consolidationRuns)
})

const fakeLightrag = {
  query: async () => ({ entities: [], relations: [] }),
  index: async () => undefined,
  cleanupDeleted: async () => undefined,
}

function daysAgo(d: number): Date {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000)
}

describe("prune", () => {
  test("skips when previous run failed", async () => {
    const failedRunId = ulid()
    await db.insert(schema.consolidationRuns).values({
      id: failedRunId,
      status: "error",
      startedAt: daysAgo(1),
    })
    const currentRunId = ulid()
    await db.insert(schema.consolidationRuns).values({
      id: currentRunId,
      status: "running",
      startedAt: new Date(),
    })

    // insert a thought that would be pruned
    await db.insert(schema.thoughts).values({
      id: ulid(),
      content: "old thought",
      contentHash: contentHash("old thought"),
      lastMentionedAt: daysAgo(20),
    })

    const r = await prune({
      db,
      lightrag: fakeLightrag,
      pruneAfterDays: 14,
      currentRunId,
    })

    expect(r.skipped).toBe(true)
    expect(r.pruned).toBe(0)
    const remaining = await db.select().from(schema.thoughts)
    expect(remaining.length).toBe(1) // not pruned
  })

  test("hard-deletes thoughts older than the cutoff", async () => {
    const successRunId = ulid()
    await db.insert(schema.consolidationRuns).values({
      id: successRunId,
      status: "success",
      startedAt: daysAgo(1),
    })
    const currentRunId = ulid()
    await db.insert(schema.consolidationRuns).values({
      id: currentRunId,
      status: "running",
      startedAt: new Date(),
    })

    const oldId = ulid()
    const freshId = ulid()
    await db.insert(schema.thoughts).values([
      {
        id: oldId,
        content: "old",
        contentHash: contentHash("old-" + oldId),
        lastMentionedAt: daysAgo(20),
      },
      {
        id: freshId,
        content: "fresh",
        contentHash: contentHash("fresh-" + freshId),
        lastMentionedAt: daysAgo(1),
      },
    ])

    const r = await prune({
      db,
      lightrag: fakeLightrag,
      pruneAfterDays: 14,
      currentRunId,
    })

    expect(r.skipped).toBe(false)
    expect(r.pruned).toBe(1)
    const remaining = await db.select().from(schema.thoughts)
    expect(remaining.length).toBe(1)
    expect(remaining[0]!.id).toBe(freshId)
  })

  test("does not delete thoughts re-mentioned within window", async () => {
    const successRunId = ulid()
    await db.insert(schema.consolidationRuns).values({
      id: successRunId,
      status: "success",
      startedAt: daysAgo(1),
    })
    const currentRunId = ulid()
    await db.insert(schema.consolidationRuns).values({
      id: currentRunId,
      status: "running",
      startedAt: new Date(),
    })

    // thought created 20d ago but re-mentioned 5d ago
    await db.insert(schema.thoughts).values({
      id: ulid(),
      content: "rementioned",
      contentHash: contentHash("rementioned-" + ulid()),
      createdAt: daysAgo(20),
      lastMentionedAt: daysAgo(5),
    })

    const r = await prune({
      db,
      lightrag: fakeLightrag,
      pruneAfterDays: 14,
      currentRunId,
    })
    expect(r.pruned).toBe(0)
    const remaining = await db.select().from(schema.thoughts)
    expect(remaining.length).toBe(1)
  })
})
