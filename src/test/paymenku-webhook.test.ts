import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { verifyWebhookSignature } from "@/server/paymenku";

/**
 * The webhook signature is the only thing standing between an attacker and a
 * forged "payment paid" event. It gets its own test file.
 *
 * Scheme under test (per Paymenku docs, confirmed against the working
 * telegram-store-bot implementation):
 *     hex( HMAC-SHA256( `${timestamp}.${rawBody}`, WEBHOOK_SECRET ) )
 */

async function expectedSignature(secret: string, timestamp: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SECRET="super-secret-webhook-key";
const TS = "1733900000";
const BODY = JSON.stringify({
  event: "payment.status_updated",
  trx_id: "trx_abc123",
  status: "paid",
  amount: 1500000,
});

describe("verifyWebhookSignature", () => {
  const original = process.env["PAYMENKU_WEBHOOK_SECRET"];

  beforeEach(() => {
    process.env["PAYMENKU_WEBHOOK_SECRET"] = SECRET;
  });

  afterEach(() => {
    if (original === undefined) delete process.env["PAYMENKU_WEBHOOK_SECRET"];
    else process.env["PAYMENKU_WEBHOOK_SECRET"] = original;
  });

  it("accepts a correctly signed payload", async () => {
    const signature = await expectedSignature(SECRET, TS, BODY);
    await expect(
      verifyWebhookSignature({ rawBody: BODY, signature, timestamp: TS }),
    ).resolves.toBe(true);
  });

  it("accepts an uppercase hex signature", async () => {
    const signature = (await expectedSignature(SECRET, TS, BODY)).toUpperCase();
    await expect(
      verifyWebhookSignature({ rawBody: BODY, signature, timestamp: TS }),
    ).resolves.toBe(true);
  });

  it("rejects a tampered body", async () => {
    const signature = await expectedSignature(SECRET, TS, BODY);
    const tampered = BODY.replace("1500000", "1");
    await expect(
      verifyWebhookSignature({ rawBody: tampered, signature, timestamp: TS }),
    ).resolves.toBe(false);
  });

  it("rejects a tampered timestamp (replay with new time)", async () => {
    const signature = await expectedSignature(SECRET, TS, BODY);
    await expect(
      verifyWebhookSignature({ rawBody: BODY, signature, timestamp: "1733900001" }),
    ).resolves.toBe(false);
  });

  it("rejects a signature made with the wrong secret", async () => {
    const signature = await expectedSignature("wrong_secret", TS, BODY);
    await expect(
      verifyWebhookSignature({ rawBody: BODY, signature, timestamp: TS }),
    ).resolves.toBe(false);
  });

  it("rejects a missing signature", async () => {
    await expect(
      verifyWebhookSignature({ rawBody: BODY, signature: null, timestamp: TS }),
    ).resolves.toBe(false);
  });

  it("rejects a missing timestamp", async () => {
    const signature = await expectedSignature(SECRET, TS, BODY);
    await expect(
      verifyWebhookSignature({ rawBody: BODY, signature, timestamp: null }),
    ).resolves.toBe(false);
  });

  it("rejects when the secret is not configured", async () => {
    delete process.env["PAYMENKU_WEBHOOK_SECRET"];
    const signature = await expectedSignature(SECRET, TS, BODY);
    await expect(
      verifyWebhookSignature({ rawBody: BODY, signature, timestamp: TS }),
    ).resolves.toBe(false);
  });

  it("rejects a truncated signature without throwing", async () => {
    const signature = (await expectedSignature(SECRET, TS, BODY)).slice(0, 10);
    await expect(
      verifyWebhookSignature({ rawBody: BODY, signature, timestamp: TS }),
    ).resolves.toBe(false);
  });
});

describe("createQrisPayment input validation", () => {
  it("rejects an amount below the 1000 IDR floor without calling the API", async () => {
    const { createQrisPayment } = await import("@/server/paymenku");
    const result = await createQrisPayment({
      amount: 999,
      referenceId: "ref-1",
      customerName: "Test",
      customerEmail: "test@example.com",
      returnUrl: "https://example.com",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a fractional amount", async () => {
    const { createQrisPayment } = await import("@/server/paymenku");
    const result = await createQrisPayment({
      amount: 1500.5,
      referenceId: "ref-2",
      customerName: "Test",
      customerEmail: "test@example.com",
      returnUrl: "https://example.com",
    });
    expect(result.ok).toBe(false);
  });
});
