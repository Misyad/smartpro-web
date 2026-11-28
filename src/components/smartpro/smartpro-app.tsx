import { useEffect, useMemo, useState } from "react";
import { useLoaderData } from "@tanstack/react-router";
import { ShoppingBag, Search, LogOut, LogIn, Star, LayoutDashboard, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/smartpro/product-card";
import { useStore } from "@/lib/smartpro-store";
import { useLiveData } from "@/lib/smartpro-live";
import { formatRupiah, todayISO, addDaysISO } from "@/lib/smartpro-format";
import { getBundleAvailability, getAvailableUnits, type User } from "@/lib/smartpro-data";

import { AuthScreen } from "./v2/auth-screen";
import { KycScreen } from "./v2/kyc-screen";
import { CatalogProductCard } from "./v2/catalog-product-card";
import { CartDrawer } from "./v2/cart-drawer";
import { CheckoutModal } from "./v2/checkout-modal";
import { QuotationModal } from "./v2/quotation-modal";
import { CustomerRentals } from "./v2/customer-rentals";
import { AdminDashboard } from "./v2/admin-dashboard";
import { EmptyState } from "./v2/ui";

const CATEGORIES = ["Semua Alat", "Kamera", "Wireless Video", "Switcher & Live"] as const;

export function SmartProApp() {
  const { state: localState, currentUser: localUser, dispatch } = useStore();
  const live = useLiveData();

  // The route loader fetched the catalog on the server, so the first render
  // already contains products. `useLiveData` keeps them fresh after hydration.
  const initial = useLoaderData({ from: "/" }) as
    { products?: unknown[]; bundles?: unknown[]; vouchers?: unknown[] } | undefined;

  // Priority: live query result -> SSR loader payload -> local demo data.
  const state = useMemo(() => {
    const loaderProducts = (initial?.products ?? []) as typeof localState.products;
    const loaderBundles = (initial?.bundles ?? []) as typeof localState.bundles;
    const loaderVouchers = (initial?.vouchers ?? []) as typeof localState.vouchers;

    return {
      ...localState,
      products: live.products.length
        ? live.products
        : loaderProducts.length
          ? loaderProducts
          : localState.products,
      bundles: live.bundles.length
        ? live.bundles
        : loaderBundles.length
          ? loaderBundles
          : localState.bundles,
      vouchers: live.vouchers.length
        ? live.vouchers
        : loaderVouchers.length
          ? loaderVouchers
          : localState.vouchers,
      transactions: live.transactions.length ? live.transactions : localState.transactions,
    };
  }, [localState, live, initial]);

  const currentUser = live.enabled ? (live.user ?? null) : localUser;
  const [view, setView] = useState<"catalog" | "rentals" | "admin">("catalog");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Semua Alat");
  const [search, setSearch] = useState("");
  const [bestOnly, setBestOnly] = useState(false);
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addDaysISO(todayISO(), 1));
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [notice, setNotice] = useState("");

  const notify = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 3200);
  };

  const filteredProducts = useMemo(
    () =>
      state.products.filter((p) => {
        const matchesCategory = category === "Semua Alat" || p.category === category;
        const matchesSearch = `${p.name} ${p.category}`
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesBest = !bestOnly || p.bestSeller;
        return matchesCategory && matchesSearch && matchesBest;
      }),
    [state.products, category, search, bestOnly],
  );

  // After a successful login, resume a pending checkout if the user is verified.
  useEffect(() => {
    if (!pendingCheckout || !currentUser) return;
    if (currentUser.kycStatus === "Verified") {
      setPendingCheckout(false);
      setAuthOpen(false);
      setCartOpen(false);
      setCheckoutOpen(true);
    }
  }, [currentUser, pendingCheckout]);

  const isAdmin = currentUser?.role === "admin";
  const cartCount = state.cart.reduce((s, l) => s + l.quantity, 0);

  const startCheckout = () => {
    if (!currentUser) {
      setCartOpen(false);
      setPendingCheckout(true);
      setAuthOpen(true);
      return;
    }
    if (currentUser.kycStatus !== "Verified") {
      notify("Lengkapi verifikasi KYC sebelum checkout.");
      setView("rentals");
      setCartOpen(false);
      return;
    }
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  return (
    <div className="smartpro-app flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-10" />
            <div>
              <p className="wordmark text-[10px] font-bold leading-4">SMartPro</p>
              <p className="text-[10px] font-medium text-muted-foreground">
                Audio Video Production
              </p>
            </div>
          </div>

          <div className="order-3 flex w-full items-center rounded-full bg-surface-soft p-1 sm:order-2 sm:ml-auto sm:w-auto">
            {isAdmin ? (
              <>
                <Button
                  variant={view === "catalog" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 flex-1 rounded-full px-3 text-[11px] sm:flex-none"
                  onClick={() => setView("catalog")}
                >
                  <Store className="size-3.5" /> Katalog
                </Button>
                <Button
                  variant={view === "admin" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 flex-1 rounded-full px-3 text-[11px] sm:flex-none"
                  onClick={() => setView("admin")}
                >
                  <LayoutDashboard className="size-3.5" /> Dashboard Admin
                </Button>
              </>
            ) : currentUser ? (
              <>
                <Button
                  variant={view === "catalog" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 flex-1 rounded-full px-3 text-[11px] sm:flex-none"
                  onClick={() => setView("catalog")}
                >
                  <Store className="size-3.5" /> Katalog
                </Button>
                <Button
                  variant={view === "rentals" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 flex-1 rounded-full px-3 text-[11px] sm:flex-none"
                  onClick={() => setView("rentals")}
                >
                  <ShoppingBag className="size-3.5" /> Sewa Saya
                </Button>
              </>
            ) : (
              <span className="px-3 text-[11px] font-semibold text-muted-foreground">
                Katalog Sewa
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 sm:order-3 sm:ml-0">
            {currentUser ? (
              <>
                <div className="hidden text-right sm:block">
                  <p className="text-[10px] font-semibold">{currentUser.name}</p>
                  <p className="text-[9px] text-muted-foreground">{accountLabel(currentUser)}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-full px-3 text-xs"
                  onClick={async () => {
                    // With a real backend the session lives in Supabase Auth, so
                    // clearing only the local reducer would leave the user signed
                    // in and bounce them straight back. Sign out of both.
                    if (live.enabled) await live.signOut();
                    dispatch({ type: "logout" });
                  }}
                  aria-label="Keluar"
                >
                  <LogOut className="size-3.5" />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="h-9 rounded-full px-4 text-xs"
                onClick={() => setAuthOpen(true)}
              >
                <LogIn className="size-3.5" /> Masuk
              </Button>
            )}
            {!isAdmin && (
              <Button
                size="sm"
                className="h-9 rounded-full px-3 text-xs"
                onClick={() => setCartOpen(true)}
              >
                <ShoppingBag className="size-3.5" />
                <span className="hidden sm:inline">Tas</span>
                {cartCount > 0 && (
                  <span className="grid size-5 place-items-center rounded-full bg-gold text-[10px] text-primary">
                    {cartCount}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        {view === "admin" && isAdmin && <AdminDashboard />}

        {view === "rentals" && currentUser && !isAdmin && (
          <div className="space-y-4">
            {currentUser.kycStatus !== "Verified" && <KycScreen />}
            <CustomerRentals />
          </div>
        )}

        {view === "catalog" && (
          <>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="section-label">Rental gear - Jakarta</p>
                <h1 className="wordmark text-xl font-semibold sm:text-2xl">Katalog Perangkat</h1>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="Cari perangkat"
                    placeholder="Cari perangkat..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 w-44 rounded-full border-transparent bg-surface-soft pl-9 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  variant={bestOnly ? "default" : "outline"}
                  className="h-9 rounded-full px-3 text-xs"
                  onClick={() => setBestOnly((v) => !v)}
                >
                  <Star className={`size-3.5 ${bestOnly ? "fill-current" : ""}`} /> Best Seller
                </Button>
              </div>
            </div>

            <div className="mb-5 grid gap-3 border-y border-border bg-card py-3 sm:grid-cols-2 sm:px-3">
              <label className="text-[10px] font-semibold text-muted-foreground">
                Tanggal ambil
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 h-9 text-sm"
                />
              </label>
              <label className="text-[10px] font-semibold text-muted-foreground">
                Tanggal kembali
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 h-9 text-sm"
                />
              </label>
            </div>

            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {CATEGORIES.map((c) => (
                <Button
                  key={c}
                  size="sm"
                  variant={category === c ? "default" : "outline"}
                  className="h-9 shrink-0 rounded-full px-3 text-xs"
                  onClick={() => setCategory(c)}
                >
                  {c}
                </Button>
              ))}
            </div>

            {filteredProducts.length === 0 ? (
              <EmptyState title="Perangkat tidak ditemukan" note="Ubah kata kunci atau filter." />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredProducts.map((product) => (
                  <CatalogProductCard
                    key={product.id}
                    product={product}
                    startDate={startDate}
                    endDate={endDate}
                    onSelectRange={(s, e) => {
                      setStartDate(s);
                      setEndDate(e);
                    }}
                    onRequireLogin={() => setAuthOpen(true)}
                  />
                ))}
              </div>
            )}

            <div className="mt-8">
              <h2 className="wordmark mb-3 text-sm font-semibold">Paket Bundling</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {state.bundles.map((bundle) => {
                  const availability = getBundleAvailability(
                    bundle,
                    state.products,
                    startDate,
                    endDate,
                  );
                  return (
                    <div key={bundle.id} className="tag-card flex h-full flex-col border-gold/40">
                      <div className="tag-stage min-h-32">
                        <span className="tag-hole" aria-hidden="true" />
                        <div className="px-4 py-8 text-center">
                          <p className="wordmark text-xs font-semibold">{bundle.name}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">{bundle.note}</p>
                        </div>
                        <div className="tag-price-tab">
                          <span className="wordmark text-xs font-semibold">
                            {formatRupiah(bundle.price)}
                          </span>
                          <span className="mt-1 text-[9px] font-bold text-muted-foreground">
                            / 24 JAM
                          </span>
                        </div>
                        <span
                          className={`absolute bottom-3 left-3 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                            availability > 0
                              ? "border-success/20 bg-success-soft text-success"
                              : "border-alert/20 bg-alert-soft text-alert"
                          }`}
                        >
                          {availability > 0 ? `Tersedia ${availability} Paket` : "Paket penuh"}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col px-1 pb-1 pt-3">
                        <Button
                          size="sm"
                          className="mt-auto h-9 rounded-full text-xs"
                          disabled={availability === 0}
                          onClick={() => {
                            dispatch({
                              type: "addToCart",
                              line: {
                                key: `bundle:${bundle.id}`,
                                name: bundle.name,
                                duration: "24h",
                                price: bundle.price,
                                quantity: 1,
                                rewardPoints: 0,
                              },
                            });
                            notify(`${bundle.name} ditambahkan.`);
                          }}
                        >
                          Tambah paket
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-[10px] text-muted-foreground sm:px-6 lg:px-8">
          <span className="wordmark font-semibold text-foreground">
            SMartPro - Audio Video Production
          </span>
          <span>Simulasi antarmuka - data tersimpan di sesi ini</span>
        </div>
      </footer>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-[100] -translate-x-1/2 border border-border bg-card px-4 py-2.5 text-xs font-semibold shadow-tag"
        >
          {notice}
        </div>
      )}

      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        onCheckout={startCheckout}
        onQuote={() => {
          setCartOpen(false);
          setQuoteOpen(true);
        }}
      />
      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} />
      <QuotationModal open={quoteOpen} onOpenChange={setQuoteOpen} notify={notify} />

      {authOpen && !currentUser && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-background/80 backdrop-blur-sm">
          <AuthScreen onClose={() => setAuthOpen(false)} />
        </div>
      )}
    </div>
  );
}

function accountLabel(user: User): string {
  if (user.role === "admin") return "Admin";
  if (user.isVip) return "Mitra VIP";
  if (user.kycStatus === "Verified") return "Verified";
  if (user.kycStatus === "Menunggu") return "Menunggu Approval Admin";
  if (user.kycStatus === "Ditolak") return "Verifikasi Ditolak";
  return "Belum Verifikasi";
}
