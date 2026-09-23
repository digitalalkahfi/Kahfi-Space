/**
 * Ringkasan struktur organisasi — modul murni.
 *
 * Departemen, unit, dan program selama ini hanya muncul sebagai pilihan
 * saringan: ada di sistem, tapi tidak pernah bisa dilihat sebagai satu
 * susunan. Bagi anggota baru — dan bagi siapa pun yang harus tahu siapa
 * atasan siapa — susunan itu justru yang dicari lebih dulu.
 */
import type { AnggotaTim, PilihanOrganisasi } from "@/lib/types";

export type BarisDepartemen = {
  nama: string;
  /** Unit pelaporan yang menaungi anggotanya. */
  unit: string[];
  program: string[];
  jumlahAktif: number;
  /** Peran tertinggi di departemen ini, mis. "Dewi Lestari (Leader)". */
  penanggungJawab: string | null;
};

/** Urutan peran dari yang paling tinggi; dipakai memilih penanggung jawab. */
const URUTAN_PERAN = [
  "CEO",
  "Manager",
  "Leader",
  "Co-Leader",
  "Finance",
  "Staff",
] as const;

/**
 * Susunan departemen beserta unit, program, dan jumlah anggota aktifnya.
 *
 * Departemen tanpa anggota tetap ditampilkan: departemen yang baru
 * dibentuk atau yang sedang kosong adalah informasi, bukan kekosongan
 * yang pantas disembunyikan.
 */
export function susunanDepartemen(
  anggota: AnggotaTim[],
  pilihan: Pick<PilihanOrganisasi, "departemen" | "program" | "unit">,
): BarisDepartemen[] {
  const aktif = anggota.filter((a) => a.status === "aktif");
  const namaUnit = new Map(pilihan.unit.map((u) => [u.kode, u.nama]));

  return pilihan.departemen
    .map((d) => {
      const isi = aktif.filter((a) => a.departemen === d.nama);
      const unit = [
        ...new Set(
          isi
            .map((a) => (a.unitKode ? namaUnit.get(a.unitKode) : null))
            .filter((u): u is string => Boolean(u)),
        ),
      ].sort();

      // Program dicocokkan lewat unit departemennya, bukan lewat anggota:
      // program yang belum punya peserta tetap bagian dari susunannya.
      const kodeUnit = new Set(isi.map((a) => a.unitKode));
      const program = [
        ...new Set(
          pilihan.program
            .filter((p) => p.unitKode && kodeUnit.has(p.unitKode))
            .map((p) => p.nama),
        ),
      ].sort();

      const teratas = [...isi].sort(
        (a, b) =>
          URUTAN_PERAN.indexOf(a.role as (typeof URUTAN_PERAN)[number]) -
          URUTAN_PERAN.indexOf(b.role as (typeof URUTAN_PERAN)[number]),
      )[0];

      return {
        nama: d.nama,
        unit,
        program,
        jumlahAktif: isi.length,
        penanggungJawab: teratas ? `${teratas.nama} (${teratas.role})` : null,
      } satisfies BarisDepartemen;
    })
    .sort(
      (a, b) => b.jumlahAktif - a.jumlahAktif || a.nama.localeCompare(b.nama),
    );
}
