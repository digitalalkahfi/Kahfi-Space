/**
 * Absen ulang (migrasi 0171): catatan masuk/pulang hari ini boleh
 * dikosongkan pemiliknya sendiri supaya bisa diabsen lagi — untuk GPS
 * yang meleset. Syarat, batas, dan jejaknya dijaga database.
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
const { uji, jalankan } = buatSuite("Absen ulang");

const idUser = async (n) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [n])).rows[0]
    .id;

const ANISA = await idUser("Anisa Larasati"); // tidak wajib lapor
const EKO = await idUser("Eko Prasetyo");
const KANTOR = { lat: -6.2607, lng: 106.8106 };
const JAUH = { lat: -6.3, lng: 106.9 };

/** Hari ini menurut WIB — yang dipakai fungsi database. */
const HARI = (
  await sebagaiAdmin(
    db,
    `select to_char((now() at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD') h`,
  )
).rows[0].h;

const baris = async (user = ANISA) =>
  (
    await sebagaiAdmin(
      db,
      `select jam_masuk, jam_pulang, status, lokasi_valid, jarak_masuk_m,
              foto_masuk_url, ulang_masuk, ulang_pulang, ulang_terakhir
         from attendance where user_id=$1 and tanggal=$2`,
      [user, HARI],
    )
  ).rows[0];

const ulang = (user, tahap) =>
  sebagai(db, user, `select * from absen_ulang($1)`, [tahap]);

/** Absen masuk seperti yang dilakukan aksi aplikasi: isi baris bila ada. */
async function absenMasuk(user, titik) {
  const ada = (
    await sebagaiAdmin(
      db,
      `select id, jam_masuk, status from attendance where user_id=$1 and tanggal=$2`,
      [user, HARI],
    )
  ).rows[0];
  if (ada) {
    return sebagai(
      db,
      user,
      `update attendance
          set jam_masuk = now(), lat_masuk = $2, lng_masuk = $3,
              foto_masuk_url = 'foto-baru.jpg', status = 'hadir'
        where id = $1`,
      [ada.id, titik.lat, titik.lng],
    );
  }
  return sebagai(
    db,
    user,
    `insert into attendance (user_id, tanggal, jam_masuk, lat_masuk, lng_masuk, foto_masuk_url)
     values ($1, $2, now(), $3, $4, 'foto-lama.jpg')`,
    [user, HARI, titik.lat, titik.lng],
  );
}

uji("tanpa catatan hari ini, absen ulang ditolak", async () => {
  await harusDitolak(() => ulang(ANISA, "masuk"), "belum ada catatan hari ini");
});

uji("absen masuk yang salah lokasi bisa dikosongkan pemiliknya", async () => {
  await absenMasuk(ANISA, JAUH);
  harusSama((await baris()).lokasi_valid, false, "tercatat di luar radius");

  const { rows } = await ulang(ANISA, "masuk");
  harus(rows[0].jam_lama !== null, "jam lama dikembalikan untuk pesan");
  harusSama(rows[0].sisa, 2);

  const b = await baris();
  harusSama(b.jam_masuk, null);
  harusSama(b.foto_masuk_url, null);
  harusSama(b.jarak_masuk_m, null);
  harusSama(b.lokasi_valid, false);
  harusSama(b.status, "alpa", "menunggu absen berikutnya = belum absen");
  harusSama(b.ulang_masuk, 1);
  harus(b.ulang_terakhir !== null, "jejak waktunya tercatat");
});

uji(
  "status tim membaca baris yang dikosongkan sebagai belum absen",
  async () => {
    const { rows } = await sebagaiAdmin(
      db,
      `select status from status_tim_harian($1::date) where user_id = $2`,
      [HARI, ANISA],
    );
    harusSama(rows[0].status, "alpa");
  },
);

uji("absen masuk berikutnya mengisi baris yang sama", async () => {
  await absenMasuk(ANISA, KANTOR);
  const b = await baris();
  harus(b.jam_masuk !== null, "jam masuk terisi lagi");
  harusSama(b.lokasi_valid, true, "lokasi baru di dalam radius");
  harus(["hadir", "terlambat"].includes(b.status), `status ${b.status}`);
  harusSama(b.ulang_masuk, 1, "hitungannya tidak ikut ter-reset");
  const n = (
    await sebagaiAdmin(
      db,
      `select count(*)::int n from attendance where user_id=$1 and tanggal=$2`,
      [ANISA, HARI],
    )
  ).rows[0].n;
  harusSama(n, 1, "tetap satu baris per hari");
});

uji("absen ulang pulang ditolak sebelum ada absen pulang", async () => {
  await harusDitolak(() => ulang(ANISA, "pulang"), "belum absen pulang");
});

uji("absen pulang bisa diulang, dan setelahnya masuk tidak bisa", async () => {
  await sebagai(
    db,
    ANISA,
    `update attendance set jam_pulang = now(), lat_pulang = $2, lng_pulang = $3
      where user_id = $1 and tanggal = $4`,
    [ANISA, JAUH.lat, JAUH.lng, HARI],
  );
  await harusDitolak(
    () => ulang(ANISA, "masuk"),
    "masuk tidak bisa diulang setelah pulang tercatat",
  );

  const { rows } = await ulang(ANISA, "pulang");
  harusSama(rows[0].sisa, 2);
  const b = await baris();
  harusSama(b.jam_pulang, null);
  harusSama(b.ulang_pulang, 1);
  harus(b.jam_masuk !== null, "catatan masuk tidak ikut terhapus");
});

uji("batasnya tiga kali per tahap", async () => {
  await ulang(ANISA, "masuk");
  await absenMasuk(ANISA, KANTOR);
  await ulang(ANISA, "masuk");
  await absenMasuk(ANISA, KANTOR);
  harusSama((await baris()).ulang_masuk, 3);
  await harusDitolak(
    () => ulang(ANISA, "masuk"),
    "absen ulang keempat seharusnya ditolak",
  );
});

uji("tahap yang tidak dikenal ditolak", async () => {
  await harusDitolak(() => ulang(ANISA, "istirahat"), "tahap asing");
});

uji("izin atau sakit tidak bisa diabsen ulang", async () => {
  await sebagai(
    db,
    EKO,
    `insert into attendance (user_id, tanggal, status, alasan, persetujuan)
     values ($1, $2, 'sakit', 'Demam sejak semalam', 'diajukan')`,
    [EKO, HARI],
  );
  await harusDitolak(() => ulang(EKO, "masuk"), "sakit tidak bisa diulang");
  harusSama((await baris(EKO)).status, "sakit", "barisnya tidak tersentuh");
});

uji("orang lain tidak bisa mengosongkan catatan orang lain", async () => {
  // Fungsi selalu bekerja pada baris pemanggil sendiri: Eko yang sakit
  // ditolak, dan catatan Anisa tidak berubah.
  const sebelum = await baris();
  await harusDitolak(() => ulang(EKO, "masuk"), "Eko sakit");
  harusSama((await baris()).ulang_masuk, sebelum.ulang_masuk);
});

uji("rekap rincian menyebut berapa kali absen diulang", async () => {
  const { rows } = await sebagai(
    db,
    ANISA,
    `select ulang_masuk, ulang_pulang from rekap_absensi($1::date, $1::date, $2::uuid)`,
    [HARI, ANISA],
  );
  harusSama(rows[0].ulang_masuk, 3);
  harusSama(rows[0].ulang_pulang, 1);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
