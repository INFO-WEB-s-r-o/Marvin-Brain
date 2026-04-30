import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import { Wait } from "testcontainers"
import postgres from "postgres"

let container: StartedPostgreSqlContainer
let sql: ReturnType<typeof postgres>

beforeAll(async () => {
  // Use only health check wait strategy — bun's dockerode exec hangs on internal port checks
  container = await new PostgreSqlContainer("pgvector/pgvector:pg17")
    .withDatabase("brain_test")
    .withUsername("test")
    .withPassword("test")
    .withWaitStrategy(Wait.forHealthCheck())
    .start()

  sql = postgres(container.getConnectionUri())

  // run drizzle-generated migration manually
  const migrationSql = await Bun.file("drizzle/0000_init.sql")
    .text()
    .catch(async () => {
      // pick the first migration file
      const files = await Bun.$`ls drizzle/*.sql`.text()
      const first = files.split("\n").filter(Boolean).sort()[0]!
      return Bun.file(first).text()
    })
  await sql.unsafe(migrationSql)

  // run setup-vectors statements
  await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS vector`)
  await sql.unsafe(`ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS embedding_vec vector(1536)`)
}, 180_000)

afterAll(async () => {
  await sql.end()
  await container.stop()
})

describe("schema", () => {
  test("can insert a thought row", async () => {
    await sql`
      INSERT INTO thoughts (id, content, content_hash)
      VALUES ('t1', 'hello', 'abc123')
    `
    const rows = await sql`SELECT id, content, weight FROM thoughts WHERE id = 't1'`
    expect(rows[0]!.weight).toBe(0)
    expect(rows[0]!.content).toBe("hello")
  })

  test("content_hash unique constraint blocks duplicates", async () => {
    await sql`INSERT INTO thoughts (id, content, content_hash) VALUES ('t2', 'a', 'dup')`
    let threw = false
    try {
      await sql`INSERT INTO thoughts (id, content, content_hash) VALUES ('t3', 'b', 'dup')`
    } catch (err) {
      threw = true
      expect(String(err)).toMatch(/unique/i)
    }
    expect(threw).toBe(true)
  })
})
