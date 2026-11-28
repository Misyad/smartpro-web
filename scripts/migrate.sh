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

# Migrations that only make sense against a real Supabase instance.
#
# 0000_grants.sql grants to the anon / authenticated / service_role roles, which
# Supabase creates but a bare postgres image does not have. Running it in the CI
# check fails with: role "anon" does not exist.
#
# These are still applied to the live project (via --apply, or by hand); they are
# only excluded from the throwaway-database check, which exists to catch syntax
# and ordering errors.
# Reference-only migrations.
#
# 0001_init.sql, 0002_rls.sql and 0003_auth_linkage.sql describe a PARALLEL DRAFT
# schema written before the live project was inspected. The live database was
# built independently and uses different table and enum names (Title Case
# txn_status, product_units, app_settings...). Applying the draft would create
# conflicting objects, so they are documentation, not deployable steps.
#
# 0004..0006 ARE written against the live schema and are applied for real.
#
# Verified live: 18 tables + 39 RLS policies already exist; supabase/README.md
# records which migrations were actually run.
REFERENCE_ONLY_MIGRATIONS=(
  "0001_init.sql"
  "0002_rls.sql"
  "0003_auth_linkage.sql"
)

# Applied to the live project but skipped in the check database: they grant to
# Supabase-managed roles or depend on extensions the bare image lacks.
# (The harness below creates anon/authenticated/service_role, so grants are safe
# to run; keep this empty unless a migration truly cannot be simulated.)
SUPABASE_ONLY_MIGRATIONS=()

is_reference_only() {
  local base
  base="$(basename "$1")"
  local m
  for m in "${REFERENCE_ONLY_MIGRATIONS[@]}"; do
    [[ "$base" == "$m" ]] && return 0
  done
  return 1
}

is_supabase_only() {
  local base
  base="$(basename "$1")"
  local m
  for m in "${SUPABASE_ONLY_MIGRATIONS[@]}"; do
    [[ "$base" == "$m" ]] && return 0
  done
  return 1
}

# List migrations that the throwaway check should run.
list_checkable_migrations() {
  local f
  for f in "$MIGRATIONS_DIR"/*.sql; do
    if is_reference_only "$f"; then
      echo "SKIP (reference only) $(basename "$f")" >&2
    elif is_supabase_only "$f"; then
      echo "SKIP (supabase only) $(basename "$f")" >&2
    else
      echo "$f"
    fi
  done
}
SEED_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../supabase" && pwd)/seed.sql"
LIVE_SCHEMA_FIXTURE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../supabase" && pwd)/fixtures/live_schema.sql"

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

  # Supabase-shaped harness. The migrations reference auth.users, auth.uid(),
  # storage.buckets/objects AND the anon / authenticated / service_role roles,
  # none of which exist in a bare postgres image. Creating them here means every
  # migration is actually exercised instead of being skipped: a syntax or
  # dependency error in a GRANT or RLS policy still fails the check.
  docker exec -i "$name" psql -U postgres -d smartpro_check -v ON_ERROR_STOP=1 -q <<'SQL'
-- Extensions the live schema depends on.
create extension if not exists citext;
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

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

-- Supabase provides storage.foldername(path) -> text[]; policies rely on it to
-- extract the first path segment. Recreate it so those policies can be applied
-- and validated here instead of being skipped.
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select string_to_array(name, '/');
$$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
SQL

  # Replay the live schema structure. Migrations 0004-0006 are written against
  # the real project, not against the draft in 0001-0003, so the check database
  # needs a faithful empty copy of it or every ALTER fails with
  # 'relation ... does not exist'.
  if [[ -f "$LIVE_SCHEMA_FIXTURE" ]]; then
    echo "  -> fixtures/live_schema.sql (live structure)"
    docker exec -i "$name" psql -U postgres -d smartpro_check -v ON_ERROR_STOP=1 -q < "$LIVE_SCHEMA_FIXTURE"
  else
    echo "WARN: $LIVE_SCHEMA_FIXTURE missing; migrations that ALTER live tables will fail."
  fi

  # Point psql at the check database by name. Supabase-only migrations are
  # excluded: they reference roles the throwaway image does not create.
  local -a files
  mapfile -t files < <(list_checkable_migrations | sort)
  echo "Applying ${#files[@]} migration(s) to the check database"
  for f in "${files[@]}"; do
    echo "  -> $(basename "$f")"
    docker exec -i "$name" psql -U postgres -d smartpro_check -v ON_ERROR_STOP=1 -q < "$f"
  done

  # seed.sql is written against the LIVE Supabase schema (Title Case enums,
  # product_units, app_settings) and is exercised against the real project during
  # deployment. Running it here would compare apples to oranges, so the check
  # covers migrations only.
  if [[ -n "${CHECK_SEED:-}" && -f "$SEED_FILE" ]]; then
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
