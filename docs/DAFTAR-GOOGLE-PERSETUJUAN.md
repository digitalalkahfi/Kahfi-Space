# K-SPACE — Daftar via Google + Persetujuan Anggota
## SYSTEM DESIGN + BUILD HANDOFF — V1.0

- **Tanggal:** 14 Oktober 2026
- **Penyusun:** AI Product & System Architect
- **Untuk:** Kholid (Manager) → perencanaan di ngodingpakeai.com → Claude Code
- **Repo:** `K-SPACE V2` (Next.js + Supabase), branch `main` @ `c2748c8`
- **Status dokumen:** DESIGN FINAL — seluruh keputusan disetujui Manager (14 Okt 2026), siap dibawa ke perencanaan

---

## 1. Ringkasan

Anggota tidak lagi didaftarkan dengan kata sandi yang dikirim lewat WA. Cara barunya: calon anggota **masuk pakai Google**, lalu menunggu. **Manager atau CEO** menyetujui pendaftarannya sambil menetapkan peran, unit, jabatan, dan atasan langsungnya. Baru setelah disetujui, ia bisa memakai K-Space.

Login dengan kata sandi **tetap berlaku**, jadi anggota lama tidak terganggu.

---

## 2. Keputusan Manager (14 Okt 2026)

| # | Keputusan | Status |
|---|---|---|
| D1 | Login sandi dan login Google **dua-duanya boleh** | DECISION |
| D2 | Semua anggota punya Gmail, tetapi **sebagian emailnya berbeda** dari email yang tercatat di K-Space | FACT (dari Manager) |
| D3 | Yang boleh menyetujui pendaftaran **hanya Manager dan CEO** | DECISION — sama dengan `bolehKelolaAnggota()` yang sudah ada |
| D4 | Calon anggota mengisi data tambahan saat mendaftar (No. WA + divisi yang diajukan) | DECISION |

---

## 3. Current State (FACT dari kode)

| Area | Kondisi sekarang | Bukti |
|---|---|---|
| Login | Hanya email + kata sandi. Belum ada login Google, belum ada halaman callback OAuth | `src/app/actions/auth.ts` (`signInWithPassword`) |
| Tambah anggota | Profil disimpan, lalu akun login dibuat otomatis dengan **sandi sementara yang tampil sekali**. Kalau pembuatan akun gagal, profil **tetap tersimpan tanpa akun login** | `src/app/actions/anggota.ts` → `tambahAnggota`, `buatAkunAuth` |
| Penyebab bug kemarin | Paling mungkin `SUPABASE_SERVICE_ROLE_KEY` belum terpasang di Vercel, jadi `klienAdmin()` gagal dan akun login tidak dibuat | INFERENCE — kunci ada di `.env.local`, Vercel belum dicek |
| Penyambung akun ke profil | Trigger `auth_ke_users`: kalau email akun sama dengan email profil, id profil disamakan dengan id akun. Kalau email belum dikenal, dibuat profil **Staff nonaktif "Belum ditetapkan"** | `supabase/auth.sql` |
| Penjaga halaman | Middleware hanya mengecek "sudah login atau belum". **Tidak mengecek status profil** | `src/lib/supabase/middleware.ts` |
| Penjaga data (RLS) | Banyak policy memakai `auth.uid() is not null`, artinya **siapa pun yang login boleh membaca**. `peran_saya()` **tidak mengecek status aktif** | migrasi 0004, 0010, 0024, 0054, dll. |

### ⚠ Temuan keamanan — P0 (wajib beres sebelum Google dinyalakan)

Hari ini celahnya kecil karena hanya CEO/Manager yang bisa membuat akun. Begitu login Google dibuka, **siapa saja yang punya Gmail bisa membuat akun sendiri**. Dengan aturan database sekarang, orang asing itu langsung bisa membaca data yang dijaga `auth.uid() is not null`: nama anggota, unit, sebagian absensi, KPI, LMS.

Selain itu, anggota yang sudah **dinonaktifkan** pun masih punya peran lewat `peran_saya()`. Kalau ia masih bisa login, ia masih bisa membaca data sesuai perannya.

**Kesimpulan:** "menyembunyikan halaman" tidak cukup. Database harus menolak siapa pun yang profilnya tidak aktif. Ini Fase 1 dan wajib selesai sebelum fase lain.

---

## 4. Empat jalur orang masuk

Ini inti desainnya. Setiap orang yang login masuk ke salah satu jalur berikut:

| Jalur | Siapa | Apa yang terjadi | Perlu persetujuan? |
|---|---|---|---|
| **A** | Anggota lama, **email Google = email di K-Space** | Login Google langsung tersambung ke profilnya (trigger yang sudah ada) | Tidak |
| **B** | Anggota lama yang **sudah punya akun sandi**, email Google berbeda | Login pakai sandi seperti biasa → Profil → **"Sambungkan Google"**. Setelah itu ia bisa login lewat Google | Tidak (sudah terbukti lewat sandi) |
| **C** | Anggota yang **profilnya sudah ada tapi belum punya akun login** (mis. yang ditambahkan kemarin), email berbeda | Login Google → status Menunggu → approver memilih **"Sambungkan ke profil yang sudah ada"** | Ya |
| **D** | Orang baru sama sekali | Login Google → status Menunggu → approver memilih **"Anggota baru"** dan mengisi posisinya | Ya |

Kenapa jalur B tidak lewat persetujuan: satu profil hanya boleh punya satu akun login (`users.id = auth.uid()`). Kalau orang jalur B mendaftar Google sebagai akun baru, ia akan punya dua akun dan akun sandinya menjadi yatim. Fitur "sambungkan identitas" dari Supabase menempelkan Google ke **akun yang sama**, jadi riwayatnya utuh.

---

## 5. Workflow utama (jalur C & D)

```
TRIGGER: Calon anggota tekan "Masuk dengan Google" di /masuk
  ↓
1. Google memverifikasi email → Supabase membuat akun login
  ↓
2. Trigger database: email TIDAK cocok dengan profil mana pun
   → buat baris di `pendaftaran_akun` (status: menunggu)
   → TIDAK membuat baris di `users`
  ↓
3. Aplikasi mengarahkan ke /menunggu
   → pertama kali: form No. WA (wajib) + divisi yang diajukan (opsional) + catatan (opsional)
   → setelah dikirim: layar "Menunggu persetujuan Manager/CEO"
  ↓
4. Notifikasi in-app ke semua CEO & Manager aktif + badge angka di menu Tim
  ↓
5. Approver buka Tim → tab "Menunggu persetujuan"
  ↓
DECISION POINT
  ├─ SETUJUI sebagai ANGGOTA BARU
  │    isi: nama (terisi dari Google, boleh diubah), peran, jabatan,
  │         unit, departemen, program, atasan langsung
  │    → validasi sama persis dengan `tambahAnggota`
  │    → buat baris `users` dengan id = id akun Google, status aktif
  │
  ├─ SETUJUI dengan SAMBUNGKAN ke profil yang sudah ada
  │    pilih profil dari daftar "profil aktif yang belum punya akun login"
  │    → id profil dipindahkan ke id akun Google (riwayat ikut lewat cascade)
  │    → email profil diganti menjadi email Google
  │
  └─ TOLAK — alasan wajib diisi
  ↓
6. Catat siapa, kapan, keputusan apa (di `pendaftaran_akun`)
  ↓
OUTPUT:
  - Disetujui → saat membuka/menyegarkan halaman, anggota langsung masuk Beranda
  - Ditolak  → /menunggu menampilkan "Pendaftaran ditolak: <alasan>. Hubungi Manager."
```

---

## 6. Business Rules

| Kode | Aturan |
|---|---|
| BR-01 | Hanya **CEO dan Manager berstatus aktif** yang boleh melihat, menyetujui, atau menolak pendaftaran |
| BR-02 | Orang tanpa profil `users` **berstatus aktif** tidak bisa membaca atau mengubah data apa pun. Pengecualiannya hanya baris pendaftarannya sendiri |
| BR-03 | Profil `users` berstatus nonaktif juga tidak bisa membaca data apa pun (menutup celah anggota yang sudah dinonaktifkan) |
| BR-04 | Persetujuan sebagai anggota baru wajib lolos validasi yang sama dengan `tambahAnggota`: `periksa()`, `periksaAtasan()`, `sebabAtasanTakSah()` |
| BR-05 | "Sambungkan" hanya boleh ke profil yang **aktif** dan **belum punya akun login** |
| BR-06 | Satu pendaftaran hanya diputuskan sekali. Pengecekan `status = 'menunggu'` dilakukan di dalam perintah update, bukan hanya di layar |
| BR-07 | Menolak wajib disertai alasan, minimal 5 huruf |
| BR-08 | Email Google yang cocok dengan profil (jalur A) tersambung otomatis. Statusnya ikut status profil: profil nonaktif tetap tidak bisa masuk |
| BR-09 | Pendaftaran yang ditolak tidak bisa diajukan ulang sendiri. Approver bisa menyetujuinya kemudian dari tab "Ditolak" |
| BR-10 | Fitur "Tambah anggota" dengan sandi sementara **tetap ada** sebagai jalur cadangan |

---

## 7. Data

### Entity baru: `pendaftaran_akun`

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` (satu akun Google = satu pendaftaran) |
| `email` | text | Dari Google, lowercase |
| `nama_google` | text | Dari metadata Google |
| `foto_url` | text null | Dari metadata Google |
| `no_wa` | text null | Diisi calon anggota di /menunggu |
| `unit_diajukan` | kode unit null | Pengajuan, **bukan keputusan** |
| `catatan` | text null | Dari calon anggota |
| `status` | enum `menunggu / disetujui / ditolak` | Default `menunggu` |
| `diputuskan_oleh` | uuid → users null | Approver |
| `diputuskan_pada` | timestamptz null | |
| `alasan_tolak` | text null | Wajib bila ditolak |
| `profil_id` | uuid → users null | Profil hasil persetujuan |
| `cara` | enum `baru / sambung` null | Cara persetujuan |
| `dibuat_pada` | timestamptz | |

- **Owner data:** Manager
- **Source of truth posisi anggota:** tetap tabel `users`. `pendaftaran_akun` hanya mencatat pengajuan dan keputusannya (sekaligus menjadi jejak audit).
- **Retention:** tidak dihapus.
- **Delete:** tidak ada yang boleh menghapus lewat aplikasi.

### Perubahan pada yang sudah ada

| Objek | Perubahan |
|---|---|
| Fungsi baru `anggota_aktif()` | `exists (select 1 from users where id = auth.uid() and status = 'aktif')` — security definer |
| `peran_saya()`, `unit_saya()`, dan helper sejenis | Hanya mengembalikan nilai bila profil aktif. Bila tidak aktif, hasilnya null |
| Semua policy `using (auth.uid() is not null)` | Diganti `using (anggota_aktif())` |
| Trigger `auth_ke_users` (`supabase/auth.sql`) | Bila email tidak dikenal: **insert ke `pendaftaran_akun`**, bukan membuat profil Staff nonaktif |
| Data lama | Profil yang dibuat trigger lama (`jabatan = 'Belum ditetapkan'`, nonaktif, tanpa riwayat) dipindahkan ke `pendaftaran_akun` berstatus menunggu. **Developer menampilkan daftarnya dulu ke Manager sebelum memindahkan** |

### RLS `pendaftaran_akun`

| Aksi | Siapa |
|---|---|
| SELECT | Pemiliknya (`id = auth.uid()`), atau CEO/Manager aktif |
| UPDATE `no_wa`, `unit_diajukan`, `catatan` | Pemiliknya, selama status `menunggu` |
| UPDATE kolom keputusan | Hanya lewat server action (service role) setelah `bolehKelolaAnggota()` dicek |
| INSERT | Hanya trigger |
| DELETE | Tidak ada |

---

## 8. Permission Matrix

| Aksi | Calon (menunggu) | Staff / Co-Leader / Leader / Finance | Manager | CEO |
|---|---|---|---|---|
| Login Google | ✔ | ✔ | ✔ | ✔ |
| Isi data pendaftaran sendiri | ✔ | — | — | — |
| Membaca data K-Space | ✘ | ✔ sesuai scope | ✔ | ✔ |
| Melihat daftar pendaftaran | ✘ | ✘ | ✔ | ✔ |
| Menyetujui / menolak | ✘ | ✘ | ✔ | ✔ |
| Sambungkan Google ke akun sendiri | — | ✔ | ✔ | ✔ |

---

## 9. Edge Cases

| # | Kasus | Perilaku yang benar |
|---|---|---|
| E1 | Manager & CEO menyetujui pendaftaran yang sama di detik yang sama | Yang kedua mendapat pesan "Pendaftaran ini sudah diputuskan oleh <nama>" (BR-06) |
| E2 | Calon login Google dua kali | Tetap satu baris (PK = id akun) |
| E3 | Profil yang dipilih untuk "sambungkan" ternyata baru saja punya akun login | Ditolak: "Profil ini sudah punya akun login" |
| E4 | Atasan yang dipilih dinonaktifkan sebelum tombol Setujui ditekan | Ditolak oleh validasi BR-04 |
| E5 | Calon menutup tab sebelum mengisi No. WA | Saat login lagi, form muncul lagi. Approver tetap bisa memutuskan walau No. WA kosong (ditandai "belum diisi") |
| E6 | Anggota yang dinonaktifkan login lewat Google (jalur A) | Masuk ke layar "Akun tidak aktif, hubungi Manager". Tidak bisa membaca data (BR-03) |
| E7 | Email Google sudah dipakai profil lain saat "sambungkan" | Tolak dengan pesan yang menyebut nama profil pemakainya |
| E8 | Orang asing memanggil API Supabase langsung dengan token login | RLS menolak (BR-02). Ini yang membuktikan keamanan ada di database, bukan di tombol |
| E9 | Tidak ada pendaftaran | Tab menampilkan "Tidak ada yang menunggu", tanpa badge |
| E10 | Jaringan putus saat menyetujui | Perintah update bersifat atomik: profil + status pendaftaran dalam satu fungsi database (RPC) atau ditulis dengan urutan yang aman. Tidak boleh ada profil dibuat tapi pendaftaran masih menunggu |
| E11 | Tampilan HP | Daftar pendaftaran berbentuk kartu. Form persetujuan memakai komponen form anggota yang sudah ada |

---

## 10. Acceptance Criteria

**Keamanan (Fase 1)**
1. Given akun login tanpa profil `users`, when ia query `users`, `absensi`, `kpi`, atau tabel lain lewat API Supabase, then hasilnya kosong atau ditolak.
2. Given profil berstatus nonaktif yang masih punya akun login, when ia login dan membuka /beranda, then ia diarahkan ke layar "Akun tidak aktif" dan query datanya kosong.
3. Given anggota aktif dari setiap peran (CEO, Manager, Leader, Co-Leader, Staff, Finance), when login sesudah perubahan, then semua halaman yang dulu bisa ia buka tetap bisa dibuka dengan data yang sama (regresi).

**Pendaftaran**
4. Given email Google yang tidak dikenal, when login, then dibuat 1 baris `pendaftaran_akun` berstatus menunggu, 0 baris baru di `users`, dan ia diarahkan ke /menunggu.
5. Given email Google sama dengan email profil aktif, when login, then ia langsung masuk ke /beranda tanpa pendaftaran.
6. Given anggota login dengan sandi, when ia menekan "Sambungkan Google" di Profil dan memilih Gmail yang berbeda, then setelah logout ia bisa login lewat Google ke profil yang sama.

**Persetujuan**
7. Given Manager aktif, when ia menyetujui sebagai anggota baru dengan data valid, then profil `users` dibuat dengan id = id akun Google, status aktif, dan `pendaftaran_akun` tercatat `disetujui`, `diputuskan_oleh`, `diputuskan_pada`, `cara = baru`.
8. Given Manager memilih "sambungkan" ke profil aktif tanpa akun login, when disetujui, then id profil berubah menjadi id akun Google, email profil menjadi email Google, dan riwayat lamanya (tiket, absensi, KPI) tetap terlihat.
9. Given Leader atau Staff, when ia membuka tab Menunggu atau memanggil action persetujuan, then ia ditolak dengan pesan "Hanya CEO atau Manager…".
10. Given tombol Tolak tanpa alasan, then ditolak dengan pesan "Isi alasan penolakan".
11. Given pendaftaran yang sudah diputuskan, when diputuskan lagi, then muncul pesan E1 dan data tidak berubah.

---

## 11. Keputusan desain — DISETUJUI Manager 14 Okt 2026

| # | Keputusan | Status |
|---|---|---|
| 1 | Notifikasi pendaftaran baru: **in-app + badge** di menu Tim saja, tanpa WA | DECISION |
| 2 | Yang ditolak **tidak bisa mengajukan ulang sendiri** (BR-09) | DECISION |
| 3 | "Tambah anggota" manual **tetap ada** sebagai cadangan (BR-10) | DECISION |
| 4 | Saat "sambungkan", **email profil diganti** ke email Google | DECISION |
| 5 | Login sandi tetap ada **tanpa batas waktu** | DECISION |

---

## 12. Rollout

| Fase | Isi | Prioritas | Catatan |
|---|---|---|---|
| **0 — hari ini** | Pasang `SUPABASE_SERVICE_ROLE_KEY` di Vercel → redeploy → tekan "Buat akun login" untuk anggota kemarin | P0 bug | Tidak perlu coding. Lepas dari fitur Google |
| **1** | Gerbang keamanan: `anggota_aktif()`, `peran_saya()` aktif-saja, ganti policy `auth.uid() is not null`, middleware arahkan profil tidak aktif ke layar "tidak aktif / menunggu" | **P0** | Wajib uji regresi semua peran (AC 1–3) di Supabase uji/branch dulu |
| **2** | Tabel `pendaftaran_akun`, perubahan trigger, halaman /menunggu, tab "Menunggu persetujuan", action setujui/tolak/sambungkan | P1 | |
| **3** | Tombol "Masuk dengan Google" di /masuk, route callback OAuth, "Sambungkan Google" di Profil | P1 | |
| **4** | Konfigurasi sekali jalan: Google Cloud OAuth Client + aktifkan provider Google dan *manual identity linking* di Supabase | — | Dilakukan Manager dengan panduan. **Hanya setelah Fase 1 live** |
| **5** | Pilot: Manager + 2 Gmail uji + 2 anggota jalur B/C | — | Cek AC 4–11 |
| **6** | Umumkan ke tim + cara sambungkan Google | — | Governance handoff ke Tata Kelola |

**Rollback:** matikan provider Google di Supabase. Login sandi tetap jalan, dan pendaftaran yang sudah masuk tetap tersimpan.

---

## 13. BUILD HANDOFF — CLAUDE CODE

- **Context:** K-Space V2, Next.js (versi dengan perubahan besar, baca `AGENTS.md`) + Supabase. Semua teks UI berbahasa Indonesia, mengikuti gaya kode yang ada.
- **Business Problem:** menambah anggota butuh kirim sandi manual dan kemarin gagal diam-diam. Membuka login Google tanpa gerbang akan membocorkan data.
- **Goal:** anggota mendaftar sendiri lewat Google, CEO/Manager menyetujui sambil menetapkan posisi, dan orang yang tidak aktif tidak bisa membaca data.
- **Scope:** §5–§10, Fase 1–3.
- **Non-Scope:** mematikan login sandi; mengubah aturan hierarki atasan; desain ulang halaman Tim; konfigurasi Google Cloud (dilakukan Manager).
- **Extend, jangan rebuild:** pakai ulang `periksa`, `periksaAtasan`, `sebabAtasanTakSah`, `bolehKelolaAnggota`, `klienAdmin`, form di `dialog-anggota.tsx`, sistem `notifikasi`, dan mekanisme cascade id di `supabase/auth.sql`.
- **Data Changes:** migrasi baru `0208_gerbang_anggota_aktif.sql` (Fase 1) dan `0209_pendaftaran_akun.sql` (Fase 2), plus update `supabase/auth.sql`.
- **Migration data lama:** query dulu profil hasil trigger lama (`jabatan='Belum ditetapkan'`, nonaktif, tanpa baris anak). Tampilkan daftarnya ke Manager. Pindahkan hanya setelah disetujui.
- **Tests Required:** test RLS per peran (pola `supabase/tests`), test aktif vs nonaktif vs tanpa profil, unit test validasi persetujuan, test double-approve.
- **Backward Compatibility:** login sandi, `tambahAnggota`, `buatAkunLogin`, dan alur ganti sandi wajib tetap jalan.
- **Do Not Change:** aturan hierarki (migrasi 0044, 0070, 0164), data riwayat anggota, policy yang sudah memakai peran secara spesifik (kecuali lewat `peran_saya()` yang kini aktif-saja).
- **Verification Steps:** AC 1–11 di Supabase uji, lalu pilot Fase 5.
- **Keputusan bisnis:** semua sudah diputuskan di §2 dan §11. Developer tidak menambah aturan baru; bila menemukan hal yang belum tercakup, tandai NEEDS MANAGER DECISION.

---

## 14. Governance Handoff (setelah stabil)

Yang perlu dibuat AI Tata Kelola:
- **WI** "Menyetujui pendaftaran anggota K-Space" (untuk Manager/CEO): cara memeriksa identitas lewat WA sebelum menyetujui.
- **Panduan anggota** "Masuk K-Space dengan Google" dan "Menyambungkan Google ke akun lama".
- **Checklist onboarding:** tambahkan langkah "daftar K-Space via Google → hubungi atasan agar disetujui".
