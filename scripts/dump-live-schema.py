#!/usr/bin/env python3
"""Dump the live schema (structure only) as a replayable fixture for CI.

Why: migrations 0004-0006 are written against the LIVE schema, which was built
independently of the draft in 0001-0003. The CI check therefore needs a faithful
empty copy of that schema to apply them onto.

Dumps structure only — no rows, no credentials.
"""
import json
import sys
import urllib.error
import urllib.request

ENV = "/root/.hermes/.env"
REF = "pmzwttnoeucuhoiitagv"
OUT = "/tmp/sp-bp/supabase/fixtures/live_schema.sql"


def token() -> str:
    for line in open(ENV):
        line = line.strip()
        if line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.strip() == "SUPABASE_ACCESS_TOKEN":
            return v.strip().strip('"').strip("'")
    raise SystemExit("no token")


def sql(q: str):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": q}).encode(),
        method="POST",
        headers={"Authorization": f"Bearer {token()}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            return 201, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:400].decode(errors="replace")


# Enums first, then tables, then constraints — the order Postgres needs.
Q_ENUMS = """
select 'create type ' || quote_ident(t.typname) || ' as enum (' ||
       string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder) || ');' as stmt
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
 where n.nspname = 'public'
 group by t.typname
 order by t.typname;
"""

Q_COLS = """
select 'create table if not exists public.' || quote_ident(c.relname) || ' (' ||
       string_agg(
         quote_ident(a.attname) || ' ' ||
         format_type(a.atttypid, a.atttypmod) ||
         case when a.attnotnull then ' not null' else '' end ||
         -- generated columns: Postgres rejects 'default' for these, and
         -- pg_get_expr returns the stored expression
         case
           when a.attgenerated = 's' and d.adbin is not null
             then ' generated always as (' || pg_get_expr(d.adbin, d.adrelid) || ') stored'
           when a.attgenerated = 's'
             then ''
           when d.adbin is not null
             then ' default ' || pg_get_expr(d.adbin, d.adrelid)
           else ''
         end,
         ', ' order by a.attnum
       ) || ');' as stmt
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
 where n.nspname = 'public' and c.relkind = 'r'
 group by c.relname
 order by c.relname;
"""

# Constraint order matters: every PRIMARY KEY / UNIQUE must exist before any
# FOREIGN KEY that references it, otherwise replay fails with
# 'there is no unique constraint matching given keys for referenced table'.
# So: key constraints first (p, u), then checks, then foreign keys.
Q_CONS = """
select 'alter table public.' || quote_ident(c.relname) ||
       ' add constraint ' || quote_ident(con.conname) || ' ' ||
       pg_get_constraintdef(con.oid) || ';' as stmt
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and con.contype in ('p','f','u','c')
 order by
   case con.contype
     when 'p' then 1
     when 'u' then 2
     when 'c' then 3
     when 'f' then 4
     else 5
   end,
   c.relname, con.conname;
"""

Q_IDX = """
select indexdef || ';' as stmt
  from pg_indexes
 where schemaname = 'public'
   and indexname not in (
     select conname from pg_constraint
   )
   and indexdef not like '%_pkey'
 order by indexname;
"""


def collect(label, q):
    s, d = sql(q)
    if s != 201:
        print(f"FAIL {label}: {d}")
        sys.exit(1)
    return [r["stmt"] for r in d if r.get("stmt")]


enums = collect("enums", Q_ENUMS)
cols = collect("columns", Q_COLS)
cons = collect("constraints", Q_CONS)
idx = collect("indexes", Q_IDX)

header = """-- Live schema fixture for CI. GENERATED — do not edit by hand.
--
-- Structure only (types, tables, constraints, indexes). No rows, no credentials.
-- Regenerate with scripts/dump-live-schema.py when the live schema changes.
--
-- Purpose: migrations 0004-0006 are written against the live schema and cannot
-- be applied onto the draft in 0001-0003. The CI check replays this fixture
-- first, then applies those migrations for real.
"""

body = (
    header
    + "\n-- Enums\n" + "\n".join(enums) + "\n"
    + "\n-- Tables\n" + "\n".join(cols) + "\n"
    + "\n-- Constraints\n" + "\n".join(cons) + "\n"
    + "\n-- Indexes\n" + "\n".join(idx) + "\n"
)

import os
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    f.write(body)

print(f"wrote {OUT}")
print(f"  enums: {len(enums)}  tables: {len(cols)}  constraints: {len(cons)}  indexes: {len(idx)}")
print(f"  bytes: {len(body)}")
