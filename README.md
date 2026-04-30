# marvin-brain

Persistent memory and retrieval substrate for Marvin (autonomous AI on a single VPS).

A small Docker Compose stack: Postgres (with pgvector), an HTTP API (Hono on Bun),
an MCP server, a LightRAG graph sidecar, and a worker that runs nightly consolidation.
Everything binds to `127.0.0.1`. A single shared API key is the auth boundary.

Marvin records thoughts via the `record_thought` MCP tool and pulls relevant context
via `recall`. Repeated thoughts (verbatim or paraphrase) bump weight on the existing
thought instead of creating duplicates. Each night the worker clusters recurring
thoughts into durable facts and prunes thoughts that haven't been mentioned in 14 days.

## Quickstart

```bash
git clone https://github.com/<you>/marvin-brain
cd marvin-brain
cp .env.example .env
# edit .env: set BRAIN_API_KEY (32+ chars) and OPENAI_API_KEY
docker compose --profile setup up db-setup --abort-on-container-exit
docker compose up -d postgres api mcp worker lightrag
./scripts/smoke.sh
```

## Architecture

```
                              VPS host
  ┌─────────────────────────────────────────────────────────────┐
  │   Marvin                                                     │
  │     │ MCP                                                    │
  │     ▼                                                        │
  │   127.0.0.1:3100 ── mcp ──► 127.0.0.1:8787 ── api ──► postgres
  │                                       │            ── lightrag
  │   worker (nightly cron) ──► postgres + lightrag             │
  └─────────────────────────────────────────────────────────────┘
```

All services bind to `127.0.0.1` only. Bearer-key auth on `/v1`.

## Configuration

See `.env.example`. Required:
- `BRAIN_API_KEY` — 32+ char shared secret for the bearer auth.
- `OPENAI_API_KEY` — for embeddings and consolidation LLM.
- `DATABASE_URL` — defaults to the compose-internal Postgres.
- `LIGHTRAG_URL` — defaults to the compose-internal LightRAG sidecar.

Optional tunables: `SIMILARITY_THRESHOLD` (0.92), `CLUSTER_SIM_THRESHOLD` (0.85),
`PRUNE_AFTER_DAYS` (14), `RECENCY_HALF_LIFE_DAYS` (30), `EMBEDDING_MODEL`
(`text-embedding-3-small`), `CONSOLIDATION_MODEL` (`gpt-4o-mini`).

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness probe (no auth) |
| POST | `/v1/thoughts` | record a thought |
| GET | `/v1/thoughts/:id` | fetch single thought |
| GET | `/v1/thoughts/recent` | list recently mentioned |
| POST | `/v1/thoughts/:id/forget` | mark forgotten |
| POST | `/v1/facts` | record a fact |
| GET | `/v1/facts/:id` | fetch single fact |
| POST | `/v1/facts/:id/forget` | mark forgotten |
| GET | `/v1/recall` | semantic search across thoughts/facts/documents |
| POST | `/v1/admin/consolidate-now` | manually trigger consolidation |

All `/v1` routes require `Authorization: Bearer $BRAIN_API_KEY`.

## MCP tools

`record_thought`, `recall`, `record_fact`, `forget_thought`, `forget_fact`,
`list_recent_thoughts`, `get_thought`, `get_fact`. The MCP server is a thin
client of the HTTP API and binds to `127.0.0.1:3100`. A stdio adapter ships
in `src/mcp/stdio-proxy.mjs` for clients that prefer stdio transport.

## Development

```bash
bun install
bun run dev:api     # in one terminal
bun run dev:mcp     # in another
bun run dev:worker  # in another
bun test            # unit + integration (testcontainers needs Docker)
```

## How it works

- **Write path:** `record_thought` normalizes content, computes a sha256 hash
  for fast exact-match dedup, and falls back to embedding-similarity dedup at
  threshold 0.92. Repeats bump the existing thought's `weight` and reset its
  `last_mentioned_at` clock.
- **Read path:** `recall` runs vector ANN against thoughts/facts/optionally
  chunks in parallel, augments with a LightRAG graph query, then re-ranks via
  `similarity × weight_factor × recency_factor × graph_boost`.
- **Consolidation:** the worker clusters near-duplicate thoughts at sim ≥ 0.85,
  asks the LLM to summarize each cluster into a durable fact (recorded only if
  `confidence ≥ 0.7`), and prunes thoughts with `last_mentioned_at` older than
  14 days. Re-mentioning a thought resets its clock — active thoughts never
  age out.

## License

MIT — see [LICENSE](LICENSE).
