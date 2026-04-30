import { z } from "zod"
import type { BrainHttpClient } from "./index"

const InputSchema = z.object({
  q: z.string().min(1).max(2_000),
  k: z.coerce.number().int().min(1).max(50).optional(),
  container_tag: z.string().optional(),
  kinds: z.string().optional(),
})

export function recall(client: BrainHttpClient) {
  return {
    name: "recall",
    description:
      "Semantic search across thoughts and facts. Returns the k most relevant items to the query.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "search query" },
        k: { type: "number", description: "number of results to return (default 10)" },
        container_tag: { type: "string", description: "filter by container tag" },
        kinds: {
          type: "string",
          description: "comma-separated kinds to filter (e.g. 'thought,fact')",
        },
      },
      required: ["q"],
    },
    async handle(args: unknown) {
      const { q, k, container_tag, kinds } = InputSchema.parse(args)
      const params = new URLSearchParams({ q })
      if (k !== undefined) params.set("k", String(k))
      if (container_tag) params.set("container_tag", container_tag)
      if (kinds) params.set("kinds", kinds)
      const result = await client.fetch(`/v1/recall?${params.toString()}`)
      return { content: [{ type: "text", text: JSON.stringify(result) }] }
    },
  }
}
