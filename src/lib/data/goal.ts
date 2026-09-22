// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { aktifDemo } from "@/lib/demo";
import type { Pengguna } from "@/lib/types";
import type { LevelGoal } from "@/lib/goal";

/** Goal hanya dibuat/diubah CEO dan Manager — sejalan policy `goals_buat`. */
export function bolehKelolaGoal(pengguna: Pengguna) {
  return pengguna.role === "CEO" || pengguna.role === "Manager";
}

export type GoalRingkas = {
  id: string;
  judul: string;
  level: string;
  satuan: string;
  targetGoal: number;
  periode: string;
};

/**
 * Goal aktif yang boleh dipakai sebagai induk komitmen mingguan.
 * RLS sudah membatasi barisnya; di mode demo penyaringannya ditiru.
 */
export async function goalAktif(pengguna: Pengguna): Promise<GoalRingkas[]> {
  if (modeData() === "demo") {
    const lintas = pengguna.role === "CEO" || pengguna.role === "Manager";
    return dataContoh.goals
      .filter(
        (g) =>
          lintas || g.unit === pengguna.unitId || g.pemilik === pengguna.nama,
      )
      .map((g) => ({
        id: g.id,
        judul: g.judul,
        level: g.level,
        satuan: "IDR",
        targetGoal: g.target_goal,
        periode: g.periode,
      }));
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("goals")
    .select("id, judul, level, satuan, target_goal, periode")
    .eq("status", "aktif")
    .order("level")
    .order("judul");

  if (error) throw new Error(`Gagal memuat goal: ${error.message}`);

  return (data ?? []).map((g) => ({
    id: g.id,
    judul: g.judul,
    level: g.level,
    satuan: g.satuan,
    targetGoal: Number(g.target_goal),
    periode: g.periode,
  }));
}

export type SimpulGoal = {
  id: string;
  judul: string;
  level: "company" | "manager" | "leader" | "account" | "staff";
  pemilik: string;
  jabatan: string;
  unit: string | null;
  akun: string | null;
  periode: string;
  satuan: string;
  targetBase: number;
  targetGoal: number;
  targetStretch: number;
  targetBulan: number;
  realisasi: number;
  rasio: number;
  parentId: string | null;
  anak: SimpulGoal[];
};

const URUTAN_LEVEL = ["company", "manager", "leader", "account", "staff"];

/** Menyusun daftar datar menjadi pohon roll-down. */
function keTree(datar: Omit<SimpulGoal, "anak">[]): SimpulGoal[] {
  const peta = new Map<string, SimpulGoal>();
  for (const g of datar) peta.set(g.id, { ...g, anak: [] });

  const akar: SimpulGoal[] = [];
  for (const g of peta.values()) {
    const induk = g.parentId ? peta.get(g.parentId) : null;
    if (induk) induk.anak.push(g);
    else akar.push(g);
  }

  const urutkan = (daftar: SimpulGoal[]) => {
    daftar.sort(
      (a, b) =>
        URUTAN_LEVEL.indexOf(a.level) - URUTAN_LEVEL.indexOf(b.level) ||
        a.judul.localeCompare(b.judul),
    );
    daftar.forEach((g) => urutkan(g.anak));
  };
  urutkan(akar);

  return akar;
}

/**
 * Pohon goal berjenjang beserta capaian bulan berjalan.
 * Inilah bentuk "roll-down": company → manager → leader → akun/staf.
 */
export async function pohonGoal(
  pengguna: Pengguna,
  tanggal: string,
): Promise<SimpulGoal[]> {
  const awalBulan = `${tanggal.slice(0, 7)}-01`;

  if (modeData() === "demo") {
    const { goals, daily_reports, accounts, units, users } = dataContoh;
    const akunUnit = Object.fromEntries(
      accounts.map((a) => [a.username, a.unit]),
    );
    const dalamBulan = daily_reports.filter(
      (l) => l.tanggal >= awalBulan && l.tanggal <= tanggal,
    );

    const realisasiUntuk = (g: (typeof goals)[number]) => {
      if (g.account) {
        return dalamBulan
          .filter((l) => l.akun === g.account)
          .reduce((a, l) => a + l.gmv, 0);
      }
      if (g.unit) {
        return dalamBulan
          .filter((l) => (l.unit ?? akunUnit[l.akun as string]) === g.unit)
          .reduce((a, l) => a + l.gmv, 0);
      }
      return dalamBulan.reduce((a, l) => a + l.gmv, 0);
    };

    const datar = goals.map((g) => {
      const realisasi = realisasiUntuk(g);
      return {
        id: g.id,
        judul: g.judul,
        level: g.level as SimpulGoal["level"],
        pemilik: g.pemilik,
        jabatan: users.find((u) => u.nama === g.pemilik)?.jabatan ?? "",
        unit: g.unit
          ? (units.find((u) => u.kode === g.unit)?.nama.split(" (")[0] ?? null)
          : null,
        akun: g.account ?? null,
        periode: g.periode,
        satuan: "IDR",
        targetBase: g.target_base,
        targetGoal: g.target_goal,
        targetStretch: g.target_stretch,
        targetBulan: g.target_bulan,
        realisasi,
        rasio: g.target_bulan
          ? Math.round((realisasi / g.target_bulan) * 1000) / 10
          : 0,
        parentId: g.parent ?? null,
      };
    });

    return keTree(datar);
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("goals")
    .select(
      `id, judul, level, periode, satuan, target_base, target_goal,
       target_stretch, parent_goal_id, unit_id, account_id,
       pemilik:pemilik_id (nama, jabatan),
       units:unit_id (nama),
       accounts:account_id (username),
       goal_months (bulan, target)`,
    )
    .eq("status", "aktif");

  if (error) throw new Error(`Gagal memuat goal: ${error.message}`);

  // Realisasi tiap goal dihitung database lewat `progres_goal` (0066):
  // satu aturan, satu tempat, dan goal unit ikut menghitung akun-akunnya.
  const { data: progres } = await sb.rpc("progres_goal", {
    p_bulan: awalBulan,
    p_sampai: tanggal,
  });

  const perGoal = new Map(
    (progres ?? []).map((p) => [
      p.goal_id,
      {
        target: Number(p.target_bulan),
        realisasi: Number(p.realisasi),
        rasio: Number(p.rasio),
      },
    ]),
  );

  const datar = (data ?? []).map((g) => {
    const pemilik = g.pemilik as unknown as {
      nama: string;
      jabatan: string;
    } | null;
    const capaian = perGoal.get(g.id);
    const targetBulan = capaian?.target ?? 0;
    const realisasi = capaian?.realisasi ?? 0;

    return {
      id: g.id,
      judul: g.judul,
      level: g.level as SimpulGoal["level"],
      pemilik: pemilik?.nama ?? "—",
      jabatan: pemilik?.jabatan ?? "",
      unit:
        (g.units as unknown as { nama: string } | null)?.nama.split(" (")[0] ??
        null,
      akun:
        (g.accounts as unknown as { username: string } | null)?.username ??
        null,
      periode: g.periode,
      satuan: g.satuan,
      targetBase: Number(g.target_base),
      targetGoal: Number(g.target_goal),
      targetStretch: Number(g.target_stretch),
      targetBulan,
      realisasi,
      rasio: capaian?.rasio ?? 0,
      parentId: g.parent_goal_id,
    };
  });

  return keTree(datar);
}

export type AnakTanggaBulan = {
  bulan: string;
  target: number;
  realisasi: number;
  rasio: number;
  berjalan: boolean;
};

/**
 * Anak tangga bulanan sebuah goal: target tiap bulan beserta capaiannya.
 * Bulan yang sudah lewat memakai realisasi penuh, bulan berjalan sampai
 * tanggal acuan, bulan mendatang belum punya realisasi.
 */
export async function anakTanggaBulanan(
  goalId: string,
  tanggal: string,
): Promise<AnakTanggaBulan[]> {
  const bulanIni = `${tanggal.slice(0, 7)}-01`;

  if (modeData() === "demo") {
    const { goals, daily_reports, accounts } = dataContoh;
    const g = goals.find((x) => x.id === goalId);
    if (!g) return [];

    const akunUnit = Object.fromEntries(
      accounts.map((a) => [a.username, a.unit]),
    );
    const cocok = (l: (typeof daily_reports)[number]) => {
      if (g.account) return l.akun === g.account;
      if (g.unit) return (l.unit ?? akunUnit[l.akun as string]) === g.unit;
      return true;
    };

    return (g.bulan_list ?? []).map((b) => {
      const akhir =
        b.bulan === bulanIni ? tanggal : `${b.bulan.slice(0, 7)}-31`;
      const realisasi = daily_reports
        .filter(cocok)
        .filter((l) => l.tanggal >= b.bulan && l.tanggal <= akhir)
        .reduce((a, l) => a + l.gmv, 0);
      return {
        bulan: b.bulan,
        target: b.target,
        realisasi,
        rasio: b.target ? Math.round((realisasi / b.target) * 1000) / 10 : 0,
        berjalan: b.bulan === bulanIni,
      };
    });
  }

  const sb = await klienServer();
  const { data: bulan } = await sb
    .from("goal_months")
    .select("bulan, target")
    .eq("goal_id", goalId)
    .order("bulan");

  const { data: goal } = await sb
    .from("goals")
    .select("unit_id, account_id")
    .eq("id", goalId)
    .maybeSingle();

  const hasil: AnakTanggaBulan[] = [];
  for (const b of bulan ?? []) {
    const akhirBulan = new Date(
      Number(b.bulan.slice(0, 4)),
      Number(b.bulan.slice(5, 7)),
      0,
    )
      .toISOString()
      .slice(0, 10);
    const sampai = b.bulan === bulanIni ? tanggal : akhirBulan;

    let q = sb
      .from("daily_reports")
      .select("gmv")
      .gte("tanggal", b.bulan)
      .lte("tanggal", sampai);
    if (goal?.account_id) q = q.eq("account_id", goal.account_id);
    else if (goal?.unit_id) q = q.eq("unit_id", goal.unit_id);

    const { data: laporan } = await q;
    const realisasi = (laporan ?? []).reduce((a, r) => a + Number(r.gmv), 0);

    hasil.push({
      bulan: b.bulan,
      target: Number(b.target),
      realisasi,
      rasio: Number(b.target)
        ? Math.round((realisasi / Number(b.target)) * 1000) / 10
        : 0,
      berjalan: b.bulan === bulanIni,
    });
  }

  return hasil;
}

export type PilihanGoal = {
  orang: { id: string; nama: string; jabatan: string }[];
  induk: { id: string; judul: string; level: LevelGoal; unitId: string | null }[];
  unit: { id: string; kode: string; nama: string }[];
  akun: { id: string; username: string; unitId: string }[];
};

/**
 * Bahan isian dialog goal baru: calon pemilik, calon induk, unit, dan akun.
 * Hanya dipanggil untuk CEO/Manager — merekalah yang boleh membuat goal.
 */
export async function pilihanGoal(): Promise<PilihanGoal> {
  if (modeData() === "demo") {
    const { users, units, accounts, goals } = dataContoh;
    const idUnit = Object.fromEntries(units.map((u) => [u.kode, u.id]));
    return {
      orang: users
        .filter((u) => u.nama && aktifDemo(u))
        .map((u) => ({ id: u.id, nama: u.nama, jabatan: u.jabatan })),
      induk: goals.map((g) => ({
        id: g.id,
        judul: g.judul,
        level: g.level as LevelGoal,
        unitId: g.unit ? (idUnit[g.unit] ?? null) : null,
      })),
      unit: units.map((u) => ({ id: u.id, kode: u.kode, nama: u.nama })),
      akun: accounts.map((a) => ({
        id: a.id,
        username: a.username,
        unitId: idUnit[a.unit] ?? "",
      })),
    };
  }

  const sb = await klienServer();
  const [orang, induk, unit, akun] = await Promise.all([
    sb
      .from("users")
      .select("id, nama, jabatan")
      .eq("status", "aktif")
      .order("nama"),
    sb
      .from("goals")
      .select("id, judul, level, unit_id, account_id, accounts:account_id (unit_id)")
      .eq("status", "aktif")
      .order("judul"),
    sb.from("units").select("id, kode, nama").order("kode"),
    sb
      .from("accounts")
      .select("id, username, unit_id")
      .eq("status", "aktif")
      .order("username"),
  ]);

  return {
    orang: (orang.data ?? []).map((o) => ({
      id: o.id,
      nama: o.nama,
      jabatan: o.jabatan,
    })),
    induk: (induk.data ?? []).map((g) => ({
      id: g.id,
      judul: g.judul,
      level: g.level as LevelGoal,
      unitId:
        g.unit_id ??
        (g.accounts as unknown as { unit_id: string } | null)?.unit_id ??
        null,
    })),
    unit: (unit.data ?? []).map((u) => ({
      id: u.id,
      kode: u.kode,
      nama: u.nama,
    })),
    akun: (akun.data ?? []).map((a) => ({
      id: a.id,
      username: a.username,
      unitId: a.unit_id,
    })),
  };
}
