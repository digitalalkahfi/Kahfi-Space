// Modul khusus server.
import "server-only";

import { dataContoh } from "@/lib/data/contoh";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import type { AlokasiAnggaran, Anggaran, StatusAlokasi } from "@/lib/budget";
import type { JenisKeluar } from "@/lib/keuangan";
import type { KodeUnit, Pengguna } from "@/lib/types";

/** Nama unit tanpa keterangan dalam kurung; null berarti perusahaan. */
function namaUnit(nama: string | null | undefined) {
  return nama ? nama.split(" (")[0] : "Perusahaan";
}

/**
 * Daftar pagu anggaran.
 *
 * Mode Supabase membaca tabel `budgets` (migrasi 0148); RLS yang
 * menentukan siapa melihat apa. Mode demo tetap dari seed.
 */
export async function daftarAnggaran(pengguna: Pengguna): Promise<Anggaran[]> {
  if (modeData() === "demo") return anggaranDemo();

  void pengguna;
  const sb = await klienServer();
  const { data, error } = await sb
    .from("budgets")
    .select(
      `id, periode, unit_id, jenis, jumlah, catatan,
       unit:units (kode, nama),
       disetujui:users!budgets_disetujui_id_fkey (nama)`,
    )
    .order("periode", { ascending: false });

  if (error) throw new Error(`Gagal memuat anggaran: ${error.message}`);

  return (data ?? [])
    .map((a) => ({
      id: a.id,
      periode: a.periode,
      unitKode: (a.unit?.kode as KodeUnit) ?? null,
      unitNama: namaUnit(a.unit?.nama),
      jenis: a.jenis as JenisKeluar,
      jumlah: Number(a.jumlah),
      catatan: a.catatan,
      disetujuiNama: a.disetujui?.nama ?? null,
    }))
    .sort(
      (x, y) =>
        y.periode.localeCompare(x.periode) ||
        x.unitNama.localeCompare(y.unitNama),
    );
}

/** Padanan `budgets` untuk mode demo, dari seed. */
function anggaranDemo(): Anggaran[] {
  const { units } = dataContoh;

  return (dataContoh.anggaran ?? [])
    .map((a) => {
      const unit = a.unit ? units.find((u) => u.kode === a.unit) : null;
      return {
        id: a.id,
        periode: a.periode,
        unitKode: (a.unit as KodeUnit) ?? null,
        unitNama: namaUnit(unit?.nama),
        jenis: a.jenis as JenisKeluar,
        jumlah: a.jumlah,
        catatan: a.catatan,
        disetujuiNama: a.disetujui ?? null,
      } satisfies Anggaran;
    })
    .sort(
      (x, y) =>
        y.periode.localeCompare(x.periode) ||
        x.unitNama.localeCompare(y.unitNama),
    );
}

/**
 * Pengajuan alokasi tambahan beserta keputusannya.
 *
 * Mode Supabase membaca `budget_allocations` (migrasi 0148). Pimpinan
 * unit ikut melihat pengajuan supaya tahu miliknya sudah diputuskan
 * atau belum — itu diatur RLS, bukan di sini.
 */
export async function daftarAlokasi(
  pengguna: Pengguna,
): Promise<AlokasiAnggaran[]> {
  if (modeData() === "demo") return alokasiDemo();

  void pengguna;
  const sb = await klienServer();
  const { data, error } = await sb
    .from("budget_allocations")
    .select(
      `id, periode, unit_id, jenis, jumlah, alasan, status,
       catatan_keputusan, created_at,
       unit:units (kode, nama),
       diajukan:users!budget_allocations_diajukan_id_fkey (nama),
       diputuskan:users!budget_allocations_diputuskan_id_fkey (nama)`,
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Gagal memuat alokasi: ${error.message}`);

  return (data ?? []).map((a) => ({
    id: a.id,
    periode: a.periode,
    unitKode: (a.unit?.kode as KodeUnit) ?? null,
    unitNama: namaUnit(a.unit?.nama),
    jenis: a.jenis as JenisKeluar,
    jumlah: Number(a.jumlah),
    alasan: a.alasan,
    status: a.status as StatusAlokasi,
    diajukanNama: a.diajukan?.nama ?? null,
    diputuskanNama: a.diputuskan?.nama ?? null,
    catatanKeputusan: a.catatan_keputusan,
    pada: a.created_at,
  }));
}

/** Padanan `budget_allocations` untuk mode demo, dari seed. */
function alokasiDemo(): AlokasiAnggaran[] {
  const { units } = dataContoh;

  return (dataContoh.alokasi_anggaran ?? [])
    .map((a) => {
      const unit = a.unit ? units.find((u) => u.kode === a.unit) : null;
      return {
        id: a.id,
        periode: a.periode,
        unitKode: (a.unit as KodeUnit) ?? null,
        unitNama: namaUnit(unit?.nama),
        jenis: a.jenis as JenisKeluar,
        jumlah: a.jumlah,
        alasan: a.alasan,
        status: a.status as StatusAlokasi,
        diajukanNama: a.diajukan ?? null,
        diputuskanNama: a.diputuskan ?? null,
        catatanKeputusan: a.catatan_keputusan ?? "",
        pada: a.pada,
      } satisfies AlokasiAnggaran;
    })
    .sort((x, y) => y.pada.localeCompare(x.pada));
}

/** Id unit dari kode unitnya; null berarti pagu perusahaan. */
export async function idUnitDariKode(
  kode: KodeUnit | null,
): Promise<string | null> {
  if (kode === null) return null;

  const sb = await klienServer();
  const { data, error } = await sb
    .from("units")
    .select("id")
    .eq("kode", kode)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat unit: ${error.message}`);
  return data?.id ?? null;
}
