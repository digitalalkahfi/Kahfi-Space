/** Antrean WhatsApp dan cadangan in-app-nya (0117). */
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
const { uji, jalankan } = buatSuite("Antrean WhatsApp");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

/**
 * Menyiapkan seseorang agar layak (atau sengaja tidak layak) diantrekan.
 *
 * Nomornya ditulis LEBIH DULU, verifikasi dan opt-in menyusul di UPDATE
 * terpisah — bukan gaya penulisan, melainkan keharusan: trigger
 * `reset_verifikasi_kontak` mengosongkan keduanya setiap kali nomornya
 * berubah, jadi menuliskannya dalam satu UPDATE yang sama akan selalu
 * berakhir kosong. Urutan ini juga yang terjadi di dunia nyata: nomor
 * diisi dulu, dibuktikan kemudian.
 */
const siapkan = async (nama, { verif = true, optin = true, wa = true } = {}) => {
  const uid = await id(nama);
  await sebagaiAdmin(db, "update users set kontak = '+628123450000' where id = $1", [uid]);
  await sebagaiAdmin(
    db,
    `update users set
       kontak_terverifikasi_pada = case when $2 then now() else null end,
       whatsapp_optin = $3
     where id = $1`,
    [uid, verif, optin],
  );
  await sebagaiAdmin(
    db,
    `insert into notification_preferences (user_id, kategori, in_app, whatsapp)
     values ($1, 'tugas', true, $2)
     on conflict (user_id, kategori) do update set in_app = true, whatsapp = $2`,
    [uid, wa],
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

const antrean = async (nid) =>
  (
    await sebagaiAdmin(
      db,
      "select tujuan, status from notification_delivery where notification_id = $1",
      [nid],
    )
  ).rows;

uji("Nomor terverifikasi + opt-in + kanal menyala → masuk antrean", async () => {
  const uid = await siapkan("Nabila Putri");
  const nid = await terbitkan(uid);
  const baris = await antrean(nid);
  harusSama(baris.length, 1);
  harusSama(baris[0].status, "antre");
  harusSama(baris[0].tujuan, "+628123450000");
});

uji("Tanpa verifikasi, tidak diantrekan — tapi in-app tetap terbit", async () => {
  // Inilah cadangannya: kabarnya tetap sampai, hanya kanalnya tidak.
  const uid = await siapkan("Bayu Nugraha", { verif: false });
  const nid = await terbitkan(uid);
  harusSama((await antrean(nid)).length, 0);
  harus(nid !== null, "notifikasi in-app seharusnya tetap terbit");
});

uji("Tanpa opt-in, tidak diantrekan", async () => {
  const uid = await siapkan("Rizky Ananda", { optin: false });
  const nid = await terbitkan(uid);
  harusSama((await antrean(nid)).length, 0);
});

uji("Kanal WhatsApp mati, tidak diantrekan", async () => {
  const uid = await siapkan("Anisa Larasati", { wa: false });
  const nid = await terbitkan(uid);
  harusSama((await antrean(nid)).length, 0);
});

uji("Mengganti nomor membatalkan verifikasi dan opt-in", async () => {
  // Nomor baru adalah nomor yang belum pernah dibuktikan; mengirim ke
  // sana berarti mengirim ke orang yang tidak pernah setuju.
  const uid = await siapkan("Nabila Putri");
  await sebagaiAdmin(db, "update users set kontak = '+628999888777' where id = $1", [uid]);

  const { rows } = await sebagaiAdmin(
    db,
    "select kontak_terverifikasi_pada, whatsapp_optin from users where id = $1",
    [uid],
  );
  harusSama(rows[0].kontak_terverifikasi_pada, null);
  harusSama(rows[0].whatsapp_optin, false);

  const nid = await terbitkan(uid);
  harusSama((await antrean(nid)).length, 0);
});

uji("Tujuan disalin saat antre, tidak ikut berubah kemudian", async () => {
  const uid = await siapkan("Nabila Putri");
  const nid = await terbitkan(uid);
  await sebagaiAdmin(
    db,
    "update users set kontak = '+628777666555' where id = $1",
    [uid],
  );
  harusSama((await antrean(nid))[0].tujuan, "+628123450000");
});

uji("Nomor tujuan wajib bentuk baku", async () => {
  const uid = await siapkan("Nabila Putri");
  const nid = await terbitkan(uid);
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "insert into notification_delivery (notification_id, tujuan) values ($1, '08123450000')",
        [nid],
      ),
    "nomor tanpa +62 seharusnya ditolak",
  );
});

uji("Status terkirim wajib punya waktunya", async () => {
  const uid = await siapkan("Nabila Putri");
  const nid = await terbitkan(uid);
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "update notification_delivery set status = 'terkirim' where notification_id = $1",
        [nid],
      ),
    "terkirim tanpa waktu seharusnya ditolak",
  );
});

uji("Pemilik notifikasi boleh melihat status pengirimannya", async () => {
  const uid = await siapkan("Nabila Putri");
  const nid = await terbitkan(uid);
  const { rows } = await sebagai(
    db,
    uid,
    "select count(*)::int as n from notification_delivery where notification_id = $1",
    [nid],
  );
  harusSama(rows[0].n, 1);
});

uji("Orang lain tidak bisa melihat pengiriman yang bukan miliknya", async () => {
  const uid = await siapkan("Nabila Putri");
  const nid = await terbitkan(uid);
  const lain = await id("Rian Hidayat");
  const { rows } = await sebagai(
    db,
    lain,
    "select count(*)::int as n from notification_delivery where notification_id = $1",
    [nid],
  );
  harusSama(rows[0].n, 0);
});

await jalankan();
