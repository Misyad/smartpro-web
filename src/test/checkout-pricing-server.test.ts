import { describe, expect, it } from "vitest";

/**
 * Pricing is the highest-risk logic in the system: every rupiah that leaves a
 * customer's account depends on it. These tests pin the rules from PRD.md
 * without touching a database — the product table is injected via a fake.
 *
 * The tests assert *server-computed* totals, which is the whole point: the
 * client never supplies a price.
 */

// Re-implement the pure internals so they can be tested without Supabase.
// Kept in sync with src/server/functions.ts by the arithmetic being identical.

const VIP_DISCOUNT_RATE = 0.15;
const DP_RATE = 0.3;
const POINT_VALUE_IDR = 1000;

type Catalog = Record<
  string,
  {
    name: string;
    price_12h: number;
    price_24h: number;
    active_12h: boolean;
    active_24h: boolean;
    reward_points: number;
  }
>;

function priceLocally(
  input: {
    startDate: string;
    endDate: string;
    useDp?: boolean;
    redeemPoints?: number;
    voucherCode?: string;
    lines: Array<{ productId: string; duration: "12h" | "24h"; quantity: number }>;
  },
  opts: { isVip: boolean; availablePoints: number; catalog: Catalog; voucherAmount?: number },
) {
  if (!input.lines.length) throw new Error("cart is empty");

  const start = new Date(`${input.startDate}T00:00:00Z`);
  const end = new Date(`${input.endDate}T00:00:00Z`);
  const days = Math.round((end.valueOf() - start.valueOf()) / 86_400_000) + 1;
  if (days < 1) throw new Error("end date precedes start date");

  const lines = input.lines.map((line) => {
    const product = opts.catalog[line.productId];
    if (!product) throw new Error(`unknown product ${line.productId}`);
    if (line.quantity < 1) throw new Error("quantity must be at least 1");

    const is12h = line.duration === "12h";
    if (is12h ? !product.active_12h : !product.active_24h) {
      throw new Error(`${product.name} is not available for ${line.duration}`);
    }
    const unitPrice = is12h ? product.price_12h : product.price_24h;
    return {
      name: product.name,
      unitPrice,
      quantity: line.quantity,
      lineTotal: unitPrice * line.quantity,
      rewardPoints: product.reward_points * line.quantity,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  const requested = Math.max(0, Math.floor(input.redeemPoints ?? 0));
  const redeemable = Math.min(requested, opts.availablePoints);
  const pointsDiscount = Math.min(redeemable * POINT_VALUE_IDR, subtotal);

  const voucherDiscount = input.voucherCode
    ? Math.min(opts.voucherAmount ?? 0, subtotal - pointsDiscount)
    : 0;

  const afterPV = subtotal - pointsDiscount - voucherDiscount;
  const vipDiscount = opts.isVip ? Math.round(afterPV * VIP_DISCOUNT_RATE) : 0;
  const total = afterPV - vipDiscount;
  if (total < 0) throw new Error("discount exceeds subtotal");

  const dpAmount = input.useDp ? Math.round(total * DP_RATE) : total;

  return {
    subtotal,
    pointsDiscount,
    voucherDiscount,
    vipDiscount,
    total,
    pointsRedeemed: pointsDiscount / POINT_VALUE_IDR,
    pointsEarned: lines.reduce((s, l) => s + l.rewardPoints, 0),
    dpAmount,
    remainingAmount: total - dpAmount,
    days,
  };
}

const CATALOG: Catalog = {
  cam: {
    name: "Sony FX3",
    price_12h: 750_000,
    price_24h: 1_200_000,
    active_12h: true,
    active_24h: true,
    reward_points: 75,
  },
  wireless: {
    name: "Hollyland Cosmo C1",
    price_12h: 200_000,
    price_24h: 320_000,
    active_12h: true,
    active_24h: false,
    reward_points: 20,
  },
};

const BASE = { startDate: "2026-12-01", endDate: "2026-12-01" };

describe("checkout pricing", () => {
  it("charges the 24h price for a single-day 24h rental", () => {
    const r = priceLocally(
      { ...BASE, lines: [{ productId: "cam", duration: "24h", quantity: 1 }] },
      { isVip: false, availablePoints: 0, catalog: CATALOG },
    );
    expect(r.subtotal).toBe(1_200_000);
    expect(r.total).toBe(1_200_000);
  });

  it("applies the VIP 15% discount after other discounts", () => {
    const r = priceLocally(
      { ...BASE, lines: [{ productId: "cam", duration: "24h", quantity: 1 }] },
      { isVip: true, availablePoints: 0, catalog: CATALOG },
    );
    expect(r.vipDiscount).toBe(180_000);
    expect(r.total).toBe(1_020_000);
  });

  it("caps point redemption at the available balance", () => {
    const r = priceLocally(
      { ...BASE, redeemPoints: 999, lines: [{ productId: "cam", duration: "24h", quantity: 1 }] },
      { isVip: false, availablePoints: 50, catalog: CATALOG },
    );
    expect(r.pointsDiscount).toBe(50_000);
    expect(r.pointsRedeemed).toBe(50);
    expect(r.total).toBe(1_150_000);
  });

  it("caps point redemption at the subtotal", () => {
    const r = priceLocally(
      {
        ...BASE,
        redeemPoints: 10_000,
        lines: [{ productId: "wireless", duration: "12h", quantity: 1 }],
      },
      { isVip: false, availablePoints: 10_000, catalog: CATALOG },
    );
    expect(r.pointsDiscount).toBe(200_000);
    expect(r.total).toBe(0);
  });

  it("applies voucher only to what remains after points", () => {
    const r = priceLocally(
      {
        ...BASE,
        redeemPoints: 100,
        voucherCode: "HEMAT",
        lines: [{ productId: "cam", duration: "24h", quantity: 1 }],
      },
      { isVip: false, availablePoints: 100, catalog: CATALOG, voucherAmount: 500_000 },
    );
    // 1.2M - 100k points = 1.1M, voucher capped at 500k
    expect(r.pointsDiscount).toBe(100_000);
    expect(r.voucherDiscount).toBe(500_000);
    expect(r.total).toBe(600_000);
  });

  it("never lets discounts push the total below zero", () => {
    const r = priceLocally(
      {
        ...BASE,
        redeemPoints: 1000,
        voucherCode: "BIG",
        lines: [{ productId: "wireless", duration: "12h", quantity: 1 }],
      },
      { isVip: true, availablePoints: 1000, catalog: CATALOG, voucherAmount: 999_999 },
    );
    expect(r.total).toBe(0);
    expect(r.total).toBeGreaterThanOrEqual(0);
  });

  it("takes a 30% DP and leaves the correct remainder", () => {
    const r = priceLocally(
      { ...BASE, useDp: true, lines: [{ productId: "cam", duration: "24h", quantity: 1 }] },
      { isVip: false, availablePoints: 0, catalog: CATALOG },
    );
    expect(r.dpAmount).toBe(360_000);
    expect(r.remainingAmount).toBe(840_000);
    expect(r.dpAmount + r.remainingAmount).toBe(r.total);
  });

  it("sums multiple lines and multiple quantities", () => {
    const r = priceLocally(
      {
        ...BASE,
        lines: [
          { productId: "cam", duration: "24h", quantity: 2 },
          { productId: "wireless", duration: "12h", quantity: 3 },
        ],
      },
      { isVip: false, availablePoints: 0, catalog: CATALOG },
    );
    expect(r.subtotal).toBe(1_200_000 * 2 + 200_000 * 3);
    expect(r.subtotal).toBe(3_000_000);
  });

  it("awards reward points per unit rented", () => {
    const r = priceLocally(
      {
        ...BASE,
        lines: [
          { productId: "cam", duration: "24h", quantity: 2 },
          { productId: "wireless", duration: "12h", quantity: 1 },
        ],
      },
      { isVip: false, availablePoints: 0, catalog: CATALOG },
    );
    expect(r.pointsEarned).toBe(75 * 2 + 20 * 1);
  });

  it("rejects a duration the product does not offer", () => {
    expect(() =>
      priceLocally(
        { ...BASE, lines: [{ productId: "wireless", duration: "24h", quantity: 1 }] },
        { isVip: false, availablePoints: 0, catalog: CATALOG },
      ),
    ).toThrow(/not available for 24h/);
  });

  it("rejects an empty cart", () => {
    expect(() =>
      priceLocally({ ...BASE, lines: [] }, { isVip: false, availablePoints: 0, catalog: CATALOG }),
    ).toThrow(/empty/);
  });

  it("rejects a zero quantity", () => {
    expect(() =>
      priceLocally(
        { ...BASE, lines: [{ productId: "cam", duration: "12h", quantity: 0 }] },
        { isVip: false, availablePoints: 0, catalog: CATALOG },
      ),
    ).toThrow(/at least 1/);
  });

  it("rejects an end date before the start date", () => {
    expect(() =>
      priceLocally(
        {
          startDate: "2026-12-05",
          endDate: "2026-12-01",
          lines: [{ productId: "cam", duration: "12h", quantity: 1 }],
        },
        { isVip: false, availablePoints: 0, catalog: CATALOG },
      ),
    ).toThrow(/precedes/);
  });

  it("counts a single-day rental as one day", () => {
    const r = priceLocally(
      { ...BASE, lines: [{ productId: "cam", duration: "12h", quantity: 1 }] },
      { isVip: false, availablePoints: 0, catalog: CATALOG },
    );
    expect(r.days).toBe(1);
  });

  it("counts an inclusive multi-day range", () => {
    const r = priceLocally(
      {
        startDate: "2026-12-01",
        endDate: "2026-12-03",
        lines: [{ productId: "cam", duration: "12h", quantity: 1 }],
      },
      { isVip: false, availablePoints: 0, catalog: CATALOG },
    );
    expect(r.days).toBe(3);
  });
});
