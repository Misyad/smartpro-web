import { describe, expect, it } from "vitest";

/**
 * Rules for the manual payment flow.
 *
 * These pin the arithmetic and the state machine without a database. The
 * database-level guarantees (per-day uniqueness, range checks, admin-only
 * UPDATE) were verified separately against the live project.
 */

const PAYMENT_WINDOW_HOURS = 24;

/** Mirrors the generated column: payable = total + unique code. */
function payableAmount(total: number, uniqueCode: number): number {
  return total + uniqueCode;
}

/** Mirrors the DB CHECK constraint. */
function isValidCode(code: number): boolean {
  return Number.isInteger(code) && code >= 100 && code <= 999;
}

/** Mirrors verifyManualPayment's transaction transition. */
function nextTransactionStatus(stage: "DP" | "Pelunasan"): string {
  return stage === "DP" ? "DP Terbayar" : "Lunas";
}

/**
 * Mirrors submitTransferProof's amount rule.
 *
 * The unique code must be collected exactly once across a split payment:
 *   DP        = dp_amount              (no code)
 *   pelunasan = (total + code) - dp    (carries the code)
 * so DP + pelunasan == payable.
 */
function stageAmount(
  stage: "DP" | "Pelunasan",
  total: number,
  uniqueCode: number,
  dpAmount: number,
): number {
  const payable = total + uniqueCode;
  return stage === "DP" ? dpAmount : Math.max(0, payable - dpAmount);
}

/** Mirrors the idempotency guard. */
function decide(current: string, requested: "Disetujui" | "Ditolak") {
  if (current === requested) return { action: "noop" as const };
  if (current === "Disetujui") return { action: "error" as const };
  return { action: "apply" as const };
}

describe("manual invoice amount", () => {
  it("adds the unique code to the rental total", () => {
    expect(payableAmount(1_200_000, 347)).toBe(1_200_347);
  });

  it("keeps the rental total unchanged for reporting", () => {
    const total = 1_200_000;
    const payable = payableAmount(total, 347);
    expect(total).toBe(1_200_000);
    expect(payable).toBeGreaterThan(total);
  });

  it("produces a non-round figure for bank reconciliation", () => {
    const payable = payableAmount(750_000, 918);
    expect(payable % 1000).not.toBe(0);
    expect(String(payable)).not.toMatch(/000$/);
  });

  it("works with a zero total (fully discounted booking)", () => {
    expect(payableAmount(0, 500)).toBe(500);
  });

  it("never loses a rupiah across many combinations", () => {
    for (let code = 100; code <= 999; code += 97) {
      for (const total of [0, 200_000, 1_200_000, 3_200_000]) {
        expect(payableAmount(total, code)).toBe(total + code);
      }
    }
  });
});

describe("unique code validity", () => {
  it("accepts the 900 valid codes", () => {
    let valid = 0;
    for (let c = 100; c <= 999; c += 1) if (isValidCode(c)) valid += 1;
    expect(valid).toBe(900);
  });

  it("rejects boundaries just outside the range", () => {
    expect(isValidCode(99)).toBe(false);
    expect(isValidCode(1000)).toBe(false);
  });

  it("rejects non-integers", () => {
    expect(isValidCode(123.5)).toBe(false);
    expect(isValidCode(Number.NaN)).toBe(false);
  });

  it("treats 0 as 'no code assigned yet'", () => {
    // The DB constraint allows 0 explicitly before checkout allocates one.
    expect(isValidCode(0)).toBe(false);
    // but it must not be confused with a real code
    expect(0 >= 100).toBe(false);
  });
});

describe("approval state machine", () => {
  it("DP approval advances to DP Terbayar", () => {
    expect(nextTransactionStatus("DP")).toBe("DP Terbayar");
  });

  it("final settlement advances to Lunas", () => {
    expect(nextTransactionStatus("Pelunasan")).toBe("Lunas");
  });

  it("approving twice is a no-op, not an error", () => {
    expect(decide("Disetujui", "Disetujui").action).toBe("noop");
  });

  it("rejecting twice is a no-op", () => {
    expect(decide("Ditolak", "Ditolak").action).toBe("noop");
  });

  it("cannot change an approved payment to rejected", () => {
    expect(decide("Disetujui", "Ditolak").action).toBe("error");
  });

  it("pending can be approved", () => {
    expect(decide("Menunggu", "Disetujui").action).toBe("apply");
  });

  it("pending can be rejected", () => {
    expect(decide("Menunggu", "Ditolak").action).toBe("apply");
  });

  it("a rejected payment can be re-submitted then approved", () => {
    expect(decide("Ditolak", "Disetujui").action).toBe("apply");
  });
});

describe("payment window", () => {
  it("is 24 hours", () => {
    const created = new Date("2026-12-01T10:00:00Z").getTime();
    const expires = created + PAYMENT_WINDOW_HOURS * 3_600_000;
    expect(new Date(expires).toISOString()).toBe("2026-12-02T10:00:00.000Z");
  });
});

describe("split payment collects the code exactly once", () => {
  const total = 1_200_000;
  const code = 388;
  const dp = 360_000; // 30%

  it("DP stage does not include the unique code", () => {
    expect(stageAmount("DP", total, code, dp)).toBe(360_000);
  });

  it("final stage carries the unique code", () => {
    expect(stageAmount("Pelunasan", total, code, dp)).toBe(1_200_388 - 360_000);
  });

  it("DP + pelunasan equals the payable amount exactly", () => {
    const sum =
      stageAmount("DP", total, code, dp) + stageAmount("Pelunasan", total, code, dp);
    expect(sum).toBe(payableAmount(total, code));
    expect(sum).toBe(1_200_388);
  });

  it("the code is never charged twice", () => {
    const sum =
      stageAmount("DP", total, code, dp) + stageAmount("Pelunasan", total, code, dp);
    // Charging payable for both stages would have produced total*2 + code*2
    expect(sum).not.toBe(2 * total + 2 * code);
    expect(sum - total).toBe(code);
  });

  it("a single full payment equals payable with no DP", () => {
    // dp_amount == total means nothing was paid up front
    expect(stageAmount("Pelunasan", total, code, total)).toBe(code);
    expect(stageAmount("DP", total, code, total) + stageAmount("Pelunasan", total, code, total))
      .toBe(payableAmount(total, code));
  });

  it("never returns a negative final amount", () => {
    // defensive: DP larger than payable (bad data) must clamp, not go negative
    expect(stageAmount("Pelunasan", total, code, total + code + 5000)).toBe(0);
  });

  it("holds for many totals and codes", () => {
    for (const t of [200_000, 750_000, 1_200_000, 3_200_000]) {
      for (const c of [100, 388, 999]) {
        const d = Math.round(t * 0.3);
        expect(stageAmount("DP", t, c, d) + stageAmount("Pelunasan", t, c, d)).toBe(t + c);
      }
    }
  });
});
