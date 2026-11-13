/**
 * Membuat contoh ekspor K-Space V1 dalam bentuk yang sesungguhnya.
 *
 * Contoh sebelumnya (`kv-store-contoh.json`) mengarang bentuk ekspornya:
 * satu baris per entitas dengan kunci `user:<uuid>`. Ekspor K-Space lama
 * tidak berbentuk begitu. Ia satu objek JSON: sebuah `_meta` ditambah
 * belasan kunci tingkat atas — `users:list`, `daily-reports:all`,
 * `keuangan:cashflow` — yang masing-masing berisi seluruh datanya
 * sekaligus. Parser yang dikembangkan di atas bentuk karangan akan gagal
 * di hari pertama migrasi sungguhan.
 *
 * Isinya diturunkan dari data seed demo — nama, akun, dan angka yang
 * sudah fiktif — dengan surel disamarkan ke domain contoh. Yang ditiru
 * dari ekspor asli adalah BENTUKNYA: ejaan medan camelCase, label
 * berbahasa Indonesia pada laporan harian, penanda `autoSynced`, dan
 * rujukan swafoto ke `img:store`.
 *
 * Tidak ada satu pun medan kata sandi di sini, dan tidak boleh ada:
 * berkas ini ikut dalam repositori.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Dengan `--cek`, berkasnya tidak ditulis — hanya dibandingkan.
 *
 * Contoh ekspor ikut dalam repositori dan dibaca mode demo maupun
 * beberapa test. Kalau seseorang menyuntingnya manual, isinya melenceng
 * dari skrip yang seharusnya menghasilkannya, dan tidak ada yang tahu
 * sampai ada yang menjalankan skripnya lagi dan menimpanya.
 */
const cekSaja = process.argv.includes("--cek");

const AKAR = process.cwd();
const seed = JSON.parse(
  readFileSync(path.join(AKAR, "supabase/seed/data.json"), "utf8"),
);

/** Id lama dibuat berurutan; id V1 yang asli tidak pernah kita punya. */
const nomor = (awalan, i) => `${awalan}_${String(i + 1).padStart(3, "0")}`;

/** Sistem lama menulis angka sebagai teks berpemisah ribuan. */
const angkaTeks = (n) => Number(n ?? 0).toLocaleString("id-ID");

const surel = (email) => `${String(email).split("@")[0]}@contoh.id`;

// --- Orang ------------------------------------------------------------
const idOrang = new Map();
const users = seed.users.map((u, i) => {
  const id = nomor("usr", i);
  idOrang.set(u.nama, id);
  return {
    id,
    name: u.nama,
    email: surel(u.email),
    role: u.role,
    position: u.jabatan,
    division: u.unit ?? null,
    phone: u.kontak ?? null,
    joinDate: "2024-01-15",
    active: true,
  };
});
// `leaderId` baru bisa diisi setelah semua orang punya id.
for (const [i, u] of seed.users.entries()) {
  users[i].leaderId = u.atasan ? (idOrang.get(u.atasan) ?? null) : null;
}

// --- Akun affiliator --------------------------------------------------
const idAkun = new Map();
const akun = seed.accounts.map((a, i) => {
  const id = nomor("acc", i);
  idAkun.set(a.username, id);
  return {
    id,
    username: a.username,
    division: a.unit,
    program: a.program,
    picId: idOrang.get(a.pic) ?? null,
    coLeaderId: a.co_leader ? (idOrang.get(a.co_leader) ?? null) : null,
    dailyTarget: angkaTeks(a.target_harian),
    active: true,
  };
});

// --- Laporan harian ---------------------------------------------------
// Medannya berlabel bahasa Indonesia karena formulir lama menyimpan
// jawaban memakai judul pertanyaannya, bukan nama kolom.
const laporan = seed.daily_reports.map((l, i) => {
  const dasar = {
    id: nomor("rep", i),
    userId: idOrang.get(l.user) ?? null,
    "Tanggal Laporan": l.tanggal,
    createdAt: `${l.tanggal}T${l.jam ?? "18:00"}:00+07:00`,
  };
  if (l.akun) {
    return {
      ...dasar,
      Akun: l.akun,
      GMV: angkaTeks(l.gmv),
      Komisi: angkaTeks(l.komisi ?? 0),
      "Jumlah Upload": l.jumlah_upload ?? 0,
      // Medan target ikut terekspor meski hanya salinan target saat itu;
      // pemetaan membuangnya, bukan menyimpannya sebagai angka laporan.
      "Target GMV": angkaTeks(4500000),
      Kendala: l.catatan ?? "",
    };
  }
  return {
    ...dasar,
    Unit: l.unit,
    GMV: angkaTeks(l.gmv),
    Catatan: l.catatan ?? "",
  };
});

// --- GMV harian -------------------------------------------------------
// Dua kunci memuat angka yang sama. `gmv:daily` menampung yang ditarik
// otomatis (autoSynced) maupun yang diketik; `affiliate-gmv:daily` hanya
// yang affiliator. Menjumlahkan keduanya berarti menggandakan GMV.
const gmvHarian = [];
const gmvAffiliate = [];
seed.daily_reports.forEach((l, i) => {
  if (!l.akun) {
    gmvHarian.push({
      id: nomor("gmv", i),
      date: l.tanggal,
      division: l.unit,
      gmv: angkaTeks(l.gmv),
      autoSynced: false,
    });
    return;
  }
  gmvHarian.push({
    id: nomor("gmv", i),
    date: l.tanggal,
    division: "affiliator",
    accountId: idAkun.get(l.akun) ?? null,
    gmv: angkaTeks(l.gmv),
    autoSynced: true,
  });
  gmvAffiliate.push({
    id: nomor("agm", i),
    date: l.tanggal,
    accountId: idAkun.get(l.akun) ?? null,
    gmv: angkaTeks(l.gmv),
    commission: angkaTeks(l.komisi ?? 0),
    uploads: l.jumlah_upload ?? 0,
  });
});

// --- Absensi ----------------------------------------------------------
const hadir = seed.attendance.filter(
  (a) => a.status !== "izin" && a.status !== "sakit",
);
const absensi = hadir.map((a, i) => ({
  id: nomor("att", i),
  userId: idOrang.get(a.user) ?? null,
  date: a.tanggal,
  checkIn: a.jam_masuk ?? null,
  checkOut: a.jam_pulang ?? null,
  status: a.status,
  // Swafoto disimpan sebagai rujukan ke img:store, dan img:store tidak
  // ikut pindah — inilah sebabnya absensi hasil migrasi ditandai
  // "bukti di sistem lama".
  checkInSelfie: `img:store/${nomor("sf", i)}`,
  checkInLocation: { lat: a.lat ?? null, lng: a.lng ?? null },
}));

// --- Izin -------------------------------------------------------------
const izin = seed.attendance
  .filter((a) => a.status === "izin" || a.status === "sakit")
  .map((a, i) => ({
    id: nomor("lve", i),
    userId: idOrang.get(a.user) ?? null,
    type: a.status,
    startDate: a.tanggal,
    endDate: a.tanggal,
    reason: a.alasan || "Tidak dituliskan",
    // Pengajuan yang masih menunggu keputusan tetap menunggu setelah
    // pindah; menyetujuinya diam-diam berarti memutuskan atas nama orang.
    status: a.persetujuan ?? "pending",
    decidedById: a.persetujuan ? (idOrang.get("Farhan Pratama") ?? null) : null,
  }));

// --- Tugas & todo -----------------------------------------------------
const tugas = seed.tasks
  .filter((t) => t.tipe !== "pribadi")
  .map((t, i) => ({
    id: nomor("tsk", i),
    title: t.judul,
    description: t.deskripsi ?? "",
    context: t.konteks ?? "",
    createdById: idOrang.get(t.pembuat) ?? null,
    assigneeId: idOrang.get(t.penerima) ?? null,
    dueDate: t.tenggat,
    priority: t.prioritas,
    status: t.status,
    qc:
      t.qc && t.qc !== "belum"
        ? {
            result: t.qc,
            checkedById: idOrang.get(t.pembuat) ?? null,
            checkedAt: t.tenggat,
            notes: "Sesuai standar.",
          }
        : null,
  }));

const todos = seed.tasks
  .filter((t) => t.tipe === "pribadi")
  .map((t, i) => ({
    id: nomor("tdo", i),
    userId: idOrang.get(t.penerima) ?? null,
    title: t.judul,
    done: t.status === "selesai",
    // V1 tidak mewajibkan waktu pada to-do. To-do seed yang tenggatnya
    // hanya tanggal (`tanpa_jam`, sejak tenggat wajib di V2) diekspor
    // tanpa waktu, seperti aslinya.
    createdAt: t.tanpa_jam ? null : t.tenggat,
  }));

// --- Keuangan ---------------------------------------------------------
// Arus kas lama hanya mencatat yang sudah terjadi: tidak ada alur
// pengajuan maupun persetujuan di dalamnya.
const kas = seed.transaksi.map((t, i) => ({
  id: nomor("cf", i),
  date: t.tanggal,
  type: t.arah === "masuk" ? "in" : "out",
  category: t.jenis ?? (t.arah === "masuk" ? "Pemasukan" : "Operasional"),
  amount: angkaTeks(t.jumlah),
  description: t.keterangan,
  division: t.unit ?? null,
  inputById: idOrang.get(t.diajukan) ?? null,
}));

// --- Rujukan & kunci yang diabaikan -----------------------------------
const targetGmv = seed.goals
  .filter((g) => g.unit)
  .flatMap((g) =>
    (g.bulan_list ?? [{ bulan: g.bulan, target: g.target_bulan }]).map((b) => ({
      division: g.unit,
      month: b.bulan,
      target: angkaTeks(b.target),
    })),
  );

const goalAffiliate = seed.accounts.map((a) => ({
  accountId: idAkun.get(a.username),
  month: "2024-10-01",
  target: angkaTeks(a.target_harian * 26),
}));

// --- Kunci migrasi V1 tahap 2 -------------------------------------------
// Pengumuman, kalender, jadwal, masalah, masukan, sampel, LMS, dan
// catatan. Seed demo V2 tidak punya padanannya, jadi contohnya ditulis
// tangan mengikuti BENTUK ekspor asli: satu baris per kunci, cukup untuk
// menguji pemetaan tiap medan. Dulu baris-baris ini disunting langsung
// di berkas hasil, sehingga `--cek` selalu gagal; sekarang sumbernya di
// sini.
const KUNCI_TAHAP_2 = {
  "announcements:all": [
    {
      "id": "ann_001",
      "title": "📢 PENGUMUMAN TIM",
      "content": "Rapat bulanan dimajukan ke Senin.\n\nMohon hadir tepat waktu.",
      "authorId": "usr_001",
      "authorName": "Farhan Pratama",
      "createdAt": "2024-10-01T02:00:00.000Z"
    }
  ],
  "calendar:all": [
    {
      "id": "cal_001",
      "date": "2024-10-15",
      "time": "19:30",
      "endTime": "21:00",
      "type": "meeting",
      "title": "Meeting dengan Dosen",
      "location": "https://zoom.us/j/1",
      "description": "Bahas kerja sama kampus.",
      "attendeeIds": [
        "usr_001",
        "usr_002"
      ],
      "attendeeNames": [
        "A",
        "B"
      ],
      "createdById": "usr_001",
      "createdByName": "A",
      "createdAt": "2024-10-01T02:00:00.000Z"
    }
  ],
  "schedule:all": [
    {
      "id": "sch_001",
      "date": "2024-10-03",
      "time": "09:00",
      "type": "piket_grup",
      "notes": "Meeting bersama leader affiliator",
      "status": "scheduled",
      "adminId": "usr_002",
      "adminName": "B",
      "createdAt": "2024-10-01T02:00:00.000Z",
      "creatorId": "",
      "creatorName": "-"
    }
  ],
  "problems:all": [
    {
      "id": "prb_001",
      "title": "Akun contoh terkena pembatasan",
      "status": "resolved",
      "urgency": "tinggi",
      "division": "internal",
      "createdAt": "2024-10-02T01:00:00.000Z",
      "rootCause": {
        "root": "pelanggaran konten",
        "why1": "pelanggaran konten",
        "corrective": "diganti akun baru",
        "preventive": "periksa aturan sebelum unggah"
      },
      "resolvedAt": "2024-10-03T01:00:00.000Z",
      "description": "Akun dibatasi selama tiga hari.",
      "relatedType": "creator",
      "reportedById": "usr_002",
      "resolvedById": "usr_001",
      "reportedByName": "B",
      "resolvedByName": "A"
    }
  ],
  "feedback:all": [
    {
      "id": "fbk_001",
      "page": "Absensi",
      "type": "bug",
      "images": [],
      "status": "selesai",
      "userId": "usr_002",
      "message": "Rekap absen 7 hari terakhir tidak sesuai dengan kalender.",
      "replies": [
        {
          "id": "fbk_001_r1",
          "text": "Sudah diperbaiki di versi berikutnya.",
          "userId": "usr_001",
          "userName": "A",
          "createdAt": "2024-10-02T03:00:00.000Z"
        }
      ],
      "userName": "B",
      "userRole": "leader",
      "createdAt": "2024-10-02T02:00:00.000Z"
    }
  ],
  "sampel:all": [
    {
      "id": "SMP-241001-0001",
      "foto": null,
      "kode": "SMP-241001-0001",
      "nama": "Gamis contoh",
      "token": "ABCD1234",
      "catatan": "",
      "kategori": "Fashion",
      "sellerId": "",
      "createdAt": "2024-10-01T04:00:00.000Z",
      "lifecycle": "aktif",
      "linkProduk": [],
      "penerimaId": "usr_002",
      "sellerNama": "",
      "createdById": "usr_001",
      "penerimaNama": "B",
      "createdByName": "A",
      "tanggalDatang": "2024-10-01",
      "riwayatKeputusan": []
    }
  ],
  "sampel-usage:all": [
    {
      "id": "2024-10-01-usg001",
      "usedAt": "2024-10-01T05:00:00.000Z",
      "userId": "usr_001",
      "sampelId": "SMP-241001-0001",
      "userName": "A",
      "createdAt": "2024-10-01T05:00:00.000Z",
      "sampelKode": "SMP-241001-0001"
    }
  ],
  "lms:paths:all": [
    {
      "id": "path_001",
      "title": "On Boarding Affiliator",
      "status": "published",
      "courses": [
        {
          "order": 0,
          "courseId": "crs_001",
          "required": true
        }
      ],
      "createdAt": "2024-09-01T00:00:00.000Z",
      "updatedAt": "2024-09-01T00:00:00.000Z",
      "description": "",
      "estimatedDays": 7,
      "targetDivisions": [
        "internal"
      ],
      "targetJobTitles": [
        "Affiliator"
      ]
    }
  ],
  "lms:courses:all": [
    {
      "id": "crs_001",
      "title": "PlayBook Affiliator",
      "status": "published",
      "priority": "wajib",
      "createdAt": "2024-09-01T00:00:00.000Z",
      "updatedAt": "2024-09-01T00:00:00.000Z",
      "description": "",
      "passingScore": 85,
      "estimatedMinutes": 75,
      "modules": [
        {
          "id": "mod_001",
          "order": 0,
          "title": "Playbook Affiliator",
          "description": "",
          "lessons": [
            {
              "id": "les_001",
              "type": "pdf",
              "order": 0,
              "title": "Affiliator Playbook",
              "pdfUrl": "https://contoh.invalid/playbook.pdf",
              "pdfName": "playbook.pdf",
              "required": true,
              "estimatedMinutes": 75
            }
          ]
        }
      ]
    }
  ],
  "lms:enrollments:all": [
    {
      "id": "usr_002:path_001",
      "pathId": "path_001",
      "source": "AUTO",
      "status": "NOT_STARTED",
      "userId": "usr_002",
      "userName": "B",
      "pathTitle": "On Boarding Affiliator",
      "startedAt": null,
      "assignedAt": "2024-09-02T00:00:00.000Z",
      "completedAt": null,
      "assignedById": "usr_001",
      "assignedByName": "A"
    }
  ],
  "lms:progress:all": [
    {
      "id": "usr_002:les_001",
      "done": true,
      "detail": null,
      "userId": "usr_002",
      "percent": 100,
      "courseId": "crs_001",
      "lessonId": "les_001",
      "updatedAt": "2024-09-03T00:00:00.000Z",
      "completedAt": "2024-09-03T00:00:00.000Z"
    }
  ],
  "lms:library:all": [
    {
      "id": "lib_001",
      "type": "pdf",
      "order": 0,
      "title": "Mega Hook Creator",
      "pdfUrl": "https://contoh.invalid/hook.pdf",
      "status": "published",
      "pdfName": "hook.pdf",
      "pdfSize": 1000,
      "category": "",
      "createdAt": "2024-09-01T00:00:00.000Z",
      "updatedAt": "2024-09-01T00:00:00.000Z",
      "createdById": "usr_001",
      "description": "Untuk affiliator",
      "createdByName": "A"
    }
  ],
  "notes:all": [
    {
      "id": "note_001",
      "title": "Templat chat admin",
      "content": "Halo Kak, terima kasih sudah bergabung.",
      "authorId": "usr_001",
      "category": "sop",
      "division": "mcn",
      "isPinned": true,
      "createdAt": "2024-10-01T00:00:00.000Z",
      "relatedId": null,
      "updatedAt": "2024-10-02T00:00:00.000Z",
      "authorName": "A",
      "visibility": "private",
      "attachments": [
        {
          "src": "https://contoh.invalid/a.png",
          "name": "a.png",
          "type": "image"
        }
      ],
      "relatedType": null
    }
  ]
};

const ekspor = {
  _meta: {
    version: "1.9.2",
    exportedAt: "2024-10-25T09:00:00+07:00",
    exportedBy: surel("owner@alkahfi.co.id"),
    source: "kspace-v1",
    totalKeys: 15,
    catatan:
      "Contoh bentuk ekspor K-Space V1. Isinya data demo; tidak memuat medan kata sandi.",
  },
  "users:list": users,
  "affiliate-accounts:all": akun,
  "daily-reports:all": laporan,
  "gmv:daily": gmvHarian,
  "affiliate-gmv:daily": gmvAffiliate,
  "attendance:all": absensi,
  "attendance:config": {
    jamMasuk: "07:30",
    jamPulang: "17:00",
    toleransiMenit: 15,
    radiusMeter: 150,
    lokasi: { lat: -6.2607, lng: 106.8102, nama: "Kantor Pusat" },
    hariKerja: ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu"],
  },
  "leave-requests:all": izin,
  "tasks:all": tugas,
  "todos:all": todos,
  "keuangan:cashflow": kas,
  "gmv:targets": targetGmv,
  "affiliate:goal": goalAffiliate,
  // Kunci yang sengaja tidak dibawa; ikut disertakan supaya layar unggah
  // benar-benar menunjukkan bagaimana kunci diabaikan ditandai.
  "img:store": absensi.slice(0, 3).map((a, i) => ({
    id: nomor("sf", i),
    ref: a.checkInSelfie,
    mime: "image/jpeg",
    size: 148213,
  })),
  "app:settings": { theme: "light", locale: "id-ID", weekStart: "monday" },
  ...KUNCI_TAHAP_2,
};

const tujuan = path.join(AKAR, "supabase/migrasi/ekspor-contoh.json");
const isiBaru = `${JSON.stringify(ekspor, null, 2)}\n`;

if (cekSaja) {
  if (!existsSync(tujuan)) {
    console.error("✗ supabase/migrasi/ekspor-contoh.json belum ada.");
    console.error("  Jalankan: npm run ekspor:contoh");
    process.exit(1);
  }
  if (readFileSync(tujuan, "utf8") !== isiBaru) {
    console.error(
      "✗ supabase/migrasi/ekspor-contoh.json tidak sama dengan yang dihasilkan skripnya.",
    );
    console.error(
      "  Berkas ini dibaca mode demo dan beberapa test; suntingan manual akan",
    );
    console.error(
      "  hilang tanpa jejak begitu skripnya dijalankan. Perbaiki skripnya, lalu:",
    );
    console.error("  npm run ekspor:contoh");
    process.exit(1);
  }
  console.log("✓ contoh ekspor masih sama dengan skrip pembuatnya");
  process.exit(0);
}

mkdirSync(path.join(AKAR, "supabase/migrasi"), { recursive: true });
writeFileSync(tujuan, isiBaru);

const rincian = Object.entries(ekspor)
  .filter(([k]) => k !== "_meta")
  .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length : 1}`);

console.log("✓ supabase/migrasi/ekspor-contoh.json dibuat");
console.log(`  ${rincian.length} kunci · ${rincian.join(" · ")}`);
