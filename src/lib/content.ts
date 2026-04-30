import { createHash } from "node:crypto"

export function normalizeContent(raw: string): string {
  const collapsed = raw.normalize("NFC").replace(/\s+/g, " ").trim()
  if (collapsed.length === 0) {
    throw new Error("content is empty after normalization")
  }
  return collapsed
}

export function contentHash(raw: string): string {
  const normalized = normalizeContent(raw)
  return createHash("sha256").update(normalized, "utf8").digest("hex")
}
