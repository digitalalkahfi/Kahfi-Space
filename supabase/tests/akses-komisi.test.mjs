/**
 * Akses lihat komisi per orang (0212) — docs/KOMISI-DETAIL-AKUN-AFFILIATOR.md
 * §4.5, K5–K7, AC 5, 11–16, E11–E13.
 *
 * Data contoh: Rian Hidayat (Staff) memegang @beauty_daily.id dan
 * @skincare_official; Nabila Putri @fashion_hijab; Bayu @gadget_daily.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusDitolak,
  harusSama,
  idNama,
  idPeran,
  pesanDb,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Akses lihat komisi");

const id = (nama) => idNama(db, nama);
const akun = async (username) =>
  (await sebagaiAdmin(db, "select id from accounts where username = $1", [username]))
    .rows[0].id;

/** Username akun yang komisinya terbaca orang ini lewat `komisi_laporan`. */
async function akunDariKomisi(userId) {
  const semua = (
    await sebagaiAdmin(
      db,
      `select r.id from daily_reports r join accounts a on a.id = r.account_id
       join units u on u.id = a.unit_id where u.kode = 'affiliator'`,
    )
  ).rows.map((r) => r.id);
  const { rows } = await sebagai(db, userId, "select report_id from komisi_laporan($1)", [
    semua,
  ]);
  if (rows.length === 0) return [];
  const nama = await sebagaiAdmin(
    db,
    `select distinct a.username from daily_reports r join accounts a on a.id = r.account_id
     where r.id = any ($1::uuid[]) order by 1`,
    [rows.map((r) => r.report_id)],
  );
  return nama.rows.map((r) => r.username);
}

const atur = (oleh, target, cakupan, akunIds = null) =>
  sebagai(db, oleh, "select atur_akses_komisi($1, $2, $3)", [target, cakupan, akunIds]);

async function galat(fn) {
  try {
    await fn();
  } catch (e) {
    return pesanDb(e);
  }
  throw new Error("seharusnya ditolak, tapi berhasil");
}

const SEMUA_AKUN = [
  "@beauty_daily.id",
  "@fashion_hijab",
  "@gadget_daily",
  "@home_essentials",
  "@skincare_official",
  "@snack_nusantara",
];

uji("Bawaan: tanpa akses, siapa pun selain CEO/Manager tidak membaca komisi", async () => {
  for (const nama of ["Rian Hidayat", "Dewi Lestari", "Maya Safitri", "Laras Ayuningtyas"]) {
    harusSama(await akunDariKomisi(await id(nama)), [], nama);
  }
  harusSama(await akunDariKomisi(await idPeran(db, "Manager")), SEMUA_AKUN);
});

uji("AC11: cakupan 'akun yang dia pegang' → hanya akun yang ia pegang", async () => {
  const manager = await idPeran(db, "Manager");
  const rian = await id("Rian Hidayat");
  await atur(manager, rian, "pegangan");
  harusSama(await akunDariKomisi(rian), ["@beauty_daily.id", "@skincare_official"]);
  // Pintu lain ikut cakupan yang sama.
  const { rows } = await sebagai(
    db,
    rian,
    "select distinct account_id from komisi_akun(date '2024-10-01', date '2024-10-31')",
  );
  harusSama(rows.length, 2);
  const capaian = await sebagai(
    db,
    rian,
    `select count(*) filter (where komisi is not null)::int n
     from capaian_pribadi_saya(date '2024-10-01', date '2024-10-24')`,
  );
  harus(capaian.rows[0].n > 0, "komisi capaian akun pegangan seharusnya terlihat");
});

uji("AC11: kolom komisi tetap terkunci walau punya akses — hanya lewat pintu resmi", async () => {
  const rian = await id("Rian Hidayat");
  await harusDitolak(
    () => sebagai(db, rian, "select komisi from daily_reports limit 1"),
    "kolom komisi terbaca langsung",
  );
});

uji("E12: akun dipindah ke PIC lain → komisinya tidak lagi terlihat, termasuk riwayat lama", async () => {
  const rian = await id("Rian Hidayat");
  const nabila = await id("Nabila Putri");
  const beauty = await akun("@beauty_daily.id");
  await sebagaiAdmin(db, "update accounts set pic_user_id = $1 where id = $2", [nabila, beauty]);
  harusSama(await akunDariKomisi(rian), ["@skincare_official"]);
  await sebagaiAdmin(db, "update accounts set pic_user_id = $1 where id = $2", [rian, beauty]);
});

uji("AC12: cakupan 'akun tertentu' A & B → hanya A & B, termasuk lewat API", async () => {
  const ceo = await idPeran(db, "CEO");
  const dewi = await id("Dewi Lestari");
  const a = await akun("@gadget_daily");
  const b = await akun("@snack_nusantara");
  await atur(ceo, dewi, "tertentu", [a, b]);
  harusSama(await akunDariKomisi(dewi), ["@gadget_daily", "@snack_nusantara"]);
  const { rows } = await sebagai(
    db,
    dewi,
    "select distinct account_id from komisi_akun(date '2024-10-01', date '2024-10-31')",
  );
  harusSama(rows.map((r) => r.account_id).sort(), [a, b].sort());
});

uji("E13: akun tertentu yang dinonaktifkan tetap terbaca sampai dicabut", async () => {
  const dewi = await id("Dewi Lestari");
  const a = await akun("@gadget_daily");
  await sebagaiAdmin(db, "update accounts set status = 'nonaktif' where id = $1", [a]);
  harus((await akunDariKomisi(dewi)).includes("@gadget_daily"), "riwayat akun nonaktif hilang");
  await sebagaiAdmin(db, "update accounts set status = 'aktif' where id = $1", [a]);
});

uji("AC13: cakupan 'semua' → semua akun Affiliator, tetapi kartu total tetap tertutup (K7)", async () => {
  const manager = await idPeran(db, "Manager");
  const maya = await id("Maya Safitri");
  await atur(manager, maya, "semua");
  harusSama(await akunDariKomisi(maya), SEMUA_AKUN);
  const pesan = await galat(() =>
    sebagai(db, maya, "select * from komisi_affiliator_harian(date '2024-10-01', date '2024-10-31')"),
  );
  harus(pesan.includes("Hanya CEO atau Manager"), pesan);
  await harusDitolak(
    () => sebagai(db, maya, "select * from komisi_affiliator(date '2024-10-01', date '2024-10-31')"),
    "detail per akun CEO/Manager terbuka",
  );
});

uji("AC14: Leader tanpa akses tidak melihat komisi akun yang ia pegang sendiri", async () => {
  const galih = await id("Galih Prakoso"); // Leader MCN, tanpa akses
  const dewi = await id("Dewi Lestari");
  const manager = await idPeran(db, "Manager");
  // Dewi (Leader Affiliator) dicabut aksesnya lalu diberi akun pegangan.
  await atur(manager, dewi, null);
  const akunDewi = (
    await sebagaiAdmin(
      db,
      `insert into accounts (platform, username, unit_id, pic_user_id, status)
       values ('tiktok', '@akun_dewi_akses', (select id from units where kode = 'affiliator'), $1, 'aktif')
       returning id`,
      [dewi],
    )
  ).rows[0].id;
  await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi)
     values ($1, date '2024-10-10', $2, 1000000, 80000)`,
    [dewi, akunDewi],
  );
  harusSama(await akunDariKomisi(dewi), []);
  harusSama(await akunDariKomisi(galih), []);
});

uji("AC15: Leader/Staff tidak bisa mengubah akses siapa pun, termasuk dirinya", async () => {
  const dewi = await id("Dewi Lestari");
  const rian = await id("Rian Hidayat");
  for (const [oleh, target] of [
    [dewi, dewi],
    [dewi, rian],
    [rian, rian],
  ]) {
    const pesan = await galat(() => atur(oleh, target, "semua"));
    harus(pesan.includes("Hanya CEO atau Manager"), pesan);
  }
  // Menulis tabel langsung lewat API juga ditolak.
  await harusDitolak(
    () =>
      sebagai(db, dewi, "insert into akses_komisi (user_id, cakupan) values ($1, 'semua')", [dewi]),
    "insert langsung seharusnya ditolak",
  );
  await harusDitolak(
    () => sebagai(db, rian, "update akses_komisi set cakupan = 'semua' where user_id = $1", [rian]),
    "update langsung seharusnya ditolak",
  );
  // Manager pun hanya lewat fungsi resmi (supaya riwayat selalu tercatat).
  const manager = await idPeran(db, "Manager");
  await harusDitolak(
    () =>
      sebagai(db, manager, "insert into akses_komisi (user_id, cakupan) values ($1, 'semua')", [dewi]),
    "tulis langsung oleh Manager seharusnya ditolak",
  );
});

uji("AC16: setiap pemberian, perubahan, dan pencabutan tercatat (siapa, kapan, sebelum, sesudah)", async () => {
  const manager = await idPeran(db, "Manager");
  const bayu = await id("Bayu Nugraha");
  const a = await akun("@home_essentials");
  await atur(manager, bayu, "pegangan");
  await atur(manager, bayu, "tertentu", [a]);
  await atur(manager, bayu, "tertentu", [a]); // tanpa perubahan → tidak dicatat
  await atur(manager, bayu, null);
  const { rows } = await sebagaiAdmin(
    db,
    `select sebelum, sesudah, oleh, pada is not null ada_waktu
     from riwayat_akses_komisi where user_id = $1 order by pada, id`,
    [bayu],
  );
  harusSama(rows.length, 3);
  harusSama(rows[0].sebelum, null);
  harusSama([rows[0].sesudah.cakupan, rows[0].sesudah.akun], ["pegangan", []]);
  harusSama(rows[1].sebelum.cakupan, "pegangan");
  harusSama(
    [rows[1].sesudah.cakupan, rows[1].sesudah.akun.map((x) => [x.id, x.username])],
    ["tertentu", [[a, "@home_essentials"]]],
  );
  harusSama(rows[2].sebelum.cakupan, "tertentu");
  harusSama(rows[2].sesudah, null);
  harus(rows.every((r) => r.oleh === manager && r.ada_waktu), "pelaku/waktu kosong");
});

uji("Riwayat akses tidak bisa diubah atau dihapus; hanya CEO/Manager yang membacanya", async () => {
  await harusDitolak(
    () => sebagaiAdmin(db, "delete from riwayat_akses_komisi"),
    "riwayat terhapus",
  );
  const rian = await id("Rian Hidayat");
  const { rows } = await sebagai(db, rian, "select count(*)::int n from riwayat_akses_komisi");
  harusSama(rows[0].n, 0);
  const ceo = await idPeran(db, "CEO");
  const c = await sebagai(db, ceo, "select count(*)::int n from riwayat_akses_komisi");
  harus(c.rows[0].n > 0, "CEO seharusnya membaca riwayat");
});

uji("Orangnya sendiri membaca baris akses miliknya, bukan milik orang lain", async () => {
  const rian = await id("Rian Hidayat");
  const { rows } = await sebagai(db, rian, "select user_id, cakupan from akses_komisi");
  harusSama(rows, [{ user_id: rian, cakupan: "pegangan" }]);
});

uji("Anggota yang dinonaktifkan otomatis kehilangan akses", async () => {
  const rian = await id("Rian Hidayat");
  await sebagaiAdmin(db, "update users set status = 'nonaktif' where id = $1", [rian]);
  const { rows } = await sebagai(db, rian, "select * from akun_komisi_terlihat()");
  await sebagaiAdmin(db, "update users set status = 'aktif' where id = $1", [rian]);
  harusSama(rows.length, 0);
});

uji("'Akun tertentu' hanya menerima akun Affiliator dan minimal satu", async () => {
  const ceo = await idPeran(db, "CEO");
  const rian = await id("Rian Hidayat");
  const kosong = await galat(() => atur(ceo, rian, "tertentu", []));
  harus(kosong.includes("minimal satu akun"), kosong);
  const bukan = (
    await sebagaiAdmin(
      db,
      `insert into accounts (platform, username, unit_id, status)
       values ('tiktok', '@akun_mcn_uji', (select id from units where kode = 'mcn'), 'aktif')
       returning id`,
    )
  ).rows[0].id;
  const pesan = await galat(() => atur(ceo, rian, "tertentu", [bukan]));
  harus(pesan.includes("hanya untuk akun Affiliator"), pesan);
});

uji("GRD: lead measure komisi terlihat bila semua akun cakupannya terlihat", async () => {
  const goal = (
    await sebagaiAdmin(
      db,
      `select g.id from goals g join units u on u.id = g.unit_id
       where u.kode = 'affiliator' limit 1`,
    )
  ).rows[0].id;
  const lm = (
    await sebagaiAdmin(
      db,
      `insert into lead_measures (goal_id, judul, satuan, target_mingguan, sumber_laporan)
       values ($1, 'Komisi akun Rian', 'rupiah', 100000, 'komisi') returning id`,
      [goal],
    )
  ).rows[0].id;
  const skincare = await akun("@skincare_official");
  await sebagaiAdmin(
    db,
    `insert into lead_measure_akun (lead_measure_id, account_id) values ($1, $2)`,
    [lm, skincare],
  );
  // Uji sebelumnya menonaktifkan Rian, yang ikut melepas PIC akunnya.
  const rian = await id("Rian Hidayat");
  await sebagaiAdmin(db, "update accounts set pic_user_id = $1 where id = $2", [rian, skincare]);
  await sebagaiAdmin(db, "select set_config('app.sinkron_lead', '1', false)");
  await sebagaiAdmin(
    db,
    `insert into lead_measure_entries (lead_measure_id, tanggal, nilai, catatan, dari_laporan)
     values ($1, current_date - 1, 50000, '', true)`,
    [lm],
  );
  await sebagaiAdmin(db, "select set_config('app.sinkron_lead', '', false)");
  const lihat = async (userId) =>
    Number(
      (
        await sebagai(
          db,
          userId,
          "select count(*)::int n from lead_measure_entries where lead_measure_id = $1",
          [lm],
        )
      ).rows[0].n,
    );
  // Rian (pegangan, memegang @skincare_official) melihat; Nabila tidak.
  harusSama([await lihat(rian), await lihat(await id("Nabila Putri"))], [1, 0]);
});

await jalankan();
await db.close();
