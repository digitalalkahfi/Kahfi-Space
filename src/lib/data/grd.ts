// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { keputusanWrm } from "@/lib/wrm";
import type { KeputusanWrm, KodeUnit, Pengguna } from "@/lib/types";

export type GoalKorporasi = {
  judul: string;
  periode: string;
  targetBase: number;
  targetGoal: number;
  targetStretch: number;
  targetBulan: number;
  realisasi: number;
  rasio: number;
};

export type StatusWrm = {
  rasioHasil: number;
  rasioKri: number;
  hasilHijau: boolean;
  kriHijau: boolean;
  keputusan: KeputusanWrm;
};

export type PapanLead = {
  id: string;
  judul: string;
  satuan: string;
  unit: KodeUnit | null;
  realisasi: number;
  target: number;
  rasio: number;
  pendukung: number | null;
  labelPendukung: string | null;
};

export type AnakTangga = {
  id: string;
  judul: string;
  level: string;
  pemilik: string;
  jabatan: string;
  unit: KodeUnit | null;
  target: number;
  realisasi: number;
  rasio: number;
};

/** Ambang yang sama dengan fungsi `status_wrm` di database. */
export const AMBANG_WRM = { hasil: 95, kri: 90 } as const;

// ---------------------------------------------------------------------
// Mode demo — menghitung ulang dari data seed dengan rumus yang sama.
// ---------------------------------------------------------------------
function awalPekan(tanggal: string) {
  const d = new Date(`${tanggal}T00:00:00Z`);
  const isoDow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (isoDow - 1));
  return d.toISOString().slice(0, 10);
}

function hitungDemo(tanggal: string) {
  const {
    goals,
    daily_reports,
    lead_measures,
    lead_measure_entries,
    accounts,
  } = dataContoh;

  const awalBulan = `${tanggal.slice(0, 7)}-01`;
  const hariBulan = new Date(
    Number(tanggal.slice(0, 4)),
    Number(tanggal.slice(5, 7)),
    0,
  ).getDate();

  const gmvBulan = daily_reports
    .filter((l) => l.tanggal >= awalBulan && l.tanggal <= tanggal)
    .reduce((a, l) => a + l.gmv, 0);

  const company = goals.find((g) => g.level === "company");
  const goal: GoalKorporasi = {
    judul: company?.judul ?? "Goal korporasi",
    periode: company?.periode ?? "",
    targetBase: company?.target_base ?? 0,
    targetGoal: company?.target_goal ?? 0,
    targetStretch: company?.target_stretch ?? 0,
    targetBulan: company?.target_bulan ?? 0,
    realisasi: gmvBulan,
    rasio: company?.target_bulan
      ? Math.round((gmvBulan / company.target_bulan) * 1000) / 10
      : 0,
  };

  const mulai = awalPekan(tanggal);
  const papan: PapanLead[] = lead_measures.map((m) => {
    const entri = lead_measure_entries.filter(
      (e) => e.lead === m.id && e.tanggal >= mulai && e.tanggal <= tanggal,
    );
    const realisasi = entri.reduce((a, e) => a + e.nilai, 0);
    const pendukung = entri.reduce((a, e) => a + (e.nilai_pendukung ?? 0), 0);
    return {
      id: m.id,
      judul: m.judul,
      satuan: m.satuan,
      unit: m.unit as KodeUnit,
      realisasi,
      target: m.target_mingguan,
      rasio: Math.round((realisasi / m.target_mingguan) * 1000) / 10,
      pendukung: m.label_pendukung ? pendukung : null,
      labelPendukung: m.label_pendukung,
    };
  });

  const akunUnit = Object.fromEntries(
    accounts.map((a) => [a.username, a.unit]),
  );
  const gmvUnitBulan = (kode: string) =>
    daily_reports
      .filter((l) => l.tanggal >= awalBulan && l.tanggal <= tanggal)
      .filter((l) => (l.unit ?? akunUnit[l.akun as string]) === kode)
      .reduce((a, l) => a + l.gmv, 0);

  const tangga: AnakTangga[] = goals
    .filter((g) => g.level === "manager" || g.level === "leader")
    .map((g) => {
      const realisasi = g.unit ? gmvUnitBulan(g.unit) : gmvBulan;
      return {
        id: g.id,
        judul: g.judul,
        level: g.level,
        pemilik: g.pemilik,
        jabatan:
          dataContoh.users.find((u) => u.nama === g.pemilik)?.jabatan ?? "",
        unit: (g.unit as KodeUnit) ?? null,
        target: g.target_bulan,
        realisasi,
        rasio: g.target_bulan
          ? Math.round((realisasi / g.target_bulan) * 1000) / 10
          : 0,
      };
    })
    .sort((a, b) =>
      a.level === "manager" ? -1 : b.level === "manager" ? 1 : 0,
    );

  // Hasil: GMV pekan berjalan vs target prorata pekan.
  const hariPekan =
    (Date.parse(`${tanggal}T00:00:00Z`) - Date.parse(`${mulai}T00:00:00Z`)) /
      86_400_000 +
    1;
  const targetHarian = goals
    .filter((g) => g.level === "leader")
    .reduce((a, g) => a + g.target_bulan / hariBulan, 0);
  const gmvPekan = daily_reports
    .filter((l) => l.tanggal >= mulai && l.tanggal <= tanggal)
    .reduce((a, l) => a + l.gmv, 0);

  const rasioHasil =
    targetHarian > 0
      ? Math.round((gmvPekan / (targetHarian * hariPekan)) * 1000) / 10
      : 0;
  const rasioKri =
    papan.length > 0
      ? Math.round(
          (papan.reduce((a, p) => a + p.rasio, 0) / papan.length) * 10,
        ) / 10
      : 0;

  const hasilHijau = rasioHasil >= AMBANG_WRM.hasil;
  const kriHijau = rasioKri >= AMBANG_WRM.kri;

  const wrm: StatusWrm = {
    rasioHasil,
    rasioKri,
    hasilHijau,
    kriHijau,
    keputusan: hasilHijau
      ? kriHijau
        ? "LANJUT"
        : "SABAR"
      : kriHijau
        ? "ALARM"
        : "UBAH CARA",
  };

  return { goal, wrm, papan, tangga };
}

/** Semua angka yang dibutuhkan satu layar GRD. */
export async function ringkasanGrd(pengguna: Pengguna, tanggal: string) {
  if (modeData() === "demo") return hitungDemo(tanggal);

  const sb = await klienServer();
  const [g, w, p, t] = await Promise.all([
    sb.rpc("goal_korporasi", { p_tanggal: tanggal }),
    sb.rpc("status_wrm", { p_tanggal: tanggal }),
    sb.rpc("papan_lead_measure", { p_tanggal: tanggal }),
    sb.rpc("anak_tangga_target", { p_tanggal: tanggal }),
  ]);

  const gk = g.data?.[0];
  const wr = w.data?.[0];

  return {
    goal: {
      judul: gk?.judul ?? "Goal korporasi",
      periode: gk?.periode ?? "",
      targetBase: Number(gk?.target_base ?? 0),
      targetGoal: Number(gk?.target_goal ?? 0),
      targetStretch: Number(gk?.target_stretch ?? 0),
      targetBulan: Number(gk?.target_bulan ?? 0),
      realisasi: Number(gk?.realisasi ?? 0),
      rasio: Number(gk?.rasio ?? 0),
    } satisfies GoalKorporasi,
    wrm: {
      rasioHasil: Number(wr?.rasio_hasil ?? 0),
      rasioKri: Number(wr?.rasio_kri ?? 0),
      hasilHijau: wr?.status_hasil === "hijau",
      kriHijau: wr?.status_kri === "hijau",
      keputusan: (wr?.keputusan ?? "UBAH CARA") as KeputusanWrm,
    } satisfies StatusWrm,
    papan: (p.data ?? []).map((m) => ({
      id: m.lead_id,
      judul: m.judul,
      satuan: m.satuan,
      unit: m.unit_kode,
      realisasi: Number(m.realisasi),
      target: Number(m.target),
      rasio: Number(m.rasio),
      pendukung: m.pendukung === null ? null : Number(m.pendukung),
      labelPendukung: m.label_pendukung,
    })) satisfies PapanLead[],
    tangga: (t.data ?? []).map((x) => ({
      id: x.goal_id,
      judul: x.judul,
      level: x.level,
      pemilik: x.pemilik ?? "—",
      jabatan: x.jabatan ?? "",
      unit: x.unit_kode,
      target: Number(x.target),
      realisasi: Number(x.realisasi),
      rasio: Number(x.rasio),
    })) satisfies AnakTangga[],
  };
}

export type EntriLead = {
  tanggal: string;
  nilai: number;
  nilaiPendukung: number | null;
  catatan: string;
  oleh: string;
};

/** Lead measure hanya disusun CEO/Manager — sejalan `lead_measures_kelola`. */
export function bolehKelolaLeadMeasure(pengguna: Pengguna) {
  return pengguna.role === "CEO" || pengguna.role === "Manager";
}

export type LeadDetail = PapanLead & {
  entri: EntriLead[];
  goalJudul: string;
};

/** Lead measure beserta entri harian pekan berjalan. */
export async function detailLeadMeasure(
  pengguna: Pengguna,
  tanggal: string,
): Promise<LeadDetail[]> {
  const mulai = awalPekan(tanggal);
  const sampai = new Date(`${mulai}T00:00:00Z`);
  sampai.setUTCDate(sampai.getUTCDate() + 6);
  const akhir = sampai.toISOString().slice(0, 10);

  if (modeData() === "demo") {
    const { papan } = hitungDemo(tanggal);
    const { lead_measure_entries, goals, lead_measures } = dataContoh;

    return papan.map((m) => {
      const sumber = lead_measures.find((x) => x.id === m.id);
      const goal = goals.find(
        (g) => g.unit === sumber?.unit && g.level === "leader",
      );
      return {
        ...m,
        goalJudul: goal?.judul ?? "",
        entri: lead_measure_entries
          .filter(
            (e) => e.lead === m.id && e.tanggal >= mulai && e.tanggal <= akhir,
          )
          .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
          .map((e) => ({
            tanggal: e.tanggal,
            nilai: e.nilai,
            nilaiPendukung: e.nilai_pendukung ?? null,
            catatan: e.catatan,
            oleh: e.user,
          })),
      };
    });
  }

  const sb = await klienServer();
  const { data: papanData } = await sb.rpc("papan_lead_measure", {
    p_tanggal: tanggal,
  });

  const { data: entriData } = await sb
    .from("lead_measure_entries")
    .select(
      "lead_measure_id, tanggal, nilai, nilai_pendukung, catatan, users:user_id (nama)",
    )
    .gte("tanggal", mulai)
    .lte("tanggal", akhir)
    .order("tanggal");

  const { data: goalData } = await sb
    .from("lead_measures")
    .select("id, goals:goal_id (judul)");

  const judulGoal = new Map(
    (goalData ?? []).map((g) => [
      g.id,
      (g.goals as unknown as { judul: string } | null)?.judul ?? "",
    ]),
  );

  return (papanData ?? []).map((m) => ({
    id: m.lead_id,
    judul: m.judul,
    satuan: m.satuan,
    unit: m.unit_kode,
    realisasi: Number(m.realisasi),
    target: Number(m.target),
    rasio: Number(m.rasio),
    pendukung: m.pendukung === null ? null : Number(m.pendukung),
    labelPendukung: m.label_pendukung,
    goalJudul: judulGoal.get(m.lead_id) ?? "",
    entri: (entriData ?? [])
      .filter((e) => e.lead_measure_id === m.lead_id)
      .map((e) => ({
        tanggal: e.tanggal,
        nilai: Number(e.nilai),
        nilaiPendukung:
          e.nilai_pendukung === null ? null : Number(e.nilai_pendukung),
        catatan: e.catatan,
        oleh: (e.users as unknown as { nama: string } | null)?.nama ?? "—",
      })),
  }));
}

export type LaporanMingguan = {
  periode: string;
  unit: string | null;
  targetMingguan: number;
  gmvTotal: number;
  rasioHasil: number;
  rasioKri: number;
  hasilHijau: boolean;
  kriHijau: boolean;
  keputusan: KeputusanWrm;
  merahBeruntun: number;
  ringkasan: string;
};

/** Senin pekan dari sebuah tanggal, dihitung dalam UTC. */
export function seninPekan(tanggal: string) {
  return awalPekan(tanggal);
}

/**
 * Riwayat laporan mingguan per unit.
 *
 * Bila tabel `weekly_reports` belum terisi (laporan dibentuk manual oleh
 * Manager), pekan berjalan tetap ditampilkan dari perhitungan langsung
 * supaya layar tidak kosong.
 */
export async function laporanMingguan(
  pengguna: Pengguna,
  tanggal: string,
  jumlahPekan = 6,
): Promise<LaporanMingguan[]> {
  const mulai = awalPekan(tanggal);

  if (modeData() === "demo") {
    const { wrm } = hitungDemo(tanggal);
    const { goals, daily_reports } = dataContoh;
    const hariBulan = new Date(
      Number(tanggal.slice(0, 4)),
      Number(tanggal.slice(5, 7)),
      0,
    ).getDate();
    const targetHarian = goals
      .filter((g) => g.level === "leader")
      .reduce((a, g) => a + g.target_bulan / hariBulan, 0);

    const hasil: LaporanMingguan[] = [];
    for (let i = 0; i < jumlahPekan; i += 1) {
      const senin = new Date(`${mulai}T00:00:00Z`);
      senin.setUTCDate(senin.getUTCDate() - i * 7);
      const dari = senin.toISOString().slice(0, 10);
      const minggu = new Date(senin);
      minggu.setUTCDate(minggu.getUTCDate() + 6);
      const sampai = i === 0 ? tanggal : minggu.toISOString().slice(0, 10);

      const gmv = daily_reports
        .filter((l) => l.tanggal >= dari && l.tanggal <= sampai)
        .reduce((a, l) => a + l.gmv, 0);
      if (gmv === 0 && i > 0) continue;

      const hari =
        (Date.parse(`${sampai}T00:00:00Z`) - Date.parse(`${dari}T00:00:00Z`)) /
          86_400_000 +
        1;
      const target = targetHarian * hari;
      const rasio = target > 0 ? Math.round((gmv / target) * 1000) / 10 : 0;
      const hasilHijau = rasio >= AMBANG_WRM.hasil;
      // KRI pekan lampau tidak tersimpan di data contoh; dipakai nilai pekan ini.
      const kriHijau = i === 0 ? wrm.kriHijau : hasilHijau;

      hasil.push({
        periode: dari,
        unit: null,
        targetMingguan: Math.round(target),
        gmvTotal: gmv,
        rasioHasil: rasio,
        rasioKri: i === 0 ? wrm.rasioKri : rasio,
        hasilHijau,
        kriHijau,
        keputusan: hasilHijau
          ? kriHijau
            ? "LANJUT"
            : "SABAR"
          : kriHijau
            ? "ALARM"
            : "UBAH CARA",
        merahBeruntun: 0,
        ringkasan: "",
      });
    }

    // Merah beruntun dihitung dari pekan terlama ke terbaru.
    const urut = [...hasil].reverse();
    let beruntun = 0;
    for (const r of urut) {
      beruntun = r.hasilHijau ? 0 : beruntun + 1;
      r.merahBeruntun = beruntun;
    }

    return hasil;
  }

  const sb = await klienServer();
  const { data } = await sb
    .from("weekly_reports")
    .select(
      "periode, target_mingguan, gmv_total, rasio_hasil, rasio_kri, status_hasil, status_kri, keputusan, merah_beruntun, ringkasan, units:unit_id (nama)",
    )
    .lte("periode", mulai)
    .order("periode", { ascending: false })
    .limit(jumlahPekan);

  const tersimpan = (data ?? []).map((w) => ({
    periode: w.periode,
    unit:
      (w.units as unknown as { nama: string } | null)?.nama.split(" (")[0] ??
      null,
    targetMingguan: Number(w.target_mingguan),
    gmvTotal: Number(w.gmv_total),
    rasioHasil: Number(w.rasio_hasil),
    rasioKri: Number(w.rasio_kri),
    hasilHijau: w.status_hasil === "hijau",
    kriHijau: w.status_kri === "hijau",
    keputusan: w.keputusan as KeputusanWrm,
    merahBeruntun: w.merah_beruntun,
    ringkasan: w.ringkasan,
  }));

  // Pekan berjalan belum boleh dibekukan jadi laporan (0067), tetapi tetap
  // harus terlihat. Angkanya diambil dari perhitungan langsung — sumber yang
  // sama dengan kartu WRM harian, jadi keduanya tidak pernah berbeda.
  if (tersimpan.some((w) => w.periode === mulai)) return tersimpan;

  const { data: berjalan } = await sb.rpc("hitung_laporan_mingguan", {
    p_pekan: mulai,
    p_sampai: tanggal,
  });

  const gabungan = (berjalan ?? []).reduce(
    (a, b) => ({
      target: a.target + Number(b.target),
      gmv: a.gmv + Number(b.gmv),
      kri: a.kri + Number(b.rasio_kri),
    }),
    { target: 0, gmv: 0, kri: 0 },
  );

  const rasioHasil =
    gabungan.target > 0
      ? Math.round((gabungan.gmv / gabungan.target) * 1000) / 10
      : 0;
  const rasioKri =
    (berjalan ?? []).length > 0
      ? Math.round((gabungan.kri / (berjalan ?? []).length) * 10) / 10
      : 0;
  const hasilHijau = rasioHasil >= AMBANG_WRM.hasil;
  const kriHijau = rasioKri >= AMBANG_WRM.kri;

  return [
    {
      periode: mulai,
      unit: null,
      targetMingguan: Math.round(gabungan.target),
      gmvTotal: gabungan.gmv,
      rasioHasil,
      rasioKri,
      hasilHijau,
      kriHijau,
      keputusan: keputusanWrm(hasilHijau, kriHijau),
      merahBeruntun: 0,
      ringkasan: "",
    },
    ...tersimpan,
  ];
}
