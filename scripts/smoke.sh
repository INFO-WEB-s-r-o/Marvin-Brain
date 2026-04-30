#!/bin/sh
set -e
KEY="${BRAIN_API_KEY:?BRAIN_API_KEY required}"

curl -fsS http://127.0.0.1:8787/health
echo

curl -fsS -X POST http://127.0.0.1:8787/v1/thoughts \
  -H "authorization: Bearer $KEY" \
  -H "content-type: application/json" \
  -d "{\"content\": \"smoke test thought at $(date -u +%FT%TZ)\"}"
echo

curl -fsS "http://127.0.0.1:8787/v1/recall?q=smoke&k=3" \
  -H "authorization: Bearer $KEY"
echo
