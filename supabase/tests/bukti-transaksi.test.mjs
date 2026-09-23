/**
 * Bukti pendukung transaksi (migrasi 0151).
 *
 * Yang dijaga: alamatnya hanya boleh menunjuk bucket sendiri, dan bukti
 * transaksi yang sudah dibayar tidak bisa ditukar.
 */
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
const { uji, jalankan } = buatSuite("Bukti transaksi");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  finance: (await satu(`select id from users where nama='Laras Ayuningtyas'`))
    .id,
  rian: (await satu(`select id from users where nama='Rian Hidayat'`)).id,
};

const SAH =
  "https://contoh.supabase.co/storage/v1/object/public/bukti-transaksi/2024/nota.jpg";

uji("bawaannya kosong, bukan null", async () => {
  // Kosong berarti "belum ada bukti"; null akan memaksa tiap pembacanya
  // memeriksa dua keadaan untuk satu arti yang sama.
  const t = await satu(`select bukti_url from transactions limit 1`);
  harusSama(t.bukti_url, "");
});

uji("alamat di bucket sendiri diterima", async () => {
  const t = await satu(
    `select id from transactions where status <> 'dibayar' limit 1`,
  );
  await sebagai(
    db,
    U.finance,
    `update transactions set bukti_url=$2 where id=$1`,
    [t.id, SAH],
  );
  harusSama(
    (await satu(`select bukti_url from transactions where id=$1`, [t.id]))
      .bukti_url,
    SAH,
  );
});

uji("tautan dari luar ditolak", async () => {
  const t = await satu(
    `select id from transactions where status <> 'dibayar' limit 1`,
  );
  for (const jahat of [
    "https://jahat.example/nota.jpg",
    "http://contoh.supabase.co/storage/v1/object/public/bukti-transaksi/x.jpg",
    "https://contoh.supabase.co/storage/v1/object/public/foto-profil/x.jpg",
  ]) {
    await harusDitolak(
      () =>
        sebagaiAdmin(db, `update transactions set bukti_url=$2 where id=$1`, [
          t.id,
          jahat,
        ]),
      `alamat ${jahat} harus ditolak`,
    );
  }
});

uji("bukti bisa dilepas kembali selama belum dibayar", async () => {
  const t = await satu(
    `select id from transactions where status <> 'dibayar' limit 1`,
  );
  await sebagai(
    db,
    U.finance,
    `update transactions set bukti_url='' where id=$1`,
    [t.id],
  );
  harusSama(
    (await satu(`select bukti_url from transactions where id=$1`, [t.id]))
      .bukti_url,
    "",
  );
});

uji("bukti transaksi yang sudah dibayar tidak bisa ditukar", async () => {
  // Bukti yang masih bisa diganti setelah uangnya keluar bukan bukti.
  const t = await satu(
    `select id from transactions where status = 'dibayar' limit 1`,
  );
  harus(t !== undefined, "seed harus punya transaksi yang sudah dibayar");

  await harusDitolak(() =>
    sebagaiAdmin(db, `update transactions set bukti_url=$2 where id=$1`, [
      t.id,
      SAH,
    ]),
  );
});

uji("Staff tidak bisa menyematkan bukti", async () => {
  const t = await satu(
    `select id from transactions where status <> 'dibayar' limit 1`,
  );
  const { rows } = await sebagai(
    db,
    U.rian,
    `update transactions set bukti_url=$2 where id=$1 returning id`,
    [t.id, SAH],
  );
  harusSama(rows.length, 0, "angka perusahaan bukan urusan Staff");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
