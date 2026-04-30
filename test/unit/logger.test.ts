import { afterEach, describe, expect, mock, test } from "bun:test"
import { createLogger } from "~/lib/logger"

describe("createLogger", () => {
  const writes: string[] = []
  const logger = createLogger({ level: "info", write: (s) => writes.push(s) })

  afterEach(() => {
    writes.length = 0
  })

  test("emits structured JSON line", () => {
    logger.info("hello", { user: "x" })
    expect(writes).toHaveLength(1)
    const parsed = JSON.parse(writes[0]!)
    expect(parsed.level).toBe("info")
    expect(parsed.msg).toBe("hello")
    expect(parsed.user).toBe("x")
    expect(parsed.time).toBeDefined()
  })
  test("respects level threshold", () => {
    const writesWarn: string[] = []
    const log2 = createLogger({ level: "warn", write: (s) => writesWarn.push(s) })
    log2.info("ignored")
    log2.warn("kept")
    expect(writesWarn).toHaveLength(1)
    expect(JSON.parse(writesWarn[0]!).msg).toBe("kept")
  })
})
