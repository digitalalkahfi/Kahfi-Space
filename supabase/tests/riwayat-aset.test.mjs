/** Riwayat pemegang aset: terbuka untuk semua, tanpa membuka angka. */
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
const { uji, jalankan } = buatSuite("Riwayat pemegang aset");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const staf = await id("Rian Hidayat");
const manager = await id("Farhan Pratama");
const finance = await id("Laras Ayuningtyas");
const yusuf = await id("Yusuf Ramadhan");
const fajar = await id("Fajar Ramadhan");

uji("Staff melihat riwayat seluruh aset, bukan hanya miliknya", async () => {
  const { rows } = await sebagai(db, staf, "select * from riwayat_aset()");
  const semua = Number(
    (await sebagaiAdmin(db, "select count(*)::int as n from asset_events")).rows[0]
      .n,
  );

  harusSama(rows.length, semua, "seluruh perpindahan terbaca");
  harus(!("nilai_perolehan" in rows[0]), "tanpa satu pun angka rupiah");
});

uji("riwayat menyebut barang, keadaan, dan tangan yang memegangnya", async () => {
  const { rows } = await sebagai(db, staf, "select * from riwayat_aset($1)", [
    "AST-0010",
  ]);

  harus(rows.length >= 3, "laptop hilang punya jejak berlapis");
  harusSama(rows[0].ke, "hilang", "kejadian terbaru lebih dulu");
  harusSama(rows[0].pemegang_nama, "Yusuf Ramadhan", "di tangan siapa terakhir");
  harusSama(rows.at(-1).dari, null, "kejadian tertua adalah perolehannya");
});

uji("kode dicocokkan tanpa memandang huruf besar-kecil", async () => {
  const { rows } = await sebagai(db, staf, "select * from riwayat_aset($1)", [
    "ast-0010",
  ]);
  harus(rows.length > 0, "stiker yang diketik ulang tetap ketemu");
});

uji("tanpa masuk, riwayatnya tidak terbaca sama sekali", async () => {
  const { rows } = await sebagai(db, null, "select * from riwayat_aset()");
  harusSama(rows.length, 0, "bukan data publik");
});

uji("daftar barang yang sedang dipegang sendiri", async () => {
  const { rows } = await sebagai(db, fajar, "select * from aset_dipegang()");

  harus(rows.length > 0, "Fajar memang memegang sesuatu");
  harus(
    rows.every((r) => r.status !== "dilepas"),
    "barang yang sudah dilepas bukan tanggung jawabnya lagi",
  );
});

uji("daftar milik orang lain hanya untuk yang berhak", async () => {
  const { rows: olehStaf } = await sebagai(
    db,
    staf,
    "select * from aset_dipegang($1)",
    [fajar],
  );
  harusSama(olehStaf.length, 0, "Staff tidak mengintip tanggungan orang lain");

  const { rows: olehManager } = await sebagai(
    db,
    manager,
    "select * from aset_dipegang($1)",
    [fajar],
  );
  harus(olehManager.length > 0, "Manager melihatnya");

  const { rows: olehFinance } = await sebagai(
    db,
    finance,
    "select * from aset_dipegang($1)",
    [fajar],
  );
  harus(olehFinance.length > 0, "Finance juga, karena ia memegang angkanya");
});

uji("barang yang belum kembali tetap tercatat atas nama pemegangnya", async () => {
  // Yusuf sudah tidak aktif, tetapi laptopnya belum kembali — justru
  // inilah yang perlu terlihat saat serah terima.
  const { rows } = await sebagai(db, manager, "select * from aset_dipegang($1)", [
    yusuf,
  ]);

  harus(
    rows.some((r) => r.kode === "AST-0010"),
    "laptop yang hilang masih di namanya",
  );
});

await jalankan();
await db.close();
