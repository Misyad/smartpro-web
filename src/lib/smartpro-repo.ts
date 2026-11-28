import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ApprovalStatus,
  Bundle,
  KycStatus,
  PaymentRecord,
  Product,
  ProductCategory,
  ReturnRequest,
  Transaction,
  User,
  Voucher,
} from "@/lib/smartpro-data";

/**
 * Data access layer.
 *
 * IMPORTANT: this maps onto the schema that already exists in the Supabase
 * project, not the one drafted in supabase/migrations/0001_init.sql. Those
 * migrations describe a parallel design; the live schema is richer (app_settings,
 * persisted cart_lines, return_photos, schedule_entries, configurable point and
 * overtime rates) and is the one the product actually needs.
 *
 * Column differences from the draft schema, handled here:
 *   products.image_path        (not image_url); no slug column
 *   products.archived          soft-delete flag, filtered out of reads
 *   bundles.price_12h / price_24h  (not a single price)
 *   vouchers.type / value / min_spend  (not a flat discount)
 *   return_requests.target, next_customer, overtime_hours, overtime_fee  (no reason)
 *   payments gained the paymenku_* columns via migration 0004
 *
 * Writes that change money, approval state or roles are NOT here; they live in
 * src/server/functions.ts because RLS forbids them for end users.
 */

// ---------------------------------------------------------------------------
// Row shapes, straight from the live schema
// ---------------------------------------------------------------------------
type ProductRow = {
  id: string;
  name: string | null;
  category: string | null;
  price_12h: number | null;
  price_24h: number | null;
  active_12h: boolean | null;
  active_24h: boolean | null;
  best_seller: boolean | null;
  image_path: string | null;
  reward_points: number | null;
  accessories: string | null;
  specs: string | null;
  art: string | null;
  archived: boolean | null;
};

type SerialRow = { code: string; product_id: string; status: string };
type BookingRow = {
  product_id: string;
  start_date: string;
  end_date: string;
  quantity: number;
};

type ProfileRow = {
  id: string;
  username: string;
  name: string;
  role: "admin" | "pelanggan";
  phone: string | null;
  kyc_status: string;
  kyc_note: string | null;
  points: number;
  is_vip: boolean;
};

type TxnRow = {
  id: string;
  code: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  start_date: string;
  end_date: string;
  subtotal: number;
  points_discount: number;
  voucher_code: string | null;
  voucher_discount: number;
  vip_discount: number;
  total: number;
  points_redeemed: number;
  points_earned: number;
  dp_amount: number;
  remaining_amount: number;
  status: string;
  pickup_status: string;
  method: string | null;
  unique_code: number | null;
  created_at: string;
};

type TxnLineRow = {
  id: string;
  transaction_id: string;
  name: string;
  duration: "12h" | "24h";
  price: number;
  quantity: number;
  reward_points: number;
};

type PaymentRow = {
  id: string;
  transaction_id: string;
  stage: string;
  method: string;
  amount: number;
  unique_code: number | null;
  proof_path: string | null;
  status: string;
  note: string | null;
  created_at: string;
  paymenku_trx_id: string | null;
  qr_url: string | null;
  payment_url: string | null;
  expires_at: string | null;
};

type ReturnRow = {
  id: string;
  transaction_id: string;
  target: string | null;
  next_customer: string | null;
  overtime_hours: number | null;
  overtime_fee: number | null;
  status: string;
  created_at: string;
};

type BundleRow = {
  id: string;
  name: string;
  price_12h: number | null;
  price_24h: number | null;
  description: string | null;
  archived: boolean | null;
};

type VoucherRow = {
  id: string;
  code: string;
  type: string;
  value: number;
  min_spend: number | null;
  active: boolean;
  expires_at: string | null;
};

// ---------------------------------------------------------------------------
// Enum translation (Postgres -> app Title Case)
// ---------------------------------------------------------------------------
export const KYC_FROM_DB: Record<string, KycStatus> = {
  belum: "Belum",
  menunggu: "Menunggu",
  verified: "Verified",
  ditolak: "Ditolak",
};

export const KYC_TO_DB: Record<KycStatus, string> = {
  Belum: "belum",
  Menunggu: "menunggu",
  Verified: "verified",
  Ditolak: "ditolak",
};

const TXN_STATUS_FROM_DB: Record<string, Transaction["status"]> = {
  menunggu_pembayaran: "Menunggu Pembayaran",
  menunggu: "Menunggu Pembayaran",
  dp_terbayar: "DP Terbayar",
  lunas: "Lunas",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
};

const PICKUP_FROM_DB: Record<string, Transaction["pickupStatus"]> = {
  belum: "Belum",
  diambil: "Diambil",
  dikembalikan: "Dikembalikan",
};

export const APPROVAL_FROM_DB: Record<string, ApprovalStatus> = {
  menunggu: "Menunggu",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
};

const CATEGORY_FROM_DB: Record<string, ProductCategory> = {
  kamera: "Kamera",
  wireless_video: "Wireless Video",
  switcher_live: "Switcher & Live",
  // the live schema may store the display form already
  Kamera: "Kamera",
  "Wireless Video": "Wireless Video",
  "Switcher & Live": "Switcher & Live",
};

export const CATEGORY_TO_DB: Record<ProductCategory, string> = {
  Kamera: "kamera",
  "Wireless Video": "wireless_video",
  "Switcher & Live": "switcher_live",
};

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------
export function mapProduct(
  row: ProductRow,
  serials: SerialRow[] = [],
  bookings: BookingRow[] = [],
): Product {
  return {
    id: row.id,
    name: row.name ?? "-",
    category: CATEGORY_FROM_DB[row.category ?? ""] ?? "Kamera",
    price12h: row.price_12h ?? 0,
    price24h: row.price_24h ?? 0,
    active12h: row.active_12h ?? false,
    active24h: row.active_24h ?? false,
    bestSeller: row.best_seller ?? false,
    imageUrl: row.image_path ?? null,
    rewardPoints: row.reward_points ?? 0,
    accessories: row.accessories ?? "",
    specs: row.specs ?? "",
    art: (row.art as Product["art"]) ?? "camera",
    serials: serials
      .filter((s) => s.product_id === row.id)
      .map((s) => ({
        code: s.code,
        status: s.status === "ready" ? "READY" : "MAINTENANCE",
      })),
    bookings: bookings
      .filter((b) => b.product_id === row.id)
      .map((b) => ({ start: b.start_date, end: b.end_date, quantity: b.quantity })),
  };
}

export function mapProfileToUser(row: ProfileRow, email?: string): User {
  return {
    id: row.id,
    username: row.username,
    // The database never stores a password (Supabase Auth owns credentials),
    // so this field is always empty for real accounts.
    password: "",
    name: row.name,
    role: row.role,
    phone: row.phone ?? "",
    kycStatus: KYC_FROM_DB[row.kyc_status] ?? "Belum",
    kyc: null,
    points: row.points ?? 0,
    isVip: Boolean(row.is_vip),
    wishlist: [],
    ...(row.kyc_note ? { kycNote: row.kyc_note } : {}),
    ...(email ? { email } : {}),
  } as User;
}

export function mapTransaction(row: TxnRow, lines: TxnLineRow[]): Transaction {
  return {
    id: row.id,
    code: row.code,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    startDate: row.start_date,
    endDate: row.end_date,
    subtotal: row.subtotal,
    pointsDiscount: row.points_discount,
    ...(row.voucher_code ? { voucherCode: row.voucher_code } : {}),
    voucherDiscount: row.voucher_discount,
    vipDiscount: row.vip_discount,
    total: row.total,
    pointsRedeemed: row.points_redeemed,
    pointsEarned: row.points_earned,
    dpAmount: row.dp_amount,
    remainingAmount: row.remaining_amount,
    status: TXN_STATUS_FROM_DB[row.status] ?? "Menunggu Pembayaran",
    pickupStatus: PICKUP_FROM_DB[row.pickup_status] ?? "Belum",
    method:
      row.method === "cash" || row.method === "qris" || row.method === "transfer"
        ? row.method
        : "transfer",
    uniqueCode: row.unique_code ?? 0,
    createdAt: row.created_at,
    lines: lines
      .filter((l) => l.transaction_id === row.id)
      .map((l) => ({
        key: l.id,
        name: l.name,
        duration: l.duration,
        price: l.price,
        quantity: l.quantity,
        rewardPoints: l.reward_points,
      })),
  } as unknown as Transaction;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
export async function fetchProducts(client: SupabaseClient): Promise<Product[]> {
  const { data: products, error } = await client
    .from("products")
    .select(
      "id, name, category, price_12h, price_24h, active_12h, active_24h, " +
        "best_seller, image_path, reward_points, accessories, specs, art, archived",
    )
    .eq("archived", false)
    .order("best_seller", { ascending: false })
    .order("name");

  if (error) throw new Error(`fetchProducts: ${error.message}`);

  // Serials and bookings are separate tables in the live schema.
  const [{ data: serials }, { data: bookings }] = await Promise.all([
    client.from("product_serials").select("code, product_id, status"),
    client.from("product_bookings").select("product_id, start_date, end_date, quantity"),
  ]);

  return ((products ?? []) as unknown as ProductRow[]).map((p) =>
    mapProduct(
      p,
      (serials ?? []) as SerialRow[],
      (bookings ?? []) as BookingRow[],
    ),
  );
}

export async function fetchBundles(client: SupabaseClient): Promise<Bundle[]> {
  const [{ data: bundles, error }, { data: items }] = await Promise.all([
    client
      .from("bundles")
      .select("id, name, price_12h, price_24h, description, archived")
      .eq("archived", false),
    client.from("bundle_items").select("bundle_id, product_id, quantity"),
  ]);

  if (error) throw new Error(`fetchBundles: ${error.message}`);

  const itemRows = (items ?? []) as unknown as Array<{
    bundle_id: string;
    product_id: string;
    quantity: number;
  }>;

  return ((bundles ?? []) as BundleRow[]).map((b) => ({
    id: b.id,
    name: b.name,
    // The UI uses `price` as the headline 24h figure and `regularPrice` as the
    // undiscounted reference. The live schema stores both durations.
    price: b.price_24h ?? b.price_12h ?? 0,
    regularPrice: b.price_24h ?? b.price_12h ?? 0,
    note: b.description ?? "",
    includes: itemRows
      .filter((i) => i.bundle_id === b.id)
      .map((i) => ({ productId: i.product_id, quantity: i.quantity })),
  })) as unknown as Bundle[];
}

export async function fetchVouchers(client: SupabaseClient): Promise<Voucher[]> {
  const { data, error } = await client
    .from("vouchers")
    .select("id, code, type, value, min_spend, active, expires_at")
    .order("code");

  if (error) throw new Error(`fetchVouchers: ${error.message}`);

  // The live schema models discounts as (type, value) rather than a flat
  // amount. `nominal` maps to the app's discount field directly; `percent` is
  // resolved later against the subtotal during checkout.
  return ((data ?? []) as VoucherRow[]).map((v) => ({
    id: v.id,
    code: v.code,
    discount: v.type === "nominal" ? v.value : 0,
    active: v.active,
    ...(v.expires_at ? { expiresAt: v.expires_at } : {}),
    voucherType: v.type,
    voucherValue: v.value,
    minSpend: v.min_spend ?? 0,
  })) as unknown as Voucher[];
}

// ---------------------------------------------------------------------------
// Profile / wishlist
// ---------------------------------------------------------------------------
export async function fetchProfile(
  client: SupabaseClient,
  userId: string,
): Promise<User | null> {
  const { data, error } = await client
    .from("profiles")
    .select("id, username, name, role, phone, kyc_status, kyc_note, points, is_vip")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`fetchProfile: ${error.message}`);
  if (!data) return null;
  return mapProfileToUser(data as ProfileRow);
}

export async function fetchWishlist(
  client: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("wishlists")
    .select("product_id")
    .eq("user_id", userId);
  if (error) return [];
  return ((data ?? []) as Array<{ product_id: string }>).map((w) => w.product_id);
}

export async function addWishlist(
  client: SupabaseClient,
  userId: string,
  productId: string,
): Promise<void> {
  const { error } = await client
    .from("wishlists")
    .upsert(
      { user_id: userId, product_id: productId },
      { onConflict: "user_id,product_id" },
    );
  if (error) throw new Error(`addWishlist: ${error.message}`);
}

export async function removeWishlist(
  client: SupabaseClient,
  userId: string,
  productId: string,
): Promise<void> {
  const { error } = await client
    .from("wishlists")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);
  if (error) throw new Error(`removeWishlist: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Transactions / payments (reads only)
// ---------------------------------------------------------------------------
export async function fetchTransactions(
  client: SupabaseClient,
  userId?: string,
): Promise<Transaction[]> {
  let query = client
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false });
  if (userId) query = query.eq("customer_id", userId);

  const { data, error } = await query;
  if (error) throw new Error(`fetchTransactions: ${error.message}`);

  const txns = (data ?? []) as unknown as TxnRow[];
  if (!txns.length) return [];

  const { data: lines } = await client
    .from("transaction_lines")
    .select("id, transaction_id, name, duration, price, quantity, reward_points")
    .in("transaction_id", txns.map((t) => t.id));

  return txns.map((t) => mapTransaction(t, (lines ?? []) as unknown as TxnLineRow[]));
}

export async function fetchPaymentsForTransaction(
  client: SupabaseClient,
  transactionId: string,
): Promise<PaymentRecord[]> {
  const { data, error } = await client
    .from("payments")
    .select("*")
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`fetchPayments: ${error.message}`);

  return ((data ?? []) as unknown as PaymentRow[]).map((p) => ({
    id: p.id,
    transactionId: p.transaction_id,
    stage: p.stage === "dp" ? "DP" : "Pelunasan",
    method: p.method as PaymentRecord["method"],
    amount: p.amount,
    uniqueCode: p.unique_code ?? 0,
    proofUrl: p.proof_path,
    status: APPROVAL_FROM_DB[p.status] ?? "Menunggu",
    ...(p.note ? { note: p.note } : {}),
    createdAt: p.created_at,
    qrUrl: p.qr_url,
    paymentUrl: p.payment_url,
    expiresAt: p.expires_at,
  })) as unknown as PaymentRecord[];
}

export async function fetchReturnRequests(
  client: SupabaseClient,
): Promise<ReturnRequest[]> {
  const { data, error } = await client
    .from("return_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`fetchReturnRequests: ${error.message}`);

  // The live schema has no `reason` column; it records the return target and
  // overtime charges instead, which is what the admin UI actually displays.
  return ((data ?? []) as unknown as ReturnRow[]).map((r) => ({
    id: r.id,
    transactionId: r.transaction_id,
    reason: r.target ?? "",
    status: APPROVAL_FROM_DB[r.status] ?? "Menunggu",
    ...(r.next_customer ? { note: r.next_customer } : {}),
    createdAt: r.created_at,
    overtimeHours: r.overtime_hours ?? 0,
    overtimeFee: r.overtime_fee ?? 0,
  })) as unknown as ReturnRequest[];
}

// ---------------------------------------------------------------------------
// Settings — the live schema keeps operational rates in app_settings rather
// than hardcoding them, which is strictly better than the draft's constants.
// ---------------------------------------------------------------------------
export type AppSettings = {
  minRupiahReward: number;
  poinPerKelipatan: number;
  minPoinTukar: number;
  rupiahPerPoin: number;
  overtimeFee12h: number;
  whatsappAdmin: string;
  vipDiscountPercent: number;
  waTemplates: Record<string, string>;
};

export async function fetchSettings(client: SupabaseClient): Promise<AppSettings | null> {
  const { data, error } = await client.from("app_settings").select("*").limit(1).maybeSingle();
  if (error || !data) return null;

  return {
    minRupiahReward: data.min_rupiah_reward ?? 0,
    poinPerKelipatan: data.poin_per_kelipatan ?? 1,
    minPoinTukar: data.min_poin_tukar ?? 0,
    rupiahPerPoin: data.rupiah_per_poin ?? 1,
    overtimeFee12h: data.overtime_fee_12h ?? 0,
    whatsappAdmin: data.whatsapp_admin ?? "",
    vipDiscountPercent: data.vip_discount_percent ?? 0,
    waTemplates: {
      booking: data.wa_template_booking ?? "",
      dp: data.wa_template_dp ?? "",
      lunas: data.wa_template_lunas ?? "",
      reminder: data.wa_template_reminder ?? "",
      extend: data.wa_template_extend ?? "",
    },
  };
}
