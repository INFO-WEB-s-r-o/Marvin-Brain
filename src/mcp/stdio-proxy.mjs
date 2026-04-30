#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"

const url = process.env.BRAIN_MCP_URL ?? "http://127.0.0.1:3100/mcp"

// Connect to upstream HTTP MCP server
const upstream = new Client(
  { name: "marvin-brain-stdio-proxy", version: "0.1.0" },
  { capabilities: {} },
)
await upstream.connect(new StreamableHTTPClientTransport(new URL(url)))

// Server speaking stdio that proxies to upstream
const server = new Server(
  { name: "marvin-brain-stdio-proxy", version: "0.1.0" },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const res = await upstream.listTools()
  return res
})

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const res = await upstream.callTool({
    name: req.params.name,
    arguments: req.params.arguments,
  })
  return res
})

await server.connect(new StdioServerTransport())
