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

  const mcpOptions = {
    apiBaseUrl: e.BRAIN_API_URL ?? `http://127.0.0.1:${e.API_PORT}`,
    apiKey: e.BRAIN_API_KEY,
    port: e.MCP_PORT,
  }

  const app = new Hono()

  // WebStandardStreamableHTTPServerTransport (SDK v1.x) uses Web Standard APIs
  // (Request/Response) and works natively with Hono's fetch interface.
  //
  // Stateless mode (sessionIdGenerator: undefined) requires a *fresh* server +
  // transport per request. A stateless transport tracks `_hasHandledRequest`
  // and the SDK throws "Stateless transport cannot be reused across requests"
  // on the second call — so a single shared transport built at startup served
  // exactly one request and then 500'd every subsequent one. Building per
  // request also keeps message IDs from leaking between clients.
  app.all("/mcp", async (c) => {
    const server = buildMcpServer(mcpOptions)
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    })
    await server.connect(transport)
    return transport.handleRequest(c.req.raw)
  })

  serve({ fetch: app.fetch, port: e.MCP_PORT, hostname: e.MCP_HOST })
  console.log(JSON.stringify({ msg: "mcp listening", host: e.MCP_HOST, port: e.MCP_PORT }))
}
