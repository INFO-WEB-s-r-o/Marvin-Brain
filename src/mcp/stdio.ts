import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { env } from "~/lib/env"
import { buildMcpServer } from "./index"

// Native stdio MCP server. Unlike stdio-proxy.mjs (which forwards to the HTTP
// MCP server on :3100), this talks directly to the brain HTTP API on :8787,
// so only the API needs to be running. Launch it from an MCP client with:
//   bun run src/mcp/stdio.ts
//
// IMPORTANT: stdout is the MCP protocol channel — never write logs to it.
// All diagnostics go to stderr.
const e = env()

const apiBaseUrl = e.BRAIN_API_URL ?? `http://127.0.0.1:${e.API_PORT}`

const server = buildMcpServer({
  apiBaseUrl,
  apiKey: e.BRAIN_API_KEY,
  port: e.MCP_PORT, // unused over stdio
})

await server.connect(new StdioServerTransport())
console.error(JSON.stringify({ msg: "mcp stdio ready", api: apiBaseUrl }))
