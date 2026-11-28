import { verifyWebhookSignature } from "@/server/paymenku";
import { applyPaymentWebhook } from "@/server/functions";

/**
 * Paymenku webhook endpoint.
 *
 * Replaces the Express route in telegram-store-bot-mvp. Two rules matter:
 *
 *   1. The signature is verified against the RAW body. Re-serialising parsed
 *      JSON would change key order and always fail the digest.
 *   2. The response is 200 for anything we intentionally ignore (wrong event,
 *      duplicate delivery) so Paymenku stops retrying, and 401 only for an
 *      unverifiable request.
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  const valid = await verifyWebhookSignature({
    rawBody,
    signature: request.headers.get("x-paymenku-signature"),
    timestamp: request.headers.get("x-paymenku-timestamp"),
  });

  if (!valid) {
    console.warn("[webhook] rejected: invalid signature");
    return Response.json({ success: false, error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ success: false, error: "invalid JSON" }, { status: 400 });
  }

  try {
    const outcome = await applyPaymentWebhook(payload as Parameters<typeof applyPaymentWebhook>[0]);

    if (!outcome.ok) {
      console.error("[webhook] failed:", outcome.reason);
      // Non-2xx so Paymenku retries a genuine processing failure.
      return Response.json({ success: false, error: outcome.reason }, { status: 500 });
    }

    return Response.json({ success: true, applied: outcome.applied, reason: outcome.reason });
  } catch (error) {
    console.error("[webhook] unhandled:", error);
    return Response.json({ success: false, error: "internal error" }, { status: 500 });
  }
}
