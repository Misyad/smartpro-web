import {
  applyVoucher,
  computePointsDiscount,
  computeRewardPoints,
  type AdminSettings,
  type CartLineDuration,
  type Voucher,
} from "@/lib/smartpro-data";
import type { CartLine } from "@/lib/smartpro-store";

export type CheckoutDraft = {
  lines: CartLine[];
  pointsToRedeem: number;
  startDate: string;
  endDate: string;
};

export type CheckoutTotals = {
  subtotal: number;
  voucherDiscount: number;
  vipDiscount: number;
  pointsDiscount: number;
  total: number;
  dpAmount: number;
  remainingAmount: number;
  rewardPoints: number;
};

export type CheckoutOptions = {
  voucher?: Voucher | null;
  isVip?: boolean;
  nowISO?: string;
};

export function computeCheckoutTotals(
  lines: CartLine[],
  pointsToRedeem: number,
  settings: AdminSettings,
  options: CheckoutOptions = {},
): CheckoutTotals {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const voucherDiscount = applyVoucher(subtotal, options.voucher ?? null, options.nowISO ?? "");
  const afterVoucher = Math.max(0, subtotal - voucherDiscount);

  const vipDiscount = options.isVip
    ? Math.round((afterVoucher * Math.min(100, Math.max(0, settings.vipDiscountPercent))) / 100)
    : 0;
  const afterVip = Math.max(0, afterVoucher - vipDiscount);

  const pointsDiscount = Math.min(computePointsDiscount(pointsToRedeem, settings), afterVip);
  const total = Math.max(0, afterVip - pointsDiscount);

  const dpAmount = Math.round(total * 0.3);
  const remainingAmount = total - dpAmount;
  const rewardPoints =
    lines.reduce((sum, line) => sum + line.rewardPoints * line.quantity, 0) +
    computeRewardPoints(total, settings);

  return {
    subtotal,
    voucherDiscount,
    vipDiscount,
    pointsDiscount,
    total,
    dpAmount,
    remainingAmount,
    rewardPoints,
  };
}

export function durationLabel(duration: CartLineDuration): string {
  return duration === "12h" ? "12 Jam" : "24 Jam";
}
