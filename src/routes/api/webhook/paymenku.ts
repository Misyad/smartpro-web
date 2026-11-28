import { createFileRoute } from "@tanstack/react-router";

import { verifyWebhookSignature } from "@/server/paymenku";
import { applyPaymentWebhook } from "@/server/functions";

/**
 * Paymenku webhook endpoint: POST /api/webhook/paymenku
 *
 * TanStack Start treats `server.handlers` inside a route file as a server-only
 * API route, which is what we want — the handler never ships to the browser.
 *
 * Two rules matter:
 *   1. The signature is verified against the RAW body. Re-serialising parsed
 *      JSON changes key order and would always fail the digest.
 *   2. Ignored and duplicate deliveries return 200 so Paymenku stops retrying;
 *      401 is reserved for an unverifiable request, 500 for a genuine failure.
 */
export const Route = createFileRoute("/api/webhook/paymenku")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
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
          const outcome = await applyPaymentWebhook(
            payload as Parameters<typeof applyPaymentWebhook>[0],
          );

          if (!outcome.ok) {
            console.error("[webhook] failed:", outcome.reason);
            return Response.json({ success: false, error: outcome.reason }, { status: 500 });
          }

          return Response.json({
            success: true,
            applied: outcome.applied,
            reason: outcome.reason,
          });
        } catch (error) {
          console.error("[webhook] unhandled:", error);
          return Response.json({ success: false, error: "internal error" }, { status: 500 });
        }
      },
    },
  },
});
