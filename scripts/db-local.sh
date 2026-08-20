#!/usr/bin/env bash
#
# Build and test the schema against a plain PostgreSQL server.
#
# This exists because `supabase start` needs Docker, and Docker is not available
# on this machine. It is a fallback, not a replacement: the canonical path is
# `npm run db:reset` and `npm run db:test` through the Supabase CLI. What runs
# here is the same migrations, the same seed and the same test files, on top of
# the shim in supabase/tests/harness/00_shim.sql.
#
# What the shim cannot prove: anything about Supabase Auth itself, Storage
# behaviour beyond the policies, PostgREST request handling, or Realtime.
# Re-run the suite through the CLI before trusting it against production.
#
# Usage:
#   PGPASSWORD=... ./scripts/db-local.sh reset    # drop, create, migrate, seed
#   PGPASSWORD=... ./scripts/db-local.sh test     # run the hostile suite
#   PGPASSWORD=... ./scripts/db-local.sh all      # both
#   PGPASSWORD=... ./scripts/db-local.sh types    # regenerate database.types.ts
#
# Environment:
#   PGHOST      default 127.0.0.1
#   PGPORT      default 5432
#   PGUSER      default postgres
#   PGPASSWORD  required
#   PGDATABASE_TEST  default furniture_local

set -euo pipefail

ROOT_EARLY="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# .env.local is the one place a secret lives on this machine. Read it rather
# than asking anyone to export a password into their shell history.
if [ -f "$ROOT_EARLY/.env.local" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$''}"          # .env.local may have been saved with CRLF
    case "$line" in
      "#"*|"") continue ;;
      PGPASSWORD=*|PGHOST=*|PGPORT=*|PGUSER=*|PGDATABASE_TEST=*)
        key="${line%%=*}"
        value="${line#*=}"
        # An explicit environment variable still wins over the file.
        if [ -z "$(eval "printf '%s' \"\${$key:-}\"")" ]; then
          export "$key=$value"
        fi
        ;;
    esac
  done < "$ROOT_EARLY/.env.local"
fi

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
DB="${PGDATABASE_TEST:-furniture_local}"

if [ -z "${PGPASSWORD:-}" ]; then
  echo "PGPASSWORD is not set. Add it to .env.local (see .env.example)." >&2
  exit 2
fi

PSQL_BIN="${PSQL_BIN:-psql}"
if ! command -v "$PSQL_BIN" >/dev/null 2>&1; then
  for candidate in "/c/Program Files/PostgreSQL"/*/bin/psql; do
    [ -x "$candidate" ] && PSQL_BIN="$candidate" && break
  done
fi
if ! command -v "$PSQL_BIN" >/dev/null 2>&1 && [ ! -x "$PSQL_BIN" ]; then
  echo "psql not found. Set PSQL_BIN to its full path." >&2
  exit 2
fi

export PGHOST PGPORT PGUSER PGPASSWORD

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_on_maintenance() {
  "$PSQL_BIN" -v ON_ERROR_STOP=1 -q -d postgres -c "$1"
}

run_file() {
  "$PSQL_BIN" -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1"
}

cmd_reset() {
  echo "==> dropping and recreating $DB"
  run_on_maintenance "drop database if exists \"$DB\" with (force);"
  run_on_maintenance "create database \"$DB\";"

  echo "==> shim (Supabase stand-ins: auth, storage, roles, auto-exposed APIs)"
  run_file "$ROOT/supabase/tests/harness/00_shim.sql"

  echo "==> migrations"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo "    $(basename "$f")"
    run_file "$f"
  done

  echo "==> assertion harness"
  run_file "$ROOT/supabase/tests/harness/10_assert.sql"

  echo "==> seed"
  run_file "$ROOT/supabase/seed.sql"

  echo "==> ready"
}

cmd_test() {
  local failed=0
  for f in "$ROOT"/supabase/tests/*.test.sql; do
    echo "==> $(basename "$f")"
    # Each file opens its own transaction and rolls back, so the tests do not
    # depend on the order they run in.
    # -t -A keeps the void-returning assertion calls from printing a row each.
    if "$PSQL_BIN" -v ON_ERROR_STOP=1 -q -t -A -P pager=off -d "$DB" -f "$f"; then
      :
    else
      failed=1
    fi
  done
  if [ "$failed" -ne 0 ]; then
    echo "FAILED" >&2
    exit 1
  fi
  echo "==> all green"
}

cmd_types() {
  echo "==> generating src/lib/database.types.ts"
  npx --yes supabase@2.115.0 gen types typescript \
    --db-url "postgresql://$PGUSER:$PGPASSWORD@$PGHOST:$PGPORT/$DB" \
    > "$ROOT/src/lib/database.types.ts"
  echo "==> wrote $(wc -l < "$ROOT/src/lib/database.types.ts") lines"
}

case "${1:-all}" in
  reset) cmd_reset ;;
  test)  cmd_test ;;
  types) cmd_types ;;
  all)   cmd_reset; cmd_test ;;
  *)     echo "usage: $0 {reset|test|types|all}" >&2; exit 2 ;;
esac
