# Komisi wajib + kartu Komisi + detail per akun Affiliator

Branch: `fitur/komisi-detail-akun-affiliator` → **dibuat dari `fitur/daftar-google-persetujuan`** (memakai `anggota_aktif()` / `peran_saya()` aktif-saja dari 0208). Merge PR Google lebih dulu, atau arahkan PR ini ke branch itu. **Jangan di-merge sebelum diperiksa.**

Rancangan: `docs/KOMISI-DETAIL-AKUN-AFFILIATOR.md`

## Ringkasan

1. **Komisi rahasia** — kolom komisi dikunci di database. **Mengisi** komisi dan **melihat** komisi adalah dua hak berbeda (K5): siapa pun yang melapor akun Affiliator wajib mengisi komisi, tetapi tidak otomatis melihatnya lagi. CEO/Manager melihat semua komisi.
2. **Akses lihat komisi per orang** (K6, §4.5) — CEO/Manager mengatur di kartu anggota (menu Tim) siapa yang boleh melihat komisi: **tidak ada** (bawaan), **akun yang dia pegang**, **akun tertentu**, atau **semua akun Affiliator**. Setiap perubahan tercatat di riwayat. Kartu total Komisi tetap hanya CEO/Manager (K7).
3. **Komisi wajib** — laporan baru akun Affiliator wajib berisi komisi (boleh 0). Aturan "komisi ≤ GMV" dicabut, karena komisi real hari ini bisa berasal dari pesanan hari lain.
4. **Kartu "Komisi Affiliator"** di Metrik utama dasbor GMV — hanya CEO/Manager, dengan keterangan "x dari y laporan berisi komisi".
5. **Detail per akun Affiliator** (`/gmv/affiliator`) — dibuka dari tombol "Lihat per akun" di kartu Affiliator, hanya CEO/Manager. Pemegang akses lihat melihat komisi akun dalam cakupannya di Kelola Akun dan riwayat laporan.

Commit: (1) `7791e68` kunci komisi + fungsi baca, (2) `dbefe0f` komisi wajib + cabut ≤ GMV, (3) `b9d5b5c` kartu Komisi, (4) `8e2b010` halaman detail per akun, (5) akses lihat komisi per orang (commit terakhir branch ini). Commit 5 ditambahkan sesudah dokumen rancangan direvisi (K5–K7, §4.5, AC 11–16); ia menggantikan aturan sementara di commit 1 "Staff melihat komisi laporannya sendiri". Urutan commit di §8 versi revisi sedikit berbeda karena keempat commit pertama sudah ada lebih dulu.

## Grant/revoke, fungsi, dan policy yang diubah

### `0210_kunci_komisi.sql`

| Jenis | Objek | Perubahan |
|---|---|---|
| REVOKE | `SELECT ON daily_reports FROM anon, authenticated` | Hak baca tingkat tabel dicabut |
| GRANT | `SELECT (semua kolom kecuali komisi) ON daily_reports TO authenticated` | Kolom lain tetap terbaca |
| REVOKE | `SELECT ON daily_report_revisions FROM anon, authenticated` | |
| GRANT | `SELECT (semua kolom kecuali komisi_lama, komisi_baru) ON daily_report_revisions TO authenticated` | |
| — | INSERT/UPDATE `daily_reports` | **Tidak diubah** — pelapor tetap bisa mengisi komisi |
| Fungsi baru | `boleh_lihat_komisi()` | CEO/Manager aktif |
| Fungsi baru | `komisi_laporan(uuid[])` | CEO/Manager: semua; Staff: laporan sendiri; lainnya: kosong |
| Fungsi baru | `komisi_laporan_saya(date, date)` | Komisi laporan sendiri — Staff saja (Leader/Co-Leader kosong) |
| Fungsi baru | `komisi_revisi(uuid[])` | Angka komisi di jejak revisi — CEO/Manager dan pelapor Staff |
| Fungsi baru | `komisi_affiliator(date, date)` | Komisi per akun Affiliator — CEO/Manager, selain itu galat 42501 |
| Fungsi baru | `komisi_affiliator_harian(date, date)` | Deret harian untuk kartu — CEO/Manager, selain itu galat 42501 |
| REVOKE EXECUTE | kelima fungsi `komisi_*` | dari `anon` |
| View | `riwayat_laporan_minimum` | Dibuat ulang **tanpa kolom komisi** (security_invoker tetap) |
| Fungsi | `perbaiki_laporan_harian(...)` | Mengembalikan **id** (dulu seluruh baris, termasuk komisi). Komisi kosong = **tidak diubah** |
| Fungsi | `capaian_pribadi_saya(date, date)` | Komisi diambil lewat `komisi_laporan_saya` (null bagi Leader/Co-Leader) |
| Policy baru | `lead_measure_entries.lme_komisi_rahasia` (RESTRICTIVE, SELECT) | Entri lead measure bersumber komisi hanya terbaca CEO/Manager (diperluas di 0212) |

Catatan: aturan "Staff membaca laporannya sendiri" di `komisi_laporan`, `komisi_laporan_saya`, dan `komisi_revisi` **diganti di 0212** — lihat di bawah.

### `0211_komisi_wajib.sql`

| Jenis | Objek | Perubahan |
|---|---|---|
| Constraint dicabut | `daily_reports_komisi_tak_lebih_dari_gmv` | BR-K3 |
| Constraint tetap | `daily_reports_komisi_wajar` (0–10 miliar) | — |
| Fungsi + trigger baru | `wajib_komisi_affiliator()` / `daily_reports_wajib_komisi` (BEFORE INSERT) | Laporan **baru** akun Affiliator dengan komisi null ditolak: "Isi 0 kalau hari ini tidak ada komisi masuk." Tidak berlaku untuk seed/service role (tanpa sesi) dan jalur migrasi data lama |
| Fungsi | `migrasi_tulis_laporan(...)` | Sama seperti sebelumnya + penanda `app.laporan_lama` (E10) |

### `0212_akses_lihat_komisi.sql`

| Jenis | Objek | Perubahan |
|---|---|---|
| Tipe baru | `cakupan_akses_komisi` | `pegangan` / `tertentu` / `semua` (tanpa baris = tidak ada) |
| Tabel baru | `akses_komisi` (`user_id` PK, `cakupan`, `diberi_oleh`, `diberi_pada`) | |
| Tabel baru | `akses_komisi_akun` (`user_id`, `account_id`) | Untuk cakupan "akun tertentu" |
| Tabel baru | `riwayat_akses_komisi` (`user_id`, `sebelum`, `sesudah`, `oleh`, `pada`) | Trigger `riwayat_akses_komisi_tetap` menolak UPDATE/DELETE |
| REVOKE | `ALL ON` ketiga tabel `FROM anon, authenticated` | Klien tidak menulis langsung |
| GRANT | `SELECT ON` ketiga tabel `TO authenticated` | Dibatasi policy di bawah |
| Policy baru | `akses_komisi_baca` | Pemiliknya sendiri, atau CEO/Manager aktif |
| Policy baru | `akses_komisi_akun_baca`, `riwayat_akses_komisi_baca` | CEO/Manager aktif |
| Policy baru | `gerbang_anggota_aktif` (RESTRICTIVE) di ketiga tabel | Sama dengan 0208 |
| Fungsi baru | `boleh_lihat_komisi(account_id)` | CEO/Manager aktif, atau akses lihat yang mencakup akun Affiliator itu. Penentu tunggal per akun |
| Fungsi baru | `akun_komisi_terlihat()` | Akun Affiliator yang terlihat pemanggil |
| Fungsi baru | `komisi_akun(dari, sampai, account_id?)` | Komisi per akun per hari, hanya akun yang terlihat (Kelola Akun) |
| Fungsi baru | `lead_komisi_terlihat(lead)`, `lead_komisi_terlihat_semua()` | Lead measure komisi terlihat bila SELURUH akun cakupannya terlihat |
| Fungsi baru | `atur_akses_komisi(user, cakupan, akun[])` | Satu-satunya jalan mengubah akses: memeriksa CEO/Manager aktif, memvalidasi akun Affiliator, menulis riwayat dalam transaksi yang sama (tanpa perubahan = tanpa riwayat) |
| Fungsi baru | `potret_akses_komisi(user)` | Penolong internal; EXECUTE dicabut dari klien |
| Fungsi diubah | `komisi_laporan`, `komisi_laporan_saya`, `komisi_revisi` | Kini mengikuti `boleh_lihat_komisi(account_id)`. **Tidak ada lagi jalur "laporan sendiri"** (§4.1 no. 3). Laporan tingkat unit (tanpa akun) hanya terbaca CEO/Manager |
| Policy diubah | `lead_measure_entries.lme_komisi_rahasia` | Ditambah `lead_komisi_terlihat(lead_measure_id)` |
| Tidak diubah | `boleh_lihat_komisi()`, `komisi_affiliator`, `komisi_affiliator_harian` | Kartu total & detail per akun tetap hanya CEO/Manager (K7) |
| REVOKE EXECUTE | fungsi baru di atas | dari `anon` |

Tidak ada data komisi yang dipindahkan atau dihapus.

## Tempat yang tadinya menampilkan komisi, dan perlakuannya sekarang

| Tempat | Sebelum | Sekarang |
|---|---|---|
| Riwayat laporan (`/laporan-harian/riwayat`, `tabel-riwayat.tsx`) — kolom Komisi, "Total komisi", ekspor CSV | Siapa pun yang boleh melihat laporannya | Komisi dari `komisi_laporan()`, hanya akun dalam akses lihat. Tanpa akses: kolom, "Total komisi", dan kolom ekspor tidak ada sama sekali. Dengan akses sebagian: sel akun di luar cakupan kosong (bukan 0, bukan "—"). CEO/Manager: semua |
| Ringkasan riwayat di halaman Laporan Harian (`panel-laporan.tsx`) | Sama | Sama aturan di atas |
| Detail laporan (`/laporan-harian/riwayat/[id]`) | Angka komisi + jejak revisi komisi | Lewat `komisi_laporan()` dan `komisi_revisi()` |
| Dialog "Perbaiki laporan" (`dialog-revisi.tsx`) | Komisi lama terisi di kotak | Akun di luar akses lihat (E11, BR-K6): kotak komisi kosong dengan keterangan "Angka tersimpan tidak ditampilkan. Ketik ulang angka yang benar bila perlu diperbaiki." Kosong = tidak diubah; angka yang diketik menggantikan penuh |
| Form Laporan Harian (`form-laporan.tsx`) | Komisi boleh kosong; ringkasan "terkirim" menyebut komisi | Komisi wajib (boleh 0). Ringkasan "terkirim" menyebut komisi hanya untuk akun dalam akses lihat |
| Kartu Capaian pribadi di Beranda (`capaian.ts`) | Komisi bagi semua departemen Affiliator | Hanya bila akses lihat mencakup akun yang ia pegang; angkanya hanya dari akun yang terlihat |
| Kelola Akun (`/grd/akun`, `daftar-akun.tsx`) | Tanpa komisi | Baru: "Komisi periode" per akun, hanya akun dalam akses lihat (AC11) |
| Kartu anggota (`/tim/[id]`) | — | Baru: bagian "Akses lihat komisi" + riwayat perubahannya, hanya CEO/Manager, untuk anggota selain CEO/Manager |
| GRD — papan lead measure, rekap pekan, entri (`papan-lead-measure`, `rekap-pekan-lead`, `entri-lead-measure`) | Angka lead measure bersumber komisi terbaca semua | "Rahasia" kecuali bagi CEO/Manager atau yang aksesnya mencakup seluruh akun lead measure itu |
| Alat migrasi data lama (`terapkan-migrasi.ts`) | SELECT komisi langsung; komisi > GMV dikosongkan | Komisi dibaca lewat `komisi_laporan()`; komisi tidak lagi dikosongkan |
| Dasbor GMV — kartu Komisi Affiliator (baru) | — | Hanya CEO/Manager |
| `/gmv/affiliator` (baru) | — | Hanya CEO/Manager; peran lain dialihkan ke `/gmv` sebelum data dimuat |

## Lead measure GRD yang bersumber komisi

- **Data contoh (seed): 0.**
- **Impor GRD (`src/lib/impor-grd.ts`) tidak pernah membuat lead measure bersumber komisi** — sumber yang dibuatnya hanya `jumlah_upload` atau manual. Lead measure bersumber komisi hanya mungkin dibuat manual oleh CEO/Manager.
- Angka produksi belum bisa saya baca dari sini (tidak ada akses query produksi). Jalankan di SQL Editor Supabase (baca-saja):

```sql
select count(*) from lead_measures where sumber_laporan = 'komisi';
```

## NEEDS MANAGER DECISION

Opsi yang dipilih selalu yang paling sedikit membuka komisi.

1. **Mengubah akses hanya lewat fungsi `atur_akses_komisi`**, tidak dengan menulis tabel langsung — termasuk bagi CEO/Manager. Dokumen menyebut CEO/Manager "boleh menulis" tabel akses; dengan cara ini setiap perubahan pasti tercatat di riwayat (AC16).
2. **Bagian "Akses lihat komisi" tidak ditampilkan untuk anggota berperan CEO/Manager**, karena mereka selalu melihat semua komisi (K6). Fungsi database tetap menerima pengaturan untuk siapa pun.
3. **"Akun yang dia pegang" = akun dengan dia sebagai PIC**, tidak termasuk akun yang ia dampingi sebagai co-leader.
4. **Lead measure GRD bersumber komisi** terlihat bila akses lihat mencakup SELURUH akun lead measure itu (akun terdaftar, atau semua akun unit goal-nya). Bila sebagian saja, tetap "Rahasia".
5. **Menonaktifkan anggota ikut melepas PIC akunnya** (perilaku yang sudah ada). Akibatnya, setelah diaktifkan lagi, akses "akun yang dia pegang" baru berlaku lagi setelah PIC-nya dipasang ulang.
6. **GMV Rp 0 hanya sah bila ada komisi masuk** (AC2). GMV 0 dan komisi 0 tetap ditolak "GMV belum diisi." seperti sebelumnya.
7. **KPI dan WRM yang menjumlahkan lead measure.** Entri lead measure bersumber komisi kini tersembunyi bagi yang tidak berhak, tetapi fungsi KPI security definer (mis. `realisasi_lead_measure_kpi`) masih bisa menghitung realisasi KPI dari lead measure itu bila ada indikator KPI yang bersumber darinya. Bila query di atas menghasilkan 0, tidak ada dampak. Bila tidak 0, perlu diputuskan apakah indikator KPI seperti itu juga dirahasiakan.
8. **Laporan tingkat unit Affiliator (tanpa akun)** ikut dihitung di kartu Komisi dan tampil di tabel per akun sebagai baris "Laporan tingkat unit", supaya total tabel = angka kartu Affiliator (AC7). Komisinya hanya terbaca CEO/Manager. Laporan seperti ini jarang ada.
9. **Kartu Affiliator**: kartu Metrik utama adalah tombol centang grafik, jadi detail per akun dibuka lewat tombol "Lihat per akun" di dalam kartu (tidak mengganti fungsi klik kartu).

## Hasil test per Acceptance Criteria

Test baru: `supabase/tests/komisi-rahasia.test.mjs` (15), `akses-komisi.test.mjs` (15), `komisi-wajib.test.mjs` (7), `komisi-dasbor.test.mjs` (3), `src/lib/__tes__/akun-affiliator.test.ts` (6), `komisi.test.ts` (3), tambahan di `laporan.test.ts` dan `gmv.test.ts`.

| AC | Hasil | Bukti |
|---|---|---|
| 1 | ✅ | Unit: `periksaKomisiWajib` → "Isi 0 kalau hari ini tidak ada komisi masuk."; DB: trigger menolak insert tanpa komisi |
| 2 | ✅ | Unit + DB: komisi Rp 50.000 dengan GMV Rp 0 tersimpan |
| 3 | ✅ | DB: Leader `select komisi` / `select *` → permission denied; GMV & upload bawahan tetap terbaca; preview: riwayat Leader tanpa kata "komisi" |
| 4 | ✅ | Halaman mengalihkan selain CEO/Manager sebelum memuat data (preview: Leader → `/gmv`, tanpa teks komisi); DB: `komisi_affiliator` menolak Leader/Co-Leader/Staff/Finance |
| 5 | ✅ | DB: pelapor tanpa akses (Staff maupun Leader) menerima kosong dari `komisi_laporan`, `komisi_laporan_saya`, `komisi_revisi`, dan capaian; kolom komisi langsung → permission denied; unit: kolom & "Total komisi" tidak tampil |
| 6 | ✅ | DB: jumlah `komisi_affiliator_harian` = jumlah komisi seluruh laporan Affiliator; "x dari y" menghitung laporan lama yang kosong |
| 7 | ✅ | Unit: total tabel termasuk laporan tingkat unit; preview: total GMV tabel Rp 394,1 Jt = kartu Affiliator, total komisi Rp 41,2 Jt = kartu Komisi |
| 8 | ✅ | Unit: akun aktif tanpa laporan tampil 0 dan ditandai "Tanpa laporan" |
| 9 | ✅ | Unit + DB: MCN/TAP tidak diwajibkan komisi, komisi tetap ditolak untuk MCN; preview: Co-Leader tanpa kartu/tautan |
| 10 | ✅ (dengan catatan) | `test:unit` 1047 lulus / 0 gagal. `db:test`: semua lulus kecuali `tanggal-wajib-tugas` yang juga gagal di `main` (bergantung tanggal hari ini) |
| 11 | ✅ | DB: cakupan "akun yang dia pegang" → hanya kedua akun Rian lewat `komisi_laporan`, `komisi_akun`, dan capaian; E12: akun dipindah PIC → hilang termasuk riwayat lama; preview: Kelola Akun menampilkan "Komisi periode" hanya untuk akun yang terlihat |
| 12 | ✅ | DB: "akun tertentu" A & B → hanya A & B lewat `komisi_laporan` dan `komisi_akun`; E13: akun yang dinonaktifkan tetap terbaca |
| 13 | ✅ | DB: "semua" → enam akun Affiliator terbaca; `komisi_affiliator` dan `komisi_affiliator_harian` tetap menolak |
| 14 | ✅ | DB: Leader Affiliator yang memegang akun sendiri, tanpa akses → tidak menerima komisi apa pun |
| 15 | ✅ | DB: Leader & Staff memanggil `atur_akses_komisi` (untuk orang lain maupun dirinya) → "Hanya CEO atau Manager…"; INSERT/UPDATE langsung ke `akses_komisi` ditolak (juga bagi Manager); preview: bagian akses tidak tampil bagi Leader |
| 16 | ✅ | DB: pemberian → perubahan → pencabutan menghasilkan 3 baris riwayat (sebelum, sesudah, oleh, pada); penyimpanan tanpa perubahan tidak dicatat; riwayat tidak bisa dihapus dan hanya terbaca CEO/Manager |

Test lama yang disesuaikan karena aturan sengaja berubah: `komisi-rahasia` (commit 5: pelapor tanpa akses tidak lagi membaca komisinya sendiri), `absen-pulang`, `alur-harian`, `laporan-harian`, `laporan-gmv-h-min-1`, `laporan-departemen` (laporan Affiliator kini menyertakan komisi; "komisi > GMV" kini diterima), `migrasi-gmv` (fungsi perbaikan mengembalikan id; komisi > GMV diterima).

Pemeriksaan lain: `typecheck` ✅ · `eslint` ✅ untuk kode repo · `build` ✅. Sudah gagal di `main` sebelum PR ini: `npm run lint` (berkas coretan lokal di `.tmp/`), `npm run ekspor:cek`.

## Urutan rilis

1. PR Google (`fitur/daftar-google-persetujuan`) dulu — PR ini bergantung padanya.
2. Database: `npx --yes supabase@2.118.0 db push --linked --dry-run`, lalu tanpa `--dry-run` (0210, 0211, 0212).
   - Kode lama yang masih berjalan sebentar sebelum deploy akan gagal membaca riwayat laporan (view kini tanpa komisi, kolom komisi terkunci). Deploy kode segera sesudah `db push`.
3. Merge → Vercel deploy.

4. Sesudah rilis, belum ada yang punya akses lihat komisi selain CEO/Manager. Berikan akses lewat menu Tim → kartu anggota → **Akses lihat komisi**.

**Rollback kunci komisi:** `grant select on daily_reports, daily_report_revisions to authenticated;` (data tidak pernah dipindahkan).

## Langkah uji manual untuk Manager

1. Masuk sebagai Manager, buka **Analitik GMV**. Ada kartu **Komisi Affiliator** dengan tulisan "x dari y laporan berisi komisi". Tekan **Lihat per akun** di kartu Affiliator — total GMV tabel sama dengan angka kartu Affiliator.
2. Minta seorang Staff Affiliator mengirim laporan dengan kotak komisi kosong — form menolak: "Isi 0 kalau hari ini tidak ada komisi masuk." Lalu GMV 0 dan komisi 50.000 — tersimpan.
3. Staff itu membuka **Riwayat laporan** — tidak ada kolom maupun "Total komisi" (belum diberi akses).
4. Buka **Anggota tim** → kartu Staff itu → **Akses lihat komisi** → pilih **Akun yang dia pegang** → **Simpan akses**. Di bawahnya muncul riwayat perubahan.
5. Staff itu memuat ulang **Riwayat laporan** dan **Kelola Akun** — komisi akun yang ia pegang tampil, akun lain tidak.
6. Ubah aksesnya menjadi **Akun tertentu**, centang dua akun lain, simpan — kini hanya kedua akun itu yang tampil komisinya.
7. Ubah menjadi **Semua akun Affiliator** — semua akun tampil, tetapi di Analitik GMV tetap tidak ada kartu Komisi maupun "Lihat per akun".
8. Kembalikan ke **Tidak ada**. Riwayat perubahan mencatat keempat langkah, lengkap dengan nama Anda dan waktunya.
9. Masuk sebagai Leader Affiliator: buka kartu anggota mana pun — bagian **Akses lihat komisi** tidak ada. Bila ia memegang akun, komisinya pun tidak tampil.
10. Laporan unit MCN atau TAP — form tetap tanpa kolom komisi, seperti sebelumnya.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
