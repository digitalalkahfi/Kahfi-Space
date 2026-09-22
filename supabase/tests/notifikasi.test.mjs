/** Tabel notifikasi: kepemilikan, pagar kolom, dan tautan (0111). */
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
const { uji, jalankan } = buatSuite("Notifikasi");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const terbitkan = async (untuk, kategori = "tugas", tautan = "/tugas") =>
  (
    await sebagaiAdmin(
      db,
      "select terbitkan_notifikasi($1, $2, $3, $4, $5) as id",
      [untuk, kategori, "Judul uji", "Pesan uji", tautan],
    )
  ).rows[0].id;

uji("Notifikasi hanya terlihat oleh penerimanya", async () => {
  const rian = await id("Rian Hidayat");
  const nabila = await id("Nabila Putri");
  await terbitkan(rian);

  const milikRian = await sebagai(
    db,
    rian,
    "select count(*)::int as n from notifications",
  );
  harus(milikRian.rows[0].n > 0, "penerima seharusnya melihat notifikasinya");

  const milikNabila = await sebagai(
    db,
    nabila,
    "select count(*)::int as n from notifications where user_id = $1",
    [rian],
  );
  harusSama(milikNabila.rows[0].n, 0);
});

uji("Manager pun tidak bisa membaca kotak masuk orang lain", async () => {
  // Lintas-unit berarti boleh melihat ANGKA unit lain, bukan boleh
  // membaca notifikasi pribadi orang lain.
  const rian = await id("Rian Hidayat");
  const manajer = await id("Farhan Pratama");
  await terbitkan(rian);

  const { rows } = await sebagai(
    db,
    manajer,
    "select count(*)::int as n from notifications where user_id = $1",
    [rian],
  );
  harusSama(rows[0].n, 0);
});

uji("Penerima boleh menandai sudah dibaca", async () => {
  const rian = await id("Rian Hidayat");
  const nId = await terbitkan(rian);

  await sebagai(
    db,
    rian,
    "update notifications set dibaca_pada = now() where id = $1",
    [nId],
  );
  const { rows } = await sebagaiAdmin(
    db,
    "select dibaca_pada from notifications where id = $1",
    [nId],
  );
  harus(rows[0].dibaca_pada !== null, "penandaan seharusnya tersimpan");
});

uji("Penerima tidak bisa mengubah isi notifikasinya", async () => {
  const rian = await id("Rian Hidayat");
  const nId = await terbitkan(rian);

  for (const [kolom, nilai] of [
    ["judul", "'Judul karangan'"],
    ["pesan", "'Pesan karangan'"],
    ["tautan", "'/keuangan'"],
    ["kategori", "'transaksi'"],
  ]) {
    await harusDitolak(
      () =>
        sebagai(
          db,
          rian,
          `update notifications set ${kolom} = ${nilai} where id = $1`,
          [nId],
        ),
      `${kolom} seharusnya ditolak`,
    );
  }
});

uji("Pengguna tidak bisa menerbitkan notifikasi untuk dirinya sendiri", async () => {
  // Kalau bisa, jejak keputusan bisa dipalsukan: "sudah diberi tahu".
  const rian = await id("Rian Hidayat");
  await harusDitolak(
    () =>
      sebagai(
        db,
        rian,
        `insert into notifications (user_id, kategori, judul, tautan)
         values ($1, 'tugas', 'Palsu', '/tugas')`,
        [rian],
      ),
    "INSERT oleh pengguna seharusnya ditolak",
  );
});

uji("Pengguna tidak bisa menghapus notifikasinya", async () => {
  const rian = await id("Rian Hidayat");
  const nId = await terbitkan(rian);
  await sebagai(db, rian, "delete from notifications where id = $1", [nId]);
  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from notifications where id = $1",
    [nId],
  );
  harusSama(rows[0].n, 1);
});

uji("Tautan ke luar aplikasi ditolak basis data", async () => {
  const rian = await id("Rian Hidayat");
  for (const tautan of [
    "https://jahat.example.com",
    "//jahat.example.com",
    "javascript:alert(1)",
    "tugas",
    "/ada spasi",
  ]) {
    await harusDitolak(
      () => terbitkan(rian, "tugas", tautan),
      `tautan "${tautan}" seharusnya ditolak`,
    );
  }
  // Yang internal tetap diterima.
  harus(
    (await terbitkan(rian, "tugas", "/keuangan/transaksi?periode=bulanan")) !==
      null,
    "tautan internal seharusnya diterima",
  );
});

uji("Judul kosong ditolak", async () => {
  const rian = await id("Rian Hidayat");
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into notifications (user_id, kategori, judul, tautan)
         values ($1, 'tugas', '   ', '/tugas')`,
        [rian],
      ),
    "judul kosong seharusnya ditolak",
  );
});

uji("Dibaca tidak boleh mendahului terbitnya", async () => {
  const rian = await id("Rian Hidayat");
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into notifications (user_id, kategori, judul, tautan, dibaca_pada)
         values ($1, 'tugas', 'Judul', '/tugas', now() - interval '1 day')`,
        [rian],
      ),
    "dibaca sebelum terbit seharusnya ditolak",
  );
});

uji("Menonaktifkan orang tidak menghapus notifikasinya", async () => {
  // Pengguna tidak pernah benar-benar dihapus lewat aplikasi — RLS
  // `users` tidak punya policy DELETE sama sekali; yang dilakukan
  // pengelola adalah menonaktifkan. Karena itu notifikasinya tetap ada,
  // dan itu memang yang diinginkan: jejak "sudah diberi tahu" tidak
  // boleh hilang ketika seseorang keluar.
  const rian = await id("Rian Hidayat");
  const nId = await terbitkan(rian);

  await sebagaiAdmin(db, "update users set status = 'nonaktif' where id = $1", [
    rian,
  ]);
  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from notifications where id = $1",
    [nId],
  );
  harusSama(rows[0].n, 1);
  await terapkanSeed(db);
});

uji("Penerima yang tidak ada tidak menggagalkan penerbitan", async () => {
  // Tugas tetap harus tersimpan walau notifikasinya gagal terbit.
  const { rows } = await sebagaiAdmin(
    db,
    "select terbitkan_notifikasi(null, 'tugas', 'Judul', 'Pesan', '/tugas') as id",
  );
  harusSama(rows[0].id, null);
});

uji("Pengguna tidak bisa memanggil terbitkan_notifikasi langsung", async () => {
  // Trigger boleh (peristiwanya memang sedang terjadi); panggilan
  // langsung oleh klien tidak — itu jalan memalsukan jejak "sudah
  // diberi tahu".
  const rian = await id("Rian Hidayat");
  const nabila = await id("Nabila Putri");
  await harusDitolak(
    () =>
      sebagai(
        db,
        rian,
        "select terbitkan_notifikasi($1, 'tugas', 'Palsu', 'Palsu', '/tugas')",
        [nabila],
      ),
    "panggilan langsung oleh pengguna seharusnya ditolak",
  );
});

await jalankan();
