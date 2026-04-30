import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { Wait } from "testcontainers"
import postgres from "postgres"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import { drizzle } from "drizzle-orm/postgres-js"

export async function startPgWithSchema() {
  // Use only health check wait strategy — bun's dockerode exec hangs on internal port checks
  const container = await new PostgreSqlContainer("pgvector/pgvector:pg17")
    .withWaitStrategy(Wait.forHealthCheck())
    .start()

  const sql = postgres(container.getConnectionUri())

  // apply drizzle migrations
  const db = drizzle(sql)
  await migrate(db, { migrationsFolder: "./drizzle" })

  // apply pgvector setup (extension + vector columns)
  await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS vector`)
  await sql.unsafe(
    `ALTER TABLE thoughts ADD COLUMN IF NOT EXISTS embedding_vec vector(1536)`,
  )
  await sql.unsafe(
    `ALTER TABLE memory_entries ADD COLUMN IF NOT EXISTS embedding_vec vector(1536)`,
  )
  await sql.unsafe(
    `ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedding_vec vector(1536)`,
  )

  return { container, sql, uri: container.getConnectionUri() }
}
