-- Live schema fixture for CI. GENERATED — do not edit by hand.
--
-- Structure only (types, tables, constraints, indexes). No rows, no credentials.
-- Regenerate with scripts/dump-live-schema.py when the live schema changes.
--
-- Purpose: migrations 0004-0006 are written against the live schema and cannot
-- be applied onto the draft in 0001-0003. The CI check replays this fixture
-- first, then applies those migrations for real.

-- Enums
create type approval as enum ('Menunggu', 'Disetujui', 'Ditolak');
create type kyc_status as enum ('Belum', 'Menunggu', 'Verified', 'Ditolak');
create type payment_method as enum ('transfer', 'cash');
create type payment_stage as enum ('DP', 'Pelunasan');
create type pickup_status as enum ('Belum', 'Diambil', 'Dikembalikan');
create type product_cat as enum ('Kamera', 'Wireless Video', 'Switcher & Live');
create type rental_dur as enum ('12h', '24h');
create type return_target as enum ('admin', 'next-customer');
create type sched_kind as enum ('Pick-Up', 'Return');
create type sched_status as enum ('Menunggu', 'Diambil', 'Dikembalikan');
create type trx_status as enum ('Menunggu Pembayaran', 'DP Terbayar', 'Lunas', 'Selesai', 'Dibatalkan');
create type unit_status as enum ('READY', 'MAINTENANCE');
create type user_role as enum ('admin', 'pelanggan');
create type voucher_type as enum ('percent', 'fixed');

-- Tables
create table if not exists public.app_settings (id boolean not null default true, min_rupiah_reward bigint not null default 150000, poin_per_kelipatan integer not null default 10, min_poin_tukar integer not null default 100, rupiah_per_poin bigint not null default 500, overtime_fee_12h bigint not null default 50000, whatsapp_admin text not null default ''::text, vip_discount_percent integer not null default 10, wa_template_booking text not null default ''::text, wa_template_dp text not null default ''::text, wa_template_lunas text not null default ''::text, wa_template_reminder text not null default ''::text, wa_template_extend text not null default ''::text, updated_at timestamp with time zone not null default now());
create table if not exists public.bundle_items (bundle_id uuid not null, product_id uuid not null, quantity integer not null);
create table if not exists public.bundles (id uuid not null default gen_random_uuid(), name text not null, price_12h bigint not null default 0, price_24h bigint not null default 0, description text not null default ''::text, archived boolean not null default false);
create table if not exists public.cart_lines (id uuid not null default gen_random_uuid(), user_id uuid not null, product_id uuid not null, duration rental_dur not null, price bigint not null, quantity integer not null default 1, reward_points integer not null default 0, created_at timestamp with time zone not null default now());
create table if not exists public.extend_requests (id uuid not null default gen_random_uuid(), transaction_id uuid not null, extra_hours integer not null, extra_fee bigint not null, status approval not null default 'Menunggu'::approval, paid boolean not null default false, created_at timestamp with time zone not null default now());
create table if not exists public.kyc_submissions (user_id uuid not null, nama_ktp text not null default ''::text, nik text not null default ''::text, whatsapp text not null default ''::text, alamat text not null default ''::text, kontak_darurat text not null default ''::text, foto_ktp_path text, foto_selfie_path text, signature_path text, submitted_at timestamp with time zone not null default now(), reviewed_at timestamp with time zone, reviewed_by uuid);
create table if not exists public.payment_events (id uuid not null default gen_random_uuid(), paymenku_trx_id text not null, event_type text not null, status text not null, payload jsonb not null, received_at timestamp with time zone not null default now());
create table if not exists public.payments (id uuid not null default gen_random_uuid(), transaction_id uuid not null, stage payment_stage not null, method payment_method not null, amount bigint not null, unique_code integer not null default 0, proof_path text, status approval not null default 'Menunggu'::approval, note text, created_at timestamp with time zone not null default now(), reviewed_at timestamp with time zone, reviewed_by uuid, paymenku_trx_id text, paymenku_reference text, qr_url text, payment_url text, expires_at timestamp with time zone, paid_at timestamp with time zone);
create table if not exists public.product_bookings (id uuid not null default gen_random_uuid(), product_id uuid not null, start_date date not null, end_date date not null, quantity integer not null, trx_id uuid, created_at timestamp with time zone not null default now());
create table if not exists public.product_serials (code text not null, product_id uuid not null, status unit_status not null default 'READY'::unit_status);
create table if not exists public.products (id uuid not null default gen_random_uuid(), name text not null, category product_cat not null, price_12h bigint not null, price_24h bigint not null, active_12h boolean not null default true, active_24h boolean not null default true, best_seller boolean not null default false, image_path text, reward_points integer not null default 0, accessories text not null default ''::text, specs text not null default ''::text, art text not null default 'camera'::text, archived boolean not null default false, created_at timestamp with time zone not null default now());
create table if not exists public.profiles (id uuid not null, username citext not null, name text not null default ''::text, role user_role not null default 'pelanggan'::user_role, phone text not null default ''::text, kyc_status kyc_status not null default 'Belum'::kyc_status, kyc_note text, points integer not null default 0, is_vip boolean not null default false, created_at timestamp with time zone not null default now(), updated_at timestamp with time zone not null default now());
create table if not exists public.return_photos (id uuid not null default gen_random_uuid(), return_id uuid not null, storage_path text not null, "position" integer not null default 0);
create table if not exists public.return_requests (id uuid not null default gen_random_uuid(), transaction_id uuid not null, target return_target not null default 'admin'::return_target, next_customer text, status approval not null default 'Menunggu'::approval, overtime_hours integer not null default 0, overtime_fee bigint not null default 0, note text, created_at timestamp with time zone not null default now());
create table if not exists public.schedule_entries (id uuid not null default gen_random_uuid(), customer text not null, product text not null, duration rental_dur not null, entry_date date not null, kind sched_kind not null, status sched_status not null default 'Menunggu'::sched_status, phone text not null default ''::text, trx_id uuid);
create table if not exists public.transaction_lines (id uuid not null default gen_random_uuid(), transaction_id uuid not null, product_id uuid, name text not null, duration rental_dur not null, price bigint not null, quantity integer not null, reward_points integer not null default 0);
create table if not exists public.transactions (id uuid not null default gen_random_uuid(), code text not null, customer_id uuid not null, customer_name text not null, customer_phone text not null default ''::text, start_date date not null, end_date date not null, subtotal bigint not null, points_discount bigint not null default 0, voucher_code text, voucher_discount bigint not null default 0, vip_discount bigint not null default 0, total bigint not null, points_redeemed integer not null default 0, points_earned integer not null default 0, dp_amount bigint not null default 0, remaining_amount bigint not null default 0, method payment_method not null default 'transfer'::payment_method, unique_code integer not null default 0, status trx_status not null default 'Menunggu Pembayaran'::trx_status, pickup_status pickup_status not null default 'Belum'::pickup_status, created_at timestamp with time zone not null default now(), created_on date generated always as (((created_at AT TIME ZONE 'Asia/Jakarta'::text))::date) stored, payable_amount bigint generated always as ((total + unique_code)) stored);
create table if not exists public.vouchers (id uuid not null default gen_random_uuid(), code citext not null, type voucher_type not null, value bigint not null, min_spend bigint not null default 0, active boolean not null default true, expires_at timestamp with time zone not null);
create table if not exists public.wishlists (user_id uuid not null, product_id uuid not null, created_at timestamp with time zone not null default now());

-- Constraints
alter table public.app_settings add constraint app_settings_pkey PRIMARY KEY (id);
alter table public.bundle_items add constraint bundle_items_pkey PRIMARY KEY (bundle_id, product_id);
alter table public.bundles add constraint bundles_pkey PRIMARY KEY (id);
alter table public.cart_lines add constraint cart_lines_pkey PRIMARY KEY (id);
alter table public.extend_requests add constraint extend_requests_pkey PRIMARY KEY (id);
alter table public.kyc_submissions add constraint kyc_submissions_pkey PRIMARY KEY (user_id);
alter table public.payment_events add constraint payment_events_pkey PRIMARY KEY (id);
alter table public.payments add constraint payments_pkey PRIMARY KEY (id);
alter table public.product_bookings add constraint product_bookings_pkey PRIMARY KEY (id);
alter table public.product_serials add constraint product_serials_pkey PRIMARY KEY (code);
alter table public.products add constraint products_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.return_photos add constraint return_photos_pkey PRIMARY KEY (id);
alter table public.return_requests add constraint return_requests_pkey PRIMARY KEY (id);
alter table public.schedule_entries add constraint schedule_entries_pkey PRIMARY KEY (id);
alter table public.transaction_lines add constraint transaction_lines_pkey PRIMARY KEY (id);
alter table public.transactions add constraint transactions_pkey PRIMARY KEY (id);
alter table public.vouchers add constraint vouchers_pkey PRIMARY KEY (id);
alter table public.wishlists add constraint wishlists_pkey PRIMARY KEY (user_id, product_id);
alter table public.payment_events add constraint payment_events_paymenku_trx_id_event_type_status_key UNIQUE (paymenku_trx_id, event_type, status);
alter table public.profiles add constraint profiles_username_key UNIQUE (username);
alter table public.transactions add constraint transactions_code_key UNIQUE (code);
alter table public.vouchers add constraint vouchers_code_key UNIQUE (code);
alter table public.app_settings add constraint app_settings_id_check CHECK (id);
alter table public.app_settings add constraint app_settings_vip_discount_percent_check CHECK (((vip_discount_percent >= 0) AND (vip_discount_percent <= 100)));
alter table public.bundle_items add constraint bundle_items_quantity_check CHECK ((quantity > 0));
alter table public.cart_lines add constraint cart_lines_price_check CHECK ((price >= 0));
alter table public.cart_lines add constraint cart_lines_quantity_check CHECK ((quantity > 0));
alter table public.extend_requests add constraint extend_requests_extra_fee_check CHECK ((extra_fee >= 0));
alter table public.extend_requests add constraint extend_requests_extra_hours_check CHECK ((extra_hours > 0));
alter table public.payments add constraint payments_amount_check CHECK ((amount >= 0));
alter table public.payments add constraint payments_unique_code_range CHECK (((unique_code = 0) OR ((unique_code >= 100) AND (unique_code <= 999))));
alter table public.product_bookings add constraint booking_range_valid CHECK ((end_date >= start_date));
alter table public.product_bookings add constraint product_bookings_quantity_check CHECK ((quantity > 0));
alter table public.products add constraint products_price_12h_check CHECK ((price_12h >= 0));
alter table public.products add constraint products_price_24h_check CHECK ((price_24h >= 0));
alter table public.products add constraint products_reward_points_check CHECK ((reward_points >= 0));
alter table public.profiles add constraint profiles_points_check CHECK ((points >= 0));
alter table public.transaction_lines add constraint transaction_lines_price_check CHECK ((price >= 0));
alter table public.transaction_lines add constraint transaction_lines_quantity_check CHECK ((quantity > 0));
alter table public.transactions add constraint transactions_subtotal_check CHECK ((subtotal >= 0));
alter table public.transactions add constraint transactions_total_check CHECK ((total >= 0));
alter table public.transactions add constraint transactions_unique_code_range CHECK (((unique_code = 0) OR ((unique_code >= 100) AND (unique_code <= 999))));
alter table public.transactions add constraint trx_range_valid CHECK ((end_date >= start_date));
alter table public.vouchers add constraint vouchers_value_check CHECK ((value > 0));
alter table public.bundle_items add constraint bundle_items_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES bundles(id) ON DELETE CASCADE;
alter table public.bundle_items add constraint bundle_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public.cart_lines add constraint cart_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public.cart_lines add constraint cart_lines_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.extend_requests add constraint extend_requests_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;
alter table public.kyc_submissions add constraint kyc_submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(id);
alter table public.kyc_submissions add constraint kyc_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.payments add constraint payments_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(id);
alter table public.payments add constraint payments_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;
alter table public.product_bookings add constraint product_bookings_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public.product_serials add constraint product_serials_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.return_photos add constraint return_photos_return_id_fkey FOREIGN KEY (return_id) REFERENCES return_requests(id) ON DELETE CASCADE;
alter table public.return_requests add constraint return_requests_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;
alter table public.schedule_entries add constraint schedule_entries_trx_id_fkey FOREIGN KEY (trx_id) REFERENCES transactions(id) ON DELETE CASCADE;
alter table public.transaction_lines add constraint transaction_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);
alter table public.transaction_lines add constraint transaction_lines_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;
alter table public.transactions add constraint transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id);
alter table public.wishlists add constraint wishlists_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public.wishlists add constraint wishlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX cart_lines_user_idx ON public.cart_lines USING btree (user_id);
CREATE INDEX payments_paymenku_reference_idx ON public.payments USING btree (paymenku_reference) WHERE (paymenku_reference IS NOT NULL);
CREATE UNIQUE INDEX payments_paymenku_trx_id_key ON public.payments USING btree (paymenku_trx_id) WHERE (paymenku_trx_id IS NOT NULL);
CREATE INDEX payments_pending_idx ON public.payments USING btree (status) WHERE (status = 'Menunggu'::approval);
CREATE INDEX payments_trx_idx ON public.payments USING btree (transaction_id);
CREATE INDEX product_bookings_overlap_idx ON public.product_bookings USING btree (product_id, start_date, end_date);
CREATE INDEX product_serials_product_idx ON public.product_serials USING btree (product_id, status);
CREATE INDEX products_category_idx ON public.products USING btree (category) WHERE (NOT archived);
CREATE INDEX profiles_role_idx ON public.profiles USING btree (role);
CREATE INDEX schedule_entries_date_idx ON public.schedule_entries USING btree (entry_date);
CREATE INDEX transaction_lines_trx_idx ON public.transaction_lines USING btree (transaction_id);
CREATE INDEX transactions_customer_idx ON public.transactions USING btree (customer_id, created_at DESC);
CREATE INDEX transactions_status_idx ON public.transactions USING btree (status) WHERE (status <> 'Selesai'::trx_status);
CREATE UNIQUE INDEX transactions_unique_code_per_day ON public.transactions USING btree (unique_code, created_on) WHERE ((unique_code <> 0) AND (status = ANY (ARRAY['Menunggu Pembayaran'::trx_status, 'DP Terbayar'::trx_status])));
