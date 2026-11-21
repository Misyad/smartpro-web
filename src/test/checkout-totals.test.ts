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
});
