# K-Space V2

Aplikasi manajemen tim internal Al-Kahfi Corp: absensi, tugas & QC, laporan
harian GMV, dan GRD (goal, lead measure, KPI, laporan mingguan WRM).

Seluruh antarmuka dan penamaan kode memakai bahasa Indonesia.

## Dua mode data

Aplikasi berjalan dalam salah satu dari dua mode, ditentukan otomatis oleh
variabel lingkungan:

| Mode | Syarat | Perilaku |
| --- | --- | --- |
| `supabase` | `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` terisi | Data nyata, Auth aktif, RLS menentukan apa yang terlihat |
| `demo` | salah satu kosong | Data contoh dari `supabase/seed/data.json`, tanpa penyimpanan |

Mode demo ada supaya aplikasi bisa dibuka dan ditinjau sebelum proyek
Supabase dibuat. Ia ditandai jelas di bilah atas, dan setiap aksi yang
mengubah data menolak dengan pesan yang menyebutkan alasannya — supaya
data contoh tidak pernah disangka data nyata.

Rumus dan aturan cakupan di kedua mode sengaja dijaga sama persis; setiap
aturan di `src/lib/data/*` punya padanan langsung di `supabase/migrations/*`.

## Menjalankan

```bash
npm install
npm run dev
```

Tanpa `.env.local`, aplikasi langsung berjalan dalam mode demo.

## Menyiapkan Supabase

1. Salin `.env.example` menjadi `.env.local`, isi URL dan kunci proyek.
2. Jalankan seluruh berkas di `supabase/migrations/` berurutan. Di
   dalamnya sudah termasuk data referensi organisasi — lima departemen,
   tiga unit pelaporan, program tiap unit, dan indikator KPI per jabatan —
   sehingga pemasangan tanpa data contoh pun langsung bisa dipakai.
3. Jalankan `supabase/seed.sql` **hanya** bila ingin data contoh berisi
   nama-nama karangan untuk mencoba aplikasi (idempoten, aman dijalankan
   ulang). Berkas ini dihasilkan dari `supabase/seed/data.json` lewat
   `npm run db:seed:sql` — sunting JSON-nya, bukan SQL-nya. Lingkungan
   sungguhan sebaiknya melewati langkah ini.
4. Untuk migrasi data lama, muat ekspor `kv_store` sistem lama ke tabel
   `kv_store_lama` (satu baris per pasangan kunci-nilai). Selama tabel itu
   kosong, layar Migrasi memakai berkas contoh di `supabase/migrasi/` dan
   menandainya apa adanya.
5. Jalankan `supabase/auth.sql` — menjembatani akun Supabase Auth ke tabel
   `users`, yang menjadi dasar seluruh policy RLS.
6. Jalankan `supabase/storage.sql` — bucket privat untuk selfie absensi.

Langkah 4 dan 5 terpisah dari migrasi karena skema `auth` dan `storage`
hanya ada di Supabase, sedangkan migrasi juga dijalankan di PostgreSQL
polos saat pengujian.

## Pengujian

```bash
npm run verify
```

Menjalankan berurutan: lint, pemeriksaan tipe, tes unit logika murni, tes
skema database, lalu build produksi.

Tes skema dijalankan di PostgreSQL sungguhan lewat
[PGlite](https://github.com/electric-sql/pglite) — setiap migrasi benar-benar
dieksekusi dan setiap policy RLS diuji sebagai peran `authenticated`, bukan
sekadar dibaca. `scripts/db-harness.mjs` meniru `auth.uid()` dan peran
Supabase agar policy berperilaku sama seperti di produksi.

> `next build` dan `next dev` berbagi direktori `.next`. Menjalankan
> `npm run verify` selagi server dev hidup membuat HTML yang dilayani tidak
> lagi cocok dengan bundel kliennya, dan gejalanya menyesatkan: galat
> hidrasi pada komponen yang sebenarnya benar. Hentikan server dev sebelum
> verifikasi, atau jalankan ulang setelahnya.

Perintah lain:

| Perintah | Kegunaan |
| --- | --- |
| `npm run db:cek` | Menjalankan seluruh migrasi dan memastikan setiap tabel mengaktifkan RLS |
| `npm run db:test` | Hanya tes skema & RLS (berkas yang dihentikan sistem diulang sekali) |
| `npm run test:unit` | Hanya tes unit logika murni |
| `npm run db:seed:sql` | Membuat ulang `supabase/seed.sql` dari `data.json` |

## Keuangan & Aset

Dua modul Rilis 2 ini memakai aturan yang mudah salah kalau ditulis ulang
di tempat lain, jadi masing-masing ditulis sekali dan diuji dua sisi —
sebagai fungsi murni di `src/lib` (dipakai layar) dan sebagai fungsi SQL
(dipakai basis data). Test skema membandingkan keduanya angka demi angka.

- **NPM dihitung terhadap net revenue**, bukan pendapatan kotor:
  pendapatan − direct cost − creator share. Inilah sebab NPM sistem lama
  selalu terlihat lebih bagus dari kenyataannya.
- **Pembelian aset tidak mengurangi laba**, hanya kas. Uangnya berpindah
  wujud menjadi barang yang lalu menyusut.
- **Kas baru bergerak pada status `dibayar`.** Pengajuan yang disetujui
  belum memindahkan sepeser pun.
- **Persetujuan naik ke CEO saat kas di bawah Rp 150 juta**, dan tidak
  seorang pun memutuskan pengajuannya sendiri (membayar bukan
  memutuskan). Posisi kas saat keputusan diambil ikut direkam di
  `transaction_approvals`, supaya keputusan lama bisa dinilai ulang
  dengan angka yang berlaku saat itu.
- **Status hanya berubah lewat jejaknya**: transaksi lewat
  `transaction_approvals`, aset lewat `asset_events`. Menyetelnya langsung
  ditolak trigger, sehingga keadaan dan riwayat tidak pernah berselisih.
- **Transaksi berjenis aset melahirkan asetnya sendiri** begitu dibayar
  (migrasi `0105`); barangnya lahir setengah jadi dan muncul di
  `aset_perlu_dilengkapi()` sampai kategori, masa manfaat, dan
  pemegangnya diisi.
- **Penyusutan garis lurus per bulan penuh**, berhenti di nilai residu —
  dan berhenti lebih awal bila asetnya dilepas atau hilang.

Angka rupiah hanya terbuka untuk Finance, Manager, dan CEO. Daftar
barangnya sendiri terbuka untuk semua lewat view `aset_publik` yang
memang tidak memuat kolom rupiah: mengetahui siapa memegang apa mencegah
barang hilang tanpa ada yang menyadari.

## Realtime

Kalender bersama menyiarkan perubahannya lewat Supabase Realtime. Tabel
`agenda` sudah didaftarkan ke publication `supabase_realtime` oleh
migrasi `0096`; pastikan Realtime aktif untuk proyeknya di dasbor
Supabase. RLS tetap berlaku pada siaran itu — setiap orang hanya menerima
baris yang memang boleh ia baca.

## Struktur

| Jalur | Isi |
| --- | --- |
| `src/app` | Rute App Router; `src/app/actions` berisi Server Action |
| `src/components` | Komponen UI, dikelompokkan per halaman |
| `src/lib/data` | Query dan aturan bisnis; hanya server (`server-only`) |
| `src/lib/*.ts` | Modul murni yang aman dipakai server maupun browser |
| `supabase/migrations` | Skema, fungsi, trigger, dan policy RLS |
| `supabase/tests` | Tes skema & RLS yang dijalankan di PGlite |
| `desain_ui_aplikasi_prd` | PRD dan referensi desain |
