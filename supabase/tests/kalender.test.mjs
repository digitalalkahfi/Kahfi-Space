/** Kalender: cakupan baca, wewenang mengatur, dan agenda milik sendiri. */
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
const { uji, jalankan } = buatSuite("Kalender");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const unitId = async (kode) =>
  (await sebagaiAdmin(db, "select id from units where kode = $1", [kode]))
    .rows[0].id;

uji("agenda unit lain tetap terlihat", async () => {
  // Rapat yang bentrok baru bisa dihindari kalau jadwalnya saling terlihat.
  const { rows } = await sebagai(
    db,
    await id("Rian Hidayat"),
    "select count(*)::int n from agenda",
  );
  const { rows: semua } = await sebagaiAdmin(db, "select count(*)::int n from agenda");
  harusSama(rows[0].n, semua[0].n);
});

uji("Staff tidak bisa membuat agenda", async () => {
  const orang = await id("Rian Hidayat");
  await harusDitolak(
    () =>
      sebagai(
        db,
        orang,
        "insert into agenda (judul, tanggal, dibuat_oleh) values ('Agenda dari staf', '2024-11-05', $1)",
        [orang],
      ),
    "Staff seharusnya tidak bisa membuat agenda",
  );
});

uji("Leader bisa membuat agenda unitnya", async () => {
  const dewi = await id("Dewi Lestari");
  await sebagai(
    db,
    dewi,
    "insert into agenda (judul, tanggal, unit_id, dibuat_oleh) values ('Briefing unit affiliator', '2024-11-06', $1, $2)",
    [await unitId("affiliator"), dewi],
  );
  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int n from agenda where judul = 'Briefing unit affiliator'",
  );
  harusSama(rows[0].n, 1);
});

uji("Leader tidak bisa membuat agenda unit lain", async () => {
  const dewi = await id("Dewi Lestari");
  await harusDitolak(
    async () =>
      sebagai(
        db,
        dewi,
        "insert into agenda (judul, tanggal, unit_id, dibuat_oleh) values ('Agenda unit MCN dari Dewi', '2024-11-07', $1, $2)",
        [await unitId("mcn"), dewi],
      ),
    "Leader seharusnya tidak bisa membuat agenda unit lain",
  );
});

uji("pembuat bisa membetulkan agendanya sendiri", async () => {
  // Salah ketik jam pada agenda sendiri tidak seharusnya perlu meminta
  // tolong Manager.
  const dewi = await id("Dewi Lestari");
  await sebagai(
    db,
    dewi,
    "update agenda set jam_mulai = '10:00' where judul = 'Briefing unit affiliator'",
  );
  const { rows } = await sebagaiAdmin(
    db,
    "select jam_mulai from agenda where judul = 'Briefing unit affiliator'",
  );
  harus(String(rows[0].jam_mulai).startsWith("10:00"), "jam mulai harus berubah");
});

uji("pembuat bisa menghapus agendanya sendiri", async () => {
  await sebagai(
    db,
    await id("Dewi Lestari"),
    "delete from agenda where judul = 'Briefing unit affiliator'",
  );
  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int n from agenda where judul = 'Briefing unit affiliator'",
  );
  harusSama(rows[0].n, 0);
});

uji("Staff tidak bisa menghapus agenda orang lain", async () => {
  await sebagai(
    db,
    await id("Rian Hidayat"),
    "delete from agenda where judul like 'Rapat mingguan WRM%'",
  );
  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int n from agenda where judul like 'Rapat mingguan WRM%'",
  );
  harus(rows[0].n > 0, "agenda orang lain seharusnya tetap ada");
});

uji("jam selesai sebelum jam mulai ditolak", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "insert into agenda (judul, tanggal, jam_mulai, jam_selesai) values ('Rapat terbalik', '2024-11-08', '15:00', '14:00')",
      ),
    "jam selesai sebelum mulai seharusnya ditolak",
  );
});

uji("agenda sepanjang hari tanpa jam diterima", async () => {
  await sebagaiAdmin(
    db,
    "insert into agenda (judul, tanggal, jenis) values ('Libur bersama', '2024-12-25', 'libur')",
  );
  const { rows } = await sebagaiAdmin(
    db,
    "select jam_mulai, jam_selesai from agenda where judul = 'Libur bersama'",
  );
  harusSama(rows[0].jam_mulai, null);
  harusSama(rows[0].jam_selesai, null);
});

uji("agenda bentrok tetap tersimpan — datanya tidak menolak", async () => {
  // Dua acara pada jam yang sama kadang disengaja; menolaknya akan
  // membuat orang mencatat di tempat lain. Peringatannya urusan layar.
  const manajer = (
    await sebagaiAdmin(db, "select id from users where nama = 'Farhan Pratama'")
  ).rows[0].id;

  for (const judul of ["Rapat A", "Rapat B"]) {
    await sebagai(
      db,
      manajer,
      `insert into agenda (judul, jenis, tanggal, jam_mulai, jam_selesai, dibuat_oleh)
       values ($1, 'rapat', '2024-11-11', '09:00', '10:00', $2)`,
      [judul, manajer],
    );
  }

  harusSama(
    Number(
      (await sebagaiAdmin(
        db,
        "select count(*)::int n from agenda where tanggal = '2024-11-11'",
      )).rows[0].n,
    ),
    2,
  );
});

uji("jam selesai sebelum jam mulai ditolak database", async () => {
  const manajer = (
    await sebagaiAdmin(db, "select id from users where nama = 'Farhan Pratama'")
  ).rows[0].id;
  await harusDitolak(
    async () =>
      sebagai(
        db,
        manajer,
        `insert into agenda (judul, jenis, tanggal, jam_mulai, jam_selesai, dibuat_oleh)
         values ('Terbalik', 'rapat', '2024-11-12', '10:00', '09:00', $1)`,
        [manajer],
      ),
    "jam terbalik seharusnya ditolak",
  );
  await terapkanSeed(db);
});

uji("pembuat agenda boleh membetulkan jamnya sendiri", async () => {
  const leader = (
    await sebagaiAdmin(db, "select id from users where nama = 'Dewi Lestari'")
  ).rows[0].id;
  const unit = (
    await sebagaiAdmin(db, "select id from units where kode = 'affiliator'")
  ).rows[0].id;

  const agenda = (
    await sebagai(
      db,
      leader,
      `insert into agenda (judul, jenis, tanggal, jam_mulai, jam_selesai, unit_id, dibuat_oleh)
       values ('Briefing unit', 'rapat', '2024-11-20', '08:00', '09:00', $1, $2)
       returning id`,
      [unit, leader],
    )
  ).rows[0].id;

  await sebagai(db, leader, "update agenda set jam_mulai = '08:30' where id = $1", [
    agenda,
  ]);
  harusSama(
    (await sebagaiAdmin(db, "select jam_mulai from agenda where id = $1", [agenda]))
      .rows[0].jam_mulai,
    "08:30:00",
  );
});

uji("agenda tidak bisa dipindahkan ke unit lain oleh pemimpin unit", async () => {
  // Agenda unit lain ikut menutup jam tim yang tidak pernah diajak bicara.
  const leader = (
    await sebagaiAdmin(db, "select id from users where nama = 'Dewi Lestari'")
  ).rows[0].id;
  const mcn = (await sebagaiAdmin(db, "select id from units where kode = 'mcn'"))
    .rows[0].id;
  const agenda = (
    await sebagaiAdmin(db, "select id from agenda where judul = 'Briefing unit'")
  ).rows[0].id;

  await harusDitolak(
    async () => sebagai(db, leader, "update agenda set unit_id = $1 where id = $2", [mcn, agenda]),
    "pemindahan ke unit lain seharusnya ditolak",
  );
});

uji("Manager tetap bisa memindahkan agenda antar unit", async () => {
  const manajer = (
    await sebagaiAdmin(db, "select id from users where nama = 'Farhan Pratama'")
  ).rows[0].id;
  const mcn = (await sebagaiAdmin(db, "select id from units where kode = 'mcn'"))
    .rows[0].id;
  const agenda = (
    await sebagaiAdmin(db, "select id from agenda where judul = 'Briefing unit'")
  ).rows[0].id;

  await sebagai(db, manajer, "update agenda set unit_id = $1 where id = $2", [
    mcn,
    agenda,
  ]);
  harusSama(
    (await sebagaiAdmin(db, "select unit_id from agenda where id = $1", [agenda]))
      .rows[0].unit_id,
    mcn,
  );
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
