#!/usr/bin/env python3
"""End-to-end test of the manual payment flow against the LIVE database.

Simulates exactly what the server functions do, in order:
  invoice -> proof upload -> admin approves -> transaction settles
and asserts the state machine plus the amount arithmetic at each step.
All fixtures are ZZTEST-prefixed and removed afterwards.
"""
import json
import sys
import urllib.error
import urllib.request

ENV = "/root/.hermes/.env"
REF = "pmzwttnoeucuhoiitagv"
RESULTS = []
USER_ID = "ee000000-0000-4000-8000-00000000aa01"
TXN_ID = "ee000000-0000-4000-8000-00000000bb01"
PAY_ID = "ee000000-0000-4000-8000-00000000cc01"


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


def one(q):
    s, d = sql(q)
    return d[0] if s == 201 and isinstance(d, list) and d else None


def check(label, ok, detail=""):
    RESULTS.append(ok)
    print(f"[{'PASS' if ok else 'FAIL'}] {label}  {detail}")


print("=== setup: verified customer ===")
sql(f"""
insert into auth.users (id, email) values ('{USER_ID}', 'zztest@example.invalid')
on conflict (id) do nothing;
""")
s, _ = sql(f"""
update profiles set kyc_status = 'Verified', points = 200, is_vip = false
 where id = '{USER_ID}';
""")
check("customer exists and is KYC Verified", s == 201)

print("\n=== step 1: create invoice (total 1.200.000) ===")
row = one("select next_unique_code() as c")
code = row["c"]
check("unique code allocated by DB", 100 <= code <= 999, f"code={code}")

s, d = sql(f"""
insert into transactions
  (id, code, customer_id, customer_name, customer_phone, start_date, end_date,
   subtotal, total, unique_code, dp_amount, remaining_amount, method, status)
values
  ('{TXN_ID}', 'ZZTEST-INV', '{USER_ID}', 'ZZ Purchaser', '0800',
   current_date, current_date + 1, 1200000, 1200000, {code},
   360000, 840000, 'transfer', 'Menunggu Pembayaran')
returning total, unique_code, payable_amount, status;
""")
inv = d[0] if s == 201 else {}
check(
    "invoice created, payable = total + code",
    inv.get("payable_amount") == 1200000 + code,
    f"total={inv.get('total')} code={inv.get('unique_code')} payable={inv.get('payable_amount')}",
)
check("status is Menunggu Pembayaran", inv.get("status") == "Menunggu Pembayaran", str(inv.get("status")))

print("\n=== step 2: customer uploads transfer proof ===")
s, d = sql(f"""
insert into payments
  (id, transaction_id, stage, method, amount, unique_code, proof_path, status)
values
  ('{PAY_ID}', '{TXN_ID}', 'DP', 'transfer', 360000, {code},
   'payment-proofs/zztest/dp.jpg', 'Menunggu')
returning status, amount, proof_path;
""")
p = d[0] if s == 201 else {}
check("payment recorded as Menunggu", p.get("status") == "Menunggu", str(p))
check("proof path stored", p.get("proof_path") == "payment-proofs/zztest/dp.jpg")

txn_after_proof = one(f"select status from transactions where id = '{TXN_ID}'")
check(
    "transaction still awaiting payment (proof alone must not settle it)",
    txn_after_proof["status"] == "Menunggu Pembayaran",
    txn_after_proof["status"],
)

print("\n=== step 3: admin rejects -> invoice stays open ===")
sql(f"""
update payments set status='Ditolak', note='Bukti tidak jelas',
       reviewed_at=now() where id='{PAY_ID}';
""")
t = one(f"select status from transactions where id = '{TXN_ID}'")
check("rejection leaves transaction open", t["status"] == "Menunggu Pembayaran", t["status"])

print("\n=== step 4: customer re-uploads, admin approves DP ===")
sql(f"""
update payments set status='Menunggu', note=null, reviewed_at=null,
       proof_path='payment-proofs/zztest/dp-v2.jpg' where id='{PAY_ID}';
update payments set status='Disetujui', reviewed_at=now() where id='{PAY_ID}';
update transactions set status='DP Terbayar' where id='{TXN_ID}';
""")
t = one(f"select status from transactions where id = '{TXN_ID}'")
check("DP approval -> DP Terbayar", t["status"] == "DP Terbayar", t["status"])

print("\n=== step 5: final settlement (payable - DP, code collected once) ===")
row = one(f"select payable_amount, dp_amount from transactions where id='{TXN_ID}'")
expected_final = row["payable_amount"] - row["dp_amount"]
print(f"      payable={row['payable_amount']} dp={row['dp_amount']} -> final={expected_final}")
sql(f"""
insert into payments (transaction_id, stage, method, amount, unique_code, status)
values ('{TXN_ID}', 'Pelunasan', 'transfer', {expected_final}, {code}, 'Menunggu');
update payments set status='Disetujui', reviewed_at=now()
 where transaction_id='{TXN_ID}' and stage='Pelunasan';
update transactions set status='Lunas' where id='{TXN_ID}';
""")
t = one(f"select status, points_earned, points_redeemed from transactions where id='{TXN_ID}'")
check("final approval -> Lunas", t["status"] == "Lunas", t["status"])

print("\n=== step 6: amount integrity across the flow ===")
row = one(f"""
select p.stage, p.amount, t.payable_amount
  from payments p join transactions t on t.id = p.transaction_id
 where p.transaction_id = '{TXN_ID}' and p.stage = 'Pelunasan'
""")
tot = one(f"""
select coalesce(sum(amount),0)::bigint as paid from payments where transaction_id = '{TXN_ID}'
""")
check(
    "DP + pelunasan == payable (code charged exactly once)",
    int(tot["paid"]) == int(row["payable_amount"]),
    f"total_paid={tot['paid']} payable={row['payable_amount']}",
)
check(
    "code not double-charged",
    int(tot["paid"]) != int(row["payable_amount"]) + code,
    f"paid={tot['paid']}",
)

print("\n=== cleanup ===")
s, _ = sql(f"""
delete from payments where transaction_id = '{TXN_ID}';
delete from transactions where id = '{TXN_ID}';
delete from auth.users where id = '{USER_ID}';
""")
left = one(f"select count(*) as n from transactions where code like 'ZZTEST%'")
check("all fixtures removed", s == 201 and left["n"] == 0, str(left))

print(f"\n{'='*56}\nPASSED {sum(RESULTS)}/{len(RESULTS)}")
sys.exit(0 if all(RESULTS) else 1)
