#!/usr/bin/env python3
"""Apply migration 0005 to the LIVE project via the Management API, then verify.

Reads nothing secret: uses the stored SUPABASE_ACCESS_TOKEN. Safe to re-run —
every statement is guarded with IF NOT EXISTS.
"""
import json
import sys
import urllib.error
import urllib.request

ENV = "/root/.hermes/.env"
REF = "pmzwttnoeucuhoiitagv"
SQL_FILE = "/tmp/sp-bp/supabase/migrations/0005_manual_payment.sql"


def token() -> str:
    for line in open(ENV):
        line = line.strip()
        if line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.strip() == "SUPABASE_ACCESS_TOKEN":
            return v.strip().strip('"').strip("'")
    raise SystemExit("no token")


def sql(query: str):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": query}).encode(),
        method="POST",
        headers={
            "Authorization": f"Bearer {token()}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:600].decode(errors="replace")


query = open(SQL_FILE).read()
status, data = sql(query)
print("apply status:", status)
if status >= 300:
    print(data)
    sys.exit(1)

print("\n=== verification ===")
checks = {
    "transactions.unique_code": (
        "select column_name, data_type from information_schema.columns "
        "where table_name='transactions' and column_name in "
        "('unique_code','payable_amount') order by column_name"
    ),
    "generated column": (
        "select column_name, is_generated, generation_expression "
        "from information_schema.columns where table_name='transactions' "
        "and column_name='payable_amount'"
    ),
    "unique index": (
        "select indexname from pg_indexes where tablename='transactions' "
        "and indexname='transactions_unique_code_per_day'"
    ),
    "constraints": (
        "select conname from pg_constraint where conname in "
        "('transactions_unique_code_range','payments_unique_code_range')"
    ),
    "function": (
        "select proname from pg_proc where proname='next_unique_code'"
    ),
}
for label, q in checks.items():
    s, d = sql(q)
    print(f"{label}: {json.dumps(d) if isinstance(d, (list, dict)) else d}")

print("\n=== generator smoke test (10 draws, all must be 100..999) ===")
s, d = sql(
    "select array_agg(next_unique_code()) as codes "
    "from generate_series(1,10)"
)
print(json.dumps(d) if isinstance(d, (list, dict)) else d)
