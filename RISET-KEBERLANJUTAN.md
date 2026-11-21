# Riset Keberlanjutan (Sustainability) SMartPro Web

Dokumen ini merangkum kondisi teknis saat ini, risiko keberlanjutan, dan peta jalan yang bisa dipertanggungjawabkan ke klien. Ditulis untuk membantu keputusan jangka panjang, bukan sekadar daftar fitur.

- Versi dokumen: 1.0
- Basis analisis: kode di repositori `Misyad/smartpro-web` (commit terakhir saat dokumen dibuat)
- Catatan kejujuran: semua angka kondisi hari ini diambil dari kode, bukan estimasi pasar. Tidak ada klaim tanpa dasar.

## 1. Ringkasan Eksekutif

Web SMartPro saat ini adalah prototipe fungsional yang lengkap secara alur (katalog, keranjang, penawaran, checkout, KYC, admin), tetapi masih berjalan tanpa backend dan tanpa basis data. Seluruh data adalah contoh yang hidup di memori dan hilang saat halaman dimuat ulang. Untuk dipakai produksi dan dirawat jangka panjang, dibutuhkan lapisan data persisten, autentikasi, integrasi pembayaran dan pesan yang nyata, serta proses operasional (monitoring, cadangan, pembaruan dependensi).

Keberlanjutan web ini bergantung pada tiga pilar:

1. Keandalan teknis: data tersimpan, layanan stabil, ada cadangan dan monitoring.
2. Kemampuan tim: kode mudah dipahami, ada dokumentasi, ada uji otomatis.
3. Kepemilikan dan biaya: siapa yang merawat, dengan biaya apa, dan seberapa mudah berpindah vendor.

## 2. Kondisi Teknis Saat Ini

### 2.1 Tumpukan teknologi

| Lapisan | Teknologi | Versi |
| --- | --- | --- |
| Kerangka UI | React | 19.2 |
| Kerangka aplikasi | TanStack Start (SSR) | 1.168 |
| Routing | TanStack Router | 1.170 |
| Build | Vite | 8.1 |
| Gaya | Tailwind CSS | 4.2 |
| Komponen | shadcn/ui di atas Radix | sesuai shadcn |
| Server runtime | Nitro (preset node-server untuk Docker) | 3.0 beta |
| Validasi | Zod | 3.25 |
| Uji | Vitest + Testing Library | 4.1 |
| Kontainer | Docker multi-stage, port 3050 | - |
| CI/CD | Jenkins (lint, test, build, smoke test dalam Docker) | - |

Seluruh kode berbahasa TypeScript, antarmuka Bahasa Indonesia.

### 2.2 Ukuran dan bentuk kode

- Modul aturan bisnis murni: `src/lib/smartpro-data.ts` (222 baris) berisi tipe data dan fungsi perhitungan sewa.
- Komponen aplikasi utama: `src/components/smartpro/smartpro-app.tsx` (sekitar 3200 baris). Ini satu berkas besar yang menampung katalog, keranjang, checkout, dan seluruh panel admin.
- Uji otomatis: 5 uji (aturan rental dan pencocokan rute).
- Dokumentasi: `PRD.md`, `design.md`, `AGENTS.md`, `roadmap.md`.

### 2.3 Apa yang sudah berjalan

- Katalog dengan filter, pencarian, dan ketersediaan per tanggal.
- Perhitungan harga: durasi, promo sewa 2 gratis 1, diskon VIP 15 persen.
- Keranjang, add-on, tukar poin, penawaran harga (RAB) siap cetak A4.
- Checkout bertahap dengan KYC dan tanda tangan digital.
- Panel admin: jadwal, verifikasi KYC, inventaris, pelacakan aset QR, mitra VIP.
- Build produksi ke server Node mandiri lewat Docker, dengan healthcheck.
- Pipeline Jenkins yang menjalankan lint, uji, build, dan smoke test di dalam Docker.

### 2.4 Batasan penting hari ini

- Tidak ada backend maupun basis data. Data hidup di memori dan kembali ke nilai awal saat halaman dimuat ulang.
- Tidak ada autentikasi. Panel admin terbuka tanpa login.
- Pembayaran, WhatsApp, dan pengingat bersifat simulasi.
- Poin loyalitas dan riwayat booking tidak tersimpan permanen.
- Satu berkas komponen sangat besar, sehingga perubahan berisiko dan sulit dites per bagian.
- Uji otomatis minim (5 uji), belum mencakup alur UI.

## 3. Risiko Keberlanjutan

Risiko dinilai dari dampak ke operasi dan kemudahan mitigasi. Skala: Tinggi, Sedang, Rendah.

| Risiko | Dampak | Skala | Mitigasi |
| --- | --- | --- | --- |
| Data hilang saat reload | Booking, KYC, poin pelanggan tidak persisten | Tinggi | Tambah backend dan basis data |
| Tidak ada autentikasi | Siapa pun bisa membuka panel admin | Tinggi | Tambah login dan peran pengguna |
| Satu berkas komponen raksasa | Perubahan lambat, rawan regresi | Tinggi | Pecah menjadi modul per domain |
| Uji minim | Perubahan tanpa jaring pengaman | Sedang | Tambah uji alur dan uji komponen |
| Dependensi beta (Nitro 3 beta) | Perubahan tak terduga antar rilis | Sedang | Sematkan versi, uji sebelum naik versi |
| Pembaruan dependensi manual | Rawan celah keamanan lama | Sedang | Jadwal pembaruan berkala, Dependabot |
| Tanpa monitoring | Gangguan tidak terdeteksi | Sedang | Tambah health check, log, alert |
| Tanpa cadangan | Kehilangan data tak bisa dipulihkan | Tinggi (setelah ada DB) | Cadangan berkala dan uji restore |
| Ketergantungan satu vendor CI | Sulit pindah | Rendah | Docker portabel, Jenkins hanya orkestrasi |
| Biaya server tak terduga | Tagihan membengkak | Rendah | Pantau pemakaian, tetapkan batas |

## 4. Peta Jalan Keberlanjutan

Disusun per fase. Setiap fase bernilai sendiri dan bisa dihentikan tanpa membatalkan hasil fase sebelumnya.

### Fase 1: Fondasi data dan keamanan (prioritas tertinggi)

- Tambah backend dan basis data (PostgreSQL) untuk produk, booking, KYC, poin, dan riwayat.
- Tambah autentikasi dan peran (pelanggan, admin, mitra VIP).
- Pindahkan aturan bisnis ke sisi server agar konsisten antara tampilan dan penyimpanan.
- Hasil: data persisten, akses admin terlindungi.

### Fase 2: Integrasi nyata

- Integrasi payment gateway (mis. QRIS dan transfer melalui penyedia resmi).
- Integrasi WhatsApp Business API untuk konfirmasi dan pengingat otomatis.
- Notifikasi email atau pesan untuk status booking dan KYC.
- Hasil: transaksi dan komunikasi tidak lagi simulasi.

### Fase 3: Kualitas dan perawatan

- Pecah `smartpro-app.tsx` menjadi modul per domain (katalog, keranjang, checkout, admin).
- Tingkatkan cakupan uji: alur checkout, KYC, perhitungan harga, otorisasi.
- Tambah pipeline yang memblokir merge bila uji gagal.
- Hasil: perubahan lebih cepat dan aman.

### Fase 4: Operasional dan observabilitas

- Monitoring uptime, log terpusat, dan alert.
- Cadangan basis data terjadwal dan prosedur restore yang diuji.
- Jalur staging terpisah dari produksi.
- Hasil: gangguan kecil terdeteksi dan dipulihkan cepat.

### Fase 5: Pertumbuhan

- Analitik penggunaan (halaman, konversi booking).
- Laporan operasional admin (utilisasi unit, pendapatan, keterlambatan kembali).
- Optimasi performa dan SEO.
- Hasil: dasar keputusan berbasis data.

## 5. Rekomendasi Arsitektur Jangka Panjang

- Pisahkan tiga lapisan: antarmuka (React), API (server functions atau REST), dan basis data (PostgreSQL).
- Simpan aturan bisnis di satu tempat di sisi server, lalu pakai ulang di klien untuk pratinjau.
- Gunakan migrasi basis data terversi agar skema bisa diubah dengan aman.
- Pertahankan Docker sebagai unit deploy portabel, sehingga bisa jalan di server sendiri, VPS, atau penyedia cloud mana pun.
- Simpan rahasia (kunci pembayaran, kredensial) di manajer rahasia, bukan di kode.

## 6. Strategi Pengujian dan Mutu

- Uji unit untuk aturan bisnis (sudah ada, perlu diperluas).
- Uji integrasi untuk API dan basis data.
- Uji alur end-to-end untuk checkout dan KYC.
- Pemeriksaan aksesibilitas otomatis (kontras, label, fokus).
- Aturan antislop diterapkan pada pekerjaan UI agar desain tidak jatuh ke pola generik.

## 7. Pemeliharaan dan Pembaruan

- Jadwal pembaruan dependensi bulanan, dengan uji sebelum naik versi.
- Sematkan versi dependensi yang masih beta (Nitro) dan uji setiap pembaruan.
- Perbarui dokumentasi (`PRD.md`, `design.md`) setiap ada perubahan perilaku.
- Catat keputusan teknis penting (ADR) agar tim baru memahami alasan.

## 8. Kepemilikan dan Serah Terima

- Kode berada di repositori Git yang dikendalikan klien.
- Docker memastikan aplikasi bisa dijalankan tanpa ketergantungan khusus satu vendor CI.
- Dokumentasi dan uji menjadi syarat serah terima agar vendor lain bisa melanjutkan tanpa ketergantungan pada pembuat awal.

## 9. Estimasi Biaya dan Sumber Daya (kualitatif)

Angka rupiah tidak dicantumkan karena bergantung pada penyedia dan skala. Komponen biaya yang perlu dianggarkan:

- Server aplikasi dan basis data (VPS atau cloud).
- Penyimpanan dokumen KYC (object storage).
- Payment gateway (biaya per transaksi).
- WhatsApp Business API (biaya per percakapan).
- Monitoring dan cadangan.
- Waktu pengembangan untuk Fase 1 sampai 5.

Setiap komponen di atas sebaiknya diminta penawaran resmi ke penyedianya sebelum komitmen.

## 10. Metrik Keberhasilan Keberlanjutan

- Ketersediaan layanan bulanan (uptime).
- Waktu pulih setelah gangguan.
- Waktu rata-rata menerapkan perbaikan atau fitur.
- Cakupan uji otomatis.
- Jumlah insiden keamanan dan data.
- Waktu onboarding anggota tim baru.

Nilai target disepakati bersama klien pada awal kontrak perawatan.

## 11. Pertanyaan untuk Klien

1. Skala awal yang ditargetkan: berapa booking per hari dan berapa pengguna admin.
2. Apakah data KYC harus disimpan atau cukup diverifikasi lalu dihapus (kepatuhan privasi).
3. Penyedia pembayaran dan WhatsApp yang sudah dipakai atau diinginkan.
4. Siapa yang merawat setelah serah terima: tim internal atau vendor.
5. Anggaran dan tenggat untuk Fase 1.

## 12. Penutup

Web SMartPro sudah membuktikan alur produk berjalan ujung ke ujung dalam bentuk prototipe. Langkah keberlanjutan yang paling menentukan adalah Fase 1: menambahkan basis data dan autentikasi. Tanpa itu, semua fitur lain tetap bersifat demonstrasi. Fase berikutnya menambah integrasi nyata, kualitas kode, operasional, lalu pertumbuhan. Dengan Docker dan dokumentasi yang ada, aplikasi ini sudah berada di jalur yang mudah dirawat dan mudah dipindahkan antar vendor.
