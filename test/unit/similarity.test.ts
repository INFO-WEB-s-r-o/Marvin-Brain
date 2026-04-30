import { describe, expect, test } from "bun:test"
import { cosine, finalScore, recencyFactor, weightFactor } from "~/lib/similarity"

describe("cosine", () => {
  test("identical vectors → 1", () => {
    expect(cosine([1, 0, 0], [1, 0, 0])).toBeCloseTo(1)
  })
  test("orthogonal vectors → 0", () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0)
  })
  test("opposite vectors → -1", () => {
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1)
  })
  test("zero vector → 0 (no NaN)", () => {
    expect(cosine([0, 0], [1, 0])).toBe(0)
  })
})

describe("weightFactor", () => {
  test("weight 0 → 1.0", () => {
    expect(weightFactor(0)).toBeCloseTo(1.0)
  })
  test("weight 9 → ~1.5", () => {
    expect(weightFactor(9)).toBeCloseTo(1.5, 1)
  })
  test("weight 99 → ~2.0", () => {
    expect(weightFactor(99)).toBeCloseTo(2.0, 1)
  })
  test("monotonically increases with weight", () => {
    expect(weightFactor(1)).toBeGreaterThan(weightFactor(0))
    expect(weightFactor(10)).toBeGreaterThan(weightFactor(1))
  })
})

describe("recencyFactor", () => {
  test("now → 1.0", () => {
    expect(recencyFactor(new Date(), 30)).toBeCloseTo(1.0)
  })
  test("one half-life ago → ~0.5 (using exp decay)", () => {
    const half = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    // exp(-1) ~ 0.367, not 0.5 — using exp(-age/half_life) per spec
    expect(recencyFactor(half, 30)).toBeCloseTo(Math.exp(-1), 2)
  })
  test("very old → close to 0", () => {
    const old = new Date(Date.now() - 365 * 24 * 3600 * 1000)
    expect(recencyFactor(old, 30)).toBeLessThan(0.01)
  })
})

describe("finalScore", () => {
  test("plain sim with weight 0 and now → ~sim", () => {
    const score = finalScore({ sim: 0.8, weight: 0, lastMentionedAt: new Date(), inGraph: false })
    expect(score).toBeCloseTo(0.8, 2)
  })
  test("graph hit boosts by 1.15", () => {
    const a = finalScore({ sim: 0.8, weight: 0, lastMentionedAt: new Date(), inGraph: false })
    const b = finalScore({ sim: 0.8, weight: 0, lastMentionedAt: new Date(), inGraph: true })
    expect(b / a).toBeCloseTo(1.15, 2)
  })
  test("higher weight ranks higher at equal sim and recency", () => {
    const a = finalScore({ sim: 0.8, weight: 0, lastMentionedAt: new Date(), inGraph: false })
    const b = finalScore({ sim: 0.8, weight: 10, lastMentionedAt: new Date(), inGraph: false })
    expect(b).toBeGreaterThan(a)
  })
  test("weight cannot promote irrelevant items above relevant ones", () => {
    // weight=99 sim=0.3 should still lose to weight=0 sim=0.95
    const heavy = finalScore({ sim: 0.3, weight: 99, lastMentionedAt: new Date(), inGraph: false })
    const fresh = finalScore({ sim: 0.95, weight: 0, lastMentionedAt: new Date(), inGraph: false })
    expect(fresh).toBeGreaterThan(heavy)
  })
})
