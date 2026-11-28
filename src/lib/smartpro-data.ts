export type ProductCategory = "Kamera" | "Wireless Video" | "Switcher & Live";
export type UnitStatus = "READY" | "MAINTENANCE";

export type ProductBooking = {
  start: string;
  end: string;
  quantity: number;
};

export type RentalDuration = "12h" | "24h";

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  price12h: number;
  price24h: number;
  active12h: boolean;
  active24h: boolean;
  bestSeller: boolean;
  imageUrl: string | null;
  rewardPoints: number;
  accessories: string;
  specs: string;
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

export type Role = "admin" | "pelanggan";

export type KycStatus = "Belum" | "Menunggu" | "Verified" | "Ditolak";

export type User = {
  id: string;
  username: string;
  password: string;
  name: string;
  role: Role;
  phone: string;
  kycStatus: KycStatus;
  kyc: {
    namaKtp: string;
    nik: string;
    whatsapp: string;
    alamat: string;
    kontakDarurat: string;
    fotoKtp: string | null;
    fotoSelfie: string | null;
    signature: string | null;
  } | null;
  points: number;
  isVip: boolean;
  wishlist: string[];
  kycNote?: string;
};

export type PaymentMethod = "transfer" | "cash" | "qris";
export type PaymentStage = "DP" | "Pelunasan";
export type ApprovalStatus = "Menunggu" | "Disetujui" | "Ditolak";

export type PaymentRecord = {
  id: string;
  transactionId: string;
  stage: PaymentStage;
  method: PaymentMethod;
  amount: number;
  uniqueCode: number;
  proofUrl: string | null;
  status: ApprovalStatus;
  note?: string;
  createdAt: string;
};

export type CartLineDuration = RentalDuration;

export type TransactionLine = {
  key: string;
  name: string;
  duration: CartLineDuration;
  price: number;
  quantity: number;
  rewardPoints: number;
};

export type Transaction = {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  lines: TransactionLine[];
  startDate: string;
  endDate: string;
  subtotal: number;
  pointsDiscount: number;
  total: number;
  pointsRedeemed: number;
  pointsEarned: number;
  dpAmount: number;
  remainingAmount: number;
  method: PaymentMethod;
  uniqueCode: number;
  voucherCode?: string;
  voucherDiscount?: number;
  vipDiscount?: number;
  status: "Menunggu Pembayaran" | "DP Terbayar" | "Lunas" | "Selesai" | "Dibatalkan";
  pickupStatus: "Belum" | "Diambil" | "Dikembalikan";
  createdAt: string;
};

export type ScheduleEntry = {
  id: string;
  customer: string;
  product: string;
  duration: "12h" | "24h";
  date: string;
  kind: "Pick-Up" | "Return";
  status: "Menunggu" | "Diambil" | "Dikembalikan";
  phone: string;
};

export type ReturnTarget = "admin" | "next-customer";

export type ReturnRequest = {
  id: string;
  transactionId: string;
  customerName: string;
  target: ReturnTarget;
  nextCustomer?: string;
  photos: string[];
  status: ApprovalStatus;
  overtimeHours: number;
  overtimeFee: number;
  note?: string;
  createdAt: string;
};

export type ExtendRequest = {
  id: string;
  transactionId: string;
  customerName: string;
  extraHours: number;
  extraFee: number;
  status: ApprovalStatus;
  paid: boolean;
  createdAt: string;
};

export type WaTemplates = {
  booking: string;
  dp: string;
  lunas: string;
  reminder: string;
  extend: string;
};

export type AdminSettings = {
  minRupiahReward: number;
  poinPerKelipatan: number;
  minPoinTukar: number;
  rupiahPerPoin: number;
  overtimeFee12h: number;
  whatsappAdmin: string;
  vipDiscountPercent: number;
  waTemplates: WaTemplates;
};

export type VoucherType = "percent" | "fixed";

export type Voucher = {
  id: string;
  code: string;
  type: VoucherType;
  value: number;
  minSpend: number;
  active: boolean;
  expiresAt: string;
};

export const DEFAULT_SETTINGS: AdminSettings = {
  minRupiahReward: 150000,
  poinPerKelipatan: 10,
  minPoinTukar: 100,
  rupiahPerPoin: 500,
  overtimeFee12h: 50000,
  whatsappAdmin: "6281200000000",
  vipDiscountPercent: 10,
  waTemplates: {
    booking:
      "Halo {nama}, booking {kode} di SMartPro sudah kami terima. Total {total}. Silakan lanjutkan pembayaran.",
    dp: "Halo {nama}, pembayaran DP untuk {kode} sudah kami terima. Sisa pelunasan {total}.",
    lunas: "Halo {nama}, pembayaran {kode} sudah LUNAS. Terima kasih telah menyewa di SMartPro.",
    reminder:
      "Halo {nama}, pengingat pengembalian untuk {kode}. Mohon kembalikan tepat waktu agar tidak kena denda overtime.",
    extend:
      "Halo {nama}, perpanjangan {kode} disetujui. Silakan lunasi biaya perpanjangan sebesar {total}.",
  },
};

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "cosmo-c1",
    name: "COSMO C1",
    category: "Wireless Video",
    price12h: 95000,
    price24h: 150000,
    active12h: true,
    active24h: true,
    bestSeller: true,
    imageUrl: null,
    rewardPoints: 15,
    accessories: "1 RX, 1 TX, 2 BATERAI NPF, STAND, SDI OR HDMI (PENDEK)",
    specs: "Transmisi wireless SDI/HDMI, jarak hingga 100m, latensi rendah.",
    serials: ["001", "002", "003"].map((number) => ({
      code: `SMP-C1-${number}`,
      status: "READY" as UnitStatus,
    })),
    bookings: [{ start: "2026-11-24", end: "2026-11-26", quantity: 1 }],
    art: "wireless",
  },
  {
    id: "sony-a6400",
    name: "SONY A6400 (BO)",
    category: "Kamera",
    price12h: 85000,
    price24h: 120000,
    active12h: true,
    active24h: true,
    bestSeller: true,
    imageUrl: null,
    rewardPoints: 12,
    accessories: "BATERAI 1, CHARGER, BOX.",
    specs: "Mirrorless APS-C 24MP, autofokus real-time, 4K.",
    serials: ["001", "002"].map((number) => ({
      code: `SMP-A64-${number}`,
      status: "READY" as UnitStatus,
    })),
    bookings: [{ start: "2026-11-21", end: "2026-11-23", quantity: 2 }],
    art: "camera",
  },
  {
    id: "cineview-2-sdi",
    name: "CINEVIEW 2 SDI",
    category: "Wireless Video",
    price12h: 100000,
    price24h: 150000,
    active12h: true,
    active24h: true,
    bestSeller: false,
    imageUrl: null,
    rewardPoints: 15,
    accessories: "1 RX, 1 TX, 4 BATERAI NPF, STAND, SDI OR HDMI (PENDEK)",
    specs: "Wireless video multi-input dengan monitor, dukungan SDI.",
    serials: ["001", "002", "003"].map((number) => ({
      code: `SMP-CV2-${number}`,
      status: number === "003" ? ("MAINTENANCE" as UnitStatus) : ("READY" as UnitStatus),
    })),
    bookings: [],
    art: "monitor",
  },
  {
    id: "cosmo-c2",
    name: "COSMO C2",
    category: "Wireless Video",
    price12h: 220000,
    price24h: 350000,
    active12h: true,
    active24h: true,
    bestSeller: true,
    imageUrl: null,
    rewardPoints: 30,
    accessories: "1 RX, 2 TX, 4 BATERAI NPF, STAND, SDI OR HDMI (PENDEK)",
    specs: "Dua transmitter sekaligus, cocok untuk multicam.",
    serials: ["001", "002"].map((number) => ({
      code: `SMP-C2-${number}`,
      status: "READY" as UnitStatus,
    })),
    bookings: [],
    art: "wireless",
  },
  {
    id: "osee-gostream",
    name: "OSEE GOSTREAM",
    category: "Switcher & Live",
    price12h: 75000,
    price24h: 110000,
    active12h: true,
    active24h: true,
    bestSeller: false,
    imageUrl: null,
    rewardPoints: 11,
    accessories: "4 IN SDI OR HDMI, 2 OUT HDMI, DC IN, KABEL HDMI/SDI 1 M",
    specs: "Switcher live streaming portabel, 4 input.",
    serials: ["001", "002", "003"].map((number) => ({
      code: `SMP-OSE-${number}`,
      status: "READY" as UnitStatus,
    })),
    bookings: [],
    art: "switcher",
  },
  {
    id: "atem-mini",
    name: "ATEM MINI",
    category: "Switcher & Live",
    price12h: 220000,
    price24h: 350000,
    active12h: false,
    active24h: true,
    bestSeller: true,
    imageUrl: null,
    rewardPoints: 30,
    accessories: "4 IN HDMI, 2 OUT HDMI, DC IN, KABEL HDMI 1 M",
    specs: "Switcher HDMI 4 input dengan USB webcam out.",
    serials: ["001", "002"].map((number) => ({
      code: `SMP-ATM-${number}`,
      status: "READY" as UnitStatus,
    })),
    bookings: [{ start: "2026-11-25", end: "2026-11-27", quantity: 2 }],
    art: "switcher",
  },
  {
    id: "ptz-minrray-uv510a",
    name: "PTZ MINRRAY UV510A",
    category: "Kamera",
    price12h: 75000,
    price24h: 110000,
    active12h: true,
    active24h: true,
    bestSeller: false,
    imageUrl: null,
    rewardPoints: 11,
    accessories: "KABEL POWER, BOX, REMOTE",
    specs: "Kamera PTZ 20x zoom, cocok untuk webinar dan hybrid event.",
    serials: ["001", "002", "003"].map((number) => ({
      code: `SMP-PTZ-${number}`,
      status: "READY" as UnitStatus,
    })),
    bookings: [],
    art: "ptz",
  },
  {
    id: "sony-pxw-70",
    name: "SONY PXW-70",
    category: "Kamera",
    price12h: 140000,
    price24h: 200000,
    active12h: true,
    active24h: true,
    bestSeller: false,
    imageUrl: null,
    rewardPoints: 18,
    accessories: "BATERAI 1, CHARGER, BOX.",
    specs: "Camcorder profesional 3G-SDI, zoom optik 12x.",
    serials: ["001", "002"].map((number) => ({
      code: `SMP-PXW-${number}`,
      status: "READY" as UnitStatus,
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

export type AccountTier = "verified" | "vip";

export function rentalDayCount(start: string, end: string): number {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return 1;
  }
  return Math.max(1, Math.ceil((endTime - startTime) / 86_400_000));
}

// Price for a single period at the chosen duration. Pure duration pricing, no promo.
export function periodPrice(product: Product, duration: RentalDuration): number {
  return duration === "12h" ? product.price12h : product.price24h;
}

export function productRewardPoints(product: Product): number {
  return Math.max(0, Math.round(product.rewardPoints));
}

// Points earned for a nominal amount, based on admin settings.
export function computeRewardPoints(amount: number, settings: AdminSettings): number {
  if (settings.minRupiahReward <= 0) return 0;
  return Math.floor(amount / settings.minRupiahReward) * settings.poinPerKelipatan;
}

// Rupiah value of a points redemption, based on admin settings.
export function computePointsDiscount(points: number, settings: AdminSettings): number {
  if (points < settings.minPoinTukar) return 0;
  return points * settings.rupiahPerPoin;
}

// Returns the discount amount for a voucher, or 0 if it cannot be applied.
export function applyVoucher(subtotal: number, voucher: Voucher | null, nowISO: string): number {
  if (!voucher || !voucher.active) return 0;
  if (voucher.expiresAt && nowISO > voucher.expiresAt) return 0;
  if (subtotal < voucher.minSpend) return 0;
  if (voucher.type === "percent") {
    return Math.round((subtotal * Math.min(100, Math.max(0, voucher.value))) / 100);
  }
  return Math.min(subtotal, Math.max(0, voucher.value));
}

export function findVoucher(vouchers: Voucher[], code: string): Voucher | null {
  const normalized = code.trim().toUpperCase();
  return vouchers.find((v) => v.code.toUpperCase() === normalized) ?? null;
}

export function genUniqueCode(seed?: number): number {
  const base = seed ?? Math.floor(Math.random() * 900);
  return 100 + (Math.abs(Math.round(base)) % 900);
}

// Line total for a period count at the chosen duration.
export function lineTotal(pricePerPeriod: number, quantity: number, periods: number): number {
  return pricePerPeriod * Math.max(1, quantity) * Math.max(1, periods);
}

// Deterministic sibling of the seed epoch. Catalog counters are computed for a
// relative window; pinning a second, earlier window keeps the SSR and client
// renders in agreement regardless of which timezone/day each pass observes.
const MOCK_EPOCH = Date.UTC(2026, 10, 23, 10, 0, 0, 0);
const mockDate = (offsetDays: number): string =>
  new Date(MOCK_EPOCH + offsetDays * 86_400_000).toISOString().slice(0, 10);
export const MOCK_START = mockDate(0);
export const MOCK_END = mockDate(1);

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

// Overtime: each started 12-hour block late is charged at the 12h rate.
export function computeOvertime(
  dueDate: string,
  returnedAt: string,
  price12h: number,
): { hours: number; fee: number } {
  const due = Date.parse(`${dueDate}T18:00:00Z`);
  const back = Date.parse(returnedAt);
  if (!Number.isFinite(due) || !Number.isFinite(back) || back <= due) {
    return { hours: 0, fee: 0 };
  }
  const lateHours = Math.ceil((back - due) / 3_600_000);
  const blocks = Math.ceil(lateHours / 12);
  return { hours: lateHours, fee: blocks * price12h };
}
