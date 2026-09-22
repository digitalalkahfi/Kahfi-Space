/** Goal & roll-down: hierarki, batas 3 goal, dan jejak perubahannya. */
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
const { uji, jalankan } = buatSuite("Goal & roll-down");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

uji("hierarki roll-down lengkap dari company ke akun", async () => {
  // PRD: goal perusahaan diturunkan ke Manager, lalu Leader, lalu akun.
  const { rows } = await sebagaiAdmin(
    db,
    "select level, count(*)::int n from goals group by level order by level",
  );
  const per = Object.fromEntries(rows.map((r) => [r.level, r.n]));
  harus(per.company > 0, "harus ada goal perusahaan");
  harus(per.manager > 0, "harus ada goal Manager");
  harus(per.leader > 0, "harus ada goal Leader");
  harus(per.account > 0, "harus ada goal akun");
});

uji("goal akun menunjuk akun, goal unit menunjuk unit", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select
       count(*) filter (where level = 'account' and account_id is null)::int akun_tanpa_akun,
       count(*) filter (where level = 'leader' and unit_id is null)::int unit_tanpa_unit
     from goals`,
  );
  harusSama(rows[0].akun_tanpa_akun, 0);
  harusSama(rows[0].unit_tanpa_unit, 0);
});

uji("anak tangga bulanan ada untuk tiap goal aktif", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int n from goals g
      where g.status = 'aktif'
        and not exists (select 1 from goal_months m where m.goal_id = g.id)`,
  );
  harusSama(rows[0].n, 0);
});

uji("maksimal tiga goal aktif per orang", async () => {
  // PRD §aturan: maks 3 goal per orang.
  const orang = await id("Anisa Larasati");
  const unit = (await sebagaiAdmin(db, "select id from units where kode='affiliator'")).rows[0].id;

  for (let i = 1; i <= 3; i++) {
    await sebagaiAdmin(
      db,
      `insert into goals (judul, level, pemilik_id, unit_id, satuan, target_base, target_goal, target_stretch, periode)
       values ($1, 'staff', $2, $3, 'rupiah', 1, 2, 3, 'bulanan')`,
      [`Goal uji ${i}`, orang, unit],
    );
  }

  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into goals (judul, level, pemilik_id, unit_id, satuan, target_base, target_goal, target_stretch, periode)
         values ('Goal uji keempat', 'staff', $1, $2, 'rupiah', 1, 2, 3, 'bulanan')`,
        [orang, unit],
      ),
    "goal keempat seharusnya ditolak",
  );

  await sebagaiAdmin(db, "delete from goals where judul like 'Goal uji%'");
});

uji("goal nonaktif tidak ikut menghitung batas", async () => {
  // Kalau ikut dihitung, orang tidak pernah bisa mengganti goal lamanya.
  const orang = await id("Anisa Larasati");
  const unit = (await sebagaiAdmin(db, "select id from units where kode='affiliator'")).rows[0].id;

  for (let i = 1; i <= 3; i++) {
    await sebagaiAdmin(
      db,
      `insert into goals (judul, level, pemilik_id, unit_id, satuan, target_base, target_goal, target_stretch, periode, status)
       values ($1, 'staff', $2, $3, 'rupiah', 1, 2, 3, 'bulanan', 'selesai')`,
      [`Goal lama ${i}`, orang, unit],
    );
  }

  await sebagaiAdmin(
    db,
    `insert into goals (judul, level, pemilik_id, unit_id, satuan, target_base, target_goal, target_stretch, periode)
     values ('Goal baru setelah yang lama selesai', 'staff', $1, $2, 'rupiah', 1, 2, 3, 'bulanan')`,
    [orang, unit],
  );

  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int n from goals where judul like 'Goal baru setelah%'",
  );
  harusSama(rows[0].n, 1);
  await sebagaiAdmin(db, "delete from goals where judul like 'Goal lama%' or judul like 'Goal baru setelah%'");
});

uji("setiap perubahan goal meninggalkan jejak", async () => {
  // PRD: target tak boleh diubah surut tanpa jejak.
  const goal = (
    await sebagaiAdmin(db, "select id from goals where level = 'company' limit 1")
  ).rows[0].id;

  const sebelum = (
    await sebagaiAdmin(db, "select count(*)::int n from audit_logs where entitas_id = $1", [goal])
  ).rows[0].n;

  await sebagai(
    db,
    await id("Farhan Pratama"),
    "update goals set target_goal = target_goal + 1 where id = $1",
    [goal],
  );

  const { rows } = await sebagaiAdmin(
    db,
    "select aksi, oleh.nama, nilai_lama, nilai_baru from audit_logs a left join users oleh on oleh.id = a.user_id where a.entitas_id = $1 order by a.created_at desc limit 1",
    [goal],
  );

  harus(
    (await sebagaiAdmin(db, "select count(*)::int n from audit_logs where entitas_id = $1", [goal])).rows[0].n > sebelum,
    "jejak baru harus tercatat",
  );
  harusSama(rows[0].aksi, "update");
  harusSama(rows[0].nama, "Farhan Pratama");
  harus(rows[0].nilai_lama !== null, "nilai lama harus tersimpan");
  harus(rows[0].nilai_baru !== null, "nilai baru harus tersimpan");
});

uji("perubahan anak tangga bulanan ikut terjejak", async () => {
  const bulan = (
    await sebagaiAdmin(db, "select id from goal_months limit 1")
  ).rows[0].id;

  await sebagaiAdmin(db, "update goal_months set target = target + 1 where id = $1", [bulan]);

  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int n from audit_logs where entitas = 'goal_months' and entitas_id = $1",
    [bulan],
  );
  harus(rows[0].n > 0, "perubahan anak tangga harus terjejak");
});

uji("menghapus goal pun meninggalkan jejaknya", async () => {
  const unit = (await sebagaiAdmin(db, "select id from units where kode='tap'")).rows[0].id;
  const { rows: baru } = await sebagaiAdmin(
    db,
    `insert into goals (judul, level, pemilik_id, unit_id, satuan, target_base, target_goal, target_stretch, periode)
     values ('Goal yang akan dihapus', 'staff', $1, $2, 'rupiah', 1, 2, 3, 'bulanan') returning id`,
    [await id("Yoga Saputra"), unit],
  );

  await sebagaiAdmin(db, "delete from goals where id = $1", [baru[0].id]);

  // Diperiksa sebagai "ada jejak delete", bukan "jejak terakhir adalah
  // delete": insert dan delete-nya bisa jatuh pada `created_at` yang
  // sama persis, dan urutan di antara dua baris kembar tidak
  // ditentukan — test yang bergantung padanya lulus atau gagal
  // tergantung kecepatan mesin.
  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from audit_logs where entitas_id = $1 and aksi = 'delete'",
    [baru[0].id],
  );
  harusSama(rows[0].n, 1);
});

uji("Staff tidak bisa membuat goal", async () => {
  const orang = await id("Rian Hidayat");
  const unit = (await sebagaiAdmin(db, "select id from units where kode='affiliator'")).rows[0].id;
  await harusDitolak(
    () =>
      sebagai(
        db,
        orang,
        `insert into goals (judul, level, pemilik_id, unit_id, satuan, target_base, target_goal, target_stretch, periode)
         values ('Goal buatan staf', 'staff', $1, $2, 'rupiah', 1, 2, 3, 'bulanan')`,
        [orang, unit],
      ),
    "Staff seharusnya tidak bisa membuat goal",
  );
});

const goalId = async (judul) =>
  (await sebagaiAdmin(db, "select id from goals where judul = $1", [judul]))
    .rows[0].id;

uji("goal tidak boleh menginduk ke level di bawahnya", async () => {
  // Arah roll-down terbalik membuat pohon goal tergambar terbalik pula.
  const company = await goalId("GMV perusahaan Oktober 2024");
  const akun = await goalId("GMV bulanan @skincare_official");
  await harusDitolak(
    () => sebagaiAdmin(db, "update goals set parent_goal_id = $1 where id = $2", [akun, company]),
    "goal company di bawah goal akun seharusnya ditolak",
  );
});

uji("goal tidak boleh menginduk ke level yang sama", async () => {
  const affiliator = await goalId("GMV bulanan unit AFFILIATOR");
  const mcn = await goalId("GMV bulanan unit MCN");
  await harusDitolak(
    () => sebagaiAdmin(db, "update goals set parent_goal_id = $1 where id = $2", [mcn, affiliator]),
    "dua goal leader tidak boleh saling menginduk",
  );
});

uji("rantai roll-down tidak boleh berputar", async () => {
  const manager = await goalId("GMV operasional Oktober 2024");
  const company = await goalId("GMV perusahaan Oktober 2024");
  await harusDitolak(
    () => sebagaiAdmin(db, "update goals set parent_goal_id = $1 where id = $2", [manager, company]),
    "putaran induk-anak seharusnya ditolak",
  );
});

uji("goal akun harus menginduk ke unit yang sama", async () => {
  // Kalau lolos, rekap unit MCN ikut menjumlahkan akun milik Affiliator.
  const akunAffiliator = await goalId("GMV bulanan @skincare_official");
  const mcn = await goalId("GMV bulanan unit MCN");
  await harusDitolak(
    () =>
      sebagaiAdmin(db, "update goals set parent_goal_id = $1 where id = $2", [mcn, akunAffiliator]),
    "goal akun lintas unit seharusnya ditolak",
  );
});

uji("rantai roll-down bawaan seed tetap sah", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int n
       from goals a join goals b on b.id = a.parent_goal_id
      where tingkat_goal(b.level) >= tingkat_goal(a.level)`,
  );
  harusSama(rows[0].n, 0);
});

uji("progres goal unit menjumlahkan laporan akun-akunnya", async () => {
  // Laporan harian menyasar akun ATAU unit; goal unit harus menangkap
  // keduanya, kalau tidak unit yang melapor lewat akun terbaca nyaris nol.
  const { rows } = await sebagaiAdmin(
    db,
    `select p.realisasi,
            (select coalesce(sum(r.gmv), 0)
               from daily_reports r
               join accounts a on a.id = r.account_id
              where a.unit_id = g.unit_id
                and r.tanggal between '2024-10-01' and '2024-10-24') lewat_akun
       from progres_goal('2024-10-01', '2024-10-24') p
       join goals g on g.id = p.goal_id
      where g.judul = 'GMV bulanan unit AFFILIATOR'`,
  );
  harusSama(rows.length, 1);
  harus(Number(rows[0].lewat_akun) > 0, "seed harus punya laporan lewat akun");
  harusSama(Number(rows[0].realisasi), Number(rows[0].lewat_akun));
});

uji("progres goal akun hanya menghitung akunnya sendiri", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select p.realisasi,
            (select coalesce(sum(r.gmv), 0) from daily_reports r
              where r.account_id = g.account_id
                and r.tanggal between '2024-10-01' and '2024-10-24') sendiri
       from progres_goal('2024-10-01', '2024-10-24') p
       join goals g on g.id = p.goal_id
      where g.judul = 'GMV bulanan @skincare_official'`,
  );
  harusSama(Number(rows[0].realisasi), Number(rows[0].sendiri));
});

uji("progres goal perusahaan sama dengan rekap korporasi", async () => {
  const korporasi = (
    await sebagaiAdmin(db, "select realisasi from goal_korporasi('2024-10-24')")
  ).rows[0].realisasi;
  const { rows } = await sebagaiAdmin(
    db,
    `select p.realisasi from progres_goal('2024-10-01', '2024-10-24') p
       join goals g on g.id = p.goal_id where g.level = 'company'`,
  );
  harusSama(Number(rows[0].realisasi), Number(korporasi));
});

uji("progres tidak menghitung hari sesudah batas", async () => {
  const awal = (
    await sebagaiAdmin(
      db,
      `select p.realisasi from progres_goal('2024-10-01', '2024-10-10') p
         join goals g on g.id = p.goal_id where g.level = 'company'`,
    )
  ).rows[0].realisasi;
  const penuh = (
    await sebagaiAdmin(
      db,
      `select p.realisasi from progres_goal('2024-10-01', '2024-10-24') p
         join goals g on g.id = p.goal_id where g.level = 'company'`,
    )
  ).rows[0].realisasi;
  harus(Number(awal) < Number(penuh), "batas tanggal harus memangkas realisasi");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
