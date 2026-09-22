/** Jejak perubahan data aset: apa yang dicatat, dan siapa boleh membacanya. */
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
const { uji, jalankan } = buatSuite("Audit data aset");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const asetId = async (kode) =>
  (await sebagaiAdmin(db, "select id from assets where kode = $1", [kode]))
    .rows[0].id;

const finance = await id("Laras Ayuningtyas");
const manager = await id("Farhan Pratama");
const staf = await id("Rian Hidayat");

const jejak = async (oleh, aset = null) =>
  (await sebagai(db, oleh, "select * from audit_aset($1)", [aset])).rows;

uji("perolehan aset ikut tercatat sebagai jejak", async () => {
  const semua = await jejak(manager);
  harus(semua.length >= 12, "tiap aset contoh meninggalkan jejak insert");
  harus(
    semua.every((r) => ["insert", "update"].includes(r.aksi)),
    "hanya aksi yang memang terjadi",
  );
});

uji("menaikkan nilai perolehan meninggalkan angka lama dan barunya", async () => {
  const aset = await asetId("AST-0004");
  await sebagai(
    db,
    finance,
    "update assets set nilai_perolehan = 30000000 where id = $1",
    [aset],
  );

  const [terbaru] = await jejak(finance, aset);
  harusSama(terbaru.aksi, "update", "tercatat sebagai suntingan");
  harusSama(
    Number(terbaru.nilai_lama.nilai_perolehan),
    27_400_000,
    "angka lamanya tersimpan",
  );
  harusSama(
    Number(terbaru.nilai_baru.nilai_perolehan),
    30_000_000,
    "angka barunya tersimpan",
  );
  harusSama(terbaru.oleh_nama, "Laras Ayuningtyas", "siapa yang mengubahnya");
});

uji("memperpanjang masa manfaat pun tercatat", async () => {
  const aset = await asetId("AST-0004");
  await sebagai(
    db,
    manager,
    "update assets set masa_manfaat = 72 where id = $1",
    [aset],
  );

  const [terbaru] = await jejak(manager, aset);
  harusSama(terbaru.nilai_lama.masa_manfaat, 48, "masa manfaat lama");
  harusSama(terbaru.nilai_baru.masa_manfaat, 72, "masa manfaat baru");
});

uji("perpindahan lokasi tidak membisingkan jejak audit", async () => {
  const aset = await asetId("AST-0009");
  const sebelum = (await jejak(manager, aset)).length;

  await sebagai(
    db,
    manager,
    "update assets set lokasi = 'Studio MCN Lt. 1' where id = $1",
    [aset],
  );

  harusSama(
    (await jejak(manager, aset)).length,
    sebelum,
    "lokasi bukan angka; perpindahannya sudah punya tabel sendiri",
  );
});

uji("perpindahan status tercatat di jejak audit juga", async () => {
  const aset = await asetId("AST-0009");
  const sebelum = (await jejak(manager, aset)).length;

  await sebagai(
    db,
    manager,
    `insert into asset_events (asset_id, ke, oleh_id, catatan)
     values ($1, 'perbaikan', $2, 'Gimbalnya tidak seimbang lagi')`,
    [aset, manager],
  );

  const sesudah = await jejak(manager, aset);
  harusSama(sesudah.length, sebelum + 1, "status berubah, jejaknya bertambah");
  harusSama(sesudah[0].nilai_baru.status, "perbaikan", "keadaan barunya");
});

uji("Finance boleh menelusuri jejak aset", async () => {
  harus((await jejak(finance)).length > 0, "ia memegang angkanya");
});

uji("Staff tidak melihat jejak aset sama sekali", async () => {
  harusSama((await jejak(staf)).length, 0, "bukan urusannya");
});

uji("jejak audit aset tidak mencampuri jejak kepegawaian", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select distinct entitas from audit_logs order by entitas",
  );
  const entitas = rows.map((r) => r.entitas);

  harus(entitas.includes("assets"), "aset punya jejaknya");
  harus(entitas.includes("users"), "anggota tetap punya jejaknya sendiri");

  const { rows: bocor } = await sebagai(
    db,
    finance,
    "select count(*)::int as n from audit_logs where entitas = 'users'",
  );
  harusSama(bocor[0].n, 0, "Finance tidak ikut membaca jejak kepegawaian");
});

await jalankan();
await db.close();
