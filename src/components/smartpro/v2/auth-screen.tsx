import { useState } from "react";
import { LogIn, UserPlus, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/smartpro/product-card";
import { DEMO_CREDENTIALS, useStore } from "@/lib/smartpro-store";
import type { User } from "@/lib/smartpro-data";
import { Field } from "./ui";

export function AuthScreen({ onClose }: { onClose?: () => void }) {
  const { state, dispatch } = useStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ username: "", password: "", name: "", phone: "" });
  const [error, setError] = useState("");

  const submitLogin = () => {
    const user = state.users.find(
      (u) => u.username === form.username.trim() && u.password === form.password,
    );
    if (!user) {
      setError("Username atau password salah. Gunakan kredensial demo di bawah.");
      return;
    }
    setError("");
    dispatch({ type: "login", userId: user.id });
  };

  const submitRegister = () => {
    const username = form.username.trim();
    if (!username || !form.password || !form.name.trim()) {
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
      password: form.password,
      name: form.name.trim(),
      role: "pelanggan",
      phone: form.phone.trim(),
      kycStatus: "Belum",
      kyc: null,
      points: 0,
      isVip: false,
    };
    dispatch({ type: "register", user });
    dispatch({ type: "login", userId: user.id });
  };

  const quickLogin = (username: string, password: string) => {
    setForm({ ...form, username, password });
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
              onClick={() => setMode("login")}
            >
              <LogIn className="size-3.5" /> Masuk
            </Button>
            <Button
              variant={mode === "register" ? "default" : "ghost"}
              size="sm"
              className="h-9 rounded-full text-xs"
              onClick={() => setMode("register")}
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
            <Field label="Username">
              <Input
                value={form.username}
                onChange={(e) => setForm((c) => ({ ...c, username: e.target.value }))}
                placeholder="username"
                className="h-10 text-sm"
                autoComplete="username"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
                placeholder="password"
                className="h-10 text-sm"
                autoComplete="current-password"
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (mode === "login") submitLogin();
                  else submitRegister();
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

          <Button
            className="mt-4 w-full rounded-full"
            onClick={mode === "login" ? submitLogin : submitRegister}
          >
            {mode === "login" ? "Masuk" : "Buat akun pelanggan"}
          </Button>
        </div>

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
      </div>
    </div>
  );
}
