# K-SPACE — Komisi Wajib + Detail per Akun Affiliator
## SYSTEM DESIGN + BUILD HANDOFF — V1.0

- **Tanggal:** 14 Oktober 2026
- **Penyusun:** AI Product & System Architect
- **Peminta:** Azka (CEO), lewat Kholid (Manager)
- **Repo:** `K-SPACE V2`, dikerjakan **sesudah** `docs/DAFTAR-GOOGLE-PERSETUJUAN.md`
- **Status:** DESIGN FINAL — keputusan Manager di §2

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
| K5 | Detail per akun hanya untuk **CEO dan Manager**. **Komisi bersifat rahasia**: Leader dan Co-Leader **tidak boleh melihat angka komisi apa pun** — tidak komisi anggotanya, tidak total komisi, dan tidak juga riwayat komisi laporannya sendiri. Mereka tetap bisa **mengisi** komisi saat melapor akun yang mereka pegang |

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
   - `komisi_laporan_saya(...)` — pelapor berperan **Staff** membaca komisi laporannya sendiri (supaya riwayat pribadi dan capaian pribadi tetap jalan). Untuk **Leader dan Co-Leader fungsi ini mengembalikan kosong**: mereka bisa mengisi komisi di form, tetapi setelah terkirim angkanya tidak ditampilkan lagi di mana pun.
   - `komisi_affiliator(rentang)` — total dan rincian per akun. **Hanya CEO/Manager aktif**; selain itu error/kosong.
4. Semua query aplikasi yang memakai `select("*")` atau menyebut `komisi` pada tabel itu diubah agar tidak meminta kolom komisi secara langsung.
5. Tampilan: `tabel-riwayat` (riwayat milik orang lain), halaman unit, GRD, dan semua tempat yang menampilkan komisi disembunyikan untuk selain pelapor sendiri, CEO, dan Manager.
6. GRD: lead measure bersumber `komisi` hanya menampilkan angka kepada CEO/Manager. Untuk peran lain tampil "Rahasia". **Developer wajib melaporkan di PR berapa lead measure yang bersumber komisi.**

### 4.2 Komisi wajib

| Aturan | Detail |
|---|---|
| BR-K1 | Laporan harian untuk **akun unit Affiliator** wajib berisi komisi (≥ 0). Form tidak bisa dikirim bila kosong. Bantuan teks diganti menjadi: "Isi 0 kalau hari ini tidak ada komisi masuk." |
| BR-K2 | Dijaga juga di database: trigger menolak laporan **baru** akun Affiliator dengan komisi null. Laporan lama **tidak diubah** |
| BR-K3 | Constraint `komisi ≤ GMV` dicabut (T2). Constraint batas wajar tetap |
| BR-K4 | Unit MCN dan TAP tidak berubah (komisi tetap null) |
| BR-K5 | Revisi komisi tetap tercatat di `daily_report_revisions` (sudah ada). Hanya CEO/Manager dan pelapornya yang bisa membaca angkanya |

### 4.3 Kartu Komisi di dashboard

- Kartu **"Komisi Affiliator"** ditambahkan di Metrik utama, dengan perbandingan terhadap periode lalu seperti kartu lain.
- **Hanya dirender untuk CEO dan Manager.** Datanya diambil dari `komisi_affiliator()` sehingga tetap aman walau kodenya dibuka.
- Di bawah angka ada keterangan kelengkapan: **"x dari y laporan berisi komisi"**. Alasannya, laporan sebelum aturan wajib bisa kosong, dan CEO perlu tahu angkanya belum lengkap, bukan mengira omzet turun.

### 4.4 Detail per akun Affiliator

**Pemicu:** CEO/Manager mengklik kartu Affiliator, atau tombol "Lihat per akun" di kartu itu. Untuk peran lain, kartu tetap seperti sekarang dan tidak bisa diklik.

**Tujuan:** halaman `/gmv/affiliator`, mengikuti periode yang sedang dipilih di dashboard. Halaman ini dijaga di server; selain CEO/Manager diarahkan kembali.

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

---

## 5. Permission Matrix — angka komisi

| Siapa | Komisi laporan sendiri | Komisi orang lain / per akun | Kartu Komisi | Detail per akun |
|---|---|---|---|---|
| Staff (pelapor) | ✔ baca & isi | ✘ | ✘ | ✘ |
| Co-Leader | Isi saja, ✘ baca | ✘ | ✘ | ✘ |
| Leader | Isi saja, ✘ baca | ✘ | ✘ | ✘ |
| Finance | — | ✘ | ✘ | ✘ |
| Manager | — | ✔ | ✔ | ✔ |
| CEO | — | ✔ | ✔ | ✔ |

Leader dan Co-Leader **tetap** melihat GMV dan upload anggotanya seperti sekarang. Yang dirahasiakan hanya komisi.

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
| E10 | Laporan diisi via migrasi data lama (`migrasi_tulis_laporan`) | Trigger wajib-komisi hanya berlaku untuk laporan baru dari form/aplikasi, tidak memblokir migrasi data lama |

---

## 7. Acceptance Criteria

1. Given Staff Affiliator, when mengirim laporan akun tanpa komisi, then form menolak dengan pesan "Isi 0 kalau hari ini tidak ada komisi masuk."
2. Given Staff Affiliator, when mengisi komisi Rp 50.000 dengan GMV Rp 0, then laporan tersimpan.
3. Given Leader Affiliator, when query `daily_reports` dengan kolom komisi lewat API, then ditolak; when membuka riwayat laporan bawahannya, then kolom komisi tidak tampil.
4. Given Leader atau Co-Leader, when membuka `/gmv/affiliator`, then diarahkan kembali dan tidak ada data yang terkirim ke browser.
5. Given Staff, when membuka riwayat laporannya sendiri, then komisinya tampil seperti sekarang. Given Leader atau Co-Leader, when membuka riwayat atau capaian pribadinya, then tidak ada angka komisi maupun total komisi yang tampil (form tetap meminta komisi saat melapor akun yang ia pegang).
6. Given CEO atau Manager, when membuka dashboard GMV, then kartu "Komisi Affiliator" tampil dengan total yang sama persis dengan jumlah komisi seluruh laporan akun Affiliator di periode itu, beserta keterangan "x dari y laporan berisi komisi".
7. Given CEO atau Manager, when mengklik kartu Affiliator, then terbuka tabel per akun untuk periode yang sama; total GMV di tabel = angka kartu Affiliator.
8. Given akun Affiliator aktif tanpa laporan di periode itu, then tetap tampil dengan nilai 0 dan ditandai.
9. Given unit MCN atau TAP, then form, kartu, dan perilakunya tidak berubah.
10. Seluruh test lama tetap lulus, termasuk test laporan, capaian, dan GRD.

---

## 8. Aturan kerja Claude Code (wajib diikuti)

- Dikerjakan **setelah** pekerjaan `docs/DAFTAR-GOOGLE-PERSETUJUAN.md` selesai dan PR-nya dibuat.
- Branch `fitur/komisi-detail-akun-affiliator`, **dibuat dari** branch `fitur/daftar-google-persetujuan` (karena memakai `anggota_aktif()`). Satu PR terpisah, **JANGAN merge**.
- Migrasi baru mulai `0210_...` (0208–0209 dipakai pekerjaan Google).
- Urutan commit: (1) kunci komisi + fungsi baca, (2) komisi wajib + cabut constraint ≤ GMV, (3) kartu Komisi, (4) halaman detail per akun.
- Jangan lanjut ke commit berikutnya sebelum test commit itu lulus. Kalau gagal dan tidak bisa diperbaiki, berhenti dan laporkan.
- Tulis test untuk Acceptance Criteria 1–10, terutama test izin per peran (AC 3, 4, 5).
- Jangan memindahkan atau menghapus data komisi lama.
- Jangan ubah perilaku unit MCN/TAP, aturan hierarki, maupun hak Leader atas GMV/upload.
- Hal yang tidak tercakup dokumen: jangan diputuskan sendiri. Catat sebagai "NEEDS MANAGER DECISION" di deskripsi PR dan pilih opsi yang paling aman (yang paling sedikit membuka komisi).

**Deskripsi PR wajib memuat**
- Daftar semua grant/revoke, fungsi, dan policy database yang diubah.
- Daftar semua file/halaman yang tadinya menampilkan komisi dan perlakuannya sekarang.
- Jumlah lead measure GRD yang bersumber komisi.
- Hasil test per Acceptance Criteria.
- Langkah uji manual untuk Manager (maks. 10 langkah, bahasa sederhana).
