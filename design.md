# UI/UX Design System & Spesifikasi Visual — SMartPro Audio Video Production

Dokumen ini merupakan panduan resmi desain antarmuka (*UI/UX Design System*) untuk platform web rental **SMartPro Audio Video Production**. Seluruh spesifikasi di bawah ini merujuk langsung pada estetika kartu katalog *hang-tag* SMartPro serta arsitektur interaktif pada `App.jsx`.

---

## 1. Filosofi Desain & Identitas Visual
* **Clean Studio Aesthetic:** Latar belakang terang dan bersih yang menonjolkan produk peralatan *broadcast*, kamera, dan *wireless video* layaknya katalog studio profesional.
* **Tactile Hang-Tag Metaphor:** Setiap kartu produk mengadopsi bentuk fisik *price-tag* / *hang-tag* lengkap dengan lubang gantung (*punch-hole*) di sudut kiri atas, potongan tab harga `/ 24 JAM` di kanan atas, serta stempel monogram emas **SP** di kanan bawah.
* **High-Contrast Readability:** Kombinasi hitam pekat, abu-abu hangat, putih bersih, dan aksen emas metalik untuk hierarki informasi yang tegas namun elegan.

---

## 2. Sistem Warna (*Color Tokens*)

| Token / Peran | Kode Hex | Penggunaan Utama |
| :--- | :--- | :--- |
| **Canvas Background** | `#F9F9F7` | Latar belakang utama halaman (*warm off-white*) agar nyaman dipandang dalam waktu lama. |
| **Surface Card / Modal** | `#FFFFFF` | Latar belakang kartu *hang-tag*, panel filter, drawer Tas Sewa, dan modal. |
| **Hang-Tag Product Stage** | `#EAEAE4` | Bingkai dalam panggung foto produk pada kartu *hang-tag* (*warm studio grey*). |
| **Secondary Surface** | `#F4F4F1` | Latar belakang input pencarian, pemilih tanggal, dan tab navigasi non-aktif. |
| **Primary Ink / CTA** | `#111111` | Tipografi judul utama, harga utama, dan tombol aksi primer (*Primary Button*). |
| **Brand Gold Accent** | `#D4AF37` | Lencana notifikasi, sorotan kartu Paket Bundling, dan aksen hover tombol utama. |
| **Brand Gold Dark (Text)** | `#B88E26` | Teks aksen emas di atas latar terang agar memenuhi rasio kontras aksesibilitas. |
| **Gold Monogram Gradient** | `#E6C35C` $\rightarrow$ `#CFA034` $\rightarrow$ `#B8861E` | Gradien metalik khusus logo monogram berlian **SP**. |
| **Status Available** | `#047857` / `#ECFDF5` | Indikator unit tersedia (*Emerald*). |
| **Status Booked / Alert** | `#E11D48` / `#FFF1F2` | Indikator unit terbooking penuh atau peringatan bentrok jadwal (*Rose*). |

---

## 3. Tipografi (*Typography Scale*)

Aplikasi menggunakan pasangan dua jenis huruf (*font pairing*) untuk membedakan karakter teknis peralatan dengan teks informasi yang mudah dibaca:

1. **Display & Tag Font — `Michroma` (`font-tag-wide`)**
   * **Karakter:** Geometris lebar (*wide futuristic*), tegas, dan menyerupai cetakan label peralatan profesional.
   * **Penggunaan:** Brand **SMartPro**, angka harga pada tab kanan atas (`150.000`), nama produk utama (`COSMO C1`, `SONY A6400 (BO)`), kode booking, dan judul setiap bagian (*section headers*).
   * **Letter Spacing:** `0.04em`.

2. **Body & UI Font — `Plus Jakarta Sans`**
   * **Karakter:** Humanis modern, bersih, dan sangat terbaca pada ukuran kecil.
   * **Penggunaan:** Daftar kelengkapan alat (`1 RX, 1 TX, 2 BATERAI NPF...`), label `/ 24 JAM`, formulir KYC, rincian keranjang, dan tabel Dashboard Admin.
   * **Bobot (*Weights*):** `400` (Regular), `500` (Medium), `600` (SemiBold), `700` (Bold), `800` (ExtraBold).

---

## 4. Anatomi Kartu Produk *Hang-Tag* (Komponen Inti)

Setiap kartu unit di katalog memiliki struktur presisi sebagai berikut:

1. **Outer Card Shell:**
   * Latar `#FFFFFF`, border `1px solid` (`border-stone-200/90`), sudut membulat besar `rounded-[32px]`, padding `14px` (`p-3.5`), dan bayangan lembut `0 14px 34px -12px rgba(0,0,0,0.12)`.
   * Efek interaktif: terangkat halus `-translate-y-1` saat di-*hover*.
2. **Inner Product Stage (`#EAEAE4`):**
   * Sudut membulat `rounded-[24px]`, tinggi minimum `250px`.
   * **Punch-Hole (Kiri Atas):** Lingkaran putih berdiameter `24px` (`w-6 h-6`) dengan *inner shadow* di posisi `top: 14px; left: 14px`.
   * **Price Cutout Tab (Kanan Atas):** Blok putih menyatu dengan bingkai luar di sudut `top-0 right-0` dengan lengkungan sudut kiri bawah `rounded-bl-[22px]`. Menampilkan nominal harga (`150.000`) di atas dan label `/ 24 JAM` di bawahnya.
   * **Product Cutout Image:** Gambar produk PNG transparan (*studio cutout*) di tengah panggung dengan bayangan dasar elips lembut.
   * **Status Pill (Bawah Panggung):** Lencana ketersediaan real-time (`Tersedia X Unit` / `Terbooking Penuh`) serta lencana kunci servis (`X Servis`) jika ada unit yang sedang dikunci di Maintenance Log.
3. **Footer Kartu:**
   * **Kiri:** Nama produk (`Michroma`) + rincian kelengkapan bawaan huruf kapital (`11px`, `text-stone-500`).
   * **Kanan:** Logo monogram emas **SP** (`40px x 40px`).
   * **Action Bar (Bawah):** Tombol **Panduan** (*Quick-Start Guide 1 Menit*) di kiri dan tombol kapsul **+ Sewa Alat** (atau kontrol `- qty +` jika sudah masuk Tas Sewa) di kanan.

---

## 5. Pola Komponen Interaktif Utama

* **Dual-Mode Navigation Header:**
  * *Sticky top bar* (`height: 80px`) dengan tombol beralih cepat antara **Katalog Sewa (Pelanggan)** dan **Dashboard Admin** (dilengkapi *badge* penghitung antrean KYC).
* **Real-Time Date & Tier Bar:**
  * Pemilih tanggal ambil & kembali yang langsung menghitung durasi `Nx 24 JAM`, memicu promo otomatis **Sewa 2 Gratis 1** pada kelipatan 3 hari, serta menampilkan status *tier* akun (**Reguler**, **Verified Member**, atau **Partner VIP 15% OFF**).
* **Slide-Over Drawer (Tas Sewa):**
  * Panel geser dari kanan (`max-w-md`) yang memuat daftar unit, rekomendasi otomatis **Smart Cross-Selling (Add-On)**, opsi tukar **1.000 Poin Loyalitas**, tombol cetak **Penawaran Harga (PDF / RAB)**, dan tombol lanjut ke **Checkout & KYC**.
* **Multi-Step Checkout & KYC Modal:**
  * Alur 4 langkah (*1. Metode Pengambilan* $\rightarrow$ *2. Form KYC & Canvas Signature Pad* $\rightarrow$ *3. Skema DP 30%/50% atau Lunas* $\rightarrow$ *4. Konfirmasi & WhatsApp*).
* **Operational Admin Workspace:**
  * Kartu metrik harian, tabel jadwal *Check-Out / Check-In* dengan modal **Digital BAST Checklist**, panel **Auto-WA H-3 Jam**, antrean persetujuan **KYC Queue**, **Inventory Manager**, **QR Code Asset Tracking**, serta manajemen **Mitra Partner VIP**.

---

## 6. Responsivitas & Standar Cetak

* **Grid Breakpoints:**
  * Mobile (`< 640px`): 1 kolom kartu *hang-tag*.
  * Tablet (`640px – 1023px`): 2 kolom kartu *hang-tag*.
  * Laptop (`1024px – 1279px`): 3 kolom kartu *hang-tag*.
  * Desktop Lebar (`>= 1280px`): 4 kolom kartu *hang-tag* (`max-w-7xl`).
* **Print Media Query (`@media print`):**
  * Disediakan aturan khusus pada ID `#smartpro-quotation-print` agar dokumen **Surat Penawaran Harga (RAB)** tercetak bersih dalam format kertas **A4** tanpa elemen navigasi atau tombol web.