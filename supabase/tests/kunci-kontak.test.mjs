/**
 * Kunci kolom email & nomor WhatsApp (0175).
 *
 * Migrasi ini sengaja ditaruh di supabase/menunggu sampai kode yang
 * membaca lewat `kontak_orang` tayang. Test ini menerapkannya sendiri
 * bila belum ada di folder migrasi, supaya perilakunya tetap teruji
 * sebelum maupun sesudah dipindahkan.
 */
import { existsSync, readFileSync } from "node:fs";
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

const MENUNGGU = "supabase/menunggu/0175_kunci_kolom_kontak.sql";

const db = await buatDb();
await terapkanSeed(db);
if (existsSync(MENUNGGU)) {
  await sebagaiAdmin(db, readFileSync(MENUNGGU, "utf8"));
}
const { uji, jalankan } = buatSuite("Kunci kolom kontak");

const id = async (nama) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [nama])).rows[0]
    .id;

const U = {
  manager: await id("Farhan Pratama"),
  rian: await id("Rian Hidayat"),
  nabila: await id("Nabila Putri"),
};

uji("kolom direktori tetap terbaca semua pengguna", async () => {
  const { rows } = await sebagai(
    db,
    U.rian,
    `select id, nama, role, jabatan, unit_id, atasan_id, status from users`,
  );
  harus(rows.length > 20, "nama rekan tetap terbaca untuk seluruh aplikasi");
});

uji("email & nomor tidak bisa dibaca langsung dari tabel users", async () => {
  for (const kolom of [
    "email",
    "kontak",
    "kontak_terverifikasi_pada",
    "whatsapp_optin",
  ]) {
    await harusDitolak(
      () =>
        sebagai(db, U.rian, `select ${kolom} from users where id = $1`, [
          U.nabila,
        ]),
      `kolom ${kolom} seharusnya terkunci`,
    );
  }
  await harusDitolak(
    () => sebagai(db, U.manager, `select * from users`),
    "select * pun tertolak, termasuk bagi Manager",
  );
});

uji("kontak_orang tetap jalan: diri sendiri & Manager", async () => {
  const diri = await sebagai(
    db,
    U.rian,
    `select id, email from kontak_orang()`,
  );
  harusSama(
    diri.rows.map((r) => r.id),
    [U.rian],
  );
  harus(diri.rows[0].email, "email diri sendiri terbaca");
  const mgr = await sebagai(
    db,
    U.manager,
    `select count(*)::int n from kontak_orang()`,
  );
  harus(Number(mgr.rows[0].n) > 20, "Manager melihat semua");
});

uji("menulis nomor sendiri tetap bisa", async () => {
  const r = await sebagai(
    db,
    U.rian,
    `update users set kontak = '+6281234567890' where id = $1`,
    [U.rian],
  );
  harusSama(r.affectedRows ?? 0, 1);
  const { rows } = await sebagai(
    db,
    U.rian,
    `select kontak from kontak_orang()`,
  );
  harusSama(rows[0].kontak, "+6281234567890");
});

uji("verifikasi nomor oleh Manager tetap jalan (fungsi pemilik)", async () => {
  const { rows } = await sebagai(
    db,
    U.manager,
    `select verifikasi_kontak($1) t`,
    [U.rian],
  );
  harus(rows[0].t, "waktu verifikasi dikembalikan");
});

uji("Manager tetap bisa mengubah data anggota", async () => {
  const r = await sebagai(
    db,
    U.manager,
    `update users set jabatan = 'Staff Affiliator (uji)', email = 'rian.uji@contoh.id'
      where id = $1`,
    [U.rian],
  );
  harusSama(r.affectedRows ?? 0, 1);
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
