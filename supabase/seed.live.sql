-- Seed the live SMartPro schema with a demo catalog.
--
-- Written against the columns that actually exist (verified by introspection):
--   products(image_path, archived, ...)   bundles(price_12h, price_24h, description)
--   product_serials(code, product_id, status)
--
-- Idempotent: fixed UUIDs + ON CONFLICT, so re-running never duplicates.
-- Does not touch profiles or transactions — those need real auth users.

insert into products
  (id, name, category, price_12h, price_24h, active_12h, active_24h,
   best_seller, image_path, reward_points, accessories, specs, art, archived)
values
  ('11111111-1111-4111-8111-000000000001', 'Sony FX3 Cinema Line', 'Kamera',
   750000, 1200000, true, true, true, '/products/fx3.jpg', 75,
   '2x baterai NP-FZ100, charger, cage, 2x CFexpress 128GB',
   'Full-frame 10-bit 4:2:2, S-Cinetone, 4K120', 'camera', false),

  ('11111111-1111-4111-8111-000000000002', 'Sony FX6 Full Frame', 'Kamera',
   1500000, 2400000, true, true, true, '/products/fx6.jpg', 150,
   '4x baterai BP-U60, charger, top handle, 2x CFexpress 256GB',
   '4K120 10-bit, dual base ISO 800/12800, e-ND', 'camera', false),

  ('11111111-1111-4111-8111-000000000003', 'Blackmagic URSA Mini Pro 12K', 'Kamera',
   2000000, 3200000, true, true, false, '/products/ursa.jpg', 200,
   'V-mount plate, 2x baterai, shoulder rig, 2x CFast 2.0',
   '12K Super35, 80MP sensor, BRAW internal', 'camera', false),

  ('11111111-1111-4111-8111-000000000004', 'Hollyland Cosmo C1 Wireless Video',
   'Wireless Video', 200000, 320000, true, true, true, '/products/cosmo.jpg', 20,
   '2x TX, 2x RX, 8x antena, 4x baterai LP-E6, case',
   '1080p60 SDI/HDMI, 350m LOS, <60ms latency', 'wireless', false),

  ('11111111-1111-4111-8111-000000000005', 'Teradek Bolt 4K LT 750',
   'Wireless Video', 900000, 1500000, true, true, false, '/products/bolt.jpg', 90,
   'TX, RX, 2x baterai, dual SDI/HDMI, case',
   '4K30 10-bit, 750ft LOS, uncompressed', 'wireless', false),

  ('11111111-1111-4111-8111-000000000006', 'ATEM Mini Pro ISO', 'Switcher & Live',
   250000, 400000, true, true, false, '/products/atem-mini.jpg', 25,
   'Adaptor, 4x HDMI, USB-C SSD 1TB',
   '4 input HDMI, ISO record, built-in streaming', 'switcher', false),

  ('11111111-1111-4111-8111-000000000007', 'ATEM Television Studio HD8 ISO',
   'Switcher & Live', 1100000, 1800000, true, false, false, '/products/atem-tv.jpg', 110,
   'Adaptor, 8x input, rack ear, 2x SSD',
   '8 input, 3G-SDI + HDMI, dual multiview', 'switcher', false)
on conflict (id) do update set
  name          = excluded.name,
  category      = excluded.category,
  price_12h     = excluded.price_12h,
  price_24h     = excluded.price_24h,
  active_12h    = excluded.active_12h,
  active_24h    = excluded.active_24h,
  best_seller   = excluded.best_seller,
  image_path    = excluded.image_path,
  reward_points = excluded.reward_points,
  accessories   = excluded.accessories,
  specs         = excluded.specs,
  art           = excluded.art,
  archived      = excluded.archived;

-- Two physical units per product, so booking capacity has something to enforce.
insert into product_serials (code, product_id, status)
select
  upper(substr(replace(p.name, ' ', ''), 1, 8)) || '-U' || n,
  p.id,
  'READY'
from products p
cross join generate_series(1, 2) as n
where p.id::text like '11111111-%'
on conflict (code) do nothing;

-- Bundles. The live schema prices both durations; `description` replaces `note`.
insert into bundles (id, name, price_12h, price_24h, description, archived)
values
  ('22222222-2222-4222-8222-000000000001', 'Paket Interview 2 Kamera',
   1600000, 1900000, 'Cocok untuk liputan dan wawancara studio', false),
  ('22222222-2222-4222-8222-000000000002', 'Paket Live Streaming',
   1200000, 1400000, 'Switcher + wireless video + kamera utama', false)
on conflict (id) do update set
  name        = excluded.name,
  price_12h   = excluded.price_12h,
  price_24h   = excluded.price_24h,
  description = excluded.description,
  archived    = excluded.archived;

insert into bundle_items (bundle_id, product_id, quantity)
values
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001', 2),
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000004', 1),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000002', 1),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000006', 1)
on conflict (bundle_id, product_id) do update set quantity = excluded.quantity;

-- Vouchers use (type, value, min_spend) in the live schema.
insert into vouchers (id, code, type, value, min_spend, active, expires_at)
values
  ('33333333-3333-4333-8333-000000000001', 'HEMAT100', 'fixed', 100000, 500000,
   true, now() + interval '90 days'),
  ('33333333-3333-4333-8333-000000000002', 'NEWCUSTOMER', 'fixed', 250000, 1000000,
   true, now() + interval '90 days'),
  ('33333333-3333-4333-8333-000000000003', 'VIP10', 'percent', 10, 0,
   true, now() + interval '90 days')
on conflict (id) do update set
  type      = excluded.type,
  value     = excluded.value,
  min_spend = excluded.min_spend,
  active    = excluded.active,
  expires_at = excluded.expires_at;
