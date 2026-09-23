/**
 * Membaca laporan harian ekspor V1 — modul murni.
 *
 * Formulir lama menyimpan jawaban memakai judul pertanyaannya, bukan
 * nama kolom, dan judul itu berubah dari waktu ke waktu. Jadi yang bisa
 * dipetakan ke kolom sendiri dipetakan, dan sisanya digabung ke catatan
 * — bukan dibuang, karena yang dibuang tidak pernah bisa dicari lagi.
 */

/** Medan laporan yang sudah punya kolom sendiri; sisanya jadi catatan. */
const MEDAN_LAPORAN_DIKENAL = new Set([
  "id",
  "userId",
  "createdAt",
  "Tanggal Laporan",
  "Akun",
  "Unit",
  "GMV",
  "Komisi",
  "Jumlah Upload",
]);

/**
 * Medan bebas yang tersisa digabung menjadi catatan.
 *
 * Formulir lama memakai judul pertanyaan sebagai nama medan, dan
 * pertanyaannya berubah dari waktu ke waktu. Memilih satu nama saja
 * berarti membuang jawaban yang pernah ditulis orang; digabung beserta
 * judulnya, semuanya tetap bisa dibaca.
 */
export function catatanLaporan(baris: Record<string, unknown>): string {
  const bagian: string[] = [];
  for (const [medan, nilai] of Object.entries(baris)) {
    if (MEDAN_LAPORAN_DIKENAL.has(medan)) continue;
    // Medan target hanya salinan target saat itu, bukan jawaban.
    if (medan.startsWith("Target ")) continue;
    if (nilai === null || nilai === undefined || nilai === "") continue;

    const teks =
      typeof nilai === "object" ? JSON.stringify(nilai) : String(nilai);
    bagian.push(
      medan === "Kendala" || medan === "Catatan" ? teks : `${medan}: ${teks}`,
    );
  }
  return bagian.join("\n").slice(0, 2000);
}
