/**
 * Rekap kehadiran per orang (migrasi 0170): siapa wajib absen, hari
 * kerja mana yang ditagih, dan hari tanpa catatan yang tetap muncul.
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
const { uji, jalankan } = buatSuite("Rekap kehadiran per orang");

const idUser = async (n) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [n])).rows[0]
    .id;

const U = {
  ceo: await idUser("Hafidz Alkahfi"),
  manager: await idUser("Farhan Pratama"),
  leaderTap: await idUser("Dimas Maulana"),
  anisa: await idUser("Anisa Larasati"),
  eko: await idUser("Eko Prasetyo"),
};

const BULAN = ["2024-10-01", "2024-10-31"];

/** PGlite bisa mengembalikan kolom date sebagai Date; disamakan ke ISO. */
const iso = (t) =>
  t instanceof Date ? t.toISOString().slice(0, 10) : String(t).slice(0, 10);

const rekap = async (id, user = null, rentang = BULAN) =>
  (
    await sebagai(
      db,
      id,
      `select * from rekap_kehadiran_orang($1::date,$2::date,$3::uuid)`,
      [...rentang, user],
    )
  ).rows;

uji("hanya Leader ke bawah yang wajib absen", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select r::text as role, peran_wajib_absen(r) as wajib
       from unnest(enum_range(null::peran_pengguna)) r`,
  );
  const peta = Object.fromEntries(rows.map((r) => [r.role, r.wajib]));
  harusSama(peta.CEO, false);
  harusSama(peta.Manager, false);
  harusSama(peta.Finance, false);
  harusSama(peta.Leader, true);
  harusSama(peta["Co-Leader"], true);
  harusSama(peta.Staff, true);
});

uji("Minggu bukan hari kerja; Sabtu iya", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select hari_kerja_absensi('2024-10-27') as minggu,
            hari_kerja_absensi('2024-10-26') as sabtu`,
  );
  harusSama(rows[0].minggu, false);
  harusSama(rows[0].sabtu, true);
});

uji("Manager melihat hari tanpa catatan orang yang wajib absen", async () => {
  const r = await rekap(U.manager);
  const eko = r.filter((x) => x.user_id === U.eko);
  harus(eko.length > 3, `Eko hanya ${eko.length} hari`);
  harus(
    eko.every((x) => x.wajib_absen === true),
    "Staff wajib absen",
  );

  const kosong = eko.filter((x) => x.status === null);
  harus(kosong.length > 0, "hari kerja tanpa catatan harus tetap muncul");
  harus(
    kosong.every((x) => new Date(iso(x.tanggal)).getUTCDay() !== 0),
    "Minggu tidak ditagih",
  );

  // Tidak menagih hari sebelum absen pertamanya: ia belum dinilai saat itu.
  const pertama = eko
    .filter((x) => x.status !== null)
    .map((x) => iso(x.tanggal))
    .sort()[0];
  harus(
    kosong.every((x) => iso(x.tanggal) > pertama),
    "hari sebelum absen pertama tidak ditagih",
  );
});

uji(
  "CEO tidak ditagih: hanya hari yang ia catat sendiri yang tampil",
  async () => {
    const r = await rekap(U.manager);
    const ceo = r.filter((x) => x.user_id === U.ceo);
    harus(ceo.length > 0, "absen sukarela CEO tetap tampil");
    harus(
      ceo.every((x) => x.wajib_absen === false && x.status !== null),
      "tidak ada hari kosong bagi CEO",
    );
  },
);

uji("Staff hanya melihat dirinya sendiri", async () => {
  const r = await rekap(U.anisa);
  harusSama([...new Set(r.map((x) => x.user_id))], [U.anisa]);
  harus(r.length > 0, "dirinya sendiri harus terlihat");
});

uji("Leader TAP hanya melihat unit TAP", async () => {
  const r = await rekap(U.leaderTap);
  const unit = new Set(r.map((x) => x.unit_nama));
  harusSama([...unit], ["TAP"]);
  harus(
    r.some((x) => x.user_id === U.eko),
    "staf TAP yang tanpa catatan pun terlihat",
  );
});

uji("p_user membatasi ke satu orang", async () => {
  const r = await rekap(U.manager, U.anisa);
  harusSama([...new Set(r.map((x) => x.user_id))], [U.anisa]);
});

uji("hari yang belum datang tidak ditagih", async () => {
  const r = await rekap(U.manager, null, ["2030-01-01", "2030-01-31"]);
  harusSama(r.length, 0);
});

uji("status_tim_harian menyebut siapa yang wajib absen", async () => {
  const { rows } = await sebagai(
    db,
    U.manager,
    `select user_id, wajib_absen from status_tim_harian('2024-10-24')`,
  );
  harusSama(rows.find((r) => r.user_id === U.ceo).wajib_absen, false);
  harusSama(rows.find((r) => r.user_id === U.eko).wajib_absen, true);
});

// Libur ditambahkan paling akhir supaya tidak mengubah hitungan test lain.
uji(
  "libur perusahaan di kalender bukan hari kerja; libur satu unit tetap ditagih",
  async () => {
    const unit = (
      await sebagaiAdmin(db, `select id from units where kode = 'mcn'`)
    ).rows[0].id;
    await sebagai(
      db,
      U.manager,
      `insert into agenda (judul, jenis, tanggal, dibuat_oleh)
     values ('Cuti bersama', 'libur', '2024-10-29', $1)`,
      [U.manager],
    );
    await sebagai(
      db,
      U.manager,
      `insert into agenda (judul, jenis, tanggal, unit_id, dibuat_oleh)
     values ('Libur unit MCN', 'libur', '2024-10-30', $1, $2)`,
      [unit, U.manager],
    );
    const { rows } = await sebagaiAdmin(
      db,
      `select hari_kerja_absensi('2024-10-29') as bersama,
            hari_kerja_absensi('2024-10-30') as unit`,
    );
    harusSama(rows[0].bersama, false);
    harusSama(rows[0].unit, true);

    // Hari libur tidak lagi menjadi hari kosong bagi siapa pun.
    const r = await rekap(U.manager);
    harus(
      r.every((x) => !(iso(x.tanggal) === "2024-10-29" && x.status === null)),
      "cuti bersama tidak ditagih",
    );
  },
);

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
