import { useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Wallet, Copy, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/smartpro-store";
import {
  genUniqueCode,
  type PaymentMethod,
  type PaymentRecord,
  type PaymentStage,
  type Transaction,
} from "@/lib/smartpro-data";
import { formatRupiah } from "@/lib/smartpro-format";
import { computeCheckoutTotals, durationLabel } from "./checkout-logic";
import { SingleImageUpload } from "./image-upload";
import { StatusPill } from "./ui";

export function CheckoutModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { state, currentUser, dispatch } = useStore();
  const [method, setMethod] = useState<PaymentMethod>("transfer");
  const [stage, setStage] = useState<PaymentStage>("DP");
  const [proof, setProof] = useState<string | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [done, setDone] = useState<Transaction | null>(null);

  const totals = useMemo(
    () => computeCheckoutTotals(state.cart, pointsToRedeem, state.settings),
    [state.cart, pointsToRedeem, state.settings],
  );

  if (!currentUser) return null;

  const payingAmount = stage === "DP" ? totals.dpAmount : totals.remainingAmount;

  const reset = () => {
    setMethod("transfer");
    setStage("DP");
    setProof(null);
    setPointsToRedeem(0);
    setDone(null);
  };

  const submit = () => {
    if (method === "transfer" && !proof) return;
    const uniqueCode = method === "transfer" ? genUniqueCode() : 0;
    const transactionId = `trx-${Date.now()}`;
    const code = `SMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const transaction: Transaction = {
      id: transactionId,
      code,
      customerId: currentUser.id,
      customerName: currentUser.name,
      customerPhone: currentUser.phone,
      lines: state.cart.map((line) => ({
        key: line.key,
        name: line.name,
        duration: line.duration,
        price: line.price,
        quantity: line.quantity,
        rewardPoints: line.rewardPoints,
      })),
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      subtotal: totals.subtotal,
      pointsDiscount: totals.pointsDiscount,
      total: totals.total,
      pointsRedeemed: pointsToRedeem,
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
      amount: payingAmount,
      uniqueCode,
      proofUrl: proof,
      status: "Menunggu",
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "addTransaction", transaction, payments: [payment] });
    dispatch({ type: "clearCart" });
    if (pointsToRedeem > 0) {
      dispatch({
        type: "updateUser",
        userId: currentUser.id,
        patch: { points: Math.max(0, currentUser.points - pointsToRedeem) },
      });
    }
    setDone(transaction);
  };

  const transferTotal = totals.total + (method === "transfer" ? 0 : 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        {done ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto size-10 text-success" />
            <DialogTitle className="wordmark mt-3 text-base">Pesanan dibuat</DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Kode booking <strong>{done.code}</strong>. Menunggu persetujuan pembayaran oleh Admin.
            </p>
            <div className="mx-auto mt-4 max-w-sm border border-border bg-surface-soft p-3 text-left text-[11px]">
              <p>Metode: {done.method === "transfer" ? "Transfer Bank" : "Cash"}</p>
              {done.method === "transfer" && (
                <p className="mt-1">
                  Total transfer: <strong>{formatRupiah(payingAmount + done.uniqueCode)}</strong>{" "}
                  (termasuk kode unik {done.uniqueCode})
                </p>
              )}
              <p className="mt-1">
                Status pembayaran: <StatusPill status="Menunggu" />
              </p>
            </div>
            <Button className="mt-4 rounded-full" onClick={() => onOpenChange(false)}>
              Selesai
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="text-left">
              <DialogTitle className="wordmark text-base">Checkout Pembayaran</DialogTitle>
              <DialogDescription className="text-xs">
                Pelanggan: {currentUser.name}. Selesaikan pembayaran, Admin akan memverifikasi.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {state.cart.map((line) => (
                <div
                  key={line.key}
                  className="flex items-start justify-between gap-2 border-b border-border pb-2 text-xs"
                >
                  <div>
                    <p className="font-semibold">{line.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatRupiah(line.price)} x {line.quantity} ({durationLabel(line.duration)})
                    </p>
                  </div>
                  <strong>{formatRupiah(line.price * line.quantity)}</strong>
                </div>
              ))}
            </div>

            {currentUser.points >= state.settings.minPoinTukar && (
              <div className="border border-gold/30 bg-amber-soft p-3">
                <label className="flex items-center justify-between gap-2 text-[11px]">
                  <span>
                    <span className="block font-semibold text-amber">
                      Tukar poin (punya {currentUser.points})
                    </span>
                    <span className="mt-0.5 block text-[10px] text-amber">
                      1 poin = {formatRupiah(state.settings.rupiahPerPoin)}, min{" "}
                      {state.settings.minPoinTukar} poin
                    </span>
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={currentUser.points}
                    value={pointsToRedeem}
                    onChange={(e) =>
                      setPointsToRedeem(
                        Math.max(0, Math.min(currentUser.points, Number(e.target.value) || 0)),
                      )
                    }
                    className="h-9 w-24 text-xs"
                  />
                </label>
              </div>
            )}

            <div className="border border-border bg-surface-soft p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatRupiah(totals.subtotal)}</span>
              </div>
              {totals.pointsDiscount > 0 && (
                <div className="mt-1 flex justify-between text-success">
                  <span>Potongan poin</span>
                  <span>-{formatRupiah(totals.pointsDiscount)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatRupiah(totals.total)}</span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Anda akan mendapat +{totals.rewardPoints} poin setelah lunas.
              </p>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                Tahap pembayaran
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["DP", "Pelunasan"] as PaymentStage[]).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={stage === s ? "default" : "outline"}
                    className="h-auto flex-col py-2"
                    onClick={() => setStage(s)}
                  >
                    <span className="wordmark text-xs">{s === "DP" ? "DP 30%" : "Pelunasan"}</span>
                    <span className="mt-0.5 text-[10px] font-normal">
                      {formatRupiah(s === "DP" ? totals.dpAmount : totals.remainingAmount)}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                Metode pembayaran
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={method === "transfer" ? "default" : "outline"}
                  className="h-auto flex-col py-2"
                  onClick={() => setMethod("transfer")}
                >
                  <CreditCard className="size-4" />{" "}
                  <span className="text-[10px]">Transfer Bank</span>
                </Button>
                <Button
                  size="sm"
                  variant={method === "cash" ? "default" : "outline"}
                  className="h-auto flex-col py-2"
                  onClick={() => setMethod("cash")}
                >
                  <Wallet className="size-4" /> <span className="text-[10px]">Cash / Tunai</span>
                </Button>
              </div>
            </div>

            {method === "transfer" ? (
              <div className="border border-border bg-surface-soft p-3 text-xs">
                <p className="font-semibold">Rekening tujuan</p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  BCA 1234567890 a.n. SMartPro Audio Video
                  <Copy className="size-3" aria-hidden="true" />
                </p>
                <p className="mt-2">
                  Transfer: <strong>{formatRupiah(payingAmount)}</strong> + kode unik 3 digit. Kode
                  unik dibuat otomatis saat pesanan dibuat agar mutasi mudah dilacak.
                </p>
                <div className="mt-2">
                  <SingleImageUpload label="Bukti transfer" value={proof} onChange={setProof} />
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 border border-border bg-surface-soft p-3 text-[11px] text-muted-foreground">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                Pembayaran cash diproses manual dan menunggu persetujuan Admin sebelum dianggap
                lunas.
              </div>
            )}

            {method === "transfer" && !proof && (
              <p className="text-[10px] font-semibold text-alert">
                Unggah bukti transfer untuk melanjutkan.
              </p>
            )}

            <Button
              className="w-full rounded-full"
              onClick={submit}
              disabled={method === "transfer" && !proof}
            >
              Buat Pesanan & Ajukan Pembayaran
            </Button>
            <p className="text-center text-[10px] text-muted-foreground">
              Total transfer akhir: {formatRupiah(transferTotal)} (kode unik ditambahkan otomatis).
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
