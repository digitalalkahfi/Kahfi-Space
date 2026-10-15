# Naik/turun per akun + halaman Detail Akun dengan grafik

Branch: `fitur/detail-per-akun-grafik` → `main` (dibuat dari `main` @ `2e9d70d`, sesudah PR #22).

Rancangan: `docs/DETAIL-PER-AKUN-GRAFIK.md`

## Ringkasan

1. **Naik/turun di tabel per akun** (`/gmv/affiliator`): di bawah GMV, Komisi, dan Upload setiap baris tampil `▲ x%` (hijau), `▼ x%` (merah), `= 0%`, `Baru`, atau `—` dibanding periode lalu. Hitungannya memakai `bandingkan()` dan rentang pembanding yang sama dengan kartu Metrik utama (`rentangPembanding()`, dipakai juga oleh `/gmv`). Ada pilihan urut baru **"Turun terbanyak"**.
2. **Nama akun bisa diklik**: dari `/gmv/affiliator` (periode ikut terbawa) dan dari **Kelola Akun** (`/grd/akun`).
3. **Halaman `/akun/[id]`**, dari atas ke bawah:
   - kepala akun (status, unit, PIC, level, minimum) dan tombol kembali ke halaman asal;
   - pemilih periode;
   - kartu ringkasan: GMV, Komisi (hanya bila boleh), Upload, Kepatuhan minimum, Hari lapor;
   - satu grafik bertab GMV · Komisi · Upload: garis periode ini (tebal) vs periode lalu (putus-putus), hari tanpa laporan digambar sebagai celah, dan garis batas minimum di tab Upload;
   - sorotan (GMV tertinggi, rata-rata per hari lapor, hari kerja di bawah minimum);
   - tabel hari demi hari (kartu di HP);
   - riwayat level.

Commit:
- `79e0303` naik/turun + nama akun bisa diklik
- `087e857` halaman `/akun/[id]` + kartu + grafik
- `f3b8fe0` tabel harian + sorotan + riwayat level + tautan dari Kelola Akun

## Database

**Tidak ada migrasi.** Halaman hanya membaca lewat klien biasa, jadi penjaganya adalah aturan yang sudah ada:

| Data | Dibaca lewat | Penjaga |
|---|---|---|
| Akun | `daftarAkun` (klien biasa) | RLS `accounts_baca` (0173). Tidak terbaca → 404 "Akun tidak ditemukan atau Anda tidak punya akses" |
| GMV & upload harian | `daily_reports` (tanpa kolom komisi) | RLS `daily_reports_baca` + kolom komisi terkunci (0210) |
| Komisi harian | **hanya** `komisi_akun(dari, sampai, akun)` | `boleh_lihat_komisi(akun)` (0212). RPC-nya **tidak dipanggil** bila tidak boleh, jadi tidak ada angka komisi yang dikirim ke browser |
| Hari kerja | `attendance` PIC dengan jam masuk | RLS absensi; definisinya sama dengan `kepatuhan_minimum_akun` |
| Riwayat level | `jejakLevel` yang sudah ada | `account_level_events` |

Tidak ada klien admin, fungsi baru, maupun grant baru.

## Berkas utama

- `src/lib/gmv.ts`: `rentangPembanding()`, rentang pembanding bersama `/gmv` dan `/gmv/affiliator`.
- `src/lib/akun-affiliator.ts`: `perubahan()`, `denganPembanding()`, urut "Turun terbanyak".
- `src/components/gmv/tabel-akun-affiliator.tsx`: tampilan naik/turun dan tautan nama akun.
- `src/lib/detail-akun.ts`: aturan murni halaman (status hari, ringkasan, sorotan, rentang dan titik grafik, baris tabel harian).
- `src/lib/data/detail-akun.ts`: `akunTerbuka`, `bolehLihatKomisiAkun`, `hariAkun` (khusus server).
- `src/app/akun/[id]/page.tsx` dan `not-found.tsx`.
- `src/components/akun/*`: kartu, grafik, sorotan, tabel harian, riwayat level.
- `src/components/shared/grafik-banding.tsx`: titik kosong (celah), titik tunggal, penanda "tidak lapor". Tetap tanpa library baru.
- `src/components/grd/daftar-akun.tsx`: nama akun menjadi tautan.
- `src/lib/data/kepatuhan.ts`: **mode demo saja**. Kepatuhan demo kini berhenti di H-1 seperti fungsi database (0207), supaya angka demo cocok dengan halaman baru.

## Hasil Acceptance Criteria

| AC | Hasil | Bukti |
|---|---|---|
| 1. Naik/turun GMV, komisi, upload dengan `bandingkan()` yang sama | ✅ | unit `akun-affiliator.test.ts`; preview Manager |
| 2. "Baru" / "—" | ✅ | unit `perubahan()` |
| 3. Klik nama → `/akun/[id]` periode sama | ✅ | preview: tautan membawa `periode/acuan/dari/sampai` |
| 4. Total GMV kartu = tabel, selisih 0 | ✅ | schema `detail-akun.test.mjs` (3 akun, juga komisi); preview: Rp 89,3 Jt / Rp 9,2 Jt / 69 sama persis |
| 5. Leader tanpa akses komisi: GMV/upload sama, tanpa komisi | ✅ | schema test (Leader Affiliator Dewi): akun unitnya terbaca, angka sama dengan Manager, `komisi_akun` kosong, absensi PIC terbaca |
| 6. Staff akses "akun yang dia pegang": komisi sendiri ya, akun lain 404 | ✅ | schema test |
| 7. Staff buka akun orang lain → 404 | ✅ | schema test + preview persona Staff |
| 8. Hari kerja tanpa laporan = celah "tidak lapor", status "Tidak lapor" | ✅ | unit test + preview |
| 9. Harian 14 hari; Tahunan per bulan | ✅ | unit test + preview |
| 10. Garis batas minimum di tab Upload | ✅ | preview |
| 11. Nyaman di HP tanpa geser ke samping | ✅ | preview 375 px: lebar halaman = lebar layar, tabel menjadi kartu |
| 12. Test lama tetap lulus | ✅ | lihat Pemeriksaan |

Pengecekan preview (mode demo):
- **Manager**: semua bagian tampil, termasuk Komisi.
- **Staff PIC (Rian)**: akunnya sendiri tampil tanpa satu pun kata "komisi" di HTML halaman; akun Nabila menghasilkan 404.
- **Leader**: persona demo Leader adalah Dimas (TAP), dan akun Affiliator menghasilkan 404 sesuai `accounts_baca`. Mode demo tidak bisa memilih Leader Affiliator, jadi AC 5 dibuktikan lewat schema test sebagai Dewi Lestari. Tampilan tanpa komisi memakai jalur kode yang sama dengan Staff.
- Desktop dan lebar HP (375 px).

## Pemeriksaan

- Unit test: 1060 lulus, 0 gagal.
- Typecheck (`tsc --noEmit`): bersih.
- Lint (`eslint`, tanpa `.tmp/`): bersih.
- Build produksi: lulus.
- Schema test `detail-akun`: 8/8 lulus.
- Schema test lengkap: 129 dari 130 berkas lulus. Satu-satunya yang gagal, `tanggal-wajib-tugas.test.mjs` ("data lama: to-do tanpa tenggat diisi 23:59 WIB"), adalah kegagalan lama yang juga gagal di `main` dan tidak menyentuh berkas PR ini.

## NEEDS MANAGER DECISION — ✅ disetujui Manager (15 Okt 2026)

Untuk hal-hal di bawah, dipilih opsi paling aman (paling sedikit membuka komisi, paling setia pada aturan yang ada). Ketujuhnya sudah disetujui Manager:

1. **Status harian hanya menilai hari kerja.** Laporan pada hari PIC tidak absen masuk berstatus "Terlapor" (tidak dinilai), bukan "Memenuhi" atau "Di bawah minimum". Dasarnya sama dengan `kepatuhan_minimum_akun`, sehingga tabel, sorotan, dan kartu Kepatuhan selalu sepakat. Status "Terlapor" juga dipakai untuk akun tanpa level, dan diberi keterangan di bawah tabel.
2. **Batas minimum di tabel harian memakai level saat ini**, bukan level pada tanggal itu. Ini sama dengan penilaian kepatuhan yang ada. Riwayat level ditampilkan di bawahnya untuk konteks.
3. **Garis batas minimum hanya pada grafik per hari.** Pada grafik per bulan (rentang lebih dari 62 hari), jumlah sebulan tidak bisa dibandingkan dengan batas harian, jadi diganti satu kalimat keterangan.
4. **Hari kerja mengikuti absensi PIC yang terbaca oleh yang membuka.** Bagi peran yang tidak bisa membaca absensi PIC, hari tanpa laporan tampil sebagai "Libur/Izin", bukan "Tidak lapor". Kartu Kepatuhan tetap memakai angka dari database.
5. **Periode berjalan dibandingkan secara sepadan.** Bila periode ini belum selesai, misalnya bulan berjalan, pembandingnya dipotong sepanjang hari yang sama dan diberi label "(sepadan)". Ini meniru kartu Metrik utama.
6. **Baris "laporan tingkat unit" di `/gmv/affiliator` tidak bisa diklik** (E10). Baris itu bukan akun.
7. **Tabel harian menampilkan seluruh hari periode.** Untuk Tahunan, itu sampai sekitar 365 baris (tabel bergulir di desktop, daftar kartu panjang di HP). Belum ada paginasi.

## Langkah uji manual (sesudah deploy)

1. Masuk sebagai Manager, buka **GMV → kartu Affiliator → Lihat per akun**. Pastikan ada `▲/▼` di bawah GMV, Komisi, dan Upload.
2. Pilih urut **"Turun terbanyak"**. Akun dengan penurunan GMV terbesar harus ada di atas.
3. Klik satu nama akun. Halaman detail terbuka dengan periode yang sama, dan total GMV sama dengan di tabel.
4. Ganti tab grafik **GMV / Komisi / Upload**. Di tab Upload ada garis merah putus-putus untuk batas minimum.
5. Pilih **Harian**: grafik berisi 14 hari. Pilih **Tahunan**: titik per bulan.
6. Gulir ke **Sorotan**, **Hari demi hari**, dan **Riwayat level**.
7. Buka **GRD → Kelola Akun** dan klik nama akun. Halaman detail terbuka, dan tombol kembali menuju Kelola Akun.
8. Masuk sebagai Staff PIC tanpa akses komisi dan buka akunnya dari Kelola Akun. Tidak boleh ada kartu, tab, atau kolom Komisi.
9. Sebagai Staff yang sama, tempel alamat `/akun/<id akun orang lain>`. Harus muncul "Akun tidak ditemukan atau Anda tidak punya akses".
10. Buka halaman detail di HP. Tidak boleh ada geser ke samping, dan tabel harian tampil sebagai kartu.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
