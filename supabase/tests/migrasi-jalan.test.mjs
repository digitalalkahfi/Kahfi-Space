/** Jalan migrasi: satu yang terbuka, dan yang sudah ditutup bersifat final. */
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
const { uji, jalankan } = buatSuite("Jalan migrasi");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const buatJalan = async (tahap = "uji_coba") =>
  (
    await sebagaiAdmin(
      db,
      "insert into migrasi_jalan (tahap) values ($1) returning id",
      [tahap],
    )
  ).rows[0].id;

uji("hanya satu jalan boleh terbuka", async () => {
  // Dua jalan terbuka membelah catatannya; ringkasan lalu melaporkan
  // migrasi yang tampak setengah padahal utuh.
  await buatJalan();
  await harusDitolak(
    () => buatJalan("sungguhan"),
    "jalan kedua saat masih ada yang terbuka seharusnya ditolak",
  );
});

uji("jalan tidak bisa ditutup selagi ada catatan menunggu", async () => {
  const jalan = (
    await sebagaiAdmin(db, "select id from migrasi_jalan where selesai_pada is null")
  ).rows[0].id;
  await sebagaiAdmin(
    db,
    `insert into migrasi_catatan (jalan_id, entitas, kunci_lama, status)
     values ($1, 'users', 'lama:1', 'menunggu')`,
    [jalan],
  );
  await harusDitolak(
    async () => sebagai(db, await id("Farhan Pratama"), "select tutup_migrasi_jalan($1)", [jalan]),
    "penutupan dengan sisa menunggu seharusnya ditolak",
  );
});

uji("Staff tidak boleh menutup jalan migrasi", async () => {
  const jalan = (
    await sebagaiAdmin(db, "select id from migrasi_jalan where selesai_pada is null")
  ).rows[0].id;
  await harusDitolak(
    async () => sebagai(db, await id("Nabila Putri"), "select tutup_migrasi_jalan($1)", [jalan]),
    "penutupan oleh Staff seharusnya ditolak",
  );
});

uji("Manager menutup jalan setelah semua catatan selesai", async () => {
  const jalan = (
    await sebagaiAdmin(db, "select id from migrasi_jalan where selesai_pada is null")
  ).rows[0].id;
  await sebagaiAdmin(
    db,
    "update migrasi_catatan set status = 'berhasil' where jalan_id = $1",
    [jalan],
  );
  await sebagai(db, await id("Farhan Pratama"), "select tutup_migrasi_jalan($1)", [jalan]);

  const { rows } = await sebagaiAdmin(
    db,
    "select selesai_pada from migrasi_jalan where id = $1",
    [jalan],
  );
  harus(rows[0].selesai_pada !== null, "waktu selesainya harus tercatat");
});

uji("catatan tidak bisa ditambahkan ke jalan yang sudah ditutup", async () => {
  const jalan = (
    await sebagaiAdmin(
      db,
      "select id from migrasi_jalan where selesai_pada is not null order by selesai_pada desc limit 1",
    )
  ).rows[0].id;
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into migrasi_catatan (jalan_id, entitas, kunci_lama, status)
         values ($1, 'users', 'lama:2', 'berhasil')`,
        [jalan],
      ),
    "catatan susulan pada jalan tertutup seharusnya ditolak",
  );
});

uji("catatan jalan tertutup tidak bisa diubah", async () => {
  // Menghapusnya tetap boleh — itu pembersihan arsip, bukan pemalsuan.
  const jalan = (
    await sebagaiAdmin(
      db,
      "select id from migrasi_jalan where selesai_pada is not null order by selesai_pada desc limit 1",
    )
  ).rows[0].id;
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "update migrasi_catatan set status = 'gagal' where jalan_id = $1",
        [jalan],
      ),
    "perubahan catatan jalan tertutup seharusnya ditolak",
  );
});

uji("jalan berikutnya boleh dibuka setelah yang lama ditutup", async () => {
  const baru = await buatJalan("sungguhan");
  harus(baru !== undefined, "jalan baru harus terbentuk");

  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int n from migrasi_jalan where selesai_pada is null",
  );
  harusSama(rows[0].n, 1, "tetap hanya satu jalan terbuka");
});

uji("ringkasan membaca jalan terbaru", async () => {
  const jalan = (
    await sebagaiAdmin(db, "select id from migrasi_jalan where selesai_pada is null")
  ).rows[0].id;
  await sebagaiAdmin(
    db,
    `insert into migrasi_catatan (jalan_id, entitas, kunci_lama, status) values
       ($1, 'attendance', 'absen:1', 'berhasil'),
       ($1, 'attendance', 'absen:2', 'gagal')`,
    [jalan],
  );

  const { rows } = await sebagaiAdmin(
    db,
    "select * from ringkas_migrasi() where entitas = 'attendance'",
  );
  harusSama(rows.length, 1);
  harusSama(rows[0].total, 2);
  harusSama(rows[0].berhasil, 1);
  harusSama(rows[0].gagal, 1);
  await terapkanSeed(db);
});

uji("persetujuan menyimpan isi pemetaannya, bukan hanya sidik", async () => {
  // Pemetaan hidup di kode dan ikut berubah tiap rilis; tanpa salinan ini
  // tidak ada cara mengetahui bentuk yang pernah disetujui.
  const manajer = await id("Farhan Pratama");
  await sebagai(
    db,
    manajer,
    `insert into migrasi_persetujuan (entitas, versi, disetujui_oleh, pemetaan)
     values ('user', 'abc123', $1, $2::jsonb)`,
    [manajer, JSON.stringify({ kunci: "user", baris: [{ medanLama: "nama_lengkap", kolomBaru: "nama" }] })],
  );

  const { rows } = await sebagaiAdmin(
    db,
    "select pemetaan from migrasi_persetujuan where entitas = 'user' and versi = 'abc123'",
  );
  harusSama(rows[0].pemetaan.baris[0].kolomBaru, "nama");
});

uji("persetujuan tidak bisa disunting, hanya ditarik", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "update migrasi_persetujuan set catatan = 'diubah' where versi = 'abc123'",
      ),
    "penyuntingan persetujuan seharusnya ditolak",
  );

  const manajer = await id("Farhan Pratama");
  await sebagai(db, manajer, "delete from migrasi_persetujuan where versi = 'abc123'");
  harusSama(
    Number(
      (await sebagaiAdmin(db, "select count(*)::int n from migrasi_persetujuan where versi = 'abc123'"))
        .rows[0].n,
    ),
    0,
    "menarik persetujuan tetap harus bisa",
  );
});

uji("jalan migrasi mencatat pemetaan yang dipakainya", async () => {
  // Jalan sebelumnya ditutup dulu: hanya satu boleh terbuka (0073).
  await sebagaiAdmin(
    db,
    "update migrasi_jalan set selesai_pada = now() where selesai_pada is null",
  );
  const jalan = (
    await sebagaiAdmin(
      db,
      `insert into migrasi_jalan (tahap, pemetaan)
       values ('uji_coba', $1::jsonb) returning id, pemetaan`,
      [JSON.stringify([{ kunci: "user", tabelBaru: "users" }])],
    )
  ).rows[0];
  harusSama(jalan.pemetaan[0].tabelBaru, "users");
  await sebagaiAdmin(db, "delete from migrasi_jalan where id = $1", [jalan.id]);
  await terapkanSeed(db);
});

uji("migrasi sungguhan menolak jalan tanpa uji coba lebih dulu", async () => {
  await sebagaiAdmin(db, "delete from migrasi_catatan");
  await sebagaiAdmin(db, "delete from migrasi_jalan");
  const manajer = await id("Farhan Pratama");

  await harusDitolak(
    async () =>
      sebagai(db, manajer, "select mulai_migrasi_jalan('sungguhan'::tahap_migrasi)"),
    "migrasi sungguhan tanpa gladi bersih seharusnya ditolak",
  );
});

uji("uji coba boleh diulang-ulang", async () => {
  await sebagaiAdmin(db, "delete from migrasi_catatan");
  await sebagaiAdmin(db, "delete from migrasi_jalan");
  const manajer = await id("Farhan Pratama");
  for (let i = 0; i < 2; i += 1) {
    const { rows } = await sebagai(
      db,
      manajer,
      "select (mulai_migrasi_jalan('uji_coba'::tahap_migrasi)).id",
    );
    await sebagai(db, manajer, "select tutup_migrasi_jalan($1)", [rows[0].id]);
  }
  harusSama(
    Number(
      (await sebagaiAdmin(db, "select count(*)::int n from migrasi_jalan where tahap = 'uji_coba'"))
        .rows[0].n,
    ),
    2,
  );
});

uji("migrasi sungguhan menolak jalan selagi data lama belum tersalin", async () => {
  // Selagi kv_store_lama kosong, yang terbaca aplikasi adalah berkas
  // contoh. Menjalankan tahap sungguhan di atasnya menulis baris
  // karangan ke tabel sungguhan — dan sungguhan hanya boleh sekali.
  await sebagaiAdmin(db, "delete from migrasi_catatan");
  await sebagaiAdmin(db, "delete from migrasi_jalan");
  await sebagaiAdmin(db, "delete from kv_store_lama");
  const manajer = await id("Farhan Pratama");
  const gladi = await sebagai(
    db,
    manajer,
    "select (mulai_migrasi_jalan('uji_coba'::tahap_migrasi)).id",
  );
  await sebagai(db, manajer, "select tutup_migrasi_jalan($1)", [
    gladi.rows[0].id,
  ]);

  await harusDitolak(
    () =>
      sebagai(db, manajer, "select mulai_migrasi_jalan('sungguhan'::tahap_migrasi)"),
    "sungguhan di atas data tiruan seharusnya ditolak",
  );
});

uji("migrasi sungguhan hanya sekali", async () => {
  // Menjalankannya lagi akan menimpa perbaikan yang sudah dikerjakan
  // orang di data baru.
  await sebagaiAdmin(db, "delete from migrasi_catatan");
  await sebagaiAdmin(db, "delete from migrasi_jalan");
  await sebagaiAdmin(
    db,
    `insert into kv_store_lama (key, value)
     values ('user:1', '{"nama_lengkap":"Uji"}'::jsonb)
     on conflict (key) do nothing`,
  );
  const manajer = await id("Farhan Pratama");
  const gladi = await sebagai(
    db,
    manajer,
    "select (mulai_migrasi_jalan('uji_coba'::tahap_migrasi)).id",
  );
  await sebagai(db, manajer, "select tutup_migrasi_jalan($1)", [gladi.rows[0].id]);
  const { rows } = await sebagai(
    db,
    manajer,
    "select (mulai_migrasi_jalan('sungguhan'::tahap_migrasi)).id",
  );
  await sebagai(db, manajer, "select tutup_migrasi_jalan($1)", [rows[0].id]);

  await harusDitolak(
    async () =>
      sebagai(db, manajer, "select mulai_migrasi_jalan('sungguhan'::tahap_migrasi)"),
    "migrasi sungguhan kedua seharusnya ditolak",
  );
});

uji("Staff tidak boleh memulai migrasi", async () => {
  await sebagaiAdmin(db, "delete from kv_store_lama");
  const staf = await id("Nabila Putri");
  await harusDitolak(
    () => sebagai(db, staf, "select mulai_migrasi_jalan('uji_coba'::tahap_migrasi)"),
    "pemulaian oleh Staff seharusnya ditolak",
  );
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
