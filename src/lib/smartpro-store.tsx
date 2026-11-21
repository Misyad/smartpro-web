import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";

import {
  DEFAULT_SETTINGS,
  INITIAL_BUNDLES,
  INITIAL_PRODUCTS,
  type AdminSettings,
  type ApprovalStatus,
  type Bundle,
  type ExtendRequest,
  type PaymentRecord,
  type Product,
  type ReturnRequest,
  type ScheduleEntry,
  type Transaction,
  type User,
} from "@/lib/smartpro-data";
import {
  SEED_EXTENDS,
  SEED_PAYMENTS,
  SEED_RETURNS,
  SEED_SCHEDULE,
  SEED_TRANSACTIONS,
  SEED_USERS,
} from "@/lib/smartpro-seed";

const STORAGE_KEY = "smartpro-state-v3";

export type CartLine = {
  key: string;
  name: string;
  duration: "12h" | "24h";
  price: number;
  quantity: number;
  rewardPoints: number;
  productId?: string;
};

export type { ScheduleEntry } from "@/lib/smartpro-data";

export type AppState = {
  users: User[];
  currentUserId: string | null;
  products: Product[];
  bundles: Bundle[];
  cart: CartLine[];
  transactions: Transaction[];
  payments: PaymentRecord[];
  returns: ReturnRequest[];
  extends: ExtendRequest[];
  schedule: ScheduleEntry[];
  settings: AdminSettings;
};

export const DEMO_CREDENTIALS = {
  admin: { username: "admin", password: "admin123" },
  pelanggan: { username: "pelanggan", password: "pelanggan123" },
};

export const INITIAL_USERS: User[] = [
  {
    id: "u-admin",
    username: "admin",
    password: "admin123",
    name: "Admin SMartPro",
    role: "admin",
    phone: "6281200000000",
    kycStatus: "Verified",
    kyc: null,
    points: 0,
  },
  {
    id: "u-pelanggan",
    username: "pelanggan",
    password: "pelanggan123",
    name: "Bima Putra",
    role: "pelanggan",
    phone: "6281240008890",
    kycStatus: "Verified",
    kyc: {
      namaKtp: "Bima Putra",
      nik: "3174000000000001",
      whatsapp: "6281240008890",
      alamat: "Jl. Kebon Jeruk No. 8, Jakarta",
      kontakDarurat: "Rani, 6281200000001",
      fotoKtp: null,
      fotoSelfie: null,
      signature: null,
    },
    points: 320,
  },
  {
    id: "u-baru",
    username: "nadia",
    password: "nadia123",
    name: "Nadia Pratama",
    role: "pelanggan",
    phone: "6281380009112",
    kycStatus: "Belum",
    kyc: null,
    points: 0,
  },
  ...SEED_USERS,
];

const INITIAL_STATE: AppState = {
  users: INITIAL_USERS,
  currentUserId: null,
  products: INITIAL_PRODUCTS,
  bundles: INITIAL_BUNDLES,
  cart: [],
  transactions: SEED_TRANSACTIONS,
  payments: SEED_PAYMENTS,
  returns: SEED_RETURNS,
  extends: SEED_EXTENDS,
  schedule: SEED_SCHEDULE,
  settings: DEFAULT_SETTINGS,
};

type Action =
  | { type: "login"; userId: string }
  | { type: "logout" }
  | { type: "register"; user: User }
  | { type: "updateUser"; userId: string; patch: Partial<User> }
  | { type: "setKycStatus"; userId: string; status: User["kycStatus"]; note?: string }
  | { type: "setProducts"; products: Product[] }
  | { type: "addProduct"; product: Product }
  | { type: "updateProduct"; productId: string; patch: Partial<Product> }
  | { type: "addToCart"; line: CartLine }
  | { type: "updateCartQty"; key: string; delta: number }
  | { type: "removeCartLine"; key: string }
  | { type: "clearCart" }
  | { type: "addTransaction"; transaction: Transaction; payments: PaymentRecord[] }
  | { type: "setTransactionStatus"; transactionId: string; status: Transaction["status"] }
  | {
      type: "setTransactionPickup";
      transactionId: string;
      pickupStatus: Transaction["pickupStatus"];
    }
  | { type: "addPayment"; payment: PaymentRecord }
  | { type: "setPaymentStatus"; paymentId: string; status: ApprovalStatus; note?: string }
  | { type: "addReturn"; request: ReturnRequest }
  | { type: "setReturnStatus"; requestId: string; status: ApprovalStatus; note?: string }
  | { type: "addExtend"; request: ExtendRequest }
  | { type: "setExtendStatus"; requestId: string; status: ApprovalStatus }
  | { type: "markExtendPaid"; requestId: string }
  | { type: "addSchedule"; entry: ScheduleEntry }
  | { type: "setScheduleStatus"; id: string; status: ScheduleEntry["status"] }
  | { type: "updateSettings"; patch: Partial<AdminSettings> }
  | { type: "hydrate"; state: AppState };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "login":
      return { ...state, currentUserId: action.userId };
    case "logout":
      return { ...state, currentUserId: null, cart: [] };
    case "register":
      return { ...state, users: [...state.users, action.user] };
    case "updateUser":
      return {
        ...state,
        users: state.users.map((u) => (u.id === action.userId ? { ...u, ...action.patch } : u)),
      };
    case "setKycStatus":
      return {
        ...state,
        users: state.users.map((u) =>
          u.id === action.userId ? { ...u, kycStatus: action.status, kycNote: action.note } : u,
        ),
      };
    case "setProducts":
      return { ...state, products: action.products };
    case "addProduct":
      return { ...state, products: [action.product, ...state.products] };
    case "updateProduct":
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.productId ? { ...p, ...action.patch } : p,
        ),
      };
    case "addToCart": {
      const existing = state.cart.find((line) => line.key === action.line.key);
      if (existing) {
        return {
          ...state,
          cart: state.cart.map((line) =>
            line.key === action.line.key
              ? { ...line, quantity: line.quantity + action.line.quantity }
              : line,
          ),
        };
      }
      return { ...state, cart: [...state.cart, action.line] };
    }
    case "updateCartQty":
      return {
        ...state,
        cart: state.cart
          .map((line) =>
            line.key === action.key ? { ...line, quantity: line.quantity + action.delta } : line,
          )
          .filter((line) => line.quantity > 0),
      };
    case "removeCartLine":
      return { ...state, cart: state.cart.filter((line) => line.key !== action.key) };
    case "clearCart":
      return { ...state, cart: [] };
    case "addTransaction":
      return {
        ...state,
        transactions: [action.transaction, ...state.transactions],
        payments: [...action.payments, ...state.payments],
      };
    case "setTransactionStatus":
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.transactionId ? { ...t, status: action.status } : t,
        ),
      };
    case "setTransactionPickup":
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.transactionId ? { ...t, pickupStatus: action.pickupStatus } : t,
        ),
      };
    case "addPayment":
      return { ...state, payments: [action.payment, ...state.payments] };
    case "setPaymentStatus":
      return {
        ...state,
        payments: state.payments.map((p) =>
          p.id === action.paymentId ? { ...p, status: action.status, note: action.note } : p,
        ),
      };
    case "addReturn":
      return { ...state, returns: [action.request, ...state.returns] };
    case "setReturnStatus":
      return {
        ...state,
        returns: state.returns.map((r) =>
          r.id === action.requestId ? { ...r, status: action.status, note: action.note } : r,
        ),
      };
    case "addExtend":
      return { ...state, extends: [action.request, ...state.extends] };
    case "setExtendStatus":
      return {
        ...state,
        extends: state.extends.map((r) =>
          r.id === action.requestId ? { ...r, status: action.status } : r,
        ),
      };
    case "markExtendPaid":
      return {
        ...state,
        extends: state.extends.map((r) => (r.id === action.requestId ? { ...r, paid: true } : r)),
      };
    case "addSchedule":
      return { ...state, schedule: [action.entry, ...state.schedule] };
    case "setScheduleStatus":
      return {
        ...state,
        schedule: state.schedule.map((s) =>
          s.id === action.id ? { ...s, status: action.status } : s,
        ),
      };
    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.patch } };
    default:
      return state;
  }
}

type StoreContextValue = {
  state: AppState;
  dispatch: Dispatch<Action>;
  currentUser: User | null;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function loadInitialState(): AppState {
  if (typeof window === "undefined") return INITIAL_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...INITIAL_STATE,
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return INITIAL_STATE;
  }
}

export function SmartProProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // Hydrate from localStorage after mount to avoid SSR mismatch.
  useEffect(() => {
    dispatch({ type: "hydrate", state: loadInitialState() });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }, [state]);

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? null,
    [state.users, state.currentUserId],
  );

  const value = useMemo(() => ({ state, dispatch, currentUser }), [state, currentUser]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within SmartProProvider");
  return ctx;
}

export function resetStore(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}
