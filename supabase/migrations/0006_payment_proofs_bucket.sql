-- Private storage for manual-transfer proof of payment.
--
-- Design constraints, and why each policy exists:
--
--   1. The bucket is PRIVATE. A bank transfer receipt shows the customer's
--      account name, partial account number and the amount. It must never be
--      world-readable.
--
--   2. A customer may upload only into their own folder. Paths are therefore
--      structured as: "<auth.uid()>/<transaction_id>/<stage>-<timestamp>.<ext>"
--      and the policies check that the first path segment equals auth.uid().
--      Without that check any signed-in user could overwrite another's proof.
--
--   3. Only an admin may read all proofs. The customer reads back only their
--      own. Reads go through short-lived signed URLs issued server-side; the
--      bucket is not public, so storage.objects RLS is the real gate.
--
--   4. Nothing is ever deleted by the customer. An admin may delete (e.g. a
--      rejected upload that contains the wrong person's data). Deleting a
--      proof destroys audit evidence, so the customer gets no DELETE policy.
--
-- Size and MIME limits are enforced by the bucket, not only by the client,
-- because a browser-side check is advisory at best.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  5 * 1024 * 1024,                                   -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public             = false,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Customer: insert into own folder only
-- ---------------------------------------------------------------------------
drop policy if exists payment_proofs_customer_insert on storage.objects;

create policy payment_proofs_customer_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'payment-proofs'
    -- first path segment must be the caller's uid
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Customer: read back own proofs
-- ---------------------------------------------------------------------------
drop policy if exists payment_proofs_customer_read on storage.objects;

create policy payment_proofs_customer_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Customer: replace/re-upload own proof (update), still own folder only
-- ---------------------------------------------------------------------------
drop policy if exists payment_proofs_customer_update on storage.objects;

create policy payment_proofs_customer_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Admin: read every proof (review queue)
-- ---------------------------------------------------------------------------
drop policy if exists payment_proofs_admin_read on storage.objects;

create policy payment_proofs_admin_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Admin: delete (e.g. wrong-person upload; destroys audit evidence)
-- ---------------------------------------------------------------------------
drop policy if exists payment_proofs_admin_delete on storage.objects;

create policy payment_proofs_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- Deliberately absent: anon policies.
-- A signed-out visitor can neither read nor write this bucket. The public
-- catalog path never touches it.
-- ---------------------------------------------------------------------------
