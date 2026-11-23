import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAvailableUnits, type Product } from "@/lib/smartpro-data";

function buildMonth(year: number, month: number): Date[] {
  const start = new Date(year, month, 1);
  const days: Date[] = [];
  const offset = (start.getDay() + 6) % 7; // Monday-first
  for (let i = 0; i < offset; i++) days.push(new Date(year, month, i - offset + 1));
  const last = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= last; d++) days.push(new Date(year, month, d));
  while (days.length % 7 !== 0) days.push(new Date(year, month, last + (days.length % 7)));
  return days;
}

const toISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function AvailabilityCalendar({
  product,
  startDate,
  endDate,
  onSelectRange,
}: {
  product: Product;
  startDate: string;
  endDate: string;
  onSelectRange: (start: string, end: string) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const days = buildMonth(cursor.getFullYear(), cursor.getMonth());
  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(
    cursor,
  );

  const handlePick = (iso: string) => {
    if (!startDate || (startDate && endDate && startDate !== endDate)) {
      onSelectRange(iso, iso);
    } else if (iso < startDate) {
      onSelectRange(iso, startDate);
    } else {
      onSelectRange(startDate, iso);
    }
  };

  return (
    <div className="rounded-sm border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold capitalize">{monthLabel}</span>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label="Bulan sebelumnya"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label="Bulan berikutnya"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[9px] text-muted-foreground">
        {["S", "S", "R", "K", "J", "S", "M"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const iso = toISO(day);
          const inMonth = day.getMonth() === cursor.getMonth();
          const available = getAvailableUnits(product, iso, iso);
          const isPast = iso < toISO(today);
          const inRange = startDate && endDate && iso >= startDate && iso <= endDate;
          const tone = isPast
            ? "text-muted-foreground/40"
            : available === 0
              ? "bg-alert-soft text-alert"
              : "bg-success-soft text-success";
          return (
            <button
              key={iso}
              type="button"
              disabled={isPast || !inMonth}
              onClick={() => handlePick(iso)}
              className={`aspect-square rounded-sm border text-[10px] font-semibold ${
                inRange ? "border-primary ring-1 ring-primary" : "border-transparent"
              } ${tone} ${!inMonth ? "opacity-30" : ""}`}
              aria-label={`${iso}, ${available} unit tersedia`}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-success-soft ring-1 ring-success" /> Tersedia
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-alert-soft ring-1 ring-alert" /> Penuh
        </span>
        <span>Klik 2 tanggal untuk pilih rentang</span>
      </div>
    </div>
  );
}
