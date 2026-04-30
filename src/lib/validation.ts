import { z } from "zod"

const KindEnum = z.enum(["thoughts", "facts", "documents"])

export const RecordThoughtReqSchema = z.object({
  content: z.string().min(1).max(50_000),
  container_tag: z.string().max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})
export type RecordThoughtReq = z.infer<typeof RecordThoughtReqSchema>

export const RecordFactReqSchema = z.object({
  statement: z.string().min(1).max(50_000),
  sources: z.array(z.string()).max(50).optional(),
})
export type RecordFactReq = z.infer<typeof RecordFactReqSchema>

export const RecallReqSchema = z.object({
  q: z.string().min(1).max(2000),
  k: z.coerce.number().int().min(1).max(100).default(10),
  container_tag: z.string().max(255).optional(),
  kinds: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").map((p) => p.trim()) : ["thoughts", "facts"]))
    .pipe(z.array(KindEnum).min(1)),
})
export type RecallReq = z.infer<typeof RecallReqSchema>

export const ForgetReqSchema = z.object({
  reason: z.string().min(1).max(1000),
})
export type ForgetReq = z.infer<typeof ForgetReqSchema>
