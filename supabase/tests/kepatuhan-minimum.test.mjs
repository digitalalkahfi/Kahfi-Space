/**
 * Kepatuhan batas minimum: SQL harus sepakat dengan fungsi murni.
 *
 * Aturannya hidup di dua tempat — `hitungKepatuhanMinimum` untuk layar
 * dan `kepatuhan_minimum_akun` untuk rekap massal. Berkas ini menyusun
 * satu kejadian, menghitungnya dengan kedua jalur, lalu membandingkan
 * hasilnya. Kalau suatu saat berbeda, ini yang gagal lebih dulu — bukan
 * rekap bulanan yang diam-diam salah.
 */
import {
  batasMinimum,
  hitungKepatuhanMinimum,
  rataKepatuhan,
} from "@/lib/batas-minimum";
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Kepatuhan batas minimum");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const semua = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows;

const U = {
  rian: (await satu(`select id from users where nama='Rian Hidayat'`)).id,
  dimas: (await satu(`select id from users where nama='Dimas Maulana'`)).id,
};
const A = {
  skincare: (
    await satu(`select id from accounts where username='@skincare_official'`)
  ).id,
  beauty: (
    await satu(`select id from accounts where username='@beauty_daily.id'`)
  ).id,
};

const DARI = "2024-11-04";
const SAMPAI = "2024-11-08";

/** Absensi masuk pukul 08.00 pada sebuah tanggal. */
const hadir = (userId, tanggal) =>
  sebagaiAdmin(
    db,
    `insert into attendance (user_id, tanggal, jam_masuk)
     values ($1,$2,(($2::date + time '08:00') at time zone 'Asia/Jakarta'))
     on conflict (user_id, tanggal) do update set jam_masuk = excluded.jam_masuk`,
    [userId, tanggal],
  );

/** Izin sehari penuh yang sudah disetujui — bukan hari kerja. */
const izin = (userId, tanggal) =>
  sebagaiAdmin(
    db,
    `insert into attendance (user_id, tanggal, status, alasan, persetujuan,
        disetujui_oleh, disetujui_pada)
     values ($1,$2,'izin','keperluan keluarga','disetujui',$3,now())
     on conflict (user_id, tanggal) do update
       set status='izin', jam_masuk=null, alasan=excluded.alasan,
           persetujuan='disetujui'`,
    [userId, tanggal, U.dimas],
  );

const lapor = (akunId, tanggal, upload) =>
  sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, jumlah_upload)
     values ($1,$2,$3,1000000,$4)
     on conflict (account_id, tanggal) where account_id is not null
     do update set jumlah_upload = excluded.jumlah_upload`,
    [U.rian, tanggal, akunId, upload],
  );

/** Fakta mentah yang sama, dibaca ulang dari database. */
const fakta = async (akunId) => {
  const hari = await semua(
    `select t.tanggal::text as tanggal,
            (t.jam_masuk is not null) as hari_kerja,
            r.jumlah_upload as unggahan
       from attendance t
       left join daily_reports r
         on r.account_id = $1 and r.tanggal = t.tanggal
      where t.user_id = $2 and t.tanggal between $3 and $4
      order by t.tanggal`,
    [akunId, U.rian, DARI, SAMPAI],
  );
  return hari.map((h) => ({
    tanggal: h.tanggal,
    hariKerja: h.hari_kerja,
    unggahan: h.unggahan,
  }));
};

const dariSql = async (akunId) =>
  satu(`select * from kepatuhan_minimum_akun($1,$2,$3)`, [
    akunId,
    DARI,
    SAMPAI,
  ]);

// Kejadiannya: lima hari, satu di antaranya izin yang disetujui, satu
// hari kerja tanpa laporan sama sekali.
await sebagaiAdmin(db, `update accounts set level = 3 where id = $1`, [
  A.skincare,
]);
await hadir(U.rian, "2024-11-04");
await hadir(U.rian, "2024-11-05");
await izin(U.rian, "2024-11-06");
await hadir(U.rian, "2024-11-07");
await hadir(U.rian, "2024-11-08");
await lapor(A.skincare, "2024-11-04", 12); // terpenuhi
await lapor(A.skincare, "2024-11-05", 10); // tepat batas, terpenuhi
await lapor(A.skincare, "2024-11-06", 30); // hari izin — tidak dihitung
await lapor(A.skincare, "2024-11-07", 4); // kurang
// 2024-11-08 sengaja tanpa laporan

uji("SQL dan fungsi murni menghasilkan angka yang sama", async () => {
  const sql = await dariSql(A.skincare);
  const murni = hitungKepatuhanMinimum(await fakta(A.skincare), 10);

  harusSama(sql.hari_kerja, murni.hariKerja, "jumlah hari kerja");
  harusSama(sql.terpenuhi, murni.terpenuhi, "jumlah hari terpenuhi");
  harusSama(
    Number(sql.rasio),
    Math.round(murni.rasio * 10) / 10,
    "persentase kepatuhan",
  );
  harusSama(sql.minimum, murni.minimum);
});

uji("hari izin yang disetujui tidak masuk pembagi", async () => {
  // Lima tanggal tercatat, satu di antaranya izin → empat hari kerja.
  const sql = await dariSql(A.skincare);
  harusSama(sql.hari_kerja, 4);
});

uji("hari kerja tanpa laporan dinilai tidak terpenuhi", async () => {
  // 11-04 dan 11-05 terpenuhi; 11-07 kurang; 11-08 tanpa laporan.
  const sql = await dariSql(A.skincare);
  harusSama(sql.terpenuhi, 2);
  harusSama(Number(sql.rasio), 50);
});

uji("batas minimum diambil dari level akunnya", async () => {
  await sebagaiAdmin(db, `update accounts set level = 0 where id = $1`, [
    A.skincare,
  ]);
  const sql = await dariSql(A.skincare);
  harusSama(sql.minimum, 3, "level 0 berarti minimum 3");
  // Dengan minimum 3: 12, 10, dan 4 terpenuhi; 11-08 tetap tidak.
  harusSama(sql.terpenuhi, 3);
  harusSama(Number(sql.rasio), 75);

  const murni = hitungKepatuhanMinimum(await fakta(A.skincare), 3);
  harusSama(sql.terpenuhi, murni.terpenuhi);
  await sebagaiAdmin(db, `update accounts set level = 3 where id = $1`, [
    A.skincare,
  ]);
});

uji("akun tanpa level tidak dinilai — rasionya null", async () => {
  // Seluruh akun seed sudah berlevel, jadi keadaan yang diuji dibuat
  // di sini: levelnya dikosongkan lebih dulu.
  await sebagaiAdmin(db, `update accounts set level = null where id = $1`, [
    A.beauty,
  ]);
  const sql = await dariSql(A.beauty);
  harusSama(sql.minimum, null);
  harusSama(sql.rasio, null, "tanpa standar tidak ada persentase");
  harusSama(hitungKepatuhanMinimum(await fakta(A.beauty), null).rasio, null);
});

uji("rentang tanpa absensi sama sekali tidak dinilai", async () => {
  const kosong = await satu(
    `select * from kepatuhan_minimum_akun($1,'2023-01-01','2023-01-31')`,
    [A.skincare],
  );
  harusSama(kosong.hari_kerja, 0);
  harusSama(kosong.rasio, null, "bukan nol persen; memang tidak dinilai");
});

uji("kepatuhan orang adalah rata-rata per akun", async () => {
  await sebagaiAdmin(db, `update accounts set level = 0 where id = $1`, [
    A.beauty,
  ]);
  await lapor(A.beauty, "2024-11-04", 3);
  await lapor(A.beauty, "2024-11-05", 3);
  await lapor(A.beauty, "2024-11-07", 3);
  await lapor(A.beauty, "2024-11-08", 3);

  const sql = await satu(`select * from kepatuhan_minimum_orang($1,$2,$3)`, [
    U.rian,
    DARI,
    SAMPAI,
  ]);

  const perAkun = [];
  for (const id of [A.skincare, A.beauty]) {
    const level = (await satu(`select level from accounts where id=$1`, [id]))
      .level;
    perAkun.push(hitungKepatuhanMinimum(await fakta(id), batasMinimum(level)));
  }
  const murni = rataKepatuhan(perAkun);

  harusSama(sql.akun_dinilai, 2);
  harusSama(
    Number(sql.rasio),
    Math.round(murni.rasio * 10) / 10,
    "rata-rata per akun harus sama",
  );
  harus(murni.rasio > 0);
});

// Rentang kedua, sengaja terpisah dari rentang di atas: tes-tes di
// bawah ini menambah tanggal baru, dan menaruhnya di rentang pertama
// akan mengubah angka yang sudah diperiksa tes-tes sebelumnya.
const DARI2 = "2024-11-09";
const SAMPAI2 = "2024-11-15";
const dariSql2 = async (akunId) =>
  satu(`select * from kepatuhan_minimum_akun($1,$2,$3)`, [
    akunId,
    DARI2,
    SAMPAI2,
  ]);

uji("libur tidak masuk pembagi karena tidak ada absensinya", async () => {
  // 9 & 10 November akhir pekan: tidak ada baris absensi sama sekali,
  // jadi tidak perlu daftar hari libur terpisah — ketiadaan absensi
  // sudah merupakan jawabannya. Kalau suatu saat pembaginya dihitung
  // dari selisih tanggal, tes ini yang gagal lebih dulu.
  await hadir(U.rian, "2024-11-11");
  await lapor(A.skincare, "2024-11-09", 30);
  await lapor(A.skincare, "2024-11-11", 30);

  const sql = await dariSql2(A.skincare);
  harusSama(sql.hari_kerja, 1, "hanya 11 November; akhir pekan tidak ada");
});

uji("izin berjam yang disetujui tetap hari kerja", async () => {
  // Beda dari izin sehari penuh: orangnya tetap masuk, hanya pulang
  // lebih awal. Mengeluarkannya dari pembagi berarti setengah hari
  // kerja bisa menghapus kewajiban seharian.
  await sebagaiAdmin(
    db,
    `insert into attendance (user_id, tanggal, status, jam_masuk, izin_jenis,
        izin_mulai, izin_selesai, alasan, persetujuan, disetujui_oleh,
        disetujui_pada)
     values ($1,'2024-11-12','hadir',
       (('2024-11-12'::date + time '08:00') at time zone 'Asia/Jakarta'),
       'jam','13:00','17:00','urusan keluarga','disetujui',$2,now())`,
    [U.rian, U.dimas],
  );
  await lapor(A.skincare, "2024-11-12", 2);

  const sql = await dariSql2(A.skincare);
  harusSama(sql.hari_kerja, 2, "11 dan 12 November sama-sama dinilai");
  harusSama(sql.terpenuhi, 1, "12 November unggahannya memang kurang");
});

uji("alpa tidak menambah pembagi maupun mengurangi kepatuhan", async () => {
  // Tidak masuk tanpa izin adalah urusan modul absensi, bukan urusan
  // batas minimum unggahan. Menghitungnya di sini berarti satu
  // pelanggaran dihukum dua kali di dua angka yang berbeda.
  const sebelum = await dariSql2(A.skincare);
  await sebagaiAdmin(
    db,
    `insert into attendance (user_id, tanggal, status)
     values ($1,'2024-11-13','alpa')`,
    [U.rian],
  );
  await lapor(A.skincare, "2024-11-13", 0);
  const sesudah = await dariSql2(A.skincare);

  harusSama(sesudah.hari_kerja, sebelum.hari_kerja);
  harusSama(sesudah.terpenuhi, sebelum.terpenuhi);
});

uji("izin yang DITOLAK juga tidak masuk pembagi", async () => {
  // Sama alasannya dengan alpa: yang bersangkutan tidak masuk, dan
  // konsekuensinya jatuh di kehadiran, bukan di unggahan.
  const sebelum = await dariSql2(A.skincare);
  await sebagaiAdmin(
    db,
    `insert into attendance (user_id, tanggal, status, alasan, persetujuan,
        disetujui_oleh, disetujui_pada, alasan_keputusan)
     values ($1,'2024-11-14','izin','keperluan pribadi','ditolak',$2,now(),
       'Pekan penutupan bulan, kehadiran penuh')`,
    [U.rian, U.dimas],
  );
  harusSama((await dariSql2(A.skincare)).hari_kerja, sebelum.hari_kerja);
});

uji("rekap massal sepakat dengan hitungan satu per satu", async () => {
  // `kepatuhan_minimum_semua` ada supaya halaman yang menampilkan
  // banyak akun tidak memanggil satu per satu. Yang paling mudah
  // melenceng dari optimasi seperti itu adalah hasilnya sendiri.
  const massal = await semua(
    `select * from kepatuhan_minimum_semua($1,$2) order by account_id`,
    [DARI, SAMPAI],
  );
  harus(massal.length > 0, "seed harus punya akun aktif");

  for (const baris of massal) {
    const satuan = await satu(
      `select * from kepatuhan_minimum_akun($1,$2,$3)`,
      [baris.account_id, DARI, SAMPAI],
    );
    harusSama(
      [baris.hari_kerja, baris.terpenuhi, baris.rasio, baris.minimum],
      [satuan.hari_kerja, satuan.terpenuhi, satuan.rasio, satuan.minimum],
      `akun ${baris.account_id}`,
    );
  }
});

uji("rekap massal hanya memuat akun aktif", async () => {
  const sebelum = await semua(
    `select account_id from kepatuhan_minimum_semua($1,$2)`,
    [DARI, SAMPAI],
  );
  await sebagaiAdmin(db, `update accounts set status='nonaktif' where id=$1`, [
    A.beauty,
  ]);
  const sesudah = await semua(
    `select account_id from kepatuhan_minimum_semua($1,$2)`,
    [DARI, SAMPAI],
  );

  harusSama(sesudah.length, sebelum.length - 1);
  harus(
    sesudah.every((b) => b.account_id !== A.beauty),
    "akun nonaktif tidak lagi dinilai — ia memang tidak melapor lagi",
  );
  await sebagaiAdmin(db, `update accounts set status='aktif' where id=$1`, [
    A.beauty,
  ]);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
