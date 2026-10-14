# K-SPACE — Komisi Wajib + Detail per Akun Affiliator
## SYSTEM DESIGN + BUILD HANDOFF — V1.0

- **Tanggal:** 14 Oktober 2026
- **Penyusun:** AI Product & System Architect
- **Peminta:** Azka (CEO), lewat Kholid (Manager)
- **Repo:** `K-SPACE V2`, dikerjakan **sesudah** `docs/DAFTAR-GOOGLE-PERSETUJUAN.md`
- **Status:** DESIGN FINAL — keputusan Manager di §2 (K1–K7, revisi 14 Okt 2026 17.12)

---

## 1. Permintaan CEO

1. Kartu **Affiliator** di "Metrik utama" (halaman GMV) bisa diklik, lalu menampilkan detail tiap akun.
2. Setiap affiliator menginput **komisi yang masuk setiap hari**, supaya CEO tahu omzet perusahaan.

---

## 2. Keputusan Manager (14 Okt 2026)

| # | Keputusan |
|---|---|
| K1 | Yang diinput adalah **komisi real yang masuk** hari itu (memakai kolom komisi yang sudah ada di Laporan Harian) |
| K2 | Komisi **wajib** diisi. Kalau hari itu tidak ada komisi, isi 0 |
| K3 | Dashboard ditambah **kartu Komisi**. Yang bisa melihat **hanya CEO dan Manager** |
| K4 | Yang bisa diklik untuk melihat detail per akun **hanya kartu Affiliator** |
| K5 | **Mengisi** komisi dan **melihat** komisi adalah dua hak yang berbeda. Siapa pun yang membuat laporan harian akun Affiliator (termasuk asisten input) **wajib mengisi** komisi, tetapi **tidak otomatis bisa melihat** angka komisi yang sudah tersimpan, riwayatnya, maupun totalnya |
| K6 | **CEO dan Manager menentukan** siapa yang boleh melihat komisi, per orang, dengan cakupan: **tidak ada** (bawaan), **akun yang dia pegang**, **akun tertentu** (dipilih satu per satu), atau **semua akun Affiliator**. Berlaku untuk semua peran, termasuk Leader dan Co-Leader. CEO dan Manager selalu bisa melihat semua |
| K7 | Kartu Komisi di dashboard (total omzet) **tetap hanya untuk CEO dan Manager**, siapa pun yang diberi akses lihat |

---

## 3. Current State (FACT dari kode)

| Area | Kondisi sekarang | Bukti |
|---|---|---|
| Input komisi | Sudah ada di Laporan Harian Affiliator, per akun per hari, tetapi **boleh kosong** ("Kosongkan kalau belum ada komisi") | `form-laporan.tsx`, migrasi 0125 |
| Input upload | Kolom `jumlah_upload` per akun per hari sudah ada | migrasi 0125 |
| Batas komisi | Ada aturan database **komisi ≤ GMV hari itu** | constraint `daily_reports_komisi_tak_lebih_dari_gmv` (0125) |
| Siapa bisa membaca komisi | Policy `daily_reports_baca` (0173) memberi akses ke pelapor, **atasannya**, siapa saja yang boleh melihat akunnya, dan lintas angka. Artinya **Leader dan Co-Leader sekarang BISA membaca komisi** bawahannya | migrasi 0173; "Total komisi" tampil di `tabel-riwayat.tsx` |
| Jejak revisi komisi | `daily_report_revisions.komisi_lama/komisi_baru` | migrasi 0127 |
| Data per akun | Halaman Kelola Akun (`/grd/akun`) sudah punya PIC, level, batas minimum, kepatuhan upload, dan GMV per periode. **Belum ada** total upload dan komisi | `src/lib/data/akun.ts` |
| Kartu Metrik utama | GMV, Target, Laporan masuk, Affiliator, MCN, TAP. Belum bisa diklik untuk rincian. Belum ada kartu Komisi | `src/components/gmv/panel-metrik.tsx` |
| GRD | Lead measure bisa bersumber `komisi` | `src/lib/data/grd.ts:117` |

### Dua temuan yang mengubah desain

**T1 — Komisi sekarang bocor ke Leader (bertentangan dengan K5).** Menyembunyikan angka di layar tidak cukup, karena Leader masih bisa membacanya lewat jalur data. Angka komisi harus **dikunci di database**.

**T2 — Aturan "komisi ≤ GMV" bertentangan dengan K1.** Komisi real yang masuk hari ini bisa berasal dari pesanan hari-hari sebelumnya. Contohnya: hari ini GMV Rp 0, tapi ada komisi masuk Rp 50.000. Dengan aturan sekarang, input itu ditolak. Aturan ini **harus dicabut**. Batas wajar (0 sampai 10 miliar) tetap dipertahankan.

---

## 4. Desain

### 4.1 Mengunci komisi (keamanan, P0 untuk pekerjaan ini)

Pendekatan: **kunci kolomnya, buka lewat pintu resmi.** Data tidak dipindahkan, jadi tidak ada migrasi data dan mudah dibatalkan.

1. `REVOKE SELECT (komisi)` pada `daily_reports` dari role `authenticated` dan `anon`. Lakukan juga untuk `komisi_lama` dan `komisi_baru` pada `daily_report_revisions`.
2. Hak menulis kolom komisi (insert/update) **tetap ada**, supaya pelapor bisa mengisinya.
3. Pembacaan komisi hanya lewat fungsi database (security definer):
   - `boleh_lihat_komisi(account_id)` — true bila pemanggil CEO/Manager aktif, atau punya akses lihat komisi (§4.5) yang mencakup akun itu. Satu-satunya penentu; dipakai semua fungsi di bawah.
   - `komisi_akun(rentang, account_id?)` — komisi per akun per hari dan total per akun, **hanya untuk akun yang `boleh_lihat_komisi`**. Akun lain tidak ikut terkirim sama sekali.
   - `komisi_affiliator_total(rentang)` — total seluruh akun untuk kartu dashboard. **Hanya CEO/Manager aktif.**
   - Pelapor **tidak** mendapat jalur khusus untuk membaca komisi laporannya sendiri. Ia hanya melihat angka yang sedang ia ketik di form. Setelah terkirim, angka itu tampil lagi hanya bila ia punya akses lihat untuk akun tersebut.
4. Semua query aplikasi yang memakai `select("*")` atau menyebut `komisi` pada tabel itu diubah agar tidak meminta kolom komisi secara langsung.
5. Tampilan: `tabel-riwayat`, riwayat laporan, capaian pribadi, halaman unit, GRD, dan semua tempat yang menampilkan komisi hanya menampilkan angka untuk akun yang `boleh_lihat_komisi`. Selain itu kolom komisi tidak tampil sama sekali (bukan "0", bukan "—").
6. GRD: lead measure bersumber `komisi` hanya menampilkan angka kepada yang boleh melihat komisi seluruh akun di cakupan lead measure itu. Selain itu tampil "Rahasia". **Developer wajib melaporkan di PR berapa lead measure yang bersumber komisi.**

### 4.2 Komisi wajib

| Aturan | Detail |
|---|---|
| BR-K1 | Laporan harian untuk **akun unit Affiliator** wajib berisi komisi (≥ 0). Form tidak bisa dikirim bila kosong. Bantuan teks diganti menjadi: "Isi 0 kalau hari ini tidak ada komisi masuk." |
| BR-K2 | Dijaga juga di database: trigger menolak laporan **baru** akun Affiliator dengan komisi null. Laporan lama **tidak diubah** |
| BR-K3 | Constraint `komisi ≤ GMV` dicabut (T2). Constraint batas wajar tetap |
| BR-K4 | Unit MCN dan TAP tidak berubah (komisi tetap null) |
| BR-K5 | Revisi komisi tetap tercatat di `daily_report_revisions` (sudah ada). Angka lama/baru hanya terbaca oleh yang `boleh_lihat_komisi` untuk akun itu |
| BR-K6 | Pelapor tanpa akses lihat tetap bisa **memperbaiki** komisi laporannya selama jendela perbaikan yang sudah ada, dengan mengetik ulang angka penuh. Angka lama tidak ditampilkan kepadanya |

### 4.3 Kartu Komisi di dashboard

- Kartu **"Komisi Affiliator"** ditambahkan di Metrik utama, dengan perbandingan terhadap periode lalu seperti kartu lain.
- **Hanya dirender untuk CEO dan Manager.** Datanya diambil dari `komisi_affiliator()` sehingga tetap aman walau kodenya dibuka.
- Di bawah angka ada keterangan kelengkapan: **"x dari y laporan berisi komisi"**. Alasannya, laporan sebelum aturan wajib bisa kosong, dan CEO perlu tahu angkanya belum lengkap, bukan mengira omzet turun.

### 4.4 Detail per akun Affiliator

**Pemicu:** CEO/Manager mengklik kartu Affiliator, atau tombol "Lihat per akun" di kartu itu. Untuk peran lain, kartu tetap seperti sekarang dan tidak bisa diklik.

**Tujuan:** halaman `/gmv/affiliator`, mengikuti periode yang sedang dipilih di dashboard. Halaman ini dijaga di server; selain CEO/Manager diarahkan kembali.

**Untuk orang yang diberi akses lihat komisi (§4.5):** ia tidak membuka halaman ini. Komisi akun dalam cakupannya tampil di tempat yang sudah ia pakai: Kelola Akun (kolom komisi periode) dan riwayat laporan akun itu.

**Isi tabel, satu baris per akun Affiliator:**

| Kolom | Sumber |
|---|---|
| Akun (username) + status aktif/nonaktif | `accounts` |
| PIC | `accounts` → users |
| Level | `accounts.level` |
| Total upload periode | jumlah `daily_reports.jumlah_upload` |
| Rata-rata upload per hari kerja vs minimum level | logika kepatuhan yang sudah ada (`batas-minimum.ts`) |
| Kepatuhan minimum (%) | `kepatuhanSemuaAkun` yang sudah ada |
| GMV periode | `daily_reports.gmv` |
| Komisi periode | `komisi_affiliator()` |
| Hari lapor / hari kerja | hitungan laporan |

- Baris **Total** di atas tabel: total upload, GMV, komisi.
- Bisa diurutkan per kolom. Default: GMV terbesar.
- Akun aktif tanpa laporan di periode itu **tetap tampil** dengan nilai 0 dan ditandai, karena itulah yang paling perlu dilihat CEO.
- Akun nonaktif tampil hanya bila punya GMV atau komisi di periode itu.
- Tampilan HP: berbentuk kartu per akun.
- **Extend, jangan rebuild:** pakai ulang `src/lib/data/akun.ts`, `kepatuhanSemuaAkun`, `jejakLevelSemuaAkun`, dan pemilih periode yang sudah ada.

### 4.5 Akses lihat komisi (diatur CEO/Manager)

**Tempat mengatur:** kartu anggota di menu Tim → bagian **"Akses lihat komisi"**. Hanya tampil dan bisa diubah oleh CEO/Manager.

| Pilihan | Artinya |
|---|---|
| **Tidak ada** (bawaan untuk semua orang) | Tidak melihat angka komisi apa pun, termasuk laporannya sendiri setelah terkirim |
| **Akun yang dia pegang** | Melihat komisi akun yang **saat ini** ia pegang sebagai PIC. Ikut berubah otomatis bila akun dipindah PIC |
| **Akun tertentu** | Melihat komisi akun yang dipilih satu per satu oleh CEO/Manager |
| **Semua akun Affiliator** | Melihat komisi seluruh akun Affiliator, tetapi **tidak** kartu total di dashboard (K7) |

**Data:**
- Tabel `akses_komisi`: `user_id` (PK), `cakupan` (`pegangan / tertentu / semua`), `diberi_oleh`, `diberi_pada`. Tanpa baris = tidak ada akses.
- Tabel `akses_komisi_akun`: `user_id`, `account_id` (PK gabungan), untuk cakupan `tertentu`.
- Tabel `riwayat_akses_komisi`: setiap pemberian, perubahan, dan pencabutan dicatat (siapa, kapan, dari apa, menjadi apa). Tidak bisa diubah atau dihapus.
- RLS: hanya CEO/Manager aktif yang boleh membaca dan menulis ketiga tabel. Orang yang bersangkutan boleh membaca baris `akses_komisi` miliknya sendiri (supaya aplikasi tahu harus menampilkan apa).

**Aturan:**
- Orang yang dinonaktifkan otomatis kehilangan akses (dijamin oleh `anggota_aktif()`), tanpa perlu dicabut manual.
- Pindah unit atau peran **tidak** mengubah akses komisi secara otomatis. CEO/Manager yang memutuskan.
- Akses berlaku untuk akun **Affiliator** saja (unit lain tidak punya komisi).

---

## 5. Permission Matrix — komisi

| Siapa | Mengisi komisi di laporan | Melihat komisi tersimpan / riwayat / total per akun | Kartu total Komisi | Halaman detail per akun | Mengatur akses lihat |
|---|---|---|---|---|---|
| Pelapor akun Affiliator (Staff, asisten input, Co-Leader, Leader) | ✔ wajib | Hanya sesuai **akses lihat** yang diberikan (bawaan: tidak ada) | ✘ | ✘ | ✘ |
| Finance | — | Sesuai akses lihat (bawaan: tidak ada) | ✘ | ✘ | ✘ |
| Manager | — | ✔ semua | ✔ | ✔ | ✔ |
| CEO | — | ✔ semua | ✔ | ✔ | ✔ |

Leader dan Co-Leader **tetap** melihat GMV dan upload anggotanya seperti sekarang. Yang diatur hanya komisi.

---

## 6. Edge Cases

| # | Kasus | Perilaku yang benar |
|---|---|---|
| E1 | Komisi masuk tapi GMV hari itu 0 | Diterima (T2) |
| E2 | Laporan lama sebelum wajib, komisi kosong | Tetap kosong; dihitung di keterangan "x dari y laporan" |
| E3 | Leader memanggil API Supabase langsung meminta kolom komisi | Ditolak database (permission denied) |
| E4 | Leader membuka riwayat laporan bawahannya | GMV dan upload tampil; kolom komisi dan "Total komisi" tidak tampil |
| E5 | Pelapor memperbaiki komisi laporannya | Jejak revisi tercatat; Leader tidak melihat angka lama maupun baru |
| E6 | Akun pindah PIC di tengah periode | Baris akun menampilkan PIC saat ini; angka dihitung per akun, bukan per orang |
| E7 | Akun belum punya level | Kolom level "—", kepatuhan "belum dinilai" (sudah ditangani `KEPATUHAN_KOSONG`) |
| E8 | Periode tanpa data | Tabel kosong dengan pesan "Belum ada laporan Affiliator di periode ini" |
| E9 | Lead measure GRD bersumber komisi milik Leader | Angka disembunyikan untuk Leader ("Rahasia"); dilaporkan di PR untuk diputuskan Manager |
| E11 | Asisten tanpa akses salah ketik komisi kemarin | Ia membuka laporan itu, kolom komisi kosong dengan keterangan "Angka tersimpan tidak ditampilkan. Ketik ulang angka yang benar bila perlu diperbaiki." |
| E12 | Orang dengan cakupan "akun yang dia pegang", lalu akunnya dipindah ke PIC lain | Sejak saat itu komisi akun tersebut tidak lagi terlihat olehnya, termasuk riwayat lamanya |
| E13 | Cakupan "akun tertentu" berisi akun yang kemudian dinonaktifkan | Akses tetap ada (riwayat tetap bisa dibaca) sampai dicabut CEO/Manager |
| E10 | Laporan diisi via migrasi data lama (`migrasi_tulis_laporan`) | Trigger wajib-komisi hanya berlaku untuk laporan baru dari form/aplikasi, tidak memblokir migrasi data lama |

---

## 7. Acceptance Criteria

1. Given Staff Affiliator, when mengirim laporan akun tanpa komisi, then form menolak dengan pesan "Isi 0 kalau hari ini tidak ada komisi masuk."
2. Given Staff Affiliator, when mengisi komisi Rp 50.000 dengan GMV Rp 0, then laporan tersimpan.
3. Given Leader Affiliator, when query `daily_reports` dengan kolom komisi lewat API, then ditolak; when membuka riwayat laporan bawahannya, then kolom komisi tidak tampil.
4. Given Leader atau Co-Leader, when membuka `/gmv/affiliator`, then diarahkan kembali dan tidak ada data yang terkirim ke browser.
5. Given asisten input tanpa akses lihat, when mengirim laporan dengan komisi lalu membuka riwayatnya, then angka komisi dan total komisi tidak tampil, dan query API untuk komisi itu mengembalikan kosong/ditolak.
6. Given CEO atau Manager, when membuka dashboard GMV, then kartu "Komisi Affiliator" tampil dengan total yang sama persis dengan jumlah komisi seluruh laporan akun Affiliator di periode itu, beserta keterangan "x dari y laporan berisi komisi".
7. Given CEO atau Manager, when mengklik kartu Affiliator, then terbuka tabel per akun untuk periode yang sama; total GMV di tabel = angka kartu Affiliator.
8. Given akun Affiliator aktif tanpa laporan di periode itu, then tetap tampil dengan nilai 0 dan ditandai.
9. Given unit MCN atau TAP, then form, kartu, dan perilakunya tidak berubah.
10. Seluruh test lama tetap lulus, termasuk test laporan, capaian, dan GRD.
11. Given Manager memberi seorang Staff akses "akun yang dia pegang", when Staff itu membuka Kelola Akun dan riwayat laporan, then komisi **hanya** akun yang ia pegang yang tampil; akun lain tidak ikut terkirim ke browser.
12. Given akses "akun tertentu" berisi akun A dan B, then hanya komisi A dan B yang terbaca, termasuk lewat API langsung.
13. Given akses "semua akun Affiliator", then komisi semua akun Affiliator terbaca, tetapi kartu total Komisi di dashboard tetap tidak tampil.
14. Given Leader tanpa akses yang diberikan, then ia tidak melihat komisi apa pun, termasuk akun yang ia pegang sendiri.
15. Given Leader atau Staff, when mencoba mengubah akses komisi siapa pun (termasuk dirinya) lewat UI atau API, then ditolak.
16. Given Manager mengubah atau mencabut akses, then `riwayat_akses_komisi` mencatat siapa, kapan, sebelum, dan sesudahnya.

---

## 8. Aturan kerja Claude Code (wajib diikuti)

- Dikerjakan **setelah** pekerjaan `docs/DAFTAR-GOOGLE-PERSETUJUAN.md` selesai dan PR-nya dibuat.
- Branch `fitur/komisi-detail-akun-affiliator`, **dibuat dari** branch `fitur/daftar-google-persetujuan` (karena memakai `anggota_aktif()`). Satu PR terpisah, **JANGAN merge**.
- Migrasi baru mulai `0210_...` (0208–0209 dipakai pekerjaan Google).
- Urutan commit: (1) kunci komisi + `boleh_lihat_komisi` + tabel akses lihat komisi, (2) pengaturan akses di kartu anggota, (3) komisi wajib + cabut constraint ≤ GMV, (4) kartu Komisi, (5) halaman detail per akun + kolom komisi di Kelola Akun sesuai akses.
- Jangan lanjut ke commit berikutnya sebelum test commit itu lulus. Kalau gagal dan tidak bisa diperbaiki, berhenti dan laporkan.
- Tulis test untuk Acceptance Criteria 1–16, terutama test izin (AC 3, 4, 5, 11–15).
- Jangan memindahkan atau menghapus data komisi lama.
- Jangan ubah perilaku unit MCN/TAP, aturan hierarki, maupun hak Leader atas GMV/upload.
- Hal yang tidak tercakup dokumen: jangan diputuskan sendiri. Catat sebagai "NEEDS MANAGER DECISION" di deskripsi PR dan pilih opsi yang paling aman (yang paling sedikit membuka komisi).

**Deskripsi PR wajib memuat**
- Daftar semua grant/revoke, fungsi, dan policy database yang diubah.
- Daftar semua file/halaman yang tadinya menampilkan komisi dan perlakuannya sekarang.
- Jumlah lead measure GRD yang bersumber komisi.
- Hasil test per Acceptance Criteria.
- Langkah uji manual untuk Manager (maks. 10 langkah, bahasa sederhana).
