import { useState } from "react";
import { LogIn, UserPlus, ShieldCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/smartpro/product-card";
import { DEMO_CREDENTIALS, useStore } from "@/lib/smartpro-store";
import { useLiveData } from "@/lib/smartpro-live";
import { isBackendEnabled } from "@/lib/supabase-client";
import type { User } from "@/lib/smartpro-data";
import { Field } from "./ui";

/**
 * Authentication screen.
 *
 * Two modes, chosen at runtime:
 *
 *   backend enabled  -> Supabase Auth. The identifier is an EMAIL; passwords
 *                       never touch our code and there is no client-side
 *                       comparison. Sessions are owned by supabase-js.
 *   backend absent   -> the original local demo login, so a preview build
 *                       without credentials still works end to end.
 *
 * The demo credential box is only rendered in demo mode. Showing it against a
 * real backend would suggest "admin/admin123" works when it cannot.
 */
export function AuthScreen({ onClose }: { onClose?: () => void }) {
  const { state, dispatch } = useStore();
  const live = useLiveData();
  const backend = isBackendEnabled();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ email: "", password: "", name: "", phone: "" });
  // demo mode only
  const [demoForm, setDemoForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  // -------------------------------------------------------------------------
  // Supabase path
  // -------------------------------------------------------------------------
  const submitLive = async () => {
    setError("");
    setNotice("");

    const email = form.email.trim().toLowerCase();
    if (!email || !form.password) {
      setError("Email dan password wajib diisi.");
      return;
    }

    if (mode === "register") {
      if (!form.name.trim()) {
        setError("Nama lengkap wajib diisi.");
        return;
      }
      if (form.password.length < 8) {
        setError("Password minimal 8 karakter.");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await live.signIn(email, form.password);
        onClose?.();
      } else {
        await live.signUp(email, form.password, form.name.trim(), form.phone.trim() || undefined);
        // Projects with "confirm email" enabled do not return a session yet.
        setNotice(
          "Akun dibuat. Cek email untuk konfirmasi, lalu masuk. Jika konfirmasi tidak diminta, Anda langsung masuk.",
        );
        setMode("login");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Gagal memproses permintaan.";
      // Supabase returns a generic invalid-credentials message; make it readable.
      setError(
        /invalid login credentials/i.test(message)
          ? "Email atau password salah."
          : /already registered/i.test(message)
            ? "Email sudah terdaftar. Silakan masuk."
            : message,
      );
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // Demo path (no backend configured)
  // -------------------------------------------------------------------------
  const submitDemoLogin = () => {
    const user = state.users.find(
      (u) => u.username === demoForm.username.trim() && u.password === demoForm.password,
    );
    if (!user) {
      setError("Username atau password salah. Gunakan kredensial demo di bawah.");
      return;
    }
    setError("");
    dispatch({ type: "login", userId: user.id });
  };

  const submitDemoRegister = () => {
    const username = demoForm.username.trim();
    if (!username || !demoForm.password || !form.name.trim()) {
      setError("Nama, username, dan password wajib diisi.");
      return;
    }
    if (state.users.some((u) => u.username === username)) {
      setError("Username sudah dipakai. Pilih username lain.");
      return;
    }
    const user: User = {
      id: `u-${Date.now()}`,
      username,
      password: demoForm.password,
      name: form.name.trim(),
      role: "pelanggan",
      phone: form.phone.trim(),
      kycStatus: "Belum",
      kyc: null,
      points: 0,
      isVip: false,
      wishlist: [],
    };
    dispatch({ type: "register", user });
    dispatch({ type: "login", userId: user.id });
  };

  const submit = () => {
    if (backend) void submitLive();
    else if (mode === "login") submitDemoLogin();
    else submitDemoRegister();
  };

  const quickLogin = (username: string, password: string) => {
    setDemoForm({ username, password });
    const user = state.users.find((u) => u.username === username && u.password === password);
    if (user) dispatch({ type: "login", userId: user.id });
  };

  return (
    <div
      className={
        onClose
          ? "flex min-h-full items-center justify-center bg-background px-4 py-10"
          : "flex min-h-screen items-center justify-center bg-background px-4 py-10"
      }
    >
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark className="size-12" />
            <div>
              <p className="wordmark text-sm font-bold">SMartPro</p>
              <p className="text-[10px] font-medium text-muted-foreground">
                Audio Video Production
              </p>
            </div>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-full text-xs"
              onClick={onClose}
            >
              Kembali
            </Button>
          )}
        </div>

        <div className="border border-border bg-card p-6 shadow-tag">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-surface-soft p-1">
            <Button
              variant={mode === "login" ? "default" : "ghost"}
              size="sm"
              className="h-9 rounded-full text-xs"
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              <LogIn className="size-3.5" /> Masuk
            </Button>
            <Button
              variant={mode === "register" ? "default" : "ghost"}
              size="sm"
              className="h-9 rounded-full text-xs"
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              <UserPlus className="size-3.5" /> Daftar
            </Button>
          </div>

          <div className="space-y-3">
            {mode === "register" && (
              <>
                <Field label="Nama lengkap">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                    placeholder="Nama sesuai identitas"
                    className="h-10 text-sm"
                  />
                </Field>
                <Field label="Nomor WhatsApp">
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
                    placeholder="08xx xxxx xxxx"
                    className="h-10 text-sm"
                  />
                </Field>
              </>
            )}

            {backend ? (
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                  placeholder="nama@email.com"
                  className="h-10 text-sm"
                  autoComplete="email"
                />
              </Field>
            ) : (
              <Field label="Username">
                <Input
                  value={demoForm.username}
                  onChange={(e) => setDemoForm((c) => ({ ...c, username: e.target.value }))}
                  placeholder="username"
                  className="h-10 text-sm"
                  autoComplete="username"
                />
              </Field>
            )}

            <Field label="Password">
              <Input
                type="password"
                value={backend ? form.password : demoForm.password}
                onChange={(e) =>
                  backend
                    ? setForm((c) => ({ ...c, password: e.target.value }))
                    : setDemoForm((c) => ({ ...c, password: e.target.value }))
                }
                placeholder="password"
                className="h-10 text-sm"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !busy) submit();
                }}
              />
            </Field>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-3 border border-alert/30 bg-alert-soft p-2.5 text-[11px] font-semibold text-alert"
            >
              {error}
            </p>
          )}

          {notice && (
            <p className="mt-3 border border-gold-ink/30 bg-surface-soft p-2.5 text-[11px] font-semibold">
              {notice}
            </p>
          )}

          <Button className="mt-4 w-full rounded-full" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "login" ? "Masuk" : "Buat akun pelanggan"}
          </Button>
        </div>

        {/* Demo credential helper only makes sense without a real backend. */}
        {!backend && (
          <div className="mt-4 border border-border bg-surface-soft p-4">
            <p className="flex items-center gap-2 text-[11px] font-semibold">
              <ShieldCheck className="size-3.5 text-gold-ink" /> Kredensial demo untuk uji coba
            </p>
            <div className="mt-2 space-y-1 text-[10px] text-muted-foreground">
              <p>
                Admin: <strong>{DEMO_CREDENTIALS.admin.username}</strong> /{" "}
                <strong>{DEMO_CREDENTIALS.admin.password}</strong>
              </p>
              <p>
                Pelanggan (Verified): <strong>{DEMO_CREDENTIALS.pelanggan.username}</strong> /{" "}
                <strong>{DEMO_CREDENTIALS.pelanggan.password}</strong>
              </p>
              <p>
                Mitra VIP: <strong>salsa</strong> / <strong>salsa123</strong>
              </p>
              <p>
                Menunggu approval KYC: <strong>raka</strong> / <strong>raka123</strong>
              </p>
              <p>
                Belum KYC: <strong>nadia</strong> / <strong>nadia123</strong>
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full text-[10px]"
                onClick={() => quickLogin("admin", "admin123")}
              >
                Isi Admin
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full text-[10px]"
                onClick={() => quickLogin("pelanggan", "pelanggan123")}
              >
                Isi Pelanggan
              </Button>
            </div>
          </div>
        )}

        {backend && (
          <p className="mt-3 text-center text-[10px] text-muted-foreground">
            Akun dikelola melalui Supabase Auth. Hubungi admin bila perlu bantuan akses.
          </p>
        )}

        {/* Sign-out path for a live session lives in the header, not here. */}
        {backend && live.authUserId && (
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Sudah masuk sebagai {live.user?.name ?? live.authUserId.slice(0, 8)}.
          </p>
        )}
      </div>
    </div>
  );
}
