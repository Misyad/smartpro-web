import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Transaction } from "@/lib/smartpro-data";
import { formatDateTime, formatRupiah } from "@/lib/smartpro-format";
import { durationLabel } from "./checkout-logic";

export function InvoiceModal({
  transaction,
  onClose,
}: {
  transaction: Transaction | null;
  onClose: () => void;
}) {
  if (!transaction) return null;
  const paidLabel = transaction.status === "Lunas" ? "LUNAS" : transaction.status;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        id="smartpro-invoice-print"
        className="max-h-[92vh] max-w-2xl overflow-y-auto p-0"
      >
        <div className="p-6 sm:p-8">
          <DialogHeader className="print-hide mb-4 text-left">
            <DialogTitle className="wordmark text-sm">Invoice</DialogTitle>
          </DialogHeader>
          <div className="flex items-start justify-between border-b-2 border-primary pb-3">
            <div>
              <p className="wordmark text-sm font-bold">SMartPro</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Audio Video Production</p>
            </div>
            <div className="text-right">
              <p className="wordmark text-[10px] font-semibold">INVOICE {transaction.code}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {formatDateTime(transaction.createdAt)}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase">{paidLabel}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-[10px]">
            <p>
              <span className="text-muted-foreground">Ditagihkan kepada</span>
              <br />
              <strong>{transaction.customerName}</strong>
              <br />
              {transaction.customerPhone}
            </p>
            <p>
              <span className="text-muted-foreground">Masa sewa</span>
              <br />
              {transaction.startDate} s/d {transaction.endDate}
              <br />
              Metode: {transaction.method === "transfer" ? "Transfer" : "Cash"}
            </p>
          </div>

          <table className="mt-4 w-full text-left text-[10px]">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="py-2">Item</th>
                <th className="py-2 text-center">Durasi</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Harga</th>
                <th className="py-2 text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {transaction.lines.map((l) => (
                <tr key={l.key} className="border-b border-border/60">
                  <td className="py-2 font-semibold">{l.name}</td>
                  <td className="py-2 text-center">{durationLabel(l.duration)}</td>
                  <td className="py-2 text-center">{l.quantity}</td>
                  <td className="py-2 text-right">{formatRupiah(l.price)}</td>
                  <td className="py-2 text-right">{formatRupiah(l.price * l.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto mt-4 max-w-xs space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatRupiah(transaction.subtotal)}</span>
            </div>
            {(transaction.voucherDiscount ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Voucher {transaction.voucherCode}</span>
                <span>-{formatRupiah(transaction.voucherDiscount ?? 0)}</span>
              </div>
            )}
            {(transaction.vipDiscount ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Diskon Mitra VIP</span>
                <span>-{formatRupiah(transaction.vipDiscount ?? 0)}</span>
              </div>
            )}
            {transaction.pointsDiscount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Potongan poin</span>
                <span>-{formatRupiah(transaction.pointsDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-primary pt-1 text-sm font-bold">
              <span>Total</span>
              <span>{formatRupiah(transaction.total)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>DP 30%</span>
              <span>{formatRupiah(transaction.dpAmount)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Sisa pelunasan</span>
              <span>{formatRupiah(transaction.remainingAmount)}</span>
            </div>
            {transaction.uniqueCode > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Kode unik transfer</span>
                <span>+{transaction.uniqueCode}</span>
              </div>
            )}
          </div>

          <p className="mt-5 border-t border-border pt-3 text-[9px] text-muted-foreground">
            Invoice ini dibuat otomatis oleh sistem SMartPro. Simpan sebagai bukti transaksi.
          </p>
        </div>
        <DialogFooter className="print-hide border-t border-border bg-surface-soft px-5 py-3">
          <Button onClick={() => window.print()}>
            <Printer className="size-4" /> Cetak / Simpan PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
