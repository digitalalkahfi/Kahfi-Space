/**
 * Hari tanpa penjualan: GMV Rp 0 yang dinyatakan pelapor.
 *
 * Pernyataan "Tidak ada penjualan" diperiksa `periksaIsiLaporan` di form dan
 * Server Action, lalu tidak disimpan: GMV 0 di database sudah berarti jualan
 * nihil (0110). Berkas ini menjaga isi yang lolos pemeriksaan itu benar-benar
 * diterima database, dan bahwa laporannya dibaca sebagai laporan sungguhan
 * oleh kunci Absen Pulang, rekap, dan kepatuhan minimum, tanpa membebaskannya
 * dari komisi wajib (0211) maupun batas minimum unggahan.
 */
import { hitungKepatuhanMinimum, statusTerkirim } from "@/lib/batas-minimum";
import {
  bersihkanIsi,
  ISI_KOSONG,
  periksaIsiLaporan,
  periksaKomisiWajib,
  PESAN_KOMISI_WAJIB,
} from "@/lib/laporan";
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  pesanDb,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Laporan hari tanpa penjualan");

const satu = async (sql, p = []) => (await sebagaiAdmin(db, sql, p)).rows[0];
const idUser = async (n) =>
  (await satu(`select id from users where nama=$1`, [n])).id;
const idAkun = async (u) =>
  (await satu(`select id from accounts where username=$1`, [u])).id;
const tgl = async (selisih) =>
  (
    await satu(
      `select ((now() at time zone 'Asia/Jakarta')::date + $1::int)::text as d`,
      [selisih],
    )
  ).d;

/** Isi seperti yang dikirim form sesudah "Tidak ada penjualan" dicentang. */
const isiTanpaPenjualan = (unit, p = {}) =>
  bersihkanIsi(unit, { ...ISI_KOSONG, tanpaPenjualan: true, ...p });

const NABILA = await idUser("Nabila Putri"); // PIC Affiliator, wajib lapor
const GALIH = await idUser("Galih Prakoso"); // Leader MCN
const AKUN = await idAkun("@fashion_hijab");
const MCN = (await satu(`select id from units where kode='mcn'`)).id;

const HARI_INI = await tgl(0);
const KEMARIN = await tgl(-1);
const DUA_HARI_LALU = await tgl(-2);
const TIGA_HARI_LALU = await tgl(-3);

// Levelnya ditetapkan supaya batas minimum akun ini jelas: level 3 = 10 video.
await sebagaiAdmin(db, `update accounts set level = 3 where id = $1`, [AKUN]);

/** Laporan akun lewat jalur yang dipakai aplikasi: sebagai pelapornya. */
const laporAkun = (tanggal, isi) =>
  sebagai(
    db,
    NABILA,
    `insert into daily_reports
       (user_id, tanggal, account_id, gmv, komisi, jumlah_upload)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [NABILA, tanggal, AKUN, isi.gmv, isi.komisi, isi.jumlahUpload],
  );

uji(
  "PIC Affiliator: isi yang lolos pemeriksaan aplikasi diterima database",
  async () => {
    const isi = isiTanpaPenjualan("affiliator", { komisi: 0, jumlahUpload: 0 });
    harusSama(periksaIsiLaporan("affiliator", isi), null, "pemeriksaan isi");
    harusSama(periksaKomisiWajib("affiliator", isi), null, "komisi wajib");

    await laporAkun(KEMARIN, isi);
    const r = await satu(
      `select gmv::int g, komisi::int k, jumlah_upload u from daily_reports
     where account_id=$1 and tanggal=$2`,
      [AKUN, KEMARIN],
    );
    harusSama(r, { g: 0, k: 0, u: 0 });
  },
);

uji(
  "0211: tanpa komisi tetap ditolak, di aplikasi maupun database",
  async () => {
    const isi = isiTanpaPenjualan("affiliator", {
      komisi: null,
      jumlahUpload: 0,
    });
    harusSama(
      periksaKomisiWajib("affiliator", isi),
      PESAN_KOMISI_WAJIB,
      "pemeriksaan aplikasi",
    );

    let pesan = null;
    try {
      await laporAkun(DUA_HARI_LALU, isi);
    } catch (e) {
      pesan = pesanDb(e);
    }
    harus(pesan?.includes(PESAN_KOMISI_WAJIB), `pesan database: ${pesan}`);
  },
);

uji("Leader MCN: laporan unit tanpa penjualan tidak butuh komisi", async () => {
  const isi = isiTanpaPenjualan("mcn");
  harusSama(periksaIsiLaporan("mcn", isi), null, "pemeriksaan isi");
  harusSama(periksaKomisiWajib("mcn", isi), null, "komisi wajib");

  await sebagai(
    db,
    GALIH,
    `insert into daily_reports (user_id, tanggal, unit_id, gmv, komisi, jumlah_upload)
     values ($1,$2,$3,$4,$5,$6)`,
    [GALIH, KEMARIN, MCN, isi.gmv, isi.komisi, isi.jumlahUpload],
  );
  const r = await satu(
    `select gmv::int g, komisi k from daily_reports where unit_id=$1 and tanggal=$2`,
    [MCN, KEMARIN],
  );
  harusSama(r, { g: 0, k: null });
});

uji("laporan GMV Rp 0 membuka kunci Absen Pulang hari ini", async () => {
  const { ok } = await satu(`select sudah_lapor_harian($1,$2) as ok`, [
    NABILA,
    HARI_INI,
  ]);
  harus(ok === true, "laporan kemarin bernilai nol memenuhi tagihan hari ini");

  await sebagaiAdmin(
    db,
    `insert into attendance (user_id, tanggal, jam_masuk, lat_masuk, lng_masuk)
     values ($1, $2, ($2::date + time '07:50') at time zone 'Asia/Jakarta',
             -6.260700, 106.810600)`,
    [NABILA, HARI_INI],
  );
  await sebagai(
    db,
    NABILA,
    `update attendance set jam_pulang = ($2::date + time '17:40')
       at time zone 'Asia/Jakarta'
     where user_id=$1 and tanggal=$2`,
    [NABILA, HARI_INI],
  );
  const { jam_pulang } = await satu(
    `select jam_pulang from attendance where user_id=$1 and tanggal=$2`,
    [NABILA, HARI_INI],
  );
  harus(jam_pulang, "jam pulang tersimpan");
});

uji(
  "status tim: terbaca sudah lapor, dengan unggahan nol bukan kosong",
  async () => {
    const r = await satu(
      `select sudah_lapor, unggahan_hari_ini from status_tim_harian($1) where user_id=$2`,
      [HARI_INI, NABILA],
    );
    harusSama(r, { sudah_lapor: true, unggahan_hari_ini: 0 });
  },
);

uji(
  "rekap GMV: hari nihil tetap punya baris dan laporannya terhitung",
  async () => {
    const r = await satu(
      `select gmv::int g, jumlah_laporan::int n from gmv_harian($1,$1)
     where tanggal = $1`,
      [TIGA_HARI_LALU],
    );
    harusSama(
      r,
      undefined,
      "belum ada laporan: tidak dibangkitkan sebagai nol",
    );

    await laporAkun(
      TIGA_HARI_LALU,
      isiTanpaPenjualan("affiliator", { komisi: 0, jumlahUpload: 12 }),
    );
    const ada = await satu(
      `select gmv::int g, jumlah_laporan::int n from gmv_harian($1,$1)`,
      [TIGA_HARI_LALU],
    );
    harusSama(ada, { g: 0, n: 1 }, "laporan nihil terhitung sebagai laporan");
  },
);

uji(
  "rekap minimum: laporan nihil dinilai dari unggahannya, bukan GMV-nya",
  async () => {
    const { rows } = await sebagai(
      db,
      NABILA,
      `select gmv::int gmv, jumlah_upload, minimum_unggahan
       from riwayat_laporan_minimum
      where account_id=$1 and tanggal = any($2::date[]) order by tanggal`,
      [AKUN, [TIGA_HARI_LALU, KEMARIN]],
    );
    harusSama(
      rows.map((r) => [
        r.gmv,
        r.jumlah_upload,
        statusTerkirim(r.jumlah_upload, r.minimum_unggahan),
      ]),
      [
        [0, 12, "terpenuhi"],
        [0, 0, "kurang"],
      ],
      "12 video memenuhi, 0 video kurang, meski GMV keduanya nol",
    );

    const rekap = await sebagai(
      db,
      NABILA,
      `select laporan, terpenuhi from rekap_minimum_akun($1,$2) where account_id=$3`,
      [TIGA_HARI_LALU, KEMARIN, AKUN],
    );
    harusSama(rekap.rows[0], { laporan: 2, terpenuhi: 1 });
  },
);

uji(
  "kepatuhan minimum: tidak ada penjualan tidak membebaskan dari unggahan",
  async () => {
    for (const t of [TIGA_HARI_LALU, KEMARIN]) {
      await sebagaiAdmin(
        db,
        `insert into attendance (user_id, tanggal, jam_masuk, lat_masuk, lng_masuk)
       values ($1, $2, ($2::date + time '08:00') at time zone 'Asia/Jakarta',
               -6.260700, 106.810600)
       on conflict (user_id, tanggal) do nothing`,
        [NABILA, t],
      );
    }
    const sql = await satu(
      `select hari_kerja, terpenuhi, minimum from kepatuhan_minimum_akun($1,$2,$3)`,
      [AKUN, TIGA_HARI_LALU, KEMARIN],
    );
    const murni = hitungKepatuhanMinimum(
      [
        { tanggal: TIGA_HARI_LALU, hariKerja: true, unggahan: 12 },
        { tanggal: KEMARIN, hariKerja: true, unggahan: 0 },
      ],
      10,
    );
    harusSama(
      {
        hari_kerja: sql.hari_kerja,
        terpenuhi: sql.terpenuhi,
        minimum: sql.minimum,
      },
      {
        hari_kerja: murni.hariKerja,
        terpenuhi: murni.terpenuhi,
        minimum: murni.minimum,
      },
    );
    harusSama(sql.terpenuhi, 1, "hanya hari dengan 12 unggahan yang terpenuhi");
  },
);

uji(
  "perbaikan: laporan nihil bisa diperbaiki dan GMV bisa dinolkan, berjejak",
  async () => {
    const { id } = await satu(
      `select id from daily_reports where account_id=$1 and tanggal=$2`,
      [AKUN, KEMARIN],
    );

    // Hanya upload yang berubah; GMV tetap nol.
    await sebagai(
      db,
      NABILA,
      `select perbaiki_laporan_harian($1, 0, $2, null, null, 11)`,
      [id, "Unggahan kemarin belum terhitung"],
    );
    harusSama(
      await satu(
        `select gmv::int g, jumlah_upload u from daily_reports where id=$1`,
        [id],
      ),
      { g: 0, u: 11 },
    );

    // Ternyata ada penjualan, lalu ternyata angka itu keliru dan kembali nol.
    await sebagai(
      db,
      NABILA,
      `select perbaiki_laporan_harian($1, 250000, $2, null, null, 11)`,
      [id, "Ada pesanan masuk setelah cutoff"],
    );
    await sebagai(
      db,
      NABILA,
      `select perbaiki_laporan_harian($1, 0, $2, null, null, 11)`,
      [id, "Pesanan itu ternyata milik akun lain"],
    );
    const jejak = (
      await sebagaiAdmin(
        db,
        `select gmv_lama::int l, gmv_baru::int b from daily_report_revisions
       where report_id=$1 order by created_at, gmv_baru desc`,
        [id],
      )
    ).rows;
    harus(
      jejak.some((j) => j.l === 250000 && j.b === 0),
      `jejak penolan GMV tercatat: ${JSON.stringify(jejak)}`,
    );
    harusSama(
      (await satu(`select gmv::int g from daily_reports where id=$1`, [id])).g,
      0,
    );
  },
);

await jalankan();
await db.close();
