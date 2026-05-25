import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { env } from "~/lib/env"
import { registerTools, type BrainHttpClient } from "./tools/index"

export interface BuildMcpOptions {
  apiBaseUrl: string
  apiKey: string
  port: number
}

export function buildMcpServer(opts: BuildMcpOptions) {
  const client: BrainHttpClient = {
    async fetch(path, init) {
      const res = await globalThis.fetch(`${opts.apiBaseUrl}${path}`, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          authorization: `Bearer ${opts.apiKey}`,
          "content-type": "application/json",
        },
      })
      if (!res.ok) throw new Error(`brain API error: ${res.status} ${await res.text()}`)
      return res.json() as Promise<unknown>
    },
  }

  const server = new Server(
    { name: "marvin-brain", version: "0.1.0" },
    { capabilities: { tools: {} } },
  )
  registerTools(server, client)
  return server
}

if (import.meta.main) {
  const e = env()

  const server = buildMcpServer({
    apiBaseUrl: e.BRAIN_API_URL ?? `http://127.0.0.1:${e.API_PORT}`,
    apiKey: e.BRAIN_API_KEY,
    port: e.MCP_PORT,
  })

  // WebStandardStreamableHTTPServerTransport (SDK v1.x) uses Web Standard APIs
  // (Request/Response) and works natively with Hono's fetch interface.
  // We use stateless mode (sessionIdGenerator: undefined) so each request is
  // independent — matching how the brain MCP was designed (no session state needed).
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })

  // Connect server to transport (async — fire and forget at startup)
  server.connect(transport).catch((err) => {
    console.error(JSON.stringify({ msg: "mcp server connect error", err: String(err) }))
    process.exit(1)
  })

  const app = new Hono()

  app.all("/mcp", async (c) => {
    const response = await transport.handleRequest(c.req.raw)
    return response
  })

  serve({ fetch: app.fetch, port: e.MCP_PORT, hostname: e.MCP_HOST })
  console.log(JSON.stringify({ msg: "mcp listening", host: e.MCP_HOST, port: e.MCP_PORT }))
}
