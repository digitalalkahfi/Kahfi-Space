/** Skala skor KPI 1.000 dan ambang predikatnya (PRD §3). */
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
const { uji, jalankan } = buatSuite("Skor & predikat KPI");

const skor = async (realisasi, base, goal, stretch) =>
  Number(
    (
      await sebagaiAdmin(db, `select skor_kpi($1,$2,$3,$4) s`, [
        realisasi,
        base,
        goal,
        stretch,
      ])
    ).rows[0].s,
  );

const predikat = async (s) =>
  (await sebagaiAdmin(db, `select predikat_dari_skor($1) p`, [s])).rows[0].p;

uji("tepat di base bernilai 500", async () => {
  harusSama(await skor(80, 80, 100, 120), 500);
});

uji("tepat di goal bernilai 800", async () => {
  harusSama(await skor(100, 80, 100, 120), 800);
});

uji("tepat di stretch bernilai 1000", async () => {
  harusSama(await skor(120, 80, 100, 120), 1000);
});

uji("melebihi stretch tetap 1000, tidak meledak", async () => {
  harusSama(await skor(500, 80, 100, 120), 1000);
});

uji("setengah jalan base→goal bernilai 650", async () => {
  harusSama(await skor(90, 80, 100, 120), 650);
});

uji("setengah jalan goal→stretch bernilai 900", async () => {
  harusSama(await skor(110, 80, 100, 120), 900);
});

uji("di bawah base diskalakan proporsional", async () => {
  harusSama(await skor(40, 80, 100, 120), 250);
});

uji("realisasi nol bernilai nol", async () => {
  harusSama(await skor(0, 80, 100, 120), 0);
});

uji("skor tidak pernah negatif", async () => {
  harus((await skor(-50, 80, 100, 120)) >= 0, "skor negatif bocor");
});

uji("ambang predikat sesuai PRD", async () => {
  harusSama(await predikat(800), "Istimewa");
  harusSama(await predikat(799.9), "Baik");
  harusSama(await predikat(650), "Baik");
  harusSama(await predikat(649.9), "Cukup");
  harusSama(await predikat(500), "Cukup");
  harusSama(await predikat(499.9), "Perlu Perbaikan");
  harusSama(await predikat(0), "Perlu Perbaikan");
});

uji("skala KPI wajib 1.000", async () => {
  let ditolak = false;
  try {
    await sebagaiAdmin(
      db,
      `insert into kpi_definitions
         (jabatan, nama_kpi, bobot, skala, target_base, target_goal, target_stretch)
       values ('Staff', 'Uji skala', 1, 100, 1, 2, 3)`,
    );
  } catch {
    ditolak = true;
  }
  harus(ditolak, "PRD melarang KPI skala 100");
});

// ---------------------------------------------------------------------
// Indikator yang tidak berlaku (0032-0036)
// ---------------------------------------------------------------------

const BULAN = "2024-10-01";
const SAMPAI = "2024-10-24";

const skorOrang = async (nama) => {
  const { rows } = await sebagaiAdmin(
    db,
    `select skor_total, predikat, cakupan, detail
       from hitung_kpi((select id from users where nama = $1), $2, $3)`,
    [nama, BULAN, SAMPAI],
  );
  return rows[0];
};

uji("indikator tanpa data sama sekali tidak dinilai nol", async () => {
  // Orang yang tak punya catatan absensi tidak boleh dihukum 0 untuk
  // indikator itu; indikatornya gugur dan cakupannya turun.
  await sebagaiAdmin(db, "delete from attendance where user_id = (select id from users where nama = 'Intan Permata')");
  const h = await skorOrang("Intan Permata");
  const absensi = h.detail.find((d) => d.sumber === "absensi");
  harusSama(absensi.berlaku, false);
  harusSama(absensi.skor, null);
  harus(Number(h.cakupan) < 100, `cakupan harus turun, dapat ${h.cakupan}`);
  await terapkanSeed(db);
});

uji("bobot indikator yang gugur tidak ikut menimbang", async () => {
  const h = await skorOrang("Intan Permata");
  const berlaku = h.detail.filter((d) => d.berlaku);
  const bobot = berlaku.reduce((a, d) => a + Number(d.bobot), 0);
  const manual =
    Math.round((berlaku.reduce((a, d) => a + Number(d.skor) * Number(d.bobot), 0) / bobot) * 10) / 10;
  harusSama(Number(h.skor_total), manual);
});

uji("satu indikator tidak muncul dua kali", async () => {
  // Nama indikator dipakai beberapa jabatan; join yang longgar pernah
  // menggandakannya dan menggelembungkan total bobot.
  for (const nama of ["Intan Permata", "Dewi Lestari", "Farhan Pratama"]) {
    const h = await skorOrang(nama);
    const nama_nama = h.detail.map((d) => d.nama);
    harusSama(new Set(nama_nama).size, nama_nama.length);
  }
});

uji("staf tanpa akun dinilai dari capaian unitnya", async () => {
  // Anisa bukan PIC akun mana pun, tapi tetap bagian dari hasil unitnya.
  const h = await skorOrang("Anisa Larasati");
  const gmv = h.detail.find((d) => d.sumber === "gmv");
  harus(gmv.berlaku, "GMV staf non-PIC harus jatuh ke lingkup unit");
  const { rows } = await sebagaiAdmin(
    db,
    `select realisasi_gmv_kpi(
       (select id from users where nama = 'Dewi Lestari'), $1, $2) r`,
    [BULAN, SAMPAI],
  );
  // Lingkupnya sama dengan Leader unit itu, jadi realisasinya pun sama.
  harusSama(Number(gmv.realisasi), Math.round(Number(rows[0].r) * 10) / 10);
});

uji("Manager dinilai dari lead measure seluruh perusahaan", async () => {
  // Manager tidak pernah mengisi entri harian; indikatornya dulu selalu gugur.
  const h = await skorOrang("Farhan Pratama");
  const lm = h.detail.find((d) => d.sumber === "lead_measure");
  harus(lm.berlaku, "lead measure Manager harus berlingkup perusahaan");
  harusSama(Number(h.cakupan), 100);
});

uji("scorecard mendahulukan yang terukur penuh", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select cakupan, skor from scorecard_tim($1, $2)",
    [BULAN, SAMPAI],
  );
  let ketemuParsial = false;
  for (const r of rows) {
    if (Number(r.cakupan) < 100) ketemuParsial = true;
    else
      harus(
        !ketemuParsial,
        "baris terukur penuh tidak boleh berada di bawah yang parsial",
      );
  }
});

uji("bobot KPI tiap jabatan berjumlah 100", async () => {
  // Bobot yang tidak genap 100 membuat skor akhirnya tidak sebanding
  // antar-jabatan, padahal skalanya sama-sama 1.000.
  const { rows } = await sebagaiAdmin(
    db,
    `select jabatan, sum(bobot)::numeric total
       from kpi_definitions where aktif group by jabatan order by jabatan`,
  );
  for (const r of rows) {
    harusSama(Number(r.total), 100, `bobot ${r.jabatan} harus 100`);
  }
});

uji("target base < goal < stretch pada setiap indikator", async () => {
  // Urutan yang terbalik membuat `skor_kpi` menghasilkan angka yang tidak
  // berarti, tanpa satu pun galat.
  const { rows } = await sebagaiAdmin(
    db,
    `select nama_kpi from kpi_definitions
      where aktif and not (target_base < target_goal and target_goal < target_stretch)`,
  );
  harusSama(rows.map((r) => r.nama_kpi).join(", "), "");
});

uji("setiap indikator punya sumber data yang dikenali", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select nama_kpi from kpi_definitions
      where aktif and sumber_data not in ('gmv','lead_measure','absensi','tiket','manual')`,
  );
  harusSama(rows.length, 0);
});

uji("setiap jabatan PRD punya definisi KPI", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select unnest(enum_range(null::peran_pengguna))::text jabatan
       except
     select distinct jabatan from kpi_definitions where aktif`,
  );
  harusSama(rows.map((r) => r.jabatan).join(", "), "");
});

uji("Staff tidak boleh menyusun indikator KPI", async () => {
  const staf = (
    await sebagaiAdmin(db, "select id from users where nama = 'Nabila Putri'")
  ).rows[0].id;
  await harusDitolak(
    () =>
      sebagai(
        db,
        staf,
        `insert into kpi_definitions
           (jabatan, nama_kpi, bobot, satuan, target_base, target_goal, target_stretch)
         values ('Staff', 'Indikator karangan', 10, '%', 1, 2, 3)`,
      ),
    "penyusunan KPI oleh Staff seharusnya ditolak",
  );
});

uji("indikator nonaktif berhenti dinilai mulai bulan berjalan", async () => {
  const orang = (
    await sebagaiAdmin(db, "select id from users where nama = 'Nabila Putri'")
  ).rows[0].id;
  const rincian = async () =>
    (
      await sebagaiAdmin(
        db,
        `select count(*)::int n from hitung_kpi($1,'2024-10-01','2024-10-31') h,
                lateral jsonb_array_elements(h.detail) d
          where d->>'sumber' = 'absensi'`,
        [orang],
      )
    ).rows[0].n;

  harusSama(await rincian(), 1, "indikator absensi harus ikut dinilai lebih dulu");

  await sebagaiAdmin(
    db,
    "update kpi_definitions set aktif = false where jabatan = 'Staff' and sumber_data = 'absensi'",
  );

  harusSama(await rincian(), 0, "indikator yang dimatikan tidak boleh ikut dinilai");
  await terapkanSeed(db);
});

uji("snapshot terkunci tidak berubah meski indikator dimatikan", async () => {
  // Skor yang sudah final harus tetap terbaca seperti saat dikunci.
  const orang = (
    await sebagaiAdmin(db, "select id from users where nama = 'Nabila Putri'")
  ).rows[0].id;
  await sebagaiAdmin(
    db,
    `insert into kpi_snapshots
       (user_id, periode_bulan, skor_total, predikat, cakupan, detail, dikunci_pada)
     select $1, '2024-09-01', h.skor_total, h.predikat, h.cakupan, h.detail, now()
       from hitung_kpi($1, '2024-09-01', '2024-09-30') h`,
    [orang],
  );
  const sebelum = (
    await sebagaiAdmin(
      db,
      "select skor_total, cakupan from kpi_snapshots where user_id = $1 and periode_bulan = '2024-09-01'",
      [orang],
    )
  ).rows[0];

  await sebagaiAdmin(
    db,
    "update kpi_definitions set aktif = false where jabatan = 'Staff' and sumber_data = 'absensi'",
  );

  const sesudah = (
    await sebagaiAdmin(
      db,
      "select skor_total, cakupan from kpi_snapshots where user_id = $1 and periode_bulan = '2024-09-01'",
      [orang],
    )
  ).rows[0];
  harusSama(Number(sesudah.skor_total), Number(sebelum.skor_total));
  harusSama(Number(sesudah.cakupan), Number(sebelum.cakupan));
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
