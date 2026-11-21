import { Copy, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/smartpro-store";
import { formatDate, formatRupiah, todayISO } from "@/lib/smartpro-format";
import { computeCheckoutTotals, durationLabel } from "./checkout-logic";

export function QuotationModal({
  open,
  onOpenChange,
  notify,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  notify: (msg: string) => void;
}) {
  const { state } = useStore();
  const totals = computeCheckoutTotals(state.cart, 0, state.settings);
  const date = formatDate(todayISO());

  const summary = `Penawaran SMartPro ${date} - Total ${formatRupiah(totals.total)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="smartpro-quotation-print"
        className="max-h-[92vh] max-w-3xl overflow-y-auto p-0"
      >
        <div className="p-6 sm:p-9">
          <DialogHeader className="print-hide mb-4 text-left">
            <DialogTitle className="wordmark text-sm">Penawaran Harga / RAB</DialogTitle>
            <DialogDescription className="text-xs">
              Cetak atau simpan sebagai PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start justify-between border-b-2 border-primary pb-4">
            <div>
              <p className="wordmark text-sm font-bold">SMartPro</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Audio Video Production</p>
            </div>
            <div className="text-right">
              <p className="wordmark text-[10px] font-semibold">SURAT PENAWARAN</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{date}</p>
            </div>
          </div>
          <table className="mt-4 w-full text-left text-[10px]">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="py-2">Deskripsi</th>
                <th className="py-2 text-center">Durasi</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Harga</th>
                <th className="py-2 text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {state.cart.map((line) => (
                <tr key={line.key} className="border-b border-border/60">
                  <td className="py-2 font-semibold">{line.name}</td>
                  <td className="py-2 text-center">{durationLabel(line.duration)}</td>
                  <td className="py-2 text-center">{line.quantity}</td>
                  <td className="py-2 text-right">{formatRupiah(line.price)}</td>
                  <td className="py-2 text-right">{formatRupiah(line.price * line.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ml-auto mt-4 max-w-xs space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatRupiah(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between border-t border-primary pt-2 text-sm font-bold">
              <span>Total penawaran</span>
              <span>{formatRupiah(totals.total)}</span>
            </div>
          </div>
          <p className="mt-6 border-t border-border pt-3 text-[9px] text-muted-foreground">
            Penawaran ini estimasi untuk item dan durasi tercantum. Ketersediaan dikonfirmasi saat
            melakukan pemesanan.
          </p>
        </div>
        <DialogFooter className="print-hide border-t border-border bg-surface-soft px-5 py-3 sm:justify-between">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(summary);
                notify("Ringkasan penawaran disalin.");
              } catch {
                notify(summary);
              }
            }}
          >
            <Copy className="size-4" /> Salin ringkasan
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4" /> Cetak / Simpan PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
