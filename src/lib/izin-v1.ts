/**
 * Menyamakan sebutan kehadiran dan izin sistem lama — modul murni.
 *
 * Statusnya ditulis bermacam-macam di V1 ("late", "terlambat", "sick"),
 * dan izin beberapa hari disimpan sebagai satu baris berisi rentang.
 * V2 menyimpan kehadiran per hari, jadi rentang itu harus dibentangkan —
 * kalau hanya hari pertamanya yang dibuat, hari-hari di tengahnya
 * terbaca sebagai mangkir dan orangnya dinilai atas ketidakhadiran yang
 * sudah pernah disetujui.
 */

/** Status kehadiran V1 → status V2. */
export function statusHadir(
  nilai: unknown,
): "hadir" | "terlambat" | "izin" | "sakit" {
  const teks = typeof nilai === "string" ? nilai.trim().toLowerCase() : "";
  if (teks === "terlambat" || teks === "late") return "terlambat";
  if (teks === "izin" || teks === "leave" || teks === "permit") return "izin";
  if (teks === "sakit" || teks === "sick") return "sakit";
  return "hadir";
}

/** Koordinat dari objek lokasi lama, bila bentuknya masuk akal. */
export function koordinat(nilai: unknown): {
  lat: number | null;
  lng: number | null;
} {
  if (nilai === null || typeof nilai !== "object")
    return { lat: null, lng: null };
  const o = nilai as Record<string, unknown>;
  const lat = typeof o.lat === "number" ? o.lat : null;
  const lng = typeof o.lng === "number" ? o.lng : null;
  return { lat, lng };
}

/** Status pengajuan izin lama → status persetujuan V2. */
export function persetujuanIzin(
  nilai: unknown,
): "diajukan" | "disetujui" | "ditolak" {
  const teks = typeof nilai === "string" ? nilai.trim().toLowerCase() : "";
  if (["approved", "disetujui", "ok"].includes(teks)) return "disetujui";
  if (["rejected", "ditolak", "declined"].includes(teks)) return "ditolak";
  // Yang masih menunggu tetap menunggu. Menyetujuinya diam-diam berarti
  // memutuskan atas nama atasan yang belum pernah melihatnya.
  return "diajukan";
}

/** Setiap hari dalam rentang izin, sebagai daftar tanggal. */
export function hariIzin(mulai: string, selesai: string, batas = 62): string[] {
  const awal = new Date(`${mulai}T00:00:00Z`);
  const akhir = new Date(`${selesai}T00:00:00Z`);
  if (Number.isNaN(awal.getTime()) || Number.isNaN(akhir.getTime())) return [];
  if (akhir < awal) return [mulai];

  const hari: string[] = [];
  for (let d = awal; d <= akhir && hari.length < batas;) {
    hari.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 86400000);
  }
  return hari;
}
