/** Penandaan K-Space lama sebagai hanya-baca. */
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
const { uji, jalankan } = buatSuite("K-Space lama hanya-baca");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const status = async () =>
  (
    await sebagaiAdmin(
      db,
      "select lama_readonly, lama_readonly_pada, lama_readonly_oleh from pengaturan",
    )
  ).rows[0];

uji("bawaannya belum dibekukan", async () => {
  const s = await status();
  harusSama(s.lama_readonly, false);
  harusSama(s.lama_readonly_pada, null);
});

uji("Manager membekukan, waktu dan pelakunya tercatat sendiri", async () => {
  const manager = await id("Farhan Pratama");
  await sebagai(db, manager, "update pengaturan set lama_readonly = true");

  const s = await status();
  harusSama(s.lama_readonly, true);
  harus(s.lama_readonly_pada !== null, "waktu pembekuan harus tercatat");
  harusSama(s.lama_readonly_oleh, manager);
});

uji("membuka kembali menghapus jejak pembekuannya", async () => {
  await sebagai(
    db,
    await id("Farhan Pratama"),
    "update pengaturan set lama_readonly = false",
  );
  const s = await status();
  harusSama(s.lama_readonly, false);
  harusSama(s.lama_readonly_pada, null);
  harusSama(s.lama_readonly_oleh, null);
});

uji("Staff tidak bisa mengubah pengaturan", async () => {
  await sebagai(
    db,
    await id("Rian Hidayat"),
    "update pengaturan set lama_readonly = true",
  );
  harusSama((await status()).lama_readonly, false);
});

uji("mengubah pengaturan lain tidak menyentuh jejak pembekuan", async () => {
  const manager = await id("Farhan Pratama");
  await sebagai(db, manager, "update pengaturan set lama_readonly = true");
  const sebelum = await status();

  await sebagai(db, manager, "update pengaturan set radius_meter = 200");
  const sesudah = await status();

  harusSama(
    sesudah.lama_readonly_pada?.toISOString?.() ??
      String(sesudah.lama_readonly_pada),
    sebelum.lama_readonly_pada?.toISOString?.() ??
      String(sebelum.lama_readonly_pada),
  );
  await terapkanSeed(db);
});

uji("tiap pembekuan dan pembukaan tercatat di riwayat", async () => {
  // Keadaan sekarang saja menghapus jejak: setelah dibuka lalu dibekukan
  // lagi, jendela terbukanya tidak akan pernah bisa ditelusuri.
  // Dimulai dari keadaan terbuka supaya ketiga perubahannya nyata.
  await sebagaiAdmin(db, "update pengaturan set lama_readonly = false");
  await sebagaiAdmin(db, "delete from kspace_lama_log");
  const manajer = await id("Farhan Pratama");

  await sebagai(db, manajer, "update pengaturan set lama_readonly = true");
  await sebagai(db, manajer, "update pengaturan set lama_readonly = false");
  await sebagai(db, manajer, "update pengaturan set lama_readonly = true");

  const { rows } = await sebagaiAdmin(
    db,
    "select readonly, oleh from kspace_lama_log order by pada",
  );
  harusSama(rows.map((r) => r.readonly).join(","), "true,false,true");
  harusSama(rows[0].oleh, manajer, "pelakunya ikut tercatat");
});

uji("perubahan pengaturan lain tidak menambah riwayat", async () => {
  const sebelum = Number(
    (await sebagaiAdmin(db, "select count(*)::int n from kspace_lama_log")).rows[0].n,
  );
  await sebagaiAdmin(db, "update pengaturan set radius_meter = 200");
  harusSama(
    Number(
      (await sebagaiAdmin(db, "select count(*)::int n from kspace_lama_log")).rows[0].n,
    ),
    sebelum,
  );
});

uji("riwayat terbuka untuk semua yang sudah masuk", async () => {
  // Semua orang perlu tahu sistem mana yang sedang berlaku.
  const staf = await id("Nabila Putri");
  const { rows } = await sebagai(db, staf, "select count(*)::int n from kspace_lama_log");
  harus(Number(rows[0].n) > 0, "riwayat harus terbaca semua anggota");
});

uji("riwayat tidak bisa dikarang sendiri", async () => {
  const staf = await id("Nabila Putri");
  await harusDitolak(
    () =>
      sebagai(
        db,
        staf,
        "insert into kspace_lama_log (readonly) values (false)",
      ),
    "penulisan riwayat langsung seharusnya ditolak",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
