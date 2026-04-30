import { buildApp } from "~/api/index"

export const TEST_API_KEY = "k".repeat(32)

export function makeTestApp() {
  return buildApp({ apiKey: TEST_API_KEY, logLevel: "warn" })
}

export function authHeader() {
  return { authorization: `Bearer ${TEST_API_KEY}` }
}
