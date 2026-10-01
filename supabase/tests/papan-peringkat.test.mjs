/**
 * Leaderboard GRD (0196): peringkat NILAI KPI per level dan papan akun.
 *
 * Inti tesnya: setiap baris leaderboard sama dengan baris scorecard orang
 * itu — leaderboard tidak menghitung sendiri, hanya mengurutkan.
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
const { uji, jalankan } = buatSuite("Leaderboard GRD");

const PERIODE = "2024-10-01";
const AKHIR = "2024-10-31";
const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu("select id from users where nama = $1", [nama])).id;
const akun = async (u) =>
  (await satu("select id from accounts where username = $1", [u])).id;
const unit = async (k) =>
  (await satu("select id from units where kode = $1", [k])).id;

const PERSEN = [40, 50, 60, 80, 85, 90, 95, 100, 100, 100];

const ORANG = {
  dewi: await id("Dewi Lestari"), // Leader
  galih: await id("Galih Prakoso"), // Leader
  dimas: await id("Dimas Maulana"), // Leader
  maya: await id("Maya Safitri"), // Co-Leader
  rian: await id("Rian Hidayat"), // Staff
  nabila: await id("Nabila Putri"), // Staff
  laras: await id("Laras Ayuningtyas"), // Finance → staf
  farhan: await id("Farhan Pratama"), // Manager → tidak diperingkat
};
const SKINCARE = await akun("@skincare_official");
const BEAUTY = await akun("@beauty_daily.id");
const GADGET = await akun("@gadget_daily");

await sebagaiAdmin(db, "delete from grd_rencana where grd_periode = $1", [
  PERIODE,
]);

const lembar = (user_id, indikator) => ({
  user_id,
  judul: "KPI uji",
  status: "aktif",
  asal: "uji",
  indikator,
});
const manual = (urutan, bobot) => ({
  urutan,
  nama: `Indikator ${urutan}`,
  satuan: "%",
  bobot,
  arah: "naik",
  tangga: PERSEN,
  asal: "uji",
  sumber: "manual",
});

async function rencana() {
  const goalAkun = async (account_id, target) => ({
    kode: `1.1.3:${account_id}`,
    judul: `Target akun ${account_id}`,
    level: "account",
    induk: "1.1.3",
    pemilik_id: null,
    unit_id: await unit("affiliator"),
    account_id,
    satuan: "IDR",
    base: 1,
    target,
    periode_label: "Oktober 2024",
    tenggat: AKHIR,
    jenis_realisasi: "gmv",
    keterangan: "",
    status: "draft",
    bulan: [{ bulan: PERIODE, dari: PERIODE, sampai: AKHIR, target }],
  });
  const ukuranAkun = (account_id) => ({
    kode: `1.1.3:${account_id}`,
    judul: `Ukuran ${account_id}`,
    satuan: "IDR",
    sumber: "gmv",
    goal: `1.1.3:${account_id}`,
    lingkup: [{ account_id, jenis_gmv: "semua", faktor: 1 }],
    titik: [],
  });
  const atas = async (kode, level, induk, pemilik_id) => ({
    kode,
    judul: `Goal ${kode}`,
    level,
    induk,
    pemilik_id,
    unit_id: level === "leader" ? await unit("affiliator") : null,
    account_id: null,
    satuan: "IDR",
    base: 1,
    target: 1000,
    periode_label: "Oktober 2024",
    tenggat: AKHIR,
    jenis_realisasi: "gmv",
    keterangan: "",
    status: "aktif",
    bulan: [{ bulan: PERIODE, dari: PERIODE, sampai: AKHIR, target: 1000 }],
  });
  return {
    periode: PERIODE,
    hapus_goal: [],
    struktur: [],
    goals: [
      await atas("1", "company", null, await id("Hafidz Alkahfi")),
      await atas("1.1", "manager", "1", ORANG.farhan),
      await atas("1.1.3", "leader", "1.1", ORANG.dewi),
      await goalAkun(SKINCARE, 40_000_000),
      await goalAkun(BEAUTY, 30_000_000),
      await goalAkun(GADGET, 20_000_000),
    ],
    ukuran: [ukuranAkun(SKINCARE), ukuranAkun(BEAUTY), ukuranAkun(GADGET)],
    papan_kecuali: [{ account_id: GADGET, alasan: "akun Manager" }],
    lembar: [
      lembar(ORANG.dewi, [manual(1, 50), manual(2, 50)]),
      lembar(ORANG.galih, [manual(1, 50), manual(2, 50)]),
      lembar(ORANG.dimas, [manual(1, 100)]),
      lembar(ORANG.maya, [manual(1, 100)]),
      lembar(ORANG.rian, [
        {
          ...manual(1, 60),
          sumber: "ukuran_persen",
          sumber_ref: { ukuran: [`1.1.3:${SKINCARE}`] },
        },
        manual(2, 40),
      ]),
      lembar(ORANG.nabila, [manual(1, 100)]),
      lembar(ORANG.laras, [manual(1, 100)]),
      lembar(ORANG.farhan, [manual(1, 100)]),
    ],
  };
}

await satu("select impor_grd($1::jsonb, false)", [
  JSON.stringify(await rencana()),
]);

/** Penilai mengisi pencapaian beberapa orang. */
const isi = async (penilai, user, nilai) => {
  const ind = (
    await sebagaiAdmin(
      db,
      `select i.id, i.urutan from kpi_indikator i join kpi_lembar l on l.id = i.lembar_id
        where l.user_id = $1 and l.periode_bulan = $2 and i.sumber = 'manual' order by i.urutan`,
      [user, PERIODE],
    )
  ).rows;
  await sebagai(db, penilai, "select isi_pencapaian_kpi($1, $2, $3::jsonb)", [
    user,
    PERIODE,
    JSON.stringify(
      ind.map((i, n) => ({ indikator_id: i.id, nilai: nilai[n] ?? null })),
    ),
  ]);
};
const FARHAN = ORANG.farhan;
await isi(FARHAN, ORANG.dewi, [96, 86]);
await isi(FARHAN, ORANG.galih, [100, 100]);
await isi(FARHAN, ORANG.dimas, [96]);
await isi(FARHAN, ORANG.maya, [85]);
await isi(ORANG.dewi, ORANG.rian, [90]);
await isi(ORANG.dewi, ORANG.nabila, [90]);
// Laras belum diisi: "Belum diisi", tetap ikut dengan nilai 0.

const papan = async (pemanggil, bulan = PERIODE, sampai = AKHIR) =>
  (
    await sebagai(db, pemanggil, "select * from papan_kpi($1, $2)", [
      bulan,
      sampai,
    ])
  ).rows;

uji(
  "setiap baris leaderboard sama dengan baris scorecard orang itu",
  async () => {
    const sc = new Map(
      (
        await sebagai(db, FARHAN, "select * from scorecard_tim($1, $2)", [
          PERIODE,
          AKHIR,
        ])
      ).rows.map((r) => [r.user_id, r]),
    );
    const rows = await papan(FARHAN);
    harus(rows.length === 7, `seharusnya 7 orang, ada ${rows.length}`);
    for (const r of rows) {
      const s = sc.get(r.user_id);
      harus(s, `${r.nama} tidak ada di scorecard`);
      harusSama(
        [Number(r.skor), r.predikat, Number(r.cakupan), r.terkunci],
        [Number(s.skor), s.predikat, Number(s.cakupan), s.terkunci],
        `baris ${r.nama}`,
      );
    }
  },
);

uji("dipisah per level; CEO/Manager tidak diperingkat", async () => {
  const rows = await papan(FARHAN);
  const per = (k) => rows.filter((r) => r.kelompok === k).map((r) => r.user_id);
  harusSama(
    new Set(per("leader")),
    new Set([ORANG.dewi, ORANG.galih, ORANG.dimas]),
  );
  harusSama(per("co_leader"), [ORANG.maya]);
  harusSama(
    new Set(per("staf")),
    new Set([ORANG.rian, ORANG.nabila, ORANG.laras]),
  );
  harus(!rows.some((r) => r.user_id === FARHAN), "Manager tidak ikut");
});

uji(
  "peringkat di dalam level: nilai tertinggi = 1, nilai sama = peringkat sama",
  async () => {
    const rows = await papan(FARHAN);
    const leader = rows.filter((r) => r.kelompok === "leader");
    harusSama(leader[0].user_id, ORANG.galih);
    harusSama(Number(leader[0].peringkat), 1);
    for (const k of ["leader", "co_leader", "staf"]) {
      const baris = rows.filter((r) => r.kelompok === k);
      for (const r of baris) {
        const lebihTinggi = baris.filter(
          (x) => Number(x.skor) > Number(r.skor),
        ).length;
        harusSama(Number(r.peringkat), lebihTinggi + 1, `${r.nama}`);
      }
    }
    const laras = rows.find((r) => r.user_id === ORANG.laras);
    harusSama([Number(laras.skor), laras.predikat], [0, null]);
  },
);

uji(
  "staf melihat leaderboard semua orang, tetapi scorecard tetap hanya dirinya",
  async () => {
    harusSama((await papan(ORANG.rian)).length, 7);
    const sc = await sebagai(
      db,
      ORANG.rian,
      "select user_id from scorecard_tim($1, $2)",
      [PERIODE, AKHIR],
    );
    harusSama(
      sc.rows.map((r) => r.user_id),
      [ORANG.rian],
    );
  },
);

uji("bulan tanpa lembar KPI GRD tidak punya leaderboard", async () => {
  harusSama((await papan(FARHAN, "2024-09-01", "2024-09-30")).length, 0);
});

uji("tanpa sesi tidak ada yang terlihat; rumus barisnya tertutup", async () => {
  const anonim = await sebagaiAdmin(
    db,
    "select count(*)::int n from papan_kpi($1, $2)",
    [PERIODE, AKHIR],
  );
  // Proses sistem tidak punya auth.uid(): papan kosong.
  harusSama(anonim.rows[0].n, 0);
  await harusDitolak(
    async () =>
      sebagai(db, ORANG.rian, "select * from skor_kpi_bulan($1, $2, $3)", [
        ORANG.nabila,
        PERIODE,
        AKHIR,
      ]),
    "skor_kpi_bulan seharusnya tertutup",
  );
});

// ---------------------------------------------------------------------
// Papan akun
// ---------------------------------------------------------------------
const papanAkun = async (pemanggil, sampai = AKHIR) =>
  (
    await sebagai(db, pemanggil, "select * from papan_akun_grd($1, $2)", [
      PERIODE,
      sampai,
    ])
  ).rows;

uji("akun yang dikecualikan pemetaan tidak ikut papan akun", async () => {
  const rows = await papanAkun(FARHAN);
  harusSama(
    new Set(rows.map((r) => r.account_id)),
    new Set([SKINCARE, BEAUTY]),
  );
  const ada = await satu(
    "select count(*)::int n from grd_akun_dikecualikan where grd_periode = $1",
    [PERIODE],
  );
  harusSama(ada.n, 1);
});

uji(
  "% akun = rumus indikator GMV KPI (ukuran_persen), dihitung dari laporan",
  async () => {
    const rows = await papanAkun(FARHAN);
    const sk = rows.find((r) => r.account_id === SKINCARE);
    const gmv = Number(
      (
        await satu(
          "select sum(gmv) n from daily_reports where account_id = $1 and tanggal between $2 and $3",
          [SKINCARE, PERIODE, AKHIR],
        )
      ).n,
    );
    harus(
      Math.abs(Number(sk.persen) - (gmv / 40_000_000) * 100) < 1e-6,
      "persen akun",
    );
    const rianSc = (
      await sebagai(
        db,
        FARHAN,
        "select detail from scorecard_tim($1, $2) where user_id = $3",
        [PERIODE, AKHIR, ORANG.rian],
      )
    ).rows[0].detail;
    harus(
      Math.abs(Number(rianSc[0].otomatis) - Number(sk.persen)) < 1e-9,
      "persen akun berbeda dengan indikator KPI pemegangnya",
    );
    // Peringkat menurut persen.
    const urut = [...rows].sort((a, b) => Number(b.persen) - Number(a.persen));
    harusSama(
      rows.map((r) => r.account_id),
      urut.map((r) => r.account_id),
    );
    harusSama(Number(rows[0].peringkat), 1);
  },
);

uji(
  "rupiah akun hanya untuk yang boleh melihat angka lintas unit",
  async () => {
    const staf = await papanAkun(ORANG.rian);
    harus(staf.length === 2, "staf tetap melihat papan akun");
    harus(
      staf.every((r) => r.realisasi === null && r.target === null),
      "rupiah tersembunyi",
    );
    harus(
      staf.every((r) => r.persen !== null),
      "persen tetap terlihat",
    );
    const manajer = await papanAkun(FARHAN);
    harus(
      manajer.every((r) => r.realisasi !== null && r.target !== null),
      "Manager melihat rupiah",
    );
  },
);

uji("impor ulang mengganti daftar akun yang dikecualikan", async () => {
  const r = await rencana();
  r.papan_kecuali = [];
  await satu("select impor_grd($1::jsonb, false)", [JSON.stringify(r)]);
  harusSama((await papanAkun(FARHAN)).length, 3);
  await satu("select impor_grd($1::jsonb, false)", [
    JSON.stringify(await rencana()),
  ]);
  harusSama((await papanAkun(FARHAN)).length, 2);
});

uji(
  "setelah dikunci, leaderboard membaca snapshot yang sama dengan scorecard",
  async () => {
    await sebagai(db, FARHAN, "select kunci_kpi_bulan($1)", [PERIODE]);
    const sc = new Map(
      (
        await sebagai(db, FARHAN, "select * from scorecard_tim($1, $2)", [
          PERIODE,
          AKHIR,
        ])
      ).rows.map((r) => [r.user_id, r]),
    );
    for (const r of await papan(FARHAN)) {
      const s = sc.get(r.user_id);
      // Yang belum diisi sama sekali tidak dikunci (0063), di kedua papan.
      harusSama(
        [Number(r.skor), r.predikat, r.terkunci],
        [Number(s.skor), s.predikat, s.terkunci],
      );
    }
  },
);

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
