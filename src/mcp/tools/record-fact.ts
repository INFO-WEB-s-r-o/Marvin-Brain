import { z } from "zod"
import type { BrainHttpClient } from "./index"

const InputSchema = z.object({
  statement: z.string().min(1).max(50_000),
  sources: z.array(z.string()).optional(),
  parent_fact_id: z.string().uuid().optional(),
  confidence: z.number().min(0).max(1).optional(),
})

export function recordFact(client: BrainHttpClient) {
  return {
    name: "record_fact",
    description: "Save a structured fact with optional provenance and confidence.",
    inputSchema: {
      type: "object",
      properties: {
        statement: { type: "string", description: "the fact statement" },
        sources: {
          type: "array",
          items: { type: "string" },
          description: "optional list of source references",
        },
        parent_fact_id: { type: "string", description: "optional UUID of a parent fact" },
        confidence: {
          type: "number",
          description: "confidence score between 0 and 1",
        },
      },
      required: ["statement"],
    },
    async handle(args: unknown) {
      const parsed = InputSchema.parse(args)
      const result = await client.fetch("/v1/facts", {
        method: "POST",
        body: JSON.stringify(parsed),
      })
      return { content: [{ type: "text", text: JSON.stringify(result) }] }
    },
  }
}
