# K-SPACE — Naik/Turun per Akun + Halaman Detail Akun dengan Grafik
## SYSTEM DESIGN + BUILD HANDOFF — V1.0

- **Tanggal:** 15 Oktober 2026
- **Penyusun:** AI Product & System Architect
- **Peminta:** Azka (CEO), lewat Kholid (Manager)
- **Repo:** `K-SPACE V2`, dari `main` @ `2e9d70d` (sesudah PR #22)
- **Status:** DESIGN FINAL — keputusan Manager di §2

---

## 1. Permintaan

Dari tabel "Detail akun Affiliator" (`/gmv/affiliator`), CEO ingin:
1. Langsung melihat akun mana yang **naik atau turun** dibanding periode sebelumnya.
2. **Klik satu akun**, lalu masuk ke halaman detail akun dengan **grafik**, mirip TikTok Affiliate Partner Center.

---

## 2. Keputusan Manager (15 Okt 2026)

| # | Keputusan |
|---|---|
| D1 | Tabel per akun diberi **penanda naik/turun** dibanding periode lalu |
| D2 | **Tidak ada input harian baru.** Grafik hanya memakai data yang sudah dilaporkan: **GMV, komisi, jumlah upload** |
| D3 | Akses halaman detail: **CEO/Manager** semua akun; **PIC dan Leader** akun dalam lingkupnya (GMV & upload); **grafik/angka komisi hanya bagi yang `boleh_lihat_komisi(akun)`** |
| D4 | Tata letak dirancang Architect (tidak ada contoh dari CEO) |

---

## 3. Current State (FACT dari kode)

| Area | Kondisi | Bukti |
|---|---|---|
| Tabel per akun | `/gmv/affiliator`, CEO/Manager saja; kolom Akun, PIC, Level, Upload, Rata/hari vs min., Kepatuhan, GMV, Komisi, Lapor/kerja. Belum ada naik/turun, baris belum bisa diklik | `src/app/gmv/affiliator/page.tsx`, `src/components/gmv/tabel-akun-affiliator.tsx`, `src/lib/data/akun-affiliator.ts` |
| Pembanding periode lalu | Sudah ada dan dipakai kartu Metrik utama ("vs periode lalu") | `bandingkan()` di `src/lib/gmv.ts` |
| Komponen grafik | Sudah ada, tanpa library tambahan: `GrafikBanding` (periode ini vs lalu, sorotan per titik), `GrafikDasar` | `src/components/shared/grafik-banding.tsx`, `grafik-dasar.tsx`, `src/lib/grafik.ts` |
| Pemilih periode | Harian / Mingguan / Bulanan / Tahunan / Custom | dipakai di `/gmv` dan `/gmv/affiliator` |
| Siapa boleh melihat akun | Policy `accounts_baca` (0173): lintas angka, PIC, co-leader, atasan PIC, Leader unit untuk akun tanpa PIC | migrasi 0173 |
| Komisi per akun per hari | Fungsi `komisi_akun(dari, sampai, akun?)` yang sudah menegakkan `boleh_lihat_komisi` | migrasi 0212 |
| Riwayat level & kepatuhan | `jejakLevelSemuaAkun`, `kepatuhanSemuaAkun`, `batas-minimum.ts` | `src/lib/data/akun.ts`, `kepatuhan.ts` |
| Kelola Akun | `/grd/akun`, dipakai PIC/Leader untuk akun lingkupnya | `src/app/grd/akun/page.tsx` |

**Kesimpulan:** tidak perlu tabel baru, input baru, maupun library grafik baru. Semua data sudah ada dan sudah dijaga database. Pekerjaannya adalah **membaca dan menampilkan**.

---

## 4. Bagian A — Naik/turun di tabel per akun

- Di bawah angka **GMV**, **Komisi**, dan **Upload** setiap baris ditampilkan perubahan dibanding periode lalu, contoh: `▲ 12,4%` (hijau) atau `▼ 8,1%` (merah).
- **Periode lalu** dihitung dengan logika yang sama persis dengan kartu Metrik utama (`bandingkan()`), supaya angka di dua halaman tidak pernah berbeda cara hitungnya.
- Aturan tampilan:

| Kondisi | Tampilan |
|---|---|
| Periode lalu > 0 | `▲ x%` / `▼ x%` / `= 0%` |
| Periode lalu 0, periode ini > 0 | `Baru` |
| Keduanya 0 | `—` |

- Kolom bisa diurutkan berdasarkan **perubahan GMV** (tambahan pilihan urut "Turun terbanyak"), supaya akun yang perlu perhatian langsung terlihat di atas.
- **Nama akun bisa diklik** dan membuka halaman detail akun (Bagian B).

---

## 5. Bagian B — Halaman Detail Akun

### 5.1 Alamat dan akses

- Alamat: **`/akun/[id]`**.
- Pintu masuk:
  - Klik nama akun di `/gmv/affiliator` (CEO/Manager).
  - Klik nama akun di **Kelola Akun** (`/grd/akun`) (semua yang bisa melihat akun itu).
- **Penjaga:** server membaca akun lewat klien biasa (RLS `accounts_baca`). Kalau akun tidak terbaca, tampilkan halaman "Akun tidak ditemukan atau Anda tidak punya akses" (status 404). Jangan pakai klien admin.
- **Komisi:** semua angka komisi diambil hanya lewat `komisi_akun()`. Kalau `boleh_lihat_komisi(akun)` bernilai false, **seluruh bagian komisi tidak dirender** dan tidak ada data komisi yang dikirim ke browser.
- Halaman ini berlaku untuk **akun unit mana pun yang punya laporan**, tetapi bagian komisi hanya relevan untuk Affiliator.

### 5.2 Susunan halaman (dari atas ke bawah)

**1. Kepala akun**
- Username akun, status (Aktif/Nonaktif), unit, PIC, level saat ini, batas minimum upload per hari.
- Tombol kembali ke halaman asal.

**2. Pemilih periode**
- Pemilih periode yang sama dengan dasbor (Harian/Mingguan/Bulanan/Tahunan/Custom).
- Periode yang sedang aktif di `/gmv/affiliator` ikut terbawa saat akun diklik.

**3. Kartu ringkasan** (gaya kartu Metrik utama)

| Kartu | Isi | Muncul untuk |
|---|---|---|
| GMV | total periode + `vs periode lalu` | semua yang boleh membuka |
| Komisi | total periode + `vs periode lalu` | hanya `boleh_lihat_komisi` |
| Upload | total periode + `vs periode lalu` | semua |
| Kepatuhan minimum | % hari kerja yang memenuhi minimum level | semua |
| Hari lapor | lapor / hari kerja | semua |

**4. Grafik utama**
- Satu grafik dengan **tab pilihan metrik**: GMV · Komisi · Upload. Tab Komisi hanya muncul bila boleh melihat komisi.
- Memakai `GrafikBanding`: **garis periode ini (tebal)** dibanding **garis periode lalu (putus-putus)**, dengan sorotan nilai per titik saat disentuh atau dilewati kursor.
- Tab **Upload** memiliki **garis batas minimum** level akun.
- Ukuran titik:

| Panjang rentang | Satu titik = |
|---|---|
| Mode Harian | grafik menampilkan **14 hari terakhir** sampai tanggal terpilih, per hari |
| ≤ 62 hari | per hari |
| > 62 hari (mis. Tahunan) | per bulan |

- **Hari tanpa laporan** digambar sebagai celah atau titik kosong, **bukan nol**, dan diberi keterangan "tidak lapor". Hari libur atau izin tidak dihitung sebagai tidak lapor (pakai logika kepatuhan yang sudah ada).

**5. Sorotan singkat** (dihitung otomatis, tanpa AI)
- Hari dengan GMV tertinggi pada periode ini.
- Rata-rata GMV per hari lapor.
- Jumlah hari kerja yang tidak memenuhi minimum upload.

**6. Tabel harian**
- Kolom: Tanggal · GMV · Komisi (hanya bila boleh) · Upload · Minimum · Status (Memenuhi / Di bawah minimum / Tidak lapor / Libur-Izin).
- Urutan terbaru di atas. Di HP tampil sebagai kartu.

**7. Riwayat level**
- Daftar perubahan level akun (dari `jejakLevel` yang sudah ada): tanggal, dari level, ke level, oleh siapa.

### 5.3 Permission Matrix

| Siapa | Buka `/akun/[id]` | GMV & upload | Komisi |
|---|---|---|---|
| CEO / Manager | semua akun | ✔ | ✔ |
| Finance (lintas angka) | semua akun yang terbaca | ✔ | hanya bila diberi akses lihat komisi |
| Leader | akun yang terbaca lewat `accounts_baca` | ✔ | hanya bila diberi akses lihat komisi |
| Co-Leader | akun yang ia dampingi / terbaca | ✔ | hanya bila diberi akses lihat komisi |
| Staff (PIC) | akun yang ia pegang | ✔ | hanya bila diberi akses lihat komisi |
| Lainnya | ✘ (halaman tidak ditemukan) | ✘ | ✘ |

Tabel `/gmv/affiliator` **tetap** hanya untuk CEO/Manager (tidak berubah).

---

## 6. Edge Cases

| # | Kasus | Perilaku |
|---|---|---|
| E1 | Akun baru, belum ada data periode lalu | Kartu menampilkan "Baru", garis periode lalu tidak digambar |
| E2 | Periode tanpa laporan sama sekali | Kartu 0, grafik kosong dengan pesan "Belum ada laporan akun ini di periode ini" |
| E3 | Akun nonaktif | Tetap bisa dibuka (riwayat), label "Nonaktif" |
| E4 | Akun pindah PIC di tengah periode | Angka tetap per akun. PIC lama kehilangan akses sesuai RLS yang sudah ada |
| E5 | ID akun tidak valid atau milik lingkup lain | 404 "Akun tidak ditemukan atau Anda tidak punya akses" |
| E6 | Orang tanpa akses komisi memanggil fungsi komisi lewat API | Kosong (sudah dijaga `komisi_akun`) |
| E7 | Komisi > GMV di satu hari | Tampil apa adanya (sah sejak 0211) |
| E8 | Rentang Custom sangat panjang (> 1 tahun) | Titik per bulan, tetap cepat |
| E9 | Tampilan HP | Kartu bertumpuk, grafik selebar layar, tabel menjadi kartu |
| E10 | Laporan tingkat unit tanpa akun | Tidak muncul di halaman akun (hanya di baris khusus tabel `/gmv/affiliator`) |

---

## 7. Acceptance Criteria

1. Given Manager di `/gmv/affiliator` periode Oktober, then setiap baris menampilkan perubahan GMV, komisi, dan upload terhadap periode lalu, dengan angka yang dihitung oleh `bandingkan()` yang sama dengan kartu Metrik utama.
2. Given akun tanpa data periode lalu, then tampil "Baru"; given keduanya 0, then tampil "—".
3. Given Manager mengklik nama akun, then terbuka `/akun/[id]` dengan periode yang sama.
4. Given halaman detail, then total GMV kartu = nilai GMV akun itu di tabel `/gmv/affiliator` untuk periode yang sama (selisih 0).
5. Given Leader Affiliator tanpa akses komisi membuka akun di unitnya dari Kelola Akun, then GMV, upload, grafik, dan tabel harian tampil; kartu Komisi, tab Komisi, dan kolom Komisi tidak ada, dan respons halaman tidak memuat angka komisi.
6. Given Staff yang diberi akses "akun yang dia pegang", then ia melihat komisi akunnya sendiri di halaman detail, tetapi membuka akun orang lain menghasilkan 404.
7. Given Staff membuka `/akun/<id akun orang lain>`, then 404.
8. Given hari kerja tanpa laporan, then grafik menampilkan celah berlabel "tidak lapor" (bukan 0), dan tabel harian berstatus "Tidak lapor".
9. Given mode Harian, then grafik menampilkan 14 hari terakhir; given Tahunan, then titik per bulan.
10. Given tab Upload, then garis batas minimum level tampil.
11. Halaman nyaman dipakai di layar HP (tanpa geser ke samping).
12. Seluruh test lama tetap lulus.

---

## 8. Aturan kerja Claude Code (wajib diikuti)

- Branch baru dari `main`: `fitur/detail-per-akun-grafik`.
- **Extend, jangan rebuild:** pakai `bandingkan()`, `GrafikBanding`/`GrafikDasar`, `src/lib/grafik.ts`, pemilih periode, `detailAkunAffiliator`, `kepatuhanSemuaAkun`, `jejakLevelSemuaAkun`, `komisi_akun()`. **Jangan menambah library grafik baru.**
- Diharapkan **tidak ada migrasi database**. Kalau ternyata perlu fungsi baca baru, nomornya mulai `0213`, wajib security definer dengan penjaga yang sama (`anggota_aktif()`, `accounts_baca`, `boleh_lihat_komisi`), dan test izinnya wajib ditulis.
- Urutan commit: (1) naik/turun di tabel + nama akun bisa diklik, (2) halaman `/akun/[id]` + kartu + grafik, (3) tabel harian + sorotan + riwayat level + tautan dari Kelola Akun.
- Tulis test untuk AC 1–12, terutama izin (AC 5, 6, 7) dan kecocokan angka (AC 4).
- Cek tampilan di preview sebagai Manager, Leader tanpa akses komisi, dan Staff PIC (desktop dan lebar HP).
- Jalankan lint, typecheck, unit test, schema test, dan build sebelum rilis.
- Hal yang tidak tercakup dokumen: jangan diputuskan sendiri. Pilih opsi paling aman (paling sedikit membuka komisi), catat sebagai "NEEDS MANAGER DECISION" di deskripsi PR.

### Rilis
1. Jalankan `node --env-file=.env.local scripts/backup-produksi.mjs` (backup dulu).
2. Publish branch dan buat PR ke `main`, deskripsi ditulis di `docs/PR-DETAIL-PER-AKUN.md`.
3. Kalau ada migrasi: `db push` dulu, lalu segera merge. Kalau tidak ada migrasi: langsung merge.
4. Tunggu Vercel selesai, lalu cek `/gmv/affiliator` dan satu `/akun/[id]` di aplikasi online tanpa error.
5. Laporan akhir dalam bahasa sederhana untuk orang non-teknis.
