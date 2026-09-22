/**
 * Verifikasi jumlah baris: membuktikan barisnya ada, bukan sekadar
 * membandingkan dua angka.
 */
import {
  buatDb,
  buatSuite,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Verifikasi migrasi");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

let jalan;

uji("menyiapkan satu jalan migrasi berisi catatan", async () => {
  const manajer = await id("Farhan Pratama");
  const { rows } = await sebagai(
    db,
    manajer,
    "select (mulai_migrasi_jalan('uji_coba'::tahap_migrasi)).id",
  );
  jalan = rows[0].id;

  const adaUser = await id("Nabila Putri");
  await sebagaiAdmin(
    db,
    `insert into migrasi_catatan (jalan_id, entitas, kunci_lama, id_baru, status) values
       ($1, 'user', 'user:ada', $2, 'berhasil'),
       ($1, 'user', 'user:hilang', '00000000-0000-4000-8000-000000000001', 'berhasil'),
       ($1, 'user', 'user:tanpa-id', null, 'berhasil'),
       ($1, 'user', 'user:gagal', null, 'gagal')`,
    [jalan, adaUser],
  );
  harusSama(
    Number(
      (await sebagaiAdmin(db, "select count(*)::int n from migrasi_catatan where jalan_id = $1", [jalan]))
        .rows[0].n,
    ),
    4,
  );
});

uji("baris yang benar-benar ada dihitung terpisah dari yang hilang", async () => {
  const { rows } = await sebagaiAdmin(db, "select * from verifikasi_migrasi($1)", [jalan]);
  harusSama(rows.length, 1);
  harusSama(rows[0].entitas, "user");
  harusSama(rows[0].berhasil, 3, "yang gagal tidak ikut dihitung");
  harusSama(rows[0].ada_di_tujuan, 1);
  harusSama(rows[0].tanpa_id, 1, "berhasil tanpa id tidak bisa dibuktikan");
  harusSama(rows[0].hilang, 1, "id yang tidak ada di tujuan berarti hilang");
});

uji("baris baru buatan orang tidak ikut terhitung sebagai hasil migrasi", async () => {
  // Inilah sebab jumlah seluruh tabel tujuan tidak bisa dipakai: ia ikut
  // membengkak oleh pekerjaan sesudah migrasi.
  const sebelum = (
    await sebagaiAdmin(db, "select ada_di_tujuan from verifikasi_migrasi($1)", [jalan])
  ).rows[0].ada_di_tujuan;

  await sebagaiAdmin(
    db,
    `insert into users (id, nama, email, role, jabatan, unit_id)
     values (gen_random_uuid(), 'Pegawai Baru', 'pegawaibaru@alkahfi.co.id', 'Staff', 'Staff TAP',
             (select id from units where kode = 'tap'))`,
  );

  harusSama(
    (await sebagaiAdmin(db, "select ada_di_tujuan from verifikasi_migrasi($1)", [jalan]))
      .rows[0].ada_di_tujuan,
    sebelum,
  );
});

uji("tanpa jalan yang disebut, yang dipakai jalan terbaru", async () => {
  const { rows } = await sebagaiAdmin(db, "select * from verifikasi_migrasi()");
  harusSama(rows.length, 1);
  harusSama(rows[0].entitas, "user");
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
