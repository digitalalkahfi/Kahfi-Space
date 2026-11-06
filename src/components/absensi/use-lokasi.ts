"use client";

import { useCallback, useState } from "react";

export type Titik = { lat: number; lng: number; akurasi: number };

/** Titik yang terbaca, atau alasan gagalnya untuk ditampilkan ke pengguna. */
export type HasilLokasi =
  | { titik: Titik; pesan: null }
  | { titik: null; pesan: string };

export type KeadaanLokasi =
  | { status: "kosong" }
  | { status: "mencari" }
  | { status: "siap"; titik: Titik }
  | { status: "gagal"; pesan: string };

const PESAN: Record<number, string> = {
  1: "Akses lokasi ditolak. Buka pengaturan situs di peramban, izinkan Lokasi, lalu coba lagi.",
  2: "Lokasi tidak terbaca. Pastikan GPS menyala dan sinyal cukup.",
  3: "Pencarian lokasi terlalu lama. Coba lagi di tempat yang lebih terbuka.",
};

/**
 * Membaca titik GPS sekali saat diminta.
 *
 * Sengaja tidak memakai watchPosition: absensi hanya butuh satu titik pada
 * saat tombol ditekan, dan pemantauan terus-menerus memboroskan baterai.
 *
 * Namanya memakai awalan `use` karena ini React Hook — konvensi React yang
 * juga dipakai linter, sementara nama lain di berkas ini tetap Indonesia.
 */
export function useLokasi() {
  const [keadaan, setKeadaan] = useState<KeadaanLokasi>({ status: "kosong" });

  const minta = useCallback(async (): Promise<HasilLokasi> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const pesan = "Peramban ini tidak mendukung deteksi lokasi.";
      setKeadaan({ status: "gagal", pesan });
      return { titik: null, pesan };
    }

    setKeadaan({ status: "mencari" });

    const baca = (opsi: PositionOptions) =>
      new Promise<GeolocationPosition>((berhasil, gagal) =>
        navigator.geolocation.getCurrentPosition(berhasil, gagal, opsi),
      );

    try {
      let pos: GeolocationPosition;
      try {
        pos = await baca({
          enableHighAccuracy: true,
          timeout: 12_000,
          maximumAge: 30_000,
        });
      } catch (e) {
        // GPS presisi sering tidak dapat sinyal di dalam ruangan atau di HP
        // kelas bawah. Sekali lagi dengan lokasi jaringan: titiknya kurang
        // tepat, tetapi radius tetap dinilai database dan absen tidak
        // berhenti diam-diam. Izin yang ditolak tidak dicoba ulang.
        if ((e as GeolocationPositionError).code === 1) throw e;
        pos = await baca({
          enableHighAccuracy: false,
          timeout: 20_000,
          maximumAge: 300_000,
        });
      }
      const titik = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        akurasi: Math.round(pos.coords.accuracy),
      };
      setKeadaan({ status: "siap", titik });
      return { titik, pesan: null };
    } catch (e) {
      const pesan =
        PESAN[(e as GeolocationPositionError).code] ?? "Lokasi gagal dibaca.";
      setKeadaan({ status: "gagal", pesan });
      return { titik: null, pesan };
    }
  }, []);

  return { keadaan, minta };
}
