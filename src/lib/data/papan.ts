// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { scorecardTim } from "@/lib/data/kpi";
import {
  beriPeringkat,
  kelompokDariPeran,
  type BarisPapanAkun,
  type BarisPapanKpi,
} from "@/lib/papan";
import type { Pengguna } from "@/lib/types";

/**
 * Leaderboard NILAI KPI per level — `papan_kpi` (0196), yang membaca baris
 * scorecard yang sama (`skor_kpi_bulan`). Semua yang sudah masuk melihat
 * nama, nilai, dan predikat; rinciannya tetap di scorecard.
 *
 * Mode demo meniru: baris scorecard demo dilihat sebagai CEO, lalu
 * dikelompokkan dan diperingkat — tetap tanpa hitungan kedua.
 */
export async function papanKpi(
  pengguna: Pengguna,
  bulan: string,
  sampai: string,
): Promise<BarisPapanKpi[]> {
  if (modeData() === "demo") {
    const ceo = dataContoh.users.find((u) => u.role === "CEO");
    const semua = await scorecardTim(
      { ...pengguna, id: ceo?.id ?? pengguna.id, role: "CEO" },
      bulan,
      sampai,
    );
    const peranPer = new Map(dataContoh.users.map((u) => [u.id, u.role]));
    const baris = semua.flatMap((b): Omit<BarisPapanKpi, "peringkat">[] => {
      const kelompok = kelompokDariPeran(
        peranPer.get(b.userId) as Pengguna["role"],
      );
      if (!kelompok || b.metode !== "grd" || b.rincian.length === 0) return [];
      return [
        {
          userId: b.userId,
          nama: b.nama,
          inisial: b.inisial,
          jabatan: b.jabatan,
          unit: b.unit,
          kelompok,
          skor: b.skor,
          predikat: b.predikat,
          cakupan: b.cakupan,
          terkunci: b.terkunci,
        },
      ];
    });
    return (["leader", "co_leader", "staf"] as const).flatMap((k) =>
      beriPeringkat(
        baris.filter((b) => b.kelompok === k),
        (b) => b.skor,
      ),
    );
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("papan_kpi", {
    p_bulan: bulan,
    p_sampai: sampai,
  });
  if (error) throw new Error(`Gagal memuat leaderboard: ${error.message}`);

  return (data ?? []).map((b) => ({
    userId: b.user_id,
    nama: b.nama,
    inisial: b.inisial,
    jabatan: b.jabatan,
    unit: b.unit,
    kelompok: b.kelompok,
    skor: Number(b.skor),
    predikat: b.predikat,
    cakupan: Number(b.cakupan),
    terkunci: b.terkunci,
    peringkat: Number(b.peringkat),
  }));
}

const angkaAtauNull = (v: number | null) => (v === null ? null : Number(v));

/**
 * Papan akun GRD: % capaian target GMV per akun, tanpa akun yang
 * dikecualikan pemetaan — `papan_akun_grd` (0196). Mode demo belum punya
 * target akun GRD; daftar kosong.
 */
export async function papanAkun(
  _pengguna: Pengguna,
  periode: string,
  sampai: string,
): Promise<BarisPapanAkun[]> {
  if (modeData() === "demo") return [];

  const sb = await klienServer();
  const { data, error } = await sb.rpc("papan_akun_grd", {
    p_periode: periode,
    p_sampai: sampai,
  });
  if (error) throw new Error(`Gagal memuat papan akun: ${error.message}`);

  return (data ?? []).map((a) => ({
    accountId: a.account_id,
    username: a.username,
    pemegang: a.pemegang,
    unit: a.unit,
    realisasi: angkaAtauNull(a.realisasi),
    target: angkaAtauNull(a.target),
    persen: angkaAtauNull(a.persen),
    peringkat: Number(a.peringkat),
  }));
}
