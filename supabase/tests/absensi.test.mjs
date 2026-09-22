/** Absensi: validasi radius, keterlambatan, kunci absen pulang, izin/sakit. */
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
const { uji, jalankan } = buatSuite("Absensi");

const TGL = "2024-10-24";
const idUser = async (n) =>
  (await sebagaiAdmin(db, `select id from users where nama = $1`, [n])).rows[0].id;

const U = {
  manager: await idUser("Farhan Pratama"),
  rian: await idUser("Rian Hidayat"),     // sudah absen, BELUM lapor
  nabila: await idUser("Nabila Putri"),   // PIC @fashion_hijab, belum lapor hari ini
  eko: await idUser("Eko Prasetyo"),      // belum absen sama sekali
  yoga: await idUser("Yoga Saputra"),     // terlambat & di luar radius
};

uji("seed absensi idempoten", async () => {
  await terapkanSeed(db);
  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int n from attendance where tanggal = $1`,
    [TGL],
  );
  harusSama(Number(rows[0].n), 24);
});

uji("22 dari 25 staf tercatat check-in", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int n from attendance
     where tanggal = $1 and status in ('hadir','terlambat')`,
    [TGL],
  );
  harusSama(Number(rows[0].n), 22);
});

uji("keterlambatan dihitung otomatis dari jam masuk", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select terlambat, status from attendance where user_id = $1 and tanggal = $2`,
    [U.yoga, TGL],
  );
  harusSama(rows[0].terlambat, true, "Yoga masuk 08:47, melewati toleransi");
  harusSama(rows[0].status, "terlambat");
});

uji("absen tepat waktu tidak ditandai terlambat", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select terlambat from attendance where user_id = $1 and tanggal = $2`,
    [U.rian, TGL],
  );
  harusSama(rows[0].terlambat, false, "Rian masuk 07:48");
});

uji("lokasi di luar radius ditandai tidak valid", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select lokasi_valid, jarak_masuk_m from attendance
     where user_id = $1 and tanggal = $2`,
    [U.yoga, TGL],
  );
  harusSama(rows[0].lokasi_valid, false, "Yoga absen ~450 m dari kantor");
  harus(Number(rows[0].jarak_masuk_m) > 150, "jarak harus di atas radius");
});

uji("lokasi di dalam radius ditandai valid", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select lokasi_valid from attendance where user_id = $1 and tanggal = $2`,
    [U.rian, TGL],
  );
  harusSama(rows[0].lokasi_valid, true);
});

uji("absen pulang TERKUNCI sebelum laporan harian terkirim", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select wajib_lapor_harian($1) w, sudah_lapor_harian($1, $2::date) l`,
    [U.nabila, TGL],
  );
  harusSama(rows[0].w, true, "prasyarat: Nabila wajib lapor");
  harusSama(rows[0].l, false, "prasyarat: Nabila belum lapor");

  await harusDitolak(
    () =>
      sebagai(
        db,
        U.nabila,
        `update attendance set jam_pulang = now()
         where user_id = $1 and tanggal = $2`,
        [U.nabila, TGL],
      ),
    "absen pulang seharusnya ditolak sebelum lapor",
  );
});

uji("absen pulang terbuka setelah laporan harian masuk", async () => {
  // Rian PIC akun; laporannya sudah ada di seed untuk tanggal ini.
  const { rows } = await sebagaiAdmin(
    db,
    `select sudah_lapor_harian($1, $2::date) as lapor`,
    [U.rian, TGL],
  );
  harusSama(rows[0].lapor, true, "prasyarat: Rian sudah lapor");

  await sebagai(
    db,
    U.rian,
    `update attendance set jam_pulang = now() where user_id = $1 and tanggal = $2`,
    [U.rian, TGL],
  );
  const { rows: sesudah } = await sebagaiAdmin(
    db,
    `select jam_pulang from attendance where user_id = $1 and tanggal = $2`,
    [U.rian, TGL],
  );
  harus(sesudah[0].jam_pulang, "jam_pulang harus tersimpan");
});

uji("izin tanpa alasan ditolak", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into attendance (user_id, tanggal, status, persetujuan)
         values ($1, '2024-10-29', 'izin', 'diajukan')`,
        [U.eko],
      ),
    "constraint attendance_izin_beralasan tidak bekerja",
  );
});

uji("izin dengan alasan & pengajuan diterima", async () => {
  await sebagaiAdmin(
    db,
    `insert into attendance (user_id, tanggal, status, alasan, persetujuan)
     values ($1, '2024-10-29', 'izin', 'Ada keperluan keluarga mendesak.', 'diajukan')`,
    [U.eko],
  );
});

uji("tidak bisa absen dua kali di tanggal sama", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into attendance (user_id, tanggal, jam_masuk)
         values ($1, $2, now())`,
        [U.rian, TGL],
      ),
    "unique (user_id, tanggal) tidak bekerja",
  );
});

uji("Staff tidak bisa absen atas nama orang lain", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.rian,
        `insert into attendance (user_id, tanggal, jam_masuk)
         values ($1, '2024-10-26', now())`,
        [U.yoga],
      ),
    "policy attendance_masuk seharusnya menolak",
  );
});

uji("status_tim_harian melaporkan 25 orang dengan status laporannya", async () => {
  const { rows } = await sebagai(
    db,
    U.manager,
    `select * from status_tim_harian($1::date)`,
    [TGL],
  );
  harusSama(rows.length, 25, "semua anggota aktif harus muncul");
  const eko = rows.find((r) => r.nama === "Eko Prasetyo");
  harusSama(eko.status, "alpa", "yang belum absen berstatus alpa");
  const belumLapor = rows.filter(
    (r) => !r.sudah_lapor && ["hadir", "terlambat"].includes(r.status),
  );
  harus(belumLapor.length > 0, "harus ada yang belum lapor untuk ditagih");
});

uji("yang TIDAK wajib lapor boleh absen pulang tanpa laporan", async () => {
  // Anisa staf Affiliator tanpa akun — ia tidak punya sasaran laporan,
  // jadi kunci absen pulang tidak boleh berlaku untuknya.
  const anisa = await idUser("Anisa Larasati");
  const { rows } = await sebagaiAdmin(
    db,
    `select wajib_lapor_harian($1) w, sudah_lapor_harian($1, $2::date) l`,
    [anisa, TGL],
  );
  harusSama(rows[0].w, false, "prasyarat: Anisa tidak wajib lapor");
  harusSama(rows[0].l, false, "prasyarat: Anisa memang belum lapor");

  await sebagai(
    db,
    anisa,
    `update attendance set jam_pulang = now() where user_id=$1 and tanggal=$2`,
    [anisa, TGL],
  );
  const { rows: sesudah } = await sebagaiAdmin(
    db,
    `select jam_pulang from attendance where user_id=$1 and tanggal=$2`,
    [anisa, TGL],
  );
  harus(sesudah[0].jam_pulang, "absen pulang seharusnya diizinkan");
});

uji("hanya PIC akun & Leader unit yang wajib lapor", async () => {
  const { rows } = await sebagai(
    db,
    U.manager,
    `select nama, wajib_lapor, sudah_lapor from status_tim_harian($1::date)`,
    [TGL],
  );
  const wajib = rows.filter((r) => r.wajib_lapor);
  harusSama(wajib.length, 7, "5 PIC akun + Leader MCN + Leader TAP");
  const belum = wajib.filter((r) => !r.sudah_lapor).map((r) => r.nama);
  harusSama(belum, ["Nabila Putri"], "tepat satu sasaran belum lapor");
  const tidakWajib = rows.find((r) => r.nama === "Anisa Larasati");
  harusSama(tidakWajib.wajib_lapor, false, "staf tanpa akun tidak wajib lapor");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
