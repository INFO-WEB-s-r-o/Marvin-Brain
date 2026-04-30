import { z } from "zod"
import type { BrainHttpClient } from "./index"

const InputSchema = z.object({
  id: z.string().uuid(),
})

export function getThought(client: BrainHttpClient) {
  return {
    name: "get_thought",
    description: "Retrieve a single thought by its UUID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "UUID of the thought" },
      },
      required: ["id"],
    },
    async handle(args: unknown) {
      const { id } = InputSchema.parse(args)
      const result = await client.fetch(`/v1/thoughts/${id}`)
      return { content: [{ type: "text", text: JSON.stringify(result) }] }
    },
  }
}
