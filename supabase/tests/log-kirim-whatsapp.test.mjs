/** Log percobaan kirim WhatsApp (0118). */
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
const { uji, jalankan } = buatSuite("Log kirim WhatsApp");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

/** Menyiapkan satu pengiriman yang siap dicoba. */
const siapkanPengiriman = async (nama = "Nabila Putri") => {
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
  const nid = (
    await sebagaiAdmin(
      db,
      "select terbitkan_notifikasi($1, 'tugas', 'Judul', 'Pesan', '/tugas') as id",
      [uid],
    )
  ).rows[0].id;
  const did = (
    await sebagaiAdmin(
      db,
      "select id from notification_delivery where notification_id = $1",
      [nid],
    )
  ).rows[0].id;
  return { uid, nid, did };
};

const catat = async (did, status, galat = "", balasan = "") =>
  (
    await sebagaiAdmin(
      db,
      "select catat_percobaan_kirim($1, $2, $3, $4) as urutan",
      [did, status, galat, balasan],
    )
  ).rows[0].urutan;

uji("Percobaan berhasil menaikkan status dan mencatat waktunya", async () => {
  const { did } = await siapkanPengiriman();
  harusSama(await catat(did, "terkirim", "", "ok"), 1);

  const { rows } = await sebagaiAdmin(
    db,
    "select status, percobaan, dikirim_pada from notification_delivery where id = $1",
    [did],
  );
  harusSama(rows[0].status, "terkirim");
  harusSama(rows[0].percobaan, 1);
  harus(rows[0].dikirim_pada !== null, "waktu kirim seharusnya terisi");
});

uji("Tiap percobaan tercatat sendiri, tidak saling menimpa", async () => {
  // Inilah gunanya log: galat kedua tidak boleh menghapus galat pertama,
  // karena polanya yang membedakan gateway tumbang dari nomor salah.
  const { did } = await siapkanPengiriman("Bayu Nugraha");
  await catat(did, "gagal", "Timeout", "504");
  await catat(did, "gagal", "Nomor tidak terdaftar", "404");

  const { rows } = await sebagaiAdmin(
    db,
    "select urutan, galat from notification_delivery_attempts where delivery_id = $1 order by urutan",
    [did],
  );
  harusSama(rows.length, 2);
  harusSama(rows[0].galat, "Timeout");
  harusSama(rows[1].galat, "Nomor tidak terdaftar");
});

uji("Keadaan terakhir mengikuti percobaan terakhir", async () => {
  const { did } = await siapkanPengiriman("Rizky Ananda");
  await catat(did, "gagal", "Timeout");
  await catat(did, "terkirim", "");

  const { rows } = await sebagaiAdmin(
    db,
    "select status, percobaan from notification_delivery where id = $1",
    [did],
  );
  harusSama(rows[0].status, "terkirim");
  harusSama(rows[0].percobaan, 2);
});

uji("Status 'antre' bukan hasil percobaan", async () => {
  const { did } = await siapkanPengiriman("Anisa Larasati");
  await harusDitolak(
    () => catat(did, "antre"),
    "mencatat 'antre' sebagai percobaan seharusnya ditolak",
  );
});

uji("Balasan gateway yang kepanjangan dipotong, bukan ditolak", async () => {
  // Menolak pengiriman karena balasannya panjang berarti kehilangan
  // catatan justru saat gateway berperilaku aneh.
  const { did } = await siapkanPengiriman("Teguh Wibowo");
  await catat(did, "gagal", "Galat", "x".repeat(5000));
  const { rows } = await sebagaiAdmin(
    db,
    "select length(balasan) as n from notification_delivery_attempts where delivery_id = $1",
    [did],
  );
  harusSama(Number(rows[0].n), 2000);
});

uji("Log tidak bisa diubah maupun dihapus pengguna", async () => {
  const { uid, did } = await siapkanPengiriman("Nabila Putri");
  await catat(did, "gagal", "Timeout");

  await sebagai(
    db,
    uid,
    "update notification_delivery_attempts set galat = 'diubah' where delivery_id = $1",
    [did],
  );
  await sebagai(
    db,
    uid,
    "delete from notification_delivery_attempts where delivery_id = $1",
    [did],
  );

  const { rows } = await sebagaiAdmin(
    db,
    "select galat from notification_delivery_attempts where delivery_id = $1 order by urutan",
    [did],
  );
  harus(rows.length > 0, "log seharusnya tidak terhapus");
  harus(
    rows.every((r) => r.galat !== "diubah"),
    "log seharusnya tidak berubah",
  );
});

uji("Pemilik notifikasi boleh menelusuri percobaannya", async () => {
  const { uid, did } = await siapkanPengiriman("Nabila Putri");
  await catat(did, "gagal", "Timeout");
  const { rows } = await sebagai(
    db,
    uid,
    "select count(*)::int as n from notification_delivery_attempts where delivery_id = $1",
    [did],
  );
  harus(rows[0].n > 0, "pemiliknya seharusnya bisa melihat");
});

uji("Orang lain tidak bisa menelusuri percobaan yang bukan miliknya", async () => {
  const { did } = await siapkanPengiriman("Nabila Putri");
  await catat(did, "gagal", "Timeout");
  const lain = await id("Rian Hidayat");
  const { rows } = await sebagai(
    db,
    lain,
    "select count(*)::int as n from notification_delivery_attempts where delivery_id = $1",
    [did],
  );
  harusSama(rows[0].n, 0);
});

uji("Pengguna tidak bisa mencatat percobaan sendiri", async () => {
  const { uid, did } = await siapkanPengiriman("Nabila Putri");
  await harusDitolak(
    () =>
      sebagai(db, uid, "select catat_percobaan_kirim($1, 'terkirim', '', '')", [
        did,
      ]),
    "pencatatan oleh pengguna seharusnya ditolak",
  );
});

await jalankan();
