// Modul khusus server.
import "server-only";

import { dataContoh } from "@/lib/data/contoh";
import { modeData } from "@/lib/supabase/config";
import type { AlokasiAnggaran, Anggaran, StatusAlokasi } from "@/lib/budget";
import type { JenisKeluar } from "@/lib/keuangan";
import type { KodeUnit, Pengguna } from "@/lib/types";

/**
 * Daftar anggaran.
 *
 * SEMENTARA: tabelnya menyusul di lapisan backend Fase 3. Sampai itu
 * angkanya dibaca dari data contoh — realisasinya sendiri sudah nyata,
 * dihitung dari transaksi yang tersimpan, jadi yang tiruan hanya
 * pagunya.
 */
export async function daftarAnggaran(pengguna: Pengguna): Promise<Anggaran[]> {
  void pengguna;
  void modeData();

  const { units } = dataContoh;

  return (dataContoh.anggaran ?? [])
    .map((a) => {
      const unit = a.unit ? units.find((u) => u.kode === a.unit) : null;
      return {
        id: a.id,
        periode: a.periode,
        unitKode: (a.unit as KodeUnit) ?? null,
        unitNama: unit?.nama ? unit.nama.split(" (")[0] : "Perusahaan",
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
 * Pengajuan alokasi tambahan.
 *
 * SEMENTARA: seperti pagunya, tabelnya menyusul di lapisan backend
 * Fase 3.
 */
export async function daftarAlokasi(
  pengguna: Pengguna,
): Promise<AlokasiAnggaran[]> {
  void pengguna;
  const { units } = dataContoh;

  return (dataContoh.alokasi_anggaran ?? [])
    .map((a) => {
      const unit = a.unit ? units.find((u) => u.kode === a.unit) : null;
      return {
        id: a.id,
        periode: a.periode,
        unitKode: (a.unit as KodeUnit) ?? null,
        unitNama: unit?.nama ? unit.nama.split(" (")[0] : "Perusahaan",
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
