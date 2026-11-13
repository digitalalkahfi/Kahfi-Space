/**
 * Goal GRD per bulan (0220): GRD bulan baru bisa diimpor selagi goal
 * bulan lama masih aktif, tanpa mengubah goal bulan lama.
 *
 *   - batas 3 goal aktif dihitung per periode GRD;
 *   - goal korporasi mengikuti bulan tanggal yang diminta;
 *   - lead measure bulan lama ditutup pada akhir bulannya, isiannya utuh.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusDitolak,
  harusSama,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Goal GRD per periode");

const OKT = "2024-10-01";
const NOV = "2024-11-01";
const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu("select id from users where nama = $1", [nama])).id;
const unit = async (k) =>
  (await satu("select id from units where kode = $1", [k])).id;
const impor = (r, coba = false) =>
  satu("select impor_grd($1::jsonb, $2) r", [JSON.stringify(r), coba]);

/** Rencana satu bulan: 1 goal perusahaan, 3 goal Manager, 1 goal Leader. */
async function rencana(periode, label, target) {
  const sampai = (
    await satu("select ($1::date + interval '1 month - 1 day')::date::text t", [
      periode,
    ])
  ).t;
  const dasar = {
    unit_id: null,
    account_id: null,
    satuan: "IDR",
    base: 1,
    periode_label: label,
    tenggat: sampai,
    jenis_realisasi: "gmv",
    keterangan: "",
    status: "aktif",
  };
  const bulan = (t) => [{ bulan: periode, dari: periode, sampai, target: t }];
  const manager = await id("Farhan Pratama");
  return {
    periode,
    goals: [
      {
        ...dasar,
        kode: "1",
        judul: `Menaikkan GMV perusahaan ${label}`,
        level: "company",
        induk: null,
        pemilik_id: await id("Hafidz Alkahfi"),
        target,
        bulan: bulan(target),
      },
      ...["1.1", "1.2", "1.3"].map((kode) => ({
        ...dasar,
        kode,
        judul: `Goal Manager ${kode} ${label}`,
        level: "manager",
        induk: "1",
        pemilik_id: manager,
        target: 100,
        bulan: bulan(100),
      })),
      {
        ...dasar,
        kode: "1.1.1",
        judul: `Goal Leader ${label}`,
        level: "leader",
        induk: "1.1",
        pemilik_id: null,
        target: 50,
        bulan: bulan(50),
      },
    ],
    lead: [
      {
        kode: "1.1.1.1",
        goal: "1.1.1",
        judul: `Riset produk setiap hari ${label}`,
        satuan: "produk",
        target_mingguan: 70,
        sumber_laporan: null,
        mulai: periode,
        selesai: null,
        akun: [],
      },
    ],
  };
}

const leadOkt = () =>
  satu(
    `select lm.id, lm.selesai::text selesai
       from lead_measures lm join goals g on g.id = lm.goal_id
      where g.grd_periode = $1 and lm.kode = '1.1.1.1'`,
    [OKT],
  );

uji("GRD bulan baru masuk selagi goal bulan lama masih aktif", async () => {
  await impor(await rencana(OKT, "Oktober 2024", 1000));
  const lead = await leadOkt();
  harusSama(
    lead.selesai,
    null,
    "lead measure Oktober belum bertanggal selesai",
  );
  await sebagaiAdmin(
    db,
    `insert into lead_measure_entries (lead_measure_id, user_id, tanggal, nilai, catatan)
     values ($1, null, '2024-10-10', 7, '')`,
    [lead.id],
  );

  const r = (await impor(await rencana(NOV, "November 2024", 2000))).r;
  harusSama(r.goal, 5);
  harusSama(r.lead_measure_bulan_lalu_ditutup, 1);

  // Goal Oktober tidak disentuh: tetap aktif, jumlahnya tetap.
  harusSama(
    await satu(
      `select count(*)::int n, count(*) filter (where status = 'aktif')::int aktif
         from goals where grd_periode = $1`,
      [OKT],
    ),
    { n: 5, aktif: 5 },
  );
  harusSama(
    (
      await satu(
        `select count(*)::int n from goals
          where pemilik_id = $1 and status = 'aktif' and grd_periode in ($2, $3)`,
        [await id("Farhan Pratama"), OKT, NOV],
      )
    ).n,
    6,
    "Manager memegang 3 goal Oktober + 3 goal November",
  );
});

uji("goal aktif keempat dalam satu periode GRD tetap ditolak", async () => {
  const keempat = async (periode, kode) =>
    sebagaiAdmin(
      db,
      `insert into goals (judul, level, pemilik_id, satuan, target_base,
                          target_goal, target_stretch, periode, grd_periode, kode, status)
       values ('Goal keempat', 'manager', $1, 'IDR', 1, 2, 2, 'x', $2, $3, 'aktif')`,
      [await id("Farhan Pratama"), periode, kode],
    );
  await harusDitolak(
    async () => keempat(NOV, "1.4"),
    "goal keempat di November seharusnya ditolak",
  );
  await harusDitolak(
    async () => keempat(OKT, "1.4"),
    "goal keempat di Oktober seharusnya ditolak",
  );
});

uji("goal di luar GRD dihitung sesama goal di luar GRD", async () => {
  const orang = await id("Dewi Lestari");
  await sebagaiAdmin(
    db,
    "update goals set status = 'dibatalkan' where pemilik_id = $1 and grd_periode is null",
    [orang],
  );
  const tambah = async (n) =>
    sebagaiAdmin(
      db,
      `insert into goals (judul, level, pemilik_id, unit_id, satuan, target_base,
                          target_goal, target_stretch, periode, status)
       values ($2, 'leader', $1, $3, 'IDR', 1, 2, 2, 'x', 'aktif')`,
      [orang, `Goal lepas ${n}`, await unit("affiliator")],
    );
  await tambah(1);
  await tambah(2);
  await tambah(3);
  await harusDitolak(
    async () => tambah(4),
    "goal lepas keempat seharusnya ditolak",
  );
});

uji("goal korporasi mengikuti bulan tanggal yang diminta", async () => {
  const k = async (tanggal) =>
    satu("select judul, target_bulan::int target from goal_korporasi($1)", [
      tanggal,
    ]);
  harusSama(await k("2024-10-15"), {
    judul: "Menaikkan GMV perusahaan Oktober 2024",
    target: 1000,
  });
  harusSama(await k("2024-11-15"), {
    judul: "Menaikkan GMV perusahaan November 2024",
    target: 2000,
  });
});

uji(
  "lead measure bulan lama ditutup di akhir bulannya, isiannya utuh",
  async () => {
    const lead = await leadOkt();
    harusSama(lead.selesai, "2024-10-31");
    harusSama(
      (
        await satu(
          "select sum(nilai)::int n from lead_measure_entries where lead_measure_id = $1",
          [lead.id],
        )
      ).n,
      7,
    );

    const papan = async (tanggal) =>
      (
        await sebagaiAdmin(
          db,
          "select judul from papan_lead_measure($1) where judul like 'Riset produk setiap hari%' order by judul",
          [tanggal],
        )
      ).rows.map((b) => b.judul);
    harusSama(await papan("2024-10-10"), [
      "Riset produk setiap hari Oktober 2024",
    ]);
    harusSama(await papan("2024-11-13"), [
      "Riset produk setiap hari November 2024",
    ]);
  },
);

uji("impor ulang bulan baru tidak mengubah apa pun di bulan lama", async () => {
  const r = (await impor(await rencana(NOV, "November 2024", 2000))).r;
  harusSama(r.lead_measure_bulan_lalu_ditutup, 0);
  harusSama((await leadOkt()).selesai, "2024-10-31");
  harus(
    (
      await satu("select count(*)::int n from goals where grd_periode = $1", [
        NOV,
      ])
    ).n === 5,
    "goal November tidak berlipat",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
