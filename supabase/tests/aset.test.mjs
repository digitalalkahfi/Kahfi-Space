/** Aset & inventaris: bentuk data, perpindahan, keutuhan riwayat, cakupan baca. */
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
const { uji, jalankan } = buatSuite("Aset & inventaris");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const asetId = async (kode) =>
  (await sebagaiAdmin(db, "select id from assets where kode = $1", [kode]))
    .rows[0].id;

const finance = await id("Laras Ayuningtyas");
const manager = await id("Farhan Pratama");
const staf = await id("Rian Hidayat");
const leader = await id("Dewi Lestari");

const aset = async (kode) =>
  (await sebagaiAdmin(db, "select * from assets where kode = $1", [kode]))
    .rows[0];

const pindahkan = async (oleh, kode, ke, isi = {}) =>
  sebagai(
    db,
    oleh,
    `insert into asset_events (asset_id, ke, oleh_id, pemegang_id, lokasi, catatan)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      await asetId(kode),
      ke,
      oleh,
      isi.pemegang ?? null,
      isi.lokasi ?? "",
      isi.catatan ?? "",
    ],
  );

uji("data contoh masuk lengkap dengan keadaan akhirnya", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select status, count(*)::int as n from assets group by status order by status",
  );
  const peta = Object.fromEntries(rows.map((r) => [r.status, r.n]));

  harusSama(peta.dipakai, 8, "aset yang sedang dipakai");
  harusSama(peta.cadangan, 1, "aset cadangan");
  harusSama(peta.perbaikan, 1, "aset diperbaiki");
  harusSama(peta.hilang, 1, "aset hilang");
  harusSama(peta.dilepas, 1, "aset dilepas");
});

uji("perolehan tercatat sebagai kejadian pertama tiap aset", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select a.kode
     from assets a
     where not exists (
       select 1 from asset_events e
       where e.asset_id = a.id and e.dari is null
     )`,
  );
  harusSama(rows.length, 0, "tidak ada aset tanpa catatan perolehan");
});

uji("aset yang berhenti dimiliki punya tanggal berhentinya", async () => {
  for (const kode of ["AST-0010", "AST-0011"]) {
    const a = await aset(kode);
    harus(a.berakhir !== null, `${kode} berhenti pada tanggal tertentu`);
    harus(a.berakhir >= a.tanggal, `${kode}: berhenti setelah diperoleh`);
  }

  const dipakai = await aset("AST-0001");
  harusSama(dipakai.berakhir, null, "yang masih dimiliki tidak punya tanggal akhir");
});

uji("status tidak bisa disetel langsung", async () => {
  await harusDitolak(
    () =>
      sebagai(db, manager, "update assets set status = 'hilang' where kode = 'AST-0001'"),
    "menyetel status tanpa jejak",
  );
});

uji("perpindahan yang tidak masuk akal ditolak", async () => {
  await harusDitolak(
    () =>
      pindahkan(manager, "AST-0011", "dipakai", {
        catatan: "Barangnya ternyata masih ada",
      }),
    "menghidupkan kembali aset yang sudah dilepas",
  );
});

uji("pindah tangan tanpa ganti keadaan tetap dicatat", async () => {
  const sebelum = await aset("AST-0002");
  await pindahkan(manager, "AST-0002", "dipakai", {
    pemegang: staf,
    lokasi: "Dibawa pemegang",
  });
  const sesudah = await aset("AST-0002");

  harusSama(sesudah.status, "dipakai", "keadaannya tidak berubah");
  harusSama(sesudah.pemegang_id, staf, "pemegangnya berganti");
  harus(sesudah.pemegang_id !== sebelum.pemegang_id, "memang berpindah tangan");
});

uji("perpindahan yang tidak mengubah apa pun ditolak", async () => {
  await harusDitolak(
    () => pindahkan(manager, "AST-0002", "dipakai", { pemegang: staf }),
    "mencatat perpindahan ke tangan yang sama",
  );
});

uji("aset cadangan tidak boleh punya pemegang", async () => {
  await harusDitolak(
    () => pindahkan(manager, "AST-0002", "cadangan", { pemegang: staf }),
    "menyimpan di gudang atas nama seseorang",
  );

  await pindahkan(manager, "AST-0002", "cadangan", { lokasi: "Gudang Lt. 1" });
  harusSama((await aset("AST-0002")).pemegang_id, null, "pemegangnya dilepas");
});

uji("hilang dan dilepas wajib berketerangan", async () => {
  await harusDitolak(
    () => pindahkan(manager, "AST-0002", "hilang", { catatan: "hilang" }),
    "menyatakan hilang tanpa keterangan",
  );

  await pindahkan(manager, "AST-0002", "hilang", {
    catatan: "Tidak ditemukan saat opname gudang Oktober",
  });
  const a = await aset("AST-0002");
  harusSama(a.status, "hilang", "tercatat hilang");
  harus(a.berakhir !== null, "tanggal berhentinya ikut tercatat");
});

uji("riwayat aset tidak bisa disunting atau dihapus", async () => {
  const { rows } = await sebagaiAdmin(db, "select id from asset_events limit 1");

  await harusDitolak(
    () =>
      sebagaiAdmin(db, "update asset_events set catatan = 'diubah' where id = $1", [
        rows[0].id,
      ]),
    "menyunting riwayat aset",
  );
  await harusDitolak(
    () => sebagaiAdmin(db, "delete from asset_events where id = $1", [rows[0].id]),
    "menghapus riwayat aset",
  );
});

uji("Staff hanya melihat aset yang ia pegang sendiri", async () => {
  const { rows } = await sebagai(db, staf, "select kode from assets");
  const semua = Number(
    (await sebagaiAdmin(db, "select count(*)::int as n from assets")).rows[0].n,
  );

  harus(rows.length > 0, "aset yang dipegangnya terlihat");
  harus(rows.length < semua, "sisanya tidak");
});

uji("daftar tanpa angka terbuka untuk semua yang sudah masuk", async () => {
  const { rows } = await sebagai(db, staf, "select * from aset_publik");
  const semua = Number(
    (await sebagaiAdmin(db, "select count(*)::int as n from assets")).rows[0].n,
  );

  harusSama(rows.length, semua, "seluruh barang terlihat");
  harus(!("nilai_perolehan" in rows[0]), "tanpa kolom rupiah");
  harus("pemegang_id" in rows[0], "tetapi dengan pemegangnya");
});

uji("Leader tidak bisa mencatat perpindahan aset", async () => {
  await harusDitolak(
    () =>
      pindahkan(leader, "AST-0003", "perbaikan", { catatan: "Dicoba Leader" }),
    "Leader bukan pengelola aset",
  );
});

uji("Finance boleh mencatat perpindahan", async () => {
  await pindahkan(finance, "AST-0003", "perbaikan", {
    catatan: "Lampu kedua mati sejak tadi malam",
    lokasi: "Servis resmi",
  });
  harusSama((await aset("AST-0003")).status, "perbaikan", "tercatat Finance");
});

uji("kode aset unik tanpa memandang huruf besar-kecil", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        manager,
        `insert into assets (kode, nama, tanggal, nilai_perolehan)
         values ('ast-0001', 'Kembaran kode', '2024-10-24', 1000000)`,
      ),
    "kode yang sama dengan huruf berbeda",
  );
});

uji("nilai residu tidak boleh melebihi harga belinya", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        manager,
        `insert into assets (kode, nama, tanggal, nilai_perolehan, residu)
         values ('AST-9999', 'Residu kebesaran', '2024-10-24', 1000000, 2000000)`,
      ),
    "residu di atas nilai perolehan",
  );
});

await jalankan();
await db.close();
