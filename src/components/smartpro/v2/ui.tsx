import type { ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="section-label">{children}</p>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-[10px] font-semibold text-muted-foreground">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex min-h-28 flex-col justify-between border border-border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <div>
        <p className="wordmark mt-2 text-base font-semibold">{value}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">{note}</p>
      </div>
    </div>
  );
}

export function EmptyState({ title, note }: { title: string; note: string }) {
  return (
    <div className="border border-dashed border-border px-4 py-10 text-center">
      <p className="text-xs font-semibold">{title}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{note}</p>
    </div>
  );
}

const statusTone: Record<string, string> = {
  Menunggu: "border-amber/20 bg-amber-soft text-amber",
  Disetujui: "border-success/20 bg-success-soft text-success",
  Ditolak: "border-alert/20 bg-alert-soft text-alert",
  Verified: "border-success/20 bg-success-soft text-success",
  Belum: "border-border bg-surface-soft text-muted-foreground",
  Lunas: "border-success/20 bg-success-soft text-success",
  "DP Terbayar": "border-amber/20 bg-amber-soft text-amber",
  "Menunggu Pembayaran": "border-alert/20 bg-alert-soft text-alert",
  Selesai: "border-success/20 bg-success-soft text-success",
  Dibatalkan: "border-border bg-surface-soft text-muted-foreground",
};

export function StatusPill({ status }: { status: string }) {
  const tone = statusTone[status] ?? "border-border bg-surface-soft text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tone}`}
    >
      {status}
    </span>
  );
}
