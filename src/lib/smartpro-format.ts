export const formatRupiah = (amount: number): string =>
  `Rp ${Math.round(amount).toLocaleString("id-ID")}`;

export const formatDate = (date: string): string =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));

export const formatDateTime = (value: string | number | Date): string =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export const addDaysISO = (date: string, days: number): string => {
  const base = new Date(`${date}T00:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
};

export const buildWhatsappLink = (phone: string, message: string): string => {
  const normalized = phone.replace(/[^0-9]/g, "").replace(/^0/, "62");
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
};
