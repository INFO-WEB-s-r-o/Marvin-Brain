import { describe, expect, test } from "bun:test"
import { loadEnv } from "~/lib/env"

describe("loadEnv", () => {
  test("returns parsed env when required vars are present", () => {
    const env = loadEnv({
      BRAIN_API_KEY: "x".repeat(32),
      DATABASE_URL: "postgresql://localhost/test",
      OPENAI_API_KEY: "sk-test",
      LIGHTRAG_URL: "http://localhost:8000",
    })
    expect(env.BRAIN_API_KEY).toBe("x".repeat(32))
    expect(env.SIMILARITY_THRESHOLD).toBe(0.92) // default
    expect(env.PRUNE_AFTER_DAYS).toBe(14)
  })

  test("rejects short BRAIN_API_KEY", () => {
    expect(() =>
      loadEnv({
        BRAIN_API_KEY: "short",
        DATABASE_URL: "postgresql://localhost/test",
        OPENAI_API_KEY: "sk-test",
        LIGHTRAG_URL: "http://localhost:8000",
      })
    ).toThrow(/BRAIN_API_KEY/)
  })

  test("rejects missing OPENAI_API_KEY", () => {
    expect(() =>
      loadEnv({
        BRAIN_API_KEY: "x".repeat(32),
        DATABASE_URL: "postgresql://localhost/test",
        LIGHTRAG_URL: "http://localhost:8000",
      } as Record<string, string>)
    ).toThrow(/OPENAI_API_KEY/)
  })

  test("coerces numeric tunables", () => {
    const env = loadEnv({
      BRAIN_API_KEY: "x".repeat(32),
      DATABASE_URL: "postgresql://localhost/test",
      OPENAI_API_KEY: "sk-test",
      LIGHTRAG_URL: "http://localhost:8000",
      SIMILARITY_THRESHOLD: "0.95",
      PRUNE_AFTER_DAYS: "21",
    })
    expect(env.SIMILARITY_THRESHOLD).toBe(0.95)
    expect(env.PRUNE_AFTER_DAYS).toBe(21)
  })
})
