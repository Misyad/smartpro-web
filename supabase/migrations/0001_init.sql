-- SMartPro rental platform — initial schema.
-- Mirrors the client-side domain model in src/lib/smartpro-data.ts so the
-- existing UI can be migrated to server data without reshaping the domain.
--
-- Auth is handled by Supabase Auth (auth.users). public.profiles extends it.
-- Money is stored in whole rupiah (integer) — IDR has no minor unit in use here.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type user_role       as enum ('admin', 'pelanggan');
create type kyc_status      as enum ('belum', 'menunggu', 'verified', 'ditolak');
create type unit_status     as enum ('ready', 'maintenance');
create type rental_duration as enum ('12h', '24h');
create type payment_method  as enum ('transfer', 'cash', 'qris');
create type payment_stage   as enum ('dp', 'pelunasan');
create type approval_status as enum ('menunggu', 'disetujui', 'ditolak');
create type txn_status      as enum ('menunggu_pembayaran', 'dp_terbayar', 'lunas', 'selesai', 'dibatalkan');
create type pickup_status   as enum ('belum', 'diambil', 'dikembalikan');
create type product_category as enum ('kamera', 'wireless_video', 'switcher_live');

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  name        text not null,
  role        user_role not null default 'pelanggan',
  phone       text,
  kyc_status  kyc_status not null default 'belum',
  kyc_note    text,
  points      integer not null default 0 check (points >= 0),
  is_vip      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- KYC documents are stored in a private bucket; only the storage path lives here.
create table kyc_submissions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  nama_ktp     text not null,
  nik          text not null check (nik ~ '^[0-9]{16}$'),
  whatsapp     text not null,
  alamat       text not null,
  kontak_darurat text not null,
  foto_ktp_path    text,
  foto_selfie_path text,
  signature_path   text,
  status       kyc_status not null default 'menunggu',
  reviewed_by  uuid references profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index kyc_submissions_user_idx   on kyc_submissions (user_id, created_at desc);
create index kyc_submissions_status_idx on kyc_submissions (status);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table products (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  category      product_category not null,
  price_12h     integer not null check (price_12h >= 0),
  price_24h     integer not null check (price_24h >= 0),
  active_12h    boolean not null default true,
  active_24h    boolean not null default true,
  best_seller   boolean not null default false,
  image_url     text,
  reward_points integer not null default 0 check (reward_points >= 0),
  accessories   text not null default '',
  specs         text not null default '',
  art           text not null default 'camera',
  created_at    timestamptz not null default now()
);

create index products_category_idx on products (category) where active_12h or active_24h;

-- Physical units, individually tracked by serial so booking can be exact.
create table product_units (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  serial     text not null unique,
  status     unit_status not null default 'ready',
  created_at timestamptz not null default now()
);

create index product_units_product_idx on product_units (product_id, status);

create table bundles (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  price         integer not null check (price >= 0),
  regular_price integer not null check (regular_price >= 0),
  note          text not null default ''
);

create table bundle_items (
  bundle_id  uuid not null references bundles(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity   integer not null check (quantity > 0),
  primary key (bundle_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Bookings / schedule
-- ---------------------------------------------------------------------------
create table bookings (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  start_date date not null,
  end_date   date not null,
  quantity   integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index bookings_product_range_idx on bookings (product_id, start_date, end_date);

-- A product cannot be double-booked beyond its unit count for an overlapping range.
create or replace function check_booking_capacity() returns trigger
language plpgsql as $$
declare
  unit_count integer;
  booked     integer;
begin
  select count(*) into unit_count
    from product_units
   where product_id = new.product_id and status = 'ready';

  select coalesce(sum(quantity), 0) into booked
    from bookings
   where product_id = new.product_id
     and id <> coalesce(new.id, gen_random_uuid())
     and start_date <= new.end_date
     and end_date   >= new.start_date;

  if booked + new.quantity > unit_count then
    raise exception 'overbooked: % units available, % already booked for %..%',
      unit_count, booked, new.start_date, new.end_date
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger bookings_capacity
  before insert or update on bookings
  for each row execute function check_booking_capacity();

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------
create table transactions (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  customer_id      uuid not null references profiles(id) on delete restrict,
  customer_name    text not null,
  customer_phone   text not null,
  start_date       date not null,
  end_date         date not null,
  subtotal         integer not null check (subtotal >= 0),
  points_discount  integer not null default 0 check (points_discount >= 0),
  voucher_code     text,
  voucher_discount integer not null default 0 check (voucher_discount >= 0),
  vip_discount     integer not null default 0 check (vip_discount >= 0),
  total            integer not null check (total >= 0),
  points_redeemed  integer not null default 0 check (points_redeemed >= 0),
  points_earned    integer not null default 0 check (points_earned >= 0),
  dp_amount        integer not null default 0 check (dp_amount >= 0),
  remaining_amount integer not null default 0 check (remaining_amount >= 0),
  status           txn_status not null default 'menunggu_pembayaran',
  pickup_status    pickup_status not null default 'belum',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (end_date >= start_date),
  check (total = subtotal - points_discount - voucher_discount - vip_discount)
);

create index transactions_customer_idx on transactions (customer_id, created_at desc);
create index transactions_status_idx   on transactions (status);

create table transaction_lines (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references transactions(id) on delete cascade,
  product_id      uuid references products(id) on delete set null,
  name            text not null,
  duration        rental_duration not null,
  price           integer not null check (price >= 0),
  quantity        integer not null check (quantity > 0),
  reward_points   integer not null default 0
);

create index transaction_lines_txn_idx on transaction_lines (transaction_id);

-- ---------------------------------------------------------------------------
-- Payments (Paymenku QRIS + legacy manual transfer/cash)
-- ---------------------------------------------------------------------------
create table payments (
  id                  uuid primary key default gen_random_uuid(),
  transaction_id      uuid not null references transactions(id) on delete cascade,
  stage               payment_stage not null,
  method              payment_method not null,
  amount              integer not null check (amount > 0),
  unique_code         integer not null default 0,
  status              approval_status not null default 'menunggu',

  -- Paymenku fields
  paymenku_trx_id     text unique,
  paymenku_reference  text,
  qr_url              text,
  payment_url         text,
  expires_at          timestamptz,
  paid_at             timestamptz,

  -- Manual-transfer proof (legacy flow); private bucket path
  proof_path          text,
  note                text,
  created_at          timestamptz not null default now()
);

create index payments_txn_idx    on payments (transaction_id);
create index payments_status_idx on payments (status);

-- Idempotency: a webhook may be delivered more than once for the same event.
create table payment_events (
  id            uuid primary key default gen_random_uuid(),
  paymenku_trx_id text not null,
  event_type    text not null,
  status        text not null,
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  unique (paymenku_trx_id, event_type, status)
);

-- ---------------------------------------------------------------------------
-- Auxiliary
-- ---------------------------------------------------------------------------
create table vouchers (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  discount    integer not null check (discount > 0),
  active      boolean not null default true,
  expires_at  timestamptz
);

create table wishlists (
  user_id    uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table extend_requests (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  extra_days     integer not null check (extra_days > 0),
  status         approval_status not null default 'menunggu',
  note           text,
  created_at     timestamptz not null default now()
);

create table return_requests (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  reason         text not null,
  status         approval_status not null default 'menunggu',
  note           text,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_touch     before update on profiles     for each row execute function touch_updated_at();
create trigger transactions_touch before update on transactions for each row execute function touch_updated_at();
