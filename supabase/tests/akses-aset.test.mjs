/**
 * Hak akses aset mengikuti hierarki (migrasi 0176).
 *
 * Staff: aset yang ia pegang. Leader & Co-Leader: aset yang dipegang
 * dirinya atau orang di bawahnya, ditambah aset unitnya yang belum
 * dipegang siapa pun. CEO, Manager, Finance: semua, dengan rupiah.
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
const { uji, jalankan } = buatSuite("Akses aset");

const id = async (nama) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [nama])).rows[0]
    .id;

const U = {
  ceo: await id("Hafidz Alkahfi"),
  manager: await id("Farhan Pratama"),
  finance: await id("Laras Ayuningtyas"),
  rian: await id("Rian Hidayat"), // Staff Affiliator, pegang AST-0006
  fajar: await id("Fajar Ramadhan"), // Staff MCN, pegang AST-0001
  maya: await id("Maya Safitri"), // Co-Leader MCN, pegang AST-0009
  galih: await id("Galih Prakoso"), // Leader MCN, pegang AST-0002
  dewi: await id("Dewi Lestari"), // Leader Affiliator, pegang AST-0003
  dimas: await id("Dimas Maulana"), // Leader TAP, pegang AST-0004
};

const kode = async (siapa, sumber = "aset_publik") =>
  (
    await sebagai(db, siapa, `select kode from ${sumber} order by kode`)
  ).rows.map((r) => r.kode);

const semua = (
  await sebagaiAdmin(db, `select kode from assets order by kode`)
).rows.map((r) => r.kode);

uji("Staff hanya melihat aset yang ia pegang", async () => {
  harusSama(await kode(U.rian), ["AST-0006"]);
  harusSama(await kode(U.fajar), ["AST-0001"]);
});

uji(
  "Co-Leader: miliknya dan aset unit yang belum dipegang siapa pun",
  async () => {
    harusSama(await kode(U.maya), ["AST-0005", "AST-0009", "AST-0012"]);
  },
);

uji("Leader: seluruh cabangnya dan aset unit tanpa pemegang", async () => {
  harusSama(await kode(U.galih), [
    "AST-0001", // Fajar, bawahannya
    "AST-0002", // miliknya
    "AST-0005", // cadangan unit MCN
    "AST-0009", // Maya, Co-Leader di bawahnya
    "AST-0012", // dipakai unit MCN tanpa pemegang
  ]);
  harusSama(
    await kode(U.dewi),
    ["AST-0003", "AST-0006", "AST-0010"],
    "termasuk laptop hilang atas nama bawahan yang sudah nonaktif",
  );
  harusSama(await kode(U.dimas), ["AST-0004", "AST-0008"]);
});

uji(
  "tidak ada yang melihat aset unit lain atau aset perusahaan tanpa pemegang",
  async () => {
    for (const siapa of [U.rian, U.fajar, U.maya, U.galih, U.dewi, U.dimas]) {
      const k = await kode(siapa);
      harus(
        !k.includes("AST-0007"),
        "aset perusahaan tanpa pemegang hanya untuk pusat",
      );
      harus(
        !k.includes("AST-0011"),
        "aset yang sudah dilepas tanpa pemegang pun sama",
      );
    }
    harus(
      !(await kode(U.dewi)).includes("AST-0001"),
      "Leader Affiliator tidak melihat aset MCN",
    );
  },
);

uji("CEO, Manager, dan Finance melihat semua, termasuk rupiahnya", async () => {
  for (const siapa of [U.ceo, U.manager, U.finance]) {
    harusSama(await kode(siapa), semua, "daftar tanpa rupiah lengkap");
    harusSama(await kode(siapa, "assets"), semua, "tabel ber-rupiah lengkap");
  }
});

uji("Leader tidak membaca tabel ber-rupiah", async () => {
  harusSama(await kode(U.galih, "assets"), []);
  harusSama(await kode(U.maya, "assets"), []);
});

uji("riwayat aset mengikuti aturan yang sama", async () => {
  const riwayat = async (siapa) =>
    [
      ...new Set(
        (await sebagai(db, siapa, `select kode from riwayat_aset()`)).rows.map(
          (r) => r.kode,
        ),
      ),
    ].sort();
  harusSama(await riwayat(U.rian), ["AST-0006"]);
  harusSama(await riwayat(U.dewi), ["AST-0003", "AST-0006", "AST-0010"]);
  harusSama((await riwayat(U.manager)).length, semua.length);
});

uji(
  "kejadian aset tidak terbaca langsung oleh selain pemegang angka",
  async () => {
    const { rows } = await sebagai(
      db,
      U.rian,
      `select count(*)::int n from asset_events`,
    );
    harusSama(
      Number(rows[0].n),
      0,
      "riwayat hanya lewat riwayat_aset yang tersaring",
    );
  },
);

uji("pengunjung tanpa sesi tidak melihat apa pun", async () => {
  const { rows } = await sebagai(
    db,
    null,
    `select count(*)::int n from aset_publik`,
  );
  harusSama(Number(rows[0].n), 0);
});

uji("aset yang berpindah tangan ikut berpindah cakupan", async () => {
  // Finance menyerahkan cadangan MCN (AST-0005) ke Rian di Affiliator.
  await sebagai(
    db,
    U.finance,
    `insert into asset_events (asset_id, ke, oleh_id, pemegang_id, lokasi, catatan)
     select id, 'dipakai', $1, $2, 'Studio Affiliator', 'Dipinjam untuk live'
       from assets where kode = 'AST-0005'`,
    [U.finance, U.rian],
  );
  harus(
    (await kode(U.rian)).includes("AST-0005"),
    "kini terlihat pemegang barunya",
  );
  harus((await kode(U.dewi)).includes("AST-0005"), "dan atasannya");
  harus(
    !(await kode(U.maya)).includes("AST-0005"),
    "tidak lagi di Co-Leader MCN",
  );
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
