#!/usr/bin/env bash
#
# Apply Supabase migrations to a target database.
#
# Safety model:
#   - Default mode is --check: it validates every migration in a throwaway
#     Postgres, in order, and exits non-zero on any error. Nothing touches a
#     real database.
#   - --apply requires DATABASE_URL and is opt-in. CI never calls it
#     automatically; a human runs it after reviewing the migration diff.
#
# Why not `supabase db push`: the CLI pulls a lot of tooling and needs a
# project link. The migrations are plain SQL, so psql is enough and keeps CI
# dependencies small.

set -euo pipefail

MODE="${1:---check}"
MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../supabase/migrations" && pwd)"
SEED_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../supabase" && pwd)/seed.sql"

run_in_container() {
  local db="$1"
  local -a files
  mapfile -t files < <(ls "$MIGRATIONS_DIR"/*.sql | sort)

  echo "Applying ${#files[@]} migration(s) to $db"
  for f in "${files[@]}"; do
    echo "  -> $(basename "$f")"
    docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$f"
  done

  if [[ -f "$SEED_FILE" ]]; then
    echo "  -> seed.sql (idempotency check)"
    docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$SEED_FILE"
    # Run twice: a non-idempotent seed is a defect, not a warning.
    docker exec -i "$db" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$SEED_FILE"
  fi
}

check_mode() {
  local name="smartpro-migrate-check-$$"

  echo "=== migration check (throwaway database) ==="

  # Supabase-shaped harness: the migrations reference auth.users, auth.uid()
  # and storage buckets, which a bare postgres image does not provide.
  docker run -d --name "$name" \
    -e POSTGRES_PASSWORD="check_$$" \
    -e POSTGRES_DB=postgres \
    postgres:17-alpine >/dev/null

  # Quote the name into the trap: EXIT runs after the function scope is gone,
  # so a bare "$name" would be unbound under `set -u`.
  trap "docker rm -f '$name' >/dev/null 2>&1 || true" EXIT

  # Wait for readiness, then create the check database explicitly. pg_isready
  # can report ready while initdb is still restarting, so also require a query.
  for _ in $(seq 1 60); do
    if docker exec "$name" psql -U postgres -d postgres -tAc 'select 1' >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  docker exec -i "$name" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
    -c 'drop database if exists smartpro_check' \
    -c 'create database smartpro_check' 

  docker exec -i "$name" psql -U postgres -d smartpro_check -v ON_ERROR_STOP=1 -q <<'SQL'
create schema if not exists auth;
create schema if not exists storage;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create table storage.buckets (
  id text primary key, name text not null,
  public boolean not null default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text, owner uuid
);
alter table storage.objects enable row level security;
SQL

  # Point psql at the check database by name.
  local -a files
  mapfile -t files < <(ls "$MIGRATIONS_DIR"/*.sql | sort)
  echo "Applying ${#files[@]} migration(s)"
  for f in "${files[@]}"; do
    echo "  -> $(basename "$f")"
    docker exec -i "$name" psql -U postgres -d smartpro_check -v ON_ERROR_STOP=1 -q < "$f"
  done

  if [[ -f "$SEED_FILE" ]]; then
    echo "  -> seed.sql x2 (idempotency)"
    docker exec -i "$name" psql -U postgres -d smartpro_check -v ON_ERROR_STOP=1 -q < "$SEED_FILE"
    docker exec -i "$name" psql -U postgres -d smartpro_check -v ON_ERROR_STOP=1 -q < "$SEED_FILE"

    local counts
    counts=$(docker exec "$name" psql -U postgres -d smartpro_check -t -A -c \
      "select (select count(*) from products) || '/' ||
              (select count(*) from product_units) || '/' ||
              (select count(*) from bundles) || '/' ||
              (select count(*) from vouchers)")
    echo "     row counts products/units/bundles/vouchers = $counts"
    if [[ "$counts" != "7/14/2/2" ]]; then
      echo "FAIL: unexpected seed row counts: $counts (expected 7/14/2/2)" >&2
      exit 1
    fi
  fi

  echo "=== migration check PASSED ==="
}

apply_mode() {
  : "${DATABASE_URL:?DATABASE_URL is required for --apply}"

  echo "!!! Applying migrations to a REAL database !!!"
  echo "    target: ${DATABASE_URL%%@*}@***"

  mapfile -t files < <(ls "$MIGRATIONS_DIR"/*.sql | sort)
  for f in "${files[@]}"; do
    echo "  -> $(basename "$f")"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
  done
  echo "=== apply complete (seed NOT run; run manually if intended) ==="
}

case "$MODE" in
  --check) check_mode ;;
  --apply) apply_mode ;;
  *)
    echo "usage: $0 [--check|--apply]" >&2
    exit 2
    ;;
esac
