/**
 * Cadangan in-app: notifikasi tidak pernah hilang karena WhatsApp gagal.
 *
 * Ini bukan fitur yang "ditambahkan", melainkan urutan yang dijaga:
 * notifikasi in-app terbit LEBIH DULU (0111), antrean WhatsApp menyusul
 * sebagai AFTER INSERT (0117). Selama urutan itu berlaku, kegagalan
 * kanal apa pun tidak bisa menghapus kabarnya. Test ini mengunci urutan
 * tersebut supaya perubahan di kemudian hari tidak membaliknya diam-diam.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Cadangan in-app");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const siapkan = async (nama) => {
  const uid = await id(nama);
  await sebagaiAdmin(db, "update users set kontak = '+628123450000' where id = $1", [uid]);
  await sebagaiAdmin(
    db,
    "update users set kontak_terverifikasi_pada = now(), whatsapp_optin = true where id = $1",
    [uid],
  );
  await sebagaiAdmin(
    db,
    `insert into notification_preferences (user_id, kategori, in_app, whatsapp)
     values ($1, 'tugas', true, true)
     on conflict (user_id, kategori) do update set in_app = true, whatsapp = true`,
    [uid],
  );
  return uid;
};

const terbitkan = async (uid) =>
  (
    await sebagaiAdmin(
      db,
      "select terbitkan_notifikasi($1, 'tugas', 'Judul', 'Pesan', '/tugas') as id",
      [uid],
    )
  ).rows[0].id;

uji("Notifikasi tetap ada setelah semua percobaan kirim gagal", async () => {
  const uid = await siapkan("Nabila Putri");
  const nid = await terbitkan(uid);
  const did = (
    await sebagaiAdmin(
      db,
      "select id from notification_delivery where notification_id = $1",
      [nid],
    )
  ).rows[0].id;

  for (let i = 0; i < 3; i++) {
    await sebagaiAdmin(
      db,
      "select catat_percobaan_kirim($1, 'gagal', 'Gateway tumbang', '503')",
      [did],
    );
  }

  const { rows } = await sebagaiAdmin(
    db,
    "select judul, dibaca_pada from notifications where id = $1",
    [nid],
  );
  harusSama(rows.length, 1);
  harusSama(rows[0].judul, "Judul");
  // Gagal kirim tidak boleh menandainya sudah dibaca — kabarnya justru
  // belum sampai ke mana-mana.
  harusSama(rows[0].dibaca_pada, null);
});

uji("Notifikasi terbit lebih dulu, antrean menyusul", async () => {
  // Urutannya yang menjamin cadangan itu. Kalau suatu saat antrean
  // dibuat lebih dulu dan gagal, notifikasinya tidak akan pernah ada.
  const uid = await siapkan("Bayu Nugraha");
  const nid = await terbitkan(uid);

  const { rows } = await sebagaiAdmin(
    db,
    `select n.created_at as notif, d.created_at as antre
     from notifications n
     join notification_delivery d on d.notification_id = n.id
     where n.id = $1`,
    [nid],
  );
  harusSama(rows.length, 1);
  harus(
    new Date(rows[0].antre) >= new Date(rows[0].notif),
    "antrean seharusnya tidak mendahului notifikasinya",
  );
});

uji("Menghapus antrean tidak menghapus notifikasinya", async () => {
  const uid = await siapkan("Rizky Ananda");
  const nid = await terbitkan(uid);

  await sebagaiAdmin(
    db,
    "delete from notification_delivery where notification_id = $1",
    [nid],
  );

  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from notifications where id = $1",
    [nid],
  );
  harusSama(rows[0].n, 1);
});

uji("Menghapus notifikasi ikut menghapus antreannya", async () => {
  // Arah kebalikannya memang harus cascade: pesan tanpa isi tidak ada
  // gunanya dikirim.
  const uid = await siapkan("Anisa Larasati");
  const nid = await terbitkan(uid);

  await sebagaiAdmin(db, "delete from notifications where id = $1", [nid]);
  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from notification_delivery where notification_id = $1",
    [nid],
  );
  harusSama(rows[0].n, 0);
});

uji("Gateway yang belum siap tidak menghalangi notifikasi terbit", async () => {
  // Orang tanpa nomor terverifikasi tidak pernah masuk antrean, dan
  // notifikasinya tetap ada — itu keadaan paling umum di awal.
  const uid = await id("Teguh Wibowo");
  await sebagaiAdmin(db, "update users set kontak = null where id = $1", [uid]);

  const nid = await terbitkan(uid);
  const { rows: notif } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from notifications where id = $1",
    [nid],
  );
  const { rows: antre } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from notification_delivery where notification_id = $1",
    [nid],
  );
  harusSama(notif[0].n, 1);
  harusSama(antre[0].n, 0);
});

await jalankan();
