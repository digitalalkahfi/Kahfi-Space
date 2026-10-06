/**
 * GRD Oktober 2026 versi final (0198):
 *   - AKTUAL kurva GMV otomatis dari laporan harian bila datanya ada,
 *     manual bila belum ada; ukuran turunan tidak diisi langsung;
 *   - yang mengisi AKTUAL: CEO/Manager, Leader/Co-Leader divisinya;
 *   - impor ulang mengembalikan status tonggak yang isinya berganti;
 *   - di modul GRD staf hanya melihat operational plan, blok goal, dan
 *     baris kurva miliknya.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusDitolak,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("GRD final Oktober");

const PERIODE = "2024-10-01";
const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu("select id from users where nama = $1", [nama])).id;
const unit = async (kode) =>
  (await satu("select id from units where kode = $1", [kode])).id;

const DEWI = await id("Dewi Lestari"); // Leader Affiliator
const GALIH = await id("Galih Prakoso"); // Leader MCN
const NABILA = await id("Nabila Putri"); // Staf di bawah Dewi
const RIAN = await id("Rian Hidayat"); // Staf di bawah Dewi
const FARHAN = await id("Farhan Pratama"); // Manager

/** Akun baru tanpa laporan harian sama sekali (mis. akun santri). */
const akunTanpaLaporan = async (username) =>
  (
    await satu(
      `insert into accounts (username, unit_id, pic_user_id)
       values ($1, $2, $3) returning id`,
      [username, await unit("affiliator"), NABILA],
    )
  ).id;

const ukuran = async (kode, { pic = DEWI, sumber = "gmv" } = {}) => {
  const u = (
    await satu(
      `insert into grd_ukuran (grd_periode, kode, judul, satuan, sumber, pic_id)
       values ($1, $2, $3, 'IDR', $4, $5) returning id`,
      [PERIODE, kode, `Ukuran ${kode}`, sumber, pic],
    )
  ).id;
  await sebagaiAdmin(
    db,
    `insert into grd_ukuran_titik (ukuran_id, tanggal, target) values
     ($1, '2024-10-05', 100), ($1, '2024-10-12', 300)`,
    [u],
  );
  return u;
};

const kurva = async (pemanggil, kode) =>
  (
    await sebagai(
      db,
      pemanggil,
      "select * from kurva_grd($1, '2024-10-20') where kode = $2",
      [PERIODE, kode],
    )
  ).rows[0];

const isi = (pemanggil, u, tanggal, nilai) =>
  sebagai(
    db,
    pemanggil,
    `insert into grd_ukuran_isian (ukuran_id, tanggal, nilai) values ($1, $2, $3)`,
    [u, tanggal, nilai],
  );

// ---------------------------------------------------------------------
// AKTUAL kurva: otomatis bila ada laporan harian, manual bila tidak
// ---------------------------------------------------------------------
let santri;
uji(
  "GMV tanpa laporan harian: AKTUAL diisi manual dan dipakai realisasi",
  async () => {
    santri = await ukuran("1.1.4");
    await sebagaiAdmin(
      db,
      "insert into grd_ukuran_lingkup (ukuran_id, account_id) values ($1, $2)",
      [santri, await akunTanpaLaporan("@santri_baru")],
    );

    const awal = await kurva(DEWI, "1.1.4");
    harus(
      awal.titik.every((t) => t.manual === true && t.aktual === null),
      "titik GMV tanpa laporan menunggu isian manual",
    );

    await isi(DEWI, santri, "2024-10-05", 150);
    await isi(DEWI, santri, "2024-10-12", 200);
    const k = await kurva(DEWI, "1.1.4");
    harusSama(
      k.titik.map((t) => [
        t.aktual === null ? null : Number(t.aktual),
        t.status,
      ]),
      [
        [150, "hijau"],
        [200, "merah"],
      ],
    );
    harusSama(
      Number(
        (await satu("select realisasi_ukuran($1, '2024-10-31') n", [santri])).n,
      ),
      200,
    );
  },
);

uji(
  "GMV yang ada di laporan harian tetap otomatis, tidak bisa diisi tangan",
  async () => {
    const u = await ukuran("1.1.3");
    const akun = (
      await satu("select id from accounts where username = '@fashion_hijab'")
    ).id;
    await sebagaiAdmin(
      db,
      "insert into grd_ukuran_lingkup (ukuran_id, account_id) values ($1, $2)",
      [u, akun],
    );
    const k = await kurva(DEWI, "1.1.3");
    harus(
      k.titik.every((t) => t.manual === false && t.aktual !== null),
      "titik GMV berlaporan dihitung otomatis",
    );
    await harusDitolak(
      () => isi(FARHAN, u, "2024-10-12", 1),
      "isian GMV yang sudah ada laporannya seharusnya ditolak",
    );
  },
);

uji("ukuran turunan (jumlah ukuran lain) tidak diisi langsung", async () => {
  const total = await ukuran("1.1", { pic: FARHAN });
  await sebagaiAdmin(
    db,
    "insert into grd_ukuran_lingkup (ukuran_id, sumber_ukuran_id) values ($1, $2)",
    [total, santri],
  );
  harusSama(
    Number(
      (await satu("select realisasi_ukuran($1, '2024-10-31') n", [total])).n,
    ),
    200,
  );
  const k = await kurva(FARHAN, "1.1");
  harus(
    k.titik.every((t) => t.manual === false),
    "turunan tidak ditandai manual",
  );
  await harusDitolak(
    () => isi(FARHAN, total, "2024-10-12", 1),
    "isian pada ukuran turunan seharusnya ditolak",
  );
});

uji("AKTUAL diisi Manager atau Leader divisinya, bukan staf", async () => {
  const seller = await ukuran("1.1.5", { pic: RIAN, sumber: "isian" });
  harusSama((await kurva(DEWI, "1.1.5")).boleh_isi, true);
  harusSama((await kurva(GALIH, "1.1.5"))?.boleh_isi ?? false, false);
  await harusDitolak(
    () => isi(RIAN, seller, "2024-10-05", 3),
    "staf seharusnya tidak mengisi AKTUAL",
  );
  await harusDitolak(
    () => isi(GALIH, seller, "2024-10-05", 3),
    "Leader divisi lain seharusnya ditolak",
  );
  await isi(DEWI, seller, "2024-10-05", 3);
  await isi(FARHAN, seller, "2024-10-12", 4);
  harusSama(
    Number(
      (await satu("select realisasi_ukuran($1, '2024-10-31') n", [seller])).n,
    ),
    4,
  );
});

uji("staf hanya melihat baris kurva miliknya", async () => {
  const kodeRian = (
    await sebagai(db, RIAN, "select kode from kurva_grd($1, '2024-10-20')", [
      PERIODE,
    ])
  ).rows.map((r) => r.kode);
  harusSama(kodeRian, ["1.1.5"]);
  const kodeDewi = (
    await sebagai(db, DEWI, "select kode from kurva_grd($1, '2024-10-20')", [
      PERIODE,
    ])
  ).rows.map((r) => r.kode);
  harus(
    ["1.1.3", "1.1.4", "1.1.5"].every((k) => kodeDewi.includes(k)),
    "Leader melihat baris kurva divisinya, termasuk milik stafnya",
  );
});

// ---------------------------------------------------------------------
// Impor ulang & tampilan staf di operational plan / Tabel GRD
// ---------------------------------------------------------------------
const PERIODE_IMPOR = "2024-11-01";

const goal = (kode, level, induk, judul, pemilik) => ({
  kode,
  judul,
  level,
  induk,
  pemilik_id: pemilik,
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

const rencana = ({ judulM5 = "Base riset produk" } = {}) => ({
  periode: PERIODE_IMPOR,
  hapus_goal: [],
  struktur: [],
  goals: [
    goal("1", "company", null, "Menaikkan GMV perusahaan", null),
    goal("S.1.1", "staff", "1", "Menerapkan SOP baru", NABILA),
  ],
  ukuran: [],
  lembar: [],
  rencana: [
    {
      kode: "1.1.0.1",
      goal: "1",
      induk_kode: "1.1.0",
      judul: "Mengisi laporan harian",
      jenis: "harian",
      pic_ids: [FARHAN],
      pic_teks: "Seluruh tim",
      jadwal_teks: "Setiap hari ≤ 21.00",
      urutan: 1,
      tonggak: [],
      blok: { perusahaan: 1, manager: null, leader: 2 },
    },
    {
      kode: "M.5",
      goal: null,
      induk_kode: "M",
      judul: judulM5,
      jenis: "sekali",
      pic_ids: [FARHAN],
      pic_teks: "Kholid",
      jadwal_teks: "Sabtu 3 Okt",
      urutan: 2,
      tonggak: [
        { kunci: "", judul: judulM5, tenggat: "2024-11-03", urutan: 1 },
      ],
      blok: { perusahaan: 3, manager: null, leader: null },
    },
    {
      kode: "S.1.1.2",
      goal: "S.1.1",
      induk_kode: "S.1.1",
      judul: "SOP pekan ini diumumkan",
      jenis: "pekanan",
      pic_ids: [NABILA],
      pic_teks: "Nabila",
      jadwal_teks: "Senin",
      urutan: 3,
      tonggak: [],
      blok: { perusahaan: 3, manager: null, leader: 4 },
    },
  ],
  lead: [],
  cascade: [
    { kolom: "judul", kode: "", teks: "GRD UJI", label: "", goal: null },
    {
      kolom: "perusahaan",
      kode: "1",
      teks: "Menaikkan GMV perusahaan",
      label: "",
      goal: "1",
    },
    { kolom: "leader", kode: "1.1.0", teks: "UMUM", label: "", goal: null },
    {
      kolom: "perusahaan",
      kode: "S",
      teks: "STAF PENDUKUNG",
      label: "",
      goal: null,
    },
    {
      kolom: "leader",
      kode: "S.1.1",
      teks: "Menerapkan SOP baru",
      label: "TATA KELOLA (Nabila)",
      goal: "S.1.1",
    },
  ],
});

// Impor kini membuat tiket dari tonggak (0201), dan tonggak yang punya tiket
// tidak bisa dicentang manual (aturan 7). Tes ini menguji tonggak sebagai
// tonggak — centang, waktu selesai, impor ulang — jadi tiket otomatisnya
// dilepas lagi di sini. Interaksi tonggak dengan tiketnya diuji di
// tiket-grd.test.mjs.
const impor = async (r) => {
  const hasil = (
    await satu("select impor_grd($1::jsonb, false) r", [JSON.stringify(r)])
  ).r;
  await satu("delete from tasks where tonggak_id is not null");
  return hasil;
};

const statusM5 = async () =>
  satu(
    `select t.status, t.selesai_pada, t.judul from grd_tonggak t
       join grd_rencana r on r.id = t.rencana_id
      where r.grd_periode = $1 and r.kode = 'M.5'`,
    [PERIODE_IMPOR],
  );

uji(
  "impor ulang: centang tetap bila isi tonggak sama, kembali belum bila berganti",
  async () => {
    await impor(rencana());
    await sebagaiAdmin(
      db,
      `update grd_tonggak t set status = 'selesai', catatan = 'beres'
       from grd_rencana r
      where r.id = t.rencana_id and r.grd_periode = $1 and r.kode = 'M.5'`,
      [PERIODE_IMPOR],
    );

    await impor(rencana());
    const tetap = await statusM5();
    harusSama(tetap.status, "selesai");
    harus(tetap.selesai_pada !== null, "waktu selesai tetap tercatat");

    await impor(rencana({ judulM5: "Aturan posting konten MMC diumumkan" }));
    const baru = await statusM5();
    harusSama(
      [baru.status, baru.selesai_pada, baru.judul],
      ["belum", null, "Aturan posting konten MMC diumumkan"],
    );
  },
);

uji(
  "staf hanya melihat operational plan miliknya dan untuk seluruh tim",
  async () => {
    const kode = async (pemanggil) =>
      (
        await sebagai(
          db,
          pemanggil,
          "select kode from tabel_grd($1) order by urutan",
          [PERIODE_IMPOR],
        )
      ).rows.map((r) => r.kode);
    harusSama(await kode(NABILA), ["1.1.0.1", "S.1.1.2"]);
    harusSama(await kode(RIAN), ["1.1.0.1"]);
    harusSama(await kode(DEWI), ["1.1.0.1", "M.5", "S.1.1.2"]);
    // Tonggak ikut baris rencananya.
    harusSama(
      Number(
        (
          await sebagai(
            db,
            RIAN,
            `select count(*)::int n from grd_tonggak t
             join grd_rencana r on r.id = t.rencana_id
            where r.grd_periode = $1`,
            [PERIODE_IMPOR],
          )
        ).rows[0].n,
      ),
      0,
    );
  },
);

uji(
  "Tabel GRD staf: blok goal orang lain tidak tampil, goal miliknya tampil",
  async () => {
    const baris = (
      await sebagai(db, NABILA, "select * from tabel_grd($1) order by urutan", [
        PERIODE_IMPOR,
      ])
    ).rows;
    // Goal perusahaan bukan miliknya: bloknya kosong.
    harusSama(baris[0].p_id, null);
    // Blok non-goal tetap terbaca.
    harusSama(baris[0].l_teks, "UMUM");
    harusSama(
      [baris[1].l_kode, baris[1].l_teks, baris[1].l_label],
      ["S.1.1", "Menerapkan SOP baru", "TATA KELOLA (Nabila)"],
    );
    // Leader tetap melihat seluruh susunan sheet.
    const leader = (
      await sebagai(db, DEWI, "select * from tabel_grd($1) order by urutan", [
        PERIODE_IMPOR,
      ])
    ).rows;
    harusSama(leader[0].p_teks, "Menaikkan GMV perusahaan");
  },
);

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
