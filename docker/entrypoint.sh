#!/bin/sh
set -e
# wait for postgres
until pg_isready -h "${POSTGRES_HOST:-postgres}" -p 5432 -U "${POSTGRES_USER:-admin}" >/dev/null 2>&1; do
  echo "waiting for postgres..."
  sleep 1
done
exec "$@"
