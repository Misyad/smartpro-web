-- Row Level Security. The client-side app currently trusts localStorage;
-- after this migration the database is the security boundary.
--
-- Rules encoded here:
--   * Anonymous visitors may read the active catalog only.
--   * Customers read/write only their own rows.
--   * Admins read/write everything.
--   * Prices, totals and payment status are NEVER client-writable.
--   * Payment rows are written exclusively by the service role (webhook), never by users.

alter table profiles          enable row level security;
alter table kyc_submissions   enable row level security;
alter table products          enable row level security;
alter table product_units     enable row level security;
alter table bundles           enable row level security;
alter table bundle_items      enable row level security;
alter table bookings          enable row level security;
alter table transactions      enable row level security;
alter table transaction_lines enable row level security;
alter table payments          enable row level security;
alter table payment_events    enable row level security;
alter table vouchers          enable row level security;
alter table wishlists         enable row level security;
alter table extend_requests   enable row level security;
alter table return_requests   enable row level security;

-- ---------------------------------------------------------------------------
-- Helper: is the caller an admin? SECURITY DEFINER avoids recursive RLS on
-- profiles when other policies call it.
-- ---------------------------------------------------------------------------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
     where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_self_read on profiles for select
  using (id = auth.uid() or is_admin());

create policy profiles_self_update on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin_all on profiles for all
  using (is_admin()) with check (is_admin());

-- A user must never escalate their own role/points/kyc flag. Enforced with a
-- trigger because column-level policy checks do not exist for UPDATE in PG15.
create or replace function guard_profile_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;
  if new.role      is distinct from old.role
     or new.points    is distinct from old.points
     or new.is_vip    is distinct from old.is_vip
     or new.kyc_status is distinct from old.kyc_status then
    raise exception 'forbidden: privileged profile columns are not user-writable'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger profiles_guard before update on profiles
  for each row execute function guard_profile_columns();

-- ---------------------------------------------------------------------------
-- kyc_submissions — owner submits, admin reviews.
-- ---------------------------------------------------------------------------
create policy kyc_owner_read on kyc_submissions for select
  using (user_id = auth.uid() or is_admin());

create policy kyc_owner_insert on kyc_submissions for insert
  with check (user_id = auth.uid());

-- Only admins may change status/reviewer; owner may not self-approve.
create policy kyc_admin_update on kyc_submissions for update
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Catalog — public read of active items, admin write.
-- ---------------------------------------------------------------------------
create policy products_public_read on products for select
  using (active_12h or active_24h or is_admin());

create policy products_admin_write on products for all
  using (is_admin()) with check (is_admin());

create policy product_units_public_read on product_units for select using (true);
create policy product_units_admin_write on product_units for all
  using (is_admin()) with check (is_admin());

create policy bundles_public_read on bundles for select using (true);
create policy bundles_admin_write on bundles for all
  using (is_admin()) with check (is_admin());

create policy bundle_items_public_read on bundle_items for select using (true);
create policy bundle_items_admin_write on bundle_items for all
  using (is_admin()) with check (is_admin());

-- Bookings feed the availability calendar; the aggregate is public, the
-- underlying rows are not personal data.
create policy bookings_public_read on bookings for select using (true);
create policy bookings_admin_write on bookings for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- transactions — customer sees own, admin sees all. Creation goes through a
-- server function that computes totals; clients cannot insert directly.
-- ---------------------------------------------------------------------------
create policy transactions_owner_read on transactions for select
  using (customer_id = auth.uid() or is_admin());

create policy transactions_admin_write on transactions for all
  using (is_admin()) with check (is_admin());

create policy txn_lines_owner_read on transaction_lines for select
  using (exists (
    select 1 from transactions t
     where t.id = transaction_lines.transaction_id
       and (t.customer_id = auth.uid() or is_admin())
  ));

create policy txn_lines_admin_write on transaction_lines for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- payments — read-only for the owning customer. All writes are service-role
-- (create-payment server function + webhook). No user-facing write policy
-- exists on purpose: a customer must never be able to mark themselves paid.
-- ---------------------------------------------------------------------------
create policy payments_owner_read on payments for select
  using (exists (
    select 1 from transactions t
     where t.id = payments.transaction_id
       and (t.customer_id = auth.uid() or is_admin())
  ));

-- payment_events: no policies at all -> invisible to anon/authenticated.
-- Only the service role (which bypasses RLS) can read or write it.

-- ---------------------------------------------------------------------------
-- vouchers
-- ---------------------------------------------------------------------------
create policy vouchers_public_read on vouchers for select
  using (active and (expires_at is null or expires_at > now()));
create policy vouchers_admin_write on vouchers for all
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- wishlists
-- ---------------------------------------------------------------------------
create policy wishlist_owner_all on wishlists for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- extend / return requests — customer creates own, admin decides.
-- ---------------------------------------------------------------------------
create policy extend_owner_read on extend_requests for select
  using (exists (
    select 1 from transactions t
     where t.id = extend_requests.transaction_id
       and (t.customer_id = auth.uid() or is_admin())
  ));
create policy extend_owner_insert on extend_requests for insert
  with check (exists (
    select 1 from transactions t
     where t.id = extend_requests.transaction_id
       and t.customer_id = auth.uid()
  ));
create policy extend_admin_update on extend_requests for update
  using (is_admin()) with check (is_admin());

create policy return_owner_read on return_requests for select
  using (exists (
    select 1 from transactions t
     where t.id = return_requests.transaction_id
       and (t.customer_id = auth.uid() or is_admin())
  ));
create policy return_owner_insert on return_requests for insert
  with check (exists (
    select 1 from transactions t
     where t.id = return_requests.transaction_id
       and t.customer_id = auth.uid()
  ));
create policy return_admin_update on return_requests for update
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Storage buckets: KYC documents and payment proofs are private.
-- Access is granted through short-lived signed URLs issued server-side.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('kyc-documents', 'kyc-documents', false, 5242880,
     array['image/jpeg','image/png','image/webp']),
  ('payment-proofs', 'payment-proofs', false, 5242880,
     array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy kyc_storage_owner_rw on storage.objects for all
  using (bucket_id = 'kyc-documents' and owner = auth.uid())
  with check (bucket_id = 'kyc-documents' and owner = auth.uid());

create policy kyc_storage_admin_read on storage.objects for select
  using (bucket_id = 'kyc-documents' and is_admin());

create policy proof_storage_owner_rw on storage.objects for all
  using (bucket_id = 'payment-proofs' and owner = auth.uid())
  with check (bucket_id = 'payment-proofs' and owner = auth.uid());

create policy proof_storage_admin_read on storage.objects for select
  using (bucket_id = 'payment-proofs' and is_admin());
