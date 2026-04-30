export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("dimension mismatch")
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] as number
    const bi = b[i] as number
    dot += ai * bi
    normA += ai * ai
    normB += bi * bi
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function weightFactor(weight: number): number {
  return 1 + Math.log10(1 + weight) * 0.5
}

export function recencyFactor(lastMentionedAt: Date, halfLifeDays: number): number {
  const ageMs = Date.now() - lastMentionedAt.getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  return Math.exp(-ageDays / halfLifeDays)
}

export interface FinalScoreInput {
  sim: number
  weight: number
  lastMentionedAt: Date
  inGraph: boolean
  halfLifeDays?: number
}

export function finalScore(input: FinalScoreInput): number {
  const halfLife = input.halfLifeDays ?? 30
  const graphBoost = input.inGraph ? 1.15 : 1.0
  return (
    input.sim *
    weightFactor(input.weight) *
    recencyFactor(input.lastMentionedAt, halfLife) *
    graphBoost
  )
}
