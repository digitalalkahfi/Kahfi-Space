import "server-only";

/**
 * Konfigurasi gateway WhatsApp.
 *
 * Kredensialnya HANYA dibaca di server: tidak ada `NEXT_PUBLIC_` di
 * sini, dan modul ini `server-only` supaya mengimpornya dari komponen
 * klien gagal saat build, bukan diam-diam ikut ke bundel browser.
 * Token gateway yang bocor ke browser berarti siapa pun bisa mengirim
 * pesan atas nama perusahaan.
 *
 * Seperti Supabase, gateway punya dua mode: siap dan belum. Yang belum
 * tidak membuat apa pun gagal — notifikasi in-app tetap jalan, antrean
 * tetap terisi, dan pengirimannya menunggu sampai kredensialnya ada.
 */

export const WA_URL = process.env.WA_GATEWAY_URL ?? "";
export const WA_TOKEN = process.env.WA_GATEWAY_TOKEN ?? "";
export const WA_PENGIRIM = process.env.WA_GATEWAY_NOMOR ?? "";

export type ModeGateway = "siap" | "belum";

export function modeGateway(): ModeGateway {
  return WA_URL && WA_TOKEN ? "siap" : "belum";
}

export function gatewaySiap(): boolean {
  return modeGateway() === "siap";
}

/**
 * Kenapa gateway belum siap — kalimat untuk pengelola, bukan pengguna.
 *
 * Menyebut nama variabelnya dengan tepat: "konfigurasi belum lengkap"
 * mengirim orang mencari-cari, sementara yang dibutuhkan hanya satu
 * baris di berkas env.
 */
export function alasanBelumSiap(): string | null {
  const kurang: string[] = [];
  if (!WA_URL) kurang.push("WA_GATEWAY_URL");
  if (!WA_TOKEN) kurang.push("WA_GATEWAY_TOKEN");
  if (kurang.length === 0) return null;
  return `Gateway WhatsApp belum dikonfigurasi: ${kurang.join(" dan ")} belum diisi.`;
}

/**
 * Berapa lama menunggu gateway sebelum menyerah, dalam milidetik.
 *
 * Pendek dengan sengaja. Pengiriman ini berjalan di latar dan akan
 * dicoba lagi; menunggu lama pada satu pesan hanya menahan antrean di
 * belakangnya.
 */
export const BATAS_TUNGGU_MS = 10_000;

/** Header untuk memanggil gateway. Token tidak pernah ikut di URL. */
export function headerGateway(): HeadersInit {
  return {
    "content-type": "application/json",
    // Di header, bukan query string: URL mengendap di log proxy dan
    // riwayat, header tidak.
    authorization: `Bearer ${WA_TOKEN}`,
  };
}
