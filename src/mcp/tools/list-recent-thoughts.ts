import { z } from "zod"
import type { BrainHttpClient } from "./index"

const InputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export function listRecentThoughts(client: BrainHttpClient) {
  return {
    name: "list_recent_thoughts",
    description: "List the most recently recorded thoughts, newest first.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "max number of thoughts to return (default 20)" },
      },
      required: [],
    },
    async handle(args: unknown) {
      const { limit } = InputSchema.parse(args)
      const params = new URLSearchParams()
      if (limit !== undefined) params.set("limit", String(limit))
      const qs = params.toString()
      const result = await client.fetch(`/v1/thoughts/recent${qs ? `?${qs}` : ""}`)
      return { content: [{ type: "text", text: JSON.stringify(result) }] }
    },
  }
}
