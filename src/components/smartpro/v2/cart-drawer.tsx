import { ShoppingBag, Plus, Minus, Trash2, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useStore } from "@/lib/smartpro-store";
import { formatRupiah } from "@/lib/smartpro-format";
import { computeCheckoutTotals, durationLabel } from "./checkout-logic";
import { EmptyState } from "./ui";

export function CartDrawer({
  open,
  onOpenChange,
  onCheckout,
  onQuote,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCheckout: () => void;
  onQuote: () => void;
}) {
  const { state, dispatch, currentUser } = useStore();
  const totals = computeCheckoutTotals(state.cart, 0, state.settings);
  const count = state.cart.reduce((s, l) => s + l.quantity, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full max-w-md flex-col">
        <SheetHeader>
          <SheetTitle className="wordmark text-sm">Tas Sewa</SheetTitle>
          <SheetDescription className="text-xs">
            {count} item, subtotal {formatRupiah(totals.subtotal)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 overflow-y-auto">
          {state.cart.length === 0 ? (
            <EmptyState title="Tas sewa masih kosong" note="Pilih perangkat dari katalog." />
          ) : (
            <div className="space-y-3">
              {state.cart.map((line) => (
                <div key={line.key} className="flex items-start gap-2 border-b border-border pb-2">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-soft text-gold-ink">
                    <ShoppingBag className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">{line.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatRupiah(line.price)} x {line.quantity} ({durationLabel(line.duration)})
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      aria-label={`Kurangi ${line.name}`}
                      onClick={() => dispatch({ type: "updateCartQty", key: line.key, delta: -1 })}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="min-w-4 text-center text-xs font-semibold">
                      {line.quantity}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      aria-label={`Tambah ${line.name}`}
                      onClick={() => dispatch({ type: "updateCartQty", key: line.key, delta: 1 })}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 text-alert"
                      aria-label={`Hapus ${line.name}`}
                      onClick={() => dispatch({ type: "removeCartLine", key: line.key })}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border pt-3">
          <div className="flex justify-between text-sm font-semibold">
            <span>Subtotal</span>
            <span>{formatRupiah(totals.subtotal)}</span>
          </div>
          {currentUser?.kycStatus !== "Verified" && (
            <p className="mt-1 text-[10px] font-semibold text-amber">
              Akun belum terverifikasi. Lengkapi KYC untuk bertransaksi penuh.
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="text-xs"
              disabled={state.cart.length === 0}
              onClick={onQuote}
            >
              <FileText className="size-4" /> Penawaran
            </Button>
            <Button className="text-xs" disabled={state.cart.length === 0} onClick={onCheckout}>
              Checkout
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
