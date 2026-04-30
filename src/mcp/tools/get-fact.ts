import { z } from "zod"
import type { BrainHttpClient } from "./index"

const InputSchema = z.object({
  id: z.string().uuid(),
})

export function getFact(client: BrainHttpClient) {
  return {
    name: "get_fact",
    description: "Retrieve a single fact by its UUID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "UUID of the fact" },
      },
      required: ["id"],
    },
    async handle(args: unknown) {
      const { id } = InputSchema.parse(args)
      const result = await client.fetch(`/v1/facts/${id}`)
      return { content: [{ type: "text", text: JSON.stringify(result) }] }
    },
  }
}
