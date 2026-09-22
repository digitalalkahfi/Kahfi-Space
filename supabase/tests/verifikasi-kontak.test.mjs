/** Siapa yang boleh memverifikasi nomor kontak (0119). */
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
const { uji, jalankan } = buatSuite("Verifikasi kontak");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const beriNomor = async (uid) =>
  sebagaiAdmin(db, "update users set kontak = '+628123450000' where id = $1", [
    uid,
  ]);

const keadaan = async (uid) =>
  (
    await sebagaiAdmin(
      db,
      "select kontak_terverifikasi_pada, whatsapp_optin from users where id = $1",
      [uid],
    )
  ).rows[0];

uji("Staff tidak bisa memverifikasi nomornya sendiri", async () => {
  // Verifikasi yang bisa diberikan sendiri tidak memverifikasi apa pun —
  // dan seluruh syarat opt-in berdiri di atasnya.
  const rian = await id("Rian Hidayat");
  await beriNomor(rian);
  await sebagaiAdmin(
    db,
    "update users set kontak_terverifikasi_pada = null where id = $1",
    [rian],
  );

  await harusDitolak(
    () =>
      sebagai(
        db,
        rian,
        "update users set kontak_terverifikasi_pada = now() where id = $1",
        [rian],
      ),
    "verifikasi mandiri seharusnya ditolak",
  );
  harusSama((await keadaan(rian)).kontak_terverifikasi_pada, null);
});

uji("Staff tidak bisa memanggil fungsi verifikasinya", async () => {
  const rian = await id("Rian Hidayat");
  await harusDitolak(
    () => sebagai(db, rian, "select verifikasi_kontak($1)", [rian]),
    "fungsi verifikasi seharusnya ditolak untuk Staff",
  );
});

uji("Manager boleh memverifikasi nomor anggotanya", async () => {
  const manajer = await id("Farhan Pratama");
  const rian = await id("Rian Hidayat");
  await beriNomor(rian);

  await sebagai(db, manajer, "select verifikasi_kontak($1)", [rian]);
  harus(
    (await keadaan(rian)).kontak_terverifikasi_pada !== null,
    "verifikasi seharusnya tersimpan",
  );
});

uji("Nomor kosong tidak bisa diverifikasi", async () => {
  const manajer = await id("Farhan Pratama");
  const target = await id("Nabila Putri");
  await sebagaiAdmin(db, "update users set kontak = null where id = $1", [
    target,
  ]);

  await harusDitolak(
    () => sebagai(db, manajer, "select verifikasi_kontak($1)", [target]),
    "memverifikasi nomor kosong seharusnya ditolak",
  );
});

uji("Staff tetap boleh memberi persetujuannya sendiri", async () => {
  // Pembagiannya: verifikasi milik pengelola, persetujuan milik orangnya.
  const manajer = await id("Farhan Pratama");
  const rian = await id("Rian Hidayat");
  await beriNomor(rian);
  await sebagai(db, manajer, "select verifikasi_kontak($1)", [rian]);

  await sebagai(db, rian, "update users set whatsapp_optin = true where id = $1", [
    rian,
  ]);
  harusSama((await keadaan(rian)).whatsapp_optin, true);
});

uji("Mencabut verifikasi ikut mencabut persetujuannya", async () => {
  const manajer = await id("Farhan Pratama");
  const rian = await id("Rian Hidayat");
  await beriNomor(rian);
  await sebagai(db, manajer, "select verifikasi_kontak($1)", [rian]);
  await sebagai(db, rian, "update users set whatsapp_optin = true where id = $1", [
    rian,
  ]);

  await sebagai(db, manajer, "select cabut_verifikasi_kontak($1)", [rian]);
  const k = await keadaan(rian);
  harusSama(k.kontak_terverifikasi_pada, null);
  harusSama(k.whatsapp_optin, false);
});

uji("Mengganti nomor tetap mengosongkan verifikasi tanpa tertolak", async () => {
  // Pengosongan otomatis (0117) arahnya memperketat, jadi ia tidak boleh
  // ikut kena pagar verifikasi.
  const manajer = await id("Farhan Pratama");
  const rian = await id("Rian Hidayat");
  await beriNomor(rian);
  await sebagai(db, manajer, "select verifikasi_kontak($1)", [rian]);

  await sebagai(db, rian, "update users set kontak = '+628999000111' where id = $1", [
    rian,
  ]);
  harusSama((await keadaan(rian)).kontak_terverifikasi_pada, null);
});

await jalankan();
