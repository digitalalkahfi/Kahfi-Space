/** Kolom profil yang boleh diubah sendiri, dan yang tetap milik pengelola (0108). */
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
const { uji, jalankan } = buatSuite("Profil & kontak");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

uji("Staff boleh merapikan nama, foto, dan nomor kontaknya sendiri", async () => {
  const diri = await id("Rian Hidayat");
  await sebagai(
    db,
    diri,
    "update users set nama = $1, foto_url = $2, kontak = $3 where id = $4",
    ["Rian Hidayat Saputra", "https://contoh/foto.png", "+628123456789", diri],
  );
  const { rows } = await sebagaiAdmin(
    db,
    "select nama, foto_url, kontak from users where id = $1",
    [diri],
  );
  harusSama(rows[0].nama, "Rian Hidayat Saputra");
  harusSama(rows[0].kontak, "+628123456789");
  harus(rows[0].foto_url !== null, "foto seharusnya tersimpan");
  await terapkanSeed(db);
});

uji("Nomor yang bukan bentuk baku ditolak basis data", async () => {
  const diri = await id("Rian Hidayat");
  // Aplikasi menormalkan sebelum menyimpan; CHECK ini yang memastikan
  // tidak ada jalan lain yang melewatkannya.
  for (const buruk of [
    "08123456789", // belum dinormalkan
    "628123456789", // tanpa tanda plus
    "+6221555123", // nomor rumah, bukan seluler
    "+14155550100", // bukan Indonesia
    "+62812", // terlalu pendek
    "+62812345678901234", // terlalu panjang
    "bukan nomor",
  ]) {
    await harusDitolak(
      () =>
        sebagaiAdmin(db, "update users set kontak = $1 where id = $2", [
          buruk,
          diri,
        ]),
      `nomor "${buruk}" seharusnya ditolak`,
    );
  }
});

uji("Nomor boleh dikosongkan", async () => {
  const diri = await id("Rian Hidayat");
  await sebagaiAdmin(db, "update users set kontak = null where id = $1", [diri]);
  const { rows } = await sebagaiAdmin(
    db,
    "select kontak from users where id = $1",
    [diri],
  );
  harusSama(rows[0].kontak, null);
});

uji("Staff tidak boleh memindahkan dirinya ke program lain", async () => {
  // Celah yang tersisa dari 0041: `program_id` disebut PRD sebagai milik
  // pengelola tetapi belum ikut dijaga trigger sampai 0108.
  const diri = await id("Rian Hidayat");
  await harusDitolak(
    () =>
      sebagai(
        db,
        diri,
        "update users set program_id = (select id from programs limit 1) where id = $1",
        [diri],
      ),
    "Staff seharusnya tidak bisa berpindah program sendiri",
  );
});

uji("Staff tidak boleh memindahkan dirinya ke departemen lain", async () => {
  const diri = await id("Rian Hidayat");
  await harusDitolak(
    () =>
      sebagai(
        db,
        diri,
        "update users set department_id = (select id from departments limit 1) where id = $1",
        [diri],
      ),
    "Staff seharusnya tidak bisa berpindah departemen sendiri",
  );
});

uji("Manager tetap boleh menetapkan program anggotanya", async () => {
  const manajer = await id("Farhan Pratama");
  const target = await id("Rian Hidayat");
  await sebagai(
    db,
    manajer,
    "update users set program_id = (select id from programs where nama = 'Mabit Scholar') where id = $1",
    [target],
  );
  const { rows } = await sebagaiAdmin(
    db,
    "select program_id from users where id = $1",
    [target],
  );
  harus(rows[0].program_id !== null, "Manager seharusnya bisa menetapkan program");
  await terapkanSeed(db);
});

uji("Staff tidak boleh mengubah nomor kontak orang lain", async () => {
  const diri = await id("Rian Hidayat");
  const orangLain = await id("Nabila Putri");
  await sebagai(db, diri, "update users set kontak = $1 where id = $2", [
    "+628999999999",
    orangLain,
  ]);
  const { rows } = await sebagaiAdmin(
    db,
    "select kontak from users where id = $1",
    [orangLain],
  );
  harus(
    rows[0].kontak !== "+628999999999",
    "RLS seharusnya menutup baris orang lain",
  );
});

/**
 * Pagar menyeluruh: setiap kolom milik pengelola ditolak satu per satu.
 *
 * Ditulis sebagai tabel, bukan tujuh uji terpisah, supaya kolom baru
 * yang lupa dijaga langsung terlihat sebagai baris yang hilang di sini.
 */
const TERKUNCI = [
  ["role", "'Manager'"],
  ["unit_id", "(select id from units where kode = 'tap')"],
  ["program_id", "(select id from programs limit 1)"],
  ["department_id", "(select id from departments limit 1)"],
  ["atasan_id", "(select id from users where nama = 'Hafidz Alkahfi')"],
  ["jabatan", "'Jabatan Karangan'"],
  ["status", "'nonaktif'"],
  ["email", "'lain@alkahfi.co.id'"],
  ["created_at", "'2001-01-01T00:00:00Z'"],
];

for (const [kolom, nilai] of TERKUNCI) {
  uji(`Staff tidak boleh mengubah ${kolom} pada dirinya sendiri`, async () => {
    const diri = await id("Rian Hidayat");
    await harusDitolak(
      () =>
        sebagai(db, diri, `update users set ${kolom} = ${nilai} where id = $1`, [
          diri,
        ]),
      `${kolom} seharusnya ditolak trigger jaga_ubah_diri`,
    );
  });
}

const BOLEH_SENDIRI = [
  ["nama", "'Rian Hidayat'"],
  ["foto_url", "'https://contoh/foto.png'"],
  ["kontak", "'+628123456789'"],
];

for (const [kolom, nilai] of BOLEH_SENDIRI) {
  uji(`Staff tetap boleh mengubah ${kolom} pada dirinya sendiri`, async () => {
    const diri = await id("Rian Hidayat");
    await sebagai(db, diri, `update users set ${kolom} = ${nilai} where id = $1`, [
      diri,
    ]);
    const { rows } = await sebagaiAdmin(
      db,
      `select ${kolom} as nilai from users where id = $1`,
      [diri],
    );
    harus(rows[0].nilai !== null, `${kolom} seharusnya tersimpan`);
    await terapkanSeed(db);
  });
}

await jalankan();
