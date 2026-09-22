/** Pengajuan izin/sakit: kewenangan memutus dan jejak persetujuannya. */
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
const { uji, jalankan } = buatSuite("Izin & sakit");

const idUser = async (n) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [n])).rows[0].id;

const U = {
  manager: await idUser("Farhan Pratama"),
  leaderTap: await idUser("Dimas Maulana"),
  leaderMcn: await idUser("Galih Prakoso"),
  eko: await idUser("Eko Prasetyo"), // staf TAP, atasan Dimas
  anisa: await idUser("Anisa Larasati"),
};

const ajuan = async () =>
  (
    await sebagaiAdmin(
      db,
      `select id, user_id from attendance
       where persetujuan = 'diajukan' and user_id = $1`,
      [U.eko],
    )
  ).rows[0];

uji("seed memuat pengajuan yang menunggu keputusan", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int n from attendance where persetujuan = 'diajukan'`,
  );
  harus(Number(rows[0].n) >= 2, "harus ada pengajuan tertunda untuk diuji");
});

uji("staf bisa mengajukan izin untuk dirinya", async () => {
  await sebagai(
    db,
    U.anisa,
    `insert into attendance (user_id, tanggal, status, alasan, persetujuan)
     values ($1, '2024-11-04', 'izin', 'Menghadiri wisuda adik di luar kota.', 'diajukan')`,
    [U.anisa],
  );
});

uji("staf tidak bisa mengajukan izin atas nama orang lain", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.anisa,
        `insert into attendance (user_id, tanggal, status, alasan, persetujuan)
         values ($1, '2024-11-05', 'izin', 'Pengajuan palsu untuk rekan.', 'diajukan')`,
        [U.eko],
      ),
    "policy attendance_masuk seharusnya menolak",
  );
});

uji("atasan langsung bisa menyetujui pengajuan bawahannya", async () => {
  const a = await ajuan();
  await sebagai(
    db,
    U.leaderTap,
    `update attendance
       set persetujuan='disetujui', disetujui_oleh=$2, disetujui_pada=now()
     where id=$1`,
    [a.id, U.leaderTap],
  );

  const { rows } = await sebagaiAdmin(
    db,
    `select persetujuan, disetujui_oleh, disetujui_pada from attendance where id=$1`,
    [a.id],
  );
  harusSama(rows[0].persetujuan, "disetujui");
  harusSama(rows[0].disetujui_oleh, U.leaderTap, "pemutus tercatat");
  harus(rows[0].disetujui_pada, "waktu keputusan tercatat");
});

uji("Leader unit lain tidak melihat & tidak bisa memutus", async () => {
  // Ajukan izin untuk staf TAP; Leader MCN tidak boleh menyentuhnya.
  await sebagai(
    db,
    U.eko,
    `insert into attendance (user_id, tanggal, status, alasan, persetujuan)
     values ($1, '2024-11-07', 'izin', 'Mengurus surat kendaraan.', 'diajukan')`,
    [U.eko],
  );
  const baris = (
    await sebagaiAdmin(
      db,
      `select id from attendance where user_id=$1 and tanggal='2024-11-07'`,
      [U.eko],
    )
  ).rows[0];

  // Tidak terlihat.
  const { rows: terlihat } = await sebagai(
    db,
    U.leaderMcn,
    `select count(*)::int n from attendance where id=$1`,
    [baris.id],
  );
  harusSama(Number(terlihat[0].n), 0, "Leader MCN seharusnya tidak melihatnya");

  // Karena itu, update-nya tidak mengenai baris mana pun.
  await sebagai(
    db,
    U.leaderMcn,
    `update attendance set persetujuan='ditolak' where id=$1`,
    [baris.id],
  );
  const { rows: sesudah } = await sebagaiAdmin(
    db,
    `select persetujuan from attendance where id=$1`,
    [baris.id],
  );
  harusSama(
    sesudah[0].persetujuan,
    "diajukan",
    "keputusan Leader unit lain tidak boleh berlaku",
  );
});

uji("Staff tidak melihat pengajuan rekan lintas unit", async () => {
  const { rows } = await sebagai(
    db,
    U.anisa,
    `select count(*)::int n from attendance
     where persetujuan is not null and user_id <> $1`,
    [U.anisa],
  );
  harusSama(
    Number(rows[0].n),
    0,
    "Staff hanya boleh melihat pengajuannya sendiri",
  );
});

uji("izin tanpa alasan tetap ditolak walau lewat atasan", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into attendance (user_id, tanggal, status, alasan, persetujuan)
         values ($1, '2024-11-06', 'sakit', 'ok', 'diajukan')`,
        [U.anisa],
      ),
    "constraint panjang alasan tidak bekerja",
  );
});

uji("izin yang disetujui tidak dihitung sebagai check-in", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int n from attendance
     where tanggal = '2024-10-24' and status in ('hadir','terlambat')`,
  );
  harusSama(Number(rows[0].n), 22, "izin & sakit tidak menambah kehadiran");
});

uji("pengaju tidak bisa menyetujui izinnya sendiri", async () => {
  await sebagai(
    db,
    U.anisa,
    `insert into attendance (user_id, tanggal, status, alasan, persetujuan)
     values ($1, '2024-11-12', 'izin', 'Mengurus keperluan pribadi.', 'diajukan')`,
    [U.anisa],
  );
  const baris = (
    await sebagaiAdmin(
      db,
      `select id from attendance where user_id=$1 and tanggal='2024-11-12'`,
      [U.anisa],
    )
  ).rows[0];

  await harusDitolak(
    () =>
      sebagai(
        db,
        U.anisa,
        `update attendance set persetujuan='disetujui' where id=$1`,
        [baris.id],
      ),
    "seharusnya tidak bisa menyetujui pengajuan sendiri",
  );
});

uji("pengaju tetap boleh membatalkan dengan mengubah alasannya", async () => {
  const baris = (
    await sebagaiAdmin(
      db,
      `select id from attendance where user_id=$1 and tanggal='2024-11-12'`,
      [U.anisa],
    )
  ).rows[0];

  await sebagai(
    db,
    U.anisa,
    `update attendance set alasan='Batal, ternyata bisa masuk.' where id=$1`,
    [baris.id],
  );
  const { rows } = await sebagaiAdmin(
    db,
    `select alasan, persetujuan from attendance where id=$1`,
    [baris.id],
  );
  harus(rows[0].alasan.startsWith("Batal"), "alasan boleh diperbarui");
  harusSama(rows[0].persetujuan, "diajukan", "statusnya tidak ikut berubah");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
