#!/usr/bin/env python3
"""Prove storage RLS denies, using real users created + signed in via Admin API.

No JWT forging: we create disposable confirmed users with the service role,
sign them in through /auth/v1/token to obtain genuine access tokens, then hit
the Storage API as those users. Everything is removed afterwards.
"""
import json
import secrets
import string
import sys
import urllib.error
import urllib.request

ENV = "/root/.hermes/.env"
REF = "pmzwttnoeucuhoiitagv"
BASE = f"https://{REF}.supabase.co"
RESULTS = []


def mgmt_token() -> str:
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
        headers={"Authorization": f"Bearer {mgmt_token()}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            return 201, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:400].decode(errors="replace")


def service_key() -> str:
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/api-keys",
        headers={"Authorization": f"Bearer {mgmt_token()}"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return {k["name"]: k["api_key"] for k in json.load(r)}["service_role"]


SVC = service_key()


def call(url, method="GET", data=None, headers=None):
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            if not raw:
                return r.status, None
            # Storage returns binary payloads for GET; only parse JSON when the
            # body actually looks like JSON.
            if raw.lstrip()[:1] in (b"{", b"["):
                try:
                    return r.status, json.loads(raw)
                except Exception:
                    return r.status, raw[:200]
            return r.status, raw[:200]
    except urllib.error.HTTPError as e:
        body = e.read()[:300].decode(errors="replace")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, body


def check(label, ok, detail=""):
    RESULTS.append(ok)
    print(f"[{'PASS' if ok else 'FAIL'}] {label}  {detail}")


def mkpw() -> str:
    abc = string.ascii_letters + string.digits
    return "".join(secrets.choice(abc) for _ in range(20)) + "aA1"


def make_user(email: str):
    pw = mkpw()
    s, d = call(
        f"{BASE}/auth/v1/admin/users",
        "POST",
        json.dumps({"email": email, "password": pw, "email_confirm": True}).encode(),
        {"Authorization": f"Bearer {SVC}", "apikey": SVC, "Content-Type": "application/json"},
    )
    if s not in (200, 201):
        print("   create failed:", str(d)[:160])
        return None, None
    uid = d.get("id")
    s2, d2 = call(
        f"{BASE}/auth/v1/token?grant_type=password",
        "POST",
        json.dumps({"email": email, "password": pw}).encode(),
        {"apikey": SVC, "Content-Type": "application/json"},
    )
    if s2 != 200:
        print("   signin failed:", str(d2)[:160])
        return uid, None
    return uid, d2.get("access_token")


print("=== create and sign in two users ===")
alice, alice_tok = make_user("zzalice3@example.invalid")
bob, bob_tok = make_user("zzbob3@example.invalid")
check("alice signed in", bool(alice_tok), str(alice)[:8])
check("bob signed in", bool(bob_tok), str(bob)[:8])
if not (alice_tok and bob_tok):
    sys.exit(1)

print("\n=== seed alice's proof via service role ===")
obj = f"{alice}/txn-9/dp.png"
s, _ = call(
    f"{BASE}/storage/v1/object/payment-proofs/{obj}",
    "POST", b"\x89PNG\r\n\x1a\nproof", 
    {"Authorization": f"Bearer {SVC}", "apikey": SVC, "content-type": "image/png",
     "x-upsert": "true"},
)
check("seeded", s in (200, 201), f"http {s}")


def get_as(tok, path):
    s, _ = call(
        f"{BASE}/storage/v1/object/payment-proofs/{path}", "GET", None,
        {"Authorization": f"Bearer {tok}", "apikey": tok},
    )
    return s


def put_as(tok, path):
    s, _ = call(
        f"{BASE}/storage/v1/object/payment-proofs/{path}", "POST",
        b"\x89PNG\r\n\x1a\nx",
        {"Authorization": f"Bearer {tok}", "apikey": tok, "content-type": "image/png"},
    )
    return s


print("\n=== RLS as a real signed-in user ===")
s = get_as(alice_tok, obj)
check("alice reads her own proof", s == 200, f"http {s}")

s = get_as(bob_tok, obj)
check("bob DENIED reading alice's proof", s in (400, 403, 404), f"http {s}")

s = put_as(bob_tok, f"{alice}/txn-9/evil.png")
check("bob DENIED writing into alice's folder", s in (400, 403), f"http {s}")

s = put_as(bob_tok, f"{bob}/txn-9/ok.png")
check("bob allowed into his own folder", s in (200, 201), f"http {s}")

print("\n=== anon (no token) is denied entirely ===")
s, _ = call(
    f"{BASE}/storage/v1/object/payment-proofs/{obj}", "GET", None,
    {"apikey": SVC},
)
check("anon DENIED", s in (400, 401, 403, 404), f"http {s}")

print("\n=== cleanup ===")
for p in (obj, f"{bob}/txn-9/ok.png"):
    call(f"{BASE}/storage/v1/object/payment-proofs/{p}", "DELETE", None,
         {"Authorization": f"Bearer {SVC}", "apikey": SVC})
for uid in (alice, bob):
    if uid:
        call(f"{BASE}/auth/v1/admin/users/{uid}", "DELETE", None,
             {"Authorization": f"Bearer {SVC}", "apikey": SVC})
s, d = sql("select count(*)::int as n from storage.objects where bucket_id='payment-proofs'")
check("proofs removed", d[0]["n"] == 0, str(d))
s, d = sql("select count(*)::int as n from auth.users where email like 'zz%example.invalid'")
check("test users removed", d[0]["n"] == 0, str(d))

print(f"\n{'='*56}\nPASSED {sum(RESULTS)}/{len(RESULTS)}")
sys.exit(0 if all(RESULTS) else 1)
