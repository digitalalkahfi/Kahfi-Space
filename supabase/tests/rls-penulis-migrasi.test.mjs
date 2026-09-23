/**
 * Hak tulis mesin migrasi ke tabel tujuan.
 *
 * Mesin migrasi menulis sebagai orang yang menjalankannya, bukan sebagai
 * admin. Kalau RLS menolak salah satu tabel tujuan, migrasinya tidak
 * berhenti — Supabase hanya mengembalikan nol baris, dan seluruhnya
 * tercatat "berhasil" tanpa satu baris pun pindah. Berkas ini yang
 * memastikan jalurnya memang terbuka untuk yang berhak, dan tertutup
 * untuk yang tidak.
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
const { uji, jalankan } = buatSuite("Hak tulis mesin migrasi");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  ceo: (await satu(`select id from users where role='CEO' limit 1`)).id,
  manajer: (await satu(`select id from users where nama='Farhan Pratama'`)).id,
  staff: (await satu(`select id from users where nama='Nabila Putri'`)).id,
};

const AKUN = (await satu(`select id, username from accounts limit 1`));
const UNIT = (await satu(`select id from units where kode='affiliator'`)).id;

uji("Manager boleh melengkapi profil orang lain", async () => {
  // Inilah yang dikerjakan pemetaan users:list.
  const { rows } = await sebagai(
    db,
    U.manajer,
    `update users set jabatan = 'Hasil migrasi' where id = $1 returning id`,
    [U.staff],
  );
  harusSama(rows.length, 1);
});

uji("Manager boleh membuat dan memperbarui akun", async () => {
  const { rows } = await sebagai(
    db,
    U.manajer,
    `insert into accounts (platform, username, unit_id)
     values ('TikTok Shop', '@hasil_migrasi', $1) returning id`,
    [UNIT],
  );
  harusSama(rows.length, 1);

  const ubah = await sebagai(
    db,
    U.manajer,
    `update accounts set status = 'nonaktif' where id = $1 returning id`,
    [rows[0].id],
  );
  harusSama(ubah.rows.length, 1);
  await sebagaiAdmin(db, `delete from accounts where id = $1`, [rows[0].id]);
});

uji("kehadiran lama hanya masuk lewat jalur migrasi", async () => {
  // Aturan sehari-hari benar: tidak boleh ada yang mengabsenkan orang
  // lain. Kehadiran tahun lalu karena itu tidak bisa lewat jalur biasa.
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.manajer,
        `insert into attendance (user_id, tanggal, status, catatan_bukti)
         values ($1, date '2023-01-03', 'hadir', 'Bukti di sistem lama')`,
        [U.staff],
      ),
    "absen langsung untuk orang lain seharusnya ditolak",
  );

  const hadir = await sebagai(
    db,
    U.manajer,
    `select migrasi_tulis_kehadiran(
       $1, date '2023-01-03', 'hadir'::status_kehadiran
     ) id`,
    [U.staff],
  );
  harusSama(hadir.rows.length, 1);
  harus(hadir.rows[0].id !== null, "kehadiran lama harus tercatat");

  // Laporan pun hanya lewat jalurnya sendiri: aturan biasa membatasi
  // orang mengirim laporan atas namanya sendiri.
  const laporan = await sebagai(
    db,
    U.manajer,
    `select migrasi_tulis_laporan($1, date '2023-01-03', $2, null, 1000) id`,
    [U.staff, AKUN.id],
  );
  harus(laporan.rows[0].id !== null, "laporan lama harus tercatat");

  await sebagaiAdmin(db, `delete from daily_reports where id = $1`, [
    laporan.rows[0].id,
  ]);
  // Diulang: indeks uniknya menahan, dan jalurnya menjawab null.
  await sebagaiAdmin(db, `delete from attendance where id = $1`, [
    hadir.rows[0].id,
  ]);
});

uji("jalur kehadiran migrasi aman diulang", async () => {
  const sekali = await sebagai(
    db,
    U.manajer,
    `select migrasi_tulis_kehadiran($1, date '2023-01-04', 'izin'::status_kehadiran,
       null, null, null, null, 'Acara keluarga', 'disetujui'::status_persetujuan,
       $2) id`,
    [U.staff, U.manajer],
  );
  const lagi = await sebagai(
    db,
    U.manajer,
    `select migrasi_tulis_kehadiran($1, date '2023-01-04', 'sakit'::status_kehadiran) id`,
    [U.staff],
  );

  // Baris yang sama diperbarui, bukan digandakan.
  harusSama(sekali.rows[0].id, lagi.rows[0].id);
  const b = await satu(
    `select status, catatan_bukti from attendance where id = $1`,
    [lagi.rows[0].id],
  );
  harusSama(b.status, "sakit");
  harus(b.catatan_bukti !== "", "asal buktinya harus tetap tertulis");
  await sebagaiAdmin(db, `delete from attendance where id = $1`, [lagi.rows[0].id]);
});

uji("Staff tidak bisa memakai jalur kehadiran migrasi", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.staff,
        `select migrasi_tulis_kehadiran($1, date '2023-01-06', 'hadir'::status_kehadiran)`,
        [U.staff],
      ),
    "jalur migrasi seharusnya tertutup untuk Staff",
  );
});

uji("arus kas lama masuk langsung sebagai dibayar", async () => {
  // Lewat jalur biasa, pengeluaran baru dipaksa berstatus 'diajukan'
  // (0097) — benar untuk pengeluaran hari ini, mustahil untuk transaksi
  // tahun lalu yang uangnya sudah keluar.
  const biasa = await sebagai(
    db,
    U.manajer,
    `insert into transactions (tanggal, arah, jenis, jumlah, keterangan, status)
     values (date '2023-01-03', 'keluar', 'beban', 50000, 'Lewat jalur biasa', 'dibayar')
     returning id, status`,
  );
  harusSama(biasa.rows[0].status, "diajukan");
  await sebagaiAdmin(db, `delete from transactions where id = $1`, [
    biasa.rows[0].id,
  ]);

  const { rows } = await sebagai(
    db,
    U.manajer,
    `select migrasi_tulis_transaksi(
       date '2023-01-03', 'keluar'::arah_transaksi, 'beban'::jenis_keluar,
       50000, 'Dari K-Space lama', null, $1
     ) id`,
    [U.manajer],
  );
  const b = await satu(
    `select status, jumlah, diajukan_id from transactions where id = $1`,
    [rows[0].id],
  );
  harusSama(b.status, "dibayar");
  harusSama(Number(b.jumlah), 50000);
  harusSama(b.diajukan_id, U.manajer);

  // Diulang dengan id yang sama: tidak digandakan, dan tidak ditulis
  // ulang. Uangnya sudah keluar; angka yang sudah dipertanggungjawabkan
  // tidak boleh berubah karena ekspornya diunggah dua kali.
  const lagi = await sebagai(
    db,
    U.manajer,
    `select migrasi_tulis_transaksi(
       date '2023-01-03', 'keluar'::arah_transaksi, 'beban'::jenis_keluar,
       75000, 'Dari K-Space lama', null, $1, $2
     ) id`,
    [U.manajer, rows[0].id],
  );
  harusSama(lagi.rows[0].id, rows[0].id);

  const ulang = await satu(
    `select count(*)::int n, max(jumlah) jumlah from transactions
      where keterangan = 'Dari K-Space lama'`,
  );
  harusSama(ulang.n, 1);
  harusSama(Number(ulang.jumlah), 50000);

  await sebagaiAdmin(db, `delete from transactions where id = $1`, [rows[0].id]);
});

uji("Staff tidak bisa memakai jalur arus kas migrasi", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.staff,
        `select migrasi_tulis_transaksi(
           date '2023-01-03', 'masuk'::arah_transaksi, null::jenis_keluar,
           1000, 'Curian'
         )`,
      ),
    "jalur arus kas migrasi seharusnya tertutup untuk Staff",
  );
});

uji("Staff tidak bisa menulis apa pun lewat jalur yang sama", async () => {
  // Kalau ini lolos, siapa pun bisa menjalankan migrasi atas nama
  // dirinya sendiri dan menulis ke seluruh tabel perusahaan.
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.staff,
        `insert into accounts (platform, username, unit_id)
         values ('TikTok Shop', '@curian', $1)`,
        [UNIT],
      ),
    "pembuatan akun oleh Staff seharusnya ditolak",
  );

  const profil = await sebagai(
    db,
    U.staff,
    `update users set jabatan = 'Palsu' where id = $1 returning id`,
    [U.manajer],
  );
  harusSama(
    profil.rows.length,
    0,
    "Staff seharusnya tidak bisa mengubah profil orang lain",
  );
});

uji("CEO punya jalur yang sama dengan Manager", async () => {
  const { rows } = await sebagai(
    db,
    U.ceo,
    `update users set jabatan = jabatan where id = $1 returning id`,
    [U.staff],
  );
  harus(rows.length === 1, "CEO harus bisa menulis profil");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
