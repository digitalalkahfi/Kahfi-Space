/** Kelola akun affiliator: cakupan baca, wewenang ubah, dan keabsahan PIC. */
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
const { uji, jalankan } = buatSuite("Kelola akun");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const akunId = async (username) =>
  (await sebagaiAdmin(db, "select id from accounts where username = $1", [
    username,
  ])).rows[0].id;

uji("Manager melihat seluruh akun", async () => {
  const { rows } = await sebagai(
    db,
    await id("Farhan Pratama"),
    "select count(*)::int n from accounts",
  );
  harusSama(rows[0].n, 6);
});

uji("Staff hanya melihat akun yang ia pegang", async () => {
  const { rows } = await sebagai(
    db,
    await id("Rian Hidayat"),
    "select username from accounts order by username",
  );
  harusSama(
    rows.map((r) => r.username).join(", "),
    "@beauty_daily.id, @skincare_official",
  );
});

uji("Leader unit lain tidak melihat akun affiliator", async () => {
  const { rows } = await sebagai(
    db,
    await id("Dimas Maulana"),
    "select count(*)::int n from accounts",
  );
  harusSama(rows[0].n, 0);
});

uji("Leader unitnya sendiri melihat akun unit itu", async () => {
  const { rows } = await sebagai(
    db,
    await id("Dewi Lestari"),
    "select count(*)::int n from accounts",
  );
  harusSama(rows[0].n, 6);
});

uji("Manager boleh memindahkan PIC", async () => {
  const akun = await akunId("@fashion_hijab");
  const baru = await id("Anisa Larasati");
  await sebagai(db, await id("Farhan Pratama"), "update accounts set pic_user_id = $1 where id = $2", [baru, akun]);
  const { rows } = await sebagaiAdmin(db, "select pic_user_id from accounts where id = $1", [akun]);
  harusSama(rows[0].pic_user_id, baru);
  await terapkanSeed(db);
});

uji("Leader tidak boleh memindahkan PIC", async () => {
  const akun = await akunId("@fashion_hijab");
  const baru = await id("Anisa Larasati");
  await sebagai(db, await id("Dewi Lestari"), "update accounts set pic_user_id = $1 where id = $2", [baru, akun]);
  // RLS menyaring baris, jadi perubahannya tidak pernah terjadi.
  const { rows } = await sebagaiAdmin(db, "select pic_user_id from accounts where id = $1", [akun]);
  harus(rows[0].pic_user_id !== baru, "Leader seharusnya tidak bisa mengubah PIC");
});

uji("PIC dari unit lain ditolak database", async () => {
  const akun = await akunId("@fashion_hijab");
  const luar = await id("Rizky Ananda"); // Staff MCN
  await harusDitolak(
    () => sebagaiAdmin(db, "update accounts set pic_user_id = $1 where id = $2", [luar, akun]),
    "PIC dari unit lain seharusnya ditolak",
  );
});

uji("PIC berperan Leader ditolak database", async () => {
  const akun = await akunId("@fashion_hijab");
  const leader = await id("Dewi Lestari");
  await harusDitolak(
    () => sebagaiAdmin(db, "update accounts set pic_user_id = $1 where id = $2", [leader, akun]),
    "PIC berperan Leader seharusnya ditolak",
  );
});

uji("PIC nonaktif ditolak database", async () => {
  const akun = await akunId("@fashion_hijab");
  const orang = await id("Teguh Wibowo");
  await sebagaiAdmin(db, "update users set status = 'nonaktif' where id = $1", [orang]);
  await harusDitolak(
    () => sebagaiAdmin(db, "update accounts set pic_user_id = $1 where id = $2", [orang, akun]),
    "PIC nonaktif seharusnya ditolak",
  );
  await sebagaiAdmin(db, "update users set status = 'aktif' where id = $1", [orang]);
});

uji("akun boleh tanpa PIC", async () => {
  const akun = await akunId("@fashion_hijab");
  await sebagaiAdmin(db, "update accounts set pic_user_id = null where id = $1", [akun]);
  const { rows } = await sebagaiAdmin(db, "select pic_user_id from accounts where id = $1", [akun]);
  harusSama(rows[0].pic_user_id, null);
  await terapkanSeed(db);
});

uji("akun nonaktif tidak lagi menagih laporan harian", async () => {
  // Akun dinonaktifkan, bukan dihapus, supaya riwayat GMV-nya utuh.
  const akun = await akunId("@fashion_hijab");
  const pic = await id("Nabila Putri");
  harusSama(
    (await sebagaiAdmin(db, "select wajib_lapor_harian($1) w", [pic])).rows[0].w,
    true,
  );
  await sebagaiAdmin(db, "update accounts set status = 'nonaktif' where id = $1", [akun]);
  harusSama(
    (await sebagaiAdmin(db, "select wajib_lapor_harian($1) w", [pic])).rows[0].w,
    false,
  );
  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int n from daily_reports where account_id = $1",
    [akun],
  );
  harus(rows[0].n > 0, "riwayat GMV akun nonaktif harus tetap ada");
  await terapkanSeed(db);
});

uji("username akun unik tanpa memandang huruf besar-kecil", async () => {
  const unit = (await sebagaiAdmin(db, "select id from units where kode = 'affiliator'")).rows[0].id;
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "insert into accounts (platform, username, unit_id) values ('TikTok Shop', '@SKINCARE_OFFICIAL', $1)",
        [unit],
      ),
    "username yang sama beda huruf seharusnya ditolak",
  );
});

uji("co-leader dari unit lain ditolak database", async () => {
  // Kolom ini membuka akses baca akun (0002/0004/0014), jadi menunjuk
  // orang unit lain berarti membocorkan GMV unit ini ke unit itu.
  const akun = await akunId("@fashion_hijab");
  const luar = await id("Galih Prakoso"); // Leader MCN
  await harusDitolak(
    () => sebagaiAdmin(db, "update accounts set co_leader_id = $1 where id = $2", [luar, akun]),
    "co-leader dari unit lain seharusnya ditolak",
  );
});

uji("co-leader berperan Staff ditolak database", async () => {
  const akun = await akunId("@fashion_hijab");
  const staf = await id("Nabila Putri");
  await harusDitolak(
    () => sebagaiAdmin(db, "update accounts set co_leader_id = $1 where id = $2", [staf, akun]),
    "co-leader berperan Staff seharusnya ditolak",
  );
});

uji("co-leader nonaktif ditolak database", async () => {
  const akun = await akunId("@fashion_hijab");
  const leader = await id("Dewi Lestari");
  await sebagaiAdmin(db, "update users set status = 'nonaktif' where id = $1", [leader]);
  await harusDitolak(
    () => sebagaiAdmin(db, "update accounts set co_leader_id = $1 where id = $2", [leader, akun]),
    "co-leader nonaktif seharusnya ditolak",
  );
  await terapkanSeed(db);
});

uji("pindah unit melepas akun yang dipegang", async () => {
  const akun = await akunId("@fashion_hijab");
  const pic = await id("Nabila Putri");
  const mcn = (await sebagaiAdmin(db, "select id from units where kode = 'mcn'")).rows[0].id;

  await sebagaiAdmin(db, "update users set unit_id = $1 where id = $2", [mcn, pic]);

  const { rows } = await sebagaiAdmin(db, "select pic_user_id from accounts where id = $1", [akun]);
  harusSama(rows[0].pic_user_id, null, "PIC lama harus dilepas saat pindah unit");
  harusSama(
    (await sebagaiAdmin(db, "select wajib_lapor_harian($1) w", [pic])).rows[0].w,
    false,
    "orang yang pindah unit tidak lagi ditagih laporan akun lama",
  );
  await terapkanSeed(db);
});

uji("pindah unit melepas tugas co-leader juga", async () => {
  const leader = await id("Dewi Lestari");
  const mcn = (await sebagaiAdmin(db, "select id from units where kode = 'mcn'")).rows[0].id;

  await sebagaiAdmin(db, "update users set unit_id = $1 where id = $2", [mcn, leader]);

  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int n from accounts where co_leader_id = $1",
    [leader],
  );
  harusSama(rows[0].n, 0, "tugas co-leader lintas unit harus dilepas");
  await terapkanSeed(db);
});

uji("akun unit baru tetap dipegang setelah pindah unit", async () => {
  // Pelepasan hanya menyasar akun yang tidak lagi se-unit; yang sah
  // ikut pindah bersama orangnya.
  const leader = await id("Dewi Lestari");
  const mcn = (await sebagaiAdmin(db, "select id from units where kode = 'mcn'")).rows[0].id;
  const akunMcn = (
    await sebagaiAdmin(db, "select id from accounts where unit_id = $1 limit 1", [mcn])
  ).rows[0];

  if (akunMcn) {
    await sebagaiAdmin(db, "update users set unit_id = $1 where id = $2", [mcn, leader]);
    await sebagaiAdmin(db, "update accounts set co_leader_id = $1 where id = $2", [
      leader,
      akunMcn.id,
    ]);
    await sebagaiAdmin(db, "update users set unit_id = $1 where id = $2", [mcn, leader]);
    const { rows } = await sebagaiAdmin(
      db,
      "select co_leader_id from accounts where id = $1",
      [akunMcn.id],
    );
    harusSama(rows[0].co_leader_id, leader, "akun se-unit tidak boleh ikut dilepas");
  }
  await terapkanSeed(db);
});

uji("Manager boleh menunjuk pimpinan unit sebagai co-leader", async () => {
  const akun = await akunId("@fashion_hijab");
  const leader = await id("Dewi Lestari");
  await sebagaiAdmin(db, "update accounts set co_leader_id = null where id = $1", [akun]);
  await sebagai(
    db,
    await id("Farhan Pratama"),
    "update accounts set co_leader_id = $1 where id = $2",
    [leader, akun],
  );
  harusSama(
    (await sebagaiAdmin(db, "select co_leader_id from accounts where id = $1", [akun]))
      .rows[0].co_leader_id,
    leader,
  );
  await terapkanSeed(db);
});

uji("co-leader melihat akun yang ia dampingi", async () => {
  // Inilah sebabnya kolom itu dijaga: isinya menentukan siapa yang melihat.
  const leader = await id("Dewi Lestari");
  const { rows } = await sebagai(
    db,
    leader,
    "select count(*)::int n from accounts where co_leader_id = $1",
    [leader],
  );
  harus(rows[0].n > 0, "co-leader harus bisa membaca akun dampingannya");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
