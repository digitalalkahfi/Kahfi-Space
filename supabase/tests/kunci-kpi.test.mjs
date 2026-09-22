/** Snapshot KPI bulanan: siapa boleh mengunci, kapan, dan sifat finalnya. */
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
const { uji, jalankan } = buatSuite("Kunci KPI bulanan");

const BULAN = "2024-10-01";

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const status = async (bulan = BULAN) =>
  (await sebagaiAdmin(db, "select * from status_kunci_kpi($1)", [bulan]))
    .rows[0];

uji("bulan berjalan belum boleh dikunci", async () => {
  // Skor separuh bulan akan terlanjur jadi angka resmi yang tak bisa diubah.
  const bulanIni = new Date().toISOString().slice(0, 8) + "01";
  await harusDitolak(
    async () =>
      sebagai(db, await id("Farhan Pratama"), "select kunci_kpi_bulan($1)", [
        bulanIni,
      ]),
    "bulan berjalan seharusnya ditolak",
  );
});

uji("bulan tanpa data sama sekali ditolak", async () => {
  await harusDitolak(
    async () =>
      sebagai(db, await id("Farhan Pratama"), "select kunci_kpi_bulan($1)", [
        "2024-09-01",
      ]),
    "bulan kosong seharusnya ditolak",
  );
});

uji("Staff tidak boleh mengunci", async () => {
  await harusDitolak(
    async () =>
      sebagai(db, await id("Rian Hidayat"), "select kunci_kpi_bulan($1)", [
        BULAN,
      ]),
    "Staff seharusnya ditolak",
  );
});

uji("Leader tidak boleh mengunci", async () => {
  await harusDitolak(
    async () =>
      sebagai(db, await id("Dewi Lestari"), "select kunci_kpi_bulan($1)", [
        BULAN,
      ]),
    "Leader seharusnya ditolak",
  );
});

uji("Manager mengunci seluruh anggota aktif", async () => {
  // Disiapkan sengaja: satu orang tanpa catatan absensi sepanjang bulan,
  // supaya cakupan parsial ikut teruji saat dikunci.
  await sebagaiAdmin(
    db,
    "delete from attendance where user_id = (select id from users where nama = 'Eko Prasetyo')",
  );

  const sebelum = await status();
  harusSama(sebelum.terkunci, 0);

  const { rows } = await sebagai(
    db,
    await id("Farhan Pratama"),
    "select kunci_kpi_bulan($1) n",
    [BULAN],
  );
  const aktif = (
    await sebagaiAdmin(db, "select count(*)::int n from users where status = 'aktif'")
  ).rows[0].n;
  harusSama(Number(rows[0].n), aktif);

  const sesudah = await status();
  harusSama(sesudah.terkunci, aktif);
  harusSama(sesudah.belum, 0);
  harusSama(sesudah.dikunci_oleh, "Farhan Pratama");
});

uji("mengunci ulang tidak menggandakan", async () => {
  const { rows } = await sebagai(
    db,
    await id("Farhan Pratama"),
    "select kunci_kpi_bulan($1) n",
    [BULAN],
  );
  harusSama(Number(rows[0].n), 0);
});

uji("snapshot terkunci menolak perubahan", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(db, "update kpi_snapshots set skor_total = 999 where periode_bulan = $1", [BULAN]),
    "snapshot terkunci seharusnya kebal ubah",
  );
});

uji("snapshot terkunci menolak penghapusan", async () => {
  await harusDitolak(
    () => sebagaiAdmin(db, "delete from kpi_snapshots where periode_bulan = $1", [BULAN]),
    "snapshot terkunci seharusnya kebal hapus",
  );
});

uji("cakupan ikut tersimpan, bukan diandaikan penuh", async () => {
  // Skor 0 dari bulan tanpa data tidak boleh tampil sebagai "terukur penuh".
  const { rows } = await sebagaiAdmin(
    db,
    `select s.cakupan, c.cakupan cakupan_scorecard
       from kpi_snapshots s
       join lateral (
         select cakupan from scorecard_tim($1, $1) t where t.user_id = s.user_id
       ) c on true
      where s.periode_bulan = $1 and s.user_id = (select id from users where nama = 'Eko Prasetyo')`,
    [BULAN],
  );
  harus(rows.length === 1, "snapshot Eko harus ada");
  harusSama(Number(rows[0].cakupan), Number(rows[0].cakupan_scorecard));
  harusSama(Number(rows[0].cakupan), 75);
});

uji("scorecard memakai angka snapshot, bukan hitung ulang", async () => {
  const sebelum = (
    await sebagaiAdmin(db, "select skor from scorecard_tim($1, $1) where nama = 'Intan Permata'", [BULAN])
  ).rows[0].skor;

  // Menambah data setelah dikunci tidak boleh menggeser skor yang final.
  await sebagaiAdmin(
    db,
    `insert into attendance (user_id, tanggal, status)
     values ((select id from users where nama = 'Intan Permata'), '2024-10-30', 'alpa')`,
  );

  const sesudah = (
    await sebagaiAdmin(db, "select skor from scorecard_tim($1, $1) where nama = 'Intan Permata'", [BULAN])
  ).rows[0].skor;
  harusSama(Number(sesudah), Number(sebelum));
});

uji("orang tanpa satu pun indikator terukur dilewati, bukan dinilai nol", async () => {
  // Snapshot bersifat final; membekukan 0 untuk orang yang bulan itu tak
  // punya satu pun indikator berlaku berarti skor salah selamanya.
  await sebagaiAdmin(db, "delete from goal_months where bulan = $1", [BULAN]);

  const unit = (await sebagaiAdmin(db, "select id from units where kode = 'affiliator'")).rows[0].id;
  await sebagaiAdmin(
    db,
    `insert into users (id, nama, email, role, jabatan, unit_id, status)
     values (gen_random_uuid(), 'Bening Wicaksono', 'bening@alkahfi.co.id',
             'Staff', 'Staff Affiliator', $1, 'aktif')`,
    [unit],
  );
  const baru = await id("Bening Wicaksono");

  harusSama(
    Number(
      (await sebagaiAdmin(db, "select cakupan from hitung_kpi($1, $2, $2)", [baru, BULAN]))
        .rows[0].cakupan,
    ),
    0,
    "tanpa target maupun data, cakupannya 0",
  );

  const { rows } = await sebagai(db, await id("Farhan Pratama"), "select kunci_kpi_bulan($1) n", [BULAN]);
  harusSama(Number(rows[0].n), 0, "yang tak terukur tidak boleh ikut dibekukan");
  harusSama(
    (await sebagaiAdmin(db, "select count(*)::int n from kpi_snapshots where user_id = $1", [baru]))
      .rows[0].n,
    0,
  );
  harusSama(
    (await sebagaiAdmin(
      db,
      "select count(*)::int n from kpi_snapshots where periode_bulan = $1 and cakupan = 0",
      [BULAN],
    )).rows[0].n,
    0,
    "tidak boleh ada snapshot bercakupan 0",
  );
  harusSama((await status()).belum, 0, "sisa tidak menghitung orang yang tak bisa dikunci");
});

uji("begitu terukur, penguncian ulang menangkapnya", async () => {
  await terapkanSeed(db); // target bulan itu kembali ada
  const baru = await id("Bening Wicaksono");
  const terkunciSebelum = (await status()).terkunci;

  harus(
    Number(
      (await sebagaiAdmin(db, "select cakupan from hitung_kpi($1, $2, $2)", [baru, BULAN]))
        .rows[0].cakupan,
    ) > 0,
    "setelah targetnya ada, ia jadi terukur",
  );

  const { rows } = await sebagai(db, await id("Farhan Pratama"), "select kunci_kpi_bulan($1) n", [BULAN]);
  harusSama(Number(rows[0].n), 1, "yang menyusul terukur ikut terkunci");
  harusSama((await status()).terkunci, terkunciSebelum + 1);
  harus(
    Number(
      (await sebagaiAdmin(db, "select cakupan from kpi_snapshots where user_id = $1", [baru]))
        .rows[0].cakupan,
    ) > 0,
    "snapshot susulan harus punya cakupan",
  );
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
