/**
 * Membuat tiruan ekspor `kv_store` sistem lama dari data seed.
 *
 * Sistem lama menyimpan segalanya sebagai pasangan kunci-nilai, sehingga
 * bentuknya tidak seragam. Tiruan ini sengaja memuat kerusakan yang
 * memang lazim ditemui pada ekspor sungguhan — kunci salah format, nilai
 * kosong, tanggal bergaya lain, angka bertanda pemisah ribuan, dan entri
 * ganda. Parser yang hanya diuji dengan data rapi akan gagal di hari
 * pertama migrasi sungguhan.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const AKAR = process.cwd();
const seed = JSON.parse(
  readFileSync(path.join(AKAR, "supabase/seed/data.json"), "utf8"),
);

const entri = [];
const tulis = (key, value) => entri.push({ key, value });

// --- Anggota tim ------------------------------------------------------
for (const u of seed.users) {
  tulis(`user:${u.id}`, {
    id: u.id,
    nama_lengkap: u.nama,
    email: u.email,
    role: u.role,
    jabatan: u.jabatan,
    unit: u.unit ?? null,
    atasan: u.atasan ?? null,
    aktif: (u.status ?? "aktif") === "aktif",
  });
}

// --- Akun affiliator --------------------------------------------------
for (const a of seed.accounts) {
  tulis(`account:${a.username}`, {
    username: a.username,
    pic: a.pic,
    unit: a.unit,
    program: a.program,
    // Sistem lama menulis angka dengan pemisah ribuan sebagai teks.
    target_harian: a.target_harian.toLocaleString("id-ID"),
  });
}

// --- Goal -------------------------------------------------------------
for (const g of seed.goals) {
  tulis(`goal:${g.id}`, {
    id: g.id,
    judul: g.judul,
    level: g.level,
    pemilik: g.pemilik,
    unit: g.unit ?? null,
    account: g.account ?? null,
    base: g.target_base,
    goal: g.target_goal,
    stretch: g.target_stretch,
    bulan: g.bulan,
    target_bulan: g.target_bulan,
  });
}

// --- Laporan harian ---------------------------------------------------
for (const l of seed.daily_reports) {
  const kunci = `report:${l.tanggal}:${l.akun ?? l.unit ?? "tanpa-sasaran"}`;
  tulis(kunci, {
    tanggal: l.tanggal,
    akun: l.akun ?? null,
    unit: l.unit ?? null,
    pelapor: l.user ?? null,
    gmv: l.gmv,
    catatan: l.catatan ?? "",
  });
}

// --- Absensi ----------------------------------------------------------
for (const a of seed.attendance) {
  tulis(`attendance:${a.tanggal}:${a.user}`, {
    tanggal: a.tanggal,
    user: a.user,
    status: a.status,
    jam_masuk: a.jam_masuk ?? null,
    jam_pulang: a.jam_pulang ?? null,
  });
}

// --- Tugas ------------------------------------------------------------
seed.tasks.forEach((t, i) => {
  tulis(`task:${i + 1}`, {
    judul: t.judul,
    tipe: t.tipe,
    pembuat: t.pembuat,
    penerima: t.penerima,
    tenggat: t.tenggat,
    status: t.status,
  });
});

// ---------------------------------------------------------------------
// Kerusakan yang memang lazim pada ekspor sungguhan.
// ---------------------------------------------------------------------
const rusak = [
  // Kunci tanpa pemisah — tidak bisa ditentukan entitasnya.
  { key: "user_lama_tanpa_titik_dua", value: { nama: "Entah Siapa" } },
  // Entitas yang tidak dikenal aplikasi baru.
  { key: "seller:998", value: { nama: "Toko Lama", catatan: "fitur dihapus" } },
  // Nilai kosong.
  { key: "account:@akun_kosong", value: null },
  // Tanggal bergaya lain.
  {
    key: "report:24-10-2024:@skincare_official",
    value: { tanggal: "24-10-2024", akun: "@skincare_official", gmv: 1000000 },
  },
  // GMV sebagai teks berpemisah.
  {
    key: "report:2024-10-20:@fashion_hijab",
    value: { tanggal: "2024-10-20", akun: "@fashion_hijab", gmv: "2.500.000" },
  },
  // Menunjuk akun yang tidak ada.
  {
    key: "report:2024-10-21:@akun_sudah_hilang",
    value: { tanggal: "2024-10-21", akun: "@akun_sudah_hilang", gmv: 750000 },
  },
  // Email ganda dengan huruf berbeda.
  {
    key: "user:duplikat-rian",
    value: {
      nama_lengkap: "Rian Hidayat",
      email: "RIAN@alkahfi.co.id",
      role: "Staff",
      unit: "affiliator",
    },
  },
  // Peran yang tidak dikenal.
  {
    key: "user:peran-asing",
    value: {
      nama_lengkap: "Bekas Intern",
      email: "intern@alkahfi.co.id",
      role: "Intern",
      unit: "mcn",
    },
  },
];
entri.push(...rusak);

// Satu kunci yang benar-benar muncul dua kali, seperti ekspor tanpa
// deduplikasi.
entri.push(entri.find((e) => e.key.startsWith("account:@")));

const keluaran = {
  _catatan:
    "Tiruan ekspor kv_store sistem lama. Dibuat oleh scripts/buat-kv-store-tiruan.mjs; jangan disunting manual.",
  dibuat_pada: "2024-10-25T09:00:00+07:00",
  sumber: "kv_store",
  jumlah: entri.length,
  entri,
};

mkdirSync(path.join(AKAR, "supabase/migrasi"), { recursive: true });
writeFileSync(
  path.join(AKAR, "supabase/migrasi/kv-store-contoh.json"),
  `${JSON.stringify(keluaran, null, 2)}\n`,
);

const perEntitas = {};
for (const e of entri) {
  const jenis = e.key.includes(":") ? e.key.split(":")[0] : "(tanpa entitas)";
  perEntitas[jenis] = (perEntitas[jenis] ?? 0) + 1;
}

console.log("✓ supabase/migrasi/kv-store-contoh.json dibuat");
console.log(
  `  ${entri.length} entri · ${Object.entries(perEntitas)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ")}`,
);
console.log(`  termasuk ${rusak.length + 1} entri bermasalah yang disengaja`);
