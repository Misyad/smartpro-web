import { BookOpen, Check, Plus, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/smartpro-data";

type ProductCardProps = {
  product: Product;
  available: number;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  onGuide: () => void;
};

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-label="SMartPro"
      className={`sp-monogram ${className}`}
      viewBox="0 0 48 48"
      role="img"
    >
      <defs>
        <linearGradient id="sp-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--gold-light)" />
          <stop offset="50%" stopColor="var(--gold-mid)" />
          <stop offset="100%" stopColor="var(--gold-deep)" />
        </linearGradient>
      </defs>
      <path d="M24 1 47 24 24 47 1 24 24 1Z" fill="url(#sp-gold)" />
      <path d="M24 7 41 24 24 41 7 24 24 7Z" fill="none" stroke="var(--card)" strokeOpacity=".72" />
      <text
        x="24"
        y="29"
        textAnchor="middle"
        fill="var(--foreground)"
        fontFamily="var(--font-family-display)"
        fontSize="12"
        fontWeight="700"
      >
        SP
      </text>
    </svg>
  );
}

export function ProductArt({ art, name }: { art: Product["art"]; name: string }) {
  return (
    <svg
      className="product-illustration"
      viewBox="0 0 240 170"
      role="img"
      aria-label={`Ilustrasi ${name}`}
    >
      {art === "wireless" && (
        <g stroke="var(--foreground)" strokeWidth="3" strokeLinejoin="round">
          <rect x="38" y="43" width="70" height="88" rx="10" fill="var(--foreground)" />
          <rect x="48" y="53" width="50" height="48" rx="4" fill="var(--stage)" />
          <path d="M58 70h30M58 80h18" stroke="var(--gold-ink)" strokeWidth="4" />
          <circle cx="73" cy="115" r="5" fill="var(--gold)" stroke="none" />
          <rect x="132" y="54" width="66" height="77" rx="9" fill="var(--card)" />
          <rect x="143" y="66" width="44" height="38" rx="3" fill="var(--stage)" />
          <path d="M150 80h28M150 89h18" stroke="var(--gold-ink)" strokeWidth="3" />
          <path d="M164 54V37m-7 0h14" fill="none" strokeWidth="3" />
          <circle cx="165" cy="116" r="4" fill="var(--gold)" stroke="none" />
        </g>
      )}
      {art === "camera" && (
        <g stroke="var(--foreground)" strokeWidth="3" strokeLinejoin="round">
          <path
            d="M41 64h32l11-14h41l12 14h49a12 12 0 0 1 12 12v48a12 12 0 0 1-12 12H41a12 12 0 0 1-12-12V76a12 12 0 0 1 12-12Z"
            fill="var(--foreground)"
          />
          <circle cx="119" cy="99" r="29" fill="var(--stage)" />
          <circle cx="119" cy="99" r="18" fill="var(--foreground)" />
          <circle cx="119" cy="99" r="8" fill="var(--gold)" stroke="none" />
          <rect x="156" y="72" width="23" height="10" rx="3" fill="var(--gold)" stroke="none" />
          <path d="M48 76h16" stroke="var(--stage)" strokeWidth="4" />
        </g>
      )}
      {art === "switcher" && (
        <g stroke="var(--foreground)" strokeWidth="3" strokeLinejoin="round">
          <path d="m38 64 82-31 82 31-82 31-82-31Z" fill="var(--card)" />
          <path d="M38 64v48l82 30v-47L38 64Z" fill="var(--foreground)" />
          <path d="M202 64v48l-82 30v-47l82-31Z" fill="var(--stage)" />
          <path d="m58 73 15 6m8-12 15 6m8-12 15 6" stroke="var(--gold)" strokeWidth="5" />
          <circle cx="142" cy="94" r="5" fill="var(--gold)" stroke="none" />
          <circle cx="159" cy="88" r="5" fill="var(--gold)" stroke="none" />
          <circle cx="176" cy="82" r="5" fill="var(--gold)" stroke="none" />
        </g>
      )}
      {art === "ptz" && (
        <g stroke="var(--foreground)" strokeWidth="3" strokeLinejoin="round">
          <rect x="77" y="105" width="86" height="27" rx="8" fill="var(--foreground)" />
          <path d="M120 104V85" strokeWidth="8" />
          <path
            d="M75 58c0-12 10-22 22-22h46c12 0 22 10 22 22v25c0 12-10 22-22 22H97c-12 0-22-10-22-22V58Z"
            fill="var(--card)"
          />
          <circle cx="120" cy="70" r="21" fill="var(--foreground)" />
          <circle cx="120" cy="70" r="10" fill="var(--gold)" stroke="none" />
          <path d="M85 50h48" stroke="var(--stage)" strokeWidth="3" />
        </g>
      )}
      {art === "monitor" && (
        <g stroke="var(--foreground)" strokeWidth="3" strokeLinejoin="round">
          <rect x="41" y="36" width="158" height="96" rx="11" fill="var(--foreground)" />
          <rect x="51" y="46" width="138" height="75" rx="4" fill="var(--stage)" />
          <path
            d="M68 98 91 75l22 18 23-29 32 34"
            fill="none"
            stroke="var(--gold-ink)"
            strokeWidth="5"
          />
          <path d="M109 132v11m-20 0h62" strokeWidth="4" />
          <circle cx="179" cy="130" r="3" fill="var(--gold)" stroke="none" />
        </g>
      )}
    </svg>
  );
}

export function ProductCard({
  product,
  available,
  quantity,
  onAdd,
  onRemove,
  onGuide,
}: ProductCardProps) {
  const maintenanceCount = product.serials.filter(
    (serial) => serial.status === "MAINTENANCE",
  ).length;
  const unavailable = available === 0;

  return (
    <article className="tag-card flex h-full flex-col">
      <div className="tag-stage">
        <span className="tag-hole" aria-hidden="true" />
        <ProductArt art={product.art} name={product.name} />
        <div className="tag-price-tab">
          <span className="wordmark text-xs font-semibold">
            {product.price.toLocaleString("id-ID")}
          </span>
          <span className="mt-1 text-[11px] font-bold tracking-[0.08em] text-muted-foreground">
            / 24 JAM
          </span>
        </div>
        <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${unavailable ? "border-alert/20 bg-alert-soft text-alert" : "border-success/20 bg-success-soft text-success"}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${unavailable ? "bg-alert" : "bg-success"}`}
            />
            {unavailable ? "Terbooking Penuh" : `Tersedia ${available} Unit`}
          </span>
          {maintenanceCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber/20 bg-amber-soft px-2.5 py-1 text-[11px] font-semibold text-amber">
              <Wrench className="size-3" /> {maintenanceCount} Servis
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-1 pb-1 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="wordmark text-[11px] font-semibold leading-5">{product.name}</h3>
            <p className="mt-1 min-h-10 text-[11px] font-medium leading-[1.55] text-muted-foreground">
              {product.accessories}
            </p>
          </div>
          <BrandMark />
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 pt-3">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onGuide}>
            <BookOpen className="size-3.5" /> Panduan
          </Button>
          {quantity > 0 ? (
            <div className="flex h-8 items-center overflow-hidden rounded-full border border-border bg-surface-soft">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-none"
                onClick={onRemove}
                aria-label={`Kurangi ${product.name}`}
              >
                <span aria-hidden="true">−</span>
              </Button>
              <span className="min-w-6 text-center text-xs font-bold">{quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-none"
                onClick={onAdd}
                disabled={quantity >= available}
                aria-label={`Tambah ${product.name}`}
              >
                {quantity >= available ? (
                  <Check className="size-3.5" />
                ) : (
                  <Plus className="size-3.5" />
                )}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              onClick={onAdd}
              disabled={unavailable}
            >
              <Plus className="size-3.5" /> Sewa Alat
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
