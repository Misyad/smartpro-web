# PRD: SMartPro Audio Video Production

Dokumen Product Requirements untuk platform web katalog dan rental perangkat produksi audio video SMartPro.

- Status: aplikasi sudah dibangun (frontend-only, data demo in-memory). Dokumen ini mencatat perilaku yang sudah berjalan dan hal yang belum masuk cakupan.
- Sumber kebenaran teknis: `src/components/smartpro/smartpro-app.tsx`, `src/lib/smartpro-data.ts`, `design.md`.
- Konvensi: angka pada bagian Metrik adalah target awal dan ditandai belum terukur. Dokumen ini tidak memuat statistik yang tidak bersumber.

## 1. Ringkasan Produk

SMartPro adalah penyedia rental perangkat produksi audio video di Jakarta: kamera, wireless video, dan switcher/live streaming. Platform web ini memungkinkan pelanggan melihat katalog, mengecek ketersediaan unit pada tanggal tertentu, Menyusun keranjang sewa, mengunduh penawaran harga (RAB), dan menyelesaikan booking dengan verifikasi KYC. Sisi admin menyediakan ruang kerja untuk jadwal serah-terima, verifikasi KYC, inventaris dan pelacakan aset, serta pengelolaan mitra VIP.

## 2. Latar Belakang dan Masalah

Proses sewa sebelumnya bergantung pada percakapan manual (chat atau telepon): pelanggan menanyakan ketersediaan, harga, dan kelengkapan unit satu per satu. Cara ini menyulitkan pelanggan memperkirakan biaya dan menyulitkan tim memastikan unit yang benar-benar tersedia pada tanggal tertentu. Admin juga perlu mencatat jadwal pengambilan dan pengembalian, memverifikasi identitas penyewa, serta memantau kondisi unit. Platform ini memusatkan alur tersebut dalam satu antarmuka.

## 3. Tujuan dan Metrik Keberhasilan

Tujuan produk:

1. Pelanggan dapat menentukan ketersediaan dan biaya sewa tanpa menunggu balasan manual.
2. Pelanggan dapat menyelesaikan booking dan verifikasi identitas secara mandiri.
3. Admin dapat mengelola jadwal, KYC, inventaris, aset, dan mitra VIP dalam satu ruang kerja.

| Metrik | Target awal (belum terukur) | Cara mengukur |
| --- | --- | --- |
| Waktu Menyusun penawaran | Kurang dari 3 menit dari katalog ke RAB | Pengamatan sesi pelanggan |
| Booking dengan data KYC lengkap | Meningkat dibanding alur manual | Perbandingan jumlah booking valid |
| Kesalahan bentrok jadwal | Berkurang karena ketersediaan tampil di depan | Log penolakan atau bentrok unit |
| Antrean KYC terverifikasi tepat waktu | Antrean tidak menumpuk lebih dari satu hari kerja | Isi antrean verifikasi admin |

Semua target di atas adalah asumsi perencanaan. Angka aktual belum diukur.

## 4. Persona dan Peran

Pelanggan memiliki tiga tingkat akun:

- Reguler: pengguna umum. Default.
- Verified Member: pelanggan yang identitasnya sudah diverifikasi. Dapat memakai jalur cepat booking (tanpa unggah dokumen ulang).
- Partner VIP: mitra EO/PH dengan diskon permanen 15% dan akses skema DP 30%. Bisa menukar poin loyalitas.

Admin operasional mengelola:

- Jadwal pengambilan dan pengembalian.
- Verifikasi KYC.
- Inventaris perangkat dan kondisi unit (servis).
- Pelacakan aset via kode QR.
- Mitra VIP dan bonus poin.

## 5. Ruang Lingkup

Termasuk cakupan (sudah berjalan):

- Katalog, pencarian, filter kategori dan ketersediaan.
- Pemilih tanggal, perhitungan durasi dan promo.
- Keranjang (Tas Sewa), add-on, tukar poin.
- Penawaran harga (RAB) yang dapat dicetak A4.
- Checkout 4 langkah dengan KYC dan tanda tangan digital.
- Panduan cepat per produk dan perpanjangan 1-klik.
- Ruang kerja admin (ringkasan, jadwal, KYC, inventaris, mitra VIP).

Di luar cakupan (belum dibangun pada versi ini):

- Backend, basis data, dan sinkronisasi antar perangkat. Semua data bersifat in-memory dan hilang saat halaman dimuat ulang.
- Pembayaran sungguhan. Langkah pembayaran bersifat simulasi.
- Integrasi WhatsApp otomatis. Tautan wa.me disiapkan, pengiriman nyata belum ada.
- Autentikasi dan multi-pengguna.
- Persistensi poin loyalitas dan riwayat booking.

## 6. Fitur Fungsional

### 6.1 Katalog

- Filter kategori: Semua Alat, Paket Bundling, Kamera, Wireless Video, Switcher & Live.
- Pencarian berdasarkan nama dan kata kunci.
- Filter hanya menampilkan unit yang tersedia pada rentang tanggal terpilih.
- Kartu berformat hang-tag: harga per 24 jam, kelengkapan bawaan, status ketersediaan (Tersedia X Unit atau Terbooking Penuh), dan penanda unit servis.
- Tombol Panduan (panduan cepat) dan Sewa Alat (atau kontrol jumlah bila sudah di keranjang).

Produk awal mencakup antara lain COSMO C1, SONY A6400 (BO), CINEVIEW 2 SDI, COSMO C2, OSEE GOSTREAM, ATEM MINI, PTZ MINRRAY UV510A, dan SONY PXW-70.

### 6.2 Tanggal dan Tingkat Akun

- Pemilih tanggal ambil dan tanggal kembali.
- Durasi dihitung dalam kelipatan 24 jam.
- Promo otomatis: setiap 3 hari sewa, 1 hari gratis.
- Pemilihan tingkat akun: Reguler, Verified Member, Partner VIP.

### 6.3 Paket Bundling

Tiga paket awal:

- Paket Live Streaming 2 Cam.
- Paket Wireless Multicam Pro.
- Paket Webinar & Hybrid Event.

Ketersediaan paket dihitung dari jumlah unit komponen yang tersedia.

### 6.4 Tas Sewa (Keranjang)

- Daftar item: produk, paket, dan add-on.
- Add-on: kabel SDI/HDMI 20m, baterai NPF-970 tambahan, lensa Sigma 16mm, operator switcher 8 jam.
- Tukar 1.000 poin loyalitas untuk potongan Rp 50.000 (khusus akun non-reguler).
- Ringkasan harga: nilai sewa, promo, diskon VIP, potongan poin, biaya pengantaran, dan total.
- Aksi: Unduh Penawaran (RAB) dan Lanjut Booking.

### 6.5 Penawaran Harga (RAB)

- Dokumen penawaran berisi identitas klien, proyek, rincian baris, dan total.
- Dapat disalin sebagai ringkasan teks.
- Dapat dicetak atau disimpan sebagai PDF dengan tata letak A4 bersih tanpa elemen antarmuka.

### 6.6 Checkout 4 Langkah

1. Metode pengambilan: ambil di studio (gratis) atau kurir pengantaran (biaya simulasi Rp 35.000).
2. Data penyewa dan KYC: data identitas, unggah tiga dokumen (e-KTP, identitas kedua, selfie dengan KTP), tanda tangan digital pada kanvas. Jalur cepat untuk Verified Member dan Partner VIP.
3. Pembayaran: skema DP 30% (khusus VIP), DP 50%, atau Lunas 100%; metode QRIS atau transfer BCA. Nilai pembayaran awal dihitung dari total.
4. Konfirmasi: kode booking ditampilkan, ringkasan masa sewa dan metode, tombol konfirmasi via WhatsApp, dan tautan ke dashboard admin.

Validasi langkah KYC menampilkan pesan kesalahan inline yang menyebut bagian yang belum lengkap.

### 6.7 Panduan Cepat dan Perpanjangan

- Setiap produk memiliki langkah panduan singkat dan satu saran pemakaian (pro-tip).
- Perpanjangan 1-klik menambah 24 jam; sistem memeriksa bentrok dengan booking berikutnya dan menonaktifkan perpanjangan bila unit sudah terpesan.

### 6.8 Ruang Kerja Admin

Ringkasan:

- Kartu metrik (rental aktif, nilai sewa harian, antrean KYC, status inventaris).
- Jadwal pengambilan/pengembalian hari ini.
- Pengingat otomatis WhatsApp H-3 jam (simulasi) dengan log.
- Antrean KYC yang perlu ditinjau.

Jadwal:

- Tabel jadwal dengan filter Semua, Pick-Up, Return.
- Aksi: checklist BAST digital (checklist kondisi + foto + kirim ringkasan via WhatsApp), pengingat WhatsApp, dan penandaan status (Diambil/Dikembalikan).

Verifikasi KYC:

- Tinjau dokumen, WhatsApp, Instagram, dan tanda tangan.
- Setujui atau tolak (dengan alasan penolakan). Persetujuan menambah pelanggan ke daftar Verified Member.

Inventaris:

- Tambah perangkat baru (nama, kategori, tarif, jumlah unit).
- Ubah jumlah stok per produk.
- Pelacakan aset via QR per serial.
- Kunci atau buka servis per unit.

Mitra VIP:

- Daftar mitra dengan kontak, diskon permanen, dan poin.
- Tambah mitra baru.
- Beri bonus poin.

## 7. Aturan Bisnis

Aturan didefinisikan di `src/lib/smartpro-data.ts`:

- Durasi sewa: selisih hari dibulatkan ke atas, minimal 1 hari.
- Hari gratis promo: jumlah hari dibagi 3, dibulatkan ke bawah.
- Ketersediaan unit: jumlah unit berstatus READY dikurangi jumlah unit yang terbooking pada rentang tanggal yang tumpang-tindih.
- Ketersediaan paket: nilai terkecil dari ketersediaan setiap komponen dibagi kuantitas komponennya.
- Perhitungan harga: nilai dasar (tarif harian x kuantitas x hari) dikurangi nilai promo hari gratis, lalu dikurangi diskon VIP 15% dari hasil setelah promo.

## 8. Persyaratan Non-Fungsional

- Platform: aplikasi web frontend-only tanpa backend atau layanan cloud. Data bersifat in-memory selama sesi.
- Bahasa: Bahasa Indonesia untuk seluruh antarmuka dan salinan.
- Identitas visual: estetika katalog studio bersih dengan motif kartu hang-tag dan aksen emas, mengikuti `design.md`. Tipografi Michroma untuk display dan Plus Jakarta Sans untuk teks.
- Aksesibilitas: target WCAG AA untuk kontras teks. Pasangan warna utama telah diukur lolos ambang AA. Kontrol dapat dioperasikan dengan keyboard dan memiliki indikator fokus.
- Responsif: grid katalog 1 kolom di ponsel, 2 di tablet, 3 di laptop, 4 di desktop lebar.
- Cetak: dokumen RAB tercetak bersih pada kertas A4.
- Kualitas: aturan antislop diterapkan sebagai filter agar keluaran tidak jatuh ke pola generik. Lint, uji, dan build harus lulus.

## 9. Arsitektur dan Teknologi

- Kerangka: TanStack Start dan TanStack Router, React 19, TypeScript.
- Gaya: Tailwind CSS v4 dengan token warna oklch.
- Komponen: shadcn/ui di atas Radix UI, ikon lucide-react.
- Data dan aturan: modul murni di `src/lib/smartpro-data.ts`.
- Uji: Vitest dengan Testing Library, mencakup aturan rental dan pencocokan rute.
- Cetak: aturan `@media print` untuk dokumen RAB.

## 10. Alur Pengguna

Pelanggan:

1. Membuka katalog dan memilih tanggal sewa.
2. Memfilter kategori atau mencari produk; melihat ketersediaan dan harga.
3. Menambah produk atau paket ke Tas Sewa; menambah add-on bila perlu.
4. Opsional: menukar poin (akun non-reguler) dan mengunduh RAB.
5. Lanjut ke checkout, mengisi metode pengambilan, KYC, dan pembayaran.
6. Menerima kode booking dan konfirmasi via WhatsApp.

Admin:

1. Meninjau antrean KYC dan menyetujui atau menolak.
2. Mengelola jadwal pengambilan dan pengembalian, termasuk BAST digital.
3. Memantau inventaris, kondisi unit, dan pelacakan aset.
4. Mengelola mitra VIP dan bonus poin.

## 11. Status dan Roadmap

Semua item pada `roadmap.md` telah selesai: katalog dan sistem visual, alur keranjang/penawaran/booking/KYC/panduan/perpanjangan, operasional admin, serta pengujian aturan rental dan verifikasi build.

Kandidat pengembangan berikutnya (belum masuk cakupan):

- Backend dan basis data untuk persistensi booking, poin, dan riwayat.
- Autentikasi dan peran pengguna.
- Integrasi pembayaran dan WhatsApp sungguhan.
- Notifikasi dan pengingat otomatis berbasis server.

## 12. Asumsi, Batasan, dan Risiko

- Seluruh data adalah contoh. Booking, KYC, dan poin kembali ke nilai awal saat halaman dimuat ulang.
- Langkah pembayaran dan pengingat WhatsApp bersifat simulasi, bukan transaksi nyata.
- Ketersediaan bergantung pada data booking yang tertanam; belum ada sinkronisasi dengan jadwal nyata.

## 13. Glosarium

- RAB: Rencana Anggaran Biaya, di sini berupa surat penawaran harga.
- BAST: Berita Acara Serah Terima, checklist digital saat unit diserahkan atau dikembalikan.
- KYC: Know Your Customer, verifikasi identitas penyewa.
- DP: uang muka, sebagian pembayaran di awal.
- Hang-tag: motif kartu label gantung sebagai identitas visual katalog.
- Tier: tingkat akun pelanggan (Reguler, Verified Member, Partner VIP).
