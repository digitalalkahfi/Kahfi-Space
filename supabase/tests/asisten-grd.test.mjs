/**
 * Asisten Manager — GMV goal GRD dan lead measure pekan (0222).
 *
 * Yang dijaga:
 *  - asisten.gmv_grd SAMA dengan progres_goal (pohon Goal & roll-down),
 *    goal_korporasi (kartu Goal korporasi), dan kurva_grd (halaman Kurva)
 *    yang dilihat Manager — pembungkus tidak menghitung sendiri;
 *  - goal 1 = GMV MCN + akun internal yang belum masuk MCN (tanpa dobel);
 *  - yang dipakai GRD periode yang berlaku, bukan GRD bulan lain;
 *  - asisten.lead_measure_pekan SAMA dengan papan_lead_measure Manager,
 *    tanpa lead measure bersumber komisi;
 *  - hanya asisten_baca yang bisa memanggil keduanya.
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
import { NOV, OKT, siapkanGrdContoh } from "../../scripts/grd-contoh.mjs";

const db = await buatDb();
await terapkanSeed(db);
const grd = await siapkanGrdContoh(db);
const { uji, jalankan } = buatSuite("Asisten Manager — GMV GRD & lead measure (0222)");

const MANAGER = grd.MANAGER;
const T = "2024-11-05"; // Selasa; laporan November hanya 1–3 Nov.

/** Jalankan sebagai asisten_baca (tanpa JWT), dalam transaksi read-only. */
async function sebagaiAsisten(sql, params = []) {
  await db.exec("reset role;");
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec("begin; set transaction read only; set local role asisten_baca;");
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec("rollback;");
    await db.exec("reset role;");
  }
}

const KOLOM_GMV = `periode_grd::text, kode, judul, level, pemilik,
  target_base::text, target_goal::text, target_stretch::text,
  realisasi::text, rasio::text,
  titik_lalu::text, target_titik_lalu::text, aktual_titik_lalu::text, status_titik_lalu,
  titik_depan::text, target_titik_depan::text`;
const gmvGrd = (tanggal) => sebagaiAsisten(`select ${KOLOM_GMV} from asisten.gmv_grd($1)`, [tanggal]);
const bilangan = (s) => (s === null ? null : Number(s));

uji("gmv_grd: hanya goal perusahaan & Manager berukuran GMV dari GRD yang berlaku", async () => {
  const baris = await gmvGrd(T);
  harusSama(baris.map((b) => [b.kode, b.level]), [["1", "company"], ["1.1", "manager"], ["1.2", "manager"]], "goal");
  harus(baris.every((b) => b.periode_grd === NOV), "periode GRD bukan November");
  harusSama(baris.map((b) => b.pemilik), ["Hafidz Alkahfi", "Farhan Pratama", "Farhan Pratama"], "pemilik");
});

uji("gmv_grd: realisasi, rasio, dan target = progres_goal yang dilihat Manager", async () => {
  const progres = (
    await sebagai(
      db,
      MANAGER,
      `select p.goal_id, p.realisasi::text r, p.rasio::text x, g.target_base::text b,
              g.target_goal::text t, g.target_stretch::text s
         from progres_goal($1, $2) p join goals g on g.id = p.goal_id`,
      [NOV, T],
    )
  ).rows;
  const baris = await gmvGrd(T);
  for (const b of baris) {
    const p = progres.find((r) => r.goal_id === grd.goal[NOV][b.kode]);
    harus(p, `goal ${b.kode} tidak ada di progres_goal Manager`);
    harusSama(
      [b.realisasi, b.rasio, b.target_base, b.target_goal, b.target_stretch],
      [p.r, p.x, p.b, p.t, p.s],
      `angka goal ${b.kode}`,
    );
  }
});

uji("gmv_grd: goal 1 = GMV MCN + akun internal belum MCN, tanpa hitung dobel", async () => {
  const baris = await gmvGrd(T);
  const r = Object.fromEntries(baris.map((b) => [b.kode, bilangan(b.realisasi)]));
  // MCN 3 × 500 (sudah memuat akun A) + akun B 3 × 30.
  harusSama([r["1"], r["1.1"], r["1.2"]], [1590, 390, 1200], "realisasi 1, 1.1, 1.2");
  harusSama(r["1"], r["1.1"] + r["1.2"], "goal 1 = 1.1 + 1.2");
  const [{ n }] = (
    await sebagaiAdmin(db, "select gmv_goal_rentang(null, null, $1, '2024-11-03')::text n", [NOV])
  ).rows;
  harusSama(Number(n), 1890, "pembanding: seluruh laporan November (dobel)");
  harusSama(baris.map((b) => b.rasio), ["79.5", "65.0", "85.7"], "rasio vs target goal");
});

uji("gmv_grd: goal 1 = kartu Goal korporasi (goal_korporasi) Manager", async () => {
  const [gk] = (
    await sebagai(
      db,
      MANAGER,
      "select goal_id, realisasi::text r, rasio::text x, target_bulan::text t from goal_korporasi($1)",
      [T],
    )
  ).rows;
  harusSama(gk.goal_id, grd.goal[NOV]["1"], "goal korporasi bukan goal 1 GRD November");
  const [satu] = await gmvGrd(T);
  harusSama([satu.realisasi, satu.rasio, satu.target_goal], [gk.r, gk.x, gk.t], "kartu Goal korporasi");
});

uji("gmv_grd: titik kurva = kurva_grd yang dilihat Manager", async () => {
  const kurva = (
    await sebagai(db, MANAGER, "select goal_id, titik from kurva_grd($1, $2)", [NOV, T])
  ).rows;
  for (const b of await gmvGrd(T)) {
    const k = kurva.find((x) => x.goal_id === grd.goal[NOV][b.kode]);
    harus(k, `kurva goal ${b.kode} tidak ada`);
    const lalu = k.titik.filter((t) => t.tanggal <= T).at(-1);
    const depan = k.titik.find((t) => t.tanggal > T);
    harusSama(
      [b.titik_lalu, bilangan(b.target_titik_lalu), bilangan(b.aktual_titik_lalu), b.status_titik_lalu],
      [lalu.tanggal, Number(lalu.target), Number(lalu.aktual), lalu.status],
      `titik lalu ${b.kode}`,
    );
    harusSama([b.titik_depan, bilangan(b.target_titik_depan)], [depan.tanggal, Number(depan.target)], `titik depan ${b.kode}`);
  }
  // Angka konkret goal 1: Sabtu 2 Nov target 400, aktual 1.060 (2 hari).
  const [satu] = await gmvGrd(T);
  harusSama(
    [
      satu.titik_lalu,
      bilangan(satu.target_titik_lalu),
      bilangan(satu.aktual_titik_lalu),
      satu.status_titik_lalu,
      satu.titik_depan,
      bilangan(satu.target_titik_depan),
    ],
    ["2024-11-02", 400, 1060, "hijau", "2024-11-09", 800],
    "titik goal 1",
  );
});

uji("gmv_grd: GRD per periode — Oktober, Desember tanpa GRD, sebelum GRD pertama", async () => {
  const okt = await gmvGrd("2024-10-24");
  harusSama(okt.map((b) => b.kode), ["1", "1.1", "1.2"], "goal Oktober");
  harus(okt.every((b) => b.periode_grd === OKT), "Oktober memakai periode lain");
  const progresOkt = (
    await sebagai(db, MANAGER, "select goal_id, realisasi::text r from progres_goal($1, '2024-10-24')", [OKT])
  ).rows;
  for (const b of okt) {
    const p = progresOkt.find((r) => r.goal_id === grd.goal[OKT][b.kode]);
    harus(p, `goal Oktober ${b.kode} tidak ada di progres_goal`);
    harusSama(b.realisasi, p.r, `realisasi Oktober ${b.kode}`);
  }
  harus(Number(okt[0].realisasi) > 0, "data contoh Oktober kosong — tes tidak bermakna");

  // Desember belum punya GRD: yang berlaku GRD November, sampai akhir bulannya.
  const des = await gmvGrd("2024-12-05");
  harus(des.every((b) => b.periode_grd === NOV), "Desember seharusnya memakai GRD November");
  harusSama(
    [
      bilangan(des[0].realisasi),
      des[0].titik_lalu,
      bilangan(des[0].target_titik_lalu),
      bilangan(des[0].aktual_titik_lalu),
      des[0].status_titik_lalu,
      des[0].titik_depan,
    ],
    [1590, "2024-11-30", 2000, 1590, "merah", null],
    "goal 1 di Desember",
  );

  harusSama(await gmvGrd("2024-09-15"), [], "sebelum GRD pertama");
});

uji("lead_measure_pekan = papan_lead_measure Manager, tanpa lead measure komisi", async () => {
  // Maksimal 3 lead measure aktif per goal: tiap lead uji di goal seed
  // yang baru punya satu lead measure.
  const goalDari = async (judul) =>
    (await sebagaiAdmin(db, "select goal_id from lead_measures where judul = $1", [judul])).rows[0].goal_id;
  await sebagaiAdmin(
    db,
    `insert into lead_measures (goal_id, judul, satuan, target_mingguan, urutan, sumber_laporan, selesai)
     values ($1, 'Komisi affiliator uji', 'IDR', 1000, 3, 'komisi', null),
            ($2, 'Lead uji selesai Rabu', 'video', 70, 4, null, '2024-10-23')`,
    [await goalDari("Creator Binding MMC"), await goalDari("Video Affiliate & UGC")],
  );
  const TGL = "2024-10-24";
  const papan = (
    await sebagai(
      db,
      MANAGER,
      `select judul, satuan, unit_kode, realisasi::text r, target::text t, rasio::text x,
              pendukung::text p, label_pendukung, sumber_laporan
         from papan_lead_measure($1)`,
      [TGL],
    )
  ).rows;
  harus(papan.some((m) => m.sumber_laporan === "komisi"), "papan tanpa lead komisi — tes tidak bermakna");
  const asisten = await sebagaiAsisten(
    `select judul, satuan, unit_kode, realisasi::text r, target::text t, rasio::text x,
            pendukung::text p, label_pendukung, sumber_laporan
       from asisten.lead_measure_pekan($1)`,
    [TGL],
  );
  harusSama(asisten, papan.filter((m) => m.sumber_laporan !== "komisi"), "lead measure");
  const pekan = await sebagaiAsisten(
    "select distinct pekan_dari::text d, pekan_sampai::text s from asisten.lead_measure_pekan($1)",
    [TGL],
  );
  harusSama(pekan, [{ d: "2024-10-21", s: "2024-10-27" }], "pekan Senin–Minggu");
  const rabu = asisten.find((m) => m.judul === "Lead uji selesai Rabu");
  harusSama(Number(rabu.t), 30, "target lead yang selesai Rabu = 3/7 target mingguan");
  harus(asisten.length >= 4, "lead measure seed hilang");
});

uji("lead_measure_pekan: goal yang didukung ikut tertulis", async () => {
  const baris = await sebagaiAsisten("select judul, goal_judul from asisten.lead_measure_pekan('2024-10-24')");
  const live = baris.find((b) => b.judul === "Live Stream TikTok");
  const [{ judul }] = (
    await sebagaiAdmin(
      db,
      "select g.judul from lead_measures lm join goals g on g.id = lm.goal_id where lm.judul = 'Live Stream TikTok'",
    )
  ).rows;
  harusSama(live.goal_judul, judul, "judul goal");
});

uji("hanya asisten_baca: anon dan authenticated ditolak", async () => {
  for (const sql of ["select * from asisten.gmv_grd('2024-11-05')", "select * from asisten.lead_measure_pekan('2024-10-24')"]) {
    await harusDitolak(() => sebagai(db, MANAGER, sql), `authenticated boleh: ${sql}`);
    await db.exec("reset role;");
    await db.exec("set role anon;");
    try {
      await harusDitolak(() => db.query(sql), `anon boleh: ${sql}`);
    } finally {
      await db.exec("reset role;");
    }
    harus((await sebagaiAsisten(sql)).length > 0, `asisten_baca tidak mendapat baris: ${sql}`);
  }
});

await jalankan();
