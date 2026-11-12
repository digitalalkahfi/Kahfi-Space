/**
 * Halaman GRD per periode (0221): pohon goal, kartu anak tangga, dan
 * progres hanya membaca GRD bulan yang berlaku, dan kartu anak tangga goal
 * perusahaan mengikuti aturan ukurannya (goal 1 = GMV MCN + akun internal
 * yang belum masuk MCN, tanpa hitung dobel).
 *
 * 0221 juga mempercepat realisasi_ukuran dan policy baca. Karena itu
 * keadaan SEBELUM 0221 dipotret lebih dulu — baris yang terlihat tiap
 * peran dan semua angka realisasi/kurva/progres — lalu dibandingkan
 * dengan keadaan SESUDAHNYA: yang boleh berubah hanya yang memang
 * sengaja diubah.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanMigrasi,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const MIGRASI = "0221_grd_tampilan_per_periode.sql";
const db = await buatDb({ saring: (b) => b < MIGRASI.slice(0, 4) });
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("GRD per periode — halaman GRD");

const OKT = "2024-10-01";
const NOV = "2024-11-01";
const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu("select id from users where nama = $1", [nama])).id;
const unit = async (kode) =>
  (await satu("select id from units where kode = $1", [kode])).id;
const akun = async (username) =>
  (await satu("select id, pic_user_id from accounts where username = $1", [username]));

const AKUN_A = await akun("@skincare_official"); // internal, SUDAH masuk MCN
const AKUN_B = await akun("@beauty_daily.id"); // internal, BELUM masuk MCN
const MCN = await unit("mcn");
const AFFILIATOR = await unit("affiliator");

/** Rencana GRD satu bulan. November memakai aturan goal 1 yang baru. */
async function rencana(periode, label, aturanBaru) {
  const akhir = (
    await satu("select ($1::date + interval '1 month - 1 day')::date::text t", [
      periode,
    ])
  ).t;
  const minggu1 = (
    await satu("select ($1::date + 6)::text t", [periode])
  ).t;
  const goal = (kode, level, induk, pemilik, tambahan = {}) => ({
    kode,
    judul: `Goal ${kode} ${label}`,
    level,
    induk,
    pemilik_id: pemilik,
    unit_id: tambahan.unit ?? null,
    account_id: tambahan.akun ?? null,
    satuan: "IDR",
    base: 1,
    target: 1000,
    periode_label: label,
    tenggat: akhir,
    jenis_realisasi: "gmv",
    keterangan: "",
    status: "aktif",
    bulan: [{ bulan: periode, dari: periode, sampai: akhir, target: 1000 }],
  });
  const ukuran = (kode, goalKode, lingkup, urutan) => ({
    kode,
    judul: `Ukuran ${kode} ${label}`,
    satuan: "IDR",
    sumber: "gmv",
    goal: goalKode,
    pic_id: null,
    pic_teks: "",
    urutan,
    asal: "",
    lingkup,
    titik: [
      { tanggal: minggu1, target: 200 },
      { tanggal: akhir, target: 1000 },
    ],
  });
  const kodeAkun = "1.1.1:@skincare_official";
  const ukuranUnit = aturanBaru
    ? [
        ukuran("1.1.1", "1.1.1", [
          { account_id: AKUN_A.id, jenis_gmv: "semua", faktor: 1 },
          { account_id: AKUN_B.id, jenis_gmv: "semua", faktor: 1 },
        ], 2),
        ukuran("1.2-internal-mcn", null, [
          { account_id: AKUN_A.id, jenis_gmv: "semua", faktor: 1 },
        ], 9),
        ukuran("1.2.2", "1.2.2", [
          { unit_id: MCN, jenis_gmv: "semua", faktor: 1 },
          { sumber_kode: "1.2-internal-mcn", faktor: -1 },
        ], 4),
      ]
    : [
        ukuran("1.1.1", "1.1.1", [
          { unit_id: AFFILIATOR, jenis_gmv: "semua", faktor: 1 },
        ], 2),
        ukuran("1.2.2", "1.2.2", [
          { unit_id: MCN, jenis_gmv: "semua", faktor: 1 },
        ], 4),
      ];
  return {
    periode,
    goals: [
      goal("1", "company", null, await id("Hafidz Alkahfi")),
      goal("1.1", "manager", "1", await id("Farhan Pratama")),
      goal("1.2", "manager", "1", await id("Farhan Pratama")),
      goal("1.1.1", "leader", "1.1", await id("Dewi Lestari"), { unit: AFFILIATOR }),
      goal("1.2.2", "leader", "1.2", await id("Galih Prakoso"), { unit: MCN }),
      goal(kodeAkun, "account", "1.1.1", null, { unit: AFFILIATOR, akun: AKUN_A.id }),
    ],
    ukuran: [
      ukuran(kodeAkun, kodeAkun, [
        { account_id: AKUN_A.id, jenis_gmv: "semua", faktor: 1 },
      ], 1),
      ...ukuranUnit,
      ukuran("1.1", "1.1", [{ sumber_kode: "1.1.1", faktor: 1 }], 3),
      ukuran("1.2", "1.2", [{ sumber_kode: "1.2.2", faktor: 1 }], 5),
      ukuran("1", "1", [
        { sumber_kode: "1.1", faktor: 1 },
        { sumber_kode: "1.2", faktor: 1 },
      ], 6),
    ],
    lead: [],
  };
}

const impor = async (r) =>
  satu("select impor_grd($1::jsonb, false) r", [JSON.stringify(r)]);
await impor(await rencana(OKT, "Oktober 2024", false));
await impor(await rencana(NOV, "November 2024", true));

// Laporan November: akun A Rp 100/hari (sudah ikut laporan MCN), akun B
// Rp 30/hari (belum masuk MCN), laporan unit MCN Rp 500/hari (total
// Partner Center, sudah memuat akun A). 1–3 November.
for (const tgl of ["2024-11-01", "2024-11-02", "2024-11-03"]) {
  await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi, jumlah_upload, catatan, submitted_at)
     values ($1, $2, $3, 100, 10, 3, '', $2::date + time '20:00'),
            ($1, $2, $4, 30, 3, 3, '', $2::date + time '20:00')`,
    [AKUN_A.pic_user_id, tgl, AKUN_A.id, AKUN_B.id],
  );
  await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, unit_id, gmv, catatan, submitted_at)
     values ($1, $2, $3, 500, '', $2::date + time '20:00')`,
    [await id("Galih Prakoso"), tgl, MCN],
  );
}

const PERAN = {
  CEO: await id("Hafidz Alkahfi"),
  Manager: await id("Farhan Pratama"),
  Finance: await id("Laras Ayuningtyas"),
  "Leader Affiliator": await id("Dewi Lestari"),
  "Leader MCN": await id("Galih Prakoso"),
  "Co-Leader MCN": await id("Maya Safitri"),
  Staff: AKUN_A.pic_user_id,
};
const jalan = (siapa, sql, p = []) =>
  siapa === "sistem" ? sebagaiAdmin(db, sql, p) : sebagai(db, PERAN[siapa], sql, p);
const SIAPA = ["sistem", ...Object.keys(PERAN)];
const goalOkt = new Set(
  (await sebagaiAdmin(db, "select id from goals where grd_periode = $1", [OKT])).rows.map((r) => r.id),
);
const goalNov = new Set(
  (await sebagaiAdmin(db, "select id from goals where grd_periode = $1", [NOV])).rows.map((r) => r.id),
);
const ukuranSemua = (
  await sebagaiAdmin(db, "select id, kode, grd_periode::text p from grd_ukuran order by grd_periode, kode")
).rows;

/** Keadaan yang tidak boleh berubah, per peran. */
async function potret() {
  const hasil = {};
  for (const siapa of SIAPA) {
    const baris = async (tabel) =>
      (await jalan(siapa, `select id from ${tabel} order by id`)).rows.map((r) => r.id);
    const realisasi = {};
    for (const u of ukuranSemua) {
      for (const tgl of ["2024-10-10", "2024-10-31", "2024-11-02", "2024-11-30"]) {
        const r = (await jalan(siapa, "select realisasi_ukuran($1, $2)::text n", [u.id, tgl])).rows[0];
        realisasi[`${u.p} ${u.kode} @${tgl}`] = r.n;
      }
    }
    const kurva = async (periode) =>
      (await jalan(siapa, "select ukuran_id, goal_id, sumber, boleh_isi, titik from kurva_grd($1, '2024-11-20') order by ukuran_id", [periode])).rows;
    const progres = async (bulan, sampai) =>
      (await jalan(siapa, "select goal_id, target_bulan::text t, realisasi::text r from progres_goal($1, $2) order by goal_id", [bulan, sampai])).rows;
    hasil[siapa] = {
      daily_reports: await baris("daily_reports"),
      accounts: await baris("accounts"),
      goals: await baris("goals"),
      grd_ukuran: await baris("grd_ukuran"),
      realisasi,
      kurvaOkt: await kurva(OKT),
      kurvaNov: await kurva(NOV),
      progresOkt: await progres(OKT, "2024-10-31"),
      progresNov: await progres(NOV, "2024-11-20"),
      tangga: (await jalan(siapa, "select goal_id, target::text t, realisasi::text r from anak_tangga_target('2024-11-20') order by goal_id")).rows,
    };
  }
  return hasil;
}

const sebelum = await potret();
await terapkanMigrasi(db, MIGRASI);
const sesudah = await potret();

uji("baris yang terlihat tiap peran tidak berubah (policy baca)", async () => {
  for (const siapa of SIAPA) {
    for (const tabel of ["daily_reports", "accounts", "goals", "grd_ukuran"]) {
      harusSama(sesudah[siapa][tabel], sebelum[siapa][tabel], `${tabel} — ${siapa}`);
    }
  }
  // Pemeriksa silang: penyaringnya memang bekerja (bukan semua melihat semua).
  harus(
    sebelum.Staff.daily_reports.length < sebelum.Manager.daily_reports.length,
    "Staff seharusnya melihat lebih sedikit laporan daripada Manager",
  );
});

uji("realisasi_ukuran sama persis untuk semua ukuran, tanggal, dan peran", async () => {
  for (const siapa of SIAPA) {
    harusSama(sesudah[siapa].realisasi, sebelum[siapa].realisasi, `realisasi — ${siapa}`);
  }
});

uji("kurva_grd tidak berubah (aktual, status, boleh isi)", async () => {
  for (const siapa of SIAPA) {
    harusSama(sesudah[siapa].kurvaOkt, sebelum[siapa].kurvaOkt, `kurva Oktober — ${siapa}`);
    harusSama(sesudah[siapa].kurvaNov, sebelum[siapa].kurvaNov, `kurva November — ${siapa}`);
  }
});

uji("progres_goal hanya memuat GRD periode yang berlaku; angkanya tetap", async () => {
  for (const siapa of SIAPA) {
    const nov = sesudah[siapa].progresNov;
    harus(!nov.some((r) => goalOkt.has(r.goal_id)), `progres November memuat goal Oktober — ${siapa}`);
    harusSama(
      nov,
      sebelum[siapa].progresNov.filter((r) => !goalOkt.has(r.goal_id)),
      `progres November — ${siapa}`,
    );
    const okt = sesudah[siapa].progresOkt;
    harus(!okt.some((r) => goalNov.has(r.goal_id)), `progres Oktober memuat goal November — ${siapa}`);
    harusSama(
      okt,
      sebelum[siapa].progresOkt.filter((r) => !goalNov.has(r.goal_id)),
      `progres Oktober — ${siapa}`,
    );
  }
  // Goal di luar GRD (seed) tetap ikut.
  harus(
    sesudah.Manager.progresNov.some((r) => !goalNov.has(r.goal_id)),
    "goal di luar GRD seharusnya tetap ada di progres",
  );
});

uji("anak tangga target tidak lagi memuat goal GRD bulan lalu", async () => {
  harus(
    sebelum.Manager.tangga.some((r) => goalOkt.has(r.goal_id)),
    "sebelum 0221 goal Oktober ikut tampil (masalah yang diperbaiki)",
  );
  for (const siapa of SIAPA) {
    const t = sesudah[siapa].tangga;
    harus(!t.some((r) => goalOkt.has(r.goal_id)), `anak tangga memuat goal Oktober — ${siapa}`);
    harusSama(
      t,
      sebelum[siapa].tangga.filter((r) => !goalOkt.has(r.goal_id)),
      `anak tangga — ${siapa}`,
    );
  }
});

uji("GRD bulan lalu berlaku sampai GRD bulan ini diimpor", async () => {
  const p = async (tgl) =>
    (await satu("select periode_grd_berlaku($1)::text p", [tgl])).p;
  harusSama(await p("2024-09-15"), null);
  harusSama(await p("2024-10-15"), OKT);
  harusSama(await p("2024-11-15"), NOV);
  harusSama(await p("2024-12-05"), NOV, "Desember tanpa GRD → November");
});

uji("goal perusahaan = GMV MCN + akun internal belum MCN, tanpa hitung dobel", async () => {
  const goal1 = (await satu("select id from goals where kode = '1' and grd_periode = $1", [NOV])).id;
  const n = async (sql, params) => Number((await satu(sql, params)).n);
  // MCN 3 × 500 = 1.500 (sudah memuat akun A) + akun B 3 × 30 = 90.
  harusSama(
    await n("select realisasi_goal_rentang($1, $2, $3) n", [goal1, NOV, "2024-11-03"]),
    1590,
  );
  harusSama(await n("select realisasi_goal($1, $2) n", [goal1, "2024-11-03"]), 1590);
  // Kartu lama menjumlah seluruh laporan: 1.500 + 300 + 90 = 1.890 (dobel).
  harusSama(
    await n("select gmv_goal_rentang(null, null, $1, $2) n", [NOV, "2024-11-03"]),
    1890,
    "pembanding: seluruh laporan November",
  );
  // Manager melihat angka yang sama; RLS tetap berlaku (security invoker).
  const m = await sebagai(db, PERAN.Manager, "select realisasi_goal_rentang($1, $2, $3) n", [goal1, NOV, "2024-11-03"]);
  harusSama(Number(m.rows[0].n), 1590);
});

uji("realisasi_goal_rentang goal di luar GRD = gmv_goal_rentang", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select g.id, g.account_id, g.unit_id
       from goals g
      where g.grd_periode is null and g.jenis_realisasi = 'gmv' and g.status = 'aktif'`,
  );
  harus(rows.length > 0, "seed seharusnya punya goal di luar GRD");
  for (const g of rows) {
    const a = await satu("select realisasi_goal_rentang($1, $2, $3)::text n", [g.id, OKT, "2024-10-31"]);
    const b = await satu("select gmv_goal_rentang($1, $2, $3, $4)::text n", [g.account_id, g.unit_id, OKT, "2024-10-31"]);
    harusSama(a.n, b.n, `goal ${g.id}`);
  }
});

uji("ukuran_goal_grd = pasangan goal–ukuran kurva_grd, tiap peran", async () => {
  for (const siapa of SIAPA) {
    const baru = (
      await jalan(siapa, "select ukuran_id, goal_id, sumber, boleh_isi from ukuran_goal_grd($1) order by ukuran_id", [NOV])
    ).rows;
    const dariKurva = sesudah[siapa].kurvaNov
      .filter((k) => k.goal_id)
      .map(({ ukuran_id, goal_id, sumber, boleh_isi }) => ({ ukuran_id, goal_id, sumber, boleh_isi }));
    harusSama(baru, dariKurva, `ukuran_goal_grd — ${siapa}`);
  }
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
