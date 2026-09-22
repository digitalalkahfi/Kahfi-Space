/** Penyusutan di basis data harus sama persis dengan yang dihitung layar. */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";
import { readFile } from "node:fs/promises";
import {
  akumulasiPenyusutan,
  bulanPenuh,
  nilaiBuku,
  ringkasAset,
} from "../../src/lib/aset.ts";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Penyusutan aset");

const seed = JSON.parse(await readFile("supabase/seed/data.json", "utf8"));
const ACUAN = seed.tanggalAcuan;

/** Bentuk aset seperti yang dibaca aplikasi dari data contoh. */
const asetLayar = seed.aset.map((a) => ({
  id: a.id,
  kode: a.kode,
  nama: a.nama,
  kategori: a.kategori,
  unitKode: a.unit ?? null,
  unitNama: a.unit ?? "Perusahaan",
  tanggal: a.tanggal,
  nilaiPerolehan: a.nilai,
  masaManfaat: a.masa_manfaat,
  residu: a.residu,
  status: a.status,
  pemegangId: null,
  pemegangNama: a.pemegang ?? null,
  lokasi: a.lokasi,
  berakhir: a.berakhir ?? null,
  transaksiId: null,
  catatan: a.catatan,
}));

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const finance = await id("Laras Ayuningtyas");
const staf = await id("Rian Hidayat");

uji("bulan penuh dihitung sama dengan hitungan aplikasi", async () => {
  const pasangan = [
    ["2024-01-15", "2024-02-14"],
    ["2024-01-15", "2024-02-15"],
    ["2023-03-15", "2024-10-24"],
    ["2024-10-24", "2024-01-01"],
  ];

  for (const [dari, sampai] of pasangan) {
    const { rows } = await sebagaiAdmin(
      db,
      "select bulan_penuh($1, $2) as n",
      [dari, sampai],
    );
    harusSama(rows[0].n, bulanPenuh(dari, sampai), `${dari} → ${sampai}`);
  }
});

uji("nilai buku tiap aset sama dengan hitungan aplikasi", async () => {
  const { rows } = await sebagai(
    db,
    finance,
    "select * from nilai_buku_aset($1)",
    [ACUAN],
  );

  harusSama(rows.length, asetLayar.length, "jumlah aset");

  for (const baris of rows) {
    const layar = asetLayar.find((a) => a.kode === baris.kode);
    harus(layar, `${baris.kode} ada di data contoh`);
    harusSama(
      Number(baris.akumulasi_penyusutan),
      akumulasiPenyusutan(layar, ACUAN),
      `${baris.kode}: akumulasi penyusutan`,
    );
    harusSama(
      Number(baris.nilai_buku),
      nilaiBuku(layar, ACUAN),
      `${baris.kode}: nilai buku`,
    );
  }
});

uji("ringkasan nilai aset sama dengan hitungan aplikasi", async () => {
  const layar = ringkasAset(asetLayar, ACUAN);
  const { rows } = await sebagai(
    db,
    finance,
    "select * from ringkas_nilai_aset($1)",
    [ACUAN],
  );
  const basis = rows[0];

  harusSama(basis.dimiliki, layar.dimiliki, "aset yang masih dimiliki");
  harusSama(basis.total, layar.total, "seluruh aset yang pernah tercatat");
  harusSama(
    Number(basis.nilai_perolehan),
    layar.nilaiPerolehan,
    "nilai perolehan",
  );
  harusSama(
    Number(basis.akumulasi_penyusutan),
    layar.akumulasiPenyusutan,
    "akumulasi penyusutan",
  );
  harusSama(Number(basis.nilai_buku), layar.nilaiBuku, "nilai buku");
  harusSama(basis.perlu_perhatian, layar.perluPerhatian, "perlu ditindak");
  harusSama(basis.tanpa_pemegang, layar.tanpaPemegang, "tanpa pemegang");
  harusSama(Number(basis.nilai_hilang), layar.nilaiHilang, "nilai hangus");
  harusSama(
    Number(basis.susut_bulan_ini),
    layar.susutBulanIni,
    "beban penyusutan bulan berjalan",
  );
});

uji("penyusutan berhenti di residu, tidak pernah minus", async () => {
  const { rows } = await sebagai(
    db,
    finance,
    "select * from nilai_buku_aset($1)",
    ["2040-01-01"],
  );

  for (const baris of rows) {
    const layar = asetLayar.find((a) => a.kode === baris.kode);
    harus(
      Number(baris.nilai_buku) >= 0,
      `${baris.kode}: nilai buku tidak minus`,
    );
    if (!["dilepas", "hilang"].includes(layar.status) && layar.masaManfaat > 0) {
      harusSama(
        Number(baris.nilai_buku),
        layar.residu,
        `${baris.kode}: berhenti tepat di residu`,
      );
    }
  }
});

uji("aset yang dilepas atau hilang bernilai buku nol", async () => {
  const { rows } = await sebagai(
    db,
    finance,
    "select * from nilai_buku_aset($1)",
    [ACUAN],
  );

  for (const kode of ["AST-0010", "AST-0011"]) {
    const baris = rows.find((r) => r.kode === kode);
    harusSama(Number(baris.nilai_buku), 0, `${kode}: bukan milik kita lagi`);
  }
});

uji("aset tanpa masa manfaat tidak disusutkan", async () => {
  const { rows } = await sebagai(
    db,
    finance,
    `select nilai_buku(a, $1) as buku, a.nilai_perolehan
     from assets a where a.masa_manfaat = 0 and a.status = 'cadangan'
     limit 1`,
    [ACUAN],
  );

  if (rows.length > 0) {
    harusSama(
      Number(rows[0].buku),
      Number(rows[0].nilai_perolehan),
      "nilainya utuh",
    );
  }
});

uji("ringkasan perusahaan tidak dijawab sebagian", async () => {
  // Staff memang melihat aset yang ia pegang sendiri (migrasi 0102),
  // tetapi menjumlahkan sisa itu lalu menyebutnya nilai aset perusahaan
  // akan menyesatkan. Jadi jawabannya nol, bukan sebagian.
  const { rows } = await sebagai(db, staf, "select * from ringkas_nilai_aset()");

  harusSama(Number(rows[0].nilai_buku), 0, "tanpa hak, tidak ada angka");
  harusSama(rows[0].total, 0, "tidak juga jumlah asetnya");

  const { rows: miliknya } = await sebagai(
    db,
    staf,
    "select * from nilai_buku_aset()",
  );
  harus(
    miliknya.length > 0 && miliknya.length < asetLayar.length,
    "yang ia pegang sendiri tetap terbaca, sisanya tidak",
  );
});

await jalankan();
await db.close();
