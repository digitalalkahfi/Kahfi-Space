/**
 * Komisi wajib di laporan baru akun Affiliator; komisi boleh > GMV (0211).
 * docs/KOMISI-DETAIL-AKUN-AFFILIATOR.md §4.2, AC1, AC2, AC9, E1, E2, E10.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  idNama,
  idPeran,
  pesanDb,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Komisi wajib");

const akun = async (username) =>
  (await sebagaiAdmin(db, "select id from accounts where username = $1", [username]))
    .rows[0].id;

/** Tanggal yang sah untuk laporan baru: beberapa hari lalu (WIB). */
const LALU = (n) => `(now() at time zone 'Asia/Jakarta')::date - ${n}`;

async function galat(fn) {
  try {
    await fn();
  } catch (e) {
    return pesanDb(e);
  }
  throw new Error("seharusnya ditolak, tapi berhasil");
}

uji("AC1/BR-K2: laporan baru akun Affiliator tanpa komisi ditolak database", async () => {
  const rian = await idNama(db, "Rian Hidayat");
  const beauty = await akun("@beauty_daily.id");
  const pesan = await galat(() =>
    sebagai(
      db,
      rian,
      `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi, jumlah_upload)
       values ($1, ${LALU(2)}, $2, 1000000, null, 2)`,
      [rian, beauty],
    ),
  );
  harus(pesan.includes("Isi 0 kalau hari ini tidak ada komisi masuk."), pesan);
});

uji("BR-K1: komisi 0 diterima", async () => {
  const rian = await idNama(db, "Rian Hidayat");
  const beauty = await akun("@beauty_daily.id");
  await sebagai(
    db,
    rian,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi, jumlah_upload)
     values ($1, ${LALU(2)}, $2, 1000000, 0, 2)`,
    [rian, beauty],
  );
});

uji("AC2/E1: komisi Rp 50.000 dengan GMV Rp 0 tersimpan", async () => {
  const nabila = await idNama(db, "Nabila Putri");
  const hijab = await akun("@fashion_hijab");
  const { rows } = await sebagai(
    db,
    nabila,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi, jumlah_upload)
     values ($1, ${LALU(3)}, $2, 0, 50000, 1) returning id`,
    [nabila, hijab],
  );
  const simpan = (
    await sebagaiAdmin(db, "select gmv::int g, komisi::int k from daily_reports where id = $1", [
      rows[0].id,
    ])
  ).rows[0];
  harusSama(simpan, { g: 0, k: 50000 });
});

uji("BR-K3: constraint komisi ≤ GMV dicabut, batas wajar tetap", async () => {
  const ada = await sebagaiAdmin(
    db,
    `select conname from pg_constraint
     where conrelid = 'daily_reports'::regclass
       and conname in ('daily_reports_komisi_tak_lebih_dari_gmv', 'daily_reports_komisi_wajar')`,
  );
  harusSama(ada.rows.map((r) => r.conname), ["daily_reports_komisi_wajar"]);
});

uji("E2: laporan lama berkomisi kosong tidak diubah dan tetap bisa diperbaiki GMV-nya", async () => {
  const bayu = await idNama(db, "Bayu Nugraha");
  const lama = (
    await sebagaiAdmin(
      db,
      `select r.id from daily_reports r where r.user_id = $1 order by tanggal limit 1`,
      [bayu],
    )
  ).rows[0].id;
  // Laporan lama yang komisinya kosong (sebelum aturan wajib).
  await sebagaiAdmin(db, "update daily_reports set komisi = null where id = $1", [lama]);
  await sebagai(
    db,
    bayu,
    "select perbaiki_laporan_harian($1, 999000, 'Perbaikan GMV laporan lama', null, null, null)",
    [lama],
  );
  const r = (
    await sebagaiAdmin(db, "select gmv::int g, komisi from daily_reports where id = $1", [lama])
  ).rows[0];
  harusSama(r, { g: 999000, komisi: null });
});

uji("E10: jalur migrasi data lama tidak diwajibkan komisi", async () => {
  const ceo = await idPeran(db, "CEO");
  const intan = await idNama(db, "Intan Permata");
  const snack = await akun("@snack_nusantara");
  const { rows } = await sebagai(
    db,
    ceo,
    `select migrasi_tulis_laporan($1, date '2023-01-05', $2, null, 500000, null, 3, 'V1') as id`,
    [intan, snack],
  );
  harus(rows[0].id, "laporan lama tanpa komisi seharusnya masuk");
  // Penanda tidak bocor ke perintah berikutnya di sesi yang sama.
  const pesan = await galat(() =>
    sebagai(
      db,
      intan,
      `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi)
       values ($1, ${LALU(4)}, $2, 100000, null)`,
      [intan, snack],
    ),
  );
  harus(pesan.includes("tidak ada komisi masuk"), pesan);
});

uji("AC9/BR-K4: MCN dan TAP tetap tanpa komisi", async () => {
  const galih = await idNama(db, "Galih Prakoso");
  const mcn = (await sebagaiAdmin(db, "select id from units where kode = 'mcn'")).rows[0].id;
  // Laporan unit MCN tanpa komisi tetap sah…
  await sebagai(
    db,
    galih,
    `insert into daily_reports (user_id, tanggal, unit_id, gmv)
     values ($1, ${LALU(5)}, $2, 4000000)`,
    [galih, mcn],
  );
  // …dan komisi tetap ditolak untuk MCN.
  const pesan = await galat(() =>
    sebagai(
      db,
      galih,
      `insert into daily_reports (user_id, tanggal, unit_id, gmv, komisi)
       values ($1, ${LALU(6)}, $2, 4000000, 1000)`,
      [galih, mcn],
    ),
  );
  harus(pesan.includes("hanya melaporkan GMV"), pesan);
});

await jalankan();
await db.close();
