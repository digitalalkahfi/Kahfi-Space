/**
 * Hak akses mengikuti struktur organisasi (migrasi 0173).
 *
 * Staff hanya dirinya; Co-Leader dirinya + Staff yang melapor kepadanya;
 * Leader dirinya + seluruh cabang di bawahnya; Manager & CEO semua.
 * Diuji langsung lewat RLS dan RPC, bukan lewat tampilan.
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
const { uji, jalankan } = buatSuite("Akses hierarki organisasi");

const id = async (nama) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [nama])).rows[0]
    .id;

const U = {
  ceo: await id("Hafidz Alkahfi"),
  manager: await id("Farhan Pratama"),
  finance: await id("Laras Ayuningtyas"),
  galih: await id("Galih Prakoso"), // Leader MCN
  maya: await id("Maya Safitri"), // Co-Leader MCN
  rizky: await id("Rizky Ananda"), // Staff MCN → akan melapor ke Maya
  fajar: await id("Fajar Ramadhan"), // Staff MCN → akan melapor ke Maya
  putri: await id("Putri Amelia"), // Staff MCN, tetap di bawah Galih
  dewi: await id("Dewi Lestari"), // Leader Affiliator
  nabila: await id("Nabila Putri"), // Staff Affiliator, PIC @fashion_hijab
  rian: await id("Rian Hidayat"), // Staff Affiliator
};

// Seed menaruh semua staf MCN langsung di bawah Leader. Supaya cabang
// Co-Leader teruji, dua staf dipindahkan ke bawah Maya (masih seunit).
await sebagaiAdmin(db, `update users set atasan_id = $1 where id in ($2, $3)`, [
  U.maya,
  U.rizky,
  U.fajar,
]);

const bawahan = async (siapa) =>
  (await sebagai(db, siapa, `select bawahan_saya() as id`)).rows
    .map((r) => r.id)
    .sort();

const hitung = async (siapa, sql, params = []) =>
  Number((await sebagai(db, siapa, sql, params)).rows[0].n);

uji("bawahan_saya: Co-Leader hanya staf yang melapor kepadanya", async () => {
  harusSama(await bawahan(U.maya), [U.rizky, U.fajar].sort());
});

uji(
  "bawahan_saya: Leader mencakup Co-Leader dan cabang di bawahnya",
  async () => {
    harusSama(
      await bawahan(U.galih),
      [U.maya, U.rizky, U.fajar, U.putri, await id("Sinta Maharani")].sort(),
    );
  },
);

uji("bawahan_saya: Staff tidak punya bawahan", async () => {
  harusSama(await bawahan(U.rizky), []);
});

uji("Staff hanya melihat absensi dirinya, bukan rekan seunit", async () => {
  const semua = await hitung(U.putri, `select count(*)::int n from attendance`);
  const diri = await hitung(
    U.putri,
    `select count(*)::int n from attendance where user_id = $1`,
    [U.putri],
  );
  harus(diri > 0, "absensinya sendiri harus ada");
  harusSama(semua, diri);
});

uji(
  "Co-Leader melihat absensi bawahannya, bukan rekan seunit lain",
  async () => {
    const { rows } = await sebagai(
      db,
      U.maya,
      `select distinct user_id from attendance order by user_id`,
    );
    const terlihat = rows.map((r) => r.user_id);
    harus(terlihat.includes(U.rizky), "Rizky adalah bawahan Maya");
    harus(!terlihat.includes(U.putri), "Putri seunit tapi bukan bawahan Maya");
    harus(!terlihat.includes(U.galih), "Leader di atasnya tidak terlihat");
  },
);

uji("Leader melihat seluruh cabangnya, tidak unit lain", async () => {
  const { rows } = await sebagai(
    db,
    U.galih,
    `select distinct user_id from attendance`,
  );
  const terlihat = new Set(rows.map((r) => r.user_id));
  for (const orang of [U.galih, U.maya, U.rizky, U.putri]) {
    harus(terlihat.has(orang), `cabang MCN harus terlihat Leader MCN`);
  }
  harus(!terlihat.has(U.nabila), "Staff Affiliator tidak terlihat Leader MCN");
  harus(!terlihat.has(U.manager), "atasannya sendiri tidak terlihat");
});

uji("Manager dan CEO melihat semua orang", async () => {
  const semua = Number(
    (
      await sebagaiAdmin(
        db,
        `select count(distinct user_id)::int n from attendance`,
      )
    ).rows[0].n,
  );
  for (const siapa of [U.manager, U.ceo]) {
    harusSama(
      await hitung(
        siapa,
        `select count(distinct user_id)::int n from attendance`,
      ),
      semua,
    );
  }
});

uji(
  "akun: Staff hanya akunnya, Leader akun cabangnya, Leader lain nihil",
  async () => {
    const milikNabila = await hitung(
      U.nabila,
      `select count(*)::int n from accounts where pic_user_id <> $1`,
      [U.nabila],
    );
    harusSama(milikNabila, 0, "akun rekan sejawat tidak terlihat Staff");

    const dewiLihat = await hitung(
      U.dewi,
      `select count(*)::int n from accounts where pic_user_id = $1`,
      [U.nabila],
    );
    harus(dewiLihat > 0, "akun bawahan terlihat Leader-nya");

    const galihLihat = await hitung(
      U.galih,
      `select count(*)::int n from accounts`,
    );
    harusSama(galihLihat, 0, "Leader MCN tidak melihat akun Affiliator");
  },
);

uji("laporan harian akun mengikuti siapa yang melihat akunnya", async () => {
  const rekanRian = await hitung(
    U.rian,
    `select count(*)::int n from daily_reports r
      join accounts a on a.id = r.account_id
     where a.pic_user_id <> $1`,
    [U.rian],
  );
  harusSama(rekanRian, 0, "laporan akun rekan tidak terlihat Staff");

  const dewiLihat = await hitung(
    U.dewi,
    `select count(*)::int n from daily_reports r
      join accounts a on a.id = r.account_id
     where a.pic_user_id = $1`,
    [U.nabila],
  );
  harus(dewiLihat > 0, "laporan akun bawahan terlihat Leader-nya");
});

uji(
  "goal: Staff tidak melihat goal rekan, Leader melihat goal cabangnya",
  async () => {
    // Goal akun rekan sejawat tidak terlihat; goal unit (level leader)
    // memang terbaca anggota unit karena itu target bersama.
    const goalRekan = await hitung(
      U.rian,
      `select count(*)::int n from goals
     where level <> 'leader' and pemilik_id is not null and pemilik_id <> $1`,
      [U.rian],
    );
    harusSama(goalRekan, 0);
    const goalUnit = await hitung(
      U.rian,
      `select count(*)::int n from goals where level = 'leader'`,
    );
    harusSama(goalUnit, 1, "hanya goal unitnya sendiri, bukan unit lain");
    const goalBawahan = await hitung(
      U.dewi,
      `select count(*)::int n from goals where pemilik_id = $1`,
      [U.nabila],
    );
    const adaGoal = Number(
      (
        await sebagaiAdmin(
          db,
          `select count(*)::int n from goals where pemilik_id = $1`,
          [U.nabila],
        )
      ).rows[0].n,
    );
    harusSama(goalBawahan, adaGoal, "goal bawahan terlihat Leader-nya");
  },
);

uji("scorecard_tim hanya berisi orang dalam cakupan pemanggil", async () => {
  const nama = async (siapa) =>
    (
      await sebagai(
        db,
        siapa,
        `select user_id from scorecard_tim('2024-10-01','2024-10-24')`,
      )
    ).rows.map((r) => r.user_id);
  harusSama(await nama(U.putri), [U.putri], "Staff hanya dirinya");
  const maya = await nama(U.maya);
  harusSama(
    maya.sort(),
    [U.maya, U.rizky, U.fajar].sort(),
    "Co-Leader + bawahannya",
  );
  const galih = new Set(await nama(U.galih));
  harus(
    galih.has(U.maya) && galih.has(U.putri) && !galih.has(U.nabila),
    "Leader = cabangnya",
  );
  harus((await nama(U.manager)).length >= 20, "Manager melihat semua");
});

uji("status_tim_harian tidak lagi menyebut orang di luar cakupan", async () => {
  const baris = (
    await sebagai(
      db,
      U.putri,
      `select user_id from status_tim_harian('2024-10-24')`,
    )
  ).rows;
  harusSama(
    baris.map((r) => r.user_id),
    [U.putri],
  );
  const maya = (
    await sebagai(
      db,
      U.maya,
      `select user_id from status_tim_harian('2024-10-24')`,
    )
  ).rows;
  harusSama(
    maya.map((r) => r.user_id).sort(),
    [U.maya, U.rizky, U.fajar].sort(),
  );
});

uji(
  "sudah_lapor_harian & wajib_lapor_harian tidak menjawab untuk orang di luar cakupan",
  async () => {
    const { rows } = await sebagai(
      db,
      U.rian,
      `select sudah_lapor_harian($1, '2024-10-24') s, wajib_lapor_harian($1) w`,
      [U.nabila],
    );
    harusSama(rows[0].s, false);
    harusSama(rows[0].w, false);
    // Untuk dirinya sendiri tetap bekerja.
    const diri = await sebagai(
      db,
      U.nabila,
      `select wajib_lapor_harian($1) w`,
      [U.nabila],
    );
    harusSama(diri.rows[0].w, true, "Nabila PIC akun aktif");
  },
);

uji(
  "realisasi KPI orang lain tidak bisa ditarik lewat RPC langsung",
  async () => {
    const { rows } = await sebagai(
      db,
      U.rian,
      `select realisasi_kpi($1, 'gmv', '2024-10-01', '2024-10-24') g,
            realisasi_gmv_kpi($1, '2024-10-01', '2024-10-24') gg,
            realisasi_lead_measure_kpi($1, '2024-10-01', '2024-10-24') lm,
            (select cakupan from hitung_kpi($1, '2024-10-01', '2024-10-24')) c`,
      [U.nabila],
    );
    harusSama(rows[0].g, null);
    harusSama(rows[0].gg, null);
    harusSama(rows[0].lm, null);
    harusSama(Number(rows[0].c), 0, "hitung_kpi orang lain kosong");
    const overload = await sebagaiAdmin(
      db,
      `select count(*)::int n from pg_proc where proname = 'realisasi_kpi'`,
    );
    harusSama(
      overload.rows[0].n,
      1,
      "overload lama tiga argumen sudah dilepas",
    );
  },
);

uji("atasan hanya bisa memutus izin bawahannya sendiri", async () => {
  // Izin Putri (bawahan Galih, bukan Maya): Maya tidak boleh menyetujui.
  await sebagai(
    db,
    U.putri,
    `insert into attendance (user_id, tanggal, status, alasan, persetujuan)
     values ($1, '2024-11-12', 'izin', 'Urusan keluarga di luar kota.', 'diajukan')`,
    [U.putri],
  );
  const r = await sebagai(
    db,
    U.maya,
    `update attendance set persetujuan = 'disetujui', disetujui_oleh = $1, disetujui_pada = now()
      where user_id = $2 and tanggal = '2024-11-12'`,
    [U.maya, U.putri],
  );
  harusSama(r.affectedRows ?? 0, 0, "bukan bawahan Maya, jadi tidak tersentuh");
  const g = await sebagai(
    db,
    U.galih,
    `update attendance set persetujuan = 'disetujui', disetujui_oleh = $1, disetujui_pada = now()
      where user_id = $2 and tanggal = '2024-11-12'`,
    [U.galih, U.putri],
  );
  harusSama(g.affectedRows ?? 0, 1, "Leader-nya yang berwenang");
});

uji(
  "Finance tetap melihat angka lintas unit, bukan absensi orang",
  async () => {
    harus(
      (await hitung(U.finance, `select count(*)::int n from daily_reports`)) >
        20,
      "laporan GMV lintas unit terbaca Finance",
    );
    harusSama(
      await hitung(
        U.finance,
        `select count(*)::int n from attendance where user_id <> $1`,
        [U.finance],
      ),
      0,
    );
  },
);

uji(
  "kontak_orang: Staff hanya dirinya; Leader cabangnya; Manager semua (0174)",
  async () => {
    const ids = async (siapa) =>
      (await sebagai(db, siapa, `select id from kontak_orang()`)).rows
        .map((r) => r.id)
        .sort();
    harusSama(await ids(U.putri), [U.putri]);
    harusSama(await ids(U.maya), [U.maya, U.rizky, U.fajar].sort());
    const galih = new Set(await ids(U.galih));
    harus(
      galih.has(U.putri) && !galih.has(U.nabila),
      "Leader = cabangnya saja",
    );
    const semua = Number(
      (await sebagaiAdmin(db, `select count(*)::int n from users`)).rows[0].n,
    );
    harusSama((await ids(U.manager)).length, semua, "Manager melihat semua");

    // Meminta id orang di luar cakupan secara eksplisit tetap tidak diberi.
    const paksa = await sebagai(
      db,
      U.putri,
      `select id from kontak_orang($1::uuid[])`,
      [[U.nabila, U.manager]],
    );
    harusSama(paksa.rows.length, 0);
  },
);

uji("kontak_orang tidak bisa dipanggil pengunjung tanpa sesi", async () => {
  await db.exec("reset role;");
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec("set role anon;");
  let ditolak = false;
  try {
    await db.query(`select * from kontak_orang()`);
  } catch {
    ditolak = true;
  } finally {
    await db.exec("reset role;");
  }
  harus(ditolak, "anon tidak boleh mengeksekusi kontak_orang");
});

uji(
  "CO sampel per akun hanya untuk akun yang terlihat pemanggil (0174)",
  async () => {
    const semua = (
      await sebagaiAdmin(
        db,
        `select count(distinct s.account_id)::int n
         from sample_scans sc join samples s on s.id = sc.sample_id
        where sc.dikenali and s.account_id is not null`,
      )
    ).rows[0].n;
    const hari = (
      await sebagaiAdmin(
        db,
        `select distinct (sc.pada at time zone 'Asia/Jakarta')::date::text t
         from sample_scans sc where sc.dikenali`,
      )
    ).rows.map((r) => r.t);
    let akunLain = 0;
    for (const t of hari) {
      const { rows } = await sebagai(
        db,
        U.rian,
        `select c.account_id from co_sampel_akun($1::date) c
         join accounts a on a.id = c.account_id
        where a.pic_user_id is distinct from $2`,
        [t, U.rian],
      );
      akunLain += rows.length;
    }
    harusSama(akunLain, 0, "akun rekan sejawat tidak ikut terhitung");
    harus(semua >= 0, "seed terbaca");
  },
);

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
