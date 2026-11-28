-- Manual payment flow with admin approval.
--
-- Business rule (confirmed with the owner):
--   total tagihan = total sewa + kode unik (3 digit, 100..999, unik per hari)
--
-- Why a unique code at all: a manual bank transfer carries no reference, so the
-- only way to match an incoming credit to one specific invoice is a small odd
-- amount. Two invoices paid the same day must never share a code, otherwise
-- reconciliation is ambiguous — hence the per-day uniqueness constraint.
--
-- The live schema already has everything else this flow needs:
--   payments.unique_code, payments.proof_path, payments.status (approval enum),
--   payments.reviewed_by / reviewed_at,
--   RLS: customer may INSERT own payment; only an admin may UPDATE it.
--
-- Everything here is additive.

-- ---------------------------------------------------------------------------
-- 1. Amount actually payable, on the transaction itself
-- ---------------------------------------------------------------------------
-- `total` stays the pure rental total (used in every existing calculation and
-- in the CHECK constraint). The payable figure is derived, not stored, so the
-- two can never drift apart.
alter table transactions
  add column if not exists unique_code int not null default 0;

-- Postgres cannot add a CHECK that references the code range without also
-- guarding existing rows; the table is empty of invoices but be explicit.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_unique_code_range'
  ) then
    alter table transactions
      add constraint transactions_unique_code_range
      check (unique_code = 0 or (unique_code between 100 and 999));
  end if;
end $$;

-- Same guard on payments, which is where the code is actually attached to a
-- transfer the customer makes.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_unique_code_range'
  ) then
    alter table payments
      add constraint payments_unique_code_range
      check (unique_code = 0 or (unique_code between 100 and 999));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Per-day uniqueness
-- ---------------------------------------------------------------------------
-- Scoped to the creation date and only for invoices still awaiting payment:
-- once a transaction is cancelled or settled, its code is free again. A plain
-- UNIQUE(unique_code, date) would eventually exhaust the 900 available codes
-- on a busy day and block legitimate checkouts.
-- `created_at::date` is not IMMUTABLE (it depends on TimeZone), so it cannot be
-- used directly in an index expression. Materialise it into a stored generated
-- column bound to a fixed zone, then index that.
alter table transactions
  add column if not exists created_on date
  generated always as ((created_at at time zone 'Asia/Jakarta')::date) stored;

create unique index if not exists transactions_unique_code_per_day
  on transactions (unique_code, created_on)
  where unique_code <> 0
    and status in ('Menunggu Pembayaran', 'DP Terbayar');

-- ---------------------------------------------------------------------------
-- 3. Code generator
-- ---------------------------------------------------------------------------
-- Picks a random 3-digit code not currently in use for today. Raises instead of
-- returning a duplicate: a silent collision is worse than a failed checkout,
-- because two customers would pay indistinguishable amounts.
create or replace function next_unique_code()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate int;
  attempts  int := 0;
  session_key text := 'smartpro.used_codes';
  used      int[];
begin
  -- Two distinct collision sources, both handled here:
  --
  -- 1. Committed rows from other sessions. Read from the table under a
  --    transaction-scoped advisory lock so two concurrent checkouts cannot
  --    pick the same number.
  -- 2. Numbers handed out earlier *in this transaction* (e.g. 50 calls inside
  --    one statement). Those rows are not visible to our own SELECT yet, so
  --    they are tracked in a session variable instead.
  perform pg_advisory_xact_lock(hashtext('smartpro.unique_code'));

  used := coalesce(
    (select array_agg(value::int)
       from unnest(string_to_array(
              coalesce(current_setting(session_key, true), ''), ','
            )) as value
      where value <> ''),
    '{}'::int[]
  );

  loop
    candidate := 100 + floor(random() * 900)::int;
    attempts := attempts + 1;

    if candidate = any(used) then
      -- already issued in this transaction; draw again
      continue;
    end if;

    if not exists (
      select 1
        from transactions
       where unique_code = candidate
         and created_on = (now() at time zone 'Asia/Jakarta')::date
         and status in ('Menunggu Pembayaran', 'DP Terbayar')
    ) then
      perform set_config(session_key,
                         array_to_string(used || candidate, ','), true);
      return candidate;
    end if;

    if attempts >= 200 then
      raise exception 'tidak ada kode unik tersedia untuk hari ini'
        using errcode = 'unique_violation';
    end if;
  end loop;
end $$;

revoke all on function next_unique_code() from public;
grant execute on function next_unique_code() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Payable amount as a generated column
-- ---------------------------------------------------------------------------
-- Generated (stored) so it is always consistent and can be indexed/compared.
-- `total` keeps its existing meaning; nothing that reads it changes.
alter table transactions
  add column if not exists payable_amount bigint
  generated always as (total + unique_code) stored;

comment on column transactions.payable_amount is
  'total sewa + kode unik. Nominal yang harus ditransfer customer.';

comment on column transactions.unique_code is
  'Kode unik 3 digit (100-999), unik per hari, untuk mencocokkan transfer manual.';

comment on column payments.unique_code is
  'Kode unik yang menempel pada pembayaran ini, dicatat saat bukti transfer diunggah.';
