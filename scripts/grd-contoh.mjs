/**
 * Data contoh GRD untuk tes PGlite: GRD Oktober 2024 (aturan goal 1 lama)
 * dan November 2024 (aturan goal 1 baru), plus laporan harian 1–3
 * November. Dipakai tes skema dan tes MCP kspace; nama dan angkanya
 * rekaan (seed).
 *
 * Aturan goal 1 November: GMV perusahaan = GMV MCN + GMV akun internal
 * yang belum masuk MCN, tanpa hitung dobel (ukuran bantu
 * `1.2-internal-mcn`, seperti src/lib/impor-grd.ts).
 *
 * Laporan November per hari: akun A Rp 100 (internal, SUDAH masuk MCN),
 * akun B Rp 30 (internal, BELUM masuk MCN), unit MCN Rp 500 (total
 * Partner Center, sudah memuat akun A). Sampai 3 November:
 *   1.1 = A + B = 390;  1.2 = MCN − A = 1.200;  1 = 1.590
 *   (seluruh laporan = 1.890, yang dobel).
 */
import { sebagaiAdmin } from "./db-harness.mjs";

export const OKT = "2024-10-01";
export const NOV = "2024-11-01";

/** Target goal per kode, per periode. Titik kurva = Sabtu + akhir bulan. */
export const TARGET = {
  [OKT]: { 1: 1800, "1.1": 500, "1.2": 1300, "1.1.1": 500, "1.2.2": 1300, akun: 250 },
  [NOV]: { 1: 2000, "1.1": 600, "1.2": 1400, "1.1.1": 600, "1.2.2": 1400, akun: 300 },
};

/** Setiap Sabtu dan hari terakhir bulan itu, YYYY-MM-DD. */
export function tanggalTitik(periode) {
  const [y, m] = periode.split("-").map(Number);
  const akhir = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const hasil = [];
  for (let d = 1; d <= akhir; d += 1) {
    const t = new Date(Date.UTC(y, m - 1, d));
    if (t.getUTCDay() === 6 || d === akhir) hasil.push(t.toISOString().slice(0, 10));
  }
  return hasil;
}

/** Target kumulatif tiap titik: target × i / n, dibulatkan. */
export function titikKurva(periode, target) {
  const tanggal = tanggalTitik(periode);
  return tanggal.map((t, i) => ({ tanggal: t, target: Math.round((target * (i + 1)) / tanggal.length) }));
}

export async function siapkanGrdContoh(db) {
  const satu = async (sql, params = []) => (await sebagaiAdmin(db, sql, params)).rows[0];
  const id = async (nama) => (await satu("select id from users where nama = $1", [nama])).id;
  const unit = async (kode) => (await satu("select id from units where kode = $1", [kode])).id;
  const akun = (username) => satu("select id, pic_user_id from accounts where username = $1", [username]);

  const AKUN_A = await akun("@skincare_official");
  const AKUN_B = await akun("@beauty_daily.id");
  const MCN = await unit("mcn");
  const AFFILIATOR = await unit("affiliator");
  const CEO = await id("Hafidz Alkahfi");
  const MANAGER = await id("Farhan Pratama");
  const LEADER_AFF = await id("Dewi Lestari");
  const LEADER_MCN = await id("Galih Prakoso");

  async function rencana(periode, label, aturanBaru) {
    const akhir = (await satu("select ($1::date + interval '1 month - 1 day')::date::text t", [periode])).t;
    const T = TARGET[periode];
    const kodeAkun = "1.1.1:@skincare_official";
    const targetKode = (kode) => (kode === kodeAkun ? T.akun : T[kode]);
    const goal = (kode, level, induk, pemilik, tambahan = {}) => ({
      kode,
      judul: `Goal ${kode} ${label}`,
      level,
      induk,
      pemilik_id: pemilik,
      unit_id: tambahan.unit ?? null,
      account_id: tambahan.akun ?? null,
      satuan: "IDR",
      base: Math.round(targetKode(kode) * 0.75),
      target: targetKode(kode),
      stretch: Math.round(targetKode(kode) * 1.25),
      periode_label: label,
      tenggat: akhir,
      jenis_realisasi: "gmv",
      keterangan: "",
      status: "aktif",
      bulan: [{ bulan: periode, dari: periode, sampai: akhir, target: targetKode(kode) }],
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
      // Ukuran bantu tanpa goal tidak punya kurva sendiri.
      titik: goalKode ? titikKurva(periode, targetKode(kode)) : [],
    });
    const ukuranUnit = aturanBaru
      ? [
          ukuran("1.1.1", "1.1.1", [
            { account_id: AKUN_A.id, jenis_gmv: "semua", faktor: 1 },
            { account_id: AKUN_B.id, jenis_gmv: "semua", faktor: 1 },
          ], 2),
          ukuran("1.2-internal-mcn", null, [{ account_id: AKUN_A.id, jenis_gmv: "semua", faktor: 1 }], 9),
          ukuran("1.2.2", "1.2.2", [
            { unit_id: MCN, jenis_gmv: "semua", faktor: 1 },
            { sumber_kode: "1.2-internal-mcn", faktor: -1 },
          ], 4),
        ]
      : [
          ukuran("1.1.1", "1.1.1", [{ unit_id: AFFILIATOR, jenis_gmv: "semua", faktor: 1 }], 2),
          ukuran("1.2.2", "1.2.2", [{ unit_id: MCN, jenis_gmv: "semua", faktor: 1 }], 4),
        ];
    return {
      periode,
      goals: [
        goal("1", "company", null, CEO),
        goal("1.1", "manager", "1", MANAGER),
        goal("1.2", "manager", "1", MANAGER),
        goal("1.1.1", "leader", "1.1", LEADER_AFF, { unit: AFFILIATOR }),
        goal("1.2.2", "leader", "1.2", LEADER_MCN, { unit: MCN }),
        goal(kodeAkun, "account", "1.1.1", null, { unit: AFFILIATOR, akun: AKUN_A.id }),
      ],
      ukuran: [
        ukuran(kodeAkun, kodeAkun, [{ account_id: AKUN_A.id, jenis_gmv: "semua", faktor: 1 }], 1),
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

  const impor = async (r) => satu("select impor_grd($1::jsonb, false) r", [JSON.stringify(r)]);
  await impor(await rencana(OKT, "Oktober 2024", false));
  await impor(await rencana(NOV, "November 2024", true));

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
      [LEADER_MCN, tgl, MCN],
    );
  }

  const goalPeriode = async (periode) =>
    Object.fromEntries(
      (await sebagaiAdmin(db, "select kode, id from goals where grd_periode = $1", [periode])).rows.map((r) => [
        r.kode,
        r.id,
      ]),
    );

  return {
    goal: { [OKT]: await goalPeriode(OKT), [NOV]: await goalPeriode(NOV) },
    AKUN_A,
    AKUN_B,
    MCN,
    AFFILIATOR,
    CEO,
    MANAGER,
  };
}
