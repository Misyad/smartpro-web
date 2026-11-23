import { useRef } from "react";
import { ImagePlus, Check, X } from "lucide-react";

type SingleUploadProps = {
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
};

export function SingleImageUpload({ label, value, onChange }: SingleUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => onChange(String(reader.result));
          reader.readAsDataURL(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full border border-dashed border-border bg-surface-soft p-3 text-center"
      >
        <span className="mx-auto grid size-8 place-items-center rounded-full bg-card text-gold-ink">
          {value ? <Check className="size-4" /> : <ImagePlus className="size-4" />}
        </span>
        <span className="mt-2 block text-[10px] font-semibold">{label}</span>
        <span className="mt-1 block text-[9px] text-muted-foreground">
          {value ? "Foto terpilih, klik untuk ganti" : "Pilih foto"}
        </span>
      </button>
      {value && (
        <div className="relative mt-2">
          <img src={value} alt={label} className="h-20 w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-card text-alert"
            aria-label={`Hapus ${label}`}
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function MultiImageUpload({
  photos,
  onChange,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          files.forEach((file) => {
            const reader = new FileReader();
            reader.onload = () => onChange([...photos, String(reader.result)].filter(Boolean));
            reader.readAsDataURL(file);
          });
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full border border-dashed border-border bg-surface-soft p-3 text-center"
      >
        <span className="mx-auto grid size-8 place-items-center rounded-full bg-card text-gold-ink">
          <ImagePlus className="size-4" />
        </span>
        <span className="mt-2 block text-[10px] font-semibold">Unggah foto kondisi</span>
        <span className="mt-1 block text-[9px] text-muted-foreground">
          Boleh lebih dari satu foto
        </span>
      </button>
      {photos.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {photos.map((src, i) => (
            <div key={`${src.slice(0, 20)}-${i}`} className="relative">
              <img src={src} alt={`Bukti ${i + 1}`} className="h-16 w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(photos.filter((_, idx) => idx !== i))}
                className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-card text-alert"
                aria-label={`Hapus foto ${i + 1}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
