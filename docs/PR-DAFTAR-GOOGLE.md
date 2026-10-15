# Daftar via Google + persetujuan anggota (Fase 1–3)

Branch: `fitur/daftar-google-persetujuan` → `main` · Rancangan: `docs/DAFTAR-GOOGLE-PERSETUJUAN.md`

## Ringkasan

- **Fase 1 — gerbang keamanan (P0).** Database sekarang menolak siapa pun yang tidak punya profil `users` **berstatus aktif**: orang asing yang login Google maupun anggota yang sudah dinonaktifkan tidak bisa membaca atau mengubah data apa pun, termasuk lewat API Supabase langsung.
- **Fase 2 — pendaftaran.** Email Google yang tidak dikenal masuk ke tabel baru `pendaftaran_akun` (status menunggu), bukan menjadi profil Staff nonaktif. Calon mengisi No. WA di `/menunggu`. CEO/Manager memutuskan di **Tim → Menunggu persetujuan** (`/tim/pendaftaran`): setujui sebagai anggota baru, sambungkan ke profil lama, atau tolak dengan alasan.
- **Fase 3 — Google.** Tombol "Masuk dengan Google" di `/masuk`, route `/auth/callback`, dan kartu "Sambungkan Google" di Profil. Tombol baru tampil bila env `NEXT_PUBLIC_LOGIN_GOOGLE=1`, jadi kode ini aman di-merge sebelum Google dikonfigurasi (Fase 4).
- Login sandi, "Tambah anggota", "Buat akun login", dan ganti sandi tetap jalan tanpa perubahan perilaku.

## Perubahan database

### `0208_gerbang_anggota_aktif.sql` (Fase 1)

| Objek | Perubahan |
|---|---|
| `anggota_aktif()` (baru, security definer) | true bila `users.id = auth.uid()` dan `status = 'aktif'` |
| `status_akses_saya()` (baru) | `aktif` / `nonaktif` / `tanpa_profil` — dipakai middleware |
| `peran_saya()`, `unit_saya()` | hanya bernilai untuk profil aktif |
| `bawahan_saya()`, `boleh_orang()`, `pic_akun()` | kosong/false untuk profil tidak aktif |
| 10 fungsi dengan syarat `auth.uid() is not null` | frasa itu diganti `anggota_aktif()`: `pengumuman_untuk_saya`, `boleh_aset`, `aset_dipegang`, `riwayat_aset`, `boleh_menilai`, `boleh_centang_tonggak`, `boleh_isi_ukuran`, `rencana_terlihat`, `papan_kpi`, `papan_akun_grd` |
| 24 policy `using (auth.uid() is not null …)` | frasa itu diganti `anggota_aktif()`, sisa syarat sama persis: `agenda.agenda_baca`, `announcements.announcements_baca`, `assets.aset_baca`, `batas_minimum_level.batas_minimum_baca`, `course_modules.course_modules_baca`, `courses.courses_baca`, `departments.departments_baca`, `feedback.feedback_baca`, `feedback_comments.komentar_baca`, `feedback_events.jejak_baca`, `feedback_votes.votes_baca`, `grd_akun_dikecualikan.grd_akun_dikecualikan_baca`, `grd_cascade_blok.grd_cascade_blok_baca`, `kpi_definitions.kpi_def_baca`, `kspace_lama_log.kspace_lama_log_baca`, `metrik_departemen.metrik_departemen_baca`, `notes.notes_baca`, `pengaturan.pengaturan_baca`, `problems.problems_baca`, `programs.programs_baca`, `quiz_questions.quiz_questions_baca`, `samples.samples_baca`, `units.units_baca`, `users.users_baca` |
| Policy **restrictive** `gerbang_anggota_aktif` di **seluruh 75 tabel** | `using/with check ((select anggota_aktif()))`. Di-AND-kan dengan policy lama, jadi aturan per peran tidak berubah; ia menutup celah "baris milik sendiri" (mis. absensi sendiri) untuk profil nonaktif (BR-03) |

### `0209_pendaftaran_akun.sql` (Fase 2)

- Tipe `status_pendaftaran`, `cara_persetujuan`; nilai enum notifikasi baru `anggota`.
- Tabel `pendaftaran_akun` (kolom sesuai §7). RLS: baca = pemilik atau CEO/Manager aktif; ubah = pemilik, hanya `no_wa`/`unit_diajukan`/`catatan`, selama `menunggu` (grant per kolom). Tidak ada INSERT/DELETE dari klien. **Tanpa** gerbang restrictive (pemiliknya justru akun belum aktif).
- `status_akses_saya()` diperluas: `menunggu` / `ditolak`.
- Fungsi keputusan (security definer, memeriksa sendiri CEO/Manager **aktif** + mengunci baris + status awal yang dilihat approver, atomik):
  `setujui_pendaftaran_baru`, `sambungkan_pendaftaran`, `tolak_pendaftaran`. Penolong internal `kunci_pendaftaran`, `jaga_email_pendaftaran`, `pindahkan_id_profil` dicabut dari klien.
- Trigger `notifikasi_pendaftaran_baru` → notifikasi in-app ke setiap CEO & Manager aktif. Trigger `antrekan_whatsapp_trg` dibuat ulang dengan `when (kategori <> 'anggota')` → **tanpa WA** (keputusan §11 no. 1).
- `pindahkan_id_profil(lama, baru)`: memindahkan id profil ke id akun login. **Temuan saat uji:** banyak trigger penjaga riwayat (tiket selesai, jejak sampel/aset, persetujuan transaksi, …) menolak cascade `on update` dari pergantian id, dan CHECK `tasks_pribadi_milik_sendiri` sempat melihat keadaan setengah jalan. Akibatnya profil yang sudah punya riwayat **tidak bisa disambungkan sama sekali** (ini juga sudah terjadi pada jalur email-sama sebelum PR ini). Fungsi ini mematikan trigger buatan di tabel anak *hanya selama perpindahan, di transaksi yang sama*, lalu menyalakannya lagi; CHECK multi-kolom dilepas lalu dipasang ulang (memvalidasi ulang semua baris). Trigger di tabel `users` tetap hidup (audit anggota tercatat).

### `supabase/auth.sql` (dijalankan manual di SQL Editor)

- `auth_ke_users`: email tak dikenal → insert `pendaftaran_akun` (nama & foto dari metadata Google), tidak lagi membuat profil Staff nonaktif. Email yang cocok → profil disambung lewat `pindahkan_id_profil`.
- **Tambahan pengaman:** profil yang **sudah punya akun login lain** tidak diambil alih walau emailnya cocok; akun baru itu masuk antrean persetujuan. Tanpa ini, mengganti email profil lalu login Google dengan email itu akan membuat akun sandi lamanya yatim.

### Data lama

`supabase/menunggu/pindah-profil-belum-ditetapkan.sql` — **tidak dijalankan otomatis**. Bagian 1 (baca-saja) menampilkan profil hasil trigger lama (`jabatan = 'Belum ditetapkan'`, nonaktif, Staff). Bagian 2 (dikomentari) memindahkannya ke `pendaftaran_akun` setelah Manager menyetujui daftarnya; profil yang punya baris anak dilewati.

## Perubahan aplikasi

- `src/lib/supabase/middleware.ts` — setelah sesi, membaca `status_akses_saya()`; akun yang tidak aktif diarahkan ke `/menunggu`, anggota aktif yang membuka `/menunggu` atau `/masuk` ke `/beranda`. Bila RPC galat, permintaan dibiarkan lewat (RLS tetap menjaga) supaya satu galat tidak mengunci semua orang.
- `/menunggu` — form No. WA (wajib) + divisi diajukan + catatan; lalu layar "Menunggu persetujuan"; atau "Pendaftaran ditolak: <alasan>. Hubungi Manager." / "Akun tidak aktif, hubungi Manager."
- `/tim/pendaftaran` — tab Menunggu / Ditolak / Disetujui, kartu per pendaftaran (ramah HP), dialog setujui (anggota baru memakai form `Isian` dari `dialog-anggota.tsx` dengan email terkunci; atau sambungkan ke profil aktif tanpa akun login), dialog tolak beralasan. Peran lain melihat halaman "akses ditolak".
- Badge angka pendaftaran menunggu di menu **Anggota tim** (rail desktop, dock & laci mobile) dan tombol "Menunggu persetujuan" di halaman Tim — hanya CEO/Manager.
- Validasi `periksa`/`periksaAtasan` dipindah ke `src/lib/validasi-anggota.ts`, pemeriksaan hierarki atasan menjadi `sebabAtasanAnggotaBaru()`; dipakai `tambahAnggota` **dan** persetujuan (BR-04), perilaku `tambahAnggota` tidak berubah.
- Kategori notifikasi `anggota` ("Pendaftaran anggota"), baris matriks hak "Menyetujui pendaftaran akun Google".
- `.env.example`: `NEXT_PUBLIC_LOGIN_GOOGLE`.

## Hasil test per Acceptance Criteria

Test baru: `supabase/tests/gerbang-pendaftaran.test.mjs` (31 kasus, menjalankan `auth.sql` di atas `auth.users` tiruan) dan `src/lib/__tes__/pendaftaran.test.ts` (7 kasus).

| AC | Hasil | Bukti |
|---|---|---|
| 1 | ✅ | Akun tanpa profil: `users`, `units`, `attendance`, `kpi_*`, `courses`, `daily_reports`, `tasks`, `announcements` = 0 baris; menulis ditolak; `papan_kpi` kosong |
| 2 | ✅ | Profil nonaktif: semua tabel 0 baris, `peran_saya()` null, status `nonaktif` → middleware ke `/menunggu` (unit test) |
| 3 | ✅ | CEO/Manager/Leader/Co-Leader/Staff aktif membaca seperti sebelumnya; seluruh test skema lama lulus kecuali `tanggal-wajib-tugas` yang juga gagal di `main` (lihat di bawah) |
| 4 | ✅ | Email tak dikenal → 1 baris `pendaftaran_akun` menunggu, 0 profil baru |
| 5 | ✅ | Email = email profil aktif → tersambung, riwayat absensi ikut, status `aktif` |
| 6 | ⏳ uji manual | Butuh Google sungguhan (`linkIdentity`); diuji di pilot Fase 5 |
| 7 | ✅ | Profil dibuat dengan id akun Google, aktif; `disetujui`, `diputuskan_oleh`, `diputuskan_pada`, `cara = baru` |
| 8 | ✅ | id & email profil pindah; absensi dan tiket tetap; juga Manager dengan bawahan + tugas pribadi |
| 9 | ✅ | Leader & Staff: "Hanya CEO atau Manager…"; Manager nonaktif juga ditolak |
| 10 | ✅ | Alasan kosong / < 5 huruf: "Isi alasan penolakan…" |
| 11 | ✅ | Keputusan kedua: "Pendaftaran ini sudah diputuskan oleh <nama>", data tidak berubah |

Edge case yang ikut diuji: E1, E2, E3, E4, E6, E7, E8, BR-05, BR-09, notifikasi tanpa antrean WA, trigger & CHECK kembali utuh setelah pindah id.

Pemeriksaan lain: `typecheck` ✅ · `test:unit` ✅ (1034 lulus, 0 gagal) · `db:test` 124/125 berkas lulus · `build` ✅ · `eslint` ✅ untuk kode repo.

Satu perubahan test lama: `rls-anggota` "Staff tidak bisa mengaktifkan kembali dirinya" dulu mengharapkan galat. Sejak gerbang 0208, profil nonaktif tidak melihat barisnya sendiri, jadi UPDATE-nya tidak menyentuh apa pun (tanpa galat). Test kini memeriksa hasilnya — status tetap `nonaktif` — yang justru lebih ketat.

Yang **sudah gagal di `main` sebelum PR ini** (bukan akibat PR): `tanggal-wajib-tugas` ("data lama: to-do tanpa tenggat…", bergantung tanggal hari ini), `npm run lint` tersandung berkas coretan lokal di `.tmp/` (tidak di-commit), dan `npm run ekspor:cek` menyatakan `ekspor-contoh.json` tidak sama dengan hasil skripnya.

## NEEDS MANAGER DECISION

1. **No. WA pendaftar tidak disalin ke `users.kontak`** saat disetujui (dokumen tidak mengatur). Opsi paling aman dipilih: nomor tetap tersimpan di catatan pendaftaran; anggota mengisi kontaknya sendiri di Profil (dengan verifikasi yang sudah ada).
2. **Keputusan memakai fungsi database yang dijalankan atas nama approver**, bukan service role. Hasilnya setara dengan rancangan (klien tetap tidak bisa menulis kolom keputusan; CEO/Manager aktif diperiksa di server **dan** database) dan tidak bergantung pada `SUPABASE_SERVICE_ROLE_KEY` — kunci yang hilang di Vercel adalah penyebab bug kemarin. Mohon dikonfirmasi.

## Urutan rilis

1. **Fase 0 (terpisah):** pasang `SUPABASE_SERVICE_ROLE_KEY` di Vercel → redeploy → "Buat akun login" untuk anggota kemarin.
2. Database dulu: `npx --yes supabase@2.118.0 db push --linked --dry-run`, lalu tanpa `--dry-run` (0208, 0209). Kode lama tetap jalan di atas skema baru.
3. Jalankan ulang isi `supabase/auth.sql` di SQL Editor Supabase.
4. Merge PR → Vercel deploy.
5. Fase 4 (Manager, dengan panduan): Google Cloud OAuth Client, aktifkan provider Google + *manual identity linking* di Supabase, tambahkan `https://<domain>/auth/callback` ke Redirect URLs, lalu isi `NEXT_PUBLIC_LOGIN_GOOGLE=1` di Vercel dan redeploy.
6. Data lama: jalankan Bagian 1 skrip `supabase/menunggu/pindah-profil-belum-ditetapkan.sql`, tunjukkan ke Manager, baru Bagian 2.

**Rollback:** kosongkan `NEXT_PUBLIC_LOGIN_GOOGLE` dan/atau matikan provider Google di Supabase. Login sandi tetap jalan; pendaftaran yang sudah masuk tetap tersimpan.

## Langkah uji manual untuk Manager

1. Masuk seperti biasa dengan email dan kata sandi — Beranda harus tampil seperti kemarin.
2. Buka **Anggota tim**, tekan **Menunggu persetujuan** — tertulis "Tidak ada yang menunggu".
3. Minta satu orang (Gmail yang belum terdaftar) membuka K-Space dan menekan **Masuk dengan Google**. Ia harus sampai di layar "Lengkapi pendaftaran", isi No. WA, lalu melihat "Menunggu persetujuan".
4. Di HP/laptop Manager: lonceng notifikasi menampilkan "Pendaftaran baru", dan menu Anggota tim ada angka 1.
5. Buka **Menunggu persetujuan** → **Setujui** → **Anggota baru**, isi peran, jabatan, unit, atasan → **Setujui**.
6. Orang itu memuat ulang halaman — ia langsung masuk Beranda.
7. Ulangi langkah 3 dengan Gmail lain, lalu **Tolak** dengan alasan. Orang itu melihat "Pendaftaran ditolak: <alasan>".
8. Buka tab **Ditolak** — pendaftaran tadi bisa disetujui kemudian bila memang keliru.
9. Untuk anggota lama yang Gmail-nya berbeda: ia masuk dengan sandi → **Profil** → **Sambungkan Google**, keluar, lalu masuk lagi lewat Google — profilnya sama.
10. Nonaktifkan satu akun uji di halaman Tim; saat ia membuka K-Space, ia melihat "Akun tidak aktif, hubungi Manager".

🤖 Generated with [Claude Code](https://claude.com/claude-code)
