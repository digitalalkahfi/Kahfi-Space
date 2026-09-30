# BUILD HANDOFF — CLAUDE CODE
## K-Space V2 · Modul Tugas: Perbaikan To-Do & Tiket + Filter Tanggal + SMART

> Salin seluruh isi file ini ke Claude Code yang berjalan di repo **K-SPACE V2**.

---

## Instruksi kerja untuk Claude Code

Kamu mengerjakan perubahan di modul **Tugas** K-Space V2. Semua keputusan bisnis di dokumen ini **sudah final**. Kalau menemukan hal yang tidak diatur di sini dan butuh keputusan bisnis, **berhenti dan tanyakan**, jangan menebak.

Aturan kerja:

1. **Baca dulu sebelum menulis kode**: `AGENTS.md` (versi Next.js di repo ini berbeda, baca panduan di `node_modules/next/dist/docs/`), `supabase/migrations/0009_tugas.sql`, `0017_hasil_kerja.sql`, `0020_tugas_tenggat.sql`, `0021_jejak_qc.sql`, `0113_notifikasi_tenggat.sql`, `src/app/actions/tugas.ts`, `src/lib/data/tugas.ts`, `src/lib/kanban.ts`, `src/app/tugas/page.tsx`, semua file di `src/components/tugas/`, dan `src/components/beranda/todo-hari-ini.tsx`.
2. **Perluas yang sudah ada, jangan menulis ulang.** Ikuti gaya kode yang ada: penamaan bahasa Indonesia, pola `Hasil`/`gagal`/`sukses`, pemeriksaan jumlah baris setelah `update(...).select("id")`, dan mode demo (`modeData() === "demo"`).
3. **Aturan bisnis dijaga di database** (constraint, trigger, RLS), bukan hanya di UI. Menyembunyikan tombol bukan pengamanan.
4. Kerjakan **per fase sesuai urutan**. Setelah tiap fase: jalankan `npm run typecheck`, `npm run lint`, dan `npm run test:unit`, lalu commit dengan pesan yang jelas. **Jangan push** dan **jangan menjalankan migration ke database production.**
5. Migration baru mulai dari nomor **0179**. Setiap migration harus aman dijalankan ulang (`if not exists`, `drop trigger if exists`, dan sejenisnya).

---

## 1. Context

Halaman Tugas menggabungkan tiga jenis tugas dalam satu tabel `tasks`: `pribadi` (to-do), `tiket` (dari atasan), dan `komitmen_mingguan` (tiket yang terhubung ke goal).

Keluhan Manager: papan Kanban menumpuk ke bawah, membingungkan, dan tidak ada deadline. Manager ingin (a) bisa melihat tugas per tanggal, dan (b) to-do dan tiket dibuat dengan prinsip SMART.

## 2. Masalah yang ditemukan di kode (FACT)

| # | Masalah | Lokasi |
|---|---|---|
| B1 | To-do pribadi bisa diajukan ke Review ("Ajukan pemeriksaan"), padahal QC disembunyikan untuk `pribadi` dan papan tidak punya centang. Akibatnya kartu **terjebak di kolom Review selamanya**. | `kartu-tugas.tsx`, `papan-kanban.tsx` (`bolehQc` → `t.tipe !== "pribadi"`), `kanban.ts` |
| B2 | Form tiket hanya punya isian **jam**; tanggal dikunci ke hari ini. Komitmen dikunci ke Sabtu. Tiket untuk tanggal lain tidak bisa dibuat. | `dialog-tiket.tsx` baris ±79 |
| B3 | To-do tanpa jam tersimpan `tenggat = null`, sehingga tidak masuk tanggal mana pun. | `dialog-todo.tsx` baris ±49 |
| B4 | "Hari ini" dihitung dengan `new Date().toISOString().slice(0,10)`, yaitu **UTC**. Antara 00.00–06.59 WIB, tanggalnya menjadi kemarin. | `src/app/tugas/page.tsx` |
| B5 | `ambilBaris` memuat **semua tugas sepanjang masa**, termasuk yang sudah selesai, dengan `limit(200)` tanpa filter tanggal. Untuk CEO/Manager (`lintas_unit`), tugas di atas 200 baris hilang diam-diam. Fungsi DB `daftar_tugas` dan `hitung_tugas` sudah ada tetapi tidak dipakai. | `src/lib/data/tugas.ts` |
| B6 | To-do milik pengguna disaring berdasarkan **nama** (`b.penerima?.nama === pengguna.nama`), bukan ID. | `src/lib/data/tugas.ts` |
| B7 | RLS `tasks_ubah` mengizinkan penerima mengubah **semua kolom** tiketnya, termasuk `tenggat` dan `judul`. | `0009_tugas.sql` |

## 3. Keputusan Manager (DECISION — final)

| ID | Keputusan |
|---|---|
| D1 | **Tenggat tiket hanya boleh diubah oleh pemberi tiket (`pembuat_id`).** Penerima tidak boleh. CEO/Manager yang bukan pembuat tiket juga tidak boleh. Aturan yang sama berlaku untuk judul, deskripsi, kriteria selesai, dan target. |
| D2 | To-do pribadi **tidak punya tahap Review/QC**. Alurnya To Do → Sedang Dikerjakan → Selesai (lewat centang atau seret). |
| D3 | **Semua tugas baru wajib punya tanggal.** To-do: tanggal wajib (bawaan hari ini), jam opsional. Tiket & komitmen: tanggal **dan** jam wajib. |
| D4 | Papan Kanban punya **filter tanggal**. Tugas terlambat yang belum selesai tetap tampil paling atas saat melihat "Hari ini". |
| D5 | SMART: tiket wajib punya **kriteria selesai**; to-do cukup versi ringan (target angka opsional). |
| D6 | Tautan tiket ke goal **tetap opsional** (sesuai BR-11 dokumen Goal-to-Execution). Komitmen mingguan tetap wajib ke goal, seperti sekarang. |
| D7 | Semua tanggal dihitung dalam zona waktu **Asia/Jakarta (WIB)**. |

---

## 4. Scope

**Fase 1: Perbaikan P1 (wajib pertama)**
- 1A. Alur to-do pribadi tanpa Review (B1, D2)
- 1B. Tanggal wajib + pemilih tanggal di form to-do dan tiket (B2, B3, D3)
- 1C. Tanggal WIB (B4, D7)
- 1D. Kunci isi tiket hanya untuk pemberi tiket + fitur "Ubah tenggat" (B7, D1)

**Fase 2: Filter tanggal di papan** (B5, B6, D4)

**Fase 3: SMART di form tiket & to-do** (D5)

## 5. Non-Scope (jangan dikerjakan)

- Mengubah alur QC tiket (lolos/revisi, `task_qc_log`, `larang_qc_sendiri`).
- Mengubah aturan siapa boleh **membuat** tiket atau **melihat** tugas (policy `tasks_buat`, `tasks_baca`).
- Fitur pengajuan perpanjangan tenggat oleh penerima (belum diputuskan; penerima menghubungi pemberi di luar aplikasi).
- Memperbaiki perhitungan tanggal UTC di halaman lain (keuangan, gmv, notifikasi). **Catat saja sebagai temuan** di ringkasan akhir.
- Mengubah tampilan **Daftar** selain yang disebut di Fase 2.
- Redesign visual. Ikuti komponen dan gaya yang ada.

---

## 6. Users & Permission

| Aksi | Pemilik to-do | Penerima tiket | Pemberi tiket (`pembuat_id`) | CEO/Manager bukan pembuat |
|---|---|---|---|---|
| Lihat | ✅ miliknya | ✅ | ✅ | ✅ (aturan RLS yang ada) |
| Geser status To Do ↔ Dikerjakan | ✅ | ✅ | ❌ (seperti sekarang) | ❌ |
| Tandai to-do selesai | ✅ | — | — | — |
| Ajukan Review | ❌ untuk to-do | ✅ | — | — |
| QC lolos/revisi | — | ❌ | ✅ | ✅ (seperti sekarang) |
| Ubah tanggal/jam to-do | ✅ | — | — | ❌ |
| **Ubah tenggat, judul, deskripsi, kriteria, target tiket** | — | ❌ | ✅ | ❌ |

---

## 7. Fase 1: Detail requirement

### 1A. To-do pribadi tanpa Review

**Database (migration 0179):**
- Tambah constraint: tugas `tipe = 'pribadi'` hanya boleh berstatus `todo`, `berjalan`, `selesai`, atau `dibatalkan`.
- **Sebelum** menambah constraint, pindahkan data lama: to-do pribadi berstatus `menunggu_qc` atau `revisi` diubah ke **`berjalan`**, bukan `selesai`. Menandai selesai tanpa konfirmasi pemilik berarti pekerjaan itu hilang dari layar. Set `qc_status = 'belum'`.
- Catat jumlah baris yang dipindahkan di komentar migration atau `raise notice`.

**Logika (`src/lib/kanban.ts`):**
- `periksaPindah` menerima input `tipe`.
- Untuk `pribadi`: pindah ke `menunggu_qc` **ditolak** dengan pesan "To-do pribadi tidak perlu diperiksa. Centang jika sudah selesai."; pindah ke `selesai` **diizinkan**; pindah dari `selesai` kembali ke `todo` **diizinkan** (sama dengan batal centang).
- Untuk `tiket` dan `komitmen_mingguan`: aturan lama tidak berubah.

**Server action:**
- `ubahStatusTugas` menolak `menunggu_qc` untuk `pribadi`.
- Seret to-do ke Selesai memakai `ubahCentangToDo` (atau perluas action yang ada), bukan jalur QC.

**UI:**
- Kartu to-do pribadi di papan dan daftar menampilkan **checkbox selesai**, dan tombol "Ajukan pemeriksaan" tidak tampil.
- Label kartu membedakan "To-do" dan "Tiket" dengan jelas.

### 1B. Tanggal wajib + pemilih tanggal

**Form to-do (`dialog-todo.tsx`):**
- Tambah isian **Tanggal** (wajib, bawaan hari ini WIB, tidak boleh sebelum hari ini) di samping Jam.
- Jam kosong → simpan `tenggat = <tanggal>T23:59:00+07:00` dan `tanpa_jam = true`.

**Form tiket (`dialog-tiket.tsx`):**
- Tambah isian **Tanggal** (wajib, bawaan hari ini WIB, tidak boleh sebelum hari ini). **Jam wajib** (bawaan 17:00, seperti sekarang).
- Komitmen mingguan: tanggal bawaan tetap akhir pekan (Sabtu), tetapi boleh diganti.

**Database (migration 0180):**
- Tambah kolom `tanpa_jam boolean not null default false`.
- Isi data lama: to-do pribadi yang `tenggat is null` diisi `(created_at di WIB)::date + 23:59 WIB`, dengan `tanpa_jam = true`.
- Setelah itu tambah constraint: `tipe <> 'pribadi' or tenggat is not null`.
- Tiket/komitmen lama yang `tenggat is null` **dibiarkan**. Untuk baris **baru** tiket/komitmen, wajibkan tenggat lewat trigger `BEFORE INSERT`, bukan constraint, karena constraint akan menggagalkan update status tiket lama.
- Server action `tambahToDo` dan `buatTiket` memvalidasi hal yang sama (pesan jelas dalam bahasa Indonesia).

**Tampilan jam:**
- Kartu dengan `tanpa_jam = true` menampilkan tanggal saja, bukan "23.59".

### 1C. Tanggal WIB

- Buat (atau pakai, kalau sudah ada di `src/lib/format.ts`) helper murni `hariIniWib(): string` → `YYYY-MM-DD` di zona Asia/Jakarta.
- Pakai helper ini di `src/app/tugas/page.tsx`, `src/app/beranda/page.tsx`, dan perhitungan `akhirPekan`.
- Tambah unit test: 2026-09-29T17:30:00Z → `2026-09-30`; 2026-09-29T16:59:59Z → `2026-09-29`.

### 1D. Kunci isi tiket untuk pemberi tiket

**Database (migration 0181):** trigger `BEFORE UPDATE` pada `tasks`, `security definer`, `search_path = public`:

```
jika old.tipe <> 'pribadi'
  dan auth.uid() is not null            -- proses sistem/migrasi (service role) tetap boleh
  dan auth.uid() is distinct from old.pembuat_id
  dan salah satu kolom berikut berubah:
      tenggat, tanpa_jam, judul, deskripsi, konteks,
      kriteria_selesai, target_angka, target_satuan,   -- (kolom Fase 3)
      penerima_id, pembuat_id, tipe, goal_id
maka raise exception 'Isi tiket hanya bisa diubah oleh pemberi tiket'
     using errcode = 'insufficient_privilege';
```

- Kolom yang **tetap boleh** diubah penerima: `status`, `hasil_kerja`, dan kolom yang dikelola trigger (`selesai_at`, `updated_at`). Kolom QC tetap dijaga trigger yang ada.
- Nama trigger harus diurutkan agar berjalan **sebelum** `tasks_jaga_status` (trigger berjalan urut abjad; lihat pola `tasks_a_larang_qc_sendiri`). Jika kolom Fase 3 belum ada, tambahkan ke trigger saat Fase 3.

**Fitur "Ubah tenggat" (baru):**
- Server action `ubahTenggatTugas(id, tanggal, jam | null)`:
  - To-do: hanya pemilik.
  - Tiket/komitmen: hanya pembuat; jam wajib.
  - Tanggal tidak boleh sebelum hari ini WIB.
  - Periksa baris tersentuh (`.select("id")`) dan tangani galat `insufficient_privilege` dengan pesan ramah.
- UI: tombol/menu "Ubah tenggat" di kartu **hanya tampil** untuk pemilik to-do atau pembuat tiket. Untuk to-do beri label **"Pindahkan ke tanggal lain"**, karena ini cara menjadwal ulang to-do yang terlambat.
- Trigger yang ada `reset_pengingat_tenggat` otomatis mengirim ulang pengingat. Jangan diubah.

---

## 8. Fase 2: Filter tanggal di papan

**Perilaku:**
- URL parameter `?tanggal=YYYY-MM-DD`. Kalau kosong atau tidak valid, pakai hari ini WIB.
- Di atas papan: tombol **‹** / **›** (mundur/maju satu hari), chip **Kemarin · Hari ini · Besok**, dan pemilih tanggal. Judul menampilkan tanggal terpilih, mis. "Selasa, 16 September 2026".
- Isi kolom:

| Kolom | Isi |
|---|---|
| To Do / Sedang Dikerjakan / Review | Tugas yang statusnya sesuai **dan** tanggal tenggatnya (WIB) = tanggal terpilih |
| + khusus saat tanggal terpilih = **hari ini** | Tugas belum selesai dengan tenggat **sebelum** hari ini tampil **paling atas** dengan label merah "Terlambat · <tanggal>". Tiket lama tanpa tenggat tampil dengan label "Tanpa tenggat" |
| Selesai | Tugas yang `selesai_at` (WIB) = tanggal terpilih |

- Urutan dalam kolom tetap seperti sekarang (prioritas, lalu tenggat).
- Status `revisi` tetap tampil di kolom Sedang Dikerjakan (perilaku `keStatus` yang ada).
- Keterangan jumlah di header ("To-do kamu: x dari y beres") dihitung **untuk tanggal terpilih**.
- Tampilan **Daftar** tetap memakai pengelompokan tenggat yang ada (terlambat/hari ini/besok/nanti), tetapi datanya **tidak boleh terpotong diam-diam** dan tugas selesai tidak dimuat. Pakai `daftar_tugas` atau yang setara.

**Data:**
- Penyaringan tanggal **dikerjakan di database**, bukan dengan menarik semua baris ke browser. Boleh memperluas `daftar_tugas` atau membuat fungsi baru (mis. `papan_tugas(p_tanggal date, p_hari_ini date)`), dengan syarat:
  - fungsi berjalan sebagai **security invoker** (RLS tetap berlaku; jangan `security definer`);
  - memakai `kelompok_tenggat_dari` / `at time zone 'Asia/Jakarta'` yang sudah ada;
  - ada batas aman, dan **bila batas tercapai UI menampilkan pesan** "Menampilkan N tugas pertama". Tidak boleh terpotong diam-diam.
- Perbaiki B6: semua penyaringan "milik saya" memakai **ID pengguna**, bukan nama. Ini berlaku di `ambilToDo`, `riwayatToDo`, `ringkasToDo`, dan pemeriksaan `sayaPenerima` / `bolehQc` di papan yang sekarang membandingkan nama (`t.pembuat.startsWith(namaSaya...)`). Tambahkan `penerimaId`/`pembuatId` ke tipe `Tugas` bila perlu.
- Beranda "To-do hari ini": hanya to-do milik pengguna (by ID) dengan tenggat hari ini WIB + to-do terlambat yang belum selesai.
- Mode demo tetap berjalan dengan data contoh.

---

## 9. Fase 3: SMART

**Database (migration 0182):**
- `kriteria_selesai text not null default ''`
- `target_angka numeric null` (harus > 0 bila diisi)
- `target_satuan text not null default ''` (wajib diisi bila `target_angka` diisi; constraint)
- Trigger `BEFORE INSERT`: tiket/komitmen baru wajib `length(btrim(kriteria_selesai)) >= 5`. Baris lama tidak dipaksa.
- Tambahkan kolom-kolom ini ke trigger kunci Fase 1D.

**Form tiket:**

| Unsur | Isian | Wajib |
|---|---|---|
| S | Judul (placeholder: "Kata kerja + objek, mis. Audit GMV 5 akun beauty") + Deskripsi hasil akhir | Judul wajib (sudah), deskripsi opsional |
| M | **Kriteria selesai** (placeholder: "Tiket dianggap selesai bila …") + Target angka & satuan | Kriteria **wajib**; target opsional |
| A | Info baca-saja di bawah pilihan penerima: "**<Nama> punya N tiket aktif bertenggat <tanggal>**" | Info saja, tidak memblokir |
| R | Goal terkait | Opsional untuk tiket, wajib untuk komitmen (seperti sekarang) |
| T | Tanggal + jam | Wajib (Fase 1B) |

- Info beban (A): server action baru `hitungBebanPenerima(penerimaId, tanggal)` → jumlah tiket + komitmen milik penerima yang belum selesai/dibatalkan dengan tenggat di tanggal itu (WIB). **Jangan menghitung to-do pribadi penerima** (privasi). Tunduk RLS.

**Form to-do:**
- Tambah "Target (opsional)": angka + satuan, mis. 14 sesi. Tidak ada isian wajib baru selain tanggal.

**Kartu & QC:**
- Kartu menampilkan kriteria selesai (dipotong 2 baris, bisa dibuka) dan target bila ada.
- Saat pemeriksa membuka QC, **kriteria selesai ditampilkan di atas ringkasan hasil kerja**, supaya pemeriksa menilai hasil terhadap kriteria yang disepakati.

---

## 10. Edge cases yang wajib ditangani

| Kasus | Perilaku yang diharapkan |
|---|---|
| Tanggal di URL tidak valid (`?tanggal=abc`) | Pakai hari ini WIB, tanpa error |
| Tanggal terpilih tidak punya tugas | Setiap kolom menampilkan empty state yang ada |
| Membuka tanggal lampau | Tugas terlambat tidak ditambahkan (hanya berlaku di hari ini). Tombol tambah to-do tetap membuat to-do untuk hari ini atau setelahnya |
| To-do dibuat pukul 00.30 WIB | Tanggal bawaan = tanggal WIB hari itu, bukan kemarin |
| Tenggat 23.59 WIB | Masuk tanggal itu, bukan besok |
| Penerima memanggil API langsung untuk mengubah tenggat | Database menolak (`insufficient_privilege`); UI menampilkan "Isi tiket hanya bisa diubah oleh pemberi tiket." |
| Manager/CEO mengubah tenggat tiket buatan Leader | Ditolak (D1) |
| Penerima menggeser status tiketnya | Tetap bisa (tidak terkena kunci) |
| Pemberi tiket dinonaktifkan | Tenggat tidak bisa diubah siapa pun lewat UI. **Catat sebagai open question**, jangan dibuat aturan baru |
| To-do lama berstatus `menunggu_qc` | Setelah migration menjadi `berjalan` dan bisa dicentang |
| Dua pengguna bernama sama | To-do tidak tertukar (by ID) |
| Jaringan gagal saat simpan/pindah | Pesan galat tampil; kartu kembali ke posisi semula (pola yang sudah ada) |
| Layar mobile 375px | Strip tanggal muat satu baris (chip boleh digulir mendatar); form tetap bisa dipakai |

---

## 11. Acceptance Criteria

**Fase 1**
1. Given to-do pribadi di kolom Sedang Dikerjakan, when pemilik mencentang, then status menjadi `selesai` dan kartu pindah ke kolom Selesai.
2. Given to-do pribadi, when diseret ke Review, then ditolak dengan pesan yang jelas dan kartu kembali.
3. Given data lama to-do `menunggu_qc`, when migration dijalankan, then statusnya `berjalan` dan tidak ada to-do pribadi berstatus `menunggu_qc`/`revisi`.
4. Given form to-do dengan jam kosong untuk tanggal 2026-10-02, when disimpan, then `tenggat = 2026-10-02 23:59 WIB`, `tanpa_jam = true`, dan kartu tidak menampilkan "23.59".
5. Given form tiket, when tanggal diisi 3 hari ke depan pukul 15.00, then tenggat tersimpan di tanggal dan jam itu (WIB).
6. Given form tiket tanpa jam, when disimpan, then ditolak dengan pesan validasi.
7. Given insert tiket baru tanpa tenggat langsung lewat API, then database menolak.
8. Given penerima tiket, when mencoba mengubah `tenggat` atau `judul` lewat API, then database menolak dengan `insufficient_privilege`.
9. Given pembuat tiket, when memakai "Ubah tenggat", then tenggat berubah dan pengingat tenggat di-reset.
10. Given pukul 00.30 WIB, when halaman Tugas dibuka, then "hari ini" = tanggal WIB saat itu.

**Fase 2**

11. Given `?tanggal=2026-09-16`, then kolom To Do/Dikerjakan/Review hanya berisi tugas bertenggat 16 Sep (WIB), dan kolom Selesai hanya berisi tugas yang selesai 16 Sep.
12. Given melihat hari ini dan ada tiket bertenggat kemarin yang belum selesai, then tiket itu tampil paling atas dengan label "Terlambat".
13. Given melihat besok, then tugas terlambat **tidak** ikut tampil.
14. Given lebih dari 200 tugas di seluruh organisasi, when Manager membuka papan untuk sebuah tanggal, then tidak ada tugas bertanggal itu yang hilang, atau bila batas tercapai, pesan batas tampil.
15. Given dua user bernama sama, then masing-masing hanya melihat to-do miliknya di Beranda dan di papan.

**Fase 3**

16. Given form tiket dengan kriteria selesai kosong, when disimpan, then ditolak (UI dan database).
17. Given target angka diisi tanpa satuan, then ditolak.
18. Given pemberi tiket memilih penerima dan tanggal, then info "N tiket aktif bertenggat <tanggal>" tampil dan angkanya sesuai data.
19. Given tiket di kolom Review, when pemeriksa membuka QC, then kriteria selesai tampil di atas hasil kerja.
20. Given tiket lama tanpa kriteria, then tiket tetap bisa digeser dan di-QC seperti biasa.

---

## 12. Tests Required

**Unit (`src/lib/__tes__/`, jalankan dengan `npm run test:unit`):**
- `kanban.test.ts`: perluas dengan kasus `pribadi` (ke review ditolak, ke selesai boleh, dari selesai ke todo boleh) dan pastikan kasus tiket lama tetap lulus.
- Test helper `hariIniWib` (batas 17:00 UTC).
- Bila logika penyusunan kolom papan per tanggal dipisah ke modul murni (disarankan, mis. `src/lib/papan-tanggal.ts`), tulis test untuk: tanggal biasa, hari ini dengan terlambat, tanggal besok, kolom Selesai memakai `selesai_at`, dan tugas tanpa tenggat.
- Validasi form (kriteria wajib, target + satuan, tanggal tidak boleh lampau) sebagai fungsi murni + test.

**Permission & database (verifikasi manual di database lokal/dev, tulis langkah dan hasilnya di ringkasan akhir):**
- Login sebagai penerima: update `tenggat`/`judul` tiket → ditolak. Update `status` → berhasil.
- Login sebagai pembuat: update `tenggat` → berhasil.
- Login sebagai Manager bukan pembuat: update `tenggat` → ditolak.
- Insert tiket tanpa tenggat / tanpa kriteria → ditolak.
- Migration dijalankan dua kali → tidak error.

**Regression:** alur QC tiket (ajukan → lolos, ajukan → revisi → ajukan ulang), notifikasi tiket baru, dan komitmen mingguan wajib goal tetap berjalan.

---

## 13. Migration, Backward Compatibility, Rollback

- **Backup dulu** tabel `tasks` sebelum migration dijalankan di lingkungan mana pun selain lokal. Tulis perintahnya di ringkasan akhir; jangan jalankan sendiri ke production.
- Semua kolom baru punya default; baris lama tetap valid.
- Tiket lama tanpa tenggat dan tanpa kriteria **tidak dipaksa**. Aturan wajib hanya untuk insert baru.
- **Rollback per migration**: sediakan SQL kebalikan di komentar akhir tiap file (drop trigger/constraint/kolom). Data to-do yang dipindah `menunggu_qc → berjalan` tidak perlu dikembalikan (catat jumlah barisnya).
- Mode demo (`dataContoh`) diperbarui seperlunya agar tetap tampil benar.

## 14. Rollout

1. Selesaikan Fase 1 → uji lokal → commit.
2. Fase 2 → uji → commit.
3. Fase 3 → uji → commit.
4. **Jangan push.** Manager akan mereview lalu merilis dengan pilot terbatas lebih dulu.

## 15. Do Not Change

- Policy `tasks_baca`, `tasks_buat`, `tasks_hapus`.
- Trigger `larang_qc_sendiri`, `jaga_status_tugas`, `reset_pengingat_tenggat`, trigger notifikasi, dan `task_qc_log`.
- Aturan "Selesai untuk tiket ditentukan QC, bukan diseret penerima".
- Perhitungan tanggal di modul selain Tugas dan Beranda.
- File `AGENTS.md` dan konfigurasi build.

## 16. Verification Steps (laporkan di akhir)

Tulis ringkasan akhir berisi:
1. Daftar file yang diubah dan migration baru (0179–0182 atau sesuai urutan).
2. Hasil `typecheck`, `lint`, dan `test:unit`.
3. Hasil uji permission manual (tabel: aksi, akun, hasil).
4. Jumlah baris data lama yang terkena migration (to-do `menunggu_qc/revisi`, to-do tanpa tenggat).
5. Screenshot atau deskripsi papan untuk: hari ini dengan tugas terlambat, tanggal lain, dan tampilan mobile.
6. Temuan di luar scope (mis. tanggal UTC di halaman keuangan/gmv/notifikasi) sebagai daftar tindak lanjut, **tanpa diperbaiki**.
7. Open question yang muncul selama pengerjaan.
