import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Wallet,
  Package,
  ClipboardCheck,
  Settings as SettingsIcon,
  Users,
  PackagePlus,
  Check,
  X,
  Star,
  Phone,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/smartpro-store";
import {
  buildWhatsappLink,
  formatDate,
  formatDateTime,
  formatRupiah,
  renderTemplate,
} from "@/lib/smartpro-format";
import type { AdminSettings, Product, ProductCategory, Voucher } from "@/lib/smartpro-data";
import { EmptyState, Field, StatCard, StatusPill } from "./ui";
import { SingleImageUpload } from "./image-upload";
import { AdminManualCheckout } from "./admin-manual-checkout";

const TABS = [
  "Ringkasan",
  "Pembayaran",
  "Pengembalian",
  "Perpanjangan",
  "KYC",
  "Inventaris",
  "Checkout Manual",
  "Voucher",
  "Analitik",
  "Finance",
  "Pengaturan",
  "Pelanggan",
] as const;
type Tab = (typeof TABS)[number];

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("Ringkasan");
  return (
    <div className="space-y-4">
      <div>
        <p className="section-label">Ruang admin</p>
        <h1 className="wordmark mt-1 text-xl font-semibold">Dashboard Admin</h1>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <Button
            key={t}
            variant="ghost"
            className={`h-10 shrink-0 rounded-none border-b-2 px-3 text-xs ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </div>
      {tab === "Ringkasan" && <Overview />}
      {tab === "Pembayaran" && <PaymentApprovals />}
      {tab === "Pengembalian" && <ReturnApprovals />}
      {tab === "Perpanjangan" && <ExtendApprovals />}
      {tab === "KYC" && <KycApprovals />}
      {tab === "Inventaris" && <InventoryManager />}
      {tab === "Checkout Manual" && <AdminManualCheckout />}
      {tab === "Voucher" && <VoucherManager />}
      {tab === "Analitik" && <Analytics />}
      {tab === "Finance" && <Finance />}
      {tab === "Pengaturan" && <SettingsPanel />}
      {tab === "Pelanggan" && <Customers />}
    </div>
  );
}

function Overview() {
  const { state } = useStore();
  const paid = state.payments.filter((p) => p.status === "Disetujui");
  const dpIn = paid.filter((p) => p.stage === "DP").reduce((s, p) => s + p.amount, 0);
  const lunasIn = paid.filter((p) => p.stage === "Pelunasan").reduce((s, p) => s + p.amount, 0);
  const pending = state.payments.filter((p) => p.status === "Menunggu").length;
  const pendingKyc = state.users.filter((u) => u.kycStatus === "Menunggu").length;
  const pendingReturns = state.returns.filter((r) => r.status === "Menunggu").length;
  const pendingExtends = state.extends.filter((e) => e.status === "Menunggu").length;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="DP Masuk" value={formatRupiah(dpIn)} note="Pembayaran DP disetujui" />
      <StatCard label="Pelunasan Masuk" value={formatRupiah(lunasIn)} note="Pelunasan disetujui" />
      <StatCard label="Antrean Bayar" value={`${pending} pengajuan`} note="Menunggu approval" />
      <StatCard
        label="Perlu Tindakan"
        value={`${pendingKyc + pendingReturns + pendingExtends} item`}
        note={`KYC ${pendingKyc} / Retur ${pendingReturns} / Extend ${pendingExtends}`}
      />
    </div>
  );
}

function PaymentApprovals() {
  const { state, dispatch } = useStore();
  const pending = state.payments.filter((p) => p.status === "Menunggu");
  const approve = (id: string, transactionId: string, stage: string) => {
    dispatch({ type: "setPaymentStatus", paymentId: id, status: "Disetujui" });
    const trx = state.transactions.find((t) => t.id === transactionId);
    if (trx) {
      const status = stage === "Pelunasan" ? "Lunas" : "DP Terbayar";
      dispatch({ type: "setTransactionStatus", transactionId, status });
      const user = state.users.find((u) => u.id === trx.customerId);
      if (user && stage === "Pelunasan") {
        dispatch({
          type: "updateUser",
          userId: user.id,
          patch: { points: user.points + trx.pointsEarned },
        });
      }
    }
  };
  return (
    <div className="space-y-3">
      {pending.length === 0 ? (
        <EmptyState title="Tidak ada antrean" note="Semua pembayaran sudah ditinjau." />
      ) : (
        pending.map((p) => {
          const trx = state.transactions.find((t) => t.id === p.transactionId);
          return (
            <div key={p.id} className="border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="wordmark text-xs font-semibold">{trx?.code}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {trx?.customerName} - {p.stage} -{" "}
                    {p.method === "transfer" ? "Transfer" : "Cash"}
                  </p>
                </div>
                <p className="text-xs font-semibold">
                  {formatRupiah(p.amount)}
                  {p.method === "transfer" && ` + ${p.uniqueCode}`}
                </p>
              </div>
              {p.proofUrl && (
                <img
                  src={p.proofUrl}
                  alt="Bukti bayar"
                  className="mt-2 h-24 rounded-sm object-cover"
                />
              )}
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  className="h-9 rounded-full text-[10px]"
                  onClick={() => approve(p.id, p.transactionId, p.stage)}
                >
                  <Check className="size-3.5" /> Setujui
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-full text-[10px] text-alert"
                  onClick={() =>
                    dispatch({ type: "setPaymentStatus", paymentId: p.id, status: "Ditolak" })
                  }
                >
                  <X className="size-3.5" /> Tolak
                </Button>
                {trx && (
                  <Button
                    asChild
                    size="sm"
                    variant="ghost"
                    className="h-9 rounded-full text-[10px]"
                  >
                    <a
                      href={buildWhatsappLink(
                        trx.customerPhone,
                        renderTemplate(
                          p.stage === "DP"
                            ? state.settings.waTemplates.dp
                            : state.settings.waTemplates.lunas,
                          {
                            nama: trx.customerName,
                            kode: trx.code,
                            total: formatRupiah(trx.remainingAmount),
                          },
                        ),
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Phone className="size-3.5" /> WA
                    </a>
                  </Button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function ReturnApprovals() {
  const { state, dispatch } = useStore();
  const pending = state.returns.filter((r) => r.status === "Menunggu");
  return (
    <div className="space-y-3">
      {pending.length === 0 ? (
        <EmptyState title="Tidak ada pengajuan" note="Belum ada pengembalian menunggu." />
      ) : (
        pending.map((r) => {
          const trx = state.transactions.find((t) => t.id === r.transactionId);
          return (
            <div key={r.id} className="border border-border bg-card p-4">
              <p className="wordmark text-xs font-semibold">
                {trx?.code} - {r.customerName}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Tujuan:{" "}
                {r.target === "admin" ? "Ke Admin / Basecamp" : `Antar ke ${r.nextCustomer}`}
              </p>
              <div className="mt-2 flex gap-2">
                {r.photos.map((p, i) => (
                  <img key={i} src={p} alt={`Bukti ${i + 1}`} className="h-16 w-16 object-cover" />
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Overtime terdeteksi: {r.overtimeHours} jam = {formatRupiah(r.overtimeFee)}
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  className="h-9 rounded-full text-[10px]"
                  onClick={() => {
                    dispatch({ type: "setReturnStatus", requestId: r.id, status: "Disetujui" });
                    dispatch({
                      type: "setTransactionPickup",
                      transactionId: r.transactionId,
                      pickupStatus: "Dikembalikan",
                    });
                  }}
                >
                  <Check className="size-3.5" /> Setujui pengembalian
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-full text-[10px] text-alert"
                  onClick={() =>
                    dispatch({ type: "setReturnStatus", requestId: r.id, status: "Ditolak" })
                  }
                >
                  <X className="size-3.5" /> Tolak
                </Button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function ExtendApprovals() {
  const { state, dispatch } = useStore();
  const pending = state.extends.filter((e) => e.status === "Menunggu");
  return (
    <div className="space-y-3">
      {pending.length === 0 ? (
        <EmptyState title="Tidak ada pengajuan" note="Belum ada perpanjangan menunggu." />
      ) : (
        pending.map((e) => {
          const trx = state.transactions.find((t) => t.id === e.transactionId);
          return (
            <div key={e.id} className="border border-border bg-card p-4">
              <p className="wordmark text-xs font-semibold">
                {trx?.code} - {e.customerName}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Perpanjangan +{e.extraHours} jam = {formatRupiah(e.extraFee)}
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  className="h-9 rounded-full text-[10px]"
                  onClick={() =>
                    dispatch({ type: "setExtendStatus", requestId: e.id, status: "Disetujui" })
                  }
                >
                  <Check className="size-3.5" /> Setujui
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-full text-[10px] text-alert"
                  onClick={() =>
                    dispatch({ type: "setExtendStatus", requestId: e.id, status: "Ditolak" })
                  }
                >
                  <X className="size-3.5" /> Tolak
                </Button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function KycApprovals() {
  const { state, dispatch } = useStore();
  const queue = state.users.filter((u) => u.kycStatus === "Menunggu");
  return (
    <div className="space-y-3">
      {queue.length === 0 ? (
        <EmptyState title="Antrean kosong" note="Tidak ada KYC menunggu." />
      ) : (
        queue.map((u) => (
          <div key={u.id} className="border border-border bg-card p-4">
            <p className="text-xs font-semibold">
              {u.name} ({u.username})
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              NIK {u.kyc?.nik} - WA {u.kyc?.whatsapp}
            </p>
            <div className="mt-2 flex gap-2">
              {u.kyc?.fotoKtp && (
                <img src={u.kyc.fotoKtp} alt="KTP" className="h-20 object-cover" />
              )}
              {u.kyc?.fotoSelfie && (
                <img src={u.kyc.fotoSelfie} alt="Selfie KTP" className="h-20 object-cover" />
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                className="h-9 rounded-full text-[10px]"
                onClick={() => dispatch({ type: "setKycStatus", userId: u.id, status: "Verified" })}
              >
                <BadgeCheck className="size-3.5" /> Setujui
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 rounded-full text-[10px] text-alert"
                onClick={() => dispatch({ type: "setKycStatus", userId: u.id, status: "Ditolak" })}
              >
                <X className="size-3.5" /> Tolak
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function InventoryManager() {
  const { state, dispatch } = useStore();
  const [form, setForm] = useState({
    name: "",
    category: "Kamera" as ProductCategory,
    price12h: "",
    price24h: "",
    active12h: true,
    active24h: true,
    bestSeller: false,
    rewardPoints: "10",
  });
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState("");

  const addProduct = () => {
    if (!form.name.trim() || !Number(form.price12h) || !Number(form.price24h)) {
      setError("Nama, harga 12 jam, dan harga 24 jam wajib diisi.");
      return;
    }
    setError("");
    const product: Product = {
      id: `new-${Date.now()}`,
      name: form.name.toUpperCase(),
      category: form.category,
      price12h: Number(form.price12h),
      price24h: Number(form.price24h),
      active12h: form.active12h,
      active24h: form.active24h,
      bestSeller: form.bestSeller,
      imageUrl: image,
      rewardPoints: Number(form.rewardPoints) || 0,
      accessories: "KELENGKAPAN AKAN DIKONFIRMASI",
      specs: "Spesifikasi akan dilengkapi.",
      serials: [{ code: `SMP-${form.name.toUpperCase().slice(0, 6)}-001`, status: "READY" }],
      bookings: [],
      art: "monitor",
    };
    dispatch({ type: "addProduct", product });
    setForm({
      name: "",
      category: "Kamera",
      price12h: "",
      price24h: "",
      active12h: true,
      active24h: true,
      bestSeller: false,
      rewardPoints: "10",
    });
    setImage(null);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <PackagePlus className="size-4 text-gold-ink" /> Tambah Produk
        </p>
        <div className="mt-3 space-y-2">
          <Field label="Nama produk">
            <Input
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              className="h-9 text-sm"
            />
          </Field>
          <Field label="Kategori">
            <select
              value={form.category}
              onChange={(e) =>
                setForm((c) => ({ ...c, category: e.target.value as ProductCategory }))
              }
              className="h-9 w-full border border-input bg-background px-2 text-sm"
            >
              <option>Kamera</option>
              <option>Wireless Video</option>
              <option>Switcher & Live</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Harga 12 Jam">
              <Input
                type="number"
                value={form.price12h}
                onChange={(e) => setForm((c) => ({ ...c, price12h: e.target.value }))}
                className="h-9 text-sm"
              />
            </Field>
            <Field label="Harga 24 Jam">
              <Input
                type="number"
                value={form.price24h}
                onChange={(e) => setForm((c) => ({ ...c, price24h: e.target.value }))}
                className="h-9 text-sm"
              />
            </Field>
          </div>
          <Field label="Reward poin per sewa">
            <Input
              type="number"
              value={form.rewardPoints}
              onChange={(e) => setForm((c) => ({ ...c, rewardPoints: e.target.value }))}
              className="h-9 text-sm"
            />
          </Field>
          <div className="flex flex-wrap gap-3 text-[11px]">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={form.active12h}
                onChange={(e) => setForm((c) => ({ ...c, active12h: e.target.checked }))}
              />{" "}
              Durasi 12 jam aktif
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={form.active24h}
                onChange={(e) => setForm((c) => ({ ...c, active24h: e.target.checked }))}
              />{" "}
              Durasi 24 jam aktif
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={form.bestSeller}
                onChange={(e) => setForm((c) => ({ ...c, bestSeller: e.target.checked }))}
              />{" "}
              Best Seller
            </label>
          </div>
          <SingleImageUpload label="Foto produk" value={image} onChange={setImage} />
          {error && (
            <p
              role="alert"
              className="border border-alert/30 bg-alert-soft p-2 text-[11px] font-semibold text-alert"
            >
              {error}
            </p>
          )}
          <Button className="w-full rounded-full" onClick={addProduct}>
            <PackagePlus className="size-4" /> Simpan produk
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {state.products.map((p) => (
          <div key={p.id} className="flex items-center gap-3 border border-border bg-card p-3">
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.name} className="h-12 w-12 object-cover" />
            ) : (
              <span className="grid h-12 w-12 place-items-center bg-stage text-[9px] text-muted-foreground">
                No F
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">
                {p.bestSeller && <Star className="mr-1 inline size-3 fill-gold text-gold-ink" />}
                {p.name}
              </p>
              <p className="text-[10px] text-muted-foreground">
                12j {formatRupiah(p.price12h)} ({p.active12h ? "aktif" : "off"}) / 24j{" "}
                {formatRupiah(p.price24h)} ({p.active24h ? "aktif" : "off"})
              </p>
            </div>
            <button
              type="button"
              className="text-[10px] font-semibold text-gold-ink"
              onClick={() =>
                dispatch({
                  type: "updateProduct",
                  productId: p.id,
                  patch: { bestSeller: !p.bestSeller },
                })
              }
            >
              {p.bestSeller ? "Hapus BS" : "Tandai BS"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Finance() {
  const { state } = useStore();
  const paid = state.payments.filter((p) => p.status === "Disetujui");
  const total = paid.reduce((s, p) => s + p.amount, 0);
  const dp = paid.filter((p) => p.stage === "DP").reduce((s, p) => s + p.amount, 0);
  const lunas = paid.filter((p) => p.stage === "Pelunasan").reduce((s, p) => s + p.amount, 0);
  const overtime = state.returns.reduce((s, r) => s + r.overtimeFee, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Tercatat" value={formatRupiah(total)} note="Pembayaran disetujui" />
        <StatCard label="DP 30% Masuk" value={formatRupiah(dp)} note="Tahap DP" />
        <StatCard label="Pelunasan Masuk" value={formatRupiah(lunas)} note="Tahap pelunasan" />
        <StatCard
          label="Potensi Overtime"
          value={formatRupiah(overtime)}
          note="Dari pengembalian"
        />
      </div>
      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-surface-soft text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Tanggal</th>
              <th className="px-3 py-2">Transaksi</th>
              <th className="px-3 py-2">Metode</th>
              <th className="px-3 py-2">Kode Unik</th>
              <th className="px-3 py-2">Tahap</th>
              <th className="px-3 py-2">Nominal</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {state.payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Belum ada transaksi keuangan.
                </td>
              </tr>
            ) : (
              state.payments.map((p) => {
                const trx = state.transactions.find((t) => t.id === p.transactionId);
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2 text-[10px]">{formatDateTime(p.createdAt)}</td>
                    <td className="px-3 py-2">{trx?.code}</td>
                    <td className="px-3 py-2">{p.method === "transfer" ? "Transfer" : "Cash"}</td>
                    <td className="px-3 py-2">{p.uniqueCode || "-"}</td>
                    <td className="px-3 py-2">{p.stage}</td>
                    <td className="px-3 py-2 font-semibold">{formatRupiah(p.amount)}</td>
                    <td className="px-3 py-2">
                      <StatusPill status={p.status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsPanel() {
  const { state, dispatch } = useStore();
  const [form, setForm] = useState<AdminSettings>(state.settings);
  const set = (patch: Partial<AdminSettings>) => setForm((c) => ({ ...c, ...patch }));
  return (
    <div className="max-w-xl space-y-3 border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <SettingsIcon className="size-4 text-gold-ink" /> Pengaturan Poin & Overtime
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Minimal Rupiah reward">
          <Input
            type="number"
            value={form.minRupiahReward}
            onChange={(e) => set({ minRupiahReward: Number(e.target.value) || 0 })}
            className="h-9 text-sm"
          />
        </Field>
        <Field label="Poin per kelipatan">
          <Input
            type="number"
            value={form.poinPerKelipatan}
            onChange={(e) => set({ poinPerKelipatan: Number(e.target.value) || 0 })}
            className="h-9 text-sm"
          />
        </Field>
        <Field label="Minimal poin tukar">
          <Input
            type="number"
            value={form.minPoinTukar}
            onChange={(e) => set({ minPoinTukar: Number(e.target.value) || 0 })}
            className="h-9 text-sm"
          />
        </Field>
        <Field label="Rupiah per poin">
          <Input
            type="number"
            value={form.rupiahPerPoin}
            onChange={(e) => set({ rupiahPerPoin: Number(e.target.value) || 0 })}
            className="h-9 text-sm"
          />
        </Field>
        <Field label="Denda overtime (per 12 jam)">
          <Input
            type="number"
            value={form.overtimeFee12h}
            onChange={(e) => set({ overtimeFee12h: Number(e.target.value) || 0 })}
            className="h-9 text-sm"
          />
        </Field>
        <Field label="Nomor WhatsApp Admin">
          <Input
            value={form.whatsappAdmin}
            onChange={(e) => set({ whatsappAdmin: e.target.value })}
            className="h-9 text-sm"
          />
        </Field>
        <Field label="Diskon Mitra VIP (%)">
          <Input
            type="number"
            min={0}
            max={100}
            value={form.vipDiscountPercent}
            onChange={(e) => set({ vipDiscountPercent: Number(e.target.value) || 0 })}
            className="h-9 text-sm"
          />
        </Field>
      </div>

      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold">Template WhatsApp Otomatis</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Placeholder: {"{nama}"}, {"{kode}"}, {"{total}"}.
        </p>
        <div className="mt-2 space-y-2">
          {(
            [
              ["booking", "Booking dibuat"],
              ["dp", "DP diterima"],
              ["lunas", "Lunas"],
              ["reminder", "Pengingat kembali"],
              ["extend", "Perpanjangan"],
            ] as [keyof AdminSettings["waTemplates"], string][]
          ).map(([key, label]) => (
            <label key={key} className="block text-[10px] font-semibold text-muted-foreground">
              {label}
              <textarea
                value={form.waTemplates[key]}
                onChange={(e) =>
                  set({ waTemplates: { ...form.waTemplates, [key]: e.target.value } })
                }
                rows={2}
                className="mt-1 w-full border border-input bg-background px-2 py-1.5 text-[11px]"
              />
            </label>
          ))}
        </div>
      </div>

      <Button
        className="w-full rounded-full"
        onClick={() => dispatch({ type: "updateSettings", patch: form })}
      >
        <Check className="size-4" /> Simpan pengaturan
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Perubahan langsung berlaku pada kalkulasi checkout pelanggan.
      </p>
    </div>
  );
}

function Customers() {
  const { state, dispatch } = useStore();
  return (
    <div className="space-y-2">
      {state.users
        .filter((u) => u.role === "pelanggan")
        .map((u) => {
          return (
            <div
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card p-3"
            >
              <div>
                <p className="text-xs font-semibold">
                  {u.name} <span className="text-muted-foreground">({u.username})</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {u.phone} - {u.points} poin
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <StatusPill status={u.kycStatus} />
                  {u.isVip && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-amber-soft px-2.5 py-1 text-[10px] font-semibold text-gold-ink">
                      <Star className="size-3 fill-current" /> Mitra VIP
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={u.isVip ? "secondary" : "outline"}
                  className="h-9 rounded-full text-[10px]"
                  disabled={u.isVip ? false : u.kycStatus !== "Verified"}
                  title={u.kycStatus !== "Verified" ? "Verifikasi KYC dulu" : undefined}
                  onClick={() => dispatch({ type: "setVip", userId: u.id, isVip: !u.isVip })}
                >
                  <Star className="size-3.5" /> {u.isVip ? "Cabut VIP" : "Jadikan VIP"}
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-full text-[10px]"
                >
                  <a
                    href={buildWhatsappLink(
                      u.phone,
                      `Halo ${u.name}, terima kasih telah menyewa di SMartPro.`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Phone className="size-3.5" /> WA
                  </a>
                </Button>
              </div>
            </div>
          );
        })}
    </div>
  );
}

function VoucherManager() {
  const { state, dispatch } = useStore();
  const [form, setForm] = useState({
    code: "",
    type: "percent" as Voucher["type"],
    value: "10",
    minSpend: "0",
    expiresAt: "",
  });
  const [error, setError] = useState("");

  const add = () => {
    const code = form.code.trim().toUpperCase();
    if (!code || !Number(form.value)) {
      setError("Kode dan nilai voucher wajib diisi.");
      return;
    }
    setError("");
    dispatch({
      type: "addVoucher",
      voucher: {
        id: `v-${Date.now()}`,
        code,
        type: form.type,
        value: Number(form.value),
        minSpend: Number(form.minSpend) || 0,
        active: true,
        expiresAt: form.expiresAt || "2099-12-31",
      },
    });
    setForm({ code: "", type: "percent", value: "10", minSpend: "0", expiresAt: "" });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
      <div className="border border-border bg-card p-4">
        <p className="text-sm font-semibold">Tambah Voucher</p>
        <div className="mt-3 space-y-2">
          <Field label="Kode">
            <Input
              value={form.code}
              onChange={(e) => setForm((c) => ({ ...c, code: e.target.value }))}
              className="h-9 text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tipe">
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((c) => ({ ...c, type: e.target.value as Voucher["type"] }))
                }
                className="h-9 w-full border border-input bg-background px-2 text-sm"
              >
                <option value="percent">Persen (%)</option>
                <option value="fixed">Nominal (Rp)</option>
              </select>
            </Field>
            <Field label="Nilai">
              <Input
                type="number"
                value={form.value}
                onChange={(e) => setForm((c) => ({ ...c, value: e.target.value }))}
                className="h-9 text-sm"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Min. belanja">
              <Input
                type="number"
                value={form.minSpend}
                onChange={(e) => setForm((c) => ({ ...c, minSpend: e.target.value }))}
                className="h-9 text-sm"
              />
            </Field>
            <Field label="Kedaluwarsa">
              <Input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((c) => ({ ...c, expiresAt: e.target.value }))}
                className="h-9 text-sm"
              />
            </Field>
          </div>
          {error && (
            <p
              role="alert"
              className="border border-alert/30 bg-alert-soft p-2 text-[11px] font-semibold text-alert"
            >
              {error}
            </p>
          )}
          <Button className="w-full rounded-full" onClick={add}>
            Simpan voucher
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {state.vouchers.map((v) => (
          <div
            key={v.id}
            className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card p-3 text-xs"
          >
            <div>
              <p className="font-semibold">{v.code}</p>
              <p className="text-[10px] text-muted-foreground">
                {v.type === "percent" ? `${v.value}%` : formatRupiah(v.value)} - min{" "}
                {formatRupiah(v.minSpend)} - exp {v.expiresAt}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill status={v.active ? "Disetujui" : "Ditolak"} />
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full text-[10px]"
                onClick={() => dispatch({ type: "toggleVoucher", voucherId: v.id })}
              >
                {v.active ? "Nonaktifkan" : "Aktifkan"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="size-8 text-alert"
                aria-label={`Hapus ${v.code}`}
                onClick={() => dispatch({ type: "removeVoucher", voucherId: v.id })}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Analytics() {
  const { state } = useStore();
  const approved = state.payments.filter((p) => p.status === "Disetujui");
  const totalRevenue = approved.reduce((s, p) => s + p.amount, 0);

  const byProduct = useMemo(() => {
    const map = new Map<string, number>();
    state.transactions.forEach((t) =>
      t.lines.forEach((l) => map.set(l.name, (map.get(l.name) ?? 0) + l.quantity)),
    );
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [state.transactions]);

  const topCustomers = useMemo(() => {
    const map = new Map<string, number>();
    state.transactions.forEach((t) =>
      map.set(t.customerName, (map.get(t.customerName) ?? 0) + t.total),
    );
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [state.transactions]);

  const statusCount = useMemo(() => {
    const map = new Map<string, number>();
    state.transactions.forEach((t) => map.set(t.status, (map.get(t.status) ?? 0) + 1));
    return [...map.entries()];
  }, [state.transactions]);

  const maxProduct = Math.max(1, ...byProduct.map(([, v]) => v));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total Transaksi"
          value={`${state.transactions.length}`}
          note="Semua status"
        />
        <StatCard
          label="Pendapatan Disetujui"
          value={formatRupiah(totalRevenue)}
          note="Pembayaran disetujui"
        />
        <StatCard
          label="Voucher Aktif"
          value={`${state.vouchers.filter((v) => v.active).length}`}
          note="Siap dipakai"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border border-border bg-card p-4">
          <p className="text-sm font-semibold">Utilisasi Unit (Unit Tersewa)</p>
          <div className="mt-3 space-y-2">
            {byProduct.length === 0 && (
              <p className="text-xs text-muted-foreground">Belum ada data.</p>
            )}
            {byProduct.map(([name, value]) => (
              <div key={name}>
                <div className="flex justify-between text-[10px]">
                  <span className="truncate pr-2">{name}</span>
                  <span>{value}</span>
                </div>
                <div className="mt-0.5 h-2 w-full bg-surface-soft">
                  <div
                    className="h-2 bg-gold"
                    style={{ width: `${(value / maxProduct) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border bg-card p-4">
          <p className="text-sm font-semibold">Pelanggan Teraktif</p>
          <div className="mt-3 space-y-2">
            {topCustomers.length === 0 && (
              <p className="text-xs text-muted-foreground">Belum ada data.</p>
            )}
            {topCustomers.map(([name, value]) => (
              <div key={name} className="flex justify-between text-[11px]">
                <span>{name}</span>
                <span className="font-semibold">{formatRupiah(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border border-border bg-card p-4">
        <p className="text-sm font-semibold">Status Transaksi</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {statusCount.length === 0 && (
            <p className="text-xs text-muted-foreground">Belum ada data.</p>
          )}
          {statusCount.map(([status, count]) => (
            <span
              key={status}
              className="inline-flex items-center gap-2 border border-border px-3 py-1 text-[11px]"
            >
              {status} <strong>{count}</strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
