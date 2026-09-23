/**
 * Membaca laporan harian ekspor V1 — modul murni.
 *
 * Formulir lama menyimpan jawaban memakai judul pertanyaannya, bukan
 * nama kolom, dan judul itu berubah dari waktu ke waktu. Jadi yang bisa
 * dipetakan ke kolom sendiri dipetakan, dan sisanya digabung ke catatan
 * — bukan dibuang, karena yang dibuang tidak pernah bisa dicari lagi.
 */

/**
 * Medan laporan yang sudah punya kolom sendiri atau hanya keterangan
 * sistem lama; sisanya jadi catatan.
 */
const MEDAN_LAPORAN_DIKENAL = new Set([
  "id",
  "userId",
  "createdAt",
  "Akun",
  "Unit",
  "GMV",
  "Komisi",
  "Jumlah Upload",
  // Ekspor K-Space lama yang sebenarnya: penanda dan salinan nama yang
  // sudah diwakili kolom V2 atau tidak berarti di sana.
  "date",
  "authorId",
  "authorName",
  "authorRole",
  "authorJobTitle",
  "submittedAt",
  "updatedAt",
  "templateId",
  "templateName",
  "attachments",
  "pinToDashboard",
  "fieldsSnapshot",
]);

/**
 * Medan bebas yang tersisa digabung menjadi catatan.
 *
 * Formulir lama memakai judul pertanyaan sebagai nama medan, dan
 * pertanyaannya berubah dari waktu ke waktu. Memilih satu nama saja
 * berarti membuang jawaban yang pernah ditulis orang; digabung beserta
 * judulnya, semuanya tetap bisa dibaca.
 *
 * `dipakai` menyebut medan yang sudah diambil ke kolom sendiri (mis.
 * judul pertanyaan GMV), supaya angkanya tidak ditulis dua kali. Tanpa
 * itu, yang dianggap sudah terpakai adalah medan inti bentuk contoh.
 */
const MEDAN_INTI_CONTOH: ReadonlySet<string> = new Set(["Tanggal Laporan"]);

export function catatanLaporan(
  baris: Record<string, unknown>,
  dipakai: ReadonlySet<string> = MEDAN_INTI_CONTOH,
): string {
  const bagian: string[] = [];
  for (const [medan, nilai] of Object.entries(baris)) {
    if (MEDAN_LAPORAN_DIKENAL.has(medan) || dipakai.has(medan)) continue;
    // Medan target hanya salinan target saat itu, bukan jawaban.
    if (/^target\b/i.test(medan)) continue;
    if (nilai === null || nilai === undefined || nilai === "") continue;

    const teks =
      typeof nilai === "object" ? JSON.stringify(nilai) : String(nilai);
    bagian.push(
      medan === "Kendala" || medan === "Catatan" ? teks : `${medan}: ${teks}`,
    );
  }
  return bagian.join("\n").slice(0, 2000);
}

/**
 * Meratakan laporan yang menyimpan jawabannya di `fieldsSnapshot`.
 *
 * Ekspor K-Space lama yang sebenarnya tidak menaruh jawaban sebagai medan
 * — ia menyimpan larik `{ id, type, label, value }` per pertanyaan.
 * Diratakan menjadi medan berjudul labelnya supaya seluruh pembacaan di
 * bawah ini (dan `catatanLaporan`) memperlakukan keduanya sama.
 */
export function ratakanLaporan(
  baris: Record<string, unknown>,
): Record<string, unknown> {
  const jawaban = baris.fieldsSnapshot;
  if (!Array.isArray(jawaban)) return baris;

  const datar: Record<string, unknown> = {};
  for (const [medan, nilai] of Object.entries(baris)) {
    if (medan !== "fieldsSnapshot") datar[medan] = nilai;
  }
  for (const j of jawaban) {
    if (j === null || typeof j !== "object") continue;
    const o = j as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (label === "" || !("value" in o) || label in datar) continue;
    datar[label] = o.value;
  }
  return datar;
}

/** Nilai medan pertama yang judulnya cocok dengan salah satu pola. */
function cariMedan(
  datar: Record<string, unknown>,
  pola: readonly (string | RegExp)[],
  dipakai: Set<string>,
): unknown {
  for (const p of pola) {
    for (const medan of Object.keys(datar)) {
      const cocok = typeof p === "string" ? medan === p : p.test(medan);
      if (!cocok) continue;
      const nilai = datar[medan];
      if (nilai === undefined || nilai === null || nilai === "") continue;
      dipakai.add(medan);
      return nilai;
    }
  }
  return undefined;
}

export type MedanLaporan = {
  tanggal: unknown;
  user: unknown;
  akun: unknown;
  unit: unknown;
  gmv: unknown;
  komisi: unknown;
  upload: unknown;
  dikirim: unknown;
  /** Medan yang sudah diambil; tidak diulang di catatan. */
  dipakai: Set<string>;
};

/**
 * Menemukan medan-medan inti sebuah laporan, apa pun ejaan formulirnya.
 *
 * Contoh ekspor menulis "GMV"; formulir sungguhan menulis "Tercapai GMV
 * Berapa? (Kemarin)" atau "GMV Hari Ini (Rp)". Yang dicari adalah
 * jawabannya, bukan judul pertanyaan tertentu — dan judul yang berawalan
 * "Target" sengaja tidak dihitung sebagai jawaban.
 */
export function medanLaporan(datar: Record<string, unknown>): MedanLaporan {
  const dipakai = new Set<string>();
  const bukanTarget = (pola: RegExp) =>
    new RegExp(`^(?!target\\b)(?=.*${pola.source})`, "i");

  return {
    // `date` adalah tanggal laporan menurut sistem lama sendiri; medan
    // "Tanggal Laporan" diisi orang dan sering menunjuk hari sebelumnya.
    tanggal: cariMedan(datar, ["date", "Tanggal Laporan"], dipakai),
    user: cariMedan(datar, ["userId", "authorId"], dipakai),
    akun: cariMedan(datar, ["Akun", "Nama Akun"], dipakai),
    unit: cariMedan(datar, ["Unit"], dipakai),
    gmv: cariMedan(datar, ["GMV", bukanTarget(/\bgmv\b/)], dipakai),
    komisi: cariMedan(datar, ["Komisi", bukanTarget(/komisi/)], dipakai),
    upload: cariMedan(
      datar,
      [
        "Jumlah Upload",
        bukanTarget(/realisasi jumlah upload vt/),
        bukanTarget(/^jumlah konten/),
        bukanTarget(/realisasi upload/),
      ],
      dipakai,
    ),
    dikirim: cariMedan(datar, ["createdAt", "submittedAt"], dipakai),
    dipakai,
  };
}

/**
 * Nama akun disamakan bentuknya: huruf kecil, tanpa '@' di depan, tanpa
 * garis bawah atau titik di ujung.
 *
 * Formulir lama menulis "naimanurr" untuk akun yang terdaftar sebagai
 * "naimanurr_"; keduanya jelas akun yang sama bagi siapa pun yang
 * membacanya, dan memperlakukannya berbeda menahan ratusan laporan.
 */
export function bakuAkun(nilai: unknown): string | null {
  if (typeof nilai !== "string") return null;
  const teks = nilai
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[._]+$/, "");
  return teks === "" ? null : teks;
}
