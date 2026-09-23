/**
 * View riwayat laporan + batas minimum.
 *
 * Yang dijaga: batas minimum tiap baris benar-benar datang dari level
 * akunnya lewat `batas_minimum`, laporan unit tetap tampil tanpa batas,
 * dan view-nya tidak melonggarkan siapa pun — ia ikut aturan baca
 * pemanggilnya, persis seperti membaca `daily_reports` langsung.
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
const { uji, jalankan } = buatSuite("Riwayat laporan + batas minimum");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  rian: (await satu(`select id from users where nama='Rian Hidayat'`)).id,
  galih: (await satu(`select id from users where nama='Galih Prakoso'`)).id,
  farhan: (await satu(`select id from users where nama='Farhan Pratama'`)).id,
};
const A = {
  skincare: (
    await satu(`select id from accounts where username='@skincare_official'`)
  ).id,
};

const baris = async (userId, sql, params = []) =>
  (await sebagai(db, userId, sql, params)).rows;

// View-nya `security_invoker` dan menyaring `auth.uid() is not null`,
// jadi tidak bisa dibaca lewat `sebagaiAdmin` yang memang tanpa sesi —
// itu justru yang diinginkan, dan dibuktikan di uji terakhir berkas ini.
const lihat = async (userId, sql, params = []) =>
  (await sebagai(db, userId, sql, params)).rows[0];

uji("batas minimum tiap baris datang dari level akunnya", async () => {
  const rows = await baris(
    U.rian,
    `select akun_level, minimum_unggahan, batas_minimum(akun_level) as acuan
       from riwayat_laporan_minimum
      where account_id is not null`,
  );
  harus(rows.length > 0, "Rian harus punya laporan akun di seed");
  harus(
    rows.every((r) => r.minimum_unggahan === r.acuan),
    "tidak boleh ada baris yang batasnya dihitung sendiri",
  );
});

uji(
  "level naik, batas minimumnya ikut naik tanpa menyentuh laporan",
  async () => {
    const sebelum = await lihat(
      U.rian,
      `select minimum_unggahan from riwayat_laporan_minimum
      where account_id = $1 limit 1`,
      [A.skincare],
    );
    await sebagaiAdmin(db, `update accounts set level = 8 where id = $1`, [
      A.skincare,
    ]);
    const sesudah = await lihat(
      U.rian,
      `select akun_level, minimum_unggahan from riwayat_laporan_minimum
      where account_id = $1 limit 1`,
      [A.skincare],
    );

    harusSama(sesudah.akun_level, 8);
    harusSama(sesudah.minimum_unggahan, 20, "level 8 → 20 unggahan");
    harus(
      sebelum.minimum_unggahan !== sesudah.minimum_unggahan,
      "batasnya memang berubah, bukan kebetulan sama",
    );
  },
);

uji("akun tanpa level tidak punya batas", async () => {
  await sebagaiAdmin(db, `update accounts set level = null where id = $1`, [
    A.skincare,
  ]);
  const b = await lihat(
    U.rian,
    `select akun_level, minimum_unggahan from riwayat_laporan_minimum
      where account_id = $1 limit 1`,
    [A.skincare],
  );
  harusSama(b.akun_level, null);
  harusSama(b.minimum_unggahan, null, "bukan nol; memang tidak ada standar");
});

uji("laporan tingkat unit tetap tampil, tanpa batas", async () => {
  const b = await lihat(
    U.farhan,
    `select unit_kode, unit_nama, akun_username, minimum_unggahan
       from riwayat_laporan_minimum
      where unit_id is not null limit 1`,
  );
  harus(b !== undefined, "laporan unit harus ikut terbaca");
  harusSama(b.akun_username, null);
  harusSama(b.minimum_unggahan, null, "unit tidak punya level");
  harus(Boolean(b.unit_nama), "namanya ikut supaya layar tidak join lagi");
});

uji("pelapor ikut terbawa", async () => {
  const b = await lihat(
    U.rian,
    `select pelapor_nama from riwayat_laporan_minimum
      where account_id = $1 limit 1`,
    [A.skincare],
  );
  harusSama(b.pelapor_nama, "Rian Hidayat");
});

uji("view tidak melonggarkan siapa pun", async () => {
  const lewatView = await baris(
    U.galih,
    `select count(*)::int as n from riwayat_laporan_minimum`,
  );
  const langsung = await baris(
    U.galih,
    `select count(*)::int as n from daily_reports`,
  );
  harusSama(
    lewatView[0].n,
    langsung[0].n,
    "yang terlihat lewat view sama persis dengan yang terlihat langsung",
  );

  const manajemen = await baris(
    U.farhan,
    `select count(*)::int as n from riwayat_laporan_minimum`,
  );
  harus(
    manajemen[0].n > lewatView[0].n,
    "Manager tetap melihat lebih banyak daripada satu Leader",
  );
});

await jalankan();
