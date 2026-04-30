import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { env } from "~/lib/env"
import * as schema from "./schema"

let pool: ReturnType<typeof postgres> | null = null
let db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!db) {
    pool = postgres(env().DATABASE_URL, { max: 10 })
    db = drizzle(pool, { schema })
  }
  return db
}

export function getPool(): ReturnType<typeof postgres> {
  if (!pool) getDb()
  return pool!
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    db = null
  }
}
