import { createMiddleware } from "hono/factory"

interface Bucket {
  tokens: number
  lastRefill: number
}
const buckets = new Map<string, Bucket>()

export interface RateLimitOptions {
  key: string
  capacity: number
  refillPerSecond: number
}

export function rateLimit(opts: RateLimitOptions) {
  return createMiddleware(async (c, next) => {
    const now = Date.now()
    let b = buckets.get(opts.key)
    if (!b) {
      b = { tokens: opts.capacity, lastRefill: now }
      buckets.set(opts.key, b)
    } else {
      const elapsed = (now - b.lastRefill) / 1000
      b.tokens = Math.min(opts.capacity, b.tokens + elapsed * opts.refillPerSecond)
      b.lastRefill = now
    }
    if (b.tokens < 1) return c.json({ error: "rate_limited" }, 429)
    b.tokens -= 1
    return next()
  })
}

// Test-only utility to reset state between tests.
export function _resetBucketsForTests(): void {
  buckets.clear()
}
