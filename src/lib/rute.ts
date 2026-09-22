/**
 * Pembantu rute yang murni — tanpa impor server maupun klien.
 */

/**
 * Menyaring tujuan pengalihan setelah masuk.
 *
 * Parameter `lanjut` berasal dari URL, jadi bisa diisi siapa saja. Tanpa
 * penyaringan, tautan seperti `/masuk?lanjut=https://situs-palsu` akan
 * melempar pengguna ke luar tepat setelah ia memasukkan kata sandi —
 * pola klasik pencurian kredensial. Hanya jalur internal yang diterima.
 */
export function jalurAman(lanjut: string | null | undefined): string {
  if (!lanjut) return "/beranda";
  // `//host` dan `/\host` dibaca peramban sebagai alamat protokol-relatif.
  if (!lanjut.startsWith("/")) return "/beranda";
  if (lanjut.startsWith("//") || lanjut.startsWith("/\\")) return "/beranda";
  return lanjut;
}
