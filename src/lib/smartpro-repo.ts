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
 * Data access layer. Every read and write the UI performs goes through here.
 *
 * Design rules:
 *   - No component talks to Supabase directly; they call these functions.
 *   - Row shapes come from Postgres snake_case; mapping to the app's camelCase
 *     domain types happens in this file so the UI types stay unchanged.
 *   - Writes that change money, totals or approval state are NOT here. They live
 *     in server functions (src/server/functions) because RLS forbids them for
 *     end users by design.
 */

// ---------------------------------------------------------------------------
// Row shapes as returned by Postgres
// ---------------------------------------------------------------------------
type ProductRow = {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory | string;
  price_12h: number;
  price_24h: number;
  active_12h: boolean;
  active_24h: boolean;
  best_seller: boolean;
  image_url: string | null;
  reward_points: number;
  accessories: string;
  specs: string;
  art: string;
  product_units?: Array<{ serial: string; status: "ready" | "maintenance" }>;
  bookings?: Array<{ start_date: string; end_date: string; quantity: number }>;
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

type PaymentRow = {
  id: string;
  transaction_id: string;
  stage: string;
  method: PaymentRecord["method"];
  amount: number;
  unique_code: number;
  proof_path: string | null;
  status: string;
  note: string | null;
  created_at: string;
  qr_url: string | null;
  expires_at: string | null;
};

type ReturnRow = {
  id: string;
  transaction_id: string;
  reason: string;
  status: string;
  note: string | null;
  created_at: string;
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
  created_at: string;
  transaction_lines?: Array<{
    id: string;
    name: string;
    duration: "12h" | "24h";
    price: number;
    quantity: number;
    reward_points: number;
  }>;
};

// ---------------------------------------------------------------------------
// Enum translation (Postgres lowercase -> app Title Case)
// ---------------------------------------------------------------------------
const KYC_TO_DB: Record<KycStatus, string> = {
  Belum: "belum",
  Menunggu: "menunggu",
  Verified: "verified",
  Ditolak: "ditolak",
};

const KYC_FROM_DB: Record<string, KycStatus> = {
  belum: "Belum",
  menunggu: "Menunggu",
  verified: "Verified",
  ditolak: "Ditolak",
};

const TXN_STATUS_FROM_DB: Record<string, Transaction["status"]> = {
  menunggu_pembayaran: "Menunggu Pembayaran",
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

const APPROVAL_FROM_DB: Record<string, ApprovalStatus> = {
  menunggu: "Menunggu",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
};

const CATEGORY_FROM_DB: Record<string, ProductCategory> = {
  kamera: "Kamera",
  wireless_video: "Wireless Video",
  switcher_live: "Switcher & Live",
};

export const CATEGORY_TO_DB: Record<ProductCategory, string> = {
  Kamera: "kamera",
  "Wireless Video": "wireless_video",
  "Switcher & Live": "switcher_live",
};

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------
export function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: CATEGORY_FROM_DB[row.category] ?? "Kamera",
    price12h: row.price_12h,
    price24h: row.price_24h,
    active12h: row.active_12h,
    active24h: row.active_24h,
    bestSeller: row.best_seller,
    imageUrl: row.image_url,
    rewardPoints: row.reward_points,
    accessories: row.accessories,
    specs: row.specs,
    art: (row.art as Product["art"]) ?? "camera",
    serials: (row.product_units ?? []).map((u) => ({
      code: u.serial,
      status: u.status === "ready" ? "READY" : "MAINTENANCE",
    })),
    bookings: (row.bookings ?? []).map((b) => ({
      start: b.start_date,
      end: b.end_date,
      quantity: b.quantity,
    })),
  };
}

export function mapProfileToUser(row: ProfileRow, email?: string): User {
  return {
    id: row.id,
    username: row.username,
    // The password column no longer exists in the database. The UI renders the
    // demo credential hints from smartpro-store; this field is always empty for
    // real accounts and never used for authentication.
    password: "",
    name: row.name,
    role: row.role,
    phone: row.phone ?? "",
    kycStatus: KYC_FROM_DB[row.kyc_status] ?? "Belum",
    kyc: null,
    points: row.points,
    isVip: row.is_vip,
    wishlist: [],
    kycNote: row.kyc_note ?? undefined,
    ...(email ? { email } : {}),
  } as User;
}

export function mapTransaction(row: TxnRow): Transaction {
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
    voucherCode: row.voucher_code ?? undefined,
    voucherDiscount: row.voucher_discount,
    vipDiscount: row.vip_discount,
    total: row.total,
    pointsRedeemed: row.points_redeemed,
    pointsEarned: row.points_earned,
    dpAmount: row.dp_amount,
    remainingAmount: row.remaining_amount,
    status: TXN_STATUS_FROM_DB[row.status] ?? "Menunggu Pembayaran",
    pickupStatus: PICKUP_FROM_DB[row.pickup_status] ?? "Belum",
    method: "qris",
    uniqueCode: 0,
    createdAt: row.created_at,
    lines: (row.transaction_lines ?? []).map((l) => ({
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
const PRODUCT_SELECT = `*,
  product_units(serial, status),
  bookings(start_date, end_date, quantity)`;

export async function fetchProducts(client: SupabaseClient): Promise<Product[]> {
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_SELECT)
    .order("best_seller", { ascending: false })
    .order("name");

  if (error) throw new Error(`fetchProducts: ${error.message}`);
  return (data as ProductRow[]).map(mapProduct);
}

export async function fetchBundles(client: SupabaseClient): Promise<Bundle[]> {
  const { data, error } = await client.from("bundles").select("*").order("name");
  if (error) throw new Error(`fetchBundles: ${error.message}`);

  const rows = data as unknown as Array<{
    id: string;
    name: string;
    price: number;
    regular_price: number;
    note: string;
    bundle_items?: Array<{ product_id: string; quantity: number }>;
  }>;

  // bundle_items is a separate query to keep the select shallow.
  const withItems = await Promise.all(
    rows.map(async (b) => {
      const { data: items } = await client
        .from("bundle_items")
        .select("product_id, quantity")
        .eq("bundle_id", b.id);
      return {
        id: b.id,
        name: b.name,
        price: b.price,
        regularPrice: b.regular_price,
        note: b.note,
        includes: ((items ?? []) as Array<{ product_id: string; quantity: number }>).map((i) => ({
          productId: i.product_id,
          quantity: i.quantity,
        })),
      } satisfies Bundle;
    }),
  );

  return withItems;
}

export async function fetchVouchers(client: SupabaseClient): Promise<Voucher[]> {
  const { data, error } = await client
    .from("vouchers")
    .select("id, code, discount, active")
    .order("code");
  if (error) throw new Error(`fetchVouchers: ${error.message}`);

  return (
    (data ?? []) as Array<{ id: string; code: string; discount: number; active: boolean }>
  ).map((v) => ({
    id: v.id,
    code: v.code,
    discount: v.discount,
    active: v.active,
  })) as unknown as Voucher[];
}

// ---------------------------------------------------------------------------
// Profile / auth-adjacent reads
// ---------------------------------------------------------------------------
export async function fetchProfile(client: SupabaseClient, userId: string): Promise<User | null> {
  const { data, error } = await client
    .from("profiles")
    .select("id, username, name, role, phone, kyc_status, kyc_note, points, is_vip")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`fetchProfile: ${error.message}`);
  if (!data) return null;
  return mapProfileToUser(data as ProfileRow);
}

export async function fetchWishlist(client: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await client.from("wishlists").select("product_id").eq("user_id", userId);
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
    .upsert({ user_id: userId, product_id: productId }, { onConflict: "user_id,product_id" });
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
// Transactions / payments (reads only — writes are server functions)
// ---------------------------------------------------------------------------
const TXN_SELECT = `*,
  transaction_lines(id, name, duration, price, quantity, reward_points)`;

export async function fetchTransactions(
  client: SupabaseClient,
  userId?: string,
): Promise<Transaction[]> {
  let query = client.from("transactions").select(TXN_SELECT).order("created_at", {
    ascending: false,
  });
  if (userId) query = query.eq("customer_id", userId);

  const { data, error } = await query;
  if (error) throw new Error(`fetchTransactions: ${error.message}`);
  return (data as unknown as TxnRow[]).map(mapTransaction);
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
    method: p.method,
    amount: p.amount,
    uniqueCode: p.unique_code,
    proofUrl: p.proof_path,
    status: APPROVAL_FROM_DB[p.status] ?? "Menunggu",
    note: p.note ?? undefined,
    createdAt: p.created_at,
    // Extra fields the QRIS UI needs; typed as unknown on PaymentRecord.
    qrUrl: p.qr_url ?? null,
    expiresAt: p.expires_at ?? null,
  })) as unknown as PaymentRecord[];
}

export async function fetchReturnRequests(client: SupabaseClient): Promise<ReturnRequest[]> {
  const { data, error } = await client
    .from("return_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`fetchReturnRequests: ${error.message}`);

  return ((data ?? []) as unknown as ReturnRow[]).map((r) => ({
    id: r.id,
    transactionId: r.transaction_id,
    reason: r.reason,
    status: APPROVAL_FROM_DB[r.status] ?? "Menunggu",
    note: r.note ?? undefined,
    createdAt: r.created_at,
  })) as unknown as ReturnRequest[];
}

export { KYC_TO_DB, KYC_FROM_DB, APPROVAL_FROM_DB, TXN_STATUS_FROM_DB, PICKUP_FROM_DB };
