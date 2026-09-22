/**
 * Aturan garis pelaporan — modul murni, dipakai server maupun browser.
 */
import { peringkatPeran } from "@/lib/peran";
import type { AnggotaTim, MataRantai } from "@/lib/types";

export type Peringatan = {
  nada: "hati-hati" | "salah";
  pesan: string;
};

/**
 * Peringatan atas sebuah penetapan atasan.
 *
 * Sebagian besar hal di sini tidak dilarang — organisasi kecil memang
 * kadang melapor lintas unit. Yang penting orangnya tahu sebelum
 * menyimpan, karena atasan menentukan siapa boleh menugasi dan
 * menyetujui izin.
 */
export function peringatanAtasan(
  anggota: Pick<AnggotaTim, "id" | "role" | "unitNama" | "nama">,
  calon: Pick<AnggotaTim, "id" | "role" | "unitNama" | "nama"> | null,
): Peringatan[] {
  if (!calon) {
    return [
      {
        nada: "hati-hati",
        pesan:
          "Tanpa atasan, tidak ada yang berwenang menyetujui izin atau menugasi orang ini di luar unitnya.",
      },
    ];
  }

  const hasil: Peringatan[] = [];

  if (calon.id === anggota.id) {
    hasil.push({
      nada: "salah",
      pesan: "Seseorang tidak bisa menjadi atasan dirinya sendiri.",
    });
    return hasil;
  }

  if (peringkatPeran(calon.role) > peringkatPeran(anggota.role)) {
    hasil.push({
      nada: "salah",
      pesan: `${calon.nama} berperan ${calon.role}, lebih sempit daripada ${anggota.role}. Garis pelaporannya terbalik.`,
    });
  } else if (peringkatPeran(calon.role) === peringkatPeran(anggota.role)) {
    hasil.push({
      nada: "hati-hati",
      pesan: `Keduanya sama-sama ${calon.role}. Pastikan ini memang yang dimaksud.`,
    });
  }

  if (
    anggota.unitNama !== "Manajemen" &&
    calon.unitNama !== "Manajemen" &&
    calon.unitNama !== anggota.unitNama
  ) {
    hasil.push({
      nada: "hati-hati",
      pesan: `${calon.nama} memimpin ${calon.unitNama}, sedangkan ${anggota.nama} di ${anggota.unitNama}. Pelaporan lintas unit tetap boleh, tapi jarang.`,
    });
  }

  return hasil;
}

/** Calon atasan yang masuk akal: aktif, bukan dirinya, dan bukan bawahannya. */
export function calonAtasan(
  semua: AnggotaTim[],
  anggota: AnggotaTim,
  idBawahan: Set<string>,
): AnggotaTim[] {
  return semua
    .filter(
      (a) =>
        a.status === "aktif" && a.id !== anggota.id && !idBawahan.has(a.id),
    )
    .sort(
      (a, b) =>
        peringkatPeran(a.role) - peringkatPeran(b.role) || a.nama.localeCompare(b.nama),
    );
}

/**
 * Garis pelaporan tiap orang, diturunkan dari daftar yang sudah dimuat.
 *
 * Dihitung sekali di memori alih-alih satu query per orang. Penelusuran
 * dibatasi agar data yang terlanjur berputar tidak menggantung halaman —
 * database menolak siklus (migrasi 0044), tapi tampilan tidak boleh
 * bergantung pada itu.
 */
export function petaRantai(semua: AnggotaTim[]): Record<string, MataRantai[]> {
  const perId = new Map(semua.map((a) => [a.id, a]));
  const hasil: Record<string, MataRantai[]> = {};

  for (const a of semua) {
    const rantai: MataRantai[] = [];
    const dilewati = new Set<string>([a.id]);
    let kini = a.atasanId ? perId.get(a.atasanId) : undefined;
    let tingkat = 1;

    while (kini && !dilewati.has(kini.id) && tingkat <= 20) {
      rantai.push({
        tingkat,
        userId: kini.id,
        nama: kini.nama,
        jabatan: kini.jabatan,
        role: kini.role,
      });
      dilewati.add(kini.id);
      kini = kini.atasanId ? perId.get(kini.atasanId) : undefined;
      tingkat += 1;
    }

    hasil[a.id] = rantai;
  }

  return hasil;
}

/** Seluruh bawahan tiap orang, langsung maupun lewat bawahannya. */
export function petaBawahan(semua: AnggotaTim[]): Record<string, string[]> {
  const rantai = petaRantai(semua);
  const hasil: Record<string, string[]> = Object.fromEntries(
    semua.map((a) => [a.id, [] as string[]]),
  );

  for (const a of semua) {
    for (const m of rantai[a.id] ?? []) {
      hasil[m.userId]?.push(a.id);
    }
  }

  return hasil;
}
