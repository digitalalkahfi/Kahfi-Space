"use client";

import { useCallback, useState } from "react";

export type Titik = { lat: number; lng: number; akurasi: number };

export type KeadaanLokasi =
  | { status: "kosong" }
  | { status: "mencari" }
  | { status: "siap"; titik: Titik }
  | { status: "gagal"; pesan: string };

const PESAN: Record<number, string> = {
  1: "Akses lokasi ditolak. Izinkan lokasi di peramban lalu coba lagi.",
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

  const minta = useCallback(async (): Promise<Titik | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setKeadaan({
        status: "gagal",
        pesan: "Peramban ini tidak mendukung deteksi lokasi.",
      });
      return null;
    }

    setKeadaan({ status: "mencari" });

    return new Promise((selesai) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const titik = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            akurasi: Math.round(pos.coords.accuracy),
          };
          setKeadaan({ status: "siap", titik });
          selesai(titik);
        },
        (e) => {
          setKeadaan({
            status: "gagal",
            pesan: PESAN[e.code] ?? "Lokasi gagal dibaca.",
          });
          selesai(null);
        },
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
      );
    });
  }, []);

  return { keadaan, minta };
}
