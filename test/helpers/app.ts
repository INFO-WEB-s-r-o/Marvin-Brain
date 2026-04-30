import { buildApp, type BuildAppOptions } from "~/api/index"
import type { ThoughtsService } from "~/services/thoughts"
import type { getDb } from "~/db/client"

export const TEST_API_KEY = "k".repeat(32)

export function makeTestApp() {
  return buildApp({ apiKey: TEST_API_KEY, logLevel: "warn" })
}

export function makeTestAppWithServices(services: NonNullable<BuildAppOptions["services"]>) {
  return buildApp({ apiKey: TEST_API_KEY, logLevel: "warn", services })
}

export function makeTestAppWithDb(
  db: ReturnType<typeof getDb>,
  services?: NonNullable<BuildAppOptions["services"]>,
) {
  return buildApp({ apiKey: TEST_API_KEY, logLevel: "warn", db, services })
}

export function authHeader() {
  return { authorization: `Bearer ${TEST_API_KEY}` }
}
