import { describe, expect, it } from "vitest";

import {
  computeOvertime,
  computePointsDiscount,
  computeRewardPoints,
  DEFAULT_SETTINGS,
  getAvailableUnits,
  INITIAL_PRODUCTS,
  lineTotal,
  periodPrice,
  rentalDayCount,
} from "@/lib/smartpro-data";

describe("SMartPro rental rules", () => {
  it("counts the seeded 20 to 22 November rental as two 24-hour days", () => {
    expect(rentalDayCount("2026-11-20", "2026-11-22")).toBe(2);
  });

  it("prices each duration from its own rate with no promo", () => {
    const sony = INITIAL_PRODUCTS.find((product) => product.id === "sony-a6400");
    expect(sony).toBeDefined();
    if (!sony) return;
    expect(periodPrice(sony, "12h")).toBe(sony.price12h);
    expect(periodPrice(sony, "24h")).toBe(sony.price24h);
    // 2 periods at 24h, quantity 1, pure multiplication.
    expect(lineTotal(sony.price24h, 1, 2)).toBe(sony.price24h * 2);
  });

  it("earns points per configured minimum rupiah block", () => {
    const settings = { ...DEFAULT_SETTINGS, minRupiahReward: 100000, poinPerKelipatan: 10 };
    expect(computeRewardPoints(250000, settings)).toBe(20);
    expect(computeRewardPoints(99999, settings)).toBe(0);
  });

  it("applies the configured points redemption value above the minimum", () => {
    const settings = { ...DEFAULT_SETTINGS, minPoinTukar: 100, rupiahPerPoin: 500 };
    expect(computePointsDiscount(200, settings)).toBe(100000);
    expect(computePointsDiscount(50, settings)).toBe(0);
  });

  it("charges overtime per started 12-hour block at the 12h rate", () => {
    // Due 2026-11-21 18:00Z, returned 2026-11-22 12:00Z -> 18 hours late -> 2 blocks.
    const result = computeOvertime("2026-11-21", "2026-11-22T12:00:00Z", 75000);
    expect(result.hours).toBe(18);
    expect(result.fee).toBe(150000);
  });

  it("charges no overtime when returned on time", () => {
    const result = computeOvertime("2026-11-21", "2026-11-21T10:00:00Z", 75000);
    expect(result).toEqual({ hours: 0, fee: 0 });
  });

  it("shows both Sony A6400 units booked on 21 to 23 November", () => {
    const sony = INITIAL_PRODUCTS.find((product) => product.id === "sony-a6400");
    expect(sony).toBeDefined();
    if (!sony) return;
    expect(getAvailableUnits(sony, "2026-11-21", "2026-11-23")).toBe(0);
  });
});
