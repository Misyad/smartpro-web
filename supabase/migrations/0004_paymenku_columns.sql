-- Add the Paymenku QRIS columns to payments.
--
-- The live schema predates the Paymenku integration: payments currently models
-- manual transfer/cash only (proof_path, reviewed_by, reviewed_at). QRIS needs
-- the gateway's own identifiers so a webhook can be matched back to a row.
--
-- Purely additive. No existing column is altered or dropped, and the table is
-- empty (verified before writing this), so there is no data migration.
--
-- Naming follows the existing snake_case convention. paymenku_trx_id is unique
-- because it is the identifier the gateway sends back in every webhook.

alter table payments
  add column if not exists paymenku_trx_id  text,
  add column if not exists paymenku_reference text,
  add column if not exists qr_url           text,
  add column if not exists payment_url      text,
  add column if not exists expires_at       timestamptz,
  add column if not exists paid_at          timestamptz;

-- Unique only where set: legacy manual payments have no gateway id and must not
-- collide on NULL.
create unique index if not exists payments_paymenku_trx_id_key
  on payments (paymenku_trx_id)
  where paymenku_trx_id is not null;

create index if not exists payments_paymenku_reference_idx
  on payments (paymenku_reference)
  where paymenku_reference is not null;

-- Webhook idempotency. The gateway may deliver the same event more than once;
-- the unique constraint is what makes applyPaymentWebhook() safe to retry.
create table if not exists payment_events (
  id              uuid primary key default gen_random_uuid(),
  paymenku_trx_id text not null,
  event_type      text not null,
  status          text not null,
  payload         jsonb not null,
  received_at     timestamptz not null default now(),
  unique (paymenku_trx_id, event_type, status)
);

-- Service-role only: no policies are created on purpose, and RLS is enabled so
-- that anon/authenticated see nothing and cannot write.
alter table payment_events enable row level security;
revoke all on payment_events from anon, authenticated;

-- The payments table needs a guard so a customer can never mark themselves paid.
-- The live schema already has payments_insert_self / payments_read /
-- payments_admin_update; verify the update path is admin-only rather than
-- assuming it. This block fails loudly if the policy is wrong.
do $$
declare
  has_user_update boolean;
begin
  select exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'payments'
       and cmd = 'UPDATE'
       and policyname not ilike '%admin%'
  ) into has_user_update;

  if has_user_update then
    raise exception
      'payments has a non-admin UPDATE policy; a customer could self-approve payment';
  end if;
  raise notice 'payments UPDATE is admin-only (safe)';
end $$;
