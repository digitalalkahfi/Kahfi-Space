/**
 * Perhitungan geografis murni — tanpa impor server maupun klien, supaya
 * aman dipakai dari Server Component sekaligus komponen browser.
 */

/** Titik & radius kantor; nilai bawaan sama dengan tabel `pengaturan`. */
export const KANTOR = {
  lat: Number(process.env.NEXT_PUBLIC_KANTOR_LAT ?? -6.2607),
  lng: Number(process.env.NEXT_PUBLIC_KANTOR_LNG ?? 106.8106),
  radius: Number(process.env.NEXT_PUBLIC_KANTOR_RADIUS_M ?? 150),
};

/** Haversine dalam meter — padanan fungsi `jarak_meter` di database. */
export function jarakMeter(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) *
      Math.cos(rad(lat2)) *
      Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.asin(Math.sqrt(a)) * 10) / 10;
}

/** Jarak sebuah titik dari kantor; null bila koordinatnya tidak lengkap. */
export function jarakDariKantor(titik: { lat?: number; lng?: number }) {
  if (typeof titik.lat !== "number" || typeof titik.lng !== "number") {
    return null;
  }
  return jarakMeter(KANTOR.lat, KANTOR.lng, titik.lat, titik.lng);
}
