/**
 * Paymenku QRIS client.
 *
 * Ported from the production telegram-store-bot implementation
 * (/opt/telegram-store-bot-mvp/src/services/paymenku.js) which is known to work
 * against the live API. Differences from that source:
 *   - TypeScript types instead of plain JS
 *   - webhook signature compared with timingSafeEqual, not `===`
 *   - explicit timeout + retry-free failure surface (the caller decides)
 *
 * Secrets are read from the server environment only. This module must never be
 * imported from a client component.
 */

const DEFAULT_BASE_URL = "https://paymenku.com/api/v1";

export type PaymenkuCreateParams = {
  amount: number;
  referenceId: string;
  customerName: string;
  customerEmail: string;
  returnUrl: string;
  customerPhone?: string;
  orderItems?: Array<{ name: string; quantity: number; price: number }>;
};

export type PaymenkuCreateResult =
  | {
      ok: true;
      trxId: string;
      qrUrl: string | null;
      paymentUrl: string | null;
      expiresAt: string | null;
      raw: unknown;
    }
  | { ok: false; error: string };

export type PaymenkuStatusResult =
  { ok: true; status: string; paidAt: string | null; raw: unknown } | { ok: false; error: string };

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function authHeaders() {
  const key = env("PAYMENKU_API_KEY");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function callPaymenku(path: string, init: RequestInit) {
  const baseUrl = process.env["PAYMENKU_BASE_URL"] || DEFAULT_BASE_URL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...authHeaders(), ...(init.headers ?? {}) },
      signal: controller.signal,
    });
    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }
    return { status: response.status, body } as const;
  } finally {
    clearTimeout(timer);
  }
}

/** Create a QRIS transaction. Amount is whole rupiah. */
export async function createQrisPayment(
  params: PaymenkuCreateParams,
): Promise<PaymenkuCreateResult> {
  if (!Number.isInteger(params.amount) || params.amount < 1000) {
    return { ok: false, error: "amount must be an integer >= 1000 IDR" };
  }

  try {
    const { status, body } = await callPaymenku("/transaction/create", {
      method: "POST",
      body: JSON.stringify({
        channel_code: "qris",
        amount: params.amount,
        reference_id: params.referenceId,
        customer_name: params.customerName,
        customer_email: params.customerEmail,
        return_url: params.returnUrl,
        customer_phone: params.customerPhone,
        order_items: params.orderItems ?? [],
      }),
    });

    const payload = body as {
      status?: string;
      message?: string;
      data?: {
        trx_id?: string;
        payment_info?: { qr_url?: string; payment_url?: string; expired_at?: string };
      };
    };

    if (status >= 200 && status < 300 && payload?.status === "success" && payload.data) {
      return {
        ok: true,
        trxId: payload.data.trx_id ?? "",
        qrUrl: payload.data.payment_info?.qr_url ?? null,
        paymentUrl: payload.data.payment_info?.payment_url ?? null,
        expiresAt: payload.data.payment_info?.expired_at ?? null,
        raw: body,
      };
    }

    return {
      ok: false,
      error: payload?.message || `Paymenku responded with HTTP ${status}`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Paymenku request failed",
    };
  }
}

/** Look up transaction status by trx_id or reference_id. */
export async function checkStatus(orderId: string): Promise<PaymenkuStatusResult> {
  try {
    const { status, body } = await callPaymenku(`/check-status/${encodeURIComponent(orderId)}`, {
      method: "GET",
    });
    const payload = body as {
      status?: string;
      data?: { status?: string; paid_at?: string };
    };

    if (status >= 200 && status < 300) {
      return {
        ok: true,
        status: payload?.data?.status ?? payload?.status ?? "unknown",
        paidAt: payload?.data?.paid_at ?? null,
        raw: body,
      };
    }
    return { ok: false, error: `HTTP ${status}` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "status check failed",
    };
  }
}

/**
 * Verify the X-PaymenKu-Signature header.
 *
 * Documented scheme (confirmed against the working telegram-store-bot
 * implementation): HMAC-SHA256 over `${timestamp}.${rawBody}` using
 * PAYMENKU_WEBHOOK_SECRET, hex encoded.
 *
 * The raw request body must be used verbatim — re-serialising parsed JSON
 * changes key order and breaks the digest.
 */
export async function verifyWebhookSignature(args: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
}): Promise<boolean> {
  const secret = process.env["PAYMENKU_WEBHOOK_SECRET"];
  if (!secret) return false;
  if (!args.signature || !args.timestamp) return false;

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
    new TextEncoder().encode(`${args.timestamp}.${args.rawBody}`),
  );

  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison: equal-length hex strings.
  const a = new TextEncoder().encode(expected.toLowerCase());
  const b = new TextEncoder().encode(args.signature.toLowerCase());
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
