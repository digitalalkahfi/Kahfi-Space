/**
 * Rekap terpenuhi per akun: SQL harus sepakat dengan fungsi murni.
 *
 * Aturannya hidup di dua tempat — `rekapMinimumPerAkun` untuk halaman
 * riwayat dan `rekap_minimum_akun` untuk rekap massal. Berkas ini
 * membaca fakta yang sama lewat kedua jalur lalu membandingkannya.
 *
 * Ini pertanyaan yang BERBEDA dari `kepatuhan_minimum_akun`: yang ini
 * hanya menghitung hari yang dilaporkan, yang itu menghitung hari kerja.
 */
import { rekapMinimumPerAkun, rekapMinimumPerOrang } from "@/lib/rekap-minimum";
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
const { uji, jalankan } = buatSuite("Rekap batas minimum per akun");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  farhan: (await satu(`select id from users where nama='Farhan Pratama'`)).id,
  rian: (await satu(`select id from users where nama='Rian Hidayat'`)).id,
};
const A = {
  skincare: (
    await satu(`select id from accounts where username='@skincare_official'`)
  ).id,
};

const DARI = "2024-10-01";
const SAMPAI = "2024-10-24";

const dariSql = async (userId = U.farhan) =>
  (
    await sebagai(db, userId, `select * from rekap_minimum_akun($1,$2)`, [
      DARI,
      SAMPAI,
    ])
  ).rows;

/** Fakta mentah yang sama, dibaca ulang dari view-nya. */
const faktaMentah = async (userId = U.farhan) => {
  const { rows } = await sebagai(
    db,
    userId,
    `select account_id, akun_username, pelapor_nama, jumlah_upload,
            minimum_unggahan
       from riwayat_laporan_minimum
      where tanggal between $1 and $2`,
    [DARI, SAMPAI],
  );
  return rows.map((r) => ({
    akunId: r.account_id,
    label: r.akun_username ?? "—",
    pelaporNama: r.pelapor_nama ?? "—",
    jumlahUpload: r.jumlah_upload,
    minimumUpload: r.minimum_unggahan,
  }));
};

const dariFungsi = async (userId = U.farhan) =>
  rekapMinimumPerAkun(await faktaMentah(userId));

uji("SQL dan fungsi murni menghasilkan angka yang sama", async () => {
  const sql = await dariSql();
  const murni = await dariFungsi();

  harus(sql.length > 0, "seed harus punya akun berlevel yang melapor");
  harusSama(
    sql.map((r) => [
      r.username,
      r.minimum,
      r.laporan,
      r.terpenuhi,
      r.kurang_terdalam,
    ]),
    murni.map((r) => [
      r.label,
      r.minimum,
      r.laporan,
      r.terpenuhi,
      r.kurangTerdalam,
    ]),
  );
  harusSama(
    sql.map((r) => Number(r.rasio)),
    murni.map((r) => Number(r.rasio.toFixed(1))),
  );
});

uji("yang paling bermasalah tampil lebih dulu", async () => {
  const rasio = (await dariSql()).map((r) => Number(r.rasio));
  harusSama(
    rasio,
    [...rasio].sort((a, b) => a - b),
    "urutannya menaik, bukan kebetulan",
  );
});

uji("tepat di batas sudah dianggap terpenuhi", async () => {
  await sebagaiAdmin(db, `update accounts set level = 0 where id = $1`, [
    A.skincare,
  ]);
  await sebagaiAdmin(
    db,
    `update daily_reports set jumlah_upload = 3
      where account_id = $1 and tanggal between $2 and $3`,
    [A.skincare, DARI, SAMPAI],
  );

  const b = (await dariSql()).find((r) => r.account_id === A.skincare);
  harusSama(b.minimum, 3);
  harusSama(b.terpenuhi, b.laporan, "semuanya tepat di batas");
  harusSama(Number(b.rasio), 100);
  harusSama(b.kurang_terdalam, 0);
});

uji("akun tanpa level tidak muncul sama sekali", async () => {
  await sebagaiAdmin(db, `update accounts set level = null where id = $1`, [
    A.skincare,
  ]);
  harus(
    (await dariSql()).every((r) => r.account_id !== A.skincare),
    "tanpa standar tidak ada yang bisa dilanggar",
  );
});

uji("laporan unit tidak pernah ikut terhitung", async () => {
  harus(
    (await dariSql()).every((r) => r.account_id !== null),
    "MCN & TAP tidak punya kolom unggahan",
  );
});

uji("rekap ikut aturan baca pemanggilnya", async () => {
  const staf = await dariSql(U.rian);
  const manajemen = await dariSql(U.farhan);
  harus(
    staf.length < manajemen.length,
    `Staff hanya merekap akunnya sendiri (${staf.length} vs ${manajemen.length})`,
  );
});

uji("rentang di luar data menghasilkan rekap kosong", async () => {
  const { rows } = await sebagai(
    db,
    U.farhan,
    `select * from rekap_minimum_akun('2023-01-01','2023-01-31')`,
  );
  harusSama(rows.length, 0, "kosong, bukan baris nol yang menyesatkan");
});

uji("rekap per orang sepakat dengan fungsi murni", async () => {
  const { rows } = await sebagai(
    db,
    U.farhan,
    `select * from rekap_minimum_orang($1,$2)`,
    [DARI, SAMPAI],
  );
  const murni = rekapMinimumPerOrang(await faktaMentah(U.farhan));

  harus(rows.length > 0, "seed harus punya pelapor berlevel");
  harusSama(
    rows.map((r) => [r.pelapor_nama, r.minimum, r.laporan, r.terpenuhi]),
    murni.map((r) => [r.label, r.minimum, r.laporan, r.terpenuhi]),
  );
});

uji("orang dengan akun beda level tidak dipaksa punya satu batas", async () => {
  // Rian memegang @skincare_official dan @beauty_daily.id; dibuat
  // berbeda level supaya keadaan ini benar-benar terjadi.
  await sebagaiAdmin(
    db,
    `update accounts set level = 0 where username = '@skincare_official'`,
  );
  await sebagaiAdmin(
    db,
    `update accounts set level = 5 where username = '@beauty_daily.id'`,
  );

  const { rows } = await sebagai(
    db,
    U.farhan,
    `select * from rekap_minimum_orang($1,$2)`,
    [DARI, SAMPAI],
  );
  const rian = rows.find((r) => r.pelapor_nama === "Rian Hidayat");
  harusSama(rian.akun, 2);
  harusSama(rian.minimum, null, "tidak ada satu angka yang jujur disebut");
});

uji("penyaring menilai akun sepanjang rentang, bukan per baris", async () => {
  const semua = await dariSql();
  const { rows: kurang } = await sebagai(
    db,
    U.farhan,
    `select * from rekap_minimum_akun($1,$2,true)`,
    [DARI, SAMPAI],
  );

  harus(kurang.length < semua.length, "ada yang disembunyikan");
  harus(
    kurang.every((r) => r.terpenuhi < r.laporan),
    "yang tersisa memang pernah kurang",
  );
  // Inilah yang mudah salah: kalau penyaringnya dipasang per baris,
  // penyebutnya ikut menyusut dan semua akun terbaca 0%.
  harusSama(
    kurang.map((r) => [r.username, r.laporan, r.terpenuhi]),
    semua
      .filter((r) => r.terpenuhi < r.laporan)
      .map((r) => [r.username, r.laporan, r.terpenuhi]),
    "angka yang tersisa tidak ikut berubah karena disaring",
  );
});

uji("penyaring per orang bekerja dengan aturan yang sama", async () => {
  const { rows: kurang } = await sebagai(
    db,
    U.farhan,
    `select * from rekap_minimum_orang($1,$2,true)`,
    [DARI, SAMPAI],
  );
  harus(kurang.length > 0, "ada orang yang pernah kurang di seed");
  harus(
    kurang.every((r) => r.terpenuhi < r.laporan),
    "yang tersisa memang pernah kurang",
  );
});

uji("tanpa penyaring, rekapnya tetap utuh", async () => {
  const { rows } = await sebagai(
    db,
    U.farhan,
    `select count(*)::int as n from rekap_minimum_akun($1,$2)`,
    [DARI, SAMPAI],
  );
  harusSama(
    rows[0].n,
    (await dariSql()).length,
    "default-nya tidak menyembunyikan apa pun",
  );
});

await jalankan();
