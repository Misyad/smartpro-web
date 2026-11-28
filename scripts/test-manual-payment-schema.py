#!/usr/bin/env python3
"""Behavioural tests for the manual payment schema, run against the live DB.

Creates a disposable auth user + transaction, asserts each rule, then removes
everything it created. Every fixture is namespaced with 'ZZTEST' so a failed
cleanup is obvious and safe to purge later.
"""
import json
import sys
import urllib.error
import urllib.request

ENV = "/root/.hermes/.env"
REF = "pmzwttnoeucuhoiitagv"

RESULTS = []


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
        headers={"Authorization": f"Bearer {token()}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            return 201, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:500].decode(errors="replace")


def check(label: str, ok: bool, detail: str = ""):
    RESULTS.append(ok)
    print(f"[{'PASS' if ok else 'FAIL'}] {label}  {detail}")


# ---------------------------------------------------------------------------
print("=== setup ===")
sql("""
insert into auth.users (id, email) values
  ('ee000000-0000-4000-8000-00000000aa01', 'zztest@example.invalid')
on conflict (id) do nothing;
""")
s, d = sql("""
insert into transactions
  (id, code, customer_id, customer_name, customer_phone, start_date, end_date,
   subtotal, total, unique_code)
values
  ('ee000000-0000-4000-8000-00000000bb01', 'ZZTEST-1',
   'ee000000-0000-4000-8000-00000000aa01', 'ZZ Test', '0800',
   current_date, current_date, 1200000, 1200000, 347)
on conflict (id) do update set unique_code = 347
returning payable_amount;
""")
check("insert with unique_code 347", s == 201, str(d))

# ---------------------------------------------------------------------------
print("\n=== payable_amount is derived, not stored twice ===")
s, d = sql("""
select total, unique_code, payable_amount
  from transactions where id = 'ee000000-0000-4000-8000-00000000bb01'
""")
row = d[0] if s == 201 and isinstance(d, list) else {}
check(
    "payable = total + code",
    row.get("payable_amount") == row.get("total", 0) + row.get("unique_code", 0),
    f"total={row.get('total')} code={row.get('unique_code')} payable={row.get('payable_amount')}",
)

# ---------------------------------------------------------------------------
print("\n=== same code twice on the same day must be rejected ===")
s, d = sql("""
insert into transactions
  (code, customer_id, customer_name, customer_phone, start_date, end_date,
   subtotal, total, unique_code)
values
  ('ZZTEST-2', 'ee000000-0000-4000-8000-00000000aa01', 'ZZ Test', '0800',
   current_date, current_date, 1000000, 1000000, 347);
""")
check("duplicate (code, today) rejected", s != 201, str(d)[:120])

# ---------------------------------------------------------------------------
print("\n=== out-of-range codes rejected ===")
for bad in (0, 99, 1000):
    s, d = sql(f"""
    insert into transactions
      (code, customer_id, customer_name, customer_phone, start_date, end_date,
       subtotal, total, unique_code)
    values
      ('ZZTEST-R{bad}', 'ee000000-0000-4000-8000-00000000aa01', 'ZZ Test', '0800',
       current_date, current_date, 1000, 1000, {bad});
    """)
    if bad == 0:
        check(f"code {bad} accepted (means 'no code yet')", s == 201, str(d)[:80])
    else:
        check(f"code {bad} rejected", s != 201, str(d)[:80])

# ---------------------------------------------------------------------------
print("\n=== generator never returns a code already used today ===")
sql("""
delete from transactions where code like 'ZZTEST%' and code <> 'ZZTEST-1';
""")
s, d = sql("""
with draws as (select next_unique_code() as c from generate_series(1, 50))
select count(*) as n, count(distinct c) as d, min(c) as lo, max(c) as hi from draws;
""")
row = d[0] if s == 201 and isinstance(d, list) else {}
check(
    "50 draws are unique and in 100..999",
    row.get("n") == row.get("d") == 50 and 100 <= row.get("lo", 0) and row.get("hi", 0) <= 999,
    str(row),
)

# ---------------------------------------------------------------------------
print("\n=== payments: unique_code range + admin-only approval ===")
s, d = sql("""
insert into payments (id, transaction_id, stage, method, amount, unique_code, status)
values ('ee000000-0000-4000-8000-00000000cc01',
        'ee000000-0000-4000-8000-00000000bb01', 'DP', 'transfer', 360347, 347,
        'Menunggu')
on conflict (id) do update set unique_code = 347
returning status;
""")
check("payment insert with status Menunggu", s == 201 and d[0]["status"] == "Menunggu", str(d))

s, d = sql("""
select policyname, cmd from pg_policies
 where tablename = 'payments' and cmd = 'UPDATE';
""")
pols = [r["policyname"] for r in d] if s == 201 else []
check(
    "only admin may UPDATE payments",
    pols == ["payments_admin_update"],
    str(pols),
)

# ---------------------------------------------------------------------------
print("\n=== cleanup ===")
s, d = sql("""
delete from payments where id = 'ee000000-0000-4000-8000-00000000cc01';
delete from transactions where code like 'ZZTEST%';
delete from auth.users where id = 'ee000000-0000-4000-8000-00000000aa01';
""")
check("fixtures removed", s == 201, str(d)[:100])

s, d = sql("select count(*) as n from transactions where code like 'ZZTEST%'")
check("no ZZTEST rows remain", s == 201 and d[0]["n"] == 0, str(d))

print(f"\n{'='*56}\nPASSED {sum(RESULTS)}/{len(RESULTS)}")
sys.exit(0 if all(RESULTS) else 1)
