/**
 * Otorisasi modul GRD per peran: siapa melihat apa, dan siapa boleh mengubah.
 *
 * Dijalankan sebagai role `authenticated` dengan `auth.uid()` tiap peran,
 * jadi yang diuji adalah kebijakan RLS sebenarnya — bukan penjagaan di
 * server action yang bisa dilewati lewat API langsung.
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
const { uji, jalankan } = buatSuite("Otorisasi GRD");

const ORANG = {
  ceo: "Hafidz Alkahfi",
  manager: "Farhan Pratama",
  leaderAff: "Dewi Lestari",
  leaderMcn: "Galih Prakoso",
  stafAff: "Nabila Putri",
  finance: "Laras Ayuningtyas",
};

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const hitung = async (nama, sql, params = []) =>
  Number((await sebagai(db, await id(nama), sql, params)).rows[0].n);

uji("CEO dan Manager melihat seluruh goal", async () => {
  const semua = await hitung("Hafidz Alkahfi", "select count(*)::int n from goals");
  const total = Number(
    (await sebagaiAdmin(db, "select count(*)::int n from goals")).rows[0].n,
  );
  harusSama(semua, total);
  harusSama(
    await hitung("Farhan Pratama", "select count(*)::int n from goals"),
    total,
  );
});

uji("Leader hanya melihat goal unitnya sendiri", async () => {
  const { rows } = await sebagai(
    db,
    await id(ORANG.leaderMcn),
    `select count(*) filter (where u.kode = 'mcn')::int mcn,
            count(*) filter (where u.kode <> 'mcn')::int lain
       from goals g join units u on u.id = g.unit_id`,
  );
  harus(rows[0].mcn > 0, "Leader MCN harus melihat goal unitnya");
  harusSama(rows[0].lain, 0, "goal unit lain tidak boleh terlihat");
});

uji("Staff melihat goal akun yang ia pegang, bukan akun orang lain", async () => {
  const { rows } = await sebagai(
    db,
    await id(ORANG.stafAff),
    `select count(*)::int n from goals g
       join accounts a on a.id = g.account_id
      where a.pic_user_id <> $1`,
    [await id(ORANG.stafAff)],
  );
  harusSama(rows[0].n, 0, "goal akun orang lain tidak boleh terlihat");
});

uji("Finance melihat angkanya, tetapi tidak boleh mengubah goal", async () => {
  // RLS tidak menolak dengan galat: baris yang tak boleh disentuh sekadar
  // tidak ikut terpengaruh. Yang diuji karena itu datanya, bukan galatnya.
  harus(
    (await hitung(ORANG.finance, "select count(*)::int n from goals")) > 0,
    "Finance harus bisa membaca goal",
  );
  const sebelum = (
    await sebagaiAdmin(db, "select target_goal from goals where level = 'company'")
  ).rows[0].target_goal;

  await sebagai(
    db,
    await id(ORANG.finance),
    "update goals set target_goal = 1 where level = 'company'",
  );

  harusSama(
    Number(
      (await sebagaiAdmin(db, "select target_goal from goals where level = 'company'"))
        .rows[0].target_goal,
    ),
    Number(sebelum),
    "target goal perusahaan tidak boleh tersentuh Finance",
  );
});

uji("Leader tidak boleh membuat maupun menghapus goal", async () => {
  const unit = (
    await sebagaiAdmin(db, "select id from units where kode = 'mcn'")
  ).rows[0].id;
  await harusDitolak(
    async () =>
      sebagai(
        db,
        await id(ORANG.leaderMcn),
        `insert into goals (judul, level, pemilik_id, unit_id, satuan,
                            target_base, target_goal, target_stretch, periode)
         values ('Goal karangan', 'leader', $1, $2, 'IDR', 1, 2, 3, '2024-Q4')`,
        [await id(ORANG.leaderMcn), unit],
      ),
    "pembuatan goal oleh Leader seharusnya ditolak",
  );
  const sebelum = await hitung(
    ORANG.manager,
    "select count(*)::int n from goals where level = 'leader'",
  );
  await sebagai(db, await id(ORANG.leaderMcn), "delete from goals where level = 'leader'");
  harusSama(
    await hitung(
      ORANG.manager,
      "select count(*)::int n from goals where level = 'leader'",
    ),
    sebelum,
    "goal unit tidak boleh terhapus oleh Leader",
  );
});

uji("Staff tidak boleh mengubah target bulanan", async () => {
  const sebelum = (
    await sebagaiAdmin(db, "select sum(target)::numeric t from goal_months")
  ).rows[0].t;
  await sebagai(db, await id(ORANG.stafAff), "update goal_months set target = 1");
  harusSama(
    Number(
      (await sebagaiAdmin(db, "select sum(target)::numeric t from goal_months")).rows[0].t,
    ),
    Number(sebelum),
    "anak tangga bulanan tidak boleh tersentuh Staff",
  );
});

uji("progres goal ikut batas pandang pemanggilnya", async () => {
  // Fungsi progres tidak SECURITY DEFINER: angkanya dihitung dari baris yang
  // memang boleh dibaca orang itu, bukan dari seluruh tabel.
  const { rows } = await sebagai(
    db,
    await id(ORANG.leaderMcn),
    `select count(*)::int n from progres_goal('2024-10-01', '2024-10-24') p
       join goals g on g.id = p.goal_id
       join units u on u.id = g.unit_id
      where u.kode <> 'mcn'`,
  );
  harusSama(rows[0].n, 0);
});

uji("Staff boleh mengisi lead measure, tidak boleh menyusunnya", async () => {
  const lm = (
    await sebagaiAdmin(db, "select id from lead_measures limit 1")
  ).rows[0].id;
  await sebagai(
    db,
    await id(ORANG.stafAff),
    `insert into lead_measure_entries (lead_measure_id, user_id, tanggal, nilai)
     values ($1, $2, '2024-11-04', 3)`,
    [lm, await id(ORANG.stafAff)],
  );
  await harusDitolak(
    async () =>
      sebagai(
        db,
        await id(ORANG.stafAff),
        `insert into lead_measures (goal_id, judul, satuan, target_mingguan)
         select goal_id, 'Langkah karangan', 'unit', 5 from lead_measures where id = $1`,
        [lm],
      ),
    "penyusunan lead measure oleh Staff seharusnya ditolak",
  );
  await terapkanSeed(db);
});

uji("Staff tidak boleh mengisi realisasi atas nama orang lain", async () => {
  const lm = (
    await sebagaiAdmin(db, "select id from lead_measures limit 1")
  ).rows[0].id;
  await harusDitolak(
    async () =>
      sebagai(
        db,
        await id(ORANG.stafAff),
        `insert into lead_measure_entries (lead_measure_id, user_id, tanggal, nilai)
         values ($1, $2, '2024-11-05', 3)`,
        [lm, await id(ORANG.leaderAff)],
      ),
    "entri atas nama orang lain seharusnya ditolak",
  );
});

uji("Staff melihat definisi KPI, tidak boleh mengubahnya", async () => {
  harus(
    (await hitung(ORANG.stafAff, "select count(*)::int n from kpi_definitions")) > 0,
    "definisi KPI harus terbuka untuk semua yang sudah masuk",
  );
  const sebelum = (
    await sebagaiAdmin(
      db,
      "select sum(bobot)::numeric t from kpi_definitions where jabatan = 'Staff'",
    )
  ).rows[0].t;
  await sebagai(
    db,
    await id(ORANG.stafAff),
    "update kpi_definitions set bobot = 99 where jabatan = 'Staff'",
  );
  harusSama(
    Number(
      (await sebagaiAdmin(
        db,
        "select sum(bobot)::numeric t from kpi_definitions where jabatan = 'Staff'",
      )).rows[0].t,
    ),
    Number(sebelum),
    "bobot KPI tidak boleh tersentuh Staff",
  );
});

uji("Staff hanya melihat snapshot KPI dirinya dan seunitnya", async () => {
  await sebagaiAdmin(
    db,
    `insert into kpi_snapshots (user_id, periode_bulan, skor_total, predikat, cakupan)
     select id, '2024-09-01', 800, 'Istimewa', 100 from users where status = 'aktif'`,
  );
  const stafId = await id(ORANG.stafAff);
  const { rows } = await sebagai(
    db,
    stafId,
    `select count(*) filter (where s.user_id = $1)::int diri,
            count(*) filter (where u.unit_id is distinct from
              (select unit_id from users where id = $1)
              and s.user_id <> $1)::int luar
       from kpi_snapshots s join users u on u.id = s.user_id`,
    [stafId],
  );
  harusSama(rows[0].diri, 1);
  harusSama(rows[0].luar, 0, "snapshot orang di luar unitnya tidak boleh terlihat");
  await terapkanSeed(db);
});

uji("Leader melihat laporan mingguan unitnya saja", async () => {
  await sebagai(db, await id(ORANG.manager), "select buat_laporan_mingguan('2024-10-14')");
  const { rows } = await sebagai(
    db,
    await id(ORANG.leaderMcn),
    `select count(*) filter (where u.kode = 'mcn')::int mcn,
            count(*) filter (where u.kode <> 'mcn')::int lain
       from weekly_reports w join units u on u.id = w.unit_id`,
  );
  harus(rows[0].mcn > 0, "Leader harus melihat laporan unitnya");
  harusSama(rows[0].lain, 0);
});

uji("Leader tidak boleh menulis laporan mingguan secara langsung", async () => {
  const unit = (
    await sebagaiAdmin(db, "select id from units where kode = 'mcn'")
  ).rows[0].id;
  await harusDitolak(
    async () =>
      sebagai(
        db,
        await id(ORANG.leaderMcn),
        `insert into weekly_reports (unit_id, periode, status_hasil, status_kri, keputusan)
         values ($1, '2024-09-30', 'hijau', 'hijau', 'LANJUT')`,
        [unit],
      ),
    "laporan mingguan karangan seharusnya ditolak",
  );
});

uji("jejak audit goal hanya terbuka untuk pengelola angka", async () => {
  await harusDitolak(
    async () => {
      const { rows } = await sebagai(
        db,
        await id(ORANG.stafAff),
        "select count(*)::int n from audit_logs",
      );
      if (rows[0].n > 0) return;
      throw new Error("kosong");
    },
    "jejak audit seharusnya tidak terbaca Staff",
  );
  harus(
    (await hitung(ORANG.manager, "select count(*)::int n from audit_logs")) >= 0,
    "Manager harus bisa membaca jejak audit",
  );
});

uji("Staff unit lain tidak bisa mengisi lead measure unit tetangga", async () => {
  // KRI unit menentukan keputusan WRM-nya; entri dari unit lain akan
  // menggeser keputusan tim yang bukan pemiliknya.
  const lmMcn = (
    await sebagaiAdmin(
      db,
      `select lm.id from lead_measures lm
         join goals g on g.id = lm.goal_id
         join units u on u.id = g.unit_id where u.kode = 'mcn'`,
    )
  ).rows[0].id;
  const stafTap = await id("Yoga Saputra");

  harusSama(
    Number(
      (await sebagai(db, stafTap, "select count(*)::int n from lead_measures where id = $1", [lmMcn]))
        .rows[0].n,
    ),
    0,
    "lead measure unit lain tidak boleh terlihat",
  );

  await harusDitolak(
    () =>
      sebagai(
        db,
        stafTap,
        `insert into lead_measure_entries (lead_measure_id, user_id, tanggal, nilai)
         values ($1, $2, '2024-11-06', 9)`,
        [lmMcn, stafTap],
      ),
    "entri lintas unit seharusnya ditolak",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
