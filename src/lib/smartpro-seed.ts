import {
  type ApprovalStatus,
  type ExtendRequest,
  type PaymentRecord,
  type ReturnRequest,
  type ScheduleEntry,
  type Transaction,
  type TransactionLine,
  type User,
  type Voucher,
} from "@/lib/smartpro-data";

const iso = (daysFromNow: number, hour = 10): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const day = (daysFromNow: number): string => iso(daysFromNow).slice(0, 10);

const line = (
  key: string,
  name: string,
  duration: "12h" | "24h",
  price: number,
  quantity: number,
  rewardPoints: number,
): TransactionLine => ({ key, name, duration, price, quantity, rewardPoints });

// Additional demo customers beyond the three in INITIAL_USERS.
export const SEED_USERS: User[] = [
  {
    id: "u-raka",
    username: "raka",
    password: "raka123",
    name: "Raka Wijaya",
    role: "pelanggan",
    phone: "6281234001122",
    kycStatus: "Menunggu",
    kyc: {
      namaKtp: "Raka Wijaya",
      nik: "3174000000000002",
      whatsapp: "6281234001122",
      alamat: "Jl. Melati No. 12, Jakarta",
      kontakDarurat: "Sinta, 6281200000002",
      fotoKtp: null,
      fotoSelfie: null,
      signature: null,
    },
    points: 120,
    isVip: false,
    wishlist: ["sony-a6400"],
  },
  {
    id: "u-salsa",
    username: "salsa",
    password: "salsa123",
    name: "Salsa Nirmala",
    role: "pelanggan",
    phone: "6281366204381",
    kycStatus: "Verified",
    kyc: {
      namaKtp: "Salsa Nirmala",
      nik: "3174000000000003",
      whatsapp: "6281366204381",
      alamat: "Jl. Kenanga No. 3, Jakarta",
      kontakDarurat: "Dewi, 6281200000003",
      fotoKtp: null,
      fotoSelfie: null,
      signature: null,
    },
    points: 640,
    isVip: true,
    wishlist: ["cosmo-c2", "atem-mini"],
  },
];

export const SEED_TRANSACTIONS: Transaction[] = [
  {
    id: "trx-seed-1",
    code: "SMP-A1B2C3",
    customerId: "u-pelanggan",
    customerName: "Bima Putra",
    customerPhone: "6281240008890",
    lines: [line("product:cosmo-c1:24h", "COSMO C1 (24 Jam)", "24h", 150000, 1, 15)],
    startDate: day(-1),
    endDate: day(1),
    subtotal: 150000,
    pointsDiscount: 0,
    total: 150000,
    pointsRedeemed: 0,
    pointsEarned: 25,
    dpAmount: 45000,
    remainingAmount: 105000,
    method: "transfer",
    uniqueCode: 347,
    status: "DP Terbayar",
    pickupStatus: "Diambil",
    createdAt: iso(-2),
  },
  {
    id: "trx-seed-2",
    code: "SMP-D4E5F6",
    customerId: "u-salsa",
    customerName: "Salsa Nirmala",
    customerPhone: "6281366204381",
    lines: [line("product:sony-a6400:12h", "SONY A6400 (BO) (12 Jam)", "12h", 85000, 2, 12)],
    startDate: day(2),
    endDate: day(3),
    subtotal: 170000,
    pointsDiscount: 0,
    total: 170000,
    pointsRedeemed: 0,
    pointsEarned: 34,
    dpAmount: 51000,
    remainingAmount: 119000,
    method: "cash",
    uniqueCode: 0,
    status: "Menunggu Pembayaran",
    pickupStatus: "Belum",
    createdAt: iso(-1),
  },
];

export const SEED_PAYMENTS: PaymentRecord[] = [
  {
    id: "pay-seed-1",
    transactionId: "trx-seed-1",
    stage: "DP",
    method: "transfer",
    amount: 45000,
    uniqueCode: 347,
    proofUrl: null,
    status: "Disetujui",
    createdAt: iso(-2),
  },
  {
    id: "pay-seed-2",
    transactionId: "trx-seed-1",
    stage: "Pelunasan",
    method: "transfer",
    amount: 105000,
    uniqueCode: 512,
    proofUrl: null,
    status: "Menunggu",
    createdAt: iso(-1),
  },
  {
    id: "pay-seed-3",
    transactionId: "trx-seed-2",
    stage: "DP",
    method: "cash",
    amount: 51000,
    uniqueCode: 0,
    proofUrl: null,
    status: "Menunggu",
    note: "Cash di studio",
    createdAt: iso(-1),
  },
];

export const SEED_RETURNS: ReturnRequest[] = [
  {
    id: "ret-seed-1",
    transactionId: "trx-seed-1",
    customerName: "Bima Putra",
    target: "admin",
    photos: [],
    status: "Menunggu",
    overtimeHours: 0,
    overtimeFee: 0,
    createdAt: iso(-1),
  },
];

export const SEED_EXTENDS: ExtendRequest[] = [
  {
    id: "ext-seed-1",
    transactionId: "trx-seed-2",
    customerName: "Salsa Nirmala",
    extraHours: 24,
    extraFee: 120000,
    status: "Disetujui",
    paid: false,
    createdAt: iso(-1),
  },
];

export const SEED_SCHEDULE: ScheduleEntry[] = [
  {
    id: "SMP-A1B2C3",
    customer: "Bima Putra",
    product: "COSMO C1",
    duration: "24h",
    date: day(1),
    kind: "Return",
    status: "Menunggu",
    phone: "6281240008890",
  },
  {
    id: "SMP-D4E5F6",
    customer: "Salsa Nirmala",
    product: "SONY A6400 (BO)",
    duration: "12h",
    date: day(2),
    kind: "Pick-Up",
    status: "Menunggu",
    phone: "6281366204381",
  },
  {
    id: "SMP-G7H8I9",
    customer: "Raka Wijaya",
    product: "ATEM MINI",
    duration: "24h",
    date: day(0),
    kind: "Pick-Up",
    status: "Diambil",
    phone: "6281234001122",
  },
];

export const SEED_KYC_PENDING: ApprovalStatus = "Menunggu";

export const SEED_VOUCHERS: Voucher[] = [
  {
    id: "v-holiday10",
    code: "HOLIDAY10",
    type: "percent",
    value: 10,
    minSpend: 100000,
    active: true,
    expiresAt: day(60),
  },
  {
    id: "v-hemat50k",
    code: "HEMAT50K",
    type: "fixed",
    value: 50000,
    minSpend: 300000,
    active: true,
    expiresAt: day(60),
  },
  {
    id: "v-expired",
    code: "LAMA5",
    type: "percent",
    value: 5,
    minSpend: 0,
    active: true,
    expiresAt: day(-1),
  },
];
