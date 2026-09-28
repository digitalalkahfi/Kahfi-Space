/**
 * Goal bertanggal (migrasi 0178): setiap anak tangga membawa rentang
 * tanggal yang dicakupnya. Target harian hanya berlaku di dalam rentang,
 * capaian hanya dihitung di dalam rentang, dan `ubah_goal` menyimpan
 * rentang yang disusun aplikasi — dengan rumus yang sama persis.
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
import {
  labelPeriode,
  susunAnakTangga,
  targetHarianGrd,
} from "../../src/lib/goal.ts";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Goal bertanggal (0178)");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu(`select id from users where nama = $1`, [nama])).id;

/** Kembalikan seluruh anak tangga ke isi seed (bulan penuh). */
const pulihkan = async () => {
  await sebagaiAdmin(db, "delete from goal_months");
  await terapkanSeed(db);
};

/** Atur rentang anak tangga sebuah goal pada satu bulan. */
const aturRentang = (goalId, bulan, dari, sampai) =>
  sebagaiAdmin(
    db,
    `update goal_months set dari = $3, sampai = $4
      where goal_id = $1 and bulan = $2`,
    [goalId, bulan, dari, sampai],
  );

const tangga = async (goalId) =>
  (
    await sebagaiAdmin(
      db,
      `select to_char(bulan, 'YYYY-MM-DD') bulan, to_char(dari, 'YYYY-MM-DD') dari,
              to_char(sampai, 'YYYY-MM-DD') sampai, target::float8 target
         from goal_months where goal_id = $1 order by bulan`,
      [goalId],
    )
  ).rows.map((r) => ({ ...r, target: Number(r.target) }));

const gmvAkun = async (akunId, dari, sampai) =>
  Number(
    (
      await satu(
        `select coalesce(sum(gmv), 0)::float8 n from daily_reports
          where account_id = $1 and tanggal between $2 and $3`,
        [akunId, dari, sampai],
      )
    ).n,
  );

const hampir = (a, b, pesan) =>
  harus(Math.abs(Number(a) - Number(b)) < 1e-6, `${pesan}: ${a} ≠ ${b}`);

const MANAGER = await id("Farhan Pratama");
const RIAN = await id("Rian Hidayat"); // Staff, PIC dua akun

// Goal akun @skincare_official dan @beauty_daily.id (keduanya dipegang Rian).
const AKUN_RIAN = (
  await sebagaiAdmin(
    db,
    `select g.id goal, a.id akun, a.username
       from goals g join accounts a on a.id = g.account_id
      where a.pic_user_id = $1 and g.status = 'aktif'
      order by a.username`,
    [RIAN],
  )
).rows;
const KORP = (
  await satu(
    `select id from goals where level = 'company' order by created_at limit 1`,
  )
).id;

uji("anak tangga yang sudah ada menjadi bulan penuh", async () => {
  const r = await satu(
    `select count(*)::int n,
            count(*) filter (
              where dari <> bulan
                 or sampai <> (bulan + interval '1 month - 1 day')::date
            )::int salah
       from goal_months`,
  );
  harus(r.n > 0, "seed punya anak tangga");
  harusSama(r.salah, 0, "semua anak tangga lama = bulan penuh");
});

uji("rentang di luar bulannya atau terbalik ditolak", async () => {
  const g = AKUN_RIAN[0].goal;
  await harusDitolak(
    () => aturRentang(g, "2024-10-01", "2024-09-30", "2024-10-31"),
    "mulai di bulan sebelumnya",
  );
  await harusDitolak(
    () => aturRentang(g, "2024-10-01", "2024-10-01", "2024-11-01"),
    "selesai di bulan berikutnya",
  );
  await harusDitolak(
    () => aturRentang(g, "2024-10-01", "2024-10-20", "2024-10-10"),
    "rentang terbalik",
  );
  harusSama((await tangga(g))[0].dari, "2024-10-01", "tidak ada yang berubah");
});

uji(
  "bulan yang dipindah tanpa rentang baru ikut menjadi bulan penuh",
  async () => {
    await aturRentang(KORP, "2024-12-01", "2024-12-01", "2024-12-14");
    await sebagaiAdmin(
      db,
      `update goal_months set bulan = '2025-01-01'
      where goal_id = $1 and bulan = '2024-12-01'`,
      [KORP],
    );
    const jan = (await tangga(KORP)).find((b) => b.bulan === "2025-01-01");
    harusSama([jan.dari, jan.sampai], ["2025-01-01", "2025-01-31"]);
    await pulihkan();
  },
);

uji(
  "target harian hanya di dalam rentang, sama dengan rumus aplikasi",
  async () => {
    const { goal, akun } = AKUN_RIAN[0];
    await aturRentang(goal, "2024-10-01", "2024-10-15", "2024-10-31");
    const langkah = await tangga(goal);

    for (const tanggal of [
      "2024-10-14",
      "2024-10-15",
      "2024-10-24",
      "2024-10-31",
    ]) {
      const sql = await satu(
        `select coalesce((select target from target_harian_akun($1) where account_id = $2), 0)::float8 t`,
        [tanggal, akun],
      );
      hampir(sql.t, targetHarianGrd(langkah, tanggal), `target ${tanggal}`);
    }
    const t14 = await satu(
      `select count(*)::int n from target_harian_akun('2024-10-14') where account_id = $1`,
      [akun],
    );
    harusSama(t14.n, 0, "sebelum rentang tidak ada target");
    const t15 = await satu(
      `select target::float8 t from target_harian_akun('2024-10-15') where account_id = $1`,
      [akun],
    );
    hampir(t15.t, langkah[0].target / 17, "dibagi 17 hari rentangnya");
    await pulihkan();
  },
);

uji("capaian goal hanya dihitung di dalam rentang", async () => {
  const { goal, akun } = AKUN_RIAN[0];
  await aturRentang(goal, "2024-10-01", "2024-10-15", "2024-10-31");
  const p = await satu(
    `select target_bulan::float8 t, realisasi::float8 r, rasio::float8 rasio
       from progres_goal('2024-10-01', '2024-10-24') where goal_id = $1`,
    [goal],
  );
  const harap = await gmvAkun(akun, "2024-10-15", "2024-10-24");
  harus(harap > 0, "seed punya laporan di dalam rentang");
  harus(
    harap < (await gmvAkun(akun, "2024-10-01", "2024-10-24")),
    "laporan sebelum rentang memang ada",
  );
  hampir(p.r, harap, "realisasi mulai tanggal 15");
  hampir(p.rasio, Math.round((harap / p.t) * 1000) / 10, "rasio");
  await pulihkan();
});

uji(
  "KPI GMV tidak menagih goal yang belum mulai, dan menagih sebagian yang baru mulai",
  async () => {
    const [a, b] = AKUN_RIAN;
    harus(a && b, "seed: Rian memegang dua akun ber-goal");
    await aturRentang(a.goal, "2024-10-01", "2024-10-25", "2024-10-31");
    await aturRentang(b.goal, "2024-10-01", "2024-10-25", "2024-10-31");
    const kosong = await satu(
      `select realisasi_gmv_kpi($1, '2024-10-01', '2024-10-24') v`,
      [RIAN],
    );
    harusSama(kosong.v, null, "belum ada target yang berjalan");

    await aturRentang(a.goal, "2024-10-01", "2024-10-15", "2024-10-31");
    const kpi = await satu(
      `select realisasi_gmv_kpi($1, '2024-10-01', '2024-10-24')::float8 v`,
      [RIAN],
    );
    const target = (await tangga(a.goal))[0].target;
    // 15–24 Okt = 10 dari 17 hari rentangnya; akun kedua belum mulai.
    const harap =
      ((await gmvAkun(a.akun, "2024-10-15", "2024-10-24")) /
        ((target * 10) / 17)) *
      100;
    hampir(kpi.v, harap, "skor GMV");
    await pulihkan();
  },
);

uji("goal perusahaan dan anak tangga GRD memakai rentang", async () => {
  await aturRentang(KORP, "2024-10-01", "2024-10-15", "2024-10-31");
  const gk = await satu(
    `select realisasi::float8 r from goal_korporasi('2024-10-24')`,
  );
  const semua = await satu(
    `select coalesce(sum(gmv), 0)::float8 n from daily_reports
      where tanggal between '2024-10-15' and '2024-10-24'`,
  );
  hampir(gk.r, semua.n, "goal perusahaan");

  const unit = await satu(
    `select g.id, g.unit_id from goals g join units u on u.id = g.unit_id
      where g.level = 'leader' and u.kode = 'affiliator'`,
  );
  await aturRentang(unit.id, "2024-10-01", "2024-10-15", "2024-10-31");
  const att = await satu(
    `select realisasi::float8 r from anak_tangga_target('2024-10-24') where goal_id = $1`,
    [unit.id],
  );
  const gmvUnit = await satu(
    `select coalesce(sum(r.gmv), 0)::float8 n
       from daily_reports r left join accounts a on a.id = r.account_id
      where r.tanggal between '2024-10-15' and '2024-10-24'
        and coalesce(r.unit_id, a.unit_id) = $1`,
    [unit.unit_id],
  );
  hampir(att.r, gmvUnit.n, "anak tangga unit: laporan unit dan akun-akunnya");
  await pulihkan();
});

/** Panggil ubah_goal atas nama Manager dengan isian goal lama. */
async function ubahPeriode(goalId, pBulan, periode) {
  const g = await satu(`select * from goals where id = $1`, [goalId]);
  return sebagai(
    db,
    MANAGER,
    `select ubah_goal($1, $2, $3::level_goal, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
    [
      g.id,
      g.judul,
      g.level,
      g.pemilik_id,
      g.parent_goal_id,
      g.unit_id,
      g.account_id,
      Number(g.target_base),
      Number(g.target_goal),
      Number(g.target_stretch),
      periode,
      JSON.stringify(pBulan),
    ],
  );
}

uji("ubah_goal menyimpan rentang tanggal yang disusun aplikasi", async () => {
  const pBulan = susunAnakTangga(
    "2024-10-15",
    "2024-12-14",
    310_000,
    "bulanan",
  );
  await ubahPeriode(KORP, pBulan, labelPeriode("2024-10-15", "2024-12-14"));
  harusSama(await tangga(KORP), pBulan, "tersimpan persis");
  harusSama(
    (await satu(`select periode from goals where id = $1`, [KORP])).periode,
    "15 Okt – 14 Des 2024",
  );
  await pulihkan();
});

uji(
  "anak tangga tanpa rentang dari klien lama berarti bulan penuh",
  async () => {
    await ubahPeriode(
      KORP,
      [{ bulan: "2024-11-01", target: 1_000 }],
      "Nov 2024",
    );
    harusSama(await tangga(KORP), [
      {
        bulan: "2024-11-01",
        dari: "2024-11-01",
        sampai: "2024-11-30",
        target: 1_000,
      },
    ]);
    await pulihkan();
  },
);

uji("setahun dari tengah bulan boleh, lebih dari setahun ditolak", async () => {
  const setahun = susunAnakTangga(
    "2024-10-15",
    "2025-10-14",
    1_300_000,
    "total",
  );
  harusSama(setahun.length, 13, "13 bulan kalender");
  await ubahPeriode(KORP, setahun, labelPeriode("2024-10-15", "2025-10-14"));
  harusSama((await tangga(KORP)).length, 13);

  const lewat = setahun.map((b, i) =>
    i === setahun.length - 1 ? { ...b, sampai: "2025-10-15" } : b,
  );
  await harusDitolak(
    () => ubahPeriode(KORP, lewat, "terlalu panjang"),
    "setahun lebih sehari",
  );
  harusSama(
    (await tangga(KORP)).at(-1).sampai,
    "2025-10-14",
    "periode lama utuh",
  );
  await pulihkan();
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
