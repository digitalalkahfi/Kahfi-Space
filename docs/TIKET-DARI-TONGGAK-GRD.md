# Tiket dari tonggak GRD

Rencana operasional GRD (`grd_rencana` + `grd_tonggak`) otomatis menjadi tiket di
modul Tugas (`tasks`) untuk PIC-nya. Tim bekerja dari halaman **Tugas**; status
tonggak di **GRD › Rencana operasional** mengikuti tiketnya. Tidak ada lapor dua kali.

Migrasi: `0199`–`0202`. Kode: `src/lib/tiket-grd.ts`, `scripts/tiket-grd.mjs`.
Tes: `supabase/tests/tiket-grd.test.mjs` (aturan di database) dan
`src/lib/__tes__/tiket-grd.test.ts` (penyusun laporan & aturan tampilan).

## Aturan

| # | Aturan |
|---|---|
| 1 | Hanya tonggak rencana **SEKALI** dan **PEKANAN** jadi tiket. HARIAN tidak. |
| 2 | Satu tonggak = satu tiket (unik di `tasks.tonggak_id`). Penerima = `pic_ids[1]`; PIC lain ditulis namanya di deskripsi. |
| 3 | Pemberi = atasan langsung penerima (yang aktif). Tanpa atasan → Manager. Penerimanya Manager sendiri → CEO. Tak ada siapa pun → sama dengan penerima. Alur QC tidak diubah. |
| 4 | Tipe `tiket`, goal dari rencananya, judul `kode · judul tonggak` (+ judul rencana bila tonggaknya hanya bertanggal), tenggat = tenggat tonggak pukul 17.00 WIB, kriteria selesai disusun dari data rencana (pemberi boleh menajamkannya). |
| 5 | Tanpa tenggat / tanpa PIC terdaftar / PIC nonaktif → tidak dibuatkan tiket (dilaporkan beserta alasannya). |
| 6 | Status mengalir **tiket → tonggak**: todo→belum; berjalan/menunggu_qc/revisi→progress; selesai (QC lolos)→selesai. Waktu selesai tonggak = saat PIC **terakhir mengajukan** pemeriksaan (`tasks.diajukan_pada`), bukan saat QC meluluskan. |
| 7 | Tonggak yang punya tiket tidak bisa diubah manual; halaman Rencana menampilkan status + tautan "Buka tiket". Tonggak tanpa tiket tetap bisa dicentang seperti biasa. |
| 8 | Tenggat tiket GRD hanya boleh diubah CEO/Manager (termasuk yang bukan pemberi), dan ikut mengubah tenggat tonggak; sebaliknya tenggat tonggak yang diubah (mis. impor) membawa tiketnya. Tenggat yang sudah lewat tidak digeser saat tiket dibuat. |
| 9 | Tonggak selesai tidak dibuatkan tiket. Tonggak progress → tiket berjalan. |
| 10 | Aman diulang (tidak pernah dobel) dan berjalan otomatis di akhir `impor_grd`. |
| 11 | Bulan yang KPI-nya sudah dikunci tidak disentuh: tidak dibuatkan tiket, status tonggak tidak diubah tiketnya, tenggat tidak bisa digeser. |
| 12 | Pengingat tenggat 0113 tetap berlaku. Tiket dibuat serentak → **satu** notifikasi ringkasan per penerima (bukan satu per tiket); tiket yang lahir sudah lewat tenggat langsung ditandai sehingga tidak ada "Tenggat lewat" massal. |

Keputusan tambahan (Okt 2026): tiket GRD **tidak bisa dihapus** dari aplikasi
(impor berikutnya akan membuatnya lagi); tonggak yang hilang dari file → tiket
belum selesai **dibatalkan**, yang sudah selesai dibiarkan sebagai arsip; tiket GRD
tidak dihitung di komponen `tiket` KPI rumus jabatan (`realisasi_kpi`), karena
tonggaknya sudah dinilai lewat `tonggak_tepat_waktu` (rumus itu tidak diubah).

## Cara memakai

```bash
npm run grd:tiket                         # uji coba bulan berjalan (tidak menyimpan apa pun)
npm run grd:tiket -- --bulan=2026-10      # uji coba Oktober 2026
npm run grd:tiket -- --bulan=2026-10 --rinci       # + daftar tiket satu per satu
npm run grd:tiket -- --bulan=2026-10 --terapkan    # membuat tiketnya
```

GRD bulan berikutnya tidak perlu perintah ini: `impor-grd.mjs --terapkan` sudah
membuat tiketnya, dan uji cobanya (tanpa `--terapkan`) ikut menampilkan laporan tiket.

## Urutan rilis

1. Cadangkan `tasks` dan `grd_tonggak` (Supabase › Database › Backups, atau ekspor CSV dari Table Editor).
2. Migrasi database dulu: `npx --yes supabase@2.118.0 db push --linked --dry-run`, lalu tanpa `--dry-run`.
3. Baru kode (kode memilih kolom `tasks.tonggak_id`; tanpa migrasi, halaman Tugas gagal dimuat).
4. `npm run grd:tiket -- --bulan=2026-10` (uji coba), periksa laporannya, lalu `--terapkan`.

## Rollback

Per migrasi ada SQL kebalikan di komentar akhir tiap file (jalankan urut 0202 → 0199).
Tiket yang sudah terbuat tidak ikut terhapus oleh rollback: lepas tautannya
(`update tasks set tonggak_id = null where tonggak_id is not null`) dan hapus yang
tidak diinginkan sesudah rollback 0200.

## Hal yang sengaja belum diputuskan / perlu dipantau

- **QC yang lambat saat KPI dikunci.** Selama tiket menunggu QC, tonggaknya masih
  `progress`, jadi `tonggak_tepat_waktu` belum menghitungnya tepat. Pastikan QC selesai
  sebelum bulan dikunci. (Mengubah rumus agar pengajuan tepat waktu yang masih menunggu QC
  dihitung tepat adalah keputusan terpisah.)
- **Papan Tugas "Semua"** menampilkan semua tiket belum selesai dari tanggal mana pun,
  sehingga PIC dengan banyak tonggak pekanan (Okt 2026: sampai 26 tiket) melihatnya sekaligus.
- **PIC cadangan.** Bila kolom SIAPA berisi peran yang belum terdaftar ("Santri"),
  impor mengisi PIC dengan pemilik goal/Manager; tiketnya ikut ke orang itu. Laporan uji
  coba menandainya di bagian "Perlu diperiksa".
- Tiket yang sudah ada tidak dipindahkan otomatis bila PIC rencana berubah di impor
  berikutnya (dilaporkan di "Perlu diperiksa"); pemberi bisa mengganti penerimanya selama
  tiket masih To Do.
