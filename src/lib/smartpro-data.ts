export type ProductCategory = "Kamera" | "Wireless Video" | "Switcher & Live";
export type UnitStatus = "READY" | "MAINTENANCE";

export type ProductBooking = {
  start: string;
  end: string;
  quantity: number;
};

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  accessories: string;
  serials: { code: string; status: UnitStatus }[];
  bookings: ProductBooking[];
  art: "wireless" | "camera" | "switcher" | "ptz" | "monitor";
};

export type Bundle = {
  id: string;
  name: string;
  price: number;
  regularPrice: number;
  includes: { productId: string; quantity: number }[];
  note: string;
};

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "cosmo-c1",
    name: "COSMO C1",
    category: "Wireless Video",
    price: 150000,
    accessories: "1 RX, 1 TX, 2 BATERAI NPF, STAND, SDI OR HDMI (PENDEK)",
    serials: ["001", "002", "003"].map((number) => ({
      code: `SMP-C1-${number}`,
      status: "READY",
    })),
    bookings: [{ start: "2026-11-24", end: "2026-11-26", quantity: 1 }],
    art: "wireless",
  },
  {
    id: "sony-a6400",
    name: "SONY A6400 (BO)",
    category: "Kamera",
    price: 120000,
    accessories: "BATERAI 1, CHARGER, BOX.",
    serials: ["001", "002"].map((number) => ({
      code: `SMP-A64-${number}`,
      status: "READY",
    })),
    bookings: [{ start: "2026-11-21", end: "2026-11-23", quantity: 2 }],
    art: "camera",
  },
  {
    id: "cineview-2-sdi",
    name: "CINEVIEW 2 SDI",
    category: "Wireless Video",
    price: 150000,
    accessories: "1 RX, 1 TX, 4 BATERAI NPF, STAND, SDI OR HDMI (PENDEK)",
    serials: ["001", "002", "003"].map((number) => ({
      code: `SMP-CV2-${number}`,
      status: number === "003" ? "MAINTENANCE" : "READY",
    })),
    bookings: [],
    art: "monitor",
  },
  {
    id: "cosmo-c2",
    name: "COSMO C2",
    category: "Wireless Video",
    price: 350000,
    accessories: "1 RX, 2 TX, 4 BATERAI NPF, STAND, SDI OR HDMI (PENDEK)",
    serials: ["001", "002"].map((number) => ({
      code: `SMP-C2-${number}`,
      status: "READY",
    })),
    bookings: [],
    art: "wireless",
  },
  {
    id: "osee-gostream",
    name: "OSEE GOSTREAM",
    category: "Switcher & Live",
    price: 110000,
    accessories: "4 IN SDI OR HDMI, 2 OUT HDMI, DC IN, KABEL HDMI/SDI 1 M",
    serials: ["001", "002", "003"].map((number) => ({
      code: `SMP-OSE-${number}`,
      status: "READY",
    })),
    bookings: [],
    art: "switcher",
  },
  {
    id: "atem-mini",
    name: "ATEM MINI",
    category: "Switcher & Live",
    price: 350000,
    accessories: "4 IN HDMI, 2 OUT HDMI, DC IN, KABEL HDMI 1 M",
    serials: ["001", "002"].map((number) => ({
      code: `SMP-ATM-${number}`,
      status: "READY",
    })),
    bookings: [{ start: "2026-11-25", end: "2026-11-27", quantity: 2 }],
    art: "switcher",
  },
  {
    id: "ptz-minrray-uv510a",
    name: "PTZ MINRRAY UV510A",
    category: "Kamera",
    price: 110000,
    accessories: "KABEL POWER, BOX, REMOTE",
    serials: ["001", "002", "003"].map((number) => ({
      code: `SMP-PTZ-${number}`,
      status: "READY",
    })),
    bookings: [],
    art: "ptz",
  },
  {
    id: "sony-pxw-70",
    name: "SONY PXW-70",
    category: "Kamera",
    price: 200000,
    accessories: "BATERAI 1, CHARGER, BOX.",
    serials: ["001", "002"].map((number) => ({
      code: `SMP-PXW-${number}`,
      status: "READY",
    })),
    bookings: [],
    art: "camera",
  },
];

export const INITIAL_BUNDLES: Bundle[] = [
  {
    id: "live-streaming-2-cam",
    name: "PAKET LIVE STREAMING 2 CAM",
    price: 390000,
    regularPrice: 460000,
    includes: [
      { productId: "osee-gostream", quantity: 1 },
      { productId: "sony-pxw-70", quantity: 1 },
      { productId: "cosmo-c1", quantity: 1 },
    ],
    note: "3 perangkat siap untuk produksi multi-kamera.",
  },
  {
    id: "wireless-multicam-pro",
    name: "PAKET WIRELESS MULTICAM PRO",
    price: 780000,
    regularPrice: 900000,
    includes: [
      { productId: "atem-mini", quantity: 1 },
      { productId: "cosmo-c2", quantity: 1 },
      { productId: "sony-pxw-70", quantity: 1 },
    ],
    note: "Rangkaian multicam wireless dengan switching profesional.",
  },
  {
    id: "webinar-hybrid-event",
    name: "PAKET WEBINAR & HYBRID EVENT",
    price: 290000,
    regularPrice: 330000,
    includes: [
      { productId: "ptz-minrray-uv510a", quantity: 2 },
      { productId: "osee-gostream", quantity: 1 },
    ],
    note: "Dua kamera PTZ dan switcher ringkas untuk acara hybrid.",
  },
];

export type AccountTier = "regular" | "verified" | "vip";

export function rentalDayCount(start: string, end: string): number {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return 1;
  }
  return Math.max(1, Math.ceil((endTime - startTime) / 86_400_000));
}

export function promoFreeDays(days: number): number {
  return Math.floor(Math.max(0, days) / 3);
}

export function getAvailableUnits(product: Product, start: string, end: string): number {
  const readyUnits = product.serials.filter((serial) => serial.status === "READY").length;
  const reservedUnits = product.bookings
    .filter((booking) => booking.start <= end && booking.end >= start)
    .reduce((total, booking) => total + booking.quantity, 0);
  return Math.max(0, readyUnits - reservedUnits);
}

export function getBundleAvailability(
  bundle: Bundle,
  products: Product[],
  start: string,
  end: string,
): number {
  const componentAvailability = bundle.includes.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return product ? Math.floor(getAvailableUnits(product, start, end) / item.quantity) : 0;
  });
  return componentAvailability.length ? Math.min(...componentAvailability) : 0;
}

export function rentalPriceBreakdown(
  dailyRate: number,
  quantity: number,
  days: number,
  isVip: boolean,
) {
  const base = dailyRate * quantity * days;
  const promoDiscount = dailyRate * quantity * promoFreeDays(days);
  const afterPromo = Math.max(0, base - promoDiscount);
  const vipDiscount = isVip ? Math.round(afterPromo * 0.15) : 0;
  return { base, promoDiscount, vipDiscount, total: afterPromo - vipDiscount };
}