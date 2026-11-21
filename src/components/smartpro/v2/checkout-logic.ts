import {
  computePointsDiscount,
  computeRewardPoints,
  genUniqueCode,
  type AdminSettings,
  type CartLineDuration,
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
  pointsDiscount: number;
  total: number;
  dpAmount: number;
  remainingAmount: number;
  rewardPoints: number;
};

export function computeCheckoutTotals(
  lines: CartLine[],
  pointsToRedeem: number,
  settings: AdminSettings,
): CheckoutTotals {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const pointsDiscount = Math.min(computePointsDiscount(pointsToRedeem, settings), subtotal);
  const total = Math.max(0, subtotal - pointsDiscount);
  const dpAmount = Math.round(total * 0.3);
  const remainingAmount = total - dpAmount;
  const rewardPoints =
    lines.reduce((sum, line) => sum + line.rewardPoints * line.quantity, 0) +
    computeRewardPoints(total, settings);
  return { subtotal, pointsDiscount, total, dpAmount, remainingAmount, rewardPoints };
}

export function durationLabel(duration: CartLineDuration): string {
  return duration === "12h" ? "12 Jam" : "24 Jam";
}
