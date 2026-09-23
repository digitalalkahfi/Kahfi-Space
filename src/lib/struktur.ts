/**
 * Pohon struktur organisasi — modul murni.
 *
 * `petaRantai` menjawab "siapa atasan saya"; berkas ini menjawab
 * pertanyaan sebaliknya, "siapa saja di bawah orang ini", dalam bentuk
 * yang bisa digambar bertingkat. Keduanya diturunkan dari kolom yang
 * sama (`atasanId`), jadi tidak ada susunan kedua yang bisa melenceng.
 */
import type { AnggotaTim, Peran } from "@/lib/types";

/** Satu orang beserta bawahan langsungnya, siap digambar bertingkat. */
export type SimpulStruktur = {
  id: string;
  nama: string;
  jabatan: string;
  role: Peran;
  unitKode: string | null;
  departemen: string | null;
  /** Kedalaman dari puncak; 0 untuk yang tidak punya atasan. */
  tingkat: number;
  /** Seluruh orang di bawahnya, langsung maupun tidak. */
  jumlahBawahan: number;
  bawahan: SimpulStruktur[];
};

/**
 * Pohon pelaporan dari anggota aktif.
 *
 * Yang tidak punya atasan menjadi akar. Orang yang atasannya sudah
 * nonaktif juga menjadi akar — bukan disembunyikan: justru itu keadaan
 * yang perlu terlihat, karena garis pelaporannya menggantung.
 *
 * Kedalaman dibatasi supaya data yang terlanjur berputar tidak membuat
 * halaman menggantung. Database menolak siklus (migrasi 0044), tapi
 * tampilan tidak boleh bergantung pada itu.
 */
export function pohonStruktur(
  anggota: readonly AnggotaTim[],
  batasTingkat = 20,
): SimpulStruktur[] {
  const aktif = anggota.filter((a) => a.status === "aktif");
  const ada = new Set(aktif.map((a) => a.id));

  const anak = new Map<string, AnggotaTim[]>();
  const akar: AnggotaTim[] = [];
  for (const a of aktif) {
    const punyaAtasan = a.atasanId !== null && ada.has(a.atasanId);
    if (!punyaAtasan) {
      akar.push(a);
      continue;
    }
    anak.set(a.atasanId as string, [
      ...(anak.get(a.atasanId as string) ?? []),
      a,
    ]);
  }

  const urut = (daftar: AnggotaTim[]) =>
    [...daftar].sort((x, y) => x.nama.localeCompare(y.nama));

  const bangun = (
    a: AnggotaTim,
    tingkat: number,
    dilewati: Set<string>,
  ): SimpulStruktur => {
    const anaknya =
      tingkat >= batasTingkat
        ? []
        : urut(anak.get(a.id) ?? [])
            .filter((b) => !dilewati.has(b.id))
            .map((b) =>
              bangun(b, tingkat + 1, new Set([...dilewati, a.id, b.id])),
            );

    return {
      id: a.id,
      nama: a.nama,
      jabatan: a.jabatan,
      role: a.role,
      unitKode: a.unitKode,
      departemen: a.departemen,
      tingkat,
      jumlahBawahan: anaknya.reduce((n, b) => n + 1 + b.jumlahBawahan, 0),
      bawahan: anaknya,
    };
  };

  return urut(akar).map((a) => bangun(a, 0, new Set([a.id])));
}

/** Pohon diratakan jadi satu deret, urut seperti yang terlihat di layar. */
export function ratakanStruktur(
  pohon: readonly SimpulStruktur[],
): SimpulStruktur[] {
  return pohon.flatMap((s) => [s, ...ratakanStruktur(s.bawahan)]);
}

/**
 * Anggota aktif yang tidak masuk pohon mana pun.
 *
 * Seharusnya tidak pernah ada — tiap orang punya atasan atau menjadi
 * akar. Kalau muncul, itu tanda datanya berputar, dan menyembunyikannya
 * berarti menyembunyikan satu orang dari susunan organisasi.
 */
export function tercecer(
  anggota: readonly AnggotaTim[],
  pohon: readonly SimpulStruktur[],
): AnggotaTim[] {
  const terlihat = new Set(ratakanStruktur(pohon).map((s) => s.id));
  return anggota.filter((a) => a.status === "aktif" && !terlihat.has(a.id));
}
