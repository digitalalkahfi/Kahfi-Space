# Komisi wajib + kartu Komisi + detail per akun Affiliator

Branch: `fitur/komisi-detail-akun-affiliator` → **dibuat dari `fitur/daftar-google-persetujuan`** (memakai `anggota_aktif()` / `peran_saya()` aktif-saja dari 0208). Merge PR Google lebih dulu, atau arahkan PR ini ke branch itu. **Jangan di-merge sebelum diperiksa.**

Rancangan: `docs/KOMISI-DETAIL-AKUN-AFFILIATOR.md`

## Ringkasan

1. **Komisi rahasia** — kolom komisi dikunci di database. CEO/Manager melihat semua komisi; Staff hanya komisi laporan yang ia kirim sendiri; Leader, Co-Leader, dan Finance tidak melihat angka komisi apa pun (termasuk miliknya), tetapi tetap **mengisi** komisi.
2. **Komisi wajib** — laporan baru akun Affiliator wajib berisi komisi (boleh 0). Aturan "komisi ≤ GMV" dicabut, karena komisi real hari ini bisa berasal dari pesanan hari lain.
3. **Kartu "Komisi Affiliator"** di Metrik utama dasbor GMV — hanya CEO/Manager, dengan keterangan "x dari y laporan berisi komisi".
4. **Detail per akun Affiliator** (`/gmv/affiliator`) — dibuka dari tombol "Lihat per akun" di kartu Affiliator, hanya CEO/Manager.

Urutan commit sesuai §8: (1) `7791e68` kunci komisi + fungsi baca, (2) `dbefe0f` komisi wajib + cabut ≤ GMV, (3) `b9d5b5c` kartu Komisi, (4) halaman detail per akun (commit terakhir branch ini).

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
| Policy baru | `lead_measure_entries.lme_komisi_rahasia` (RESTRICTIVE, SELECT) | Entri lead measure bersumber komisi hanya terbaca CEO/Manager |

### `0211_komisi_wajib.sql`

| Jenis | Objek | Perubahan |
|---|---|---|
| Constraint dicabut | `daily_reports_komisi_tak_lebih_dari_gmv` | BR-K3 |
| Constraint tetap | `daily_reports_komisi_wajar` (0–10 miliar) | — |
| Fungsi + trigger baru | `wajib_komisi_affiliator()` / `daily_reports_wajib_komisi` (BEFORE INSERT) | Laporan **baru** akun Affiliator dengan komisi null ditolak: "Isi 0 kalau hari ini tidak ada komisi masuk." Tidak berlaku untuk seed/service role (tanpa sesi) dan jalur migrasi data lama |
| Fungsi | `migrasi_tulis_laporan(...)` | Sama seperti sebelumnya + penanda `app.laporan_lama` (E10) |

Tidak ada data komisi yang dipindahkan atau dihapus.

## Tempat yang tadinya menampilkan komisi, dan perlakuannya sekarang

| Tempat | Sebelum | Sekarang |
|---|---|---|
| Riwayat laporan (`/laporan-harian/riwayat`, `tabel-riwayat.tsx`) — kolom Komisi, "Total komisi", ekspor CSV | Siapa pun yang boleh melihat laporannya | Komisi dari `komisi_laporan()`. Leader/Co-Leader/Finance: kolom dan "Total komisi" tidak tampil. Staff: hanya laporannya sendiri. CEO/Manager: semua |
| Ringkasan riwayat di halaman Laporan Harian (`panel-laporan.tsx`) | Sama | Sama aturan di atas |
| Detail laporan (`/laporan-harian/riwayat/[id]`) | Angka komisi + jejak revisi komisi | Lewat `komisi_laporan()` dan `komisi_revisi()` |
| Dialog "Perbaiki laporan" (`dialog-revisi.tsx`) | Komisi lama terisi di kotak | Leader/Co-Leader: angka lama tidak tampil; komisi hanya dikirim bila dicentang "isi ulang", selain itu tidak diubah |
| Form Laporan Harian (`form-laporan.tsx`) | Komisi boleh kosong; ringkasan "terkirim" menyebut komisi | Komisi wajib (boleh 0). Ringkasan "terkirim" tidak menyebut komisi bagi Leader/Co-Leader |
| Kartu Capaian pribadi di Beranda (`capaian.ts`) | Komisi bagi semua departemen Affiliator | Hanya Staff (dari laporan yang ia kirim sendiri) |
| GRD — papan lead measure, rekap pekan, entri (`papan-lead-measure`, `rekap-pekan-lead`, `entri-lead-measure`) | Angka lead measure bersumber komisi terbaca semua | Selain CEO/Manager: "Rahasia" |
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

1. **Staff membaca komisi laporan yang ia KIRIM sendiri saja**, bukan seluruh laporan akun yang ia pegang bila dilaporkan orang lain. Akibatnya capaian pribadi Staff bisa tidak memuat komisi hari yang dilaporkan rekannya.
2. **GMV Rp 0 hanya sah bila ada komisi masuk** (AC2). GMV 0 dan komisi 0 tetap ditolak "GMV belum diisi." seperti sebelumnya.
3. **Leader/Co-Leader memperbaiki laporan**: komisi kosong = tidak diubah. Mereka bisa mengisi ulang komisi (centang), tetapi tidak melihat angka lama maupun barunya (E5).
4. **KPI dan WRM yang menjumlahkan lead measure.** Entri lead measure bersumber komisi kini tersembunyi bagi selain CEO/Manager, tetapi fungsi KPI security definer (mis. `realisasi_lead_measure_kpi`) masih bisa menghitung realisasi KPI dari lead measure itu bila ada indikator KPI yang bersumber darinya. Bila query di atas menghasilkan 0, tidak ada dampak. Bila tidak 0, perlu diputuskan apakah indikator KPI seperti itu juga dirahasiakan.
5. **Laporan tingkat unit Affiliator (tanpa akun)** ikut dihitung di kartu Komisi dan tampil di tabel per akun sebagai baris "Laporan tingkat unit", supaya total tabel = angka kartu Affiliator (AC7). Laporan seperti ini jarang ada.
6. **Kartu Affiliator**: kartu Metrik utama adalah tombol centang grafik, jadi detail per akun dibuka lewat tombol "Lihat per akun" di dalam kartu (tidak mengganti fungsi klik kartu).

## Hasil test per Acceptance Criteria

Test baru: `supabase/tests/komisi-rahasia.test.mjs` (15), `komisi-wajib.test.mjs` (7), `komisi-dasbor.test.mjs` (3), `src/lib/__tes__/akun-affiliator.test.ts` (6), tambahan di `laporan.test.ts` dan `gmv.test.ts`.

| AC | Hasil | Bukti |
|---|---|---|
| 1 | ✅ | Unit: `periksaKomisiWajib` → "Isi 0 kalau hari ini tidak ada komisi masuk."; DB: trigger menolak insert tanpa komisi |
| 2 | ✅ | Unit + DB: komisi Rp 50.000 dengan GMV Rp 0 tersimpan |
| 3 | ✅ | DB: Leader `select komisi` / `select *` → permission denied; GMV & upload bawahan tetap terbaca; preview: riwayat Leader tanpa kata "komisi" |
| 4 | ✅ | Halaman mengalihkan selain CEO/Manager sebelum memuat data (preview: Leader → `/gmv`, tanpa teks komisi); DB: `komisi_affiliator` menolak Leader/Co-Leader/Staff/Finance |
| 5 | ✅ | DB: Staff membaca komisi laporannya (bukan milik Staff lain); Leader yang mengisi komisi akunnya sendiri menerima kosong dari `komisi_laporan`, `komisi_laporan_saya`, dan capaian |
| 6 | ✅ | DB: jumlah `komisi_affiliator_harian` = jumlah komisi seluruh laporan Affiliator; "x dari y" menghitung laporan lama yang kosong |
| 7 | ✅ | Unit: total tabel termasuk laporan tingkat unit; preview: total GMV tabel Rp 394,1 Jt = kartu Affiliator, total komisi Rp 41,2 Jt = kartu Komisi |
| 8 | ✅ | Unit: akun aktif tanpa laporan tampil 0 dan ditandai "Tanpa laporan" |
| 9 | ✅ | Unit + DB: MCN/TAP tidak diwajibkan komisi, komisi tetap ditolak untuk MCN; preview: Co-Leader tanpa kartu/tautan |
| 10 | ✅ (dengan catatan) | `test:unit` 1044 lulus / 0 gagal. `db:test`: semua lulus kecuali `tanggal-wajib-tugas` yang juga gagal di `main` (bergantung tanggal hari ini) |

Test lama yang disesuaikan karena aturan sengaja berubah: `absen-pulang`, `alur-harian`, `laporan-harian`, `laporan-gmv-h-min-1`, `laporan-departemen` (laporan Affiliator kini menyertakan komisi; "komisi > GMV" kini diterima), `migrasi-gmv` (fungsi perbaikan mengembalikan id; komisi > GMV diterima).

Pemeriksaan lain: `typecheck` ✅ · `eslint` ✅ untuk kode repo · `build` ✅. Sudah gagal di `main` sebelum PR ini: `npm run lint` (berkas coretan lokal di `.tmp/`), `npm run ekspor:cek`.

## Urutan rilis

1. PR Google (`fitur/daftar-google-persetujuan`) dulu — PR ini bergantung padanya.
2. Database: `npx --yes supabase@2.118.0 db push --linked --dry-run`, lalu tanpa `--dry-run` (0210, 0211).
   - Kode lama yang masih berjalan sebentar sebelum deploy akan gagal membaca riwayat laporan (view kini tanpa komisi, kolom komisi terkunci). Deploy kode segera sesudah `db push`.
3. Merge → Vercel deploy.

**Rollback kunci komisi:** `grant select on daily_reports, daily_report_revisions to authenticated;` (data tidak pernah dipindahkan).

## Langkah uji manual untuk Manager

1. Masuk sebagai Manager, buka **Analitik GMV**. Di Metrik utama ada kartu **Komisi Affiliator** dengan tulisan "x dari y laporan berisi komisi".
2. Di kartu **Affiliator**, tekan **Lihat per akun**. Tabel per akun terbuka untuk periode yang sama; total GMV di atasnya sama dengan angka kartu Affiliator.
3. Tekan judul kolom (mis. Komisi) — urutan tabel berubah. Akun aktif yang belum melapor ditandai merah "Tanpa laporan".
4. Minta seorang Staff Affiliator mengirim laporan dengan kotak komisi dikosongkan — form menolak: "Isi 0 kalau hari ini tidak ada komisi masuk."
5. Minta ia mengisi GMV 0 dan komisi 50.000 — laporan tersimpan.
6. Staff itu membuka **Riwayat laporan** — komisinya sendiri terlihat.
7. Minta seorang Leader Affiliator membuka **Riwayat laporan** — GMV dan upload anggota terlihat, tetapi tidak ada kolom maupun "Total komisi".
8. Leader itu membuka **Analitik GMV** — tidak ada kartu Komisi dan tidak ada tombol "Lihat per akun". Bila ia membuka alamat `/gmv/affiliator`, ia dikembalikan ke dasbor.
9. Leader yang memegang akun mengirim laporannya — form tetap meminta komisi, tetapi setelah terkirim angkanya tidak tampil di ringkasan maupun riwayat.
10. Laporan unit MCN atau TAP — form tetap tanpa kolom komisi, seperti sebelumnya.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
