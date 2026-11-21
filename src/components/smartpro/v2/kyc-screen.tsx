import { useState } from "react";
import { ShieldCheck, Send, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/smartpro-store";
import type { User } from "@/lib/smartpro-data";
import { Field } from "./ui";
import { SingleImageUpload } from "./image-upload";
import { SignaturePad } from "./signature-pad";

export function KycScreen() {
  const { currentUser, dispatch } = useStore();
  const [form, setForm] = useState({
    namaKtp: "",
    nik: "",
    whatsapp: currentUser?.phone ?? "",
    alamat: "",
    kontakDarurat: "",
  });
  const [fotoKtp, setFotoKtp] = useState<string | null>(null);
  const [fotoSelfie, setFotoSelfie] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (!currentUser) return null;

  if (currentUser.kycStatus === "Menunggu") {
    return (
      <div className="mx-auto max-w-lg border border-amber/30 bg-amber-soft p-6 text-center">
        <Clock3 className="mx-auto size-8 text-amber" />
        <p className="mt-3 text-sm font-semibold text-amber">Verifikasi sedang ditinjau Admin</p>
        <p className="mt-1 text-xs text-amber">
          Data KYC Anda sudah terkirim. Anda dapat bertransaksi penuh setelah Admin menyetujui.
        </p>
      </div>
    );
  }

  if (currentUser.kycStatus === "Verified") return null;

  const submit = () => {
    const problems: string[] = [];
    if (!form.namaKtp.trim()) problems.push("nama sesuai KTP");
    if (form.nik.length !== 16) problems.push("NIK 16 digit");
    if (!form.whatsapp.trim()) problems.push("nomor WhatsApp");
    if (!form.alamat.trim()) problems.push("alamat");
    if (!form.kontakDarurat.trim()) problems.push("kontak darurat");
    if (!fotoKtp) problems.push("foto KTP");
    if (!fotoSelfie) problems.push("selfie KTP");
    if (!signature) problems.push("tanda tangan");
    if (problems.length) {
      setError(`Belum lengkap: ${problems.join(", ")}.`);
      return;
    }
    setError("");
    const patch: Partial<User> = {
      kycStatus: "Menunggu",
      phone: form.whatsapp,
      kyc: {
        ...form,
        nik: form.nik,
        fotoKtp,
        fotoSelfie,
        signature,
      },
    };
    dispatch({ type: "updateUser", userId: currentUser.id, patch });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="border border-border bg-card p-5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-gold-ink" /> Verifikasi Identitas (KYC)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Semua pelanggan wajib terverifikasi sebelum bertransaksi penuh. Isi data sesuai KTP.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Nama sesuai KTP">
            <Input
              value={form.namaKtp}
              onChange={(e) => setForm((c) => ({ ...c, namaKtp: e.target.value }))}
              className="h-10 text-sm"
            />
          </Field>
          <Field label="NIK 16 digit">
            <Input
              inputMode="numeric"
              maxLength={16}
              value={form.nik}
              onChange={(e) =>
                setForm((c) => ({ ...c, nik: e.target.value.replace(/\D/g, "").slice(0, 16) }))
              }
              className="h-10 text-sm"
            />
          </Field>
          <Field label="Nomor WhatsApp">
            <Input
              value={form.whatsapp}
              onChange={(e) => setForm((c) => ({ ...c, whatsapp: e.target.value }))}
              className="h-10 text-sm"
            />
          </Field>
          <Field label="Kontak darurat">
            <Input
              value={form.kontakDarurat}
              onChange={(e) => setForm((c) => ({ ...c, kontakDarurat: e.target.value }))}
              className="h-10 text-sm"
            />
          </Field>
          <Field label="Alamat lengkap">
            <Input
              value={form.alamat}
              onChange={(e) => setForm((c) => ({ ...c, alamat: e.target.value }))}
              className="h-10 text-sm"
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SingleImageUpload label="Foto KTP / identitas" value={fotoKtp} onChange={setFotoKtp} />
          <SingleImageUpload
            label="Selfie dengan KTP"
            value={fotoSelfie}
            onChange={setFotoSelfie}
          />
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold">Tanda tangan digital</p>
          <SignaturePad onChange={setSignature} />
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 border border-alert/30 bg-alert-soft p-2.5 text-[11px] font-semibold text-alert"
          >
            {error}
          </p>
        )}

        <Button className="mt-4 w-full rounded-full" onClick={submit}>
          <Send className="size-4" /> Kirim untuk verifikasi
        </Button>
      </div>
    </div>
  );
}
