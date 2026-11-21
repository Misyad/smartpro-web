import { describe, expect, it } from "vitest";

import {
  getAvailableUnits,
  INITIAL_PRODUCTS,
  promoFreeDays,
  rentalDayCount,
  rentalPriceBreakdown,
} from "@/lib/smartpro-data";

describe("SMartPro rental rules", () => {
  it("counts the seeded 20–22 November rental as two 24-hour days", () => {
    expect(rentalDayCount("2026-11-20", "2026-11-22")).toBe(2);
  });

  it("grants one free day for each three rental days", () => {
    expect(promoFreeDays(3)).toBe(1);
    expect(promoFreeDays(6)).toBe(2);
  });

  it("applies the stated permanent 15% VIP reduction after free days", () => {
    expect(rentalPriceBreakdown(100000, 1, 3, true)).toEqual({
      base: 300000,
      promoDiscount: 100000,
      vipDiscount: 30000,
      total: 170000,
    });
  });

  it("shows both Sony A6400 units booked on 21–23 November", () => {
    const sony = INITIAL_PRODUCTS.find((product) => product.id === "sony-a6400");
    expect(sony).toBeDefined();
    if (!sony) return;
    expect(getAvailableUnits(sony, "2026-11-21", "2026-11-23")).toBe(0);
  });
});
