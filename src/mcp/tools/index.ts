import type { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"

export interface BrainHttpClient {
  fetch: (path: string, init?: RequestInit) => Promise<unknown>
}

import { recordThought } from "./record-thought"
import { recall } from "./recall"
import { recordFact } from "./record-fact"
import { forgetThought } from "./forget-thought"
import { forgetFact } from "./forget-fact"
import { listRecentThoughts } from "./list-recent-thoughts"
import { getThought } from "./get-thought"
import { getFact } from "./get-fact"

export function registerTools(server: Server, client: BrainHttpClient): void {
  const tools = [
    recordThought(client),
    recall(client),
    recordFact(client),
    forgetThought(client),
    forgetFact(client),
    listRecentThoughts(client),
    getThought(client),
    getFact(client),
  ]
  const byName = new Map(tools.map((t) => [t.name, t]))

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const t = byName.get(req.params.name)
    if (!t) throw new Error(`unknown tool: ${req.params.name}`)
    return t.handle(req.params.arguments ?? {})
  })
}
