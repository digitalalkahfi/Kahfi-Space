/** Kolom laporan harian yang hanya berlaku bagi departemen Affiliator. */
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
const { uji, jalankan } = buatSuite("Laporan per departemen");

const BESOK = "2024-10-25";
const LUSA = "2024-10-26";

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  rian: (await satu(`select id from users where nama='Rian Hidayat'`)).id,
  galih: (await satu(`select id from users where nama='Galih Prakoso'`)).id,
};
const A = {
  skincare: (
    await satu(`select id from accounts where username='@skincare_official'`)
  ).id,
};
const UN = {
  mcn: (await satu(`select id from units where kode='mcn'`)).id,
  tap: (await satu(`select id from units where kode='tap'`)).id,
};

const kirimAkun = (tanggal, kolom = "", nilai = "") =>
  sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, account_id, gmv${kolom})
     values ($1,$2,$3,1000000${nilai}) returning id`,
    [U.rian, tanggal, A.skincare],
  );

uji(
  "unit_laporan mengenali departemen dari akun maupun dari unit",
  async () => {
    harusSama(
      (await satu(`select unit_laporan($1, null) as k`, [A.skincare])).k,
      "affiliator",
      "akun affiliator seharusnya terbaca sebagai affiliator",
    );
    harusSama(
      (await satu(`select unit_laporan(null, $1) as k`, [UN.mcn])).k,
      "mcn",
    );
    harusSama((await satu(`select unit_laporan(null, null) as k`)).k, null);
  },
);

uji("Affiliator boleh menyimpan komisi dan jumlah upload", async () => {
  const { rows } = await kirimAkun(
    BESOK,
    ", komisi, jumlah_upload",
    ", 150000, 4",
  );
  const baris = await satu(
    `select komisi, jumlah_upload from daily_reports where id=$1`,
    [rows[0].id],
  );
  harusSama(Number(baris.komisi), 150000);
  harusSama(baris.jumlah_upload, 4);
});

uji("laporan Affiliator tanpa kolom tambahan tetap sah", async () => {
  // Kolomnya nullable: akun yang belum mengisi apa pun tidak diblokir.
  const { rows } = await kirimAkun(LUSA);
  const baris = await satu(
    `select komisi, jumlah_upload from daily_reports where id=$1`,
    [rows[0].id],
  );
  harus(
    baris.komisi === null && baris.jumlah_upload === null,
    "kolom kosong seharusnya null, bukan nol",
  );
});

uji("MCN & TAP ditolak saat mengirim komisi atau jumlah upload", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into daily_reports (user_id, tanggal, unit_id, gmv, komisi)
         values ($1,$2,$3,1000000,50000)`,
        [U.galih, BESOK, UN.mcn],
      ),
    "komisi pada laporan unit MCN seharusnya ditolak",
  );
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into daily_reports (user_id, tanggal, unit_id, gmv, jumlah_upload)
         values ($1,$2,$3,1000000,3)`,
        [U.galih, BESOK, UN.tap],
      ),
    "jumlah upload pada laporan unit TAP seharusnya ditolak",
  );
});

uji("memindahkan laporan ke unit lain ikut diperiksa", async () => {
  // Kolomnya sah saat disimpan; yang berubah kemudian adalah sasarannya.
  const { rows } = await kirimAkun(
    "2024-10-27",
    ", komisi, jumlah_upload",
    ", 10000, 1",
  );
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `update daily_reports set account_id = null, unit_id = $2 where id = $1`,
        [rows[0].id, UN.mcn],
      ),
    "laporan berkomisi tidak boleh pindah ke departemen tanpa komisi",
  );
});

uji("komisi tidak boleh melebihi GMV-nya", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi)
         values ($1,$2,$3,1000000,1000001)`,
        [U.rian, "2024-10-28", A.skincare],
      ),
    "komisi lebih besar dari GMV seharusnya ditolak",
  );
});

uji("komisi negatif dan jumlah upload di luar batas ditolak", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi)
         values ($1,$2,$3,1000000,-1)`,
        [U.rian, "2024-10-29", A.skincare],
      ),
    "komisi negatif seharusnya ditolak",
  );
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into daily_reports (user_id, tanggal, account_id, gmv, jumlah_upload)
         values ($1,$2,$3,1000000,501)`,
        [U.rian, "2024-10-30", A.skincare],
      ),
    "jumlah upload 501 seharusnya ditolak",
  );
});

uji("CO sampel dihitung dari pemindaian, per akun per tanggal", async () => {
  // Seed memakai jarak hari dari saat seed dijalankan, bukan tanggal tetap.
  const hariIni = (
    await satu(`select (now() at time zone 'Asia/Jakarta')::date as d`)
  ).d
    .toISOString()
    .slice(0, 10);

  const { rows } = await sebagaiAdmin(db, `select * from co_sampel_akun($1)`, [
    hariIni,
  ]);
  const peta = Object.fromEntries(
    rows.map((r) => [r.account_id, Number(r.jumlah)]),
  );
  harusSama(peta[A.skincare], 1, "@skincare_official dipindai sekali hari ini");
});

uji("pemindaian tak dikenali tidak ikut menambah CO sampel", async () => {
  const hariIni = (
    await satu(`select (now() at time zone 'Asia/Jakarta')::date as d`)
  ).d
    .toISOString()
    .slice(0, 10);
  const sebelum = Number(
    (
      await satu(
        `select coalesce(sum(jumlah),0) as n from co_sampel_akun($1)`,
        [hariIni],
      )
    ).n,
  );

  await sebagaiAdmin(
    db,
    `insert into sample_scans (kode, oleh_id, dikenali) values ('SMP-ASING-9', $1, false)`,
    [U.rian],
  );

  const sesudah = Number(
    (
      await satu(
        `select coalesce(sum(jumlah),0) as n from co_sampel_akun($1)`,
        [hariIni],
      )
    ).n,
  );
  harusSama(sesudah, sebelum, "kode asing seharusnya tidak terhitung");
});

uji(
  "tanggal tanpa pemindaian menghasilkan nol baris, bukan galat",
  async () => {
    const { rows } = await sebagaiAdmin(
      db,
      `select * from co_sampel_akun('2000-01-01')`,
    );
    harusSama(rows.length, 0);
  },
);

uji("perbaikan komisi ikut tercatat di jejak revisi", async () => {
  const { rows } = await kirimAkun(
    "2024-11-01",
    ", komisi, jumlah_upload",
    ", 100000, 2",
  );
  const id = rows[0].id;

  // Tanpa RPC, alasan tidak tersedia — trigger tetap wajib menulis jejak
  // dengan alasan bawaan, bukan melewatkannya.
  await sebagaiAdmin(
    db,
    `update daily_reports set komisi = 120000 where id = $1`,
    [id],
  );

  const jejak = await satu(
    `select gmv_lama, gmv_baru, komisi_lama, komisi_baru,
            upload_lama, upload_baru, alasan
       from daily_report_revisions where report_id = $1`,
    [id],
  );
  harusSama(Number(jejak.komisi_lama), 100000);
  harusSama(Number(jejak.komisi_baru), 120000);
  harus(
    Number(jejak.gmv_lama) === Number(jejak.gmv_baru),
    "GMV yang tidak berubah tetap dicatat apa adanya",
  );
  harus(
    jejak.upload_lama === null && jejak.upload_baru === null,
    "kolom yang tidak berubah seharusnya null",
  );
  harusSama(jejak.alasan, "Perbaikan tanpa alasan tercatat");

  const laporan = await satu(`select status from daily_reports where id=$1`, [
    id,
  ]);
  harusSama(laporan.status, "revisi", "status ikut berpindah ke revisi");
});

uji("perbaikan jumlah upload saja juga meninggalkan jejak", async () => {
  const { rows } = await kirimAkun(
    "2024-11-02",
    ", komisi, jumlah_upload",
    ", 100000, 2",
  );
  const id = rows[0].id;
  await sebagaiAdmin(
    db,
    `update daily_reports set jumlah_upload = 5 where id = $1`,
    [id],
  );
  const jejak = await satu(
    `select upload_lama, upload_baru, komisi_lama
       from daily_report_revisions where report_id = $1`,
    [id],
  );
  harusSama(jejak.upload_lama, 2);
  harusSama(jejak.upload_baru, 5);
  harus(jejak.komisi_lama === null, "komisi tidak ikut berubah");
});

uji("perbaiki_laporan_harian menyimpan ketiga angka sekaligus", async () => {
  const { rows } = await kirimAkun(
    "2024-11-03",
    ", komisi, jumlah_upload",
    ", 100000, 2",
  );
  const id = rows[0].id;

  await sebagaiAdmin(
    db,
    `select perbaiki_laporan_harian($1, 2000000, $2, null, 250000, 6)`,
    [id, "rekap ulang setelah tutup buku harian"],
  );

  const baris = await satu(
    `select gmv, komisi, jumlah_upload, status from daily_reports where id=$1`,
    [id],
  );
  harusSama(Number(baris.gmv), 2000000);
  harusSama(Number(baris.komisi), 250000);
  harusSama(baris.jumlah_upload, 6);
  harusSama(baris.status, "revisi");

  const jejak = await satu(
    `select alasan, komisi_baru, upload_baru
       from daily_report_revisions where report_id=$1`,
    [id],
  );
  harusSama(jejak.alasan, "rekap ulang setelah tutup buku harian");
  harusSama(Number(jejak.komisi_baru), 250000);
  harusSama(jejak.upload_baru, 6);
});

uji("bentuk lama perbaiki_laporan_harian sudah tidak ada", async () => {
  // Dibiarkan hidup, pemanggil lama akan mengosongkan komisi diam-diam.
  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int as n
       from pg_proc where proname = 'perbaiki_laporan_harian'`,
  );
  harusSama(rows[0].n, 1, "hanya satu bentuk fungsi yang boleh ada");
});

uji("perbaikan tanpa perubahan apa pun tidak membuat jejak", async () => {
  const { rows } = await kirimAkun("2024-11-04", ", komisi", ", 100000");
  const id = rows[0].id;
  await sebagaiAdmin(
    db,
    `update daily_reports set catatan = 'sekadar merapikan catatan' where id=$1`,
    [id],
  );
  const n = await satu(
    `select count(*)::int as n from daily_report_revisions where report_id=$1`,
    [id],
  );
  harusSama(n.n, 0, "mengubah catatan bukan revisi angka");
});

uji("laporan bertanggal masa depan ditolak untuk pengguna", async () => {
  const besokSekali = (
    await satu(`select ((now() at time zone 'Asia/Jakarta')::date + 5) as d`)
  ).d
    .toISOString()
    .slice(0, 10);

  await harusDitolak(
    () =>
      sebagai(
        db,
        U.rian,
        `insert into daily_reports (user_id, tanggal, account_id, gmv)
         values ($1,$2,$3,1000000)`,
        [U.rian, besokSekali, A.skincare],
      ),
    "tanggal masa depan seharusnya ditolak",
  );
});

uji("seed dan migrasi tetap boleh menulis tanggal lampau", async () => {
  // Tanpa auth.uid() pagar tidak berlaku — seed memang mengisi riwayat.
  const { rows } = await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, account_id, gmv)
     values ($1,'2024-09-01',$2,500000) returning id`,
    [U.rian, A.skincare],
  );
  harus(rows.length === 1, "baris lampau seharusnya tersimpan");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
