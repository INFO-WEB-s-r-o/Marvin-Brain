import { describe, expect, test } from "bun:test"
import { buildMcpServer } from "~/mcp/index"

describe("buildMcpServer", () => {
  test("constructs without throwing", () => {
    const s = buildMcpServer({
      apiBaseUrl: "http://127.0.0.1:8787",
      apiKey: "x".repeat(32),
      port: 3100,
    })
    expect(s).toBeDefined()
  })
})
