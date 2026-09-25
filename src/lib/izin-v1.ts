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

/** Tanggal (YYYY-MM-DD) sebuah waktu menurut zona Asia/Jakarta. */
export function tanggalWib(iso: unknown): string | null {
  if (typeof iso !== "string") return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  // WIB tidak mengenal daylight saving, jadi geser tetap +7 jam cukup.
  return new Date(t.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/** Satu hari kehadiran, bentuk yang dibaca mesin migrasi. */
export type HariKehadiran = {
  id: string;
  userId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: "hadir" | "terlambat";
  checkInLocation: { lat: number | null; lng: number | null } | null;
};

/**
 * Membentangkan kejadian absen menjadi satu baris per orang per hari.
 *
 * Ekspor K-Space lama yang sebenarnya tidak menyimpan kehadiran per hari:
 * ia menyimpan KEJADIAN — satu baris untuk absen masuk (`type: "in"`),
 * satu lagi untuk pulang (`type: "out"`), masing-masing dengan
 * `timestamp` UTC. V2 menyimpan satu baris per hari, jadi kejadian yang
 * jatuh pada hari yang sama (menurut WIB, bukan UTC — absen pulang jam
 * 22.00 masih hari yang sama) disatukan: masuk terawal, pulang terakhir.
 *
 * Penanda barisnya `attn_<userId>_<tanggal>`, bukan id salah satu
 * kejadiannya, supaya pengulangan dengan ekspor yang lebih baru tetap
 * mengenali hari yang sama. Ejaannya mengikuti ekspor "transformed" yang
 * dipakai migrasi pertama (23 Sep 2026): peta `migrasi_peta` sudah berisi
 * 951 hari dengan penanda itu, dan penanda lain akan membuat hari yang
 * sama dianggap belum pernah pindah. Baris yang sudah berbentuk harian
 * (punya `date`) dibiarkan apa adanya, jadi ekspor gaya lama maupun contoh
 * tetap terbaca.
 */
export function hariDariKejadian(daftar: unknown[]): unknown[] {
  const lolos: unknown[] = [];
  const perHari = new Map<string, HariKehadiran>();

  for (const k of daftar) {
    if (k === null || typeof k !== "object") continue;
    const b = k as Record<string, unknown>;
    if (typeof b.timestamp !== "string" || typeof b.date === "string") {
      lolos.push(k);
      continue;
    }

    const userId = typeof b.userId === "string" ? b.userId : "";
    const tanggal = tanggalWib(b.timestamp);
    if (userId === "" || tanggal === null) {
      // Diteruskan sebagai baris harian yang cacat supaya tetap tercatat
      // sebagai tertahan beserta sebabnya, bukan hilang diam-diam.
      lolos.push({ id: b.id, userId, date: tanggal ?? "" });
      continue;
    }

    const kunci = `${userId}#${tanggal}`;
    const hari = perHari.get(kunci) ?? {
      id: `attn_${userId}_${tanggal}`,
      userId,
      date: tanggal,
      checkIn: null,
      checkOut: null,
      status: "hadir",
      checkInLocation: null,
    };

    const jenis = typeof b.type === "string" ? b.type.toLowerCase() : "in";
    if (jenis === "out") {
      if (hari.checkOut === null || b.timestamp > hari.checkOut) {
        hari.checkOut = b.timestamp;
      }
    } else if (hari.checkIn === null || b.timestamp < hari.checkIn) {
      hari.checkIn = b.timestamp;
      hari.checkInLocation = {
        lat: typeof b.latitude === "number" ? b.latitude : null,
        lng: typeof b.longitude === "number" ? b.longitude : null,
      };
      hari.status = b.late === true ? "terlambat" : "hadir";
    }

    perHari.set(kunci, hari);
  }

  const harian = [...perHari.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.userId.localeCompare(b.userId),
  );
  return [...lolos, ...harian];
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
