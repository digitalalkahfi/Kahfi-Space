/**
 * Kelola Anggota Tim: hanya CEO/Manager yang boleh mengubah kepegawaian.
 *
 * RLS tidak menolak UPDATE dengan galat — baris yang tak boleh disentuh
 * sekadar tidak ikut terpengaruh. Karena itu sebagian besar uji di sini
 * memeriksa datanya sesudah percobaan, bukan ada-tidaknya galat.
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
const { uji, jalankan } = buatSuite("Otorisasi anggota tim");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const nilai = async (kolom, nama) =>
  (await sebagaiAdmin(db, `select ${kolom} v from users where nama = $1`, [nama]))
    .rows[0].v;

uji("direktori nama terbuka untuk semua yang sudah masuk", async () => {
  // Memilih penerima tiket lintas unit butuh daftar nama; yang sensitif
  // per orang ada di tabel lain yang RLS-nya lebih ketat.
  const staf = await id("Nabila Putri");
  const { rows } = await sebagai(db, staf, "select count(*)::int n from users");
  const total = Number(
    (await sebagaiAdmin(db, "select count(*)::int n from users")).rows[0].n,
  );
  harusSama(Number(rows[0].n), total);
});

uji("Staff boleh merapikan namanya sendiri", async () => {
  const staf = await id("Nabila Putri");
  await sebagai(db, staf, "update users set nama = 'Nabila Putri S.' where id = $1", [
    staf,
  ]);
  harusSama(await nilai("nama", "Nabila Putri S."), "Nabila Putri S.");
  await terapkanSeed(db);
});

uji("Staff tidak bisa menaikkan perannya sendiri", async () => {
  const staf = await id("Nabila Putri");
  await harusDitolak(
    () => sebagai(db, staf, "update users set role = 'Manager' where id = $1", [staf]),
    "kenaikan peran sendiri seharusnya ditolak",
  );
  harusSama(await nilai("role", "Nabila Putri"), "Staff");
});

uji("Staff tidak bisa memindahkan dirinya ke unit lain", async () => {
  const staf = await id("Nabila Putri");
  const mcn = (await sebagaiAdmin(db, "select id from units where kode = 'mcn'")).rows[0].id;
  await harusDitolak(
    () => sebagai(db, staf, "update users set unit_id = $1 where id = $2", [mcn, staf]),
    "pindah unit sendiri seharusnya ditolak",
  );
});

uji("Staff tidak bisa mengangkat atasannya sendiri", async () => {
  const staf = await id("Nabila Putri");
  const ceo = await id("Hafidz Alkahfi");
  await harusDitolak(
    () => sebagai(db, staf, "update users set atasan_id = $1 where id = $2", [ceo, staf]),
    "penetapan atasan sendiri seharusnya ditolak",
  );
});

uji("Staff tidak bisa mengaktifkan kembali dirinya", async () => {
  const orang = await id("Yusuf Ramadhan"); // nonaktif di data contoh
  await sebagaiAdmin(db, "update users set status = 'nonaktif' where id = $1", [orang]);
  await harusDitolak(
    () => sebagai(db, orang, "update users set status = 'aktif' where id = $1", [orang]),
    "mengaktifkan diri sendiri seharusnya ditolak",
  );
  harusSama(await nilai("status", "Yusuf Ramadhan"), "nonaktif");
  await terapkanSeed(db);
});

uji("Leader tidak bisa mengubah data anggota unitnya", async () => {
  const leader = await id("Dewi Lestari");
  await sebagai(
    db,
    leader,
    "update users set jabatan = 'Diubah Leader' where nama = 'Nabila Putri'",
  );
  harus(
    (await nilai("jabatan", "Nabila Putri")) !== "Diubah Leader",
    "jabatan anggota tidak boleh tersentuh Leader",
  );
});

uji("Leader tidak bisa menambah anggota", async () => {
  const leader = await id("Dewi Lestari");
  const unit = (await sebagaiAdmin(db, "select id from units where kode = 'affiliator'"))
    .rows[0].id;
  await harusDitolak(
    () =>
      sebagai(
        db,
        leader,
        `insert into users (id, nama, email, role, jabatan, unit_id)
         values (gen_random_uuid(), 'Rekrutan Leader', 'rekrut@alkahfi.co.id',
                 'Staff', 'Staff Affiliator', $1)`,
        [unit],
      ),
    "penambahan anggota oleh Leader seharusnya ditolak",
  );
});

uji("Manager boleh menambah dan menonaktifkan anggota", async () => {
  const manajer = await id("Farhan Pratama");
  const unit = (await sebagaiAdmin(db, "select id from units where kode = 'tap'"))
    .rows[0].id;

  await sebagai(
    db,
    manajer,
    `insert into users (id, nama, email, role, jabatan, unit_id)
     values (gen_random_uuid(), 'Rekrutan Manager', 'rekrutmanager@alkahfi.co.id',
             'Staff', 'Staff TAP', $1)`,
    [unit],
  );
  harusSama(await nilai("status", "Rekrutan Manager"), "aktif");

  await sebagai(
    db,
    manajer,
    "update users set status = 'nonaktif' where nama = 'Rekrutan Manager'",
  );
  harusSama(await nilai("status", "Rekrutan Manager"), "nonaktif");
  await terapkanSeed(db);
});

uji("anggota tidak bisa dihapus, bahkan oleh pemilik basis data", async () => {
  // Riwayat absensi dan KPI-nya menggantung di sana; jalan yang benar
  // adalah menonaktifkan. Yang diperiksa hasilnya — barisnya harus tetap
  // ada — sebab penolakan pada BEFORE DELETE tampil sebagai penghapusan
  // yang tidak mengenai baris apa pun, bukan sebagai galat.
  const manajer = await id("Farhan Pratama");
  await sebagai(db, manajer, "delete from users where nama = 'Nabila Putri'");
  await sebagaiAdmin(db, "delete from users where nama = $1", ["Nabila Putri"]);

  harusSama(
    Number(
      (await sebagaiAdmin(db, "select count(*)::int n from users where nama = 'Nabila Putri'"))
        .rows[0].n,
    ),
    1,
    "anggotanya harus tetap ada",
  );
  harusSama(
    Number(
      (await sebagaiAdmin(db, "select count(*)::int n from attendance a join users u on u.id = a.user_id where u.nama = 'Nabila Putri'"))
        .rows[0].n,
    ) > 0,
    true,
    "riwayat absensinya ikut selamat",
  );
});

uji("pengelola terakhir tidak bisa mundur sendirian", async () => {
  // Tanpa penjagaan ini, satu klik bisa membuat aplikasi tak punya siapa
  // pun yang berwenang menambah anggota lagi.
  await sebagaiAdmin(db, "update users set status = 'nonaktif' where nama = 'Hafidz Alkahfi'");
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "update users set status = 'nonaktif' where nama = 'Farhan Pratama'",
      ),
    "penonaktifan pengelola terakhir seharusnya ditolak",
  );
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
