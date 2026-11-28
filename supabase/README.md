# Supabase — applied state

## What is live

The project `smartpro-web` (`pmzwttnoeucuhoiitagv`, ap-northeast-1) already had
18 tables and 39 RLS policies before this branch. That schema is the one in use.

`0001_init.sql`, `0002_rls.sql` and `0003_auth_linkage.sql` describe a **parallel
draft** written without sight of the live project. They are kept for reference
only and **must not be applied** on top of the live schema: table names collide
(`products`, `payments`, `transactions`…) with different column sets.

## Applied to the live project

| Migration | Effect |
|---|---|
| `0000_grants.sql` | Restored the missing GRANTs. Every REST call was returning 42501 even with `service_role`, because table privileges had never been granted. |
| `0004_paymenku_columns.sql` | Added `paymenku_trx_id`, `paymenku_reference`, `qr_url`, `payment_url`, `expires_at`, `paid_at` to `payments`; created `payment_events` with a unique idempotency key; verified `payments` UPDATE is admin-only. |

## Why the live schema wins

It is richer than the draft: `app_settings` (configurable VIP %, point value,
min redemption, overtime fee, WA templates), persisted `cart_lines`,
`return_photos` as its own table, `schedule_entries`, and `product_bookings.trx_id`.

Operational rates are **not** hardcoded in the application. `src/server/functions.ts`
reads them from `app_settings` at pricing time, because the admin UI can change
them and a constant would silently diverge.

## Column differences the repository layer maps

| Table | Live column | Draft assumed |
|---|---|---|
| products | `image_path`, `archived` | `image_url`, `slug` |
| bundles | `price_12h` / `price_24h` / `description` | `price` / `regular_price` / `note` |
| vouchers | `type` / `value` / `min_spend` | flat `discount` |
| return_requests | `target`, `next_customer`, `overtime_hours`, `overtime_fee` | `reason` |

All mapping lives in `src/lib/smartpro-repo.ts` so the UI domain types stay stable.
