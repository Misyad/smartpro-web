import { useState } from "react";
import { Star, Plus, Minus, BookOpen, X, Wrench, Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BrandMark, ProductArt } from "@/components/smartpro/product-card";
import {
  getAvailableUnits,
  periodPrice,
  type Product,
  type RentalDuration,
} from "@/lib/smartpro-data";
import { formatRupiah } from "@/lib/smartpro-format";
import { useStore } from "@/lib/smartpro-store";
import { AvailabilityCalendar } from "./availability-calendar";

function BestSellerBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-[9px] font-bold uppercase text-primary">
      <Star className="size-3 fill-current" /> Best Seller
    </span>
  );
}

function ProductVisual({ product }: { product: Product }) {
  if (product.imageUrl) {
    return (
      <img
        src={product.imageUrl}
        alt={product.name}
        className="relative z-[1] h-40 w-full object-contain"
      />
    );
  }
  return <ProductArt art={product.art} name={product.name} />;
}

export function CatalogProductCard({
  product,
  startDate,
  endDate,
  onSelectRange,
  onRequireLogin,
}: {
  product: Product;
  startDate: string;
  endDate: string;
  onSelectRange?: (start: string, end: string) => void;
  onRequireLogin?: () => void;
}) {
  const { state, currentUser, dispatch } = useStore();
  const [detailOpen, setDetailOpen] = useState(false);
  const [duration, setDuration] = useState<RentalDuration>(product.active12h ? "12h" : "24h");

  const wished = Boolean(currentUser?.wishlist.includes(product.id));
  const toggleWishlist = () => {
    if (!currentUser) {
      onRequireLogin?.();
      return;
    }
    dispatch({ type: "toggleWishlist", userId: currentUser.id, productId: product.id });
  };

  const available = getAvailableUnits(product, startDate, endDate);
  const maintenance = product.serials.filter((s) => s.status === "MAINTENANCE").length;
  const showDuration = duration === "12h" ? product.active12h : product.active24h;
  const effectiveDuration: RentalDuration = showDuration
    ? duration
    : product.active12h
      ? "12h"
      : "24h";

  const addToCart = () => {
    const price = periodPrice(product, effectiveDuration);
    dispatch({
      type: "addToCart",
      line: {
        key: `product:${product.id}:${effectiveDuration}`,
        name: `${product.name} (${effectiveDuration === "12h" ? "12 Jam" : "24 Jam"})`,
        duration: effectiveDuration,
        price,
        quantity: 1,
        rewardPoints: product.rewardPoints,
        productId: product.id,
      },
    });
    setDetailOpen(false);
  };

  const inCartQty = state.cart
    .filter((l) => l.productId === product.id)
    .reduce((s, l) => s + l.quantity, 0);

  return (
    <>
      <article className="tag-card relative flex h-full flex-col">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="tag-stage text-left"
          aria-label={`Lihat detail ${product.name}`}
        >
          <span className="tag-hole" aria-hidden="true" />
          <div className="absolute left-3 top-3 z-[2]">
            {product.bestSeller && <BestSellerBadge />}
          </div>
          <ProductVisual product={product} />
          <div className="tag-price-tab">
            <span className="wordmark text-xs font-semibold">
              {formatRupiah(periodPrice(product, effectiveDuration))}
            </span>
            <span className="mt-1 text-[9px] font-bold tracking-[0.08em] text-muted-foreground">
              / {effectiveDuration === "12h" ? "12 JAM" : "24 JAM"}
            </span>
          </div>
          <div className="absolute bottom-3 left-3 right-3 z-[2] flex flex-wrap gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                available === 0
                  ? "border-alert/20 bg-alert-soft text-alert"
                  : "border-success/20 bg-success-soft text-success"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${available === 0 ? "bg-alert" : "bg-success"}`}
              />
              {available === 0 ? "Terbooking Penuh" : `Tersedia ${available} Unit`}
            </span>
            {maintenance > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber/20 bg-amber-soft px-2.5 py-1 text-[10px] font-semibold text-amber">
                <Wrench className="size-3" /> {maintenance} Servis
              </span>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={toggleWishlist}
          aria-label={
            wished ? `Hapus ${product.name} dari wishlist` : `Simpan ${product.name} ke wishlist`
          }
          className="absolute right-3 top-3 z-[3] grid size-9 place-items-center rounded-full border border-border bg-card/95 backdrop-blur"
        >
          <Heart
            className={`size-4 ${wished ? "fill-alert text-alert" : "text-muted-foreground"}`}
          />
        </button>

        <div className="flex flex-1 flex-col px-1 pb-1 pt-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="wordmark text-[11px] font-semibold leading-5">{product.name}</h3>
              <p className="mt-1 min-h-10 text-[10px] font-medium leading-[1.55] text-muted-foreground">
                {product.accessories}
              </p>
            </div>
            <BrandMark />
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-xs"
              onClick={() => setDetailOpen(true)}
            >
              <BookOpen className="size-3.5" /> Detail
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-full px-3 text-xs"
              onClick={addToCart}
              disabled={available === 0}
            >
              <Plus className="size-3.5" /> {inCartQty > 0 ? `Tambah (${inCartQty})` : "Sewa"}
            </Button>
          </div>
        </div>
      </article>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-2">
              {product.bestSeller && <BestSellerBadge />}
              <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
                {product.category}
              </span>
            </div>
            <DialogTitle className="wordmark mt-1 text-base">{product.name}</DialogTitle>
            <DialogDescription className="text-xs">
              Ketersediaan pada tanggal terpilih: {available} unit.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid min-h-40 place-items-center rounded-lg bg-stage p-3">
              <ProductVisual product={product} />
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Pilih durasi
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["12h", "24h"] as RentalDuration[]).map((d) => {
                    const active = d === "12h" ? product.active12h : product.active24h;
                    return (
                      <Button
                        key={d}
                        variant={effectiveDuration === d ? "default" : "outline"}
                        size="sm"
                        disabled={!active}
                        onClick={() => setDuration(d)}
                        className="h-auto flex-col py-2"
                      >
                        <span className="wordmark text-xs">
                          {d === "12h" ? "12 Jam" : "24 Jam"}
                        </span>
                        <span className="mt-0.5 text-[10px] font-normal">
                          {active ? formatRupiah(periodPrice(product, d)) : "Non-aktif"}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-sm border border-border bg-surface-soft p-3">
                <p className="text-[10px] font-semibold text-muted-foreground">Reward poin</p>
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-gold-ink">
                  <Star className="size-3.5 fill-current" /> +{product.rewardPoints} poin per sewa
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase text-muted-foreground">
              Kalender ketersediaan
            </p>
            <AvailabilityCalendar
              product={product}
              startDate={startDate}
              endDate={endDate}
              onSelectRange={(s, e) => onSelectRange?.(s, e)}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Klik dua tanggal untuk memilih rentang sewa.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                Spesifikasi
              </p>
              <p className="mt-1 leading-relaxed text-muted-foreground">{product.specs}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                Kelengkapan bawaan
              </p>
              <p className="mt-1 leading-relaxed text-muted-foreground">{product.accessories}</p>
            </div>
            <div className="border-l-2 border-gold bg-amber-soft px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase text-amber">Quick-start</p>
              <p className="mt-1 text-[11px] leading-relaxed text-amber">
                Sambungkan perangkat, cek daya, lalu uji input sebelum produksi dimulai.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <div>
              <p className="text-[10px] text-muted-foreground">Subtotal 1 periode</p>
              <p className="wordmark text-sm font-semibold">
                {formatRupiah(periodPrice(product, effectiveDuration))}
              </p>
            </div>
            <Button className="rounded-full" onClick={addToCart} disabled={available === 0}>
              <Plus className="size-4" /> Tambah ke Tas Sewa
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setDetailOpen(false)}
            className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-surface-soft"
            aria-label="Tutup detail"
          >
            <X className="size-4" />
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
