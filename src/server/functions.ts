/**
 * Trusted write operations.
 *
 * Everything that decides money, approval state, or role lives here and runs on
 * the server only. Clients call these; they never write the tables directly
 * because RLS forbids it.
 *
 * Exported as plain async functions for now — the TanStack Start
 * `createServerFn` wrapper is added in src/server/functions.ts once the router
 * wiring is validated. Keeping the logic separate means it is unit-testable
 * without booting the framework.
 */

import { getServiceClient, getUserFromRequest } from "@/server/supabase";
import { createQrisPayment } from "@/server/paymenku";

// ---------------------------------------------------------------------------
// Checkout pricing — the single source of truth for totals.
// ---------------------------------------------------------------------------
export type CheckoutLineInput = {
  productId: string;
  duration: "12h" | "24h";
  quantity: number;
};

export type CheckoutInput = {
  startDate: string;
  endDate: string;
  lines: CheckoutLineInput[];
  voucherCode?: string;
  redeemPoints?: number;
  useDp?: boolean;
};

export type PricedLine = {
  productId: string;
  name: string;
  duration: "12h" | "24h";
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  rewardPoints: number;
};

export type PricedCheckout = {
  lines: PricedLine[];
  days: number;
  subtotal: number;
  pointsDiscount: number;
  voucherCode: string | null;
  voucherDiscount: number;
  vipDiscount: number;
  total: number;
  pointsRedeemed: number;
  pointsEarned: number;
  dpAmount: number;
  remainingAmount: number;
};

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

const DP_RATE = 0.3;

/**
 * Operational rates come from public.app_settings, not from constants.
 * The live schema deliberately makes these configurable by an admin
 * (vip_discount_percent, rupiah_per_poin, min_poin_tukar), so hardcoding them
 * here would silently diverge from what the admin UI shows.
 */
type PricingConfig = {
  vipDiscountRate: number;
  pointValueIdr: number;
  minPoinTukar: number;
  minRupiahReward: number;
  poinPerKelipatan: number;
};

const DEFAULT_CONFIG: PricingConfig = {
  vipDiscountRate: 0.15,
  pointValueIdr: 1000,
  minPoinTukar: 0,
  minRupiahReward: 0,
  poinPerKelipatan: 1,
};

async function loadPricingConfig(db: ReturnType<typeof getServiceClient>): Promise<PricingConfig> {
  const { data } = await db
    .from("app_settings")
    .select(
      "vip_discount_percent, rupiah_per_poin, min_poin_tukar, " +
        "min_rupiah_reward, poin_per_kelipatan",
    )
    .limit(1)
    .maybeSingle();

  if (!data) return DEFAULT_CONFIG;
  const row = data as unknown as Record<string, number | null>;

  return {
    vipDiscountRate: (row["vip_discount_percent"] ?? 15) / 100,
    pointValueIdr: row["rupiah_per_poin"] ?? 1000,
    minPoinTukar: row["min_poin_tukar"] ?? 0,
    minRupiahReward: row["min_rupiah_reward"] ?? 0,
    poinPerKelipatan: row["poin_per_kelipatan"] ?? 1,
  };
}

function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    throw new PricingError("invalid date");
  }
  const diff = Math.round((end.valueOf() - start.valueOf()) / 86_400_000);
  if (diff < 0) throw new PricingError("end date precedes start date");
  return diff + 1;
}

/**
 * Price a checkout from authoritative database rows.
 *
 * Prices are never accepted from the client — only product ids and quantities.
 * That is the whole point of doing this server-side.
 */
export async function priceCheckout(
  input: CheckoutInput,
  opts: { isVip: boolean; availablePoints: number },
): Promise<PricedCheckout> {
  if (!input.lines.length) throw new PricingError("cart is empty");

  const days = daysBetween(input.startDate, input.endDate);
  const db = getServiceClient();

  const ids = [...new Set(input.lines.map((l) => l.productId))];
  const { data: products, error } = await db
    .from("products")
    .select("id, name, price_12h, price_24h, active_12h, active_24h, reward_points")
    .in("id", ids);

  if (error) throw new PricingError(`catalog lookup failed: ${error.message}`);
  if (!products?.length) throw new PricingError("no matching products");

  type CatalogRow = {
    id: string;
    name: string;
    price_12h: number;
    price_24h: number;
    active_12h: boolean;
    active_24h: boolean;
    reward_points: number;
  };
  const rows = products as unknown as CatalogRow[];
  const byId = new Map(rows.map((p) => [p.id, p]));

  const lines: PricedLine[] = input.lines.map((line) => {
    const product = byId.get(line.productId);
    if (!product) throw new PricingError(`unknown product ${line.productId}`);
    if (line.quantity < 1) throw new PricingError("quantity must be at least 1");

    const is12h = line.duration === "12h";
    if (is12h ? !product.active_12h : !product.active_24h) {
      throw new PricingError(`${product.name} is not available for ${line.duration}`);
    }

    const unitPrice = is12h ? product.price_12h : product.price_24h;
    return {
      productId: product.id,
      name: product.name,
      duration: line.duration,
      unitPrice,
      quantity: line.quantity,
      lineTotal: unitPrice * line.quantity,
      rewardPoints: product.reward_points * line.quantity,
    };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  // Points redemption: capped by available balance and by the subtotal.
  const cfg = await loadPricingConfig(db);

  const requestedPoints = Math.max(0, Math.floor(input.redeemPoints ?? 0));
  const belowMinimum = requestedPoints > 0 && requestedPoints < cfg.minPoinTukar;
  const redeemablePoints = belowMinimum ? 0 : Math.min(requestedPoints, opts.availablePoints);
  const pointsDiscount = Math.min(redeemablePoints * cfg.pointValueIdr, subtotal);

  // Voucher applies after points, only to what remains.
  let voucherDiscount = 0;
  let voucherCode: string | null = null;
  if (input.voucherCode) {
    const { data: voucher } = await db
      .from("vouchers")
      .select("code, type, value, min_spend, active, expires_at")
      .eq("code", input.voucherCode)
      .maybeSingle();

    const row = voucher as unknown as {
      code: string;
      type: string;
      value: number;
      min_spend: number | null;
      active: boolean;
      expires_at: string | null;
    } | null;

    const usable = row && row.active && (!row.expires_at || new Date(row.expires_at) > new Date());

    if (!usable) throw new PricingError("voucher is not valid");

    const base = subtotal - pointsDiscount;
    const minSpend = row.min_spend ?? 0;
    if (base < minSpend) {
      throw new PricingError(`voucher requires a minimum spend of ${minSpend}`);
    }

    // The live schema stores discounts as (type, value); handle both shapes
    // instead of assuming a flat nominal amount.
    const raw = row.type === "percent" ? Math.round((base * row.value) / 100) : row.value;
    voucherCode = row.code;
    voucherDiscount = Math.min(raw, base);
  }

  const afterPointsAndVoucher = subtotal - pointsDiscount - voucherDiscount;
  const vipDiscount = opts.isVip ? Math.round(afterPointsAndVoucher * cfg.vipDiscountRate) : 0;

  const total = afterPointsAndVoucher - vipDiscount;
  if (total < 0) throw new PricingError("discount exceeds subtotal");

  const dpAmount = input.useDp ? Math.round(total * DP_RATE) : total;
  const remainingAmount = total - dpAmount;

  // Points are earned on money actually spent, not on redeemed value.
  const pointsEarned = Math.round(lines.reduce((sum, l) => sum + l.rewardPoints, 0));

  return {
    lines,
    days,
    subtotal,
    pointsDiscount,
    voucherCode,
    voucherDiscount,
    vipDiscount,
    total,
    pointsRedeemed: cfg.pointValueIdr > 0 ? pointsDiscount / cfg.pointValueIdr : 0,
    pointsEarned,
    dpAmount,
    remainingAmount,
  };
}

// ---------------------------------------------------------------------------
// Transaction creation
// ---------------------------------------------------------------------------
function generateCode(): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SP-${stamp}-${rand}`;
}

export async function createTransaction(
  request: Request,
  input: CheckoutInput,
): Promise<{ transactionId: string; code: string; total: number }> {
  const auth = await getUserFromRequest(request);
  if (!auth) throw new PricingError("not authenticated");

  const db = getServiceClient();

  const { data: profile } = await db
    .from("profiles")
    .select("name, phone, is_vip, points, kyc_status")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile) throw new PricingError("profile not found");
  if (profile.kyc_status !== "verified") {
    throw new PricingError("KYC must be verified before booking");
  }

  const priced = await priceCheckout(input, {
    isVip: profile.is_vip,
    availablePoints: profile.points,
  });

  const code = generateCode();

  const { data: txn, error: txnError } = await db
    .from("transactions")
    .insert({
      code,
      customer_id: auth.user.id,
      customer_name: profile.name,
      customer_phone: profile.phone ?? "",
      start_date: input.startDate,
      end_date: input.endDate,
      subtotal: priced.subtotal,
      points_discount: priced.pointsDiscount,
      voucher_code: priced.voucherCode,
      voucher_discount: priced.voucherDiscount,
      vip_discount: priced.vipDiscount,
      total: priced.total,
      points_redeemed: priced.pointsRedeemed,
      points_earned: priced.pointsEarned,
      dp_amount: priced.dpAmount,
      remaining_amount: priced.remainingAmount,
      status: "Menunggu Pembayaran",
    })
    .select("id, code, total")
    .single();

  if (txnError || !txn) {
    throw new PricingError(`transaction insert failed: ${txnError?.message ?? "unknown"}`);
  }

  const { error: linesError } = await db.from("transaction_lines").insert(
    priced.lines.map((l) => ({
      transaction_id: txn.id,
      product_id: l.productId,
      name: l.name,
      duration: l.duration,
      price: l.unitPrice,
      quantity: l.quantity,
      reward_points: l.rewardPoints,
    })),
  );
  if (linesError) throw new PricingError(`line insert failed: ${linesError.message}`);

  // Reserve the booking range so the availability calendar reflects it.
  await db.from("bookings").insert(
    priced.lines.map((l) => ({
      product_id: l.productId,
      start_date: input.startDate,
      end_date: input.endDate,
      quantity: l.quantity,
    })),
  );

  return { transactionId: txn.id, code: txn.code, total: txn.total };
}

// ---------------------------------------------------------------------------
// Payment initiation
// ---------------------------------------------------------------------------
export async function startQrisPayment(
  request: Request,
  args: { transactionId: string; stage: "dp" | "pelunasan" },
): Promise<{ paymentId: string; trxId: string; qrUrl: string | null }> {
  const auth = await getUserFromRequest(request);
  if (!auth) throw new PricingError("not authenticated");

  const db = getServiceClient();

  const { data: txn, error } = await db
    .from("transactions")
    .select("id, code, customer_id, total, dp_amount, remaining_amount, status")
    .eq("id", args.transactionId)
    .maybeSingle();

  if (error || !txn) throw new PricingError("transaction not found");
  if (txn.customer_id !== auth.user.id) throw new PricingError("not your transaction");

  const amount = args.stage === "dp" ? txn.dp_amount : txn.remaining_amount;
  if (amount <= 0) throw new PricingError(`nothing to pay for ${args.stage}`);

  // Idempotent: reuse an outstanding unpaid payment for the same stage.
  const { data: existing } = await db
    .from("payments")
    .select("id, paymenku_trx_id, qr_url, status")
    .eq("transaction_id", txn.id)
    .eq("stage", args.stage)
    .eq("status", "Menunggu")
    .maybeSingle();

  if (existing?.qr_url) {
    return {
      paymentId: existing.id,
      trxId: existing.paymenku_trx_id ?? "",
      qrUrl: existing.qr_url,
    };
  }

  const { data: profile } = await db
    .from("profiles")
    .select("name")
    .eq("id", auth.user.id)
    .maybeSingle();

  const appUrl = process.env["APP_URL"] ?? "https://smartpro-web.projecthasan.com";

  const result = await createQrisPayment({
    amount,
    referenceId: `${txn.code}-${args.stage}`,
    customerName: profile?.name ?? "SMartPro Customer",
    customerEmail: auth.user.email ?? "noreply@smartpro.local",
    returnUrl: `${appUrl}/?payment=return&txn=${txn.id}`,
  });

  if (!result.ok) throw new PricingError(`Paymenku: ${result.error}`);

  const { data: payment, error: payError } = await db
    .from("payments")
    .insert({
      transaction_id: txn.id,
      stage: args.stage,
      method: "qris",
      amount,
      status: "menunggu",
      paymenku_trx_id: result.trxId,
      paymenku_reference: `${txn.code}-${args.stage}`,
      qr_url: result.qrUrl,
      payment_url: result.paymentUrl,
      expires_at: result.expiresAt,
    })
    .select("id")
    .single();

  if (payError || !payment) {
    throw new PricingError(`payment insert failed: ${payError?.message ?? "unknown"}`);
  }

  return { paymentId: payment.id, trxId: result.trxId, qrUrl: result.qrUrl };
}

// ---------------------------------------------------------------------------
// Webhook processing
// ---------------------------------------------------------------------------
export type WebhookOutcome =
  { ok: true; applied: boolean; reason: string } | { ok: false; reason: string };

const PAID_STATUSES = new Set(["paid", "success", "settlement", "settled"]);

/**
 * Apply a verified Paymenku webhook.
 *
 * Idempotent via payment_events unique(trx_id, event_type, status): a repeated
 * delivery is recorded as duplicate and performs no state change.
 */
export async function applyPaymentWebhook(payload: {
  event?: string;
  trx_id?: string;
  status?: string;
  amount?: number;
  paid_at?: string;
  reference_id?: string;
}): Promise<WebhookOutcome> {
  const trxId = payload.trx_id;
  const status = (payload.status ?? "").toLowerCase();
  const event = payload.event ?? "unknown";

  if (!trxId) return { ok: false, reason: "missing trx_id" };
  if (event !== "payment.status_updated") {
    return { ok: true, applied: false, reason: `ignored event ${event}` };
  }

  const db = getServiceClient();

  // Idempotency gate. Insert first; a conflict means we already handled it.
  const { error: dupError } = await db.from("payment_events").insert({
    paymenku_trx_id: trxId,
    event_type: event,
    status,
    payload,
  });

  if (dupError) {
    if (dupError.code === "23505") {
      return { ok: true, applied: false, reason: "duplicate delivery" };
    }
    return { ok: false, reason: `event log failed: ${dupError.message}` };
  }

  const { data: payment } = await db
    .from("payments")
    .select("id, transaction_id, stage, amount, status")
    .eq("paymenku_trx_id", trxId)
    .maybeSingle();

  if (!payment) return { ok: false, reason: `unknown trx_id ${trxId}` };

  if (!PAID_STATUSES.has(status)) {
    return { ok: true, applied: false, reason: `status ${status} is not terminal-paid` };
  }

  if (payment.status === "Disetujui") {
    return { ok: true, applied: false, reason: "already approved" };
  }

  // Mark the payment settled.
  const { error: payError } = await db
    .from("payments")
    .update({ status: "Disetujui", paid_at: payload.paid_at ?? new Date().toISOString() })
    .eq("id", payment.id);
  if (payError) return { ok: false, reason: `payment update failed: ${payError.message}` };

  // Advance the transaction.
  const { data: txn } = await db
    .from("transactions")
    .select("id, status, points_earned, points_redeemed, customer_id")
    .eq("id", payment.transaction_id)
    .maybeSingle();

  if (txn) {
    const nextStatus = payment.stage === "dp" ? "DP Terbayar" : "Lunas";
    await db.from("transactions").update({ status: nextStatus }).eq("id", txn.id);

    // Points: award earned, deduct redeemed. Only once, on final settlement.
    if (payment.stage === "pelunasan") {
      const net = txn.points_earned - txn.points_redeemed;
      if (net !== 0) {
        const { data: profile } = await db
          .from("profiles")
          .select("points")
          .eq("id", txn.customer_id)
          .maybeSingle();
        const current = profile?.points ?? 0;
        await db
          .from("profiles")
          .update({ points: Math.max(0, current + net) })
          .eq("id", txn.customer_id);
      }
    }
  }

  return { ok: true, applied: true, reason: `transaction advanced to ${payment.stage}` };
}

// ---------------------------------------------------------------------------
// Admin approvals
// ---------------------------------------------------------------------------
export async function approveKyc(
  request: Request,
  args: { userId: string; decision: "Disetujui" | "Ditolak"; note?: string },
): Promise<void> {
  const auth = await getUserFromRequest(request);
  if (!auth) throw new PricingError("not authenticated");

  const db = getServiceClient();
  const { data: admin } = await db
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (admin?.role !== "admin") throw new PricingError("admin only");

  const kycStatus = args.decision === "Disetujui" ? "Verified" : "Ditolak";

  const { error } = await db
    .from("profiles")
    .update({ kyc_status: kycStatus, kyc_note: args.note ?? null })
    .eq("id", args.userId);
  if (error) throw new PricingError(`kyc update failed: ${error.message}`);

  await db
    .from("kyc_submissions")
    .update({
      status: kycStatus,
      reviewed_by: auth.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("user_id", args.userId)
    .eq("status", "Menunggu");
}
