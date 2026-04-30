import { z } from "zod"
import type { BrainHttpClient } from "./index"

const InputSchema = z.object({
  content: z.string().min(1).max(50_000),
  container_tag: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export function recordThought(client: BrainHttpClient) {
  return {
    name: "record_thought",
    description:
      "Save a new thought. Repeat thoughts (exact or paraphrase) bump weight on the existing one instead of inserting a duplicate.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "the thought text" },
        container_tag: { type: "string", description: "optional grouping tag" },
        metadata: { type: "object", description: "freeform jsonb metadata" },
      },
      required: ["content"],
    },
    async handle(args: unknown) {
      const parsed = InputSchema.parse(args)
      const result = await client.fetch("/v1/thoughts", {
        method: "POST",
        body: JSON.stringify(parsed),
      })
      return { content: [{ type: "text", text: JSON.stringify(result) }] }
    },
  }
}
