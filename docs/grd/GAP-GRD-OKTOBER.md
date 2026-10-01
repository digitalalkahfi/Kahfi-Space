# GAP GRD Oktober 2026 — K-Space V2

Audit Tahap 0, 1 Oktober 2026. Tidak ada kode yang diubah.

**Sumber kebenaran:** `docs/grd/GOALS-OKTOBER-2026-revisi_1.xlsx`. Sheet yang dipakai: GOAL,
GRD Cascade, KPI Manager (Kholid), KPI Leader, KPI Tim, dan Target & Kurva WRM. Sheet "Contoh KPI"
dan "Sheet1" diabaikan.

**Yang diperiksa:**
- seluruh sel dan rumus keenam sheet di atas;
- migrasi goal, lead measure, KPI, batas minimum, metrik departemen, dan laporan mingguan
  (0006, 0008, 0022–0036, 0039, 0063–0067, 0069, 0125–0130, 0136–0139, 0149, 0169, 0173, 0177,
  0178, 0185);
- `src/lib/kpi.ts`, `src/lib/goal.ts`, `src/lib/wrm.ts`, komponen `src/components/grd/*`;
- isi database produksi, dibaca **read-only** lewat kunci service-role dari `.env.local`, dengan cara
  yang sama seperti skrip admin di repo. Tidak ada nilai rahasia yang dicetak, dan tidak ada data yang
  ditulis.

---

## 1. Ringkasan

1. **Rumus skor berbeda dari GRD.** Aplikasi memakai interpolasi lurus tiga titik
   (base = 500, goal = 800, stretch = 1.000), lalu mengambil rata-rata tertimbang. GRD memakai tangga
   10 kolom: VALUE 0–10 × bobot. Angkanya hanya sama tepat di titik GOAL dan STRETCH. Pada kombinasi
   98% / 98% / tonggak 100%, GRD memberi **760 (Baik)**, sedangkan aplikasi memberi
   **808 (Istimewa)**. Predikatnya ikut berbeda.
2. **KPI hanya bisa didefinisikan per jabatan (`users.role`), bukan per orang atau per periode.**
   Kelima Leader GRD punya indikator berbeda-beda, dan hal ini mustahil diwakili sekarang. Indikator
   sumber `manual` juga tidak pernah dinilai: `realisasi_kpi` mengembalikan NULL untuknya.
3. **Goal secara praktis hanya mengenal Rupiah.** Kolom `satuan` memang ada, tetapi seluruh
   perhitungan progres mengambil GMV dari laporan harian, apa pun satuannya. Goal "15 seller" akan
   tampil dengan realisasi berupa GMV. Base yang tidak berupa angka ("belum diukur", "sebagian") juga
   tidak bisa disimpan.
4. **Rencana Operasional belum ada wadahnya.** Tonggak bisa ditiru dengan Tugas (tenggat +
   `selesai_at`), tetapi tidak ada indikator "tonggak tepat waktu %". Lead measure hanya punya satu
   target mingguan tetap, dan sumber dari laporan hanya bisa per unit, bukan per kelompok akun.
5. **Kurva kumulatif per Sabtu tidak muat di anak tangga.** `goal_months` unik per (goal, bulan),
   dan target hariannya prorata rata. Laporan mingguan aplikasi juga berbeda dari GRD dalam tiga hal:
   pekannya Senin–Minggu, ambangnya 95%, dan **matriks keputusannya tertukar dengan DECISION-021**.
   Aplikasi menulis hasil hijau + kegiatan merah = SABAR, sedangkan file menulis ALARM.
6. **Laporan harian belum memuat tiga hal yang diminta GRD:** GMV LIVE (dipisah dari GMV video), jam
   LIVE, dan jumlah produk diriset. Akibatnya 8 dari 67 indikator KPI menunggu kolom baru, dan
   18 lainnya memang harus diisi penilai (lihat §4f).
7. **Data GRD di database belum ada.** Yang ada hanya 5 goal yang diketik tangan pada 27–28 Sep.
   Periodenya "26 Sep – 25 Okt" dan angkanya berbeda dari file: perusahaan Rp 32,0 M (file Rp 32,2 M),
   eksternal Rp 27,9 M (file Rp 26,9 M). Belum ada lead measure, snapshot KPI, maupun laporan WRM.
   15 definisi KPI yang ada adalah data referensi generik dari migrasi 0069.

---

## 2. Status tiap bagian GRD

Keterangan: ✅ sudah didukung · 🟡 didukung sebagian · ❌ belum didukung · ⚠️ ada tetapi **berbeda**
dari file.

| Bagian GRD | Status | Bukti | Catatan |
| --- | --- | --- | --- |
| Goal perusahaan (Rp, base, target) | 🟡 | `goals` level `company` — `0006_goal_target.sql:13` | Struktur cukup. Isi di DB berbeda dari file (§4g). |
| 2 goal Manager (Blok Internal / Eksternal) | 🟡 | `gmv_goal_rentang` — `0178_periode_tanggal_goal.sql:158` | Goal Manager tanpa unit dihitung dari GMV **seluruh perusahaan**, sehingga Internal dan Eksternal tidak bisa dipisah. Blok Internal mencakup dua unit (Affiliator + TAP), sedangkan goal hanya punya satu `unit_id`. |
| 11 goal Leader | 🟡/❌ | `0178:158`, `0006:22` | Goal Rupiah per unit bisa. Lingkup sebagian akun (LIVE, 8 akun berkembang, 7 akun utama, 6 santri) belum bisa. Goal non-Rupiah (1.1.5, 1.1.6, 1.2.1, 1.2.3–1.2.5) belum bisa (§4c). |
| 5 goal staf pendukung (SOP, %, pengingat) | ❌ | `0006:23` (`target_base numeric not null`) | Base tidak berupa angka, satuannya %/SOP, dan realisasinya dibaca sebagai GMV. |
| Target per akun (Target & Kurva A) | 🟡 | `goals.account_id`, `target_harian_akun` — `0178` | GMV per akun bisa. GMV LIVE vs di luar LIVE untuk akun yang sama belum bisa. Target video/hari per akun belum ada; yang ada hanya minimum per level. 10 dari 21 akun belum terdaftar (§6). |
| Cek patungan (Σ goal Leader vs goal Manager) | ❌ | `src/components/grd/pohon-goal.tsx` | Pohon goal menampilkan turunan, tetapi tidak menjumlah dan tidak menampilkan selisih atau cadangan. |
| Rencana Operasional (GRD Cascade, ±85 baris) | ❌ | — | Tidak ada entitas. Pembagian bentuknya: §4d. |
| Tonggak Manager M.1–M.9 | ❌ | `tasks.tenggat`, `tasks.selesai_at` — `0009_tugas.sql:31` | Bisa ditiru dengan Tugas, tetapi belum terhubung ke KPI. |
| KPI skala 1.000 per orang (13 lembar + 3 templat) | ⚠️ | `skor_kpi` — `0024_kpi.sql:62`; `hitung_kpi` — `0173_akses_hierarki.sql:378` | Skala 1.000 sudah ada, tetapi rumus, struktur tangga, cakupan per orang, dan isian manual berbeda (§4a, §4b). |
| Predikat (≥800 / 650–799 / 500–649 / <500) | ✅ | `predikat_dari_skor` — `0024:41`; `predikatDariSkor` — `src/lib/kpi.ts:68` | Ambangnya sama. Status "BELUM DIISI" belum ada. |
| Riwayat bulanan ("duplikat sheet tiap bulan") | ✅ | `kpi_snapshots` + trigger `jaga_snapshot_terkunci` — `0024:89,108`; `kunci_kpi_bulan` — `0063` | Snapshot terkunci final. Saat ini belum ada satu bulan pun yang terkunci. |
| Penilai berjenjang (CEO → Manager → Leader → Co-Leader → Tim) | 🟡 | `boleh_orang`, `bawahan_saya` — `0173` | Hierarki baca sudah ada. Alur penilai mengisi PENCAPAIAN belum ada. Atasan di DB berbeda dari file untuk Agnes, Bilqis, dan Rifal (§6). |
| Standar video harian per level | 🟡 | `batas_minimum_level` — `0136:32`; `kepatuhan_minimum_akun` — `0138:21` | Level 0–6 sama. Level 7: file ">20", aplikasi 20. Level 8 hanya ada di aplikasi. Standar per orang (Bilqis 30) bukan level. |
| Kurva mingguan kumulatif per Sabtu | ❌ | `goal_months unique (goal_id, bulan)` — `0006:92` | §4e |
| Matriks keputusan WRM (DECISION-021) | ⚠️ | `keputusan_wrm` — `0025_laporan_mingguan.sql:27-28`; `keputusanWrm` — `src/lib/wrm.ts:81`; `matriks-wrm.tsx:19,22` | SABAR dan ALARM **tertukar**. Ambang hasil 95% (file: aktual ≥ target). Pemicu UBAH CARA (merah 2 pekan berturut-turut) belum ditegakkan. Pekannya Senin–Minggu tidak kumulatif — `0067:115`. |
| Laporan harian (video, jam LIVE, produk diriset, ≤ 21.00) | 🟡 | `daily_reports.jumlah_upload` — `0125:14-15`; `submitted_at` — `0005` | Video dan jam kirim sudah ada. Jam LIVE, GMV LIVE, dan produk diriset belum ada. |
| Leaderboard | 🟡 | `scorecard_tim` — `0173:432` | Sudah ada daftar skor, tetapi belum dipisah per level dan belum ada papan akun. |

---

## 3. Bukti angka: tangga GRD vs `skor_kpi`

Tangga diambil dari file. Kolom 4, 8, dan 10 dipetakan ke `target_base`, `target_goal`, dan
`target_stretch` aplikasi. Angka "aplikasi" adalah `skor_kpi × bobot / 100` agar sebanding dengan
TOTAL di file.

**GMV % realisasi** (KPI Manager #1, bobot 40, tangga 70–75–80–85–90–95–98–100–105–110):

| Pencapaian | VALUE GRD | TOTAL GRD | Aplikasi | Selisih |
| ---: | ---: | ---: | ---: | ---: |
| 60% | 0 | 0 | 141,2 | +141,2 |
| 80% | 3 | 120 | 188,2 | +68,2 |
| 84,9% | 3 | 120 | 199,8 | +79,8 |
| 85% | 4 | 160 | 200 | +40 |
| 90% | 5 | 200 | 240 | +40 |
| 98% | 7 | 280 | 304 | +24 |
| 100% | 8 | 320 | 320 | 0 |
| 104% | 8 | 320 | 352 | +32 |
| 105% | 9 | 360 | 360 | 0 |
| 110% | 10 | 400 | 400 | 0 |

**Seller aktif** (KPI Fajar #1, bobot 30, tangga 11,5…15…17): 12 seller memberi GRD 60 dan aplikasi
138,5. 13 seller memberi GRD 120 dan aplikasi 150.

**Skor total:**

| Kasus | GRD | Aplikasi |
| --- | --- | --- |
| Kholid: 92% / 96% / 7 dari 9 tonggak | 500 (Cukup) | 641,2 (Cukup) |
| Kholid: 98% / 98% / 100% | 760 (Baik) | 808 (**Istimewa**) |

---

## 4. Jawaban butir a–g

### a. Apakah fungsi skor sekarang menghasilkan angka yang sama? — **Tidak.**

| Aspek | GRD (file) | Aplikasi | Sama? |
| --- | --- | --- | --- |
| Bentuk ambang | 10 angka per indikator, jaraknya tidak harus rata (70, 75, …, 98, 100) dan boleh mendatar (…, 100%, 100%, 100%) | 3 angka: base, goal, stretch — `kpi_definitions` (`0024:15`) | ❌ |
| Nilai per indikator | VALUE = kolom paling kanan yang angkanya ≤ pencapaian, yaitu `COUNTIF(C:L,"<="&M)`; bilangan bulat 0–10 | interpolasi lurus 0–1.000 dengan satu desimal (`skor_kpi`, `0024:62`; `skorKpi`, `src/lib/kpi.ts:79`) | ❌ |
| Total | Σ VALUE × bobot, Σ bobot = 100, maksimum 1.000 | Σ skor × bobot / Σ bobot (`0173:378`). Hasilnya setara dalam skala, tetapi skor indikatornya berbeda. | ❌ |
| Indikator kosong | VALUE 0 dan bobotnya tetap dihitung. "BELUM DIISI" hanya bila **semua** kosong. | Indikator tanpa data (NULL) dibuang, bobotnya dinormalkan ulang, dan `cakupan` dilaporkan (0032–0034) | ❌ |
| Di bawah base | kolom 1–3 memberi 1–3 poin; di bawah kolom 1 = 0 | proporsional (60% dari base 85 → 352,9) | ❌ |
| "Makin kecil makin baik" | Tidak ada di enam sheet yang dipakai. Hanya muncul di "Contoh KPI" baris 21 (jumlah komplain): VALUE = kolom paling kanan yang ambangnya ≥ pencapaian. | Tidak didukung. Constraint `kpi_tangga_naik` mewajibkan base ≤ goal ≤ stretch. | ❌ |
| Predikat | ≥800 Istimewa, 650–799 Baik, 500–649 Cukup, <500 Perlu Perbaikan | sama (`0024:41`) | ✅ |
| Bulan berjalan | Diisi sekali di akhir bulan | Target GMV diprorata menurut hari berjalan (`0178:319`); di akhir bulan porsinya 1 | ✅ di akhir bulan |

Catatan untuk Tahap 1:
- Enam sheet yang dipakai **belum berisi PENCAPAIAN**; semua TOTAL masih 0. Satu-satunya angka
  terisi ada di "Contoh KPI", dan kolom VALUE-nya diketik tangan serta tidak mengikuti aturannya
  sendiri. Baris 18: 98% memberi VALUE 4 menurut aturan, tetapi tertulis 5. Baris 20: 99,47%
  memberi 4, tetapi tertulis 5. Total yang benar 530, tetapi tertulis 580. Jadi sheet itu tidak bisa
  menjadi acuan tes. Usulan acuan tes ada di §7.
- Untuk tangga yang naik (termasuk yang mendatar), "kolom paling kanan yang ≤ pencapaian" sama
  dengan `COUNTIF`. Aturan ini dipilih karena juga benar untuk arah turun, sedangkan `COUNTIF`
  literal tidak.

### b. Apakah definisi KPI bisa per orang per periode? — **Tidak.**

- `kpi_definitions` berkunci `(jabatan, nama_kpi)` (`0024:29`) dan dicocokkan ke `users.role`
  (`0173:400`). Artinya hanya ada 6 "jabatan" (CEO, Manager, Leader, Co-Leader, Staff, Finance), dan
  semua Leader berbagi indikator yang sama. GRD justru memberi Siti, Agung, Fajar, Ardi, dan Najib
  indikator yang berbeda-beda.
- Tidak ada kolom orang maupun periode. Kolom `periode` berisi teks `'bulanan'` dan menyatakan
  frekuensi, bukan bulan. Mengubah definisi mengubah skor semua bulan yang belum dikunci.
- Lingkup sumber `gmv` ditanam per peran: Staff memakai akun yang ia pegang, Leader/Co-Leader memakai
  unitnya, Manager memakai goal miliknya (`0178:319`). Dua indikator GMV dengan lingkup berbeda pada
  satu orang tidak bisa dibuat. Contoh: Naima #1 (GMV video 2 akun), #2 (GMV LIVE), dan #3 (GMV 5 akun
  tim); keduanya akan mendapat angka yang sama.
- Sumber `manual` ada di enum, tetapi `realisasi_kpi` mengembalikan NULL untuknya
  (`0185_kpi_tiket_tanggal_wib.sql:65`). Akibatnya indikator manual **tidak pernah dinilai**, dan
  belum ada tabel tempat penilai mengisi PENCAPAIAN.
- Hanya CEO/Manager yang boleh mengelola definisi (`kpi_def_kelola`). Itu cocok dengan GRD, tetapi
  belum ada jalur bagi atasan langsung untuk mengisi pencapaian bawahan.

### c. Goal non-Rupiah dan tenggat selain akhir bulan

| Kebutuhan | Status | Bukti / penjelasan |
| --- | --- | --- |
| Satuan non-Rupiah (Seller, Produk, Creator, Peserta, Tahap, SOP, %) | 🟡 Tersimpan, ❌ tidak bermakna | `goals.satuan` ada (`0006:22`) dan aksi menerima nilainya (`src/app/actions/goal.ts:128`). Form tidak menampilkannya. Yang lebih penting, `progres_goal`, `goal_korporasi`, `anak_tangga_target`, dan `realisasi_gmv_kpi` (`0178:182-319`) selalu mengambil GMV, sehingga goal "15 seller" tampil dengan realisasi GMV. |
| Base tidak berupa angka ("belum diukur", "sebagian") | ❌ | `target_base numeric not null check (>= 0)` (`0006:23`). |
| Tenggat 17 Okt (1.2.1, S.2.1) | 🟡 | Secara teknis bisa lewat `goal_months.sampai = 2026-10-17` (0178). Namun target dibagi rata per hari dalam rentangnya, padahal yang dimaksud adalah angka kumulatif yang harus tercapai **pada** tanggal itu. |
| Tenggat 30 Okt (1.2.5) | 🟡 | Sama seperti di atas. |
| Tenggat 4 Nov (1.2.3) dan acara 31 Okt – 1 Nov (1.2.4) | ❌ | Rentangnya menyeberang bulan sehingga terpotong menjadi dua anak tangga, dan targetnya terbelah menurut jumlah hari. KPI Oktober Ardi, Ami, dan Najib dinilai dengan data 1–4 Nov, sedangkan `realisasi_kpi` memotong di akhir bulan. |
| Batas 3 goal aktif per orang | ⚠️ | `batasi_goal_per_orang` (`0006:52`) menghitung **semua** goal aktif milik seseorang, termasuk goal akun. Siti memegang 3 goal Leader. Kalau target akun alkahfihome_ (video + LIVE) juga atas namanya, jumlahnya menjadi 5 dan ditolak. File hanya membatasi "maksimal 3 goal per Leader". |

### d. Operational Plan: mana yang jadi lead measure dan mana yang jadi tonggak

GRD Cascade punya 85 baris: 47 SEKALI, 18 HARIAN, dan 20 PEKANAN. Kolom JENIS di file sebenarnya
menggabungkan **empat bentuk** pengukuran:

| Bentuk | Arti | Jenis di file | Jumlah |
| --- | --- | --- | --- |
| **T — Tonggak** | sekali, bertenggat, status BELUM / PROGRESS / SELESAI | SEKALI | 47 baris; ±52 tonggak bila S.1.1.5 (2 dokumen) dan S.2.3.3 (5 tahap) dipecah |
| **TB — Tonggak berulang** | serahan dengan jadwal tetap; tiap kejadian menjadi satu tonggak bertenggat | PEKANAN | 1.1.3.8, 1.1.3.9, 1.1.3.10, 1.1.6.1, 1.2.2.2 (11×), 1.2.4.6, S.1.1.2–S.1.1.4, S.1.2.2, S.2.2.1, S.2.2.2 (7×), S.2.3.2 |
| **LM — Lead measure** | angka per hari/pekan terhadap target | HARIAN / PEKANAN | 1.1.0.2 = 1.1.3.11 (135 video/hari), 1.1.3.6 (10 riset/hari), 1.1.4.7 (sesi LIVE santri), 1.1.5.1 (10 seller/pekan), 1.1.6.2 (3 produk/pekan), 1.2.1.3 dan 1.2.1.5 (5 lalu 3 kontak/hari), 1.2.2.5 (10 creator 1-on-1/pekan), 1.2.4.7 (2 affiliator/pekan) |
| **KP — Kepatuhan** | ya/tidak per hari, sesi, atau kejadian, diringkas menjadi "% hari/sesi" | HARIAN | 1.1.0.1 (laporan ≤ 21.00), 1.1.1.5 (LIVE 4 jam), 1.1.1.6 (catatan LIVE), 1.1.2.5 dan 1.1.4.6 (standar video), 1.1.6.3 (sampel ≤ 3 hari), 1.2.2.6 (tiket ≤ 2 hari), 1.2.3.1 (klik ≤ 24 jam), 1.2.4.5 (posting MMC), S.1.2.1 (sampel lengkap), S.2.3.1 (surat ≤ 1 hari) |
| — | aturan atau hasil yang sudah diukur di goal, tidak diukur terpisah | — | 1.1.3.7, 1.1.5.2, 1.2.1.4 |
| **KR — Titik kurva** | kumulatif per Sabtu | PEKANAN | 1.2.2.8 (creator pemakai studio 3/6/10) |

**Kesimpulan:**
- SEKALI menjadi tonggak.
- PEKANAN yang **berjadwal** (tiap Senin, Sen/Rab/Sab, Jumat, H-1) juga menjadi tonggak, dengan satu
  tonggak per kejadian. Indikator "tepat waktu %" milik Rifal #2, Ami #4, Wildan #2, dan Alma #2 adalah
  hitungan tonggak, bukan lead measure.
- Hanya baris yang **berupa jumlah** yang menjadi lead measure.

Celah lead measure saat ini:
- Target mingguan bersifat tunggal dan tetap (`0023:14`), padahal 1.2.1.3 dan 1.2.1.5 berganti dari
  5 menjadi 3 per hari pada 18 Okt.
- Sumber dari laporan (`sumber_laporan`, `0130:16`) menjumlah **seluruh akun satu unit**
  (`0130:59`), sehingga tidak bisa membatasi ke "7 akun utama".
- Maksimal 3 lead measure per goal (`0023:28`).

**Rumus "tonggak tepat waktu %" yang diusulkan** (otomatis, untuk satu indikator KPI dan satu orang):

```
S         = daftar tonggak yang ditautkan ke indikator itu (daftar eksplisit, bukan tebakan)
jatuh     = { t ∈ S : tenggat(t) ≤ batas }     batas = akhir periode KPI,
                                                atau tanggal acuan saat bulan berjalan
tepat     = { t ∈ jatuh : status SELESAI dan tanggal selesai (WIB) ≤ tanggal tenggat (WIB) }
pencapaian = |tepat| / |jatuh| × 100           kosong ("belum ada tonggak jatuh tempo") bila |jatuh| = 0
```

Pencapaian ini lalu masuk ke tangga indikatornya (40–50–60–80–85–90–95–100–100–100). Tonggak yang
selesai terlambat tetap tercatat, tetapi tidak dihitung tepat. Ada empat hal yang perlu diputuskan
(lihat §8):
- siapa yang mencentang SELESAI dan apakah perlu verifikasi atasan;
- apakah tanggal selesai = saat dicentang atau saat diverifikasi. Pada modul Tugas sekarang,
  `selesai_at` terisi saat QC lolos, bukan saat diserahkan (`0009:63-78`);
- tonggak dengan beberapa butir (M.3 = tiga MOU, serah terima 1.1.4.5 = empat butir) dihitung 1 atau
  pecahan;
- tenggat dikunci setelah disahkan, supaya tonggak yang terlambat tidak "menjadi tepat" karena
  tenggatnya digeser.

### e. Bisakah kurva kumulatif per Sabtu ditampung "anak tangga" yang ada? — **Tidak.**

- `goal_months` unik per (goal, bulan) (`0006:92`), sehingga hanya ada satu angka per bulan. Lima
  titik Sabtu (3, 10, 17, 24, 31 Okt) tidak muat.
- Target harian turunan anak tangga adalah prorata rata (`targetHarianGrd`, `src/lib/goal.ts:98`;
  `target_harian_*`, `0178`), sedangkan sebagian kurva GRD tidak rata. Contohnya 1.1.2 (5–30–70–120–175
  jt), 1.1.1 (0–15–45–90–150 jt, mulai 5 Okt), dan 1.1.4. Kurva 1.1.3 kebetulan persis prorata
  (4,95 M / 31 × hari, dibulatkan).
- Enam dari dua belas baris kurva bukan Rupiah (seller, produk, creator, klik, studio, pendaftar),
  sedangkan anak tangga selalu dibandingkan dengan GMV. Tiga baris lainnya adalah total yang dihitung.
- Laporan mingguan aplikasi menilai pekan Senin–Minggu **tidak kumulatif** dengan ambang 95%
  (`0067:99,115`). WRM di file kumulatif sejak 1 Okt sampai Sabtu, dan HIJAU = aktual ≥ target.

Yang dibutuhkan: wadah titik kurva (ukuran, tanggal Sabtu, target kumulatif), aktual (otomatis dari
laporan untuk baris Rupiah, isian untuk baris jumlah), dan status HIJAU/MERAH. Matriks WRM lalu
membaca status itu sesuai DECISION-021.

### f. Sumber data tiap indikator KPI

Kode sumber:
- **A** — otomatis dari data yang sudah ada; cukup rumus atau lingkup baru.
- **B** — otomatis setelah tonggak ada (Tahap 3).
- **C** — butuh kolom baru di laporan harian (GMV LIVE, jam LIVE, produk diriset).
- **D** — isian penilai (manual), karena tidak ada data di aplikasi.
- **E** — sebagian: modulnya ada, tetapi akun atau kolomnya belum lengkap.

| Orang (penilai) | # | Indikator (ringkas) | Bobot | Sumber | Keterangan |
| --- | --- | --- | ---: | :---: | --- |
| **Kholid** (CEO) | 1 | GMV internal vs Rp 5,3 M | 40 | A | Laporan akun Affiliator. Perlu diputuskan apakah GMV unit TAP ikut dihitung (§8). |
| | 2 | GMV eksternal vs Rp 26,9 M | 40 | A | Laporan unit MCN (diketik Leader MCN). |
| | 3 | Tonggak Manager tepat waktu, % dari 9 | 20 | B | M.1–M.9 |
| **Siti** (Kholid) | 1 | GMV semua akun Departemen Affiliator vs Rp 4,877 M | 45 | E | 9 akun belum terdaftar (3 akun 20K, 6 santri) |
| | 2 | GMV alkahfihome_ di luar LIVE vs Rp 2.489 jt | 15 | C | Butuh pemisahan GMV LIVE |
| | 3 | Rata-rata video/hari 5 akun utama | 20 | A | `jumlah_upload`; penyebut "per hari" perlu diputuskan |
| | 4 | Tonggak departemen tepat waktu | 20 | B | Daftar tonggaknya ambigu (§5 no. 10) |
| **Agung** (Kholid) | 1 | GMV 6 akun santri vs Rp 100 jt | 35 | E | Akun santri belum terdaftar |
| | 2 | % hari **semua** santri memenuhi standar | 20 | E | Kepatuhan per akun sudah ada (`0138:21`); varian "semua akun di hari yang sama" belum ada |
| | 3 | Sesi LIVE santri vs 18/pekan | 15 | D | Tidak ada data sesi LIVE |
| | 4 | Serah terima 24 Okt, % kelengkapan | 20 | D | Empat butir |
| | 5 | Tonggak lain tepat waktu | 10 | B | 1.1.4.1–1.1.4.4 |
| **Fajar** (Kholid) | 1 | Seller mitra aktif (jumlah) | 30 | D | Modul Penjual dihapus atas keputusan pemilik (`0169:13`) |
| | 2 | Produk sampel berkomisi > 7% yang diterima affiliator | 30 | D | `samples` tidak mencatat komisi, seller, maupun lolos scoring |
| | 3 | Permintaan sampel ≤ 3 hari, % | 25 | D | `samples` tidak punya tanggal minta (`0048:24`) |
| | 4 | Pipeline terisi sebelum dibalas, % | 15 | D | |
| **Ardi** (Kholid) | 1 | GMV creator existing MCN vs Rp 25,9 M | 30 | E | Laporan unit MCN tidak memisahkan creator lama dan baru |
| | 2 | Creator besar baru binding s.d. 17 Okt | 20 | D | |
| | 3 | Creator binding MMC & seminar (dinilai 4 Nov) | 10 | D | Lintas bulan |
| | 4 | 1-on-1 ≥ 10 creator/pekan, % pekan | 15 | D | Bisa menjadi lead measure isian |
| | 5 | Tiket pelanggaran selesai ≤ 2 hari, % | 10 | E | Bisa dari modul Tugas bila tiketnya dicatat di sana |
| | 6 | Tonggak tepat waktu | 15 | B | |
| **Najib** (Kholid) | 1 | Peserta hadir MMC 40 | 35 | D | |
| | 2 | Pendaftar MMC 40 s.d. 30 Okt | 20 | D | Website MMC di luar aplikasi |
| | 3 | Alur MMC sesuai tonggak | 25 | B | 1.2.5.1–1.2.5.3 |
| | 4 | Promosi terlaksana, % | 20 | B | Campuran tonggak dan pekanan |
| **Naima** (Siti) | 1 | GMV video tokoalkahfi_ + naimaanur vs Rp 1.841 jt | 25 | C | Perlu "di luar LIVE" |
| | 2 | GMV LIVE tokoalkahfi_ vs Rp 75 jt | 15 | C | |
| | 3 | GMV 5 akun tim vs Rp 120 jt | 20 | A | Setelah pemetaan akun disetujui |
| | 4 | % hari tokoalkahfi_ LIVE 4 jam | 15 | C | Butuh jam LIVE |
| | 5 | % hari semua akun tim memenuhi standar | 15 | A | Varian "semua akun" |
| | 6 | Tonggak tepat waktu | 10 | B | |
| **Agnes** (Siti) | 1 | GMV 3 akun baru vs Rp 55 jt | 25 | E | Akun belum terdaftar |
| | 2 | GMV serbaaada.store + taokspill vs Rp 122 jt | 25 | A | |
| | 3 | % hari 3 akun baru memenuhi standar (Bilqis 30 · 3 · 3) | 20 | E | 30 bukan standar level mana pun |
| | 4 | Rata-rata video/hari serbaaada + taokspill | 10 | A | |
| | 5 | Tonggak tepat waktu | 20 | B | |
| **Sanda** (Naima) | 1 | GMV dipilihinsanda_ vs Rp 40 jt | 40 | A | |
| | 2 | % hari upload ≥ 10 video | 30 | A | `kepatuhan_minimum_akun`, level 3 = 10 |
| | 3 | Tonggak tepat waktu | 20 | B | |
| | 4 | Laporan harian ≤ 21.00, % hari | 10 | A | `submitted_at`; penyebut hari perlu diputuskan |
| **Rifal** (Kholid) | 1 | Rata-rata produk diriset/hari | 35 | C | |
| | 2 | Kiriman rutin tepat waktu | 35 | B | Tonggak berulang |
| | 3 | Tonggak tepat waktu | 30 | B | |
| **Ami** (Ardi) | 1 | Calon creator besar dihubungi (jumlah) | 25 | D | Atau lead measure isian |
| | 2 | Creator binding MMC & seminar (4 Nov) | 25 | D | |
| | 3 | Klik "gabung MCN" dihubungi ≤ 24 jam, % | 15 | D | |
| | 4 | Kiriman produk viral, % dari 11 | 15 | B | |
| | 5 | Tonggak tepat waktu | 20 | B | |
| **Wildan** (Kholid) | 1 | SOP lulus NPS ≥ 90 (jumlah) | 40 | D | Modul LMS/kuis bisa menjadi sumber di kemudian hari |
| | 2 | Siklus SOP tepat waktu, % dari 8 | 20 | B | |
| | 3 | Pencatatan sampel lengkap, % | 25 | E | `samples` punya kode/barcode dan tanggal masuk, tetapi tidak punya tanggal minta dan lokasi |
| | 4 | Dokumen SOP tepat waktu | 15 | B | |
| **Alma** (Kholid) | 1 | MDM & manajemen akun, % kelengkapan | 30 | D | Kata sandi memang tidak boleh disimpan di aplikasi |
| | 2 | Pengingat jadwal, % dari 13 | 25 | B | |
| | 3 | Surat ≤ 1 hari & arsip ≤ 24 jam, % | 25 | D | |
| | 4 | Pendaftaran karyawan baru, 5 tahap | 20 | B | |
| **Templat Tim Konten** (7 orang; Naima/Agnes) | 1 | GMV akun sendiri vs target akun | 40 | A/E | A untuk Raka, Apis, Trisya, Daffa; E untuk Bilqis, Nasywa, Feby (akun belum ada) |
| | 2 | % hari memenuhi standar video akun | 40 | A/E | Bilqis 30 bukan level |
| | 3 | Laporan harian ≤ 21.00, % hari | 20 | A | |
| **Templat Host LIVE** (2 akun) | 1 | % hari LIVE 4 jam | 40 | C | |
| | 2 | GMV LIVE vs Rp 75 jt | 40 | C | |
| | 3 | Catatan evaluasi setelah LIVE, % sesi | 20 | C | |
| **Templat Santri** (6 orang; Agung) | 1 | GMV akun vs target | 40 | E | Akun belum terdaftar |
| | 2 | % hari memenuhi standar level | 30 | E | |
| | 3 | Sesi LIVE 2 jam 3×/pekan, % | 20 | D | |
| | 4 | Laporan harian terisi, % hari (tanpa syarat 21.00) | 10 | A | |

**Rekap 67 baris indikator** (templat dihitung sekali): A 14 · B 17 · C 8 · D 18 · E 10. Jadi hanya
sekitar 21% yang bisa otomatis dengan data yang ada sekarang. Bila Tahap 3 menambah tonggak dan tiga
kolom laporan harian, angkanya naik menjadi ±58%. Sisanya (D) memang isian penilai.

### g. Data goal/KPI di database sekarang, dan mana yang data contoh

**Database produksi** (dibaca 1 Okt 2026):

| Tabel | Isi | Asal |
| --- | --- | --- |
| `goals` | 5 aktif: 1 company, 2 manager, 2 leader, semuanya IDR. Periode "26 Sep – 25 Okt 2026", dibuat 27–28 Sep. | Diketik tangan, **bukan dari file** |
| `goal_months` | 10 baris (26–30 Sep dan 1–25 Okt untuk tiap goal) | Turunan 5 goal di atas |
| `kpi_definitions` | 15 baris generik per jabatan (Staff, Leader, Co-Leader, Manager, CEO, Finance) | Data referensi migrasi `0069_data_referensi.sql:62`, **bukan GRD** |
| `kpi_snapshots` | 0 | Belum ada bulan yang dikunci |
| `lead_measures`, `lead_measure_entries`, `weekly_reports` | 0 | — |
| `users` | 29 (24 aktif) | Data nyata |
| `accounts` | 13 (11 aktif), level terisi | Data nyata |
| `daily_reports` | 1.111 laporan, 1 Jun – 1 Okt 2026; 495 di antaranya berisi `jumlah_upload` | Data nyata (sebagian hasil migrasi V1) |

Perbedaan kelima goal itu dengan file:

| Goal di DB | Nilai di DB | Nilai di file |
| --- | --- | --- |
| Perusahaan | target Rp 32,0 M · stretch Rp 35 M · judul menyebut base "bulan September" | Rp 32,2 M · tanpa stretch · base Agustus |
| Manager eksternal | Rp 27,9 M | Rp 26,9 M |
| Manager internal | Rp 5,3 M | sama |
| 2 goal Leader | salinan kedua goal Manager (Siti Rp 5,3 M, Ardi Rp 27,9 M) | 11 goal Leader yang berbeda-beda |
| Periode | 26–25 | bulan kalender (Oktober; base Partner Center 1–31 Agustus) |

**Data contoh** — tidak ada di produksi. Saya sudah memeriksa bahwa tidak satu pun nama karangan
muncul di sana.
- `supabase/seed/data.json` dan `supabase/seed.sql`: 26 orang karangan, 6 akun `@...`, 11 goal,
  4 lead measure, 15 definisi KPI.
- Dipakai oleh mode demo (tanpa `.env.local`) dan tes PGlite.
- `supabase/migrasi/ekspor-contoh.json` adalah contoh ekspor sistem lama.

---

## 5. Hal janggal di file — dilaporkan, tidak diubah

1. **Goal 1.1.3 vs Target & Kurva:** goal Rp 4,95 M dan titik kurva 31 Okt Rp 4,95 M, tetapi
   jumlah target 7 akun (F13) Rp **4,951** M. Selisihnya Rp 1 jt.
2. **KPI Manager #3** merujuk "sheet Op Plan Internal" yang tidak ada di file. Sembilan tonggaknya
   ada di GRD Cascade M.1–M.9.
3. **Kode 1.1.3.10** (Rifal → Ami: hasil riset ke MCN) berada di bawah goal 1.2.2, sementara
   penomorannya ikut deret 1.1.3. Goal mana yang dilayaninya?
4. **KPI Ami #1** memakai goal 80 kontak. Hitungan "5/hari s.d. 17 Okt, lalu 3/hari" untuk 8–31 Okt
   menghasilkan 92 (hari kalender) atau 81 (tanpa Minggu), bukan 80.
5. **Target perusahaan** Rp 32,2 M, sedangkan total kurva 31 Okt Rp 32,275 M karena memakai
   patungan internal Rp 5,375 M. Ini disengaja (cadangan), tetapi aplikasi perlu tahu angka mana
   yang menjadi target goal dan mana yang menjadi akhir kurva.
6. **Kurva pendaftar MMC 40:** catatan menyebut "300 pada Jumat 30 Okt", tetapi titiknya kolom
   Sabtu 31 Okt.
7. **Catatan kurva** menyebut "Oktober tidak rata (lonjakan 10.10, turun pekan 3)", tetapi kurva 1.1.3
   persis linear.
8. **Standar video:** level 7 tertulis ">20" (aplikasi: 20 sudah lolos), file tidak punya level 8,
   dan standar Bilqis 30/hari tidak sesuai level mana pun.
9. **Rifal punya dua lembar KPI** pada periode yang sama: Tim Riset (penilai Kholid) dan templat
   Santri "Rifal Cakep" (penilai Agung). Mana yang masuk scorecard dan leaderboard?
10. **KPI Siti #4** menyebut "sistem baru 5 Okt" dan "produk & sampel 10.10 / Pay Day". Butir ini
    tidak jelas menunjuk baris Op Plan yang mana, sehingga penyebut % tonggaknya tidak bisa
    ditetapkan.
11. **Mabit Scholar:** "Leader Agung s.d. 31 Okt", tetapi serah terima ke Agnes & Sanda 24 Okt.
    Siapa yang menilai santri untuk bulan Oktober?
12. **Base bukan angka:** S.1.2, S.2.2, S.2.3 "belum diukur" dan S.2.1 "sebagian". Base diukur
    pekan 1 (3 Okt).
13. **Status "usulan" (masuk sebagai draft):**
    - seluruh KPI Manager ("USULAN — disahkan CEO");
    - Target & Kurva bagian A ("usulan, difinalkan Siti & Agung di WRM 3 Okt");
    - definisi "creator besar" (1.2.1);
    - 30 masjid (1.2.4.3), 2 influencer (1.2.4.4), dan 2 affiliator top (1.2.4.7).
14. **Base goal Manager internal** Rp 3,8 M, sedangkan jumlah base keempat goal Leader-nya
    ±Rp 3,605 M. Selisihnya agaknya "sumber lain" sesuai keterangan baris 15; dicatat saja.
15. **Ejaan akun berbeda dari database:** naimaanur / naimanurr_, taokspill / taokspill_,
    azkadwianshory / azkadwianshory_, ariolapis / arilapis_, dapaspillin / dafaspilin_.

---

## 6. Pratinjau pemetaan — belum untuk disetujui

Pemetaan resmi disusun di Tahap 2 dan baru dipakai setelah Anda setujui. Pratinjau ini hanya untuk
mengukur pekerjaannya. Nama pengguna di database sengaja tidak ditulis karena repo ini publik.

**Orang:**

| Status | Nama |
| --- | --- |
| Cocok jelas | Kholid, Azka, Siti, Agung, Fajar, Ardi, Naima, Agnes, Ami, Alma, Wildan, Rifal, Trisya, Daffa, Bilqis, Taufiq.id, Yusuf |
| Kemungkinan, perlu konfirmasi | Sanda, Raka, Apis (disimpulkan dari PIC akunnya); Dan Ngulik, udinfits, maryamreview_ (nama santri mirip) |
| Tidak ditemukan | Najib (Leader MMC), Nasywa, Feby, host LIVE alkahfihome_ (masih dicari s.d. 3 Okt), host LIVE tokoalkahfi_ |

Peran atau atasan di DB yang berbeda dari file:

| Orang | Di DB | Di file |
| --- | --- | --- |
| Agnes | Staff di bawah Naima | Co-Leader di bawah Siti |
| Bilqis | di bawah Siti | di bawah Agnes |
| Rifal | di bawah Agung | Tim Riset di bawah Manager |
| Wildan | jabatan "Host Live" | Tata Kelola |

**Akun:**

| Status | Akun |
| --- | --- |
| Cocok persis | alkahfihome_, tokoalkahfi_, serbaaada.store, dipilihinsanda_, sinirakaspill_, sinisyaspill |
| Ejaan berbeda | naimaanur, taokspill, azkadwianshory, ariolapis, dapaspillin (§5 no. 15) |
| Tidak ditemukan | kholidfath_, 3 akun 20K (file tidak menyebut username-nya), 6 akun santri |

**Unit:** aplikasi hanya punya 3 unit (Affiliator, MCN, TAP — `0001:33`). MMC dan Mabit Scholar
adalah program. Tata Kelola dan Sekretariat tanpa unit. Hal ini tidak menghalangi, karena goal staf
cukup bertaut ke pemiliknya.

---

## 7. Usulan rencana bertahap

Satu tahap satu PR, dari branch masing-masing, dan berhenti untuk direview di akhir tiap tahap.

### Tahap 1 — Mesin KPI sesuai GRD

- **Tangga 10 kolom per indikator:** 10 ambang, arah (naik/turun), dan bobot.
  - VALUE = kolom paling kanan yang terpenuhi.
  - Total = Σ VALUE × bobot, berupa bilangan bulat dengan maksimum 1.000.
  - Predikat sesuai file, ditambah status "BELUM DIISI".
- **Definisi KPI per orang per periode** dengan status draft/aktif. Definisi per jabatan yang lama
  tidak dihapus.
- **Isian PENCAPAIAN manual** per orang, periode, dan indikator, diisi penilai menurut hierarki yang
  ada (atasan dan atasan transitif, CEO/Manager). Bentuknya bisa berupa angka atau %.
- **Sumber otomatis yang sudah ada** dipetakan ke indikator baru: GMV per goal/daftar akun, kepatuhan
  minimum, dan jam kirim laporan. Sumber yang belum ada menyusul di Tahap 3.
- **Padanan TypeScript** untuk mode demo, beserta tes paritas SQL ↔ TS.
- **Bulan terkunci tidak berubah:** `kpi_snapshots` sudah final lewat trigger. Ditambah tes yang
  mengunci bulan, lalu mengubah definisi dan rumus, dan memastikan scorecard tetap membaca snapshot
  apa adanya.
- **Tes dengan acuan dari file:**
  - skrip membaca ke-16 tangga langsung dari xlsx;
  - saya menyiapkan salinan `docs/grd/acuan-kpi-oktober.xlsx` dengan kolom PENCAPAIAN terisi
    (termasuk kasus batas 84,9 / 85 / 100 / 110, tangga mendatar, dan kosong);
  - salinan itu dibuka dan disimpan di **Excel** (Excel terpasang di mesin ini), sehingga
    VALUE, TOTAL, NILAI, dan PREDIKAT yang tersimpan adalah hasil hitungan Excel sendiri;
  - tes membandingkan hasil aplikasi dengan sel-sel itu. Inilah bukti bahwa angkanya sama dengan
    file.

### Tahap 2 — Isi data GRD Oktober

Usul: dipecah menjadi **2A (skema)** dan **2B (impor)**. Perlu persetujuan karena aturan Anda satu
tahap satu PR.

**2A — skema yang dibutuhkan data file:**
- goal non-Rupiah dengan realisasi dari isian atau kurva;
- base boleh kosong ("belum diukur");
- lingkup goal berupa daftar akun beserta jenis GMV-nya (semua / LIVE / di luar LIVE);
- tenggat yang boleh menyeberang bulan (4 Nov);
- status draft untuk baris "usulan";
- batas 3 goal hanya untuk goal Leader;
- wadah titik kurva per Sabtu;
- matriks WRM disamakan dengan DECISION-021, bila Anda setuju di tahap ini (§8 no. 12).

**2B — skrip impor yang bisa diulang** (`scripts/impor-grd.mjs`):
- Alurnya: xlsx → berkas rencana JSON → **uji coba** (menampilkan perbedaan) → terapkan.
- Idempoten berdasarkan kode GRD dan periode, sehingga bisa dipakai lagi untuk November.
- Berkas pemetaan nama/akun dibuat skrip berisi calon kecocokan. Berkas itu Anda setujui dulu; yang
  tidak ditemukan dilaporkan, tidak ditebak.
- Isi yang diimpor:
  - 1 goal perusahaan, 2 goal Manager, 11 goal Leader, 5 goal staf, dan target per akun;
  - definisi KPI 13 lembar, ditambah templat yang dipecah per orang (7 + 2 + 6);
  - 12 baris kurva (3 baris total dihitung, tidak disimpan).

### Tahap 3 — Rencana operasional & tonggak

- **Wadah Rencana Operasional:** ±85 baris dengan kode, goal, PIC, jenis, dan tenggat/jadwal.
- **Bentuk pengukuran:** tonggak dan tonggak berulang (kejadiannya dibangkitkan dari jadwal), lead
  measure dengan target yang boleh berganti menurut tanggal, dan kepatuhan harian.
- **Laporan harian:** ditambah GMV LIVE, jam LIVE, dan produk diriset (sesuai 1.1.0.1), plus rumus
  "laporan ≤ 21.00".
- **Lead measure dari laporan per daftar akun,** bukan hanya per unit.
- **Sumber KPI baru:**
  - tonggak tepat waktu % (rumus §4d);
  - % hari patuh;
  - rata-rata per hari;
  - semuanya mengalir ke mesin Tahap 1.
- **Aktual kurva:** otomatis untuk baris Rupiah, dan status HIJAU/MERAH.

### Tahap 4 — Leaderboard

- Peringkat Nilai KPI bulan berjalan dipisah per level: Leader, Co-Leader, dan Staf/Partner.
- Papan akun berdasarkan % capaian target GMV. Akun azkadwianshory dan kholidfath_ dikecualikan
  berdasarkan id akun dari pemetaan, bukan nama.
- **Satu-satunya sumber angka adalah fungsi scorecard.** Leaderboard hanya mengurutkan dan
  mengelompokkan; tidak ada hitungan kedua. Ditambah tes yang membandingkan setiap baris
  leaderboard dengan scorecard.

---

## 8. Keputusan yang saya perlukan sebelum Tahap 1

1. **Repo ini publik** (`digitalalkahfi/Kahfi-Space`). File GRD (GMV, nama, rencana internal) dan
   laporan ini sudah di-commit di branch `fitur/grd-oktober` secara **lokal saja, belum di-push**.
   Pilihannya:
   - (a) jadikan repo privat dulu, lalu push dan buat PR;
   - (b) push tanpa xlsx (xlsx dikecualikan lewat `.gitignore`);
   - (c) push apa adanya.
2. **Periode GMV bulanan:** bulan kalender sesuai file (1–31 Okt), atau 26–25 seperti 5 goal yang ada
   sekarang? Lalu apa yang dilakukan pada kelima goal lama itu: dibatalkan (status `dibatalkan`,
   jejaknya tetap) atau dibiarkan?
3. **Indikator kosong:** ikut GRD (kosong = 0, "BELUM DIISI" bila semua kosong) untuk penguncian dan
   leaderboard? Usul saya: ya. Di tengah bulan, layar menandai indikator yang "belum diisi".
4. **Bulan sebelum Oktober:** biarkan memakai rumus lama per jabatan (belum ada yang terkunci), atau
   rumus lama dipensiunkan sepenuhnya?
5. **Isian manual:** apakah diisi atasan langsung saja sesuai kolom "Penilai", atau orangnya boleh
   mengisi sendiri lalu atasan menyetujui?
6. **GMV LIVE:** kolom baru "GMV LIVE" di laporan harian, sehingga GMV di luar LIVE = GMV − GMV LIVE
   (usul saya), atau akun LIVE dibuat terpisah?
7. **Blok Internal:** apakah GMV unit TAP ikut dihitung dalam Rp 5,3 M?
8. **GMV creator existing MCN:** laporan unit MCN tidak memisahkan creator lama dan baru. Apakah
   aturannya total MCN dikurangi GMV creator besar baru (isian)?
9. **Tonggak:**
   - siapa yang mencentang SELESAI;
   - apakah perlu verifikasi atasan;
   - tanggal selesai = saat dicentang atau saat diverifikasi;
   - tonggak multi-butir dihitung 1 atau pecahan;
   - daftar persis tonggak KPI Siti #4.
10. **Rifal:** lembar KPI mana yang berlaku untuk Oktober, Tim Riset atau Santri?
11. **Visibilitas leaderboard:** dengan hierarki sekarang, Staff hanya melihat dirinya sendiri. Apakah
    leaderboard boleh menampilkan nama, nilai, dan predikat semua orang di level yang sama, atau
    tetap dibatasi hierarki?
12. **Matriks WRM:** SABAR dan ALARM di aplikasi tertukar dibanding DECISION-021. Diperbaiki di
    Tahap 2A bersama kurva (usul saya), atau di PR terpisah?
13. **Hal janggal §5:** mana yang ingin Anda koreksi di file sebelum impor? Terutama no. 1, 4, 9,
    dan 10.
14. **Tahap 2:** setuju dipecah menjadi 2A (skema) dan 2B (impor)?
15. **Acuan tes Tahap 1:** boleh saya menyiapkan salinan file berisi PENCAPAIAN, lalu Anda (atau saya,
    dengan izin mengoperasikan Excel) membuka dan menyimpannya di Excel supaya hasil rumusnya resmi
    dari Excel?

---

## 9. Keputusan (1 Oktober 2026)

| No. §8 | Keputusan |
| --- | --- |
| 1 | Push **tanpa xlsx**. `docs/grd/*.xlsx` dikecualikan lewat `.gitignore`; file GRD tetap di mesin lokal sebagai sumber impor. |
| 2 | Periode GMV = **bulan kalender** (1–31) sesuai file. Kelima goal lama (26 Sep – 25 Okt) hanya percobaan dan **dihapus**. Penghapusannya dijalankan skrip impor Tahap 2B, setelah uji coba menampilkannya; jejak lamanya tetap tersimpan di `audit_logs`. |
| 3 | Indikator kosong = **0**, sama dengan file, untuk penguncian dan leaderboard. "BELUM DIISI" hanya bila semua indikator kosong. |
| 5 | Mengikuti rekomendasi: PENCAPAIAN manual **hanya diisi penilai**, yaitu atasan (langsung maupun berjenjang) dan CEO/Manager. Orangnya sendiri tidak bisa mengisi. Ini sesuai kolom Penilai di file, mencegah menilai diri sendiri, dan tidak perlu alur persetujuan tambahan. |
| 11 | Leaderboard **menampilkan semua orang, tetapi dipisah per level**: Staf dibandingkan dengan Staf, Leader dengan Leader, Co-Leader dengan Co-Leader. |
| 14 | Mengikuti rekomendasi: Tahap 2 dipecah menjadi **2A (skema)** dan **2B (impor)**. |

Bawaan yang saya pakai untuk Tahap 1 selama belum diputuskan lain:
- **No. 4:** bulan yang belum punya lembar KPI per orang tetap memakai rumus lama per jabatan.
  Tidak ada bulan yang terkunci, jadi tidak ada angka resmi yang berubah.
- **No. 15:** salinan acuan disiapkan skrip, lalu dihitung ulang oleh Excel sebelum PR Tahap 1 dibuka.

Butir 6–10, 12, dan 13 diputuskan menjelang Tahap 2A/3.

### Keputusan lanjutan (1 Oktober 2026, atas mandat pemilik)

Pemilik menyerahkan sisa keputusan teknis kepada pelaksana ("aku percayakan sepenuhnya"). Setiap
keputusan berikut mengikuti isi file GRD bila file menyebutnya:

| No. §8 | Keputusan | Dasar |
| --- | --- | --- |
| 6 | Laporan harian Affiliator mendapat kolom **GMV LIVE** (bagian dari GMV hari itu). GMV di luar LIVE = GMV − GMV LIVE. | Goal 1.1.1 vs 1.1.3 dan sheet Target per akun memisahkan keduanya. |
| 7 | Blok Internal = **1.1.1 + 1.1.2 + 1.1.3 + 1.1.4**. GMV unit TAP tidak ikut. | Baris "TOTAL GMV INTERNAL (1.1.1 + 1.1.2 + 1.1.3 + 1.1.4)" di sheet kurva. |
| 8 | GMV creator existing MCN = GMV unit MCN − GMV creator besar baru. Angka creator besar baru diisi tiap Sabtu, sesuai baris kurva "1.2.1 GMV creator besar baru (dicatat setelah binding)". | Sheet kurva; Blok Eksternal = existing + creator baru. |
| 9 | Tonggak dicentang selesai oleh PIC atau atasannya. Tanggal selesai = saat dicentang (WIB). Tonggak berbutir dihitung satu. Daftar tonggak KPI Siti #4: 1.1.1.1, 1.1.3.1, 1.1.2.3, 1.1.2.4, 1.1.4.5, 1.1.3.2, 1.1.3.3, 1.1.3.4, 1.1.3.5. | "SEKALI = tonggak, dicentang selesai" di GRD Cascade. |
| 10 | Lembar KPI Oktober Rifal = **Tim Riset** (penilai Kholid). Akun santri "Rifal Cakep" tetap ikut goal 1.1.4. | Satu orang satu lembar per bulan. |
| 12 | Matriks WRM disamakan dengan DECISION-021 di Tahap 2A (migrasi 0189), termasuk HIJAU = aktual ≥ target dan UBAH CARA setelah dua pekan merah. | Sheet kurva baris 93. |
| 13 | Angka janggal di §5 **tidak diubah**; semua angka masuk persis seperti di file. | Aturan kerja: jangan mengubah angka, bobot, atau target dari file. |

---

## 10. Tahap 3 — yang diterapkan (migrasi 0191–0195)

### Laporan harian

- Affiliator kini mengisi **GMV LIVE** dan **jam LIVE** (centang "Ada LIVE?"). Keduanya bisa
  diperbaiki lewat riwayat laporan dan berjejak di revisi, sama seperti GMV, komisi, dan upload.
- **Produk diriset** tidak menjadi kolom laporan harian. Tim Riset tidak melapor per akun, jadi
  angkanya diisi harian di papan lead measure **1.1.3.6** ("minimal 10 produk setiap hari").
  KPI Rifal #1 membaca rata-ratanya.

### Rencana operasional & tonggak

Seluruh 85 baris OPERATIONAL PLAN masuk lengkap dengan goal yang dilayani, SIAPA, dan KAPAN. Aturan
tonggak mengikuti legenda file:

- **SEKALI** menjadi satu tonggak. Bila KAPAN menyebut beberapa tanggal, jadinya beberapa tonggak:
  S.1.1.5 menjadi 2 dokumen, dan S.2.3.3 menjadi 5 tahap bertanggal.
- **PEKANAN** menjadi satu tonggak per kejadian. "Setiap pekan" dihitung tiap Sabtu, sesuai legenda
  "dicek di WRM Sabtu".
- **HARIAN** tidak menjadi tonggak. Pekerjaan ini diukur dari laporan harian dan lead measure.

Hasilnya 157 tonggak. Jumlahnya cocok dengan penyebut di KPI file:

| KPI | Penyebut di file | Hasil di aplikasi |
| --- | --- | --- |
| Ami #4 | 11 kiriman | 11 kejadian 1.2.2.2 (Sen/Rab/Sab, mulai 7 Okt) |
| Alma #2 | 13 pengingat | 5 WRM + 1 MRM + 7 RAB |
| Wildan #2 | 8 jadwal | 4 Senin + 4 Jumat |
| Alma #4 | 5 tahap | 5 tahap |
| Kholid #3 | 9 tonggak | M.1–M.9 |

Status tonggak (BELUM / PROGRESS / SELESAI) diubah di halaman **GRD → Rencana operasional** oleh
orang-orang ini:
- yang disebut di kolom SIAPA;
- atasan mereka;
- CEO/Manager.

Bila SIAPA berupa peran yang belum terdaftar ("Host LIVE", "Santri"), pemilik goal-nya yang
mencentang. Waktu selesai dicatat database saat dicentang. Tenggat hanya bisa diubah CEO/Manager,
dan setiap perubahan tercatat di audit. Setelah KPI sebulan dikunci, tonggaknya ikut beku.

### Lead measure

| Kode | Sumber | Target | Berlaku |
| --- | --- | --- | --- |
| 1.1.3.11 | jumlah upload laporan 7 akun utama | 135/hari | sepanjang bulan |
| 1.1.3.6 | isian | 10 produk/hari | mulai 5 Okt |
| 1.2.1.3 | isian | 5 calon/hari | 8–17 Okt |
| 1.2.1.5 | isian | 3 calon/hari | 18–31 Okt |

Target pekan yang hanya sebagian masuk rentang dipotong menurut jumlah harinya. 1.1.4.6 (45 video
santri/hari) baru dibuat setelah akun santri terdaftar.

### Sumber otomatis indikator KPI

Dari 88 indikator yang masuk, 62 dihitung otomatis:

| Sumber | Dipakai untuk |
| --- | --- |
| % realisasi ukuran | indikator GMV vs target. Σ target ukuran diperiksa sama dengan angka "Rp …" di rumusan indikator |
| angka ukuran isian | seller, produk, creator, SOP, % kelengkapan |
| tonggak tepat waktu | rumus §4d |
| rata-rata video per hari | dari laporan harian |
| % hari semua akun memenuhi standar video | dari laporan harian |
| % hari LIVE ≥ 4 jam | dari laporan harian |
| % hari laporan terkirim ≤ 21.00 WIB | santri: asal terisi |
| rata-rata atau jumlah lead measure | lead measure di atas |

Pemetaan per indikator tersimpan di berkas pemetaan lokal (`kpi_otomatis`), bersama pemetaan nama.

Aturan yang dipakai:
- **Isian penilai selalu menang.** Angka otomatis tetap ditampilkan sebagai pembanding. Kosongkan
  isian untuk kembali ke angka otomatis.
- **Bulan berjalan:** target GMV diprorata menurut hari yang sudah lewat, sama seperti 0029. Hitungan
  harian berhenti di kemarin (WIB). Tonggak bertenggat hari ini belum dihitung terlambat.
- **Bulan selesai:** angkanya sama dengan rumus file.
- **Satu rumus untuk semua.** Scorecard, penguncian, dan leaderboard memanggil `nilai_kpi_grd` yang
  sama. Angkanya sama siapa pun yang melihat.

Indikator yang tetap diisi penilai:
- **Memang tidak ada datanya di aplikasi:**
  - Agung #3 dan #4;
  - Fajar #3 dan #4;
  - Ardi #5;
  - Ami #3;
  - sesi LIVE santri.
- **Orang atau akunnya belum terdaftar** (otomatis setelah didaftarkan dan impor diulang):
  - Agnes #1 dan #3 (3 akun 20K);
  - Agung #2 (akun santri);
  - GMV dan standar video Bilqis serta santri.

### Hal janggal baru — dilaporkan, tidak diubah

16. **1.1.3.10** (hasil riset ke MCN, Sen/Rab/Sab) tidak menyebut tanggal mulai. Karena itu kejadian
    Sabtu 3 Okt ikut terhitung (13 kejadian), padahal Rifal baru mulai 5 Okt. Bila tidak dimaksudkan,
    ubah KAPAN di file menjadi "Setiap Senin, Rabu, Sabtu mulai 5 Okt" lalu impor ulang.
17. **Tanggal MRM** (S.2.2.1 "MRM H-1") tidak tertulis. Tonggaknya masuk tanpa tenggat dan belum
    dihitung sampai CEO/Manager menetapkan tanggalnya.
18. **1.1.5.2** ("Setiap ada kerja sama") tidak berjadwal, jadi tidak menjadi tonggak.
19. **KPI Rifal #2** menyebut "checkout produk lolos" (1.1.3.7, per produk). Butir ini tidak
    berjadwal, jadi yang dihitung hanya kiriman 1.1.3.8, 1.1.3.9, dan 1.1.3.10.
20. **Indikator "dinilai 4 Nov"** (Ardi #3, Ami #2) membaca angka pada tenggat goal 1.2.3. Karena
    itu KPI Oktober sebaiknya **dikunci setelah 4 November**.
21. **Najib belum terdaftar.** Tonggak 1.2.4.x dan 1.2.5.x untuk sementara hanya bisa dicentang
    CEO/Manager.
