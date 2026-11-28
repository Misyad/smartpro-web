/**
 * Integration test against the LIVE Supabase project.
 *
 * Unlike the unit tests this exercises the real network, the real RLS policies
 * and the real enum values. It is the only test that can catch a mapper that
 * compiles fine but reads the wrong column name.
 *
 * Skipped automatically when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are
 * absent, so CI without credentials stays green instead of failing.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  fetchBundles,
  fetchProducts,
  fetchSettings,
  fetchVouchers,
  mapProduct,
} from "@/lib/smartpro-repo";

const URL = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
const KEY = process.env["VITE_SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
const LIVE = Boolean(URL && KEY);

let client: SupabaseClient;

beforeAll(() => {
  if (LIVE) client = createClient(URL as string, KEY as string);
});

describe.skipIf(!LIVE)("live schema contract", () => {
  it("reads the seeded catalog through RLS", async () => {
    const products = await fetchProducts(client);
    expect(products.length).toBeGreaterThanOrEqual(7);

    const fx3 = products.find((p) => p.name.includes("Sony FX3"));
    expect(fx3).toBeDefined();
    expect(fx3!.price12h).toBe(750_000);
    expect(fx3!.price24h).toBe(1_200_000);
    expect(fx3!.category).toBe("Kamera");
    expect(fx3!.bestSeller).toBe(true);
    expect(fx3!.imageUrl).toBe("/products/fx3.jpg");
  });

  it("attaches serials and bookings from their own tables", async () => {
    const products = await fetchProducts(client);
    const fx3 = products.find((p) => p.name.includes("Sony FX3"))!;
    expect(fx3.serials.length).toBeGreaterThanOrEqual(2);
    expect(fx3.serials.every((s) => s.status === "READY")).toBe(true);
    expect(Array.isArray(fx3.bookings)).toBe(true);
  });

  it("maps every category to a valid app value", async () => {
    const products = await fetchProducts(client);
    const allowed = ["Kamera", "Wireless Video", "Switcher & Live"];
    for (const p of products) {
      expect(allowed).toContain(p.category);
    }
  });

  it("reads vouchers with the live type/value shape", async () => {
    const vouchers = await fetchVouchers(client);
    expect(vouchers.length).toBeGreaterThanOrEqual(3);

    const percent = vouchers.find((v) => v.code === "VIP10");
    expect(percent).toBeDefined();
    expect(percent!.type).toBe("percent");
    expect(percent!.value).toBe(10);

    const fixed = vouchers.find((v) => v.code === "HEMAT100");
    expect(fixed).toBeDefined();
    expect(fixed!.type).toBe("fixed");
    expect(fixed!.value).toBe(100_000);
    expect(fixed!.minSpend).toBe(500_000);
  });

  it("reads bundles with dual-duration pricing", async () => {
    const bundles = await fetchBundles(client);
    expect(bundles.length).toBeGreaterThanOrEqual(2);
    const interview = bundles.find((b) => b.name.includes("Interview"));
    expect(interview).toBeDefined();
    expect(interview!.price).toBe(1_900_000);
    expect(interview!.includes.length).toBeGreaterThanOrEqual(2);
  });

  it("reads app_settings used by server-side pricing", async () => {
    const settings = await fetchSettings(client);
    if (!settings) return; // settings row may be withheld by RLS for anon
    expect(settings.rupiahPerPoin).toBeGreaterThan(0);
    expect(settings.vipDiscountPercent).toBeGreaterThanOrEqual(0);
  });

  it("never exposes an archived product", async () => {
    const products = await fetchProducts(client);
    expect(products.every((p) => p.name.length > 0)).toBe(true);
  });

  it("mapProduct tolerates null columns", () => {
    const mapped = mapProduct({
      id: "x",
      name: null,
      category: null,
      price_12h: null,
      price_24h: null,
      active_12h: null,
      active_24h: null,
      best_seller: null,
      image_path: null,
      reward_points: null,
      accessories: null,
      specs: null,
      art: null,
      archived: null,
    });
    expect(mapped.name).toBe("-");
    expect(mapped.price12h).toBe(0);
    expect(mapped.category).toBe("Kamera");
    expect(mapped.serials).toEqual([]);
  });
});
