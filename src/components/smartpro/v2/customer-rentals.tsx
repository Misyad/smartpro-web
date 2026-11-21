import { useMemo, useState } from "react";
import { PackageCheck, CornerDownLeft, Clock3, Send } from "lucide-react";

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
  computeOvertime,
  genUniqueCode,
  type Product,
  type ReturnTarget,
  type ReturnRequest,
} from "@/lib/smartpro-data";
import { formatRupiah, formatDate } from "@/lib/smartpro-format";
import { EmptyState, StatusPill } from "./ui";
import { MultiImageUpload } from "./image-upload";

export function CustomerRentals() {
  const { state, currentUser } = useStore();
  const [returnFor, setReturnFor] = useState<string | null>(null);
  const [extendFor, setExtendFor] = useState<string | null>(null);
  const [payExtendId, setPayExtendId] = useState<string | null>(null);

  if (!currentUser) return null;
  const myTransactions = state.transactions.filter((t) => t.customerId === currentUser.id);

  return (
    <div className="space-y-4">
      <div>
        <p className="section-label">Ruang pelanggan</p>
        <h1 className="wordmark mt-1 text-xl font-semibold">Sewa Aktif & Riwayat</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Kelola pengembalian, perpanjangan, dan status pembayaran Anda di sini.
        </p>
      </div>

      {myTransactions.length === 0 ? (
        <EmptyState
          title="Belum ada penyewaan"
          note="Tambahkan perangkat dari katalog untuk mulai menyewa."
        />
      ) : (
        <div className="space-y-3">
          {myTransactions.map((t) => {
            const openReturn = state.returns.find(
              (r) => r.transactionId === t.id && r.status === "Menunggu",
            );
            const openExtend = state.extends.find(
              (e) => e.transactionId === t.id && e.status === "Menunggu",
            );
            const approvedExtend = state.extends.find(
              (e) => e.transactionId === t.id && e.status === "Disetujui" && !e.paid,
            );
            const canReturn = t.pickupStatus === "Diambil" && !openReturn;
            return (
              <div key={t.id} className="border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="wordmark text-xs font-semibold">{t.code}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDate(t.startDate)} s/d {formatDate(t.endDate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <StatusPill status={t.status} />
                    <StatusPill status={t.pickupStatus} />
                  </div>
                </div>
                <div className="mt-2 space-y-1 text-[11px]">
                  {t.lines.map((l) => (
                    <p key={l.key} className="text-muted-foreground">
                      {l.name} x{l.quantity}
                    </p>
                  ))}
                </div>
                {approvedExtend && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border border-gold/30 bg-amber-soft p-2 text-[10px] text-amber">
                    <span>
                      Perpanjangan +{approvedExtend.extraHours} jam disetujui. Lunasi{" "}
                      <strong>{formatRupiah(approvedExtend.extraFee)}</strong>.
                    </span>
                    <Button
                      size="sm"
                      className="h-8 rounded-full text-[10px]"
                      onClick={() => setPayExtendId(approvedExtend.id)}
                    >
                      Bayar Perpanjangan
                    </Button>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-[11px]">
                  <span>
                    Total <strong>{formatRupiah(t.total)}</strong> (
                    {t.method === "transfer" ? "Transfer" : "Cash"})
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-full text-[10px]"
                      disabled={!!openExtend || t.status === "Selesai"}
                      onClick={() => setExtendFor(t.id)}
                    >
                      <Clock3 className="size-3.5" /> {openExtend ? "Extend ditinjau" : "Extend"}
                    </Button>
                    <Button
                      size="sm"
                      className="h-9 rounded-full text-[10px]"
                      disabled={!canReturn}
                      onClick={() => setReturnFor(t.id)}
                    >
                      <CornerDownLeft className="size-3.5" /> Kembalikan
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {returnFor && <ReturnModal transactionId={returnFor} onClose={() => setReturnFor(null)} />}
      {extendFor && <ExtendModal transactionId={extendFor} onClose={() => setExtendFor(null)} />}
      {payExtendId && (
        <PayExtendModal extendId={payExtendId} onClose={() => setPayExtendId(null)} />
      )}
    </div>
  );
}

function PayExtendModal({ extendId, onClose }: { extendId: string; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const request = state.extends.find((e) => e.id === extendId);
  const [method, setMethod] = useState<"transfer" | "cash">("transfer");
  if (!request) return null;

  const pay = () => {
    const uniqueCode = method === "transfer" ? genUniqueCode() : 0;
    dispatch({
      type: "addPayment",
      payment: {
        id: `pay-ext-${Date.now()}`,
        transactionId: request.transactionId,
        stage: "Pelunasan",
        method,
        amount: request.extraFee,
        uniqueCode,
        proofUrl: null,
        status: "Menunggu",
        note: `Perpanjangan +${request.extraHours} jam`,
        createdAt: new Date().toISOString(),
      },
    });
    dispatch({ type: "markExtendPaid", requestId: extendId });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="wordmark text-sm">Bayar Perpanjangan</DialogTitle>
          <DialogDescription className="text-xs">
            Biaya {formatRupiah(request.extraFee)} untuk +{request.extraHours} jam.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant={method === "transfer" ? "default" : "outline"}
            className="h-10 text-[11px]"
            onClick={() => setMethod("transfer")}
          >
            Transfer
          </Button>
          <Button
            size="sm"
            variant={method === "cash" ? "default" : "outline"}
            className="h-10 text-[11px]"
            onClick={() => setMethod("cash")}
          >
            Cash
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {method === "transfer"
            ? "Kode unik ditambahkan otomatis. Pembayaran menunggu persetujuan Admin."
            : "Bayar tunai di studio, menunggu persetujuan Admin."}
        </p>
        <Button className="w-full rounded-full" onClick={pay}>
          Ajukan pembayaran perpanjangan
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function ReturnModal({ transactionId, onClose }: { transactionId: string; onClose: () => void }) {
  const { state, currentUser, dispatch } = useStore();
  const [target, setTarget] = useState<ReturnTarget>("admin");
  const [nextCustomer, setNextCustomer] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState("");

  const transaction = state.transactions.find((t) => t.id === transactionId);
  if (!transaction || !currentUser) return null;

  const firstProduct = state.products.find((p) =>
    transaction.lines.some((l) => l.name.startsWith(p.name)),
  ) as Product | undefined;
  const price12h = firstProduct?.price12h ?? state.settings.overtimeFee12h;

  const submit = () => {
    if (photos.length === 0) {
      setError("Unggah minimal satu foto bukti kondisi barang.");
      return;
    }
    if (target === "next-customer" && !nextCustomer.trim()) {
      setError("Sebutkan nama pelanggan berikutnya.");
      return;
    }
    setError("");
    const now = new Date().toISOString();
    const overtime = computeOvertime(transaction.endDate, now, price12h);
    const request: ReturnRequest = {
      id: `ret-${Date.now()}`,
      transactionId,
      customerName: currentUser.name,
      target,
      nextCustomer: target === "next-customer" ? nextCustomer : undefined,
      photos,
      status: "Menunggu",
      overtimeHours: overtime.hours,
      overtimeFee: overtime.fee,
      createdAt: now,
    };
    dispatch({ type: "addReturn", request });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="wordmark text-sm">Ajukan Pengembalian</DialogTitle>
          <DialogDescription className="text-xs">
            Kode {transaction.code}. Pengembalian perlu disetujui Admin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
              Cara pengembalian
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant={target === "admin" ? "default" : "outline"}
                className="h-auto flex-col py-2 text-center"
                onClick={() => setTarget("admin")}
              >
                <PackageCheck className="size-4" />
                <span className="mt-1 text-[10px]">Ke Admin / Basecamp</span>
              </Button>
              <Button
                size="sm"
                variant={target === "next-customer" ? "default" : "outline"}
                className="h-auto flex-col py-2 text-center"
                onClick={() => setTarget("next-customer")}
              >
                <Send className="size-4" />
                <span className="mt-1 text-[10px]">Antar ke Pelanggan Berikutnya</span>
              </Button>
            </div>
          </div>

          {target === "next-customer" && (
            <label className="block text-[10px] font-semibold text-muted-foreground">
              Nama pelanggan berikutnya
              <Input
                value={nextCustomer}
                onChange={(e) => setNextCustomer(e.target.value)}
                className="mt-1 h-10 text-sm"
                placeholder="Nama penerima"
              />
            </label>
          )}

          <MultiImageUpload photos={photos} onChange={setPhotos} />

          {error && (
            <p
              role="alert"
              className="border border-alert/30 bg-alert-soft p-2.5 text-[11px] font-semibold text-alert"
            >
              {error}
            </p>
          )}

          <Button className="w-full rounded-full" onClick={submit}>
            Kirim pengajuan pengembalian
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Jika ditolak Admin, pengembalian dianggap belum sah dan denda keterlambatan tetap
            berjalan.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExtendModal({ transactionId, onClose }: { transactionId: string; onClose: () => void }) {
  const { state, currentUser, dispatch } = useStore();
  const [hours, setHours] = useState(12);

  const transaction = state.transactions.find((t) => t.id === transactionId);
  if (!transaction || !currentUser) return null;

  const firstProduct = state.products.find((p) =>
    transaction.lines.some((l) => l.name.startsWith(p.name)),
  );
  const rate = firstProduct
    ? hours === 12
      ? firstProduct.price12h
      : firstProduct.price24h
    : state.settings.overtimeFee12h;

  const submit = () => {
    dispatch({
      type: "addExtend",
      request: {
        id: `ext-${Date.now()}`,
        transactionId,
        customerName: currentUser.name,
        extraHours: hours,
        extraFee: rate,
        status: "Menunggu",
        paid: false,
        createdAt: new Date().toISOString(),
      },
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="wordmark text-sm">Ajukan Perpanjangan</DialogTitle>
          <DialogDescription className="text-xs">
            Kode {transaction.code}. Perpanjangan aktif setelah Admin menyetujui dan Anda melunasi
            biaya.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {[12, 24].map((h) => (
            <Button
              key={h}
              size="sm"
              variant={hours === h ? "default" : "outline"}
              className="h-auto flex-col py-2"
              onClick={() => setHours(h)}
            >
              <span className="wordmark text-xs">+{h} Jam</span>
            </Button>
          ))}
        </div>
        <div className="border border-border bg-surface-soft p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Biaya perpanjangan</span>
            <strong>{formatRupiah(rate)}</strong>
          </div>
        </div>
        <Button className="w-full rounded-full" onClick={submit}>
          Ajukan ke Admin
        </Button>
      </DialogContent>
    </Dialog>
  );
}
