import { useCallback, useEffect, useMemo, useState } from "react";

import { getBrowserClient, isBackendEnabled } from "@/lib/supabase-client";
import {
  addWishlist,
  fetchBundles,
  fetchProducts,
  fetchProfile,
  fetchSettings,
  fetchTransactions,
  fetchVouchers,
  fetchWishlist,
  removeWishlist,
} from "@/lib/smartpro-repo";
import type { Bundle, Product, Transaction, User, Voucher } from "@/lib/smartpro-data";

/**
 * Live data bridge.
 *
 * The app renders from a local reducer (smartpro-store). Rather than rewriting
 * every component, this hook hydrates the *same* domain objects from Supabase
 * and keeps auth in sync. When Supabase is not configured it reports
 * `enabled=false` and the app keeps working from local demo data, so a preview
 * build without secrets still renders.
 *
 * Writes that change money never happen here; they go through server functions.
 */

export type LiveState = {
  enabled: boolean;
  loading: boolean;
  error: string | null;
  products: Product[];
  bundles: Bundle[];
  vouchers: Voucher[];
  transactions: Transaction[];
  user: User | null;
  authUserId: string | null;
  vipDiscountPercent: number;
  rupiahPerPoin: number;
  minPoinTukar: number;
};

const DEFAULT_RATES = {
  vipDiscountPercent: 10,
  rupiahPerPoin: 500,
  minPoinTukar: 100,
};

const EMPTY: LiveState = {
  enabled: false,
  loading: false,
  error: null,
  products: [],
  bundles: [],
  vouchers: [],
  transactions: [],
  user: null,
  authUserId: null,
  ...DEFAULT_RATES,
};

export function useLiveData() {
  const enabled = isBackendEnabled();
  const [state, setState] = useState<LiveState>({
    ...EMPTY,
    enabled,
    loading: enabled,
  });

  const loadAll = useCallback(async (userId?: string | null) => {
    const client = getBrowserClient();
    if (!client) return;

    try {
      const [products, bundles, vouchers] = await Promise.all([
        fetchProducts(client),
        fetchBundles(client),
        fetchVouchers(client),
      ]);

      const settings = await fetchSettings(client).catch(() => null);

      let user: User | null = null;
      let transactions: Transaction[] = [];

      if (userId) {
        const [profile, txns, wish] = await Promise.all([
          fetchProfile(client, userId).catch(() => null),
          fetchTransactions(client, userId).catch(() => []),
          fetchWishlist(client, userId).catch(() => []),
        ]);
        user = profile ? { ...profile, wishlist: wish } : null;
        transactions = txns;
      }

      setState({
        enabled: true,
        loading: false,
        error: null,
        products,
        bundles,
        vouchers,
        transactions,
        user,
        authUserId: userId ?? null,
        vipDiscountPercent: settings?.vipDiscountPercent ?? DEFAULT_RATES.vipDiscountPercent,
        rupiahPerPoin: settings?.rupiahPerPoin ?? DEFAULT_RATES.rupiahPerPoin,
        minPoinTukar: settings?.minPoinTukar ?? DEFAULT_RATES.minPoinTukar,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "gagal memuat data",
      }));
    }
  }, []);

  useEffect(() => {
    const client = getBrowserClient();
    if (!client) return;

    void client.auth.getSession().then(({ data }) => {
      void loadAll(data.session?.user.id ?? null);
    });

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      void loadAll(session?.user.id ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, [loadAll]);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = getBrowserClient();
    if (!client) throw new Error("Backend belum dikonfigurasi");
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name: string, phone?: string) => {
      const client = getBrowserClient();
      if (!client) throw new Error("Backend belum dikonfigurasi");
      const { error } = await client.auth.signUp({
        email,
        password,
        options: { data: { name, ...(phone ? { phone } : {}) } },
      });
      if (error) throw new Error(error.message);
    },
    [],
  );

  const signOut = useCallback(async () => {
    const client = getBrowserClient();
    if (!client) return;
    await client.auth.signOut();
  }, []);

  const refresh = useCallback(async () => {
    await loadAll(state.authUserId);
  }, [loadAll, state.authUserId]);

  const toggleWishlist = useCallback(
    async (productId: string) => {
      const client = getBrowserClient();
      if (!client || !state.authUserId) return;
      const has = state.user?.wishlist.includes(productId) ?? false;
      if (has) await removeWishlist(client, state.authUserId, productId);
      else await addWishlist(client, state.authUserId, productId);
      await refresh();
    },
    [state.authUserId, state.user, refresh],
  );

  return useMemo(
    () => ({ ...state, signIn, signUp, signOut, refresh, toggleWishlist }),
    [state, signIn, signUp, signOut, refresh, toggleWishlist],
  );
}

export type LiveData = ReturnType<typeof useLiveData>;
