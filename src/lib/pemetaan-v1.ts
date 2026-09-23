/**
 * Pemetaan ekspor K-Space V1 → skema V2 — modul murni.
 *
 * Bedanya dengan `src/lib/pemetaan.ts`: yang di sana ditulis sebelum
 * bentuk ekspor aslinya diketahui, satu baris per entitas dengan medan
 * bergaya `nama_lengkap`. Ekspor sungguhan memakai ejaan camelCase
 * (`leaderId`, `picId`, `autoSynced`) dan — khusus laporan harian —
 * judul pertanyaan formulir sebagai nama medan (`"Tanggal Laporan"`,
 * `"Jumlah Upload"`).
 *
 * Ditulis sebagai data, bukan kode bercabang, supaya bisa ditampilkan
 * apa adanya di layar dan disetujui orang sebelum dijalankan — mekanisme
 * persetujuan yang sama (0046) dipakai ulang di sini.
 */
import type { PemetaanEntitas } from "@/lib/pemetaan";

/**
 * Medan kata sandi yang muncul di `users:list` ekspor sungguhan.
 *
 * Disebut satu per satu di layar, bukan disembunyikan: yang menyetujui
 * pemetaan berhak tahu bahwa kata sandi memang dibuang, dan di mana
 * pembuangannya terjadi.
 */
const KREDENSIAL_DIBUANG = [
  {
    medanLama: "passwordHash",
    alasan: "Kata sandi tidak ikut pindah; V2 memakai Supabase Auth.",
  },
  {
    medanLama: "password",
    alasan: "Sama sekali tidak disimpan, bahkan sebagai bahan mentah.",
  },
  {
    medanLama: "salt",
    alasan: "Pelengkap hash kata sandi; tanpa gunanya di V2.",
  },
  {
    medanLama: "confirmPassword",
    alasan: "Sisa formulir pendaftaran lama.",
  },
];

/**
 * Empat kelompok data inti: orang, akun, laporan, dan GMV.
 *
 * Urutannya bukan hiasan — akun menunjuk orang, laporan menunjuk
 * keduanya, dan GMV menunjuk akun. Memetakan laporan sebelum akunnya ada
 * hanya menghasilkan tumpukan kegagalan yang menyesatkan.
 */
export const PEMETAAN_INTI: PemetaanEntitas[] = [
  {
    kunci: "users:list",
    label: "Anggota tim",
    tabelBaru: "users",
    baris: [
      {
        medanLama: "id",
        kolomBaru: "id_lama",
        ubahan: "apa-adanya",
        wajib: true,
        catatan:
          "Id V1 disimpan sebagai penanda, bukan sebagai users.id — id V2 milik Supabase Auth. Inilah yang dipakai menyelesaikan userId/assigneeId di data lain.",
      },
      {
        medanLama: "name",
        kolomBaru: "nama",
        ubahan: "apa-adanya",
        wajib: true,
      },
      {
        medanLama: "email",
        kolomBaru: "email",
        ubahan: "huruf-kecil",
        wajib: true,
        catatan: "Kunci yang menyambungkan profil ke akun Supabase Auth.",
      },
      {
        medanLama: "role",
        kolomBaru: "role",
        ubahan: "apa-adanya",
        wajib: true,
        catatan: "Peran lama dipetakan ke peran V2 yang sudah ada.",
      },
      {
        medanLama: "division",
        kolomBaru: "unit_id",
        ubahan: "cari-id",
        wajib: false,
        catatan: "Divisi lama dicari padanannya di hierarki unit V2.",
      },
      {
        medanLama: "position",
        kolomBaru: "jabatan",
        ubahan: "apa-adanya",
        wajib: false,
      },
      {
        medanLama: "leaderId",
        kolomBaru: "atasan_id",
        ubahan: "cari-id",
        wajib: false,
        catatan: "Menunjuk users:list.id, jadi diselesaikan lewat id lama.",
      },
      {
        medanLama: "phone",
        kolomBaru: "kontak",
        ubahan: "apa-adanya",
        wajib: false,
      },
      {
        medanLama: "active",
        kolomBaru: "status",
        ubahan: "apa-adanya",
        wajib: true,
        catatan: "true → aktif, false → nonaktif.",
      },
      {
        medanLama: null,
        kolomBaru: "department_id",
        ubahan: "bawaan",
        wajib: false,
        catatan: "Sistem lama tidak memisahkan departemen; diisi belakangan.",
      },
      {
        medanLama: null,
        kolomBaru: "whatsapp_optin",
        ubahan: "bawaan",
        wajib: true,
        catatan:
          "Persetujuan dihubungi lewat WhatsApp tidak boleh diwariskan; semua mulai dari tidak.",
      },
    ],
    dibuang: [
      ...KREDENSIAL_DIBUANG,
      {
        medanLama: "joinDate",
        alasan: "Tidak ada kolomnya di V2; tanggal masuk dicatat di berkas HR.",
      },
    ],
  },
  {
    kunci: "affiliate-accounts:all",
    label: "Akun affiliator",
    tabelBaru: "accounts",
    baris: [
      {
        medanLama: "id",
        kolomBaru: "id_lama",
        ubahan: "apa-adanya",
        wajib: true,
        catatan: "Dipakai menyelesaikan accountId di GMV dan goal lama.",
      },
      {
        medanLama: "username",
        kolomBaru: "username",
        ubahan: "apa-adanya",
        wajib: true,
        catatan: "Penentu keunikan akun; juga jalan mencocokkan akun V2.",
      },
      {
        medanLama: "division",
        kolomBaru: "unit_id",
        ubahan: "cari-id",
        wajib: true,
      },
      {
        medanLama: "program",
        kolomBaru: "program_id",
        ubahan: "cari-id",
        wajib: false,
      },
      {
        medanLama: "picId",
        kolomBaru: "pic_user_id",
        ubahan: "cari-id",
        wajib: false,
        catatan: "Menunjuk users:list.id.",
      },
      {
        medanLama: "coLeaderId",
        kolomBaru: "co_leader_id",
        ubahan: "cari-id",
        wajib: false,
      },
      {
        medanLama: "active",
        kolomBaru: "status",
        ubahan: "apa-adanya",
        wajib: true,
      },
      {
        medanLama: null,
        kolomBaru: "platform",
        ubahan: "bawaan",
        wajib: true,
        catatan: "Seluruh akun lama berasal dari TikTok Shop.",
      },
      {
        medanLama: null,
        kolomBaru: "level",
        ubahan: "bawaan",
        wajib: false,
        catatan:
          "Level 0–8 belum ada di V1; semua akun mulai dari 0 dan dinaikkan lewat layar Kelola Akun.",
      },
    ],
    dibuang: [
      {
        medanLama: "dailyTarget",
        alasan:
          "Target kini hidup di goal & anak tangga bulanan, bukan menempel pada akun.",
      },
    ],
  },
  {
    kunci: "daily-reports:all",
    label: "Laporan harian",
    tabelBaru: "daily_reports",
    baris: [
      {
        medanLama: "id",
        kolomBaru: "id_lama",
        ubahan: "apa-adanya",
        wajib: true,
      },
      {
        medanLama: "Tanggal Laporan",
        kolomBaru: "tanggal",
        ubahan: "tanggal",
        wajib: true,
        catatan:
          "Formulir lama menyimpan jawaban memakai judul pertanyaannya, jadi tanggal laporan datang dari label ini — bukan dari createdAt, yang bisa berbeda hari.",
      },
      {
        medanLama: "userId",
        kolomBaru: "user_id",
        ubahan: "cari-id",
        wajib: true,
      },
      {
        medanLama: "Akun",
        kolomBaru: "account_id",
        ubahan: "cari-id",
        wajib: false,
        catatan: "Hanya ada pada laporan Affiliator.",
      },
      {
        medanLama: "Unit",
        kolomBaru: "unit_id",
        ubahan: "cari-id",
        wajib: false,
        catatan:
          "Laporan non-Affiliator bersasaran unit; GMV-nya masuk sebagai 0 karena angka unit dihitung dari sumber lain.",
      },
      {
        medanLama: "GMV",
        kolomBaru: "gmv",
        ubahan: "angka-berpemisah",
        wajib: true,
        catatan: "Sumber kebenaran GMV; kesalahan di sini merusak seluruh KPI.",
      },
      {
        medanLama: "Komisi",
        kolomBaru: "komisi",
        ubahan: "angka-berpemisah",
        wajib: false,
        catatan: "Dipakai apa adanya; tidak dihitung ulang dari GMV.",
      },
      {
        medanLama: "Jumlah Upload",
        kolomBaru: "jumlah_upload",
        ubahan: "angka-berpemisah",
        wajib: false,
      },
      {
        medanLama: "Kendala",
        kolomBaru: "catatan",
        ubahan: "apa-adanya",
        wajib: false,
        gabung: true,
        catatan:
          "Jawaban bebas pada laporan Affiliator. Digabung ke catatan bersama medan bebas lainnya, supaya tidak ada jawaban yang hilang tanpa jejak.",
      },
      {
        medanLama: "Catatan",
        kolomBaru: "catatan",
        ubahan: "apa-adanya",
        wajib: false,
        gabung: true,
        catatan: "Jawaban bebas pada laporan non-Affiliator.",
      },
      {
        medanLama: "createdAt",
        kolomBaru: "submitted_at",
        ubahan: "apa-adanya",
        wajib: false,
        catatan:
          "Kapan laporannya dikirim — berbeda dari tanggal laporan, dan itulah sebabnya keduanya disimpan terpisah.",
      },
      {
        medanLama: null,
        kolomBaru: "status",
        ubahan: "bawaan",
        wajib: true,
        catatan: "Seluruh laporan lama sudah terkirim.",
      },
    ],
    dibuang: [
      {
        medanLama: "Target GMV",
        alasan:
          "Seluruh medan berawalan 'Target …' hanya salinan target saat itu, bukan angka laporan. Menyimpannya sebagai realisasi membuat capaian tampak persis 100%.",
      },
    ],
  },
  {
    kunci: "gmv:daily",
    label: "GMV harian",
    tabelBaru: "daily_reports (pelengkap)",
    baris: [
      {
        medanLama: "id",
        kolomBaru: "id_lama",
        ubahan: "apa-adanya",
        wajib: true,
      },
      {
        medanLama: "date",
        kolomBaru: "tanggal",
        ubahan: "tanggal",
        wajib: true,
      },
      {
        medanLama: "division",
        kolomBaru: "unit_id",
        ubahan: "cari-id",
        wajib: false,
      },
      {
        medanLama: "gmv",
        kolomBaru: "gmv",
        ubahan: "angka-berpemisah",
        wajib: true,
      },
    ],
    dibuang: [
      {
        medanLama: "autoSynced",
        alasan:
          "Entri bertanda autoSynced adalah salinan otomatis dari affiliate-gmv:daily. Ikut dibawa berarti GMV affiliator terhitung dua kali.",
      },
      {
        medanLama: "accountId",
        alasan:
          "Angka per akun diambil dari affiliate-gmv:daily yang lebih lengkap; kunci ini hanya dipakai untuk unit internal.",
      },
    ],
  },
  {
    kunci: "affiliate-gmv:daily",
    label: "GMV affiliator harian",
    tabelBaru: "daily_reports (pelengkap)",
    baris: [
      {
        medanLama: "id",
        kolomBaru: "id_lama",
        ubahan: "apa-adanya",
        wajib: true,
      },
      {
        medanLama: "date",
        kolomBaru: "tanggal",
        ubahan: "tanggal",
        wajib: true,
      },
      {
        medanLama: "accountId",
        kolomBaru: "account_id",
        ubahan: "cari-id",
        wajib: true,
        catatan: "Menunjuk affiliate-accounts:all.id.",
      },
      {
        medanLama: "gmv",
        kolomBaru: "gmv",
        ubahan: "angka-berpemisah",
        wajib: true,
      },
      {
        medanLama: "commission",
        kolomBaru: "komisi",
        ubahan: "angka-berpemisah",
        wajib: false,
      },
      {
        medanLama: "uploads",
        kolomBaru: "jumlah_upload",
        ubahan: "angka-berpemisah",
        wajib: false,
      },
    ],
    dibuang: [],
  },
];

/**
 * Kelompok operasional: absensi, izin, tugas, todo, dan arus kas.
 *
 * Dipetakan setelah data inti karena semuanya menunjuk orang, dan orang
 * baru punya id V2 setelah `users:list` selesai.
 */
export const PEMETAAN_OPERASIONAL: PemetaanEntitas[] = [
  {
    kunci: "attendance:all",
    label: "Absensi",
    tabelBaru: "attendance",
    baris: [
      {
        medanLama: "id",
        kolomBaru: "id_lama",
        ubahan: "apa-adanya",
        wajib: true,
      },
      {
        medanLama: "userId",
        kolomBaru: "user_id",
        ubahan: "cari-id",
        wajib: true,
      },
      {
        medanLama: "date",
        kolomBaru: "tanggal",
        ubahan: "tanggal",
        wajib: true,
      },
      {
        medanLama: "checkIn",
        kolomBaru: "jam_masuk",
        ubahan: "apa-adanya",
        wajib: false,
      },
      {
        medanLama: "checkOut",
        kolomBaru: "jam_pulang",
        ubahan: "apa-adanya",
        wajib: false,
      },
      {
        medanLama: "status",
        kolomBaru: "status",
        ubahan: "apa-adanya",
        wajib: true,
      },
      {
        medanLama: "checkInLocation",
        kolomBaru: "lat_masuk",
        ubahan: "apa-adanya",
        wajib: false,
        catatan:
          "Diambil dari medan lat; koordinat lama tidak divalidasi ulang.",
      },
      {
        medanLama: "checkInLocation",
        kolomBaru: "lng_masuk",
        ubahan: "apa-adanya",
        wajib: false,
        gabung: true,
        catatan: "Diambil dari medan lng pada objek yang sama.",
      },
      {
        medanLama: null,
        kolomBaru: "catatan_bukti",
        ubahan: "bawaan",
        wajib: false,
        catatan:
          "Diisi tanda \u201cbukti di sistem lama\u201d: swafotonya tidak ikut pindah, dan kolom kosong tanpa keterangan terbaca seolah orangnya tidak pernah berswafoto.",
      },
    ],
    dibuang: [
      {
        medanLama: "checkInSelfie",
        alasan:
          "Menunjuk img:store yang tidak ikut dimigrasi. Foto aslinya tetap ada di K-Space lama.",
      },
    ],
  },
  {
    kunci: "attendance:config",
    label: "Pengaturan absensi",
    tabelBaru: "pengaturan",
    baris: [
      {
        medanLama: "jamMasuk",
        kolomBaru: "jam_masuk",
        ubahan: "apa-adanya",
        wajib: true,
      },
      {
        medanLama: "toleransiMenit",
        kolomBaru: "toleransi_menit",
        ubahan: "angka-berpemisah",
        wajib: false,
      },
      {
        medanLama: "radiusMeter",
        kolomBaru: "radius_meter",
        ubahan: "angka-berpemisah",
        wajib: false,
      },
      {
        medanLama: "lokasi",
        kolomBaru: "kantor_lat",
        ubahan: "apa-adanya",
        wajib: false,
        catatan: "Diambil dari medan lat pada objek lokasi.",
      },
      {
        medanLama: "lokasi",
        kolomBaru: "kantor_lng",
        ubahan: "apa-adanya",
        wajib: false,
        gabung: true,
        catatan: "Diambil dari medan lng pada objek yang sama.",
      },
    ],
    dibuang: [
      {
        medanLama: "jamPulang",
        alasan:
          "V2 tidak mengunci jam pulang: yang menentukan boleh pulang adalah kelengkapan laporan, bukan jam.",
      },
      {
        medanLama: "hariKerja",
        alasan:
          "Hari kerja V2 dihitung dari kalender dan agenda, bukan dari daftar tetap.",
      },
    ],
  },
  {
    kunci: "leave-requests:all",
    label: "Pengajuan izin",
    tabelBaru: "attendance",
    baris: [
      {
        medanLama: "id",
        kolomBaru: "id_lama",
        ubahan: "apa-adanya",
        wajib: true,
      },
      {
        medanLama: "userId",
        kolomBaru: "user_id",
        ubahan: "cari-id",
        wajib: true,
      },
      {
        medanLama: "type",
        kolomBaru: "status",
        ubahan: "apa-adanya",
        wajib: true,
        catatan:
          "V2 tidak punya tabel izin tersendiri: izin adalah baris kehadiran berstatus izin atau sakit.",
      },
      {
        medanLama: "startDate",
        kolomBaru: "tanggal",
        ubahan: "tanggal",
        wajib: true,
        gabung: true,
        catatan:
          "Izin beberapa hari menjadi beberapa baris kehadiran, satu per hari — kalau tidak, hari-hari di tengahnya terbaca sebagai mangkir.",
      },
      {
        medanLama: "endDate",
        kolomBaru: "tanggal",
        ubahan: "tanggal",
        wajib: false,
        gabung: true,
        catatan:
          "Bukan kolom tersendiri: rentangnya dibentangkan menjadi satu baris kehadiran per hari. Kolom izin_mulai/izin_selesai di V2 berisi jam, bukan tanggal, dan hanya untuk izin hitungan jam.",
      },
      {
        medanLama: "reason",
        kolomBaru: "alasan",
        ubahan: "apa-adanya",
        wajib: false,
      },
      {
        medanLama: "status",
        kolomBaru: "persetujuan",
        ubahan: "apa-adanya",
        wajib: false,
        catatan:
          "pending \u2192 diajukan, dan tetap menunggu keputusan. Menyetujuinya diam-diam berarti memutuskan atas nama atasan yang belum pernah melihatnya.",
      },
      {
        medanLama: "decidedById",
        kolomBaru: "disetujui_oleh",
        ubahan: "cari-id",
        wajib: false,
      },
      {
        medanLama: null,
        kolomBaru: "catatan_bukti",
        ubahan: "bawaan",
        wajib: false,
        catatan:
          "Ditandai \u201cbukti di sistem lama\u201d, sama seperti kehadiran hasil migrasi lainnya.",
      },
    ],
    dibuang: [],
  },
  {
    kunci: "tasks:all",
    label: "Tugas & QC",
    tabelBaru: "tasks",
    baris: [
      {
        medanLama: "id",
        kolomBaru: "id_lama",
        ubahan: "apa-adanya",
        wajib: true,
      },
      {
        medanLama: "title",
        kolomBaru: "judul",
        ubahan: "apa-adanya",
        wajib: true,
      },
      {
        medanLama: "description",
        kolomBaru: "deskripsi",
        ubahan: "apa-adanya",
        wajib: false,
      },
      {
        medanLama: "context",
        kolomBaru: "konteks",
        ubahan: "apa-adanya",
        wajib: false,
      },
      {
        medanLama: "createdById",
        kolomBaru: "pembuat_id",
        ubahan: "cari-id",
        wajib: true,
      },
      {
        medanLama: "assigneeId",
        kolomBaru: "penerima_id",
        ubahan: "cari-id",
        wajib: true,
      },
      {
        medanLama: "dueDate",
        kolomBaru: "tenggat",
        ubahan: "apa-adanya",
        wajib: false,
      },
      {
        medanLama: "priority",
        kolomBaru: "prioritas",
        ubahan: "apa-adanya",
        wajib: false,
      },
      {
        medanLama: "status",
        kolomBaru: "status",
        ubahan: "apa-adanya",
        wajib: true,
      },
      {
        medanLama: "qc",
        kolomBaru: "qc_status",
        ubahan: "apa-adanya",
        wajib: false,
        catatan:
          "Hasil QC lama ('lolos'/'revisi') menjadi status QC tugasnya; yang belum diperiksa masuk sebagai 'belum'.",
      },
      {
        medanLama: "qc",
        kolomBaru: "qc_by",
        ubahan: "cari-id",
        wajib: false,
        gabung: true,
        catatan: "Diambil dari medan checkedById pada objek qc.",
      },
      {
        medanLama: "qc",
        kolomBaru: "qc_at",
        ubahan: "apa-adanya",
        wajib: false,
        gabung: true,
        catatan: "Diambil dari medan checkedAt pada objek yang sama.",
      },
      {
        medanLama: "qc",
        kolomBaru: "qc_note",
        ubahan: "apa-adanya",
        wajib: false,
        gabung: true,
        catatan: "Diambil dari medan notes pada objek yang sama.",
      },
    ],
    dibuang: [],
  },
  {
    kunci: "todos:all",
    label: "Todo",
    tabelBaru: "tasks",
    baris: [
      {
        medanLama: "id",
        kolomBaru: "id_lama",
        ubahan: "apa-adanya",
        wajib: true,
      },
      {
        medanLama: "userId",
        kolomBaru: "penerima_id",
        ubahan: "cari-id",
        wajib: true,
        catatan:
          "Todo di V2 adalah tugas pribadi: pembuat dan penerimanya orang yang sama.",
      },
      {
        medanLama: "title",
        kolomBaru: "judul",
        ubahan: "apa-adanya",
        wajib: true,
      },
      {
        medanLama: "done",
        kolomBaru: "status",
        ubahan: "apa-adanya",
        wajib: true,
        catatan: "true \u2192 selesai, false \u2192 todo.",
      },
      {
        medanLama: "createdAt",
        kolomBaru: "dibuat_pada",
        ubahan: "apa-adanya",
        wajib: false,
      },
      {
        medanLama: null,
        kolomBaru: "tipe",
        ubahan: "bawaan",
        wajib: true,
        catatan: "Seluruhnya masuk sebagai tugas bertipe pribadi.",
      },
    ],
    dibuang: [],
  },
  {
    kunci: "keuangan:cashflow",
    label: "Arus kas",
    tabelBaru: "transactions",
    baris: [
      {
        medanLama: "id",
        kolomBaru: "id_lama",
        ubahan: "apa-adanya",
        wajib: true,
      },
      {
        medanLama: "date",
        kolomBaru: "tanggal",
        ubahan: "tanggal",
        wajib: true,
      },
      {
        medanLama: "type",
        kolomBaru: "arah",
        ubahan: "apa-adanya",
        wajib: true,
        catatan: "in \u2192 masuk, out \u2192 keluar.",
      },
      {
        medanLama: "amount",
        kolomBaru: "jumlah",
        ubahan: "angka-berpemisah",
        wajib: true,
      },
      {
        medanLama: "description",
        kolomBaru: "keterangan",
        ubahan: "apa-adanya",
        wajib: true,
      },
      {
        medanLama: "category",
        kolomBaru: "jenis",
        ubahan: "apa-adanya",
        wajib: false,
        catatan:
          "Kategori lama berupa teks bebas; hanya yang punya padanan di jenis keluar V2 yang dipakai, sisanya masuk ke keterangan.",
      },
      {
        medanLama: "division",
        kolomBaru: "unit_id",
        ubahan: "cari-id",
        wajib: false,
      },
      {
        medanLama: "inputById",
        kolomBaru: "diajukan_id",
        ubahan: "cari-id",
        wajib: false,
      },
      {
        medanLama: null,
        kolomBaru: "status",
        ubahan: "bawaan",
        wajib: true,
        catatan:
          "Seluruhnya masuk berstatus dibayar. Arus kas lama hanya mencatat yang sudah terjadi; melewatkannya ke alur persetujuan berarti meminta orang menyetujui ulang transaksi tahun lalu.",
      },
    ],
    dibuang: [],
  },
];

/** Seluruh kelompok pemetaan V1 yang sudah ditetapkan. */
export const PEMETAAN_V1: PemetaanEntitas[] = [
  ...PEMETAAN_INTI,
  ...PEMETAAN_OPERASIONAL,
];
