import { getServiceClient, getUserFromRequest } from "@/server/supabase";
import { priceCheckout, type CheckoutInput, type PricedCheckout } from "@/server/functions";

/**
 * Manual (bank transfer) checkout with admin approval.
 *
 * This is the deliberately conservative payment path: no gateway, no webhook,
 * no automatic settlement. A human decides. That means the security boundary is
 * narrow — the only thing the code must guarantee is that:
 *
 *   1. the customer cannot choose their own total or unique code;
 *   2. the customer cannot mark their own payment approved;
 *   3. an approval is idempotent and auditable (who, when).
 *
 * RLS already enforces (2): payments has an UPDATE policy for admins only. The
 * checks below are defence in depth, not the only line.
 */

export class ManualPaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManualPaymentError";
  }
}

export type ManualCheckoutResult = {
  transactionId: string;
  code: string;
  /** total sewa sebelum kode unik */
  total: number;
  /** 3 digit, unik per hari */
  uniqueCode: number;
  /** total + kode unik — nominal yang harus ditransfer */
  payableAmount: number;
  /** batas waktu pembayaran; setelah ini admin boleh membatalkan */
  expiresAt: string | null;
};

/** How long a customer has to upload proof before the invoice is stale. */
const PAYMENT_WINDOW_HOURS = 24;

function generateInvoiceCode(): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SP-${stamp}-${rand}`;
}

/**
 * Create an invoice awaiting manual transfer.
 *
 * The unique code is allocated by the database (`next_unique_code()`), never by
 * the client, and the payable amount is a generated column so it cannot drift
 * from total + code.
 */
export async function createManualInvoice(
  request: Request,
  input: CheckoutInput,
): Promise<ManualCheckoutResult> {
  const auth = await getUserFromRequest(request);
  if (!auth) throw new ManualPaymentError("harus login terlebih dahulu");

  const db = getServiceClient();

  const { data: profile } = await db
    .from("profiles")
    .select("name, phone, is_vip, points, kyc_status")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile) throw new ManualPaymentError("profil tidak ditemukan");
  if (profile.kyc_status !== "Verified") {
    throw new ManualPaymentError("KYC harus diverifikasi sebelum booking");
  }

  const priced: PricedCheckout = await priceCheckout(input, {
    isVip: Boolean(profile.is_vip),
    availablePoints: profile.points ?? 0,
  });

  // Allocate the code server-side. If the DB cannot find a free code we fail
  // loudly rather than reusing one.
  const { data: codeRow, error: codeError } = await db.rpc("next_unique_code");
  if (codeError) {
    throw new ManualPaymentError(`gagal membuat kode unik: ${codeError.message}`);
  }
  const uniqueCode = Number(codeRow);
  if (!Number.isInteger(uniqueCode) || uniqueCode < 100 || uniqueCode > 999) {
    throw new ManualPaymentError("kode unik tidak valid");
  }

  const code = generateInvoiceCode();

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
      unique_code: uniqueCode,
      method: "transfer",
      status: "Menunggu Pembayaran",
    })
    .select("id, code, total, unique_code, payable_amount")
    .single();

  if (txnError || !txn) {
    throw new ManualPaymentError(`gagal membuat transaksi: ${txnError?.message ?? "unknown"}`);
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
  if (linesError) {
    // Roll back the header so we never leave a half-built invoice.
    await db.from("transactions").delete().eq("id", txn.id);
    throw new ManualPaymentError(`gagal menyimpan rincian: ${linesError.message}`);
  }

  // Reserve the dates so the availability calendar reflects the hold.
  await db.from("product_bookings").insert(
    priced.lines.map((l) => ({
      product_id: l.productId,
      start_date: input.startDate,
      end_date: input.endDate,
      quantity: l.quantity,
      trx_id: txn.id,
    })),
  );

  const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_HOURS * 3_600_000).toISOString();

  return {
    transactionId: txn.id,
    code: txn.code,
    total: Number(txn.total),
    uniqueCode: Number(txn.unique_code),
    payableAmount: Number(txn.payable_amount),
    expiresAt,
  };
}

// ---------------------------------------------------------------------------
// Customer: upload proof of transfer
// ---------------------------------------------------------------------------
export type SubmitProofArgs = {
  transactionId: string;
  stage: "DP" | "Pelunasan";
  /** storage path inside the private payment-proofs bucket */
  proofPath: string;
  note?: string;
};

export async function submitTransferProof(
  request: Request,
  args: SubmitProofArgs,
): Promise<{ paymentId: string }> {
  const auth = await getUserFromRequest(request);
  if (!auth) throw new ManualPaymentError("harus login terlebih dahulu");

  const db = getServiceClient();

  const { data: txn } = await db
    .from("transactions")
    .select(
      "id, customer_id, total, unique_code, payable_amount, dp_amount, remaining_amount, status",
    )
    .eq("id", args.transactionId)
    .maybeSingle();

  if (!txn) throw new ManualPaymentError("transaksi tidak ditemukan");
  if (txn.customer_id !== auth.user.id) {
    throw new ManualPaymentError("bukan transaksi Anda");
  }
  if (txn.status === "Dibatalkan") {
    throw new ManualPaymentError("transaksi sudah dibatalkan");
  }

  // Amount arithmetic, and why the unique code is applied exactly once:
  //
  //   payable   = total + unique_code     (what the first transfer must be)
  //   DP        = 30% of total            (no code — the code rides the first)
  //   pelunasan = payable - DP            (so DP + pelunasan = payable)
  //
  // Charging `payable_amount` again for the final stage would make the customer
  // pay the unique code twice. Using `remaining_amount` alone would leave the
  // code uncollected when the first transfer was the DP.
  const payable = Number(txn.payable_amount);
  const dp = Number(txn.dp_amount);

  const amount =
    args.stage === "DP" ? dp : Math.max(0, payable - dp);

  if (amount <= 0) {
    throw new ManualPaymentError(`tidak ada tagihan untuk tahap ${args.stage}`);
  }

  // One outstanding submission per stage: re-uploading replaces the proof
  // instead of stacking duplicates the admin has to sift through.
  const { data: existing } = await db
    .from("payments")
    .select("id, status")
    .eq("transaction_id", txn.id)
    .eq("stage", args.stage)
    .in("status", ["Menunggu", "Ditolak"])
    .maybeSingle();

  const payload = {
    transaction_id: txn.id,
    stage: args.stage,
    method: "transfer" as const,
    amount: Number(amount),
    unique_code: Number(txn.unique_code),
    proof_path: args.proofPath,
    note: args.note ?? null,
    status: "Menunggu" as const,
    reviewed_by: null,
    reviewed_at: null,
  };

  if (existing) {
    const { error } = await db.from("payments").update(payload).eq("id", existing.id);
    if (error) throw new ManualPaymentError(`gagal memperbarui bukti: ${error.message}`);
    return { paymentId: existing.id };
  }

  const { data: payment, error } = await db
    .from("payments")
    .insert(payload)
    .select("id")
    .single();

  if (error || !payment) {
    throw new ManualPaymentError(`gagal menyimpan bukti: ${error?.message ?? "unknown"}`);
  }
  return { paymentId: payment.id };
}

// ---------------------------------------------------------------------------
// Admin: verify a transfer
// ---------------------------------------------------------------------------
export async function verifyManualPayment(
  request: Request,
  args: { paymentId: string; decision: "Disetujui" | "Ditolak"; note?: string },
): Promise<{ transactionStatus: string }> {
  const auth = await getUserFromRequest(request);
  if (!auth) throw new ManualPaymentError("harus login terlebih dahulu");

  const db = getServiceClient();

  const { data: admin } = await db
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (admin?.role !== "admin") throw new ManualPaymentError("khusus admin");

  const { data: payment } = await db
    .from("payments")
    .select("id, transaction_id, stage, amount, status, proof_path")
    .eq("id", args.paymentId)
    .maybeSingle();

  if (!payment) throw new ManualPaymentError("pembayaran tidak ditemukan");

  // Idempotent: approving twice must not double-advance the transaction or
  // double-award points.
  if (payment.status === args.decision) {
    return { transactionStatus: "unchanged" };
  }
  if (payment.status === "Disetujui") {
    throw new ManualPaymentError("pembayaran sudah disetujui sebelumnya");
  }

  const { error: payError } = await db
    .from("payments")
    .update({
      status: args.decision,
      note: args.note ?? null,
      reviewed_by: auth.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (payError) throw new ManualPaymentError(`gagal memperbarui pembayaran: ${payError.message}`);

  if (args.decision === "Ditolak") {
    // Leave the invoice open so the customer can re-upload.
    return { transactionStatus: "Menunggu Pembayaran" };
  }

  const { data: txn } = await db
    .from("transactions")
    .select("id, status, points_earned, points_redeemed, customer_id, remaining_amount")
    .eq("id", payment.transaction_id)
    .maybeSingle();

  if (!txn) throw new ManualPaymentError("transaksi tidak ditemukan");

  const nextStatus = payment.stage === "DP" ? "DP Terbayar" : "Lunas";

  const { error: txnError } = await db
    .from("transactions")
    .update({ status: nextStatus })
    .eq("id", txn.id);

  if (txnError) throw new ManualPaymentError(`gagal memperbarui transaksi: ${txnError.message}`);

  // Points move only once, on final settlement.
  if (payment.stage === "Pelunasan") {
    const net = (txn.points_earned ?? 0) - (txn.points_redeemed ?? 0);
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

  return { transactionStatus: nextStatus };
}
