import { describe, expect, test } from "bun:test"
import {
  ForgetReqSchema,
  RecallReqSchema,
  RecordFactReqSchema,
  RecordThoughtReqSchema,
} from "~/lib/validation"

describe("RecordThoughtReqSchema", () => {
  test("accepts minimal valid body", () => {
    const r = RecordThoughtReqSchema.safeParse({ content: "I should water the plants" })
    expect(r.success).toBe(true)
  })
  test("accepts container_tag and metadata", () => {
    const r = RecordThoughtReqSchema.safeParse({
      content: "x",
      container_tag: "project:foo",
      metadata: { source: "marvin/planner" },
    })
    expect(r.success).toBe(true)
  })
  test("rejects empty content", () => {
    const r = RecordThoughtReqSchema.safeParse({ content: "" })
    expect(r.success).toBe(false)
  })
  test("rejects content over 50k chars", () => {
    const r = RecordThoughtReqSchema.safeParse({ content: "x".repeat(50_001) })
    expect(r.success).toBe(false)
  })
})

describe("RecallReqSchema", () => {
  test("accepts minimal query", () => {
    const r = RecallReqSchema.safeParse({ q: "plants" })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.k).toBe(10) // default
  })
  test("accepts kinds csv", () => {
    const r = RecallReqSchema.safeParse({ q: "x", kinds: "thoughts,facts" })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.kinds).toEqual(["thoughts", "facts"])
  })
  test("rejects invalid kind", () => {
    const r = RecallReqSchema.safeParse({ q: "x", kinds: "thoughts,bogus" })
    expect(r.success).toBe(false)
  })
  test("clamps k to [1, 100]", () => {
    expect(RecallReqSchema.safeParse({ q: "x", k: 0 }).success).toBe(false)
    expect(RecallReqSchema.safeParse({ q: "x", k: 101 }).success).toBe(false)
  })
})

describe("RecordFactReqSchema", () => {
  test("accepts statement only", () => {
    expect(RecordFactReqSchema.safeParse({ statement: "Pavel lives in Prague" }).success).toBe(true)
  })
  test("accepts sources array", () => {
    expect(
      RecordFactReqSchema.safeParse({ statement: "x", sources: ["doc-1", "doc-2"] }).success
    ).toBe(true)
  })
})

describe("ForgetReqSchema", () => {
  test("requires reason", () => {
    expect(ForgetReqSchema.safeParse({}).success).toBe(false)
    expect(ForgetReqSchema.safeParse({ reason: "stale" }).success).toBe(true)
  })
})
