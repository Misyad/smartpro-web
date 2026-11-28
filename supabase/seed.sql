-- Demo seed for SMartPro.
--
-- Idempotent: safe to run repeatedly. Uses fixed UUIDs so re-running updates in
-- place instead of duplicating. Mirrors the catalog shape of
-- src/lib/smartpro-seed.ts but is NOT a 1:1 port — the TypeScript seed carries
-- client-side demo users with plaintext passwords, which deliberately do not
-- exist here.
--
-- Real user accounts are created through Supabase Auth by an admin, then linked
-- by the handle_new_user trigger into public.profiles.

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
insert into products
  (id, slug, name, category, price_12h, price_24h, active_12h, active_24h,
   best_seller, reward_points, accessories, specs, art)
values
  ('11111111-1111-4111-8111-000000000001', 'sony-fx3', 'Sony FX3 Cinema Line',
   'kamera', 750000, 1200000, true, true, true, 75,
   '2x baterai NP-FZ100, charger, cage, 2x CFexpress 128GB',
   'Full-frame 10-bit 4:2:2, S-Cinetone, 4K120', 'camera'),

  ('11111111-1111-4111-8111-000000000002', 'sony-fx6', 'Sony FX6 Full Frame',
   'kamera', 1500000, 2400000, true, true, true, 150,
   '4x baterai BP-U60, charger, top handle, 2x CFexpress 256GB',
   '4K120 10-bit, dual base ISO 800/12800, e-ND', 'camera'),

  ('11111111-1111-4111-8111-000000000003', 'blackmagic-ursa', 'Blackmagic URSA Mini Pro 12K',
   'kamera', 2000000, 3200000, true, true, false, 200,
   'V-mount plate, 2x baterai, shoulder rig, 2x CFast 2.0',
   '12K Super35, 80MP sensor, BRAW internal', 'camera'),

  ('11111111-1111-4111-8111-000000000004', 'hollyland-cosmo-c1',
   'Hollyland Cosmo C1 Wireless Video', 'wireless_video',
   200000, 320000, true, true, true, 20,
   '2x TX, 2x RX, 8x antena, 4x baterai LP-E6, case',
   '1080p60 SDI/HDMI, 350m LOS, <60ms latency', 'wireless'),

  ('11111111-1111-4111-8111-000000000005', 'teradek-bolt-4k',
   'Teradek Bolt 4K LT 750', 'wireless_video',
   900000, 1500000, true, true, false, 90,
   'TX, RX, 2x baterai, dual SDI/HDMI, case',
   '4K30 10-bit, 750ft LOS, tidak terkompresi', 'wireless'),

  ('11111111-1111-4111-8111-000000000006', 'atem-mini-pro',
   'ATEM Mini Pro ISO', 'switcher_live',
   250000, 400000, true, true, false, 25,
   'Adaptor, 4x HDMI, USB-C SSD 1TB',
   '4 input HDMI, ISO record, streaming built-in', 'switcher'),

  ('11111111-1111-4111-8111-000000000007', 'atem-television',
   'ATEM Television Studio HD8 ISO', 'switcher_live',
   1100000, 1800000, true, false, false, 110,
   'Adaptor, 8x input, rack ear, 2x SSD',
   '8 input, 3G-SDI + HDMI, multi-view dual', 'switcher')
on conflict (id) do update set
  name          = excluded.name,
  category      = excluded.category,
  price_12h     = excluded.price_12h,
  price_24h     = excluded.price_24h,
  active_12h    = excluded.active_12h,
  active_24h    = excluded.active_24h,
  best_seller   = excluded.best_seller,
  reward_points = excluded.reward_points,
  accessories   = excluded.accessories,
  specs         = excluded.specs;

-- ---------------------------------------------------------------------------
-- Physical units (2 per product unless noted) — drives booking capacity
-- ---------------------------------------------------------------------------
-- Serial = first 8 chars of the slug + unit ordinal. Using the last 8 chars of
-- the fixed UUID would collide because every id shares the same tail; the slug
-- prefix alone collides for sony-fx3 / sony-fx6. Eight chars is enough to stay
-- unique across the seeded catalog and still readable on a physical label.
insert into product_units (id, product_id, serial, status)
select
  gen_random_uuid(),
  p.id,
  upper(substr(replace(p.slug, '-', ''), 1, 8)) || '-U' || n::text,
  'ready'
from products p
cross join generate_series(1, 2) as n
where p.id::text like '11111111-%'
on conflict (serial) do nothing;

-- ---------------------------------------------------------------------------
-- Bundles
-- ---------------------------------------------------------------------------
insert into bundles (id, slug, name, price, regular_price, note)
values
  ('22222222-2222-4222-8222-000000000001', 'paket-interview',
   'Paket Interview 2 Kamera', 1900000, 2200000,
   'Cocok untuk liputan dan wawancara studio'),
  ('22222222-2222-4222-8222-000000000002', 'paket-live-streaming',
   'Paket Live Streaming', 1400000, 1600000,
   'Switcher + wireless video + kamera utama')
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  regular_price = excluded.regular_price,
  note = excluded.note;

insert into bundle_items (bundle_id, product_id, quantity)
values
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001', 2),
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000004', 1),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000002', 1),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000006', 1)
on conflict (bundle_id, product_id) do update set quantity = excluded.quantity;

-- ---------------------------------------------------------------------------
-- Vouchers
-- ---------------------------------------------------------------------------
insert into vouchers (id, code, discount, active, expires_at)
values
  ('33333333-3333-4333-8333-000000000001', 'HEMAT100', 100000, true,
   now() + interval '90 days'),
  ('33333333-3333-4333-8333-000000000002', 'NEWCUSTOMER', 250000, true,
   now() + interval '90 days')
on conflict (id) do update set
  discount = excluded.discount,
  active = excluded.active,
  expires_at = excluded.expires_at;

-- ---------------------------------------------------------------------------
-- First admin bootstrap
--
-- Chicken-and-egg: creating users requires an admin actor, but a blank database
-- has none. Resolve it explicitly and safely:
--   1. Create the auth user via the Supabase dashboard or Admin API.
--   2. Promote it once with this statement (edit the email).
--
-- This is intentionally NOT automated. An auto-promoted first user is a
-- privilege-escalation hole if the migration runs on a live project.
-- ---------------------------------------------------------------------------
-- update profiles
--    set role = 'admin'
--  where id = (select id from auth.users where email = 'admin@example.com');
