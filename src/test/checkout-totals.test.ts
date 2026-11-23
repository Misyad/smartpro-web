import { describe, expect, it } from "vitest";

import { computeCheckoutTotals } from "@/components/smartpro/v2/checkout-logic";
import { DEFAULT_SETTINGS } from "@/lib/smartpro-data";
import type { CartLine } from "@/lib/smartpro-store";

const settings = {
  ...DEFAULT_SETTINGS,
  minRupiahReward: 150000,
  poinPerKelipatan: 10,
  minPoinTukar: 100,
  rupiahPerPoin: 500,
};

const lines: CartLine[] = [
  {
    key: "product:cosmo-c1:12h",
    name: "COSMO C1 (12 Jam)",
    duration: "12h",
    price: 95000,
    quantity: 2,
    rewardPoints: 15,
    productId: "cosmo-c1",
  },
];

describe("checkout totals", () => {
  it("sums subtotal with no promo and splits DP 30 / 70", () => {
    const totals = computeCheckoutTotals(lines, 0, settings);
    expect(totals.subtotal).toBe(190000);
    expect(totals.total).toBe(190000);
    expect(totals.dpAmount).toBe(57000);
    expect(totals.remainingAmount).toBe(133000);
  });

  it("applies points discount and never exceeds subtotal", () => {
    const totals = computeCheckoutTotals(lines, 100000, settings);
    // 100000 points is capped by subtotal via min()
    expect(totals.pointsDiscount).toBeLessThanOrEqual(totals.subtotal);
    expect(totals.total).toBeGreaterThanOrEqual(0);
  });

  it("awards product points plus per-block reward points", () => {
    const totals = computeCheckoutTotals(lines, 0, settings);
    // 2 x 15 product points = 30; floor(190000/150000)*10 = 10 -> 40
    expect(totals.rewardPoints).toBe(40);
  });

  it("applies a percent voucher before points and VIP", () => {
    const totals = computeCheckoutTotals(lines, 0, settings, {
      voucher: {
        id: "v1",
        code: "HOLIDAY10",
        type: "percent",
        value: 10,
        minSpend: 100000,
        active: true,
        expiresAt: "2099-12-31",
      },
      nowISO: "2026-01-01",
    });
    // 10% of 190000 = 19000
    expect(totals.voucherDiscount).toBe(19000);
    expect(totals.total).toBe(171000);
  });

  it("ignores an expired voucher", () => {
    const totals = computeCheckoutTotals(lines, 0, settings, {
      voucher: {
        id: "v2",
        code: "OLD",
        type: "fixed",
        value: 50000,
        minSpend: 0,
        active: true,
        expiresAt: "2020-01-01",
      },
      nowISO: "2026-01-01",
    });
    expect(totals.voucherDiscount).toBe(0);
  });

  it("applies Mitra VIP percent on top of the voucher", () => {
    const totals = computeCheckoutTotals(
      lines,
      0,
      { ...settings, vipDiscountPercent: 10 },
      {
        isVip: true,
      },
    );
    // 10% of 190000 = 19000
    expect(totals.vipDiscount).toBe(19000);
    expect(totals.total).toBe(171000);
  });
});
