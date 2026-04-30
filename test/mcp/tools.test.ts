import { describe, expect, test } from "bun:test"
import { recordThought } from "~/mcp/tools/record-thought"
import { recall } from "~/mcp/tools/recall"
import { recordFact } from "~/mcp/tools/record-fact"
import { forgetThought } from "~/mcp/tools/forget-thought"
import { forgetFact } from "~/mcp/tools/forget-fact"
import { listRecentThoughts } from "~/mcp/tools/list-recent-thoughts"
import { getThought } from "~/mcp/tools/get-thought"
import { getFact } from "~/mcp/tools/get-fact"

const TEST_UUID = "00000000-0000-4000-8000-000000000001"

describe("record_thought tool", () => {
  test("calls POST /v1/thoughts and returns the API result", async () => {
    const calls: Array<{ path: string; init?: RequestInit }> = []
    const tool = recordThought({
      async fetch(path, init) {
        calls.push({ path, init })
        return { id: "t1", kind: "new", weight: 0, mentionCount: 1 }
      },
    })
    const r = await tool.handle({ content: "hello" })
    expect(calls[0]!.path).toBe("/v1/thoughts")
    expect(calls[0]!.init?.method).toBe("POST")
    const text = (r.content[0] as { text: string }).text
    expect(JSON.parse(text).kind).toBe("new")
  })

  test("rejects empty content", async () => {
    const tool = recordThought({ async fetch() { return {} } })
    expect(() => tool.handle({ content: "" })).toThrow()
  })
})

describe("recall tool", () => {
  test("calls GET /v1/recall with query params", async () => {
    const calls: Array<{ path: string }> = []
    const tool = recall({
      async fetch(path) {
        calls.push({ path })
        return { results: [] }
      },
    })
    await tool.handle({ q: "what is love", k: 5 })
    expect(calls[0]!.path).toContain("/v1/recall?")
    expect(calls[0]!.path).toContain("q=what+is+love")
    expect(calls[0]!.path).toContain("k=5")
  })
})

describe("record_fact tool", () => {
  test("calls POST /v1/facts", async () => {
    const calls: Array<{ path: string; init?: RequestInit }> = []
    const tool = recordFact({
      async fetch(path, init) {
        calls.push({ path, init })
        return { id: "f1" }
      },
    })
    await tool.handle({ statement: "the sky is blue" })
    expect(calls[0]!.path).toBe("/v1/facts")
    expect(calls[0]!.init?.method).toBe("POST")
  })
})

describe("forget_thought tool", () => {
  test("calls POST /v1/thoughts/:id/forget with reason in body", async () => {
    const calls: Array<{ path: string; init?: RequestInit }> = []
    const tool = forgetThought({
      async fetch(path, init) {
        calls.push({ path, init })
        return { ok: true }
      },
    })
    await tool.handle({ id: TEST_UUID, reason: "outdated" })
    expect(calls[0]!.path).toBe(`/v1/thoughts/${TEST_UUID}/forget`)
    expect(calls[0]!.init?.method).toBe("POST")
    const body = JSON.parse(calls[0]!.init?.body as string)
    expect(body.reason).toBe("outdated")
    expect(body.id).toBeUndefined()
  })
})

describe("forget_fact tool", () => {
  test("calls POST /v1/facts/:id/forget", async () => {
    const calls: Array<{ path: string; init?: RequestInit }> = []
    const tool = forgetFact({
      async fetch(path, init) {
        calls.push({ path, init })
        return { ok: true }
      },
    })
    await tool.handle({ id: TEST_UUID, reason: "wrong" })
    expect(calls[0]!.path).toBe(`/v1/facts/${TEST_UUID}/forget`)
  })
})

describe("list_recent_thoughts tool", () => {
  test("calls GET /v1/thoughts/recent with optional limit", async () => {
    const calls: Array<{ path: string }> = []
    const tool = listRecentThoughts({
      async fetch(path) {
        calls.push({ path })
        return []
      },
    })
    await tool.handle({ limit: 10 })
    expect(calls[0]!.path).toBe("/v1/thoughts/recent?limit=10")
  })

  test("calls GET /v1/thoughts/recent without query when no args", async () => {
    const calls: Array<{ path: string }> = []
    const tool = listRecentThoughts({
      async fetch(path) {
        calls.push({ path })
        return []
      },
    })
    await tool.handle({})
    expect(calls[0]!.path).toBe("/v1/thoughts/recent")
  })
})

describe("get_thought tool", () => {
  test("calls GET /v1/thoughts/:id", async () => {
    const calls: Array<{ path: string }> = []
    const tool = getThought({
      async fetch(path) {
        calls.push({ path })
        return { id: TEST_UUID }
      },
    })
    await tool.handle({ id: TEST_UUID })
    expect(calls[0]!.path).toBe(`/v1/thoughts/${TEST_UUID}`)
  })
})

describe("get_fact tool", () => {
  test("calls GET /v1/facts/:id", async () => {
    const calls: Array<{ path: string }> = []
    const tool = getFact({
      async fetch(path) {
        calls.push({ path })
        return { id: TEST_UUID }
      },
    })
    await tool.handle({ id: TEST_UUID })
    expect(calls[0]!.path).toBe(`/v1/facts/${TEST_UUID}`)
  })
})
