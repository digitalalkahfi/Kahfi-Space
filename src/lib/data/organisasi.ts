// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import type { KodeUnit, PilihanOrganisasi } from "@/lib/types";

/**
 * Departemen, unit, dan program untuk pemilih di form anggota.
 *
 * Dibaca sekali lalu dipakai bersama: departemen bersifat organisatoris
 * (5 buah), unit bersifat pelaporan (3 buah), dan program menempel pada
 * satu unit — Mabit Scholar di Affiliator, MMC di MCN (PRD §1).
 */
export async function pilihanOrganisasi(): Promise<PilihanOrganisasi> {
  if (modeData() === "demo") {
    return {
      departemen: dataContoh.departments.map((d, i) => ({
        id: `contoh-dep-${i}`,
        nama: d.nama,
      })),
      unit: dataContoh.units.map((u) => ({
        kode: u.kode as KodeUnit,
        nama: u.nama.split(" (")[0],
      })),
      program: dataContoh.programs
        .filter((p) => p.aktif)
        .map((p) => ({
          id: p.id,
          nama: p.nama,
          unitKode: p.unit as KodeUnit,
        })),
      akun: dataContoh.accounts.map((a) => ({
        id: a.id,
        username: a.username,
        unitKode: a.unit as KodeUnit,
      })),
    };
  }

  const sb = await klienServer();
  const [dep, unit, prog, akun] = await Promise.all([
    sb.from("departments").select("id, nama").order("nama"),
    sb.from("units").select("kode, nama").order("nama"),
    sb
      .from("programs")
      .select("id, nama, unit:units (kode)")
      .eq("aktif", true)
      .order("nama"),
    sb
      .from("accounts")
      .select("id, username, unit:units (kode)")
      .eq("status", "aktif")
      .order("username"),
  ]);

  if (dep.error) throw new Error(`Gagal memuat departemen: ${dep.error.message}`);
  if (unit.error) throw new Error(`Gagal memuat unit: ${unit.error.message}`);
  if (prog.error) throw new Error(`Gagal memuat program: ${prog.error.message}`);

  return {
    departemen: (dep.data ?? []).map((d) => ({ id: d.id, nama: d.nama })),
    unit: (unit.data ?? []).map((u) => ({
      kode: u.kode as KodeUnit,
      nama: u.nama.split(" (")[0],
    })),
    program: (prog.data ?? []).map((p) => ({
      id: p.id,
      nama: p.nama,
      unitKode: (p.unit?.kode as KodeUnit) ?? null,
    })),
    akun: (akun.data ?? []).map((a) => ({
      id: a.id,
      username: a.username,
      unitKode: (a.unit?.kode as KodeUnit) ?? null,
    })),
  };
}
