/**
 * Aturan murni pendaftaran akun & gerbang anggota aktif.
 *
 * Tanpa impor server maupun klien, supaya middleware, server action, dan
 * komponen form memakai aturan yang sama. Rancangannya:
 * docs/DAFTAR-GOOGLE-PERSETUJUAN.md.
 */
import type { StatusAkses } from "@/lib/supabase/types";

/** Layar tunggu untuk akun yang belum/tidak aktif. */
export const JALUR_MENUNGGU = "/menunggu";

/**
 * Jalur yang tetap terbuka bagi akun yang belum aktif.
 *
 * `/api` tidak dialihkan: tanggapannya JSON, dan datanya sudah dijaga
 * RLS (0208) — akun yang tidak aktif hanya menerima hasil kosong.
 */
const TERBUKA_SAAT_TIDAK_AKTIF = [JALUR_MENUNGGU, "/auth", "/api"];

/**
 * Ke mana permintaan dialihkan berdasarkan status akses akun yang login.
 * `null` artinya dibiarkan lewat.
 */
export function alihkanMenurutStatus(
  status: StatusAkses | null,
  path: string,
): string | null {
  const di = (j: string) => path === j || path.startsWith(`${j}/`);

  if (status === "aktif") {
    if (di(JALUR_MENUNGGU) || path === "/masuk") return "/beranda";
    return null;
  }

  // Status kosong diperlakukan seperti belum aktif. (Galat RPC ditangani
  // middleware sendiri — lihat `segarkanSesi`.)
  if (TERBUKA_SAAT_TIDAK_AKTIF.some(di)) return null;
  return JALUR_MENUNGGU;
}

// ---------------------------------------------------------------------
// Isian calon anggota di /menunggu
// ---------------------------------------------------------------------

export const CATATAN_DAFTAR_MAKS = 500;

/**
 * Nomor WhatsApp dirapikan ke bentuk 62xxxxxxxxxx.
 * Menerima "0812…", "+62 812-…", "62812…". `null` bila tidak sah.
 */
export function rapikanNoWa(masukan: string): string | null {
  let angka = masukan.replace(/[\s\-().]/g, "");
  if (angka.startsWith("+")) angka = angka.slice(1);
  if (!/^\d+$/.test(angka)) return null;
  if (angka.startsWith("0")) angka = `62${angka.slice(1)}`;
  else if (angka.startsWith("8")) angka = `62${angka}`;
  if (!angka.startsWith("62")) return null;
  // 62 + 8–13 digit nomor seluler Indonesia.
  if (angka.length < 10 || angka.length > 15) return null;
  if (angka[2] !== "8") return null;
  return angka;
}

// ---------------------------------------------------------------------
// Keputusan approver
// ---------------------------------------------------------------------

export const ALASAN_TOLAK_MIN = 5;

/** BR-07: menolak wajib beralasan, minimal 5 huruf. */
export function periksaAlasanTolak(alasan: string): string | null {
  const bersih = alasan.trim();
  if (!bersih) return "Isi alasan penolakan.";
  if (bersih.replace(/[^\p{L}]/gu, "").length < ALASAN_TOLAK_MIN) {
    return `Alasan penolakan minimal ${ALASAN_TOLAK_MIN} huruf.`;
  }
  return null;
}

/**
 * Pilihan divisi di form pendaftaran. Ditulis tetap di sini karena calon
 * anggota belum boleh membaca tabel `units` (gerbang 0208).
 */
export const PILIHAN_UNIT_DAFTAR = [
  { kode: "affiliator", nama: "Affiliator" },
  { kode: "mcn", nama: "MCN (termasuk MMC)" },
  { kode: "tap", nama: "TAP" },
] as const;

export function namaUnitDaftar(kode: string | null): string | null {
  return PILIHAN_UNIT_DAFTAR.find((u) => u.kode === kode)?.nama ?? null;
}

// ---------------------------------------------------------------------
// Login & sambungkan Google
// ---------------------------------------------------------------------

/**
 * Ke mana galat dari Google ditampilkan: alur "Sambungkan Google"
 * kembali ke profil, sisanya ke halaman masuk.
 */
export function tujuanGalatGoogle(lanjut: string): string {
  return lanjut === "/profil" || lanjut.startsWith("/profil?")
    ? "/profil"
    : "/masuk";
}

/** Pesan galat Google/Supabase → kalimat untuk pengguna. */
export function pesanGalatGoogle(mentah: string): string {
  if (/already linked|identity_already_exists/i.test(mentah)) {
    return "Akun Google itu sudah tersambung ke akun K-Space lain. Pilih Gmail yang lain atau hubungi Manager.";
  }
  if (/manual linking|linking.*disabled/i.test(mentah)) {
    return "Menyambungkan Google belum diaktifkan. Hubungi Manager.";
  }
  if (/provider.*(not enabled|disabled)|unsupported provider/i.test(mentah)) {
    return "Masuk dengan Google belum diaktifkan. Pakai email dan kata sandi.";
  }
  if (/access_denied|cancel/i.test(mentah)) {
    return "Masuk dengan Google dibatalkan.";
  }
  return `Masuk dengan Google gagal: ${mentah}`;
}
