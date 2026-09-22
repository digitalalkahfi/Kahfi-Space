/**
 * RPC perbaikan laporan — satu-satunya jalan mengubah angka GMV.
 * Yang diuji: alasan wajib, jejak otomatis, dan batas kewenangan.
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
const { uji, jalankan } = buatSuite("Revisi laporan (RPC)");

const TGL = "2024-10-24";
const idUser = async (n) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [n])).rows[0].id;

const U = {
  manager: await idUser("Farhan Pratama"),
  rian: await idUser("Rian Hidayat"),
  anisa: await idUser("Anisa Larasati"),
  leaderMcn: await idUser("Galih Prakoso"),
};

const laporanRian = (
  await sebagaiAdmin(
    db,
    `select r.id from daily_reports r
     join accounts a on a.id = r.account_id
     where a.username = '@skincare_official' and r.tanggal = $1`,
    [TGL],
  )
).rows[0].id;

const gmvSekarang = async (id) =>
  Number(
    (await sebagaiAdmin(db, `select gmv from daily_reports where id=$1`, [id]))
      .rows[0].gmv,
  );

uji("alasan kurang dari 10 karakter ditolak", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.rian,
        `select perbaiki_laporan_harian($1, 5000000, 'salah')`,
        [laporanRian],
      ),
    "alasan pendek seharusnya ditolak",
  );
});

uji("GMV negatif ditolak", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.rian,
        `select perbaiki_laporan_harian($1, -5, 'Alasan yang cukup panjang.')`,
        [laporanRian],
      ),
    "GMV negatif seharusnya ditolak",
  );
});

uji("pemilik laporan bisa memperbaiki dan jejaknya tercatat", async () => {
  const sebelum = await gmvSekarang(laporanRian);
  await sebagai(
    db,
    U.rian,
    `select perbaiki_laporan_harian($1, 5300000,
       'Tiga pesanan masuk setelah cutoff, belum terhitung saat input pertama.')`,
    [laporanRian],
  );

  harusSama(await gmvSekarang(laporanRian), 5300000, "angka baru tersimpan");

  const { rows } = await sebagaiAdmin(
    db,
    `select gmv_lama, gmv_baru, alasan, diubah_oleh
     from daily_report_revisions where report_id=$1 order by created_at desc`,
    [laporanRian],
  );
  harusSama(rows.length, 1);
  harusSama(Number(rows[0].gmv_lama), sebelum);
  harusSama(Number(rows[0].gmv_baru), 5300000);
  harus(rows[0].alasan.includes("cutoff"), "alasan tersimpan apa adanya");
  harusSama(rows[0].diubah_oleh, U.rian, "pengubah tercatat");
});

uji("status laporan berubah jadi 'revisi'", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select status from daily_reports where id=$1`,
    [laporanRian],
  );
  harusSama(rows[0].status, "revisi");
});

uji("orang lain tidak bisa memperbaiki laporan bukan miliknya", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.anisa,
        `select perbaiki_laporan_harian($1, 9000000,
           'Mencoba mengubah laporan milik orang lain.')`,
        [laporanRian],
      ),
    "RLS seharusnya menutup laporan milik orang lain",
  );
});

uji("Leader unit lain juga tidak bisa", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.leaderMcn,
        `select perbaiki_laporan_harian($1, 9000000,
           'Leader MCN mencoba mengubah laporan akun Affiliator.')`,
        [laporanRian],
      ),
    "Leader MCN tidak berhak atas laporan akun Affiliator",
  );
});

uji("Manager boleh memperbaiki dan jejaknya tetap tercatat", async () => {
  await sebagai(
    db,
    U.manager,
    `select perbaiki_laporan_harian($1, 5250000,
       'Koreksi akhir setelah rekonsiliasi dengan Partner Center.')`,
    [laporanRian],
  );
  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int n from daily_report_revisions where report_id=$1`,
    [laporanRian],
  );
  harusSama(Number(rows[0].n), 2, "jejak bertambah, bukan tertimpa");
});

uji("perbaikan tanpa perubahan angka tidak membuat jejak baru", async () => {
  await sebagai(
    db,
    U.rian,
    `select perbaiki_laporan_harian($1, 5250000,
       'Menyimpan ulang tanpa mengubah angka.')`,
    [laporanRian],
  );
  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int n from daily_report_revisions where report_id=$1`,
    [laporanRian],
  );
  harusSama(Number(rows[0].n), 2, "jejak tidak boleh bertambah");
});

uji("catatan ikut diperbarui bila diisi", async () => {
  await sebagai(
    db,
    U.rian,
    `select perbaiki_laporan_harian($1, 5260000,
       'Penyesuaian kecil setelah cek ulang.', 'Catatan diperbarui.')`,
    [laporanRian],
  );
  const { rows } = await sebagaiAdmin(
    db,
    `select catatan from daily_reports where id=$1`,
    [laporanRian],
  );
  harusSama(rows[0].catatan, "Catatan diperbarui.");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
