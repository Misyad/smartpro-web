import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Copy,
  CreditCard,
  FileText,
  Headphones,
  ImagePlus,
  Instagram,
  MapPin,
  PackageCheck,
  PackagePlus,
  Play,
  Plus,
  Printer,
  QrCode,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  UserRoundCheck,
  UsersRound,
  Video,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { BrandMark, ProductArt, ProductCard } from "@/components/smartpro/product-card";
import {
  getAvailableUnits,
  getBundleAvailability,
  INITIAL_BUNDLES,
  INITIAL_PRODUCTS,
  promoFreeDays,
  rentalDayCount,
  rentalPriceBreakdown,
  type AccountTier,
  type Bundle,
  type Product,
  type ProductCategory,
} from "@/lib/smartpro-data";

type CartLine = {
  key: string;
  name: string;
  price: number;
  quantity: number;
  kind: "product" | "bundle" | "addon";
  details?: string;
};

type ScheduleEntry = {
  id: string;
  customer: string;
  product: string;
  serial: string;
  date: string;
  kind: "Pick-Up" | "Return";
  status: "Menunggu" | "Diambil" | "Dikembalikan";
  phone: string;
};

type ActiveRental = {
  id: string;
  customer: string;
  productId: string;
  serial: string;
  dueDate: string;
  phone: string;
};

type KycCase = {
  id: string;
  name: string;
  phone: string;
  instagram: string;
  project: string;
  status: "Menunggu" | "Disetujui" | "Ditolak";
};

const CATEGORIES = [
  "Semua Alat",
  "Paket Bundling",
  "Kamera",
  "Wireless Video",
  "Switcher & Live",
] as const;
const ADD_ONS = [
  {
    id: "cable-20m",
    name: "Kabel SDI / HDMI 20m",
    detail: "Kabel panjang untuk jalur kamera",
    price: 35000,
  },
  {
    id: "battery-npf",
    name: "Extra 2× Baterai NPF-970",
    detail: "Cadangan daya produksi",
    price: 50000,
  },
  {
    id: "sigma-16",
    name: "Lensa Sigma 16mm",
    detail: "Lensa wide untuk kamera Sony",
    price: 150000,
  },
  {
    id: "switcher-operator",
    name: "Operator Switcher 8 Jam",
    detail: "Operator untuk kebutuhan live",
    price: 350000,
  },
];
const GUIDE_TIPS: Record<string, { steps: string[]; tip: string }> = {
  "cosmo-c1": {
    steps: [
      "Sambungkan TX ke kamera melalui HDMI atau SDI.",
      "Hubungkan RX ke monitor atau switcher.",
      "Nyalakan kedua unit dan pilih kanal yang sama.",
    ],
    tip: "Gunakan kabel pendek bawaan untuk mengurangi risiko konektor tertarik.",
  },
  "sony-a6400": {
    steps: [
      "Pasang baterai dan kartu memori.",
      "Atur format rekam sesuai kebutuhan produksi.",
      "Sambungkan HDMI ke perangkat capture atau transmitter.",
    ],
    tip: "Nonaktifkan tampilan informasi HDMI untuk feed yang lebih bersih.",
  },
  "cineview-2-sdi": {
    steps: [
      "Pasang antena pada TX dan RX.",
      "Sambungkan video input dan output.",
      "Pilih kanal bersih sebelum mulai merekam.",
    ],
    tip: "Tempatkan RX lebih tinggi untuk menjaga jalur wireless tetap jelas.",
  },
  "cosmo-c2": {
    steps: [
      "Sambungkan dua TX ke kamera masing-masing.",
      "Pilih kanal TX yang berbeda.",
      "Pantau kedua feed dari RX dan perangkat tujuan.",
    ],
    tip: "Jaga jarak TX dari router Wi-Fi saat lokasi padat sinyal.",
  },
  "osee-gostream": {
    steps: [
      "Hubungkan sumber video ke input yang tersedia.",
      "Atur output program ke monitor atau capture card.",
      "Pilih layout dan cek audio sebelum siaran.",
    ],
    tip: "Lakukan tes semua input sebelum acara mulai.",
  },
  "atem-mini": {
    steps: [
      "Sambungkan kamera ke input HDMI.",
      "Hubungkan USB-C ke komputer streaming.",
      "Pilih kamera aktif dan tes transisi.",
    ],
    tip: "Siapkan multiview agar operator dapat memantau semua input.",
  },
  "ptz-minrray-uv510a": {
    steps: [
      "Hubungkan kabel power dan video.",
      "Atur preset posisi kamera melalui remote.",
      "Tes gerak pan, tilt, dan zoom perlahan.",
    ],
    tip: "Simpan posisi wide sebagai preset aman sebelum acara.",
  },
  "sony-pxw-70": {
    steps: [
      "Pasang baterai dan cek ruang kartu.",
      "Atur format rekam dan white balance.",
      "Tes fokus, audio, dan output video.",
    ],
    tip: "Kunci white balance setelah kondisi cahaya stabil.",
  },
};

const INITIAL_SCHEDULE: ScheduleEntry[] = [
  {
    id: "SMP-848990",
    customer: "Bima Putra",
    product: "SONY PXW-70",
    serial: "SMP-PXW-001",
    date: "2026-11-21",
    kind: "Return",
    status: "Menunggu",
    phone: "0812-4000-8890",
  },
  {
    id: "SMP-849012",
    customer: "Nadia Pratama",
    product: "SONY A6400 (BO)",
    serial: "SMP-A64-001",
    date: "2026-11-21",
    kind: "Pick-Up",
    status: "Menunggu",
    phone: "0813-8000-9112",
  },
  {
    id: "SMP-849028",
    customer: "Studio Karsa",
    product: "OSEE GOSTREAM",
    serial: "SMP-OSE-002",
    date: "2026-11-21",
    kind: "Pick-Up",
    status: "Diambil",
    phone: "0811-2990-7680",
  },
  {
    id: "SMP-849031",
    customer: "Ruang Sore EO",
    product: "ATEM MINI",
    serial: "SMP-ATM-002",
    date: "2026-11-21",
    kind: "Return",
    status: "Dikembalikan",
    phone: "0812-7100-2265",
  },
];

const INITIAL_RENTALS: ActiveRental[] = [
  {
    id: "SMP-848990",
    customer: "Bima Putra",
    productId: "sony-pxw-70",
    serial: "SMP-PXW-001",
    dueDate: "2026-11-21",
    phone: "0812-4000-8890",
  },
  {
    id: "SMP-849012",
    customer: "Nadia Pratama",
    productId: "sony-a6400",
    serial: "SMP-A64-001",
    dueDate: "2026-11-21",
    phone: "0813-8000-9112",
  },
];

const INITIAL_KYC: KycCase[] = [
  {
    id: "KYC-2026-118",
    name: "Dimas Mahendra",
    phone: "0812-7771-0912",
    instagram: "@dimasvisual",
    project: "Dokumentasi konferensi",
    status: "Menunggu",
  },
  {
    id: "KYC-2026-121",
    name: "Salsa Nirmala",
    phone: "0813-6620-4381",
    instagram: "@salsacreates",
    project: "Live streaming hybrid",
    status: "Menunggu",
  },
];

const INITIAL_VIPS = [
  { name: "Ruang Sore EO", contact: "0812-7100-2265", discount: 15, points: 4850 },
  { name: "Studio Karsa", contact: "0811-2990-7680", discount: 15, points: 2100 },
];

const formatRupiah = (amount: number) => `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
const formatDate = (date: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${date}T00:00:00`),
  );

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="flex min-h-32 flex-col justify-between border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <span className="grid size-9 place-items-center rounded-full bg-surface-soft text-gold-ink">
          <Icon className="size-4" />
        </span>
      </div>
      <div>
        <p className="wordmark text-lg font-semibold">{value}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
      </div>
    </div>
  );
}

function SignaturePad({ onChange }: { onChange: (signed: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paths, setPaths] = useState<{ x: number; y: number }[][]>([]);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--foreground")
      .trim();
    paths.forEach((path) => {
      if (!path.length) return;
      context.beginPath();
      context.moveTo(path[0]?.x ?? 0, path[0]?.y ?? 0);
      path.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
    });
    onChange(paths.some((path) => path.length > 1));
  }, [paths, onChange]);

  const pointFrom = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  return (
    <div>
      <div className="overflow-hidden rounded-sm border border-border bg-surface-soft">
        <canvas
          ref={canvasRef}
          width={600}
          height={140}
          className="signature-pad h-28 w-full cursor-crosshair"
          aria-label="Bidang tanda tangan digital"
          onPointerDown={(event) => {
            drawing.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            const point = pointFrom(event);
            setPaths((current) => [...current, [point]]);
          }}
          onPointerMove={(event) => {
            if (!drawing.current) return;
            const point = pointFrom(event);
            setPaths((current) => {
              const updated = [...current];
              const lastIndex = updated.length - 1;
              const lastPath = updated[lastIndex];
              if (lastIndex >= 0 && lastPath) updated[lastIndex] = [...lastPath, point];
              return updated;
            });
          }}
          onPointerUp={() => {
            drawing.current = false;
          }}
          onPointerCancel={() => {
            drawing.current = false;
          }}
          onPointerLeave={() => {
            drawing.current = false;
          }}
        />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setPaths((current) => current.slice(0, -1))}
        >
          Urungkan
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setPaths([])}>
          Bersihkan
        </Button>
      </div>
    </div>
  );
}

function BundleCard({
  bundle,
  availability,
  quantity,
  products,
  onAdd,
  onRemove,
}: {
  bundle: Bundle;
  availability: number;
  quantity: number;
  products: Product[];
  onAdd: () => void;
  onRemove: () => void;
}) {
  const contents = bundle.includes.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return `${item.quantity}× ${product?.name ?? "Perangkat"}`;
  });
  return (
    <article className="tag-card flex h-full flex-col border-gold/40">
      <div className="tag-stage min-h-[220px] bg-surface-soft">
        <span className="tag-hole" aria-hidden="true" />
        <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold uppercase text-primary">
          <Sparkles className="size-3" /> Paket hemat
        </div>
        <div className="flex items-end justify-center gap-[-14px] pt-5">
          {bundle.includes.slice(0, 3).map((item, index) => {
            const product = products.find((entry) => entry.id === item.productId);
            if (!product) return null;
            return (
              <ProductArt
                key={`${bundle.id}-${item.productId}`}
                art={product.art}
                name={product.name}
              />
            );
          })}
        </div>
        <div className="tag-price-tab">
          <span className="wordmark text-xs font-semibold">
            {bundle.price.toLocaleString("id-ID")}
          </span>
          <span className="mt-1 text-[11px] font-bold tracking-[0.08em] text-muted-foreground">
            / 24 JAM
          </span>
        </div>
        <span
          className={`absolute bottom-3 left-3 z-10 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${availability > 0 ? "border-success/20 bg-success-soft text-success" : "border-alert/20 bg-alert-soft text-alert"}`}
        >
          {availability > 0 ? `Tersedia ${availability} Paket` : "Paket sedang penuh"}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-1 pb-1 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="wordmark text-[11px] font-semibold leading-5">{bundle.name}</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {contents.join(" · ")}
            </p>
            <p className="mt-1 min-h-8 text-[11px] text-muted-foreground">{bundle.note}</p>
          </div>
          <BrandMark />
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border/70 pt-3">
          <div>
            <p className="text-[11px] text-muted-foreground line-through">
              {formatRupiah(bundle.regularPrice)}
            </p>
            <p className="text-xs font-bold text-gold-ink">
              Hemat {formatRupiah(bundle.regularPrice - bundle.price)}
            </p>
          </div>
          {quantity > 0 ? (
            <div className="flex h-8 items-center overflow-hidden rounded-full border border-border bg-surface-soft">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-none"
                onClick={onRemove}
                aria-label={`Kurangi ${bundle.name}`}
              >
                −
              </Button>
              <span className="min-w-6 text-center text-xs font-bold">{quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-none"
                onClick={onAdd}
                disabled={quantity >= availability}
                aria-label={`Tambah ${bundle.name}`}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              onClick={onAdd}
              disabled={availability === 0}
            >
              <Plus className="size-3.5" /> Pilih Paket
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export function SmartProApp() {
  const [view, setView] = useState<"catalog" | "admin">("catalog");
  const [adminSection, setAdminSection] = useState("Ringkasan");
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [startDate, setStartDate] = useState("2026-11-20");
  const [endDate, setEndDate] = useState("2026-11-22");
  const [tier, setTier] = useState<AccountTier>("regular");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("Semua Alat");
  const [searchText, setSearchText] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [notice, setNotice] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [guideProduct, setGuideProduct] = useState<Product | null>(null);
  const [extendOpen, setExtendOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [checkoutCode, setCheckoutCode] = useState("");
  const [pickupMode, setPickupMode] = useState<"studio" | "courier">("studio");
  const [paymentMethod, setPaymentMethod] = useState("QRIS");
  const [paymentScheme, setPaymentScheme] = useState("50");
  const [kycFastPath, setKycFastPath] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [signatureReady, setSignatureReady] = useState(false);
  const [kycFields, setKycFields] = useState({
    name: "",
    nik: "",
    phone: "",
    instagram: "",
    address: "",
    emergency: "",
  });
  const [kycFiles, setKycFiles] = useState<
    Record<string, { name: string; preview: string | null }>
  >({});
  const [pointsApplied, setPointsApplied] = useState(false);
  const [delivery, setDelivery] = useState(false);
  const [quoteFields, setQuoteFields] = useState({ client: "", project: "", pic: "" });
  const [now, setNow] = useState(Date.now());
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(INITIAL_SCHEDULE);
  const [activeRentals, setActiveRentals] = useState<ActiveRental[]>(INITIAL_RENTALS);
  const [kycQueue, setKycQueue] = useState<KycCase[]>(INITIAL_KYC);
  const [verifiedPhones, setVerifiedPhones] = useState<string[]>([]);
  const [vips, setVips] = useState(INITIAL_VIPS);
  const [scheduleFilter, setScheduleFilter] = useState("Semua");
  const [autoWa, setAutoWa] = useState(true);
  const [waLogs, setWaLogs] = useState<string[]>([
    "08:12 · SMP-848990 · Pengingat kembali terkirim",
  ]);
  const [bastEntry, setBastEntry] = useState<ScheduleEntry | null>(null);
  const [bastChecked, setBastChecked] = useState<string[]>([]);
  const [bastPhoto, setBastPhoto] = useState<string | null>(null);
  const [kycDetail, setKycDetail] = useState<KycCase | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [scanText, setScanText] = useState("");
  const [scanResult, setScanResult] = useState<
    (Product["serials"][number] & { productName: string }) | null
  >(null);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProductFields, setNewProductFields] = useState({
    name: "",
    category: "Kamera" as ProductCategory,
    price: "",
    stock: "1",
  });
  const [newVip, setNewVip] = useState({ name: "", contact: "", discount: "15", points: "1000" });
  const [pointsBonus, setPointsBonus] = useState<Record<string, string>>({});
  const [activeSerial, setActiveSerial] = useState("");
  const [countdownTick, setCountdownTick] = useState(0);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
      setCountdownTick((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const days = rentalDayCount(startDate, endDate);
  const freeDays = promoFreeDays(days);
  const isVip = tier === "vip";
  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesCategory =
          category === "Semua Alat" ||
          category === "Paket Bundling" ||
          product.category === category;
        const matchesSearch = `${product.name} ${product.category}`
          .toLowerCase()
          .includes(searchText.toLowerCase());
        const available = getAvailableUnits(product, startDate, endDate);
        return matchesCategory && matchesSearch && (!availableOnly || available > 0);
      }),
    [products, category, searchText, availableOnly, startDate, endDate],
  );
  const visibleBundles = useMemo(
    () =>
      INITIAL_BUNDLES.filter((bundle) => {
        const matchesSearch =
          `${bundle.name} ${bundle.includes.map((item) => products.find((product) => product.id === item.productId)?.name ?? "").join(" ")}`
            .toLowerCase()
            .includes(searchText.toLowerCase());
        return matchesSearch;
      }),
    [products, searchText],
  );

  const pricing = useMemo(() => {
    const lineDetails = cart.map((line) => ({
      line,
      breakdown: rentalPriceBreakdown(line.price, line.quantity, days, isVip),
    }));
    const base = lineDetails.reduce((sum, item) => sum + item.breakdown.base, 0);
    const promo = lineDetails.reduce((sum, item) => sum + item.breakdown.promoDiscount, 0);
    const vipDiscount = lineDetails.reduce((sum, item) => sum + item.breakdown.vipDiscount, 0);
    const beforePoints = lineDetails.reduce((sum, item) => sum + item.breakdown.total, 0);
    const pointsDiscount = pointsApplied ? Math.min(50000, beforePoints) : 0;
    const deliveryFee = delivery ? 35000 : 0;
    return {
      lineDetails,
      base,
      promo,
      vipDiscount,
      pointsDiscount,
      deliveryFee,
      total: beforePoints - pointsDiscount + deliveryFee,
    };
  }, [cart, days, isVip, pointsApplied, delivery]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const pendingKyc = kycQueue.filter((item) => item.status === "Menunggu").length;
  const pickupCount = schedule.filter(
    (item) => item.date === "2026-11-21" && item.kind === "Pick-Up" && item.status === "Menunggu",
  ).length;
  const returnCount = schedule.filter(
    (item) => item.date === "2026-11-21" && item.kind === "Return" && item.status === "Menunggu",
  ).length;
  const todayRows = schedule.filter((item) => item.date === "2026-11-21");
  const visibleSchedule = todayRows.filter(
    (item) => scheduleFilter === "Semua" || item.kind === scheduleFilter,
  );
  const revenue = activeRentals.reduce((sum, rental) => {
    const product = products.find((item) => item.id === rental.productId);
    return sum + (product?.price ?? 0);
  }, 0);

  const notify = (message: string) => setNotice(message);

  const addLine = (newLine: Omit<CartLine, "quantity">, maxQuantity: number) => {
    setCart((current) => {
      const existing = current.find((item) => item.key === newLine.key);
      if (existing) {
        if (existing.quantity >= maxQuantity) return current;
        return current.map((item) =>
          item.key === newLine.key ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      if (maxQuantity < 1) return current;
      return [...current, { ...newLine, quantity: 1 }];
    });
  };

  const updateLine = (key: string, delta: number) => {
    setCart((current) =>
      current
        .map((item) => (item.key === key ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0),
    );
  };

  const addProduct = (product: Product) => {
    const available = getAvailableUnits(product, startDate, endDate);
    const current = cart.find((item) => item.key === `product:${product.id}`)?.quantity ?? 0;
    if (current >= available)
      return notify("Jumlah melebihi unit yang tersedia untuk tanggal tersebut.");
    addLine(
      {
        key: `product:${product.id}`,
        name: product.name,
        price: product.price,
        kind: "product",
        details: product.category,
      },
      available,
    );
    notify(`${product.name} ditambahkan ke Tas Sewa.`);
  };

  const addBundle = (bundle: Bundle) => {
    const available = getBundleAvailability(bundle, products, startDate, endDate);
    const current = cart.find((item) => item.key === `bundle:${bundle.id}`)?.quantity ?? 0;
    if (current >= available) return notify("Paket tidak tersedia untuk tanggal tersebut.");
    addLine(
      {
        key: `bundle:${bundle.id}`,
        name: bundle.name,
        price: bundle.price,
        kind: "bundle",
        details: "Paket bundling",
      },
      available,
    );
    notify(`${bundle.name} ditambahkan ke Tas Sewa.`);
  };

  const startCheckout = () => {
    if (!cart.length) return notify("Tambahkan alat atau paket sebelum melanjutkan.");
    setCheckoutStep(1);
    setCheckoutCode("");
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  const finishBooking = () => {
    const code = `SMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const customerName = kycFastPath
      ? tier === "vip"
        ? "Partner VIP"
        : "Verified Member"
      : kycFields.name;
    setCheckoutCode(code);
    setSchedule((current) => [
      {
        id: code,
        customer: customerName || "Pelanggan SMartPro",
        product: cart.map((item) => item.name).join(", "),
        serial: "Dialokasikan saat pengambilan",
        date: startDate,
        kind: "Pick-Up",
        status: "Menunggu",
        phone: kycFastPath ? "" : kycFields.phone,
      },
      ...current,
    ]);
    if (!kycFastPath && kycFields.name) {
      setKycQueue((current) => [
        {
          id: `KYC-${code}`,
          name: kycFields.name,
          phone: kycFields.phone,
          instagram: kycFields.instagram,
          project: quoteFields.project || "Booking baru",
          status: "Menunggu",
        },
        ...current,
      ]);
    }
    const firstProduct =
      products.find((product) => cart.some((line) => line.key === `product:${product.id}`)) ??
      products[0];
    if (firstProduct) {
      setActiveRentals((current) => [
        {
          id: code,
          customer: customerName || "Pelanggan SMartPro",
          productId: firstProduct.id,
          serial: "Menunggu alokasi unit",
          dueDate: endDate,
          phone: kycFastPath ? "" : kycFields.phone,
        },
        ...current,
      ]);
    }
    setCart([]);
    setPointsApplied(false);
    setDelivery(false);
    setCheckoutStep(4);
    notify(`Booking ${code} berhasil dibuat.`);
  };

  const changeStock = (productId: string, stock: number) => {
    const requested = Math.max(1, Math.min(99, Math.floor(stock) || 1));
    setProducts((current) =>
      current.map((product) => {
        if (product.id !== productId) return product;
        const serials = [...product.serials];
        const prefix = serials[0]?.code.replace(/-\d+$/, "") ?? `SMP-${productId.toUpperCase()}`;
        if (requested < serials.length) serials.length = requested;
        while (serials.length < requested) {
          const nextNumber = serials.length + 1;
          serials.push({
            code: `${prefix}-${String(nextNumber).padStart(3, "0")}`,
            status: "READY",
          });
        }
        return { ...product, serials };
      }),
    );
  };

  const toggleMaintenance = (productId: string, serialCode: string) => {
    setProducts((current) =>
      current.map((product) =>
        product.id !== productId
          ? product
          : {
              ...product,
              serials: product.serials.map((serial) =>
                serial.code !== serialCode
                  ? serial
                  : {
                      ...serial,
                      status: serial.status === "MAINTENANCE" ? "READY" : "MAINTENANCE",
                    },
              ),
            },
      ),
    );
    const target = products
      .find((item) => item.id === productId)
      ?.serials.find((item) => item.code === serialCode);
    const nextStatus =
      target?.status === "MAINTENANCE" ? "kembali tersedia" : "dikunci untuk servis";
    setActiveSerial(serialCode);
    notify(`${serialCode} ${nextStatus}.`);
  };

  const openScanResult = () => {
    const matchedProduct = products.find((product) =>
      product.serials.some((serial) => serial.code.toLowerCase() === scanText.trim().toLowerCase()),
    );
    const matchedSerial = matchedProduct?.serials.find(
      (serial) => serial.code.toLowerCase() === scanText.trim().toLowerCase(),
    );
    if (!matchedProduct || !matchedSerial) {
      setScanResult(null);
      return notify("Nomor serial tidak ditemukan di demo inventaris.");
    }
    setScanResult({ ...matchedSerial, productName: matchedProduct.name });
    notify(`Aset ${matchedSerial.code} ditemukan.`);
  };

  const handleKycFile = (key: string, file: File | undefined) => {
    if (!file) return;
    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    setKycFiles((current) => ({ ...current, [key]: { name: file.name, preview } }));
  };

  const nextCheckoutStep = () => {
    if (checkoutStep === 2 && !kycFastPath) {
      const missingFields = Object.entries(kycFields)
        .filter(([, value]) => !value)
        .map(([key]) => key);
      const problems: string[] = [];
      if (missingFields.length) problems.push("Lengkapi seluruh data penyewa");
      if (kycFields.nik.length !== 16) problems.push("NIK harus 16 digit");
      if (Object.keys(kycFiles).length < 3) problems.push("Unggah 3 dokumen verifikasi");
      if (!signatureReady) problems.push("Bubuhkan tanda tangan digital");
      if (problems.length) {
        const message = `Belum lengkap: ${problems.join(", ")}.`;
        setCheckoutError(message);
        notify(message);
        return;
      }
    }
    setCheckoutError("");
    if (checkoutStep === 3) return finishBooking();
    setCheckoutStep((step) => Math.min(4, step + 1));
  };

  const setScheduleStatus = (entry: ScheduleEntry, status: ScheduleEntry["status"]) => {
    setSchedule((current) =>
      current.map((item) => (item.id === entry.id ? { ...item, status } : item)),
    );
    notify(`${entry.id} diperbarui: ${status}.`);
  };

  const approveKyc = (entry: KycCase) => {
    setKycQueue((current) =>
      current.map((item) => (item.id === entry.id ? { ...item, status: "Disetujui" } : item)),
    );
    setVerifiedPhones((current) =>
      current.includes(entry.phone) ? current : [...current, entry.phone],
    );
    setKycDetail(null);
    notify(`${entry.name} disetujui sebagai Verified Member.`);
  };

  const rejectKyc = (entry: KycCase) => {
    if (!rejectReason.trim()) return notify("Tambahkan alasan penolakan sebelum melanjutkan.");
    setKycQueue((current) =>
      current.map((item) => (item.id === entry.id ? { ...item, status: "Ditolak" } : item)),
    );
    setKycDetail(null);
    setRejectReason("");
    notify(`KYC ${entry.name} ditolak: ${rejectReason.trim()}`);
  };

  const extendRental = (rental: ActiveRental) => {
    const tomorrow = new Date(`${rental.dueDate}T00:00:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDate = tomorrow.toISOString().slice(0, 10);
    const nextDay = new Date(`${nextDate}T00:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);
    const available = products.find((product) => product.id === rental.productId);
    const openUnit = available
      ? getAvailableUnits(available, nextDate, nextDay.toISOString().slice(0, 10)) > 0
      : false;
    if (!openUnit)
      return notify("Unit ini sudah terbooking pada tanggal perpanjangan. Silakan hubungi tim.");
    setActiveRentals((current) =>
      current.map((item) => (item.id === rental.id ? { ...item, dueDate: nextDate } : item)),
    );
    notify(`${rental.id} berhasil diperpanjang 24 jam.`);
  };

  const countdown = (rental: ActiveRental) => {
    const deadline = new Date(`${rental.dueDate}T18:00:00`).getTime();
    const remaining = Math.max(0, deadline - now - countdownTick * 0);
    const hours = Math.floor(remaining / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);
    const seconds = Math.floor((remaining % 60_000) / 1000);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const checkoutWhatsapp = `https://wa.me/?text=${encodeURIComponent(`Halo SMartPro, booking saya ${checkoutCode}. Mohon konfirmasi pengambilan.`)}`;

  return (
    <div className="smartpro-app min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-fit items-center gap-2.5">
            <BrandMark className="size-10" />
            <div>
              <p className="wordmark text-[11px] font-bold leading-4">SMartPro</p>
              <p className="text-[11px] font-medium text-muted-foreground">
                Audio Video Production
              </p>
            </div>
          </div>

          <div className="order-3 flex w-full items-center rounded-full bg-surface-soft p-1 sm:order-2 sm:ml-auto sm:w-auto">
            <Button
              variant={view === "catalog" ? "default" : "ghost"}
              size="sm"
              className="h-8 flex-1 rounded-full px-3 text-[11px] sm:flex-none"
              onClick={() => setView("catalog")}
            >
              <ShoppingBag className="size-3.5" /> Katalog Sewa
            </Button>
            <Button
              variant={view === "admin" ? "default" : "ghost"}
              size="sm"
              className="h-8 flex-1 rounded-full px-3 text-[11px] sm:flex-none"
              onClick={() => setView("admin")}
            >
              <Activity className="size-3.5" /> Dashboard Admin
              {pendingKyc > 0 && (
                <span className="grid size-4 place-items-center rounded-full bg-gold text-[11px] text-primary">
                  {pendingKyc}
                </span>
              )}
            </Button>
          </div>

          {view === "catalog" && (
            <div className="ml-auto flex w-full items-center gap-2 sm:order-3 sm:ml-0 sm:w-auto">
              <div className="relative min-w-0 flex-1 sm:w-48 sm:flex-none">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Cari perangkat"
                  placeholder="Cari perangkat..."
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  className="h-9 rounded-full border-transparent bg-surface-soft pl-9 text-xs"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 shrink-0 rounded-full px-3 text-xs"
                onClick={() => setExtendOpen(true)}
              >
                <Clock3 className="size-3.5" />
                <span className="hidden sm:inline">Extend 1-Klik</span>
                <span className="sm:hidden">Extend</span>
              </Button>
              <Button
                size="sm"
                className="h-9 shrink-0 rounded-full px-3 text-xs"
                onClick={() => setCartOpen(true)}
              >
                <ShoppingBag className="size-3.5" />
                <span className="hidden sm:inline">Tas Sewa</span>
                {cartCount > 0 && (
                  <span className="grid size-5 place-items-center rounded-full bg-gold text-[11px] text-primary">
                    {cartCount}
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-7 sm:px-6 lg:px-8">
        {view === "catalog" ? (
          <>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="section-label mb-2">Rental gear · Jakarta</p>
                <h1 className="wordmark text-xl font-semibold sm:text-2xl">Katalog Perangkat</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Perangkat produksi pilihan, siap mendukung setiap frame.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="grid size-8 place-items-center rounded-full bg-surface-soft text-gold-ink">
                  <ShieldCheck className="size-4" />
                </span>
                <span>Unit terawat · Tim produksi berpengalaman</span>
              </div>
            </div>

            <section
              className="mb-7 grid gap-4 border-y border-border bg-card py-4 md:grid-cols-[1.2fr_1.2fr_1fr] md:items-center md:px-4"
              aria-label="Tanggal sewa dan tier akun"
            >
              <div className="grid grid-cols-2 gap-3">
                <label className="min-w-0">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Tanggal ambil
                  </span>
                  <Input
                    aria-label="Tanggal ambil"
                    type="date"
                    value={startDate}
                    onChange={(event) => {
                      setStartDate(event.target.value);
                      if (event.target.value >= endDate) {
                        const next = new Date(`${event.target.value}T00:00:00`);
                        next.setDate(next.getDate() + 1);
                        setEndDate(next.toISOString().slice(0, 10));
                      }
                    }}
                    className="h-10 border-transparent bg-surface-soft text-xs"
                  />
                </label>
                <label className="min-w-0">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Tanggal kembali
                  </span>
                  <Input
                    aria-label="Tanggal kembali"
                    type="date"
                    min={startDate}
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="h-10 border-transparent bg-surface-soft text-xs"
                  />
                </label>
              </div>
              <div className="flex items-center gap-3 border-y border-border/70 py-3 md:justify-center md:border-y-0 md:border-x md:px-5 md:py-0">
                <span className="grid size-9 place-items-center rounded-full bg-surface-soft text-gold-ink">
                  <CalendarDays className="size-4" />
                </span>
                <div>
                  <p className="wordmark text-sm font-semibold">{days}× 24 JAM</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(startDate)} s/d {formatDate(endDate)}
                  </p>
                </div>
                {freeDays > 0 && (
                  <Badge className="ml-auto border-gold/30 bg-amber-soft text-amber hover:bg-amber-soft">
                    Sewa {days} Gratis {freeDays}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Tier
                </span>
                {(
                  [
                    ["regular", "Reguler"],
                    ["verified", "Verified · 1.450 poin"],
                    ["vip", "Partner VIP · 15%"],
                  ] as [AccountTier, string][]
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={tier === value ? "default" : "outline"}
                    className="h-8 rounded-full px-2.5 text-[11px]"
                    onClick={() => {
                      setTier(value);
                      setKycFastPath(value !== "regular");
                      setPointsApplied(false);
                      setPaymentScheme(value === "vip" ? "30" : "50");
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </section>

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="chips-scroll scroll-fade scroll-fade-inline flex max-w-full snap-x snap-mandatory gap-2 overflow-x-auto pb-1 text-foreground">
                {CATEGORIES.map((item) => (
                  <Button
                    key={item}
                    variant={category === item ? "default" : "outline"}
                    size="sm"
                    className="h-9 shrink-0 snap-start rounded-full px-4 text-xs"
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
              <label className="flex shrink-0 items-center gap-2 text-xs font-medium">
                <Checkbox
                  checked={availableOnly}
                  onCheckedChange={(checked) => setAvailableOnly(checked === true)}
                />
                Hanya unit tersedia
              </label>
            </div>

            {(category === "Semua Alat" || category === "Paket Bundling") &&
              visibleBundles.length > 0 && (
                <section className="mb-9" aria-labelledby="bundles-heading">
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <p className="section-label">Siap produksi</p>
                      <h2 id="bundles-heading" className="wordmark mt-1 text-sm font-semibold">
                        Paket Bundling
                      </h2>
                    </div>
                    <p className="text-xs text-muted-foreground">Harga paket berlaku per 24 jam</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleBundles.map((bundle) => (
                      <BundleCard
                        key={bundle.id}
                        bundle={bundle}
                        products={products}
                        availability={getBundleAvailability(bundle, products, startDate, endDate)}
                        quantity={
                          cart.find((line) => line.key === `bundle:${bundle.id}`)?.quantity ?? 0
                        }
                        onAdd={() => addBundle(bundle)}
                        onRemove={() => updateLine(`bundle:${bundle.id}`, -1)}
                      />
                    ))}
                  </div>
                </section>
              )}

            {category !== "Paket Bundling" && (
              <section aria-labelledby="products-heading">
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="section-label">Perangkat pilihan</p>
                    <h2 id="products-heading" className="wordmark mt-1 text-sm font-semibold">
                      {category === "Semua Alat" ? "Semua Perangkat" : category}
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {filteredProducts.length} perangkat
                  </p>
                </div>
                {filteredProducts.length ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        available={getAvailableUnits(product, startDate, endDate)}
                        quantity={
                          cart.find((line) => line.key === `product:${product.id}`)?.quantity ?? 0
                        }
                        onAdd={() => addProduct(product)}
                        onRemove={() => updateLine(`product:${product.id}`, -1)}
                        onGuide={() => setGuideProduct(product)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-border py-14 text-center">
                    <Search className="mx-auto size-6 text-muted-foreground" />
                    <p className="mt-3 text-sm font-semibold">Perangkat tidak ditemukan</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Coba ubah kata pencarian atau tanggal sewa.
                    </p>
                  </div>
                )}
              </section>
            )}
          </>
        ) : (
          <section>
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="section-label mb-2">Workspace operasional · 21 November 2026</p>
                <h1 className="wordmark text-xl font-semibold sm:text-2xl">Dashboard Admin</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Jadwal, aset, dan verifikasi pelanggan dalam satu ruang kerja.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-success/20 bg-success-soft px-3 py-2 text-[11px] font-semibold text-success">
                <span className="size-2 rounded-full bg-success" /> Demo lokal aktif
              </div>
            </div>

            <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
              {["Ringkasan", "Jadwal", "Verifikasi KYC", "Inventaris", "Mitra VIP"].map((item) => (
                <Button
                  key={item}
                  variant="ghost"
                  className={`h-10 shrink-0 rounded-none border-b-2 px-4 text-xs ${adminSection === item ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
                  onClick={() => setAdminSection(item)}
                >
                  {item}
                  {item === "Verifikasi KYC" && pendingKyc > 0 && (
                    <span className="ml-1 grid size-4 place-items-center rounded-full bg-alert text-[11px] text-primary-foreground">
                      {pendingKyc}
                    </span>
                  )}
                </Button>
              ))}
            </div>

            {adminSection === "Ringkasan" && (
              <>
                <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    icon={PackageCheck}
                    label="Pick-Up Hari Ini"
                    value={String(pickupCount).padStart(2, "0")}
                    note="Menunggu diambil"
                  />
                  <MetricCard
                    icon={ArrowDownToLine}
                    label="Return Hari Ini"
                    value={String(returnCount).padStart(2, "0")}
                    note="Menunggu kembali"
                  />
                  <MetricCard
                    icon={UserRoundCheck}
                    label="Pending KYC"
                    value={String(pendingKyc).padStart(2, "0")}
                    note="Perlu pemeriksaan"
                  />
                  <MetricCard
                    icon={WalletCards}
                    label="Rental Aktif / Nilai"
                    value={`${activeRentals.length} / ${formatRupiah(revenue)}`}
                    note="Nilai sewa harian aktif"
                  />
                </div>
                <div className="grid gap-8 xl:grid-cols-[1.5fr_1fr]">
                  <div className="min-w-0">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="section-label">Agenda operasional</p>
                        <h2 className="wordmark mt-1 text-sm font-semibold">
                          Check-Out & Check-In Hari Ini
                        </h2>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full text-xs"
                        onClick={() => setAdminSection("Jadwal")}
                      >
                        Semua jadwal <ArrowRight className="size-3.5" />
                      </Button>
                    </div>
                    <ScheduleTable
                      rows={todayRows.slice(0, 4)}
                      onChecklist={(entry) => {
                        setBastEntry(entry);
                        setBastChecked([]);
                        setBastPhoto(null);
                      }}
                      onMark={setScheduleStatus}
                      onWa={(entry) => {
                        setWaLogs((current) => [
                          `${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · ${entry.id} · Pengingat terkirim`,
                          ...current,
                        ]);
                        notify(`Pengingat WhatsApp ${entry.id} disiapkan.`);
                      }}
                    />
                  </div>
                  <div className="space-y-7">
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="section-label">Menjelang tenggat</p>
                          <h2 className="wordmark mt-1 text-sm font-semibold">Auto-WA H-3 Jam</h2>
                        </div>
                        <Switch
                          checked={autoWa}
                          onCheckedChange={setAutoWa}
                          aria-label="Aktifkan pengingat otomatis"
                        />
                      </div>
                      <div className="border border-border bg-card p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold">Pengingat otomatis</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {autoWa ? "Aktif · cek 3 jam sebelum kembali" : "Nonaktif"}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            className="rounded-full text-[11px]"
                            onClick={() => {
                              setWaLogs((current) => [
                                `${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · Batch · ${activeRentals.length} pengingat disiapkan`,
                                ...current,
                              ]);
                              notify("Batch pengingat WhatsApp disiapkan.");
                            }}
                          >
                            <Activity className="size-3.5" /> Jalankan batch
                          </Button>
                        </div>
                        <div className="mt-4 space-y-2 border-t border-border pt-3">
                          {activeRentals.slice(0, 3).map((rental) => (
                            <div
                              key={rental.id}
                              className="flex items-center justify-between gap-3 text-[11px]"
                            >
                              <span className="truncate text-muted-foreground">
                                {rental.id} · {rental.customer}
                              </span>
                              <span className="wordmark shrink-0 font-semibold">
                                {countdown(rental)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 border-t border-border pt-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Log WhatsApp simulasi
                          </p>
                          {waLogs.slice(0, 3).map((line, index) => (
                            <p
                              key={`${line}-${index}`}
                              className="truncate py-1 text-[11px] text-muted-foreground"
                            >
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="section-label">Perlu ditinjau</p>
                          <h2 className="wordmark mt-1 text-sm font-semibold">Antrean KYC</h2>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => setAdminSection("Verifikasi KYC")}
                        >
                          Buka antrean <ArrowRight className="size-3.5" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {kycQueue
                          .filter((item) => item.status === "Menunggu")
                          .slice(0, 2)
                          .map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              className="flex w-full items-center justify-between gap-3 border border-border bg-card p-3 text-left transition hover:bg-surface-soft"
                              onClick={() => setKycDetail(entry)}
                            >
                              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-soft text-gold-ink">
                                <UsersRound className="size-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-semibold">
                                  {entry.name}
                                </span>
                                <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                                  {entry.project}
                                </span>
                              </span>
                              <ChevronDown className="size-4 -rotate-90 text-muted-foreground" />
                            </button>
                          ))}
                        {pendingKyc === 0 && (
                          <p className="border border-border p-4 text-xs text-muted-foreground">
                            Semua pengajuan sudah ditinjau.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {adminSection === "Jadwal" && (
              <div>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="section-label">21 November 2026</p>
                    <h2 className="wordmark mt-1 text-sm font-semibold">
                      Jadwal Pengambilan & Pengembalian
                    </h2>
                  </div>
                  <div className="flex gap-2">
                    {["Semua", "Pick-Up", "Return"].map((filter) => (
                      <Button
                        key={filter}
                        size="sm"
                        variant={scheduleFilter === filter ? "default" : "outline"}
                        className="h-8 rounded-full text-xs"
                        onClick={() => setScheduleFilter(filter)}
                      >
                        {filter}
                      </Button>
                    ))}
                  </div>
                </div>
                <ScheduleTable
                  rows={visibleSchedule}
                  onChecklist={(entry) => {
                    setBastEntry(entry);
                    setBastChecked([]);
                    setBastPhoto(null);
                  }}
                  onMark={setScheduleStatus}
                  onWa={(entry) => {
                    setWaLogs((current) => [
                      `${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · ${entry.id} · Pengingat terkirim`,
                      ...current,
                    ]);
                    notify(`Pengingat WhatsApp ${entry.id} disiapkan.`);
                  }}
                />
              </div>
            )}

            {adminSection === "Verifikasi KYC" && (
              <div>
                <div className="mb-4">
                  <p className="section-label">Pemeriksaan pelanggan</p>
                  <h2 className="wordmark mt-1 text-sm font-semibold">Antrean Verifikasi KYC</h2>
                </div>
                <div className="scroll-fade">
                  <div className="table-scroll overflow-x-auto border border-border bg-card">
                    <table className="w-full min-w-[680px] text-left text-xs">
                      <thead className="bg-surface-soft text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Pelanggan</th>
                          <th className="px-4 py-3">Proyek</th>
                          <th className="px-4 py-3">Kontak</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Tinjau</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kycQueue.map((entry) => (
                          <tr key={entry.id} className="border-t border-border">
                            <td className="px-4 py-3">
                              <p className="font-semibold">{entry.name}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {entry.id} · {entry.instagram}
                              </p>
                            </td>
                            <td className="px-4 py-3">{entry.project}</td>
                            <td className="px-4 py-3">{entry.phone}</td>
                            <td className="px-4 py-3">
                              <StatusPill status={entry.status} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full text-[11px]"
                                onClick={() => setKycDetail(entry)}
                              >
                                Periksa
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {verifiedPhones.length > 0 && (
                  <div className="mt-4 border border-success/20 bg-success-soft p-4">
                    <p className="text-xs font-semibold text-success">Verified Member terbaru</p>
                    <p className="mt-1 text-xs text-success">{verifiedPhones.join(" · ")}</p>
                  </div>
                )}
              </div>
            )}

            {adminSection === "Inventaris" && (
              <div>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="section-label">Aset & harga sewa</p>
                    <h2 className="wordmark mt-1 text-sm font-semibold">Inventory Manager</h2>
                  </div>
                  <Button className="rounded-full" onClick={() => setNewProductOpen(true)}>
                    <PackagePlus className="size-4" /> Tambah perangkat
                  </Button>
                </div>
                <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto]">
                  <div className="border border-border bg-card p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <QrCode className="size-4 text-gold-ink" />
                      <p className="text-xs font-semibold">QR Code Asset Tracking</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        aria-label="Cari nomor serial"
                        placeholder="Contoh: SMP-C1-001"
                        value={scanText}
                        onChange={(event) => setScanText(event.target.value)}
                        className="h-9 max-w-sm bg-surface-soft text-xs"
                      />
                      <Button size="sm" className="h-9" onClick={openScanResult}>
                        <Search className="size-3.5" /> Simulasi scan
                      </Button>
                    </div>
                    {scanResult && (
                      <div className="mt-3 flex items-center gap-3 border border-success/20 bg-success-soft p-3">
                        <span className="grid size-8 place-items-center rounded-full bg-card text-success">
                          <Check className="size-4" />
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-success">
                            {scanResult.code} · {scanResult.productName}
                          </p>
                          <p className="mt-1 text-[11px] text-success">
                            Status aset:{" "}
                            {scanResult.status === "READY" ? "Siap disewa" : "Dalam servis"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 border border-border bg-card px-4 py-3">
                    <span className="grid size-9 place-items-center rounded-full bg-amber-soft text-amber">
                      <Wrench className="size-4" />
                    </span>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Unit terkunci servis</p>
                      <p className="wordmark text-base font-semibold">
                        {products.reduce(
                          (sum, product) =>
                            sum +
                            product.serials.filter((serial) => serial.status === "MAINTENANCE")
                              .length,
                          0,
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {products.map((product) => (
                    <div key={product.id} className="border border-border bg-card">
                      <div className="grid gap-3 p-4 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-center">
                        <div>
                          <p className="wordmark text-[11px] font-semibold">{product.name}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {product.category} ·{" "}
                            {product.serials.filter((serial) => serial.status === "READY").length}{" "}
                            tersedia
                          </p>
                        </div>
                        <label className="text-[11px] font-semibold text-muted-foreground">
                          Tarif / 24 jam
                          <Input
                            aria-label={`Tarif ${product.name}`}
                            type="number"
                            min="0"
                            value={product.price}
                            onChange={(event) =>
                              setProducts((current) =>
                                current.map((item) =>
                                  item.id === product.id
                                    ? { ...item, price: Number(event.target.value) || 0 }
                                    : item,
                                ),
                              )
                            }
                            className="mt-1 h-9 bg-surface-soft text-xs text-foreground"
                          />
                        </label>
                        <label className="text-[11px] font-semibold text-muted-foreground">
                          Jumlah unit
                          <Input
                            aria-label={`Jumlah unit ${product.name}`}
                            type="number"
                            min="1"
                            value={product.serials.length}
                            onChange={(event) =>
                              changeStock(product.id, Number(event.target.value))
                            }
                            className="mt-1 h-9 bg-surface-soft text-xs text-foreground"
                          />
                        </label>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full text-[11px]"
                          onClick={() =>
                            setActiveSerial(activeSerial === product.id ? "" : product.id)
                          }
                        >
                          <QrCode className="size-3.5" /> QR & serial
                        </Button>
                      </div>
                      {activeSerial === product.id && (
                        <div className="grid gap-3 border-t border-border bg-surface-soft p-4 sm:grid-cols-2 xl:grid-cols-3">
                          {product.serials.map((serial) => (
                            <div
                              key={serial.code}
                              className="flex items-center gap-3 border border-border bg-card p-3"
                            >
                              <QRCodeSVG
                                value={`SMartPro Asset ${serial.code}`}
                                size={60}
                                level="M"
                                includeMargin
                              />
                              <div className="min-w-0 flex-1">
                                <p className="wordmark truncate text-[11px] font-semibold">
                                  {serial.code}
                                </p>
                                <p
                                  className={`mt-1 text-[11px] font-semibold ${serial.status === "READY" ? "text-success" : "text-amber"}`}
                                >
                                  {serial.status === "READY" ? "Siap disewa" : "Dalam servis"}
                                </p>
                                <Button
                                  variant={serial.status === "READY" ? "outline" : "secondary"}
                                  size="sm"
                                  className="mt-2 h-7 text-[11px]"
                                  onClick={() => toggleMaintenance(product.id, serial.code)}
                                >
                                  {serial.status === "READY" ? "Kunci servis" : "Buka servis"}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {adminSection === "Mitra VIP" && (
              <div className="grid gap-7 xl:grid-cols-[1fr_1.3fr]">
                <div>
                  <p className="section-label">Partner EO / PH</p>
                  <h2 className="wordmark mb-4 mt-1 text-sm font-semibold">Daftarkan Mitra VIP</h2>
                  <form
                    className="space-y-3 border border-border bg-card p-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!newVip.name.trim() || !newVip.contact.trim())
                        return notify("Isi nama mitra dan kontak terlebih dahulu.");
                      setVips((current) => [
                        {
                          name: newVip.name,
                          contact: newVip.contact,
                          discount: Number(newVip.discount) || 15,
                          points: Number(newVip.points) || 0,
                        },
                        ...current,
                      ]);
                      setNewVip({ name: "", contact: "", discount: "15", points: "1000" });
                      notify("Mitra VIP berhasil ditambahkan ke daftar demo.");
                    }}
                  >
                    <label className="block text-[11px] font-semibold text-muted-foreground">
                      Nama mitra
                      <Input
                        value={newVip.name}
                        onChange={(event) =>
                          setNewVip((current) => ({ ...current, name: event.target.value }))
                        }
                        placeholder="Nama EO / PH"
                        className="mt-1 h-9 bg-surface-soft text-xs"
                      />
                    </label>
                    <label className="block text-[11px] font-semibold text-muted-foreground">
                      Kontak WhatsApp
                      <Input
                        value={newVip.contact}
                        onChange={(event) =>
                          setNewVip((current) => ({ ...current, contact: event.target.value }))
                        }
                        placeholder="08xx xxxx xxxx"
                        className="mt-1 h-9 bg-surface-soft text-xs"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Diskon permanen (%)
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={newVip.discount}
                          onChange={(event) =>
                            setNewVip((current) => ({ ...current, discount: event.target.value }))
                          }
                          className="mt-1 h-9 bg-surface-soft text-xs"
                        />
                      </label>
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Poin awal
                        <Input
                          type="number"
                          min="0"
                          value={newVip.points}
                          onChange={(event) =>
                            setNewVip((current) => ({ ...current, points: event.target.value }))
                          }
                          className="mt-1 h-9 bg-surface-soft text-xs"
                        />
                      </label>
                    </div>
                    <Button type="submit" className="w-full">
                      <Plus className="size-4" /> Simpan mitra
                    </Button>
                  </form>
                </div>
                <div>
                  <p className="section-label">Loyalitas & harga</p>
                  <h2 className="wordmark mb-4 mt-1 text-sm font-semibold">Mitra Partner VIP</h2>
                  <div className="space-y-3">
                    {vips.map((partner) => (
                      <div
                        key={partner.contact}
                        className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <BrandMark className="size-8" />
                            <div>
                              <p className="text-xs font-semibold">{partner.name}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {partner.contact} · Diskon permanen {partner.discount}%
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 sm:justify-end">
                          <div className="text-right">
                            <p className="wordmark text-xs font-semibold">
                              {partner.points.toLocaleString("id-ID")} poin
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">Bonus poin</p>
                          </div>
                          <div className="flex gap-1">
                            <Input
                              aria-label={`Bonus poin ${partner.name}`}
                              type="number"
                              min="1"
                              value={pointsBonus[partner.contact] ?? "500"}
                              onChange={(event) =>
                                setPointsBonus((current) => ({
                                  ...current,
                                  [partner.contact]: event.target.value,
                                }))
                              }
                              className="h-8 w-20 text-xs"
                            />
                            <Button
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => {
                                const bonus = Math.max(
                                  0,
                                  Number(pointsBonus[partner.contact]) || 0,
                                );
                                setVips((current) =>
                                  current.map((item) =>
                                    item.contact === partner.contact
                                      ? { ...item, points: item.points + bonus }
                                      : item,
                                  ),
                                );
                                notify(
                                  `${bonus.toLocaleString("id-ID")} poin ditambahkan untuk ${partner.name}.`,
                                );
                              }}
                            >
                              <Plus className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-[11px] text-muted-foreground sm:px-6 lg:px-8">
          <span className="wordmark font-semibold text-foreground">
            SMartPro · Audio Video Production
          </span>
          <span>Simulasi antarmuka · data tersimpan selama sesi ini</span>
        </div>
      </footer>

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-[100] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 border border-border bg-card px-4 py-3 text-xs font-semibold shadow-tag"
        >
          <CheckCircle2 className="size-4 shrink-0 text-success" />
          {notice}
        </div>
      )}

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border px-5 py-5 text-left">
            <SheetTitle className="wordmark text-sm">Tas Sewa</SheetTitle>
            <SheetDescription className="text-xs">
              {cartCount} unit · {days}× 24 jam · {formatDate(startDate)} s/d {formatDate(endDate)}
            </SheetDescription>
          </SheetHeader>
          <div className="smartpro-drawer-scroll flex-1 overflow-y-auto px-5 py-4">
            {cart.length ? (
              <div className="space-y-3">
                {cart.map((line) => (
                  <div
                    key={line.key}
                    className="flex items-start gap-3 border-b border-border pb-3"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-soft text-gold-ink">
                      {line.kind === "bundle" ? (
                        <PackageCheck className="size-4" />
                      ) : line.kind === "addon" ? (
                        <Sparkles className="size-4" />
                      ) : (
                        <Video className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">{line.name}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {line.details ?? `${formatRupiah(line.price)} / 24 jam`}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatRupiah(line.price)} × {line.quantity} × {days} hari
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => updateLine(line.key, -1)}
                        aria-label={`Kurangi ${line.name}`}
                      >
                        −
                      </Button>
                      <span className="min-w-4 text-center text-xs font-semibold">
                        {line.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => updateLine(line.key, 1)}
                        aria-label={`Tambah ${line.name}`}
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-border px-4 py-8 text-center">
                <ShoppingBag className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-3 text-xs font-semibold">Tas sewa masih kosong</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Pilih perangkat atau paket untuk mulai.
                </p>
              </div>
            )}
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="section-label">Smart cross-selling</p>
                  <h3 className="mt-1 text-xs font-semibold">Tambahkan kebutuhan produksi</h3>
                </div>
                <Sparkles className="size-4 text-gold-ink" />
              </div>
              <div className="space-y-2">
                {ADD_ONS.map((addon) => {
                  const inCart = cart.some((line) => line.key === `addon:${addon.id}`);
                  return (
                    <div
                      key={addon.id}
                      className="flex items-center justify-between gap-3 border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold">{addon.name}</p>
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">
                          {addon.detail}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold text-gold-ink">
                          {formatRupiah(addon.price)} / 24 jam
                        </p>
                      </div>
                      <Button
                        variant={inCart ? "secondary" : "outline"}
                        size="sm"
                        className="h-8 shrink-0 rounded-full text-[11px]"
                        onClick={() => {
                          if (inCart) updateLine(`addon:${addon.id}`, -1);
                          else
                            addLine(
                              {
                                key: `addon:${addon.id}`,
                                name: addon.name,
                                price: addon.price,
                                kind: "addon",
                                details: "Add-on · harga simulasi",
                              },
                              1,
                            );
                        }}
                      >
                        {inCart ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                        {inCart ? "Ditambah" : "Tambah"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="border-t border-border bg-card px-5 py-4">
            {tier !== "regular" && (
              <label className="mb-3 flex items-center justify-between gap-3 border border-gold/30 bg-amber-soft p-3 text-[11px]">
                <span>
                  <span className="block font-semibold text-amber">Tukar 1.000 poin</span>
                  <span className="mt-1 block text-[11px] text-amber">
                    Potongan {formatRupiah(50000)}
                  </span>
                </span>
                <Switch
                  checked={pointsApplied}
                  onCheckedChange={setPointsApplied}
                  aria-label="Tukar 1000 poin loyalitas"
                />
              </label>
            )}
            <div className="space-y-1.5 text-[11px]">
              <PriceLine label="Nilai sewa" amount={pricing.base} />
              {pricing.promo > 0 && (
                <PriceLine
                  label={`Promo sewa ${days} gratis ${freeDays}`}
                  amount={-pricing.promo}
                  discount
                />
              )}
              {pricing.vipDiscount > 0 && (
                <PriceLine label="Diskon Partner VIP 15%" amount={-pricing.vipDiscount} discount />
              )}
              {pricing.pointsDiscount > 0 && (
                <PriceLine label="Tukar 1.000 poin" amount={-pricing.pointsDiscount} discount />
              )}
              {delivery && <PriceLine label="Pengantaran" amount={pricing.deliveryFee} />}
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-bold">
                <span>Total estimasi</span>
                <span className="wordmark text-xs">{formatRupiah(pricing.total)}</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="text-xs"
                onClick={() => setQuoteOpen(true)}
                disabled={!cart.length}
              >
                <FileText className="size-4" /> Unduh Penawaran
              </Button>
              <Button className="text-xs" onClick={startCheckout} disabled={!cart.length}>
                Lanjut Booking <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
        <DialogContent
          id="smartpro-quotation-print"
          className="quote-dialog max-h-[92vh] max-w-3xl overflow-y-auto p-0"
        >
          <div className="quote-document p-6 sm:p-9">
            <DialogHeader className="print-hide mb-5 text-left">
              <DialogTitle className="wordmark text-sm">Penawaran Harga / RAB</DialogTitle>
              <DialogDescription className="text-xs">
                Lengkapi informasi klien sebelum mencetak dokumen.
              </DialogDescription>
            </DialogHeader>
            <div className="mb-6 grid gap-3 sm:grid-cols-3 print-hide">
              <label className="text-[11px] font-semibold text-muted-foreground">
                Nama klien
                <Input
                  value={quoteFields.client}
                  onChange={(event) =>
                    setQuoteFields((current) => ({ ...current, client: event.target.value }))
                  }
                  placeholder="Nama klien"
                  className="mt-1 h-9 text-xs"
                />
              </label>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Nama proyek
                <Input
                  value={quoteFields.project}
                  onChange={(event) =>
                    setQuoteFields((current) => ({ ...current, project: event.target.value }))
                  }
                  placeholder="Nama proyek"
                  className="mt-1 h-9 text-xs"
                />
              </label>
              <label className="text-[11px] font-semibold text-muted-foreground">
                PIC / kontak
                <Input
                  value={quoteFields.pic}
                  onChange={(event) =>
                    setQuoteFields((current) => ({ ...current, pic: event.target.value }))
                  }
                  placeholder="Nama PIC"
                  className="mt-1 h-9 text-xs"
                />
              </label>
            </div>
            <div className="border-y-2 border-primary py-5">
              <div className="flex items-start justify-between gap-5">
                <div className="flex items-center gap-3">
                  <BrandMark className="size-12" />
                  <div>
                    <p className="wordmark text-xs font-bold">SMartPro</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Audio Video Production · Jakarta
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="wordmark text-[11px] font-semibold">SURAT PENAWARAN</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">QT/SMP/2026/11/001</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 text-[11px]">
                <p>
                  <span className="text-muted-foreground">Kepada</span>
                  <br />
                  <strong>{quoteFields.client || "Nama Klien"}</strong>
                  <br />
                  {quoteFields.pic || "PIC / Kontak"}
                </p>
                <p>
                  <span className="text-muted-foreground">Proyek & tanggal</span>
                  <br />
                  <strong>{quoteFields.project || "Nama Proyek"}</strong>
                  <br />
                  {formatDate(startDate)} s/d {formatDate(endDate)} · {days}× 24 jam
                </p>
              </div>
            </div>
            <div className="scroll-fade">
              <div className="my-5 table-scroll overflow-x-auto">
                <table className="w-full min-w-[430px] text-left text-[11px]">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className="py-2">Deskripsi</th>
                      <th className="py-2 text-center">Qty</th>
                      <th className="py-2 text-right">Tarif / hari</th>
                      <th className="py-2 text-right">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricing.lineDetails.map(({ line, breakdown }) => (
                      <tr key={line.key} className="border-b border-border/60">
                        <td className="py-2.5 font-semibold">{line.name}</td>
                        <td className="py-2.5 text-center">
                          {line.quantity} × {days} hari
                        </td>
                        <td className="py-2.5 text-right">{formatRupiah(line.price)}</td>
                        <td className="py-2.5 text-right">{formatRupiah(breakdown.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="ml-auto max-w-xs space-y-1 text-[11px]">
              <PriceLine label="Subtotal sewa" amount={pricing.base} />
              <PriceLine
                label="Diskon promo & tier"
                amount={-(pricing.promo + pricing.vipDiscount)}
                discount
              />
              <PriceLine
                label="Poin & pengantaran"
                amount={pricing.deliveryFee - pricing.pointsDiscount}
              />
              <div className="flex justify-between border-t border-primary pt-2 text-sm font-bold">
                <span>Total penawaran</span>
                <span>{formatRupiah(pricing.total)}</span>
              </div>
            </div>
            <div className="mt-7 border-t border-border pt-4 text-[11px] text-muted-foreground">
              <p>
                Penawaran ini merupakan estimasi untuk masa sewa yang tercantum dan ketersediaan
                unit pada saat konfirmasi.
              </p>
              <p className="mt-1">
                SMartPro Audio Video Production · Terima kasih atas kepercayaan Anda.
              </p>
            </div>
          </div>
          <DialogFooter className="print-hide border-t border-border bg-surface-soft px-5 py-4 sm:justify-between">
            <Button
              variant="outline"
              onClick={async () => {
                const summary = `RAB ${quoteFields.project || "SMartPro"} · ${formatDate(startDate)} s/d ${formatDate(endDate)} · Total ${formatRupiah(pricing.total)}`;
                try {
                  await navigator.clipboard.writeText(summary);
                  notify("Ringkasan RAB disalin.");
                } catch {
                  notify(summary);
                }
              }}
            >
              <Copy className="size-4" /> Salin ringkasan RAB
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" /> Cetak / Simpan PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(guideProduct)}
        onOpenChange={(open) => {
          if (!open) setGuideProduct(null);
        }}
      >
        <DialogContent className="max-w-lg">
          {guideProduct && (
            <>
              <DialogHeader className="text-left">
                <p className="section-label">Quick-start · 01 menit</p>
                <DialogTitle className="wordmark text-sm">Panduan {guideProduct.name}</DialogTitle>
                <DialogDescription className="text-xs">
                  Ringkas, siap dicoba sebelum perangkat digunakan.
                </DialogDescription>
              </DialogHeader>
              <div className="guide-preview relative grid min-h-36 place-items-center overflow-hidden rounded-sm bg-stage">
                <div className="absolute inset-0 opacity-35">
                  <ProductArt art={guideProduct.art} name={guideProduct.name} />
                </div>
                <span className="relative grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Play className="ml-0.5 size-5 fill-current" />
                </span>
                <span className="absolute bottom-3 left-3 rounded-full bg-card px-2.5 py-1 text-[11px] font-bold">
                  VIDEO PREVIEW · 01:00
                </span>
              </div>
              <ol className="space-y-3">
                {(GUIDE_TIPS[guideProduct.id]?.steps ?? []).map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-soft text-[11px] font-bold text-gold-ink">
                      {index + 1}
                    </span>
                    <span className="pt-1 text-xs leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
              <div className="border-l-2 border-gold bg-amber-soft px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase text-amber">Pro-Tip</p>
                <p className="mt-1 text-[11px] leading-relaxed text-amber">
                  {GUIDE_TIPS[guideProduct.id]?.tip}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader className="text-left">
            <p className="section-label">Layanan mandiri</p>
            <DialogTitle className="wordmark text-sm">Extend Rental 1-Klik</DialogTitle>
            <DialogDescription className="text-xs">
              Perpanjang unit yang masih berjalan tanpa mengulang proses booking.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {activeRentals.slice(0, 3).map((rental) => {
              const product = products.find((item) => item.id === rental.productId);
              const nextDate = new Date(`${rental.dueDate}T00:00:00`);
              nextDate.setDate(nextDate.getDate() + 1);
              const dayAfter = new Date(nextDate);
              dayAfter.setDate(dayAfter.getDate() + 1);
              const conflictProduct = product
                ? getAvailableUnits(
                    product,
                    nextDate.toISOString().slice(0, 10),
                    dayAfter.toISOString().slice(0, 10),
                  ) === 0
                : true;
              return (
                <div key={rental.id} className="border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="wordmark text-[11px] font-semibold">
                        {rental.id} · {product?.name}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {rental.customer} · kembali {formatDate(rental.dueDate)}
                      </p>
                    </div>
                    <span className="wordmark rounded-full bg-surface-soft px-3 py-1 text-xs font-semibold">
                      {countdown(rental)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <p
                      className={`flex items-center gap-1.5 text-[11px] font-semibold ${conflictProduct ? "text-alert" : "text-success"}`}
                    >
                      {conflictProduct ? (
                        <CircleAlert className="size-3.5" />
                      ) : (
                        <CheckCircle2 className="size-3.5" />
                      )}
                      {conflictProduct
                        ? "Bentrok: unit sudah terbooking besok"
                        : "Unit tersedia untuk +24 jam"}
                    </p>
                    <Button
                      size="sm"
                      className="rounded-full text-[11px]"
                      disabled={conflictProduct}
                      onClick={() => extendRental(rental)}
                    >
                      +24 Jam <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Perpanjangan mengikuti ketersediaan serial yang sama. Jika terbooking penuh, hubungi tim
            SMartPro untuk opsi unit lain.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog
        open={checkoutOpen}
        onOpenChange={(open) => {
          setCheckoutOpen(open);
          if (!open && checkoutStep === 4) setCheckoutStep(1);
        }}
      >
        <DialogContent className="max-h-[94vh] max-w-2xl overflow-y-auto">
          <DialogHeader className="text-left">
            <p className="section-label">Verifikasi & booking</p>
            <DialogTitle className="wordmark text-sm">
              {checkoutStep === 4 ? "Booking Terkonfirmasi" : "Selesaikan Pesanan"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {checkoutStep === 4
                ? "Kode booking Anda siap digunakan."
                : `Langkah ${checkoutStep} dari 3 · ${checkoutStep === 1 ? "Metode pengambilan" : checkoutStep === 2 ? "Data penyewa" : "Pembayaran"}`}
            </DialogDescription>
          </DialogHeader>
          {checkoutStep < 4 && (
            <div className="mb-1 flex gap-1" aria-hidden="true">
              {[1, 2, 3].map((step) => (
                <span
                  key={step}
                  className={`h-1 flex-1 rounded-full ${step <= checkoutStep ? "bg-primary" : "bg-border"}`}
                />
              ))}
            </div>
          )}

          {checkoutStep === 1 && (
            <div className="space-y-4">
              <p className="text-xs font-semibold">Pilih cara menerima perangkat</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceCard
                  selected={pickupMode === "studio"}
                  icon={MapPin}
                  title="Ambil di studio"
                  subtitle="Gratis · Jakarta"
                  onClick={() => {
                    setPickupMode("studio");
                    setDelivery(false);
                  }}
                />
                <ChoiceCard
                  selected={pickupMode === "courier"}
                  icon={Truck}
                  title="Kurir pengantaran"
                  subtitle="Biaya simulasi Rp 35.000"
                  onClick={() => {
                    setPickupMode("courier");
                    setDelivery(true);
                  }}
                />
              </div>
              <div className="flex items-start gap-2 border border-border bg-surface-soft p-3 text-[11px] text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Alamat dan waktu pengambilan akan dikonfirmasi tim SMartPro melalui WhatsApp
                  setelah booking.
                </span>
              </div>
            </div>
          )}

          {checkoutStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={!kycFastPath ? "default" : "outline"}
                  size="sm"
                  onClick={() => setKycFastPath(false)}
                >
                  Penyewa Baru · KYC Lengkap
                </Button>
                <Button
                  variant={kycFastPath ? "default" : "outline"}
                  size="sm"
                  onClick={() => setKycFastPath(true)}
                >
                  <BadgeCheck className="size-3.5" /> Verified Member
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3 border border-border p-3">
                <div>
                  <p className="text-xs font-semibold">Tingkat verifikasi</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {pricing.total > 5000000 || cartCount > 2
                      ? "Tier 2 · Nilai tinggi / lebih dari 2 unit"
                      : "Tier 1 · Reguler"}
                  </p>
                </div>
                <Badge variant="outline" className="text-[11px]">
                  {tier === "vip"
                    ? "VIP"
                    : tier === "verified" || kycFastPath
                      ? "Verified"
                      : "Baru"}
                </Badge>
              </div>
              {kycFastPath ? (
                <div className="border border-success/20 bg-success-soft p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold text-success">
                    <ShieldCheck className="size-4" /> Jalur cepat aktif
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed text-success">
                    Data KYC lengkap tidak diperlukan untuk simulasi Verified Member. Admin akan
                    menghubungi kontak terverifikasi saat konfirmasi.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Nama lengkap">
                      <Input
                        value={kycFields.name}
                        onChange={(event) =>
                          setKycFields((current) => ({ ...current, name: event.target.value }))
                        }
                        placeholder="Nama sesuai identitas"
                        className="h-9 text-xs"
                      />
                    </Field>
                    <Field label="NIK 16 digit">
                      <Input
                        inputMode="numeric"
                        maxLength={16}
                        value={kycFields.nik}
                        onChange={(event) =>
                          setKycFields((current) => ({
                            ...current,
                            nik: event.target.value.replace(/\D/g, "").slice(0, 16),
                          }))
                        }
                        placeholder="0000000000000000"
                        className="h-9 text-xs"
                      />
                    </Field>
                    <Field label="Nomor WhatsApp">
                      <Input
                        value={kycFields.phone}
                        onChange={(event) =>
                          setKycFields((current) => ({ ...current, phone: event.target.value }))
                        }
                        placeholder="08xx xxxx xxxx"
                        className="h-9 text-xs"
                      />
                    </Field>
                    <Field label="Instagram">
                      <Input
                        value={kycFields.instagram}
                        onChange={(event) =>
                          setKycFields((current) => ({ ...current, instagram: event.target.value }))
                        }
                        placeholder="@akunanda"
                        className="h-9 text-xs"
                      />
                    </Field>
                    <Field label="Alamat lengkap">
                      <Input
                        value={kycFields.address}
                        onChange={(event) =>
                          setKycFields((current) => ({ ...current, address: event.target.value }))
                        }
                        placeholder="Jalan, kota, kode pos"
                        className="h-9 text-xs"
                      />
                    </Field>
                    <Field label="Kontak darurat">
                      <Input
                        value={kycFields.emergency}
                        onChange={(event) =>
                          setKycFields((current) => ({ ...current, emergency: event.target.value }))
                        }
                        placeholder="Nama · nomor telepon"
                        className="h-9 text-xs"
                      />
                    </Field>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold">Dokumen verifikasi</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {[
                        ["ktp", "e-KTP"],
                        ["secondary", "Identitas kedua"],
                        ["selfie", "Selfie dengan KTP"],
                      ].map(([key, label]) => (
                        <label
                          key={key}
                          className="cursor-pointer border border-dashed border-border bg-surface-soft p-3 text-center"
                        >
                          <input
                            className="sr-only"
                            type="file"
                            accept="image/*"
                            onChange={(event) => handleKycFile(key, event.target.files?.[0])}
                          />
                          <span className="mx-auto grid size-8 place-items-center rounded-full bg-card text-gold-ink">
                            {kycFiles[key]?.preview ? (
                              <Check className="size-4" />
                            ) : (
                              <ImagePlus className="size-4" />
                            )}
                          </span>
                          <span className="mt-2 block text-[11px] font-semibold">{label}</span>
                          <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                            {kycFiles[key]?.name ?? "Pilih foto"}
                          </span>
                          {kycFiles[key]?.preview && (
                            <img
                              src={kycFiles[key]?.preview ?? ""}
                              alt={`Pratinjau ${label}`}
                              className="mx-auto mt-2 h-16 w-full object-cover"
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold">Tanda tangan digital</p>
                    <SignaturePad onChange={setSignatureReady} />
                  </div>
                </>
              )}
              {checkoutError && (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="flex items-start gap-2 border border-alert/30 bg-alert-soft p-3 text-[11px] font-semibold text-alert"
                >
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                  {checkoutError}
                </p>
              )}
            </div>
          )}

          {checkoutStep === 3 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold">Skema pembayaran</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(tier === "vip" ? ["30", "50", "100"] : ["50", "100"]).map((amount) => (
                    <Button
                      key={amount}
                      variant={paymentScheme === amount ? "default" : "outline"}
                      size="sm"
                      className="h-auto flex-col py-3"
                      onClick={() => setPaymentScheme(amount)}
                    >
                      <span className="wordmark text-xs">{amount}%</span>
                      <span className="mt-1 text-[11px] font-normal">
                        {amount === "100" ? "Lunas" : `DP ${amount}%`}
                      </span>
                    </Button>
                  ))}
                </div>
                {tier === "vip" && (
                  <p className="mt-2 text-[11px] text-gold-ink">
                    Partner VIP mendapat pilihan DP 30%.
                  </p>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold">Metode pembayaran</p>
                <div className="grid grid-cols-2 gap-2">
                  {["QRIS", "BCA Transfer"].map((method) => (
                    <ChoiceCard
                      key={method}
                      selected={paymentMethod === method}
                      icon={method === "QRIS" ? QrCode : CreditCard}
                      title={method}
                      subtitle={method === "QRIS" ? "Kode pembayaran" : "Transfer bank"}
                      onClick={() => setPaymentMethod(method)}
                    />
                  ))}
                </div>
              </div>
              <div className="border border-border bg-surface-soft p-4">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total estimasi</span>
                  <strong>{formatRupiah(pricing.total)}</strong>
                </div>
                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-muted-foreground">Pembayaran awal · {paymentScheme}%</span>
                  <strong className="wordmark">
                    {formatRupiah(Math.ceil((pricing.total * Number(paymentScheme)) / 100))}
                  </strong>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Skema dan rincian pembayaran akan dikonfirmasi tim sebelum transaksi.
                </p>
              </div>
            </div>
          )}

          {checkoutStep === 4 && (
            <div className="py-2 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success">
                <CheckCircle2 className="size-7" />
              </span>
              <p className="section-label mt-4">Booking berhasil dibuat</p>
              <p className="wordmark mt-2 text-lg font-semibold">{checkoutCode}</p>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Tim SMartPro akan menghubungi Anda untuk konfirmasi unit, dokumen, dan pembayaran.
              </p>
              <div className="mx-auto mt-5 max-w-sm border border-border bg-surface-soft p-3 text-left text-[11px]">
                <p>
                  <span className="text-muted-foreground">Masa sewa</span> · {formatDate(startDate)}{" "}
                  s/d {formatDate(endDate)}
                </p>
                <p className="mt-1">
                  <span className="text-muted-foreground">Metode</span> ·{" "}
                  {pickupMode === "studio" ? "Ambil di studio" : "Kurir pengantaran"} ·{" "}
                  {paymentMethod} · DP {paymentScheme}%
                </p>
              </div>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <a href={checkoutWhatsapp} target="_blank" rel="noreferrer">
                    <Instagram className="size-4" /> Konfirmasi via WhatsApp
                  </a>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCheckoutOpen(false);
                    setView("admin");
                    setAdminSection("Jadwal");
                  }}
                >
                  Lihat di Dashboard Admin
                </Button>
              </div>
            </div>
          )}

          {checkoutStep < 4 && (
            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                variant="outline"
                onClick={() =>
                  checkoutStep === 1 ? setCheckoutOpen(false) : setCheckoutStep((step) => step - 1)
                }
              >
                <ArrowLeft className="size-4" />{" "}
                {checkoutStep === 1 ? "Kembali ke tas" : "Sebelumnya"}
              </Button>
              <Button onClick={nextCheckoutStep}>
                {checkoutStep === 3 ? "Buat Booking" : "Lanjutkan"}{" "}
                <ArrowRight className="size-4" />
              </Button>
            </DialogFooter>
          )}
          {checkoutStep === 4 && (
            <DialogFooter className="print-hide">
              <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
                Selesai
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(bastEntry)}
        onOpenChange={(open) => {
          if (!open) setBastEntry(null);
        }}
      >
        <DialogContent className="max-w-lg">
          {bastEntry && (
            <>
              <DialogHeader className="text-left">
                <p className="section-label">Serah terima digital</p>
                <DialogTitle className="wordmark text-sm">BAST · {bastEntry.id}</DialogTitle>
                <DialogDescription className="text-xs">
                  {bastEntry.kind} · {bastEntry.customer} · {bastEntry.serial}
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2">
                {["Kamera & bodi", "Baterai & daya", "Kabel & konektor", "Kondisi fisik"].map(
                  (item) => (
                    <label
                      key={item}
                      className="flex flex-1 items-center gap-2 border border-border p-2 text-[11px]"
                    >
                      <Checkbox
                        checked={bastChecked.includes(item)}
                        onCheckedChange={(checked) =>
                          setBastChecked((current) =>
                            checked
                              ? [...current, item]
                              : current.filter((value) => value !== item),
                          )
                        }
                      />
                      {item}
                    </label>
                  ),
                )}
              </div>
              <label className="block cursor-pointer border border-dashed border-border bg-surface-soft p-4 text-center">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file?.type.startsWith("image/")) setBastPhoto(URL.createObjectURL(file));
                  }}
                />
                <span className="mx-auto grid size-9 place-items-center rounded-full bg-card text-gold-ink">
                  {bastPhoto ? <Check className="size-4" /> : <Camera className="size-4" />}
                </span>
                <span className="mt-2 block text-[11px] font-semibold">
                  {bastPhoto ? "Foto kondisi terlampir" : "Tambah foto kondisi alat"}
                </span>
                {bastPhoto && (
                  <img
                    src={bastPhoto}
                    alt="Pratinjau kondisi alat"
                    className="mx-auto mt-3 max-h-36 max-w-full object-contain"
                  />
                )}
              </label>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Clock3 className="size-3.5" /> Dicatat {new Date().toLocaleString("id-ID")}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBastEntry(null)}>
                  Tutup
                </Button>
                <Button
                  onClick={() => {
                    const text = `BAST ${bastEntry.id} · ${bastEntry.kind} · checklist ${bastChecked.length}/4 · ${bastEntry.serial}`;
                    window.open(
                      `https://wa.me/?text=${encodeURIComponent(text)}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                    setBastEntry(null);
                    notify("Ringkasan BAST siap dibagikan via WhatsApp.");
                  }}
                >
                  Kirim BAST via WhatsApp <ArrowRight className="size-4" />
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(kycDetail)}
        onOpenChange={(open) => {
          if (!open) setKycDetail(null);
        }}
      >
        <DialogContent className="max-w-lg">
          {kycDetail && (
            <>
              <DialogHeader className="text-left">
                <p className="section-label">Verifikasi pelanggan</p>
                <DialogTitle className="wordmark text-sm">{kycDetail.name}</DialogTitle>
                <DialogDescription className="text-xs">
                  {kycDetail.id} · {kycDetail.project}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="border border-border p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">WhatsApp</p>
                  <p className="mt-1 font-semibold">{kycDetail.phone}</p>
                </div>
                <div className="border border-border p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Instagram</p>
                  <p className="mt-1 font-semibold">{kycDetail.instagram}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["e-KTP", "Identitas kedua", "Selfie + KTP"].map((item) => (
                  <div
                    key={item}
                    className="grid min-h-24 place-items-center border border-border bg-surface-soft p-2 text-center"
                  >
                    <ImagePlus className="size-5 text-muted-foreground" />
                    <span className="text-[11px]">
                      {item}
                      <br />
                      Dokumen demo
                    </span>
                  </div>
                ))}
              </div>
              <div className="border border-border bg-surface-soft p-4">
                <p className="text-[11px] uppercase text-muted-foreground">Tanda tangan digital</p>
                <p className="mt-2 wordmark text-lg italic text-gold-ink">
                  {kycDetail.name.split(" ")[0]}
                </p>
              </div>
              {kycDetail.status === "Menunggu" ? (
                <>
                  <label className="block text-[11px] font-semibold text-muted-foreground">
                    Catatan alasan penolakan
                    <Input
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      placeholder="Wajib diisi jika ditolak"
                      className="mt-1 h-9 text-xs"
                    />
                  </label>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      className="text-alert"
                      onClick={() => rejectKyc(kycDetail)}
                    >
                      Tolak KYC
                    </Button>
                    <Button onClick={() => approveKyc(kycDetail)}>
                      <Check className="size-4" /> Setujui KYC
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <div className="border border-success/20 bg-success-soft p-3 text-xs font-semibold text-success">
                  Status: {kycDetail.status}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={newProductOpen} onOpenChange={setNewProductOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="wordmark text-sm">Tambah perangkat</DialogTitle>
            <DialogDescription className="text-xs">
              Unit baru langsung muncul pada katalog sewa.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!newProductFields.name.trim() || !Number(newProductFields.price))
                return notify("Nama dan tarif perangkat wajib diisi.");
              const slug = `new-${Date.now()}`;
              const stock = Math.max(1, Number(newProductFields.stock) || 1);
              const prefix = `SMP-${newProductFields.name
                .toUpperCase()
                .replace(/[^A-Z0-9]+/g, "-")
                .replace(/^-|-$/g, "")
                .slice(0, 8)}`;
              setProducts((current) => [
                ...current,
                {
                  id: slug,
                  name: newProductFields.name.toUpperCase(),
                  category: newProductFields.category,
                  price: Number(newProductFields.price),
                  accessories: "KELENGKAPAN AKAN DIKONFIRMASI",
                  serials: Array.from({ length: stock }, (_, index) => ({
                    code: `${prefix}-${String(index + 1).padStart(3, "0")}`,
                    status: "READY" as const,
                  })),
                  bookings: [],
                  art: "monitor",
                },
              ]);
              setNewProductFields({ name: "", category: "Kamera", price: "", stock: "1" });
              setNewProductOpen(false);
              notify("Perangkat demo ditambahkan ke katalog.");
            }}
          >
            <label className="block text-[11px] font-semibold text-muted-foreground">
              Nama perangkat
              <Input
                value={newProductFields.name}
                onChange={(event) =>
                  setNewProductFields((current) => ({ ...current, name: event.target.value }))
                }
                className="mt-1 h-9 text-xs"
                placeholder="Nama alat"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[11px] font-semibold text-muted-foreground">
                Kategori
                <Select
                  value={newProductFields.category}
                  onValueChange={(value) =>
                    setNewProductFields((current) => ({
                      ...current,
                      category: value as ProductCategory,
                    }))
                  }
                >
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kamera">Kamera</SelectItem>
                    <SelectItem value="Wireless Video">Wireless Video</SelectItem>
                    <SelectItem value="Switcher & Live">Switcher & Live</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="text-[11px] font-semibold text-muted-foreground">
                Tarif harian
                <Input
                  type="number"
                  min="1"
                  value={newProductFields.price}
                  onChange={(event) =>
                    setNewProductFields((current) => ({ ...current, price: event.target.value }))
                  }
                  className="mt-1 h-9 text-xs"
                />
              </label>
            </div>
            <label className="block text-[11px] font-semibold text-muted-foreground">
              Jumlah unit
              <Input
                type="number"
                min="1"
                value={newProductFields.stock}
                onChange={(event) =>
                  setNewProductFields((current) => ({ ...current, stock: event.target.value }))
                }
                className="mt-1 h-9 text-xs"
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewProductOpen(false)}>
                Batal
              </Button>
              <Button type="submit">
                <Plus className="size-4" /> Tambahkan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PriceLine({
  label,
  amount,
  discount = false,
}: {
  label: string;
  amount: number;
  discount?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 ${discount ? "text-success" : "text-muted-foreground"}`}
    >
      <span>{label}</span>
      <span className="shrink-0">
        {amount < 0 ? `−${formatRupiah(Math.abs(amount))}` : formatRupiah(amount)}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === "Menunggu"
      ? "border-amber/20 bg-amber-soft text-amber"
      : status === "Disetujui" || status === "Diambil" || status === "Dikembalikan"
        ? "border-success/20 bg-success-soft text-success"
        : "border-alert/20 bg-alert-soft text-alert";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${color}`}
    >
      {status}
    </span>
  );
}

function ScheduleTable({
  rows,
  onChecklist,
  onMark,
  onWa,
}: {
  rows: ScheduleEntry[];
  onChecklist: (entry: ScheduleEntry) => void;
  onMark: (entry: ScheduleEntry, status: ScheduleEntry["status"]) => void;
  onWa: (entry: ScheduleEntry) => void;
}) {
  if (!rows.length)
    return (
      <div className="border border-dashed border-border px-4 py-12 text-center text-xs text-muted-foreground">
        Tidak ada jadwal untuk filter ini.
      </div>
    );
  return (
    <div className="scroll-fade">
      <div className="table-scroll overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[780px] text-left text-xs">
          <thead className="bg-surface-soft text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Booking / klien</th>
              <th className="px-3 py-3">Unit & serial</th>
              <th className="px-3 py-3">Agenda</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr key={entry.id} className="border-t border-border">
                <td className="px-3 py-3">
                  <p className="wordmark text-[11px] font-semibold">{entry.id}</p>
                  <p className="mt-1 text-[11px]">{entry.customer}</p>
                </td>
                <td className="px-3 py-3">
                  <p>{entry.product}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{entry.serial}</p>
                </td>
                <td className="px-3 py-3">
                  <span className="font-semibold">{entry.kind}</span>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(entry.date)}</p>
                </td>
                <td className="px-3 py-3">
                  <StatusPill status={entry.status} />
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="Buka checklist BAST"
                      aria-label={`Checklist BAST ${entry.id}`}
                      onClick={() => onChecklist(entry)}
                    >
                      <ClipboardCheck className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="Pengingat WhatsApp"
                      aria-label={`Pengingat WhatsApp ${entry.id}`}
                      onClick={() => onWa(entry)}
                    >
                      <Headphones className="size-3.5" />
                    </Button>
                    {entry.kind === "Pick-Up" && entry.status === "Menunggu" && (
                      <Button
                        size="sm"
                        className="h-8 px-2 text-[11px]"
                        onClick={() => onMark(entry, "Diambil")}
                      >
                        Tandai diambil
                      </Button>
                    )}
                    {entry.kind === "Return" && entry.status === "Menunggu" && (
                      <Button
                        size="sm"
                        className="h-8 px-2 text-[11px]"
                        onClick={() => onMark(entry, "Dikembalikan")}
                      >
                        Tandai kembali
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChoiceCard({
  selected,
  icon: Icon,
  title,
  subtitle,
  onClick,
}: {
  selected: boolean;
  icon: typeof MapPin;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 border p-4 text-left transition ${selected ? "border-primary bg-surface-soft ring-1 ring-primary" : "border-border bg-card hover:bg-surface-soft"}`}
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-full ${selected ? "bg-primary text-primary-foreground" : "bg-surface-soft text-gold-ink"}`}
      >
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-xs font-semibold">{title}</span>
        <span className="mt-1 block text-[11px] text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold text-muted-foreground">
      {label}
      {children}
    </label>
  );
}
