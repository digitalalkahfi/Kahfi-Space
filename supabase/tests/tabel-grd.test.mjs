/**
 * Tabel GRD (0197): susunan sheet GRD Cascade disimpan sebagai blok,
 * tiap rencana menunjuk bloknya, dan blok goal membaca judul goal itu
 * sendiri — satu sumber dengan tampilan hierarki.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Tabel GRD Cascade");

const PERIODE = "2024-11-01";
const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu("select id from users where nama = $1", [nama])).id;

const goal = async (kode, level, induk, judul) => ({
  kode,
  judul,
  level,
  induk,
  // Tanpa pemilik: batas 3 goal per orang tidak relevan di sini.
  pemilik_id: null,
  unit_id: null,
  account_id: null,
  satuan: "IDR",
  base: 1,
  target: 100,
  periode_label: "November 2024",
  tenggat: "2024-11-30",
  jenis_realisasi: "gmv",
  keterangan: "",
  status: "aktif",
  bulan: [],
});

const rencana = async ({ labelLeader = "GOAL LEADER (Dewi)" } = {}) => ({
  periode: PERIODE,
  hapus_goal: [],
  struktur: [],
  goals: [
    await goal(
      "1",
      "company",
      null,
      "Menaikkan GMV (Agustus 2026) pada Oktober",
    ),
    await goal("1.1", "manager", "1", "Menaikkan GMV internal"),
    await goal("1.1.3", "leader", "1.1", "Menaikkan GMV 7 akun utama"),
  ],
  ukuran: [],
  lembar: [],
  rencana: [
    {
      kode: "1.1.0.1",
      goal: "1.1",
      induk_kode: "1.1.0",
      judul: "Mengisi laporan harian",
      jenis: "harian",
      pic_ids: [],
      pic_teks: "Seluruh tim",
      jadwal_teks: "Setiap hari ≤ 21.00",
      urutan: 1,
      tonggak: [],
      blok: { perusahaan: 1, manager: 2, leader: 3 },
    },
    {
      kode: "1.1.3.1",
      goal: "1.1.3",
      induk_kode: "1.1.3",
      judul: "Tim riset mulai",
      jenis: "sekali",
      pic_ids: [],
      pic_teks: "Rifal / Siti",
      jadwal_teks: "Senin 5 Okt",
      urutan: 2,
      tonggak: [
        {
          kunci: "",
          judul: "Tim riset mulai",
          tenggat: "2024-11-05",
          urutan: 1,
        },
      ],
      blok: { perusahaan: 1, manager: 2, leader: 4 },
    },
    {
      kode: "1.1.3.2",
      goal: "1.1.3",
      induk_kode: "1.1.3",
      judul: "Produk 10.10 dipilih",
      jenis: "sekali",
      pic_ids: [],
      pic_teks: "Rifal → Finance",
      jadwal_teks: "Senin 5 Okt",
      urutan: 3,
      tonggak: [],
      blok: { perusahaan: 1, manager: 2, leader: 4 },
    },
    {
      kode: "M.1",
      goal: null,
      induk_kode: "M",
      judul: "Rancangan disetor",
      jenis: "sekali",
      pic_ids: [],
      pic_teks: "Kholid",
      jadwal_teks: "Kamis 1 Okt",
      urutan: 4,
      tonggak: [],
      blok: { perusahaan: 5, manager: 6, leader: 7 },
    },
  ],
  lead: [],
  cascade: [
    {
      kolom: "judul",
      kode: "",
      teks: "GOALS ROLL DOWN — UJI",
      label: "",
      goal: null,
    },
    {
      kolom: "perusahaan",
      kode: "1",
      teks: "Menaikkan GMV (Agustus 2026) pada Oktober",
      label: "",
      goal: "1",
    },
    {
      kolom: "manager",
      kode: "1.1",
      teks: "Menaikkan GMV internal",
      label: "GOAL MANAGER — KHOLID",
      goal: "1.1",
    },
    {
      kolom: "leader",
      kode: "1.1.0",
      teks: "UMUM — berlaku untuk semua goal",
      label: "",
      goal: null,
    },
    {
      kolom: "leader",
      kode: "1.1.3",
      teks: "Menaikkan GMV 7 akun utama",
      label: labelLeader,
      goal: "1.1.3",
    },
    {
      kolom: "perusahaan",
      kode: "M",
      teks: "TONGGAK MANAGER — prasyarat",
      label: "",
      goal: null,
    },
    {
      kolom: "manager",
      kode: "—",
      teks: "Menopang 1.1 & 1.2",
      label: "",
      goal: null,
    },
    {
      kolom: "leader",
      kode: "—",
      teks: "Dinilai di KPI Manager",
      label: "",
      goal: null,
    },
    { kolom: "catatan", kode: "", teks: "Cara baca: …", label: "", goal: null },
  ],
});

const impor = async (r) =>
  (await satu("select impor_grd($1::jsonb, false) r", [JSON.stringify(r)])).r;

const tabel = async (pemanggil) =>
  (await sebagai(db, pemanggil, "select * from tabel_grd($1)", [PERIODE])).rows;

uji(
  "impor menyimpan blok sheet dan menautkan tiap rencana ke bloknya",
  async () => {
    const r = await impor(await rencana());
    harusSama(r.blok_cascade, 9);
    const rows = await tabel(await id("Farhan Pratama"));
    harusSama(
      rows.map((x) => [x.kode, x.p_kode, x.m_kode, x.l_kode]),
      [
        ["1.1.0.1", "1", "1.1", "1.1.0"],
        ["1.1.3.1", "1", "1.1", "1.1.3"],
        ["1.1.3.2", "1", "1.1", "1.1.3"],
        ["M.1", "M", "—", "—"],
      ],
    );
    const m1 = rows.find((x) => x.kode === "M.1");
    harusSama(
      [m1.p_teks, m1.m_teks, m1.l_teks],
      [
        "TONGGAK MANAGER — prasyarat",
        "Menopang 1.1 & 1.2",
        "Dinilai di KPI Manager",
      ],
    );
    harusSama(rows[0].m_label, "GOAL MANAGER — KHOLID");
    harusSama(rows[1].jadwal_teks, "Senin 5 Okt");
    harusSama(rows[1].tonggak.length, 1);
  },
);

uji("blok goal membaca judul goal: ubah goal, tabel ikut berubah", async () => {
  await sebagaiAdmin(
    db,
    "update goals set judul = 'Judul goal diubah di aplikasi' where grd_periode = $1 and kode = '1.1.3'",
    [PERIODE],
  );
  const rows = await tabel(await id("Farhan Pratama"));
  harusSama(rows[1].l_teks, "Judul goal diubah di aplikasi");
  // Blok bukan goal tetap teks sel file.
  harusSama(rows[0].l_teks, "UMUM — berlaku untuk semua goal");
});

uji("semua yang sudah masuk boleh membaca tabel", async () => {
  const rows = await tabel(await id("Nabila Putri"));
  harusSama(rows.length, 4);
  harus(
    rows.every((x) => x.p_teks),
    "teks perusahaan tetap terbaca",
  );
});

uji("impor ulang mengganti susunan sheet tanpa sisa", async () => {
  await impor(await rencana({ labelLeader: "GOAL LEADER AFFILIATOR (Siti)" }));
  const n = await satu(
    "select count(*)::int n from grd_cascade_blok where grd_periode = $1",
    [PERIODE],
  );
  harusSama(n.n, 9);
  const rows = await tabel(await id("Farhan Pratama"));
  harusSama(rows[1].l_label, "GOAL LEADER AFFILIATOR (Siti)");
  // Impor ulang menimpa judul goal kembali ke kalimat file.
  harusSama(rows[1].l_teks, "Menaikkan GMV 7 akun utama");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
