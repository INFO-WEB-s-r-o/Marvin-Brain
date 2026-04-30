import { z } from "zod"
import type { BrainHttpClient } from "./index"

const InputSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().min(1).max(1_000),
})

export function forgetThought(client: BrainHttpClient) {
  return {
    name: "forget_thought",
    description: "Mark a thought as forgotten (soft-delete with reason).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "UUID of the thought to forget" },
        reason: { type: "string", description: "reason for forgetting" },
      },
      required: ["id", "reason"],
    },
    async handle(args: unknown) {
      const { id, reason } = InputSchema.parse(args)
      const result = await client.fetch(`/v1/thoughts/${id}/forget`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      })
      return { content: [{ type: "text", text: JSON.stringify(result) }] }
    },
  }
}
