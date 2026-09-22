// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import type { Pengguna } from "@/lib/types";
import {
  predikatDariSkor,
  skorKpi,
  type BarisScorecard,
  type DefinisiKpi,
  type RincianKpi,
  type SumberKpi,
} from "@/lib/kpi";

// Diekspor ulang agar pemanggil lama tetap jalan; sumbernya di "@/lib/kpi".
export type { BarisScorecard, DefinisiKpi, RincianKpi, SumberKpi };
export { predikatDariSkor, skorKpi };

/**
 * Definisi KPI, dikelompokkan per jabatan.
 *
 * `termasukNonaktif` hanya dipakai layar pengelolaan: indikator yang sudah
 * dimatikan harus tetap terlihat agar bisa dihidupkan lagi, tetapi tidak
 * boleh ikut ke mana pun skor dihitung.
 */
export async function definisiKpi(
  { termasukNonaktif = false }: { termasukNonaktif?: boolean } = {},
): Promise<DefinisiKpi[]> {
  if (modeData() === "demo") {
    return dataContoh.kpi_definitions.map((k, i) => ({
      id: `contoh-${i}`,
      jabatan: k.jabatan,
      namaKpi: k.nama,
      periode: "bulanan",
      bobot: k.bobot,
      satuan: k.satuan,
      skala: 1000,
      targetBase: k.base,
      targetGoal: k.goal,
      targetStretch: k.stretch,
      sumberData: k.sumber as SumberKpi,
      aktif: true,
    }));
  }

  const sb = await klienServer();
  let kueri = sb
    .from("kpi_definitions")
    .select(
      "id, jabatan, nama_kpi, periode, bobot, satuan, skala, target_base, target_goal, target_stretch, sumber_data, aktif",
    );
  if (!termasukNonaktif) kueri = kueri.eq("aktif", true);

  const { data, error } = await kueri
    .order("jabatan")
    .order("aktif", { ascending: false })
    .order("bobot", { ascending: false });

  if (error) throw new Error(`Gagal memuat definisi KPI: ${error.message}`);

  return (data ?? []).map((k) => ({
    id: k.id,
    jabatan: k.jabatan,
    namaKpi: k.nama_kpi,
    periode: k.periode,
    bobot: Number(k.bobot),
    satuan: k.satuan,
    skala: k.skala,
    targetBase: Number(k.target_base),
    targetGoal: Number(k.target_goal),
    targetStretch: Number(k.target_stretch),
    sumberData: k.sumber_data as SumberKpi,
    aktif: k.aktif,
  }));
}

/** Dikelompokkan per jabatan, dengan total bobotnya. */
export function kelompokkanPerJabatan(daftar: DefinisiKpi[]) {
  const peta = new Map<string, DefinisiKpi[]>();
  for (const d of daftar) {
    peta.set(d.jabatan, [...(peta.get(d.jabatan) ?? []), d]);
  }

  return [...peta.entries()].map(([jabatan, indikator]) => ({
    jabatan,
    indikator,
    // Hanya indikator aktif yang menanggung penilaian.
    totalBobot: indikator
      .filter((i) => i.aktif)
      .reduce((a, i) => a + i.bobot, 0),
  }));
}

/** Definisi KPI yang berlaku untuk seorang pengguna. */
export async function definisiUntuk(pengguna: Pengguna) {
  const semua = await definisiKpi();
  return semua.filter((d) => d.jabatan === pengguna.role);
}

/**
 * Scorecard KPI seluruh tim yang terlihat pengguna.
 * Memakai snapshot bila bulan itu sudah dikunci; bila belum, dihitung ulang.
 */
export async function scorecardTim(
  pengguna: Pengguna,
  bulan: string,
  sampai: string,
): Promise<BarisScorecard[]> {
  if (modeData() === "demo") {
    return scorecardDemo(pengguna, bulan, sampai);
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("scorecard_tim", {
    p_bulan: bulan,
    p_sampai: sampai,
  });

  if (error) throw new Error(`Gagal memuat scorecard: ${error.message}`);

  return (data ?? []).map((b) => ({
    userId: b.user_id,
    nama: b.nama,
    inisial: b.inisial,
    jabatan: b.jabatan,
    unit: b.unit,
    skor: Number(b.skor),
    predikat: b.predikat,
    cakupan: Number(b.cakupan),
    rincian: (b.detail as RincianKpi[]) ?? [],
    terkunci: b.terkunci,
  }));
}

export type StatusKunciKpi = {
  terkunci: number;
  belum: number;
  dikunciOleh: string | null;
  dikunciPada: string | null;
  bulanTuntas: boolean;
};

/**
 * Status penguncian KPI sebuah bulan.
 * Mode demo tidak pernah menyimpan apa pun, jadi selalu belum terkunci.
 */
export async function statusKunciKpi(
  bulan: string,
  hariIni: string,
): Promise<StatusKunciKpi> {
  if (modeData() === "demo") {
    const akhirBulan = new Date(
      Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0),
    )
      .toISOString()
      .slice(0, 10);
    return {
      terkunci: 0,
      belum: dataContoh.users.length,
      dikunciOleh: null,
      dikunciPada: null,
      bulanTuntas: akhirBulan < hariIni,
    };
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("status_kunci_kpi", { p_bulan: bulan });

  if (error) throw new Error(`Gagal memuat status kunci KPI: ${error.message}`);

  const r = data?.[0];
  return {
    terkunci: Number(r?.terkunci ?? 0),
    belum: Number(r?.belum ?? 0),
    dikunciOleh: r?.dikunci_oleh ?? null,
    dikunciPada: r?.dikunci_pada ?? null,
    bulanTuntas: r?.bulan_tuntas ?? false,
  };
}

// ---------------------------------------------------------------------
// Mode demo — rumus yang sama persis dengan SQL, data dari seed.
//
// Paritas dua mode dijaga sengaja: setiap aturan lingkup dan setiap
// kondisi "tidak berlaku" di sini punya padanan langsung di
// supabase/migrations/0032–0036.
// ---------------------------------------------------------------------
function porsiBulan(bulan: string, sampai: string) {
  const hariBulan = new Date(
    Number(bulan.slice(0, 4)),
    Number(bulan.slice(5, 7)),
    0,
  ).getDate();
  const hariLewat = Math.min(Number(sampai.slice(8, 10)), hariBulan);
  return Math.max(hariLewat / hariBulan, 0.01);
}

/** Padanan `awal_pekan()` — Senin dari pekan tanggal tersebut. */
function awalPekan(tanggal: string) {
  const d = new Date(`${tanggal}T00:00:00Z`);
  const geser = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - geser);
  return d.toISOString().slice(0, 10);
}

function scorecardDemo(
  pengguna: Pengguna,
  bulan: string,
  sampai: string,
): BarisScorecard[] {
  const {
    users,
    units,
    accounts,
    daily_reports,
    attendance,
    tasks,
    goals,
    lead_measures,
    lead_measure_entries,
    kpi_definitions,
  } = dataContoh;

  const porsi = porsiBulan(bulan, sampai);
  const akunUnit = Object.fromEntries(
    accounts.map((a) => [a.username, a.unit]),
  );
  const dalamBulan = daily_reports.filter(
    (l) => l.tanggal >= bulan && l.tanggal <= sampai,
  );
  const gmvUnit = (unit: string) =>
    dalamBulan
      .filter((l) => (l.unit ?? akunUnit[l.akun as string]) === unit)
      .reduce((a, l) => a + l.gmv, 0);

  // Lingkup GMV: akun bila ia PIC, selain itu unitnya. (0035)
  const realisasiGmv = (u: (typeof users)[number]): number | null => {
    if (u.role === "Staff") {
      const akun = accounts.filter(
        // Seluruh goal di seed berstatus aktif, jadi cukup dicek keberadaannya.
        (a) => a.pic === u.nama && goals.some((g) => g.account === a.username),
      );
      if (akun.length > 0) {
        const target =
          akun.reduce(
            (a, x) =>
              a +
              (goals.find((g) => g.account === x.username)?.target_bulan ?? 0),
            0,
          ) * porsi;
        const realisasi = dalamBulan
          .filter((l) => akun.some((x) => x.username === l.akun))
          .reduce((a, l) => a + l.gmv, 0);
        return target > 0 ? (realisasi / target) * 100 : null;
      }
      if (!u.unit) return null;
      const goal = goals.find((g) => g.unit === u.unit && g.level === "leader");
      const target = (goal?.target_bulan ?? 0) * porsi;
      return target > 0 ? (gmvUnit(u.unit) / target) * 100 : null;
    }

    if ((u.role === "Leader" || u.role === "Co-Leader") && u.unit) {
      const goal = goals.find((g) => g.unit === u.unit && g.level === "leader");
      const target = (goal?.target_bulan ?? 0) * porsi;
      return target > 0 ? (gmvUnit(u.unit) / target) * 100 : null;
    }

    if (u.role === "Manager" || u.role === "CEO") {
      const goal = goals.find((g) => g.pemilik === u.nama && !g.unit);
      const target = (goal?.target_bulan ?? 0) * porsi;
      const realisasi = dalamBulan.reduce((a, l) => a + l.gmv, 0);
      return target > 0 ? (realisasi / target) * 100 : null;
    }

    return null;
  };

  // Lingkup lead measure mengikuti tanggung jawab jabatan. (0036)
  const realisasiLead = (u: (typeof users)[number]): number | null => {
    const unitLead = (id: string) =>
      lead_measures.find((m) => m.id === id)?.unit;
    const entri = lead_measure_entries.filter((e) => {
      if (e.tanggal < bulan || e.tanggal > sampai) return false;
      if (u.role === "Staff") return e.user === u.nama;
      if (u.role === "Leader" || u.role === "Co-Leader")
        return unitLead(e.lead) === u.unit;
      return u.role === "Manager" || u.role === "CEO";
    });
    if (entri.length === 0) return null;

    const perLead = new Map<string, { nilai: number; pekan: Set<string> }>();
    for (const e of entri) {
      const k = perLead.get(e.lead) ?? { nilai: 0, pekan: new Set<string>() };
      k.nilai += e.nilai;
      k.pekan.add(awalPekan(e.tanggal));
      perLead.set(e.lead, k);
    }

    let target = 0;
    let nilai = 0;
    for (const [id, k] of perLead) {
      const lm = lead_measures.find((m) => m.id === id);
      target += (lm?.target_mingguan ?? 0) * k.pekan.size;
      nilai += k.nilai;
    }
    return target > 0 ? (nilai / target) * 100 : null;
  };

  const realisasi = (
    u: (typeof users)[number],
    sumber: SumberKpi,
  ): number | null => {
    if (sumber === "gmv") return realisasiGmv(u);
    if (sumber === "lead_measure") return realisasiLead(u);

    if (sumber === "absensi") {
      const baris = attendance.filter(
        (a) => a.user === u.nama && a.tanggal >= bulan && a.tanggal <= sampai,
      );
      return baris.length > 0
        ? (baris.filter((a) => a.status === "hadir").length / baris.length) *
            100
        : null;
    }

    if (sumber === "tiket") {
      const milik = tasks.filter((t) => {
        if (t.penerima !== u.nama || t.tipe === "pribadi") return false;
        const hari = t.tenggat?.slice(0, 10);
        return hari !== undefined && hari >= bulan && hari <= sampai;
      });
      return milik.length > 0
        ? (milik.filter((t) => t.status === "selesai").length / milik.length) *
            100
        : null;
    }

    return null;
  };

  return users
    .map((u) => {
      const def = kpi_definitions.filter((k) => k.jabatan === u.role);
      const rincian: RincianKpi[] = def.map((k) => {
        const r = realisasi(u, k.sumber as SumberKpi);
        return {
          nama: k.nama,
          bobot: k.bobot,
          satuan: k.satuan,
          sumber: k.sumber as SumberKpi,
          realisasi: r === null ? null : Math.round(r * 10) / 10,
          skor: r === null ? null : skorKpi(r, k.base, k.goal, k.stretch),
          berlaku: r !== null,
        };
      });

      const bobotBerlaku = rincian
        .filter((r) => r.berlaku)
        .reduce((a, r) => a + r.bobot, 0);
      const bobotTotal = rincian.reduce((a, r) => a + r.bobot, 0);
      const skor =
        bobotBerlaku > 0
          ? Math.round(
              (rincian.reduce((a, r) => a + (r.skor ?? 0) * r.bobot, 0) /
                bobotBerlaku) *
                10,
            ) / 10
          : 0;

      return {
        userId: u.id,
        nama: u.nama,
        inisial: u.inisial,
        jabatan: u.jabatan,
        unit: u.unit
          ? (units.find((x) => x.kode === u.unit)?.nama.split(" (")[0] ?? "")
          : "Manajemen",
        skor,
        predikat: predikatDariSkor(skor),
        cakupan:
          bobotTotal > 0 ? Math.round((bobotBerlaku / bobotTotal) * 100) : 0,
        rincian,
        terkunci: false,
      } satisfies BarisScorecard;
    })
    .filter((b) => {
      if (pengguna.role === "CEO" || pengguna.role === "Manager") return true;
      if (pengguna.role === "Leader" || pengguna.role === "Co-Leader") {
        const u = users.find((x) => x.nama === b.nama);
        return u?.unit === pengguna.unitId || b.nama === pengguna.nama;
      }
      return b.nama === pengguna.nama;
    })
    .sort(
      (a, b) =>
        Number(b.cakupan >= 100) - Number(a.cakupan >= 100) ||
        b.skor - a.skor ||
        a.nama.localeCompare(b.nama),
    );
}
