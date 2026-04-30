import { describe, expect, test } from "bun:test"
import { contentHash, normalizeContent } from "~/lib/content"

describe("normalizeContent", () => {
  test("trims leading and trailing whitespace", () => {
    expect(normalizeContent("  hello  ")).toBe("hello")
  })
  test("collapses internal whitespace", () => {
    expect(normalizeContent("a\n\n b\t\tc   d")).toBe("a b c d")
  })
  test("preserves case", () => {
    expect(normalizeContent("Hello World")).toBe("Hello World")
  })
  test("applies NFC unicode normalization", () => {
    // 'é' as e + combining acute (NFD) vs precomposed (NFC)
    const nfd = "é"
    const nfc = "é"
    expect(normalizeContent(nfd)).toBe(normalizeContent(nfc))
  })
  test("rejects empty content", () => {
    expect(() => normalizeContent("")).toThrow(/empty/)
    expect(() => normalizeContent("   ")).toThrow(/empty/)
  })
})

describe("contentHash", () => {
  test("produces a 64-char hex sha256", () => {
    const h = contentHash("hello")
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })
  test("is stable for the same input", () => {
    expect(contentHash("hello")).toBe(contentHash("hello"))
  })
  test("differs for different inputs", () => {
    expect(contentHash("a")).not.toBe(contentHash("b"))
  })
  test("is whitespace-insensitive (operates on normalized form)", () => {
    expect(contentHash("hello world")).toBe(contentHash("  hello   world  "))
  })
})
