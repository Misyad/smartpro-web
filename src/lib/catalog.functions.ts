import { createServerFn } from "@tanstack/react-start";

import type { Bundle, Product, Voucher } from "@/lib/smartpro-data";

export type CatalogPayload = {
  products: Product[];
  bundles: Bundle[];
  vouchers: Voucher[];
  source: "live" | "fallback";
};

/**
 * Catalog loader for the home route.
 *
 * Lives in src/lib (not src/server) on purpose: `src/server/**` is blocked by
 * TanStack Start's import-protection plugin in the client environment, so a
 * route file cannot import from there. A createServerFn module is safe to
 * import from the client — only the handler body is stripped out and replaced
 * with an RPC stub.
 *
 * The real implementation is imported dynamically inside the handler, which
 * keeps every server-only module (service key, paymenku secrets) out of the
 * client bundle.
 *
 * Returns empty arrays instead of throwing when the backend is unconfigured or
 * unreachable, so the app falls back to its local demo data rather than 500ing.
 */
export const loadCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<CatalogPayload> => {
    try {
      const [{ getPublicClient }, repo] = await Promise.all([
        import("@/server/supabase"),
        import("@/lib/smartpro-repo"),
      ]);

      const client = getPublicClient();
      const [products, bundles, vouchers] = await Promise.all([
        repo.fetchProducts(client),
        repo.fetchBundles(client),
        repo.fetchVouchers(client),
      ]);

      return { products, bundles, vouchers, source: "live" };
    } catch (error) {
      console.warn("[catalog] falling back to demo data:", error);
      return { products: [], bundles: [], vouchers: [], source: "fallback" };
    }
  },
);
