/**
 * Rekap GMV lama masuk ke daily_reports lewat jalur migrasi, dan angka
 * yang sudah ada disamakan lewat perbaiki_laporan_harian — tanpa sesi
 * pengguna (skrip mandiri memakai service-role; auth.uid() kosong).
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusDitolak,
  harusSama,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Migrasi rekap GMV");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const RIAN = (await satu(`select id from users where nama = 'Rian Hidayat'`))
  .id;
const AKUN = (
  await satu(`select id from accounts where username = '@skincare_official'`)
).id;
const MCN = (await satu(`select id from units where kode = 'mcn'`)).id;
const TANGGAL = "2024-09-03";

let idLaporan;

uji("rekap masuk lewat migrasi_tulis_laporan tanpa sesi pengguna", async () => {
  const { id } = await satu(
    `select migrasi_tulis_laporan($1, $2::date, $3, null, 17100000, null, null,
       'Rekap GMV affiliator sistem lama · Pesanan: 262') id`,
    [RIAN, TANGGAL, AKUN],
  );
  harus(id !== null, "baris rekap harus tercipta");
  idLaporan = id;
  const baris = await satu(
    `select gmv, status, catatan from daily_reports where id = $1`,
    [id],
  );
  harusSama(Number(baris.gmv), 17100000);
  harusSama(baris.status, "terkirim");
});

uji("sasaran dan tanggal yang sama tidak digandakan: hasilnya null", async () => {
  const { id } = await satu(
    `select migrasi_tulis_laporan($1, $2::date, $3, null, 99) id`,
    [RIAN, TANGGAL, AKUN],
  );
  harusSama(id, null);
  const { n } = await satu(
    `select count(*)::int n from daily_reports where account_id = $1 and tanggal = $2`,
    [AKUN, TANGGAL],
  );
  harusSama(n, 1);
});

uji(
  "angka disamakan lewat perbaiki_laporan_harian: jejak revisi membawa alasannya",
  async () => {
    const alasan =
      "Migrasi K-Space lama: angka disamakan dengan rekap GMV harian sistem lama.";
    const hasil = await satu(
      `select gmv, status from perbaiki_laporan_harian($1, 18300000, $2, null, null, null)`,
      [idLaporan, alasan],
    );
    harusSama(Number(hasil.gmv), 18300000);
    harusSama(hasil.status, "revisi");

    const jejak = await satu(
      `select gmv_lama, gmv_baru, alasan, diubah_oleh
         from daily_report_revisions where report_id = $1
        order by created_at desc limit 1`,
      [idLaporan],
    );
    harusSama(Number(jejak.gmv_lama), 17100000);
    harusSama(Number(jejak.gmv_baru), 18300000);
    harusSama(jejak.alasan, alasan);
    // Tanpa sesi: yang mengubah adalah sistem, bukan seseorang.
    harusSama(jejak.diubah_oleh, null);
  },
);

uji("komisi yang melebihi GMV barunya ditolak kendala, bukan lolos diam-diam", async () => {
  await harusDitolak(
    () =>
      satu(
        `select gmv from perbaiki_laporan_harian($1, 1000, 'Migrasi: uji kendala komisi', null, 5000, null)`,
        [idLaporan],
      ),
    "komisi > gmv seharusnya ditolak",
  );
});

uji("rekap unit MCN masuk sebagai laporan unit", async () => {
  const { id } = await satu(
    `select migrasi_tulis_laporan($1, $2::date, null, $3, 823149333, null, null,
       'Rekap GMV unit sistem lama') id`,
    [RIAN, TANGGAL, MCN],
  );
  harus(id !== null, "baris unit harus tercipta");
  const { gmv } = await satu(
    `select gmv from gmv_harian_per_unit($1::date, $1::date) where kode = 'mcn'`,
    [TANGGAL],
  );
  harusSama(Number(gmv), 823149333);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
