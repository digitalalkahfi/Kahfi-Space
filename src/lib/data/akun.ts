// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { aktifDemo } from "@/lib/demo";
import type { KodeUnit, Pengguna } from "@/lib/types";

export type StatusAkun = "aktif" | "nonaktif";

export type AkunKelola = {
  id: string;
  username: string;
  platform: string;
  unitKode: KodeUnit | null;
  unitNama: string;
  program: string | null;
  picId: string | null;
  picNama: string | null;
  picInisial: string | null;
  coLeaderId: string | null;
  coLeaderNama: string | null;
  status: StatusAkun;
  /** GMV akun ini sepanjang periode berjalan, dari Laporan Harian. */
  gmvPeriode: number;
};

export type KandidatPic = {
  id: string;
  nama: string;
  jabatan: string;
  inisial: string;
  /** Banyaknya akun aktif yang sudah ia pegang. */
  jumlahAkun: number;
};

/** Hanya CEO dan Manager yang boleh mengubah akun — sejalan `accounts_kelola`. */
export function bolehKelolaAkun(pengguna: Pengguna) {
  return pengguna.role === "CEO" || pengguna.role === "Manager";
}

/**
 * Daftar akun yang terlihat pengguna, beserta PIC dan capaian periodenya.
 * Penyaringan sebenarnya dikerjakan RLS; mode demo menirunya persis.
 */
export async function daftarAkun(
  pengguna: Pengguna,
  bulan: string,
  sampai: string,
): Promise<AkunKelola[]> {
  if (modeData() === "demo") return akunDemo(pengguna, bulan, sampai);

  const sb = await klienServer();
  const { data, error } = await sb
    .from("accounts")
    .select(
      `id, platform, username, status,
       pic:users!accounts_pic_user_id_fkey (id, nama),
       co_leader:users!accounts_co_leader_id_fkey (id, nama),
       unit:units (kode, nama),
       program:programs (nama)`,
    )
    .order("username");

  if (error) throw new Error(`Gagal memuat akun: ${error.message}`);

  const { data: gmv, error: galatGmv } = await sb
    .from("daily_reports")
    .select("account_id, gmv")
    .gte("tanggal", bulan)
    .lte("tanggal", sampai);

  if (galatGmv) throw new Error(`Gagal memuat GMV akun: ${galatGmv.message}`);

  const perAkun = new Map<string, number>();
  for (const l of gmv ?? []) {
    if (!l.account_id) continue;
    perAkun.set(l.account_id, (perAkun.get(l.account_id) ?? 0) + Number(l.gmv));
  }

  return (data ?? []).map((a) => ({
    id: a.id,
    username: a.username,
    platform: a.platform,
    unitKode: (a.unit?.kode as KodeUnit) ?? null,
    unitNama: a.unit?.nama ?? "—",
    program: a.program?.nama ?? null,
    picId: a.pic?.id ?? null,
    picNama: a.pic?.nama ?? null,
    picInisial: a.pic?.nama ? inisialDari(a.pic.nama) : null,
    coLeaderId: a.co_leader?.id ?? null,
    coLeaderNama: a.co_leader?.nama ?? null,
    status: a.status as StatusAkun,
    gmvPeriode: perAkun.get(a.id) ?? 0,
  }));
}

/**
 * Staf yang boleh dijadikan PIC sebuah akun: staf aktif di unit akun itu.
 * Jumlah akun yang sudah dipegang ikut dibawa supaya pembagian beban
 * terlihat saat menunjuk PIC.
 */
export async function kandidatPic(unitKode: KodeUnit): Promise<KandidatPic[]> {
  if (modeData() === "demo") return kandidatDemo(unitKode);

  const sb = await klienServer();
  const { data, error } = await sb
    .from("users")
    .select("id, nama, jabatan, unit:units!inner (kode)")
    .eq("role", "Staff")
    .eq("status", "aktif")
    .eq("unit.kode", unitKode)
    .order("nama");

  if (error) throw new Error(`Gagal memuat calon PIC: ${error.message}`);

  const { data: akun } = await sb
    .from("accounts")
    .select("pic_user_id")
    .eq("status", "aktif");

  const beban = new Map<string, number>();
  for (const a of akun ?? []) {
    if (!a.pic_user_id) continue;
    beban.set(a.pic_user_id, (beban.get(a.pic_user_id) ?? 0) + 1);
  }

  return (data ?? []).map((u) => ({
    id: u.id,
    nama: u.nama,
    jabatan: u.jabatan,
    inisial: inisialDari(u.nama),
    jumlahAkun: beban.get(u.id) ?? 0,
  }));
}

/**
 * Pimpinan yang boleh dijadikan co-leader sebuah akun: Leader atau
 * Co-Leader aktif di unit akun itu — sejalan penjagaan database 0061.
 */
export async function kandidatCoLeader(
  unitKode: KodeUnit,
): Promise<KandidatPic[]> {
  if (modeData() === "demo") {
    const { users, accounts } = dataContoh;
    const beban = new Map<string, number>();
    for (const a of accounts) {
      if (!a.co_leader) continue;
      beban.set(a.co_leader, (beban.get(a.co_leader) ?? 0) + 1);
    }
    return users
      .filter(
        (u) =>
          (u.role === "Leader" || u.role === "Co-Leader") &&
          u.unit === unitKode &&
          aktifDemo(u),
      )
      .map((u) => ({
        id: u.id,
        nama: u.nama,
        jabatan: u.jabatan,
        inisial: u.inisial,
        jumlahAkun: beban.get(u.nama) ?? 0,
      }))
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("users")
    .select("id, nama, jabatan, unit:units!inner (kode)")
    .in("role", ["Leader", "Co-Leader"])
    .eq("status", "aktif")
    .eq("unit.kode", unitKode)
    .order("nama");

  if (error) throw new Error(`Gagal memuat calon co-leader: ${error.message}`);

  const { data: akun } = await sb
    .from("accounts")
    .select("co_leader_id")
    .eq("status", "aktif");

  const beban = new Map<string, number>();
  for (const a of akun ?? []) {
    if (!a.co_leader_id) continue;
    beban.set(a.co_leader_id, (beban.get(a.co_leader_id) ?? 0) + 1);
  }

  return (data ?? []).map((u) => ({
    id: u.id,
    nama: u.nama,
    jabatan: u.jabatan,
    inisial: inisialDari(u.nama),
    jumlahAkun: beban.get(u.id) ?? 0,
  }));
}

/** Program yang tersedia untuk sebuah unit (mis. Mabit Scholar di Affiliator). */
export async function programUnit(unitKode: KodeUnit) {
  if (modeData() === "demo") {
    return dataContoh.programs
      .filter((p) => p.unit === unitKode && p.aktif)
      .map((p) => ({ id: p.id, nama: p.nama }));
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("programs")
    .select("id, nama, unit:units!inner (kode)")
    .eq("aktif", true)
    .eq("unit.kode", unitKode)
    .order("nama");

  if (error) throw new Error(`Gagal memuat program: ${error.message}`);
  return (data ?? []).map((p) => ({ id: p.id, nama: p.nama }));
}

function inisialDari(nama: string) {
  const bagian = nama.trim().split(/\s+/);
  const depan = bagian[0]?.[0] ?? "";
  const belakang = bagian.length > 1 ? (bagian.at(-1)?.[0] ?? "") : "";
  return (depan + belakang).toUpperCase();
}

// ---------------------------------------------------------------------
// Mode demo — cakupan baca menirukan policy `accounts_baca`.
// ---------------------------------------------------------------------
function akunDemo(
  pengguna: Pengguna,
  bulan: string,
  sampai: string,
): AkunKelola[] {
  const { accounts, users, units, daily_reports } = dataContoh;

  const gmv = new Map<string, number>();
  for (const l of daily_reports) {
    if (!l.akun || l.tanggal < bulan || l.tanggal > sampai) continue;
    gmv.set(l.akun, (gmv.get(l.akun) ?? 0) + l.gmv);
  }

  return accounts
    .map((a) => {
      const pic = users.find((u) => u.nama === a.pic);
      const unit = units.find((u) => u.kode === a.unit);
      return {
        id: a.id,
        username: a.username,
        platform: "TikTok Shop",
        unitKode: (a.unit as KodeUnit) ?? null,
        unitNama: unit?.nama ?? "—",
        program: a.program ?? null,
        picId: pic?.id ?? null,
        picNama: a.pic ?? null,
        picInisial: a.pic ? inisialDari(a.pic) : null,
        coLeaderId:
          dataContoh.users.find((u) => u.nama === a.co_leader)?.id ?? null,
        coLeaderNama: a.co_leader ?? null,
        status: "aktif" as StatusAkun,
        gmvPeriode: gmv.get(a.username) ?? 0,
      };
    })
    .filter((a) => {
      if (
        pengguna.role === "CEO" ||
        pengguna.role === "Manager" ||
        pengguna.role === "Finance"
      ) {
        return true;
      }
      if (pengguna.role === "Leader" || pengguna.role === "Co-Leader") {
        // `unitId` pada Pengguna sudah berupa kode unit, bukan UUID.
        return a.unitKode === pengguna.unitId;
      }
      return a.picNama === pengguna.nama;
    })
    .sort((a, b) => a.username.localeCompare(b.username));
}

function kandidatDemo(unitKode: KodeUnit): KandidatPic[] {
  const { users, accounts } = dataContoh;
  const beban = new Map<string, number>();
  for (const a of accounts) {
    beban.set(a.pic, (beban.get(a.pic) ?? 0) + 1);
  }

  return users
    // Staf nonaktif tidak boleh muncul sebagai calon: menunjuknya akan
    // ditolak database (0038) dan akun itu berhenti tertagih laporan.
    .filter((u) => u.role === "Staff" && u.unit === unitKode && aktifDemo(u))
    .map((u) => ({
      id: u.id,
      nama: u.nama,
      jabatan: u.jabatan,
      inisial: u.inisial,
      jumlahAkun: beban.get(u.nama) ?? 0,
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama));
}
