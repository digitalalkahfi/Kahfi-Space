import seed from "../../../supabase/seed/data.json";
import { aktifDemo } from "@/lib/demo";
import type { KodeUnit, Peran, Pengguna, Pengumuman } from "@/lib/types";

/**
 * Pembacaan data contoh untuk MODE DEMO.
 *
 * Sumbernya berkas JSON yang sama dengan yang menghasilkan `supabase/seed.sql`,
 * jadi apa yang tampil di mode demo persis sama dengan isi database setelah
 * di-seed. Begitu env Supabase terisi, modul ini tidak lagi dipakai.
 */
export const dataContoh = seed;

export const TANGGAL_ACUAN = seed.tanggalAcuan;

type UserContoh = (typeof seed.users)[number];

export function keUnitKode(unitId: string | null | undefined): KodeUnit | null {
  const unit = seed.units.find((u) => u.id === unitId);
  return (unit?.kode as KodeUnit) ?? null;
}

export function keUnitId(kode: KodeUnit): string {
  const unit = seed.units.find((u) => u.kode === kode);
  if (!unit) throw new Error(`Unit tidak dikenal: ${kode}`);
  return unit.id;
}

export function kePengguna(u: UserContoh): Pengguna {
  return {
    id: u.id,
    nama: u.nama,
    email: u.email,
    role: u.role as Peran,
    jabatan: u.jabatan,
    unitId: u.unit ? (u.unit as KodeUnit) : null,
    fotoUrl: null,
    inisial: u.inisial,
  };
}

export function penggunaContoh(): Pengguna[] {
  // Sejalan `daftarAnggota()` di mode Supabase yang menyaring status
  // 'aktif': orang nonaktif tidak boleh muncul sebagai calon penerima
  // tiket, pemilik goal, atau PIC.
  return seed.users.filter(aktifDemo).map(kePengguna);
}

/** Persona pertama untuk tiap peran — dipakai pratinjau peran di mode demo. */
export function personaContoh(peran: Peran): Pengguna {
  const cocok = seed.users.find((u) => u.role === peran && aktifDemo(u));
  if (!cocok) throw new Error(`Tidak ada persona contoh untuk peran ${peran}`);
  return kePengguna(cocok);
}

export function pengumumanContoh(): Pengumuman[] {
  return seed.announcements.map((a) => {
    const pembuat = seed.users.find((u) => u.nama === a.dibuat_oleh);
    const unit = a.target_unit
      ? seed.units.find((u) => u.kode === a.target_unit)
      : null;
    return {
      id: a.id,
      judul: a.judul,
      ringkasan: a.ringkasan,
      isi: a.isi,
      targetPeran: (a.target_role as Peran | null) ?? "Semua",
      targetUnit: unit?.nama.split(" (")[0] ?? null,
      dibuatOleh: a.dibuat_oleh,
      jabatanPembuat: pembuat?.jabatan ?? "",
      publishedAt: a.published_at,
      disematkan: a.disematkan,
    };
  });
}
