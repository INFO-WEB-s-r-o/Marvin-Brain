import { z } from "zod"

const EnvSchema = z.object({
  BRAIN_API_KEY: z.string().min(32, "BRAIN_API_KEY must be at least 32 chars"),
  DATABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY required"),
  LIGHTRAG_URL: z.string().url(),

  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  CONSOLIDATION_MODEL: z.string().default("gpt-4o-mini"),

  SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.92),
  CLUSTER_SIM_THRESHOLD: z.coerce.number().min(0).max(1).default(0.85),
  CONSOLIDATION_WEIGHT_FLOOR: z.coerce.number().int().min(0).default(2),
  MIN_CLUSTER_SIZE: z.coerce.number().int().min(1).default(3),
  MIN_CLUSTER_WEIGHT: z.coerce.number().int().min(0).default(5),
  CONFIDENCE_FLOOR: z.coerce.number().min(0).max(1).default(0.7),
  PRUNE_AFTER_DAYS: z.coerce.number().int().min(1).default(14),
  RECENCY_HALF_LIFE_DAYS: z.coerce.number().min(1).default(30),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  API_PORT: z.coerce.number().int().default(8787),
  MCP_PORT: z.coerce.number().int().default(3100),
})

export type Env = z.infer<typeof EnvSchema>

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    throw new Error(`Invalid env: ${issues}`)
  }
  return parsed.data
}

let cached: Env | null = null
export function env(): Env {
  if (!cached) cached = loadEnv()
  return cached
}
