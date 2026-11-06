# Laporan harian memuat GMV kemarin (H-1)

GMV dihitung untuk satu hari penuh (24 jam), jadi laporan yang dikirim hari ini tidak
mungkin memuat GMV hari ini — harinya belum selesai.

| Laporan dikirim | Memuat GMV | Disimpan bertanggal |
|---|---|---|
| 6 Oktober | 5 Oktober | **5 Oktober** |
| 7 Oktober | 6 Oktober | **6 Oktober** |

Migrasi: `0207`. Kode: `src/lib/laporan.ts` (`tanggalDataTerakhir`), form di
`src/components/laporan-harian/`. Tes: `supabase/tests/laporan-gmv-h-min-1.test.mjs`
dan `src/lib/__tes__/laporan.test.ts`.

## Keputusan rancangan

- **Laporan disimpan bertanggal hari datanya (kemarin), bukan hari dikirim.** Dengan begitu
  KPI, GRD, dan grafik membaca GMV di harinya sendiri tanpa digeser satu per satu.
- **Seluruh isi laporan ikut kemarin**: GMV, komisi, GMV LIVE, jumlah upload, jam LIVE,
  CO sampel, dan catatan. Satu laporan = satu hari penuh yang sudah selesai.
- **Hari ini tidak bisa dilaporkan**, di form maupun di database.
- Data lama tidak disentuh. Laporan yang masuk sebelum aturan ini (mis. dikirim sore hari
  dengan GMV sebagian hari) diperbaiki pelapor lewat *Perbaiki laporan*, yang tercatat
  di jejak revisi.

## Yang berubah

| Bagian | Sebelum | Sesudah |
|---|---|---|
| Penjaga tanggal (`jaga_tanggal_laporan`) | menolak masa depan | menolak **hari ini** dan masa depan. Seed dan skrip migrasi (tanpa sesi) tetap bebas. |
| Form Laporan Harian | tanggal bawaan hari ini | tanggal bawaan **kemarin**; "Hari ini" tidak ada di kalender; teks menyebut tanggal GMV-nya |
| Kalender merah/hijau | sampai hari ini | sampai **kemarin** |
| Kunci Absen Pulang (`sudah_lapor_harian`) | laporan bertanggal hari absen | laporan bertanggal **hari absen − 1** |
| Status Tim: `unggahan_hari_ini` | unggahan hari itu | unggahan **kemarin** (laporan terbaru) |
| Kepatuhan minimum, tren 3 hari | hari ini ikut dinilai | hari ini **belum dinilai** (laporannya belum bisa dikirim) |
| KPI "laporan tepat waktu" | tenggat pukul batas pada tanggal laporan | pukul batas pada **hari sesudahnya**; hari yang tenggatnya belum lewat belum dinilai. Sejak `0215` dinilai per sasaran (lihat bagian akhir). |
| Target prorata: KPI GMV, ukuran GRD, WRM, mingguan | target sampai hari ini | target sampai **kemarin** (GMV paling jauh ada sampai kemarin) |
| Kunci KPI bulanan, laporan mingguan | boleh begitu bulan/pekan berakhir | boleh **sehari sesudahnya**, setelah GMV hari terakhir dilaporkan |
| Beranda (hero WRM, GMV per unit, capaian pribadi) | GMV hari ini vs kemarin | GMV **kemarin** vs sehari sebelumnya |
| Analitik GMV, Kurva WRM, Mingguan | sampai hari ini | sampai **kemarin** |
| Riwayat laporan | "Tanggal" + jam kirim | "Tanggal GMV" + **kapan dikirim** |

Yang sengaja **tidak** diubah: `ringkasan_gmv_unit`, `gmv_harian*`, `gmv_goal_rentang`,
`realisasi_ukuran` — fungsi-fungsi itu menjawab "GMV pada tanggal X" dan sudah benar
selama pemanggilnya menanyakan tanggal yang tepat (aplikasi kini menanyakan kemarin).

## Pekerjaan susulan setelah rilis

- **Perbaiki laporan lama.** Laporan 5 dan 6 Oktober yang dikirim sore hari berisi GMV
  sebagian hari. Karena laporan kemarin sudah tercatat "ada", form tidak menawarkannya
  lagi; pelapor memperbaikinya lewat Riwayat → *Perbaiki laporan* dengan angka hari
  penuh dari Partner Center.
- **Hari Minggu.** Laporan bertanggal Minggu baru bisa dikirim hari Senin, dan laporan
  Sabtu pada Minggu (hari libur) jatuh ke Senin juga. Kalender menandai keduanya merah
  sampai dikirim; pelapor mengirim dua laporan pada hari Senin.

## Urutan rilis

1. `npx --yes supabase@2.118.0 db push --linked --dry-run` (hanya `0207`), lalu `--yes`.
2. Segera merge PR (Vercel men-deploy `main`).

Selama jeda keduanya (beberapa menit), form lama yang masih terbuka di browser akan
ditolak database dengan pesan "GMV dihitung satu hari penuh…"; muat ulang halaman
membetulkannya. Database dipasang lebih dulu karena kebalikannya lebih buruk: kunci Absen
Pulang di database lama tidak akan terbuka oleh laporan bertanggal kemarin.

## Rollback

Per fungsi ada daftar migrasi asalnya di komentar akhir `0207_laporan_gmv_h_min_1.sql`;
jalankan ulang blok `create or replace` dari migrasi itu, lalu
`drop function tanggal_data_terakhir()`. Laporan yang sudah tersimpan bertanggal kemarin
tidak berubah oleh rollback.

## Keputusan: KPI laporan tepat waktu dinilai per sasaran (`0215`)

Diputuskan pemilik pada 6 November 2026. Migrasi:
`0215_laporan_tepat_per_sasaran.sql`. Tes: `supabase/tests/laporan-tepat-per-sasaran.test.mjs`.

**Masalahnya.** Indikator ini dulu hanya menghitung laporan yang dikirim pemilik lembar
sendiri. Bila Manager, CEO, atau co-leader sudah mengirim laporan akun seorang PIC, PIC
tidak bisa melapor lagi karena satu akun hanya boleh punya satu laporan per tanggal, dan
harinya tercatat tidak melapor tanpa jalan keluar.

**Aturannya kini.** Sebuah hari dihitung tepat bila ada laporan sebelum tenggat yang:

- dikirim orang itu sendiri,
- untuk akun yang PIC-nya orang itu, siapa pun pengirimnya, atau
- untuk unit yang ia pimpin sebagai Leader, siapa pun pengirimnya.

Laporan orang lain yang lewat tenggat tetap terlambat. Risiko yang diterima: PIC mendapat
nilai dari laporan yang tidak ia kirim, jadi Manager yang menutupi PIC lalai tidak terlihat
di KPI.

**Beda dari kunci Absen Pulang (`0214`).**

| | Kunci Absen Pulang | KPI laporan tepat waktu |
|---|---|---|
| PIC beberapa akun, laporan kiriman orang lain | semua akun harus terlapor | satu laporan cukup |
| Tidak ada lagi yang bisa dilapor | kunci terbuka | tidak menghasilkan nilai, harus ada laporan |
| Unit yang kemudian mendapat akun | Leader tidak lagi wajib lapor, laporan unit diabaikan | laporan unit lama tetap dihitung |

Kunci menahan orang supaya tagihan berikutnya tidak hilang dari layar, sedangkan KPI hanya
menilai hari yang sudah lewat. Nilai hari lampau tidak boleh hilang karena keadaan akun atau
unit berubah sesudahnya.

**Batasan.** Riwayat PIC tidak tersimpan, jadi laporan akun mengikuti PIC saat ini. PIC baru
ikut menerima hari sebelum serah terima pada bulan itu; pengirim lama tidak kehilangan nilai.

**Dampak saat rilis.** Persentase tidak pernah turun karena syarat lama tetap berlaku. Bulan
yang belum dikunci langsung terhitung ulang, sedangkan bulan yang sudah dikunci tidak berubah
karena scorecard membaca `kpi_snapshots`.

**Rilis dan rollback.** Hanya database, tanpa perubahan aplikasi:
`npx --yes supabase@2.118.0 db push --linked --dry-run` (hanya `0215`), lalu `--yes`. Untuk
membatalkan, jalankan ulang blok `create or replace function pencapaian_otomatis` dari `0207`.
