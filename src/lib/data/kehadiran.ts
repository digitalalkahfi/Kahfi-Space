// Modul khusus server. Impor dari komponen klien akan gagal saat build,
// bukan diam-diam bocor ke browser.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import type { AnggotaKehadiran, Pengguna, StatusAbsen } from "@/lib/types";

export type RekapKehadiran = {
  tim: AnggotaKehadiran[];
  total: number;
  sudahAbsen: number;
  /** Jumlah orang yang punya sasaran laporan harian. */
  wajibLapor: number;
  sudahLapor: number;
};

/** `alpa` di database = "belum absen" dalam bahasa antarmuka. */
function keStatus(s: string): StatusAbsen {
  return s === "alpa" ? "belum_absen" : (s as StatusAbsen);
}

function rangkum(tim: AnggotaKehadiran[]): RekapKehadiran {
  const wajib = tim.filter((a) => a.wajibLapor);
  return {
    tim,
    total: tim.length,
    sudahAbsen: tim.filter(
      (a) => a.statusAbsen === "hadir" || a.statusAbsen === "terlambat",
    ).length,
    // Penyebutnya orang yang memang punya sasaran lapor, bukan seluruh tim.
    wajibLapor: wajib.length,
    sudahLapor: wajib.filter((a) => a.sudahLapor).length,
  };
}

/** Cakupan sama dengan RLS: Leader & Co-Leader hanya unitnya sendiri. */
function dalamCakupan(pengguna: Pengguna, unitNama: string) {
  if (pengguna.role === "CEO" || pengguna.role === "Manager") return true;
  if (!pengguna.unitId) return false;
  const milik = { affiliator: "Affiliator", mcn: "MCN", tap: "TAP" }[
    pengguna.unitId
  ];
  return unitNama.startsWith(milik);
}

function hitungDemo(pengguna: Pengguna, tanggal: string): RekapKehadiran {
  const { users, units, attendance, daily_reports, accounts } = dataContoh;

  const pelapor = new Set(
    daily_reports.filter((l) => l.tanggal === tanggal).map((l) => l.user),
  );

  // Padanan `wajib_lapor_harian` di SQL: PIC akun aktif, plus Leader unit
  // yang tidak punya akun (MCN & TAP melapor per unit).
  const picAkun = new Set(accounts.map((a) => a.pic));
  const unitBerakun = new Set(accounts.map((a) => a.unit));
  const wajibLapor = (u: (typeof users)[number]) =>
    picAkun.has(u.nama) ||
    (u.role === "Leader" &&
      Boolean(u.unit) &&
      !unitBerakun.has(u.unit as string));

  const tim = users
    .map((u) => {
      const unitNama = u.unit
        ? (units.find((x) => x.kode === u.unit)?.nama.split(" (")[0] ?? "")
        : "Manajemen";
      const a = attendance.find((x) => x.user === u.nama);
      return {
        id: u.id,
        nama: u.nama,
        inisial: u.inisial,
        fotoUrl: null,
        unit: unitNama,
        statusAbsen: keStatus(a?.status ?? "alpa"),
        jamMasuk: a?.jam_masuk ?? null,
        wajibLapor: wajibLapor(u),
        sudahLapor: pelapor.has(u.nama),
      } satisfies AnggotaKehadiran;
    })
    .filter((a) => dalamCakupan(pengguna, a.unit))
    .sort((a, b) => a.nama.localeCompare(b.nama));

  return rangkum(tim);
}

type BarisStatus = {
  user_id: string;
  nama: string;
  inisial: string;
  unit_nama: string;
  status: string;
  jam_masuk: string | null;
  wajib_lapor: boolean;
  sudah_lapor: boolean;
};

/**
 * Siapa sudah absen dan siapa belum kirim laporan hari ini.
 * Dihitung PostgreSQL lewat `status_tim_harian`; RLS membatasi barisnya.
 */
export async function rekapKehadiran(
  pengguna: Pengguna,
  tanggal: string,
): Promise<RekapKehadiran> {
  if (modeData() === "demo") return hitungDemo(pengguna, tanggal);

  const sb = await klienServer();
  const { data, error } = await sb.rpc("status_tim_harian", {
    p_tanggal: tanggal,
  });

  if (error) throw new Error(`Gagal memuat kehadiran: ${error.message}`);

  const tim: AnggotaKehadiran[] = (data as unknown as BarisStatus[]).map(
    (b) => ({
      id: b.user_id,
      nama: b.nama,
      inisial: b.inisial,
      fotoUrl: null,
      unit: b.unit_nama,
      statusAbsen: keStatus(b.status),
      jamMasuk: b.jam_masuk,
      wajibLapor: b.wajib_lapor,
      sudahLapor: b.sudah_lapor,
    }),
  );

  return rangkum(tim);
}
