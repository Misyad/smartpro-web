import { useState } from "react";
import { Plus, Trash2, ShoppingBag, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/smartpro-store";
import { computeCheckoutTotals, durationLabel } from "./checkout-logic";
import {
  genUniqueCode,
  periodPrice,
  type PaymentMethod,
  type PaymentRecord,
  type PaymentStage,
  type RentalDuration,
  type Transaction,
} from "@/lib/smartpro-data";
import type { CartLine } from "@/lib/smartpro-store";
import { formatRupiah, todayISO, addDaysISO } from "@/lib/smartpro-format";
import { EmptyState, Field } from "./ui";

export function AdminManualCheckout() {
  const { state, dispatch } = useStore();
  const verifiedCustomers = state.users.filter(
    (u) => u.role === "pelanggan" && u.kycStatus === "Verified",
  );
  const [customerId, setCustomerId] = useState(verifiedCustomers[0]?.id ?? "");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addDaysISO(todayISO(), 1));
  const [method, setMethod] = useState<PaymentMethod>("transfer");
  const [stage, setStage] = useState<PaymentStage>("DP");
  const [done, setDone] = useState<string | null>(null);

  const totals = computeCheckoutTotals(lines, 0, state.settings);

  const addProductLine = (productId: string, duration: RentalDuration) => {
    const product = state.products.find((p) => p.id === productId);
    if (!product) return;
    const key = `product:${product.id}:${duration}`;
    setLines((cur) => {
      const existing = cur.find((l) => l.key === key);
      if (existing) {
        return cur.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...cur,
        {
          key,
          name: `${product.name} (${durationLabel(duration)})`,
          duration,
          price: periodPrice(product, duration),
          quantity: 1,
          rewardPoints: product.rewardPoints,
          productId: product.id,
        },
      ];
    });
  };

  const submit = () => {
    const customer = state.users.find((u) => u.id === customerId);
    if (!customer || lines.length === 0) return;
    const uniqueCode = method === "transfer" ? genUniqueCode() : 0;
    const transactionId = `trx-${Date.now()}`;
    const code = `SMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const transaction: Transaction = {
      id: transactionId,
      code,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      lines: lines.map((l) => ({
        key: l.key,
        name: l.name,
        duration: l.duration,
        price: l.price,
        quantity: l.quantity,
        rewardPoints: l.rewardPoints,
      })),
      startDate,
      endDate,
      subtotal: totals.subtotal,
      pointsDiscount: 0,
      total: totals.total,
      pointsRedeemed: 0,
      pointsEarned: totals.rewardPoints,
      dpAmount: totals.dpAmount,
      remainingAmount: totals.remainingAmount,
      method,
      uniqueCode,
      status: "Menunggu Pembayaran",
      pickupStatus: "Belum",
      createdAt: new Date().toISOString(),
    };
    const payment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      transactionId,
      stage,
      method,
      amount: stage === "DP" ? totals.dpAmount : totals.remainingAmount,
      uniqueCode,
      proofUrl: null,
      status: "Menunggu",
      note: "Dibuat oleh admin",
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "addTransaction", transaction, payments: [payment] });
    setDone(code);
    setLines([]);
  };

  if (verifiedCustomers.length === 0) {
    return (
      <EmptyState
        title="Belum ada pelanggan terverifikasi"
        note="Setujui KYC pelanggan terlebih dahulu."
      />
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md border border-border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <p className="wordmark mt-3 text-sm font-semibold">Transaksi {done} dibuat</p>
        <p className="mt-1 text-xs text-muted-foreground">Masuk ke antrean approval pembayaran.</p>
        <Button className="mt-4 rounded-full" onClick={() => setDone(null)}>
          Buat lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 border border-border bg-card p-4">
        <Field label="Pelanggan terverifikasi">
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="h-9 w-full border border-input bg-background px-2 text-sm"
          >
            {verifiedCustomers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.username})
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tanggal ambil">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 text-sm"
            />
          </Field>
          <Field label="Tanggal kembali">
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 text-sm"
            />
          </Field>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
            Tambah unit
          </p>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {state.products.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 border border-border p-2 text-[11px]"
              >
                <span className="truncate">{p.name}</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[9px]"
                    disabled={!p.active12h}
                    onClick={() => addProductLine(p.id, "12h")}
                  >
                    <Plus className="size-3" /> 12j
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[9px]"
                    disabled={!p.active24h}
                    onClick={() => addProductLine(p.id, "24h")}
                  >
                    <Plus className="size-3" /> 24j
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShoppingBag className="size-4" /> Keranjang Manual
        </p>
        {lines.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada item.</p>
        ) : (
          <div className="space-y-1">
            {lines.map((l) => (
              <div
                key={l.key}
                className="flex items-center justify-between gap-2 border-b border-border pb-1 text-[11px]"
              >
                <span className="truncate">
                  {l.name} x{l.quantity}
                </span>
                <span className="flex items-center gap-2">
                  {formatRupiah(l.price * l.quantity)}
                  <button
                    type="button"
                    aria-label={`Hapus ${l.name}`}
                    onClick={() => setLines((cur) => cur.filter((x) => x.key !== l.key))}
                    className="text-alert"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant={method === "transfer" ? "default" : "outline"}
            className="h-9 text-[10px]"
            onClick={() => setMethod("transfer")}
          >
            Transfer
          </Button>
          <Button
            size="sm"
            variant={method === "cash" ? "default" : "outline"}
            className="h-9 text-[10px]"
            onClick={() => setMethod("cash")}
          >
            Cash
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant={stage === "DP" ? "default" : "outline"}
            className="h-9 text-[10px]"
            onClick={() => setStage("DP")}
          >
            DP 30% ({formatRupiah(totals.dpAmount)})
          </Button>
          <Button
            size="sm"
            variant={stage === "Pelunasan" ? "default" : "outline"}
            className="h-9 text-[10px]"
            onClick={() => setStage("Pelunasan")}
          >
            Pelunasan ({formatRupiah(totals.remainingAmount)})
          </Button>
        </div>
        <div className="border border-border bg-surface-soft p-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <strong>{formatRupiah(totals.total)}</strong>
          </div>
        </div>
        <Button className="w-full rounded-full" disabled={lines.length === 0} onClick={submit}>
          Buat transaksi manual
        </Button>
      </div>
    </div>
  );
}
