/**
 * Aturan pembacaan data contoh — modul murni, tanpa impor JSON maupun
 * modul server, sehingga bisa diuji langsung oleh test unit.
 */

/**
 * Status seorang pengguna di data contoh.
 *
 * Kolomnya hanya ditulis untuk yang nonaktif, jadi ketiadaannya berarti
 * aktif. Dipusatkan di sini supaya setiap daftar calon — PIC, co-leader,
 * pemilik goal, penerima tiket — menyaring dengan aturan yang sama seperti
 * `status = 'aktif'` pada query Supabase-nya.
 */
export function aktifDemo(pengguna: { status?: string }) {
  return (pengguna.status ?? "aktif") === "aktif";
}
