"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { sesiSaatIni } from "@/lib/data/sesi";
import {
  hapusPreferensiTampilan,
  simpanPreferensiTampilan,
} from "@/lib/data/preferensi-tampilan";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import { PERMUKAAN, type PermukaanTampilan } from "@/lib/tampilan";

/** Batas panjang daftar; lebih dari ini bukan susunan, melainkan kiriman skrip. */
const MAKS_ITEM = 100;

function permukaanSah(nilai: unknown): nilai is PermukaanTampilan {
  return (
    typeof nilai === "string" &&
    (PERMUKAAN as readonly string[]).includes(nilai)
  );
}

export type ItemDiminta = { kunci: string; tampil: boolean };

/**
 * Memeriksa bentuk daftar yang dikirim browser.
 *
 * Yang diperiksa di sini hanya BENTUKNYA. Apakah sebuah kunci boleh
 * dilihat peran ini diputuskan `simpanPreferensiTampilan` lewat
 * katalog — satu tempat, dipakai baca maupun tulis, jadi tidak ada
 * daftar wewenang kedua yang bisa melenceng.
 */
function bacaDaftar(nilai: unknown): ItemDiminta[] | null {
  if (!Array.isArray(nilai) || nilai.length > MAKS_ITEM) return null;

  const hasil: ItemDiminta[] = [];
  for (const baris of nilai) {
    if (!baris || typeof baris !== "object") return null;
    const { kunci, tampil } = baris as { kunci?: unknown; tampil?: unknown };
    if (typeof kunci !== "string" || kunci.trim() === "") return null;
    if (typeof tampil !== "boolean") return null;
    hasil.push({ kunci: kunci.trim().slice(0, 120), tampil });
  }
  return hasil;
}

/**
 * Menyimpan susunan satu permukaan.
 *
 * Seluruh daftar dikirim sekaligus, bukan satu item per panggilan:
 * yang disimpan adalah URUTAN, dan urutan yang diperbarui sebagian
 * menghasilkan campuran antara susunan lama dan baru.
 */
export async function simpanSusunan(
  permukaan: string,
  daftar: unknown,
): Promise<Hasil> {
  if (!permukaanSah(permukaan)) {
    return gagal("Permukaan tampilan tidak dikenali.", "validasi");
  }

  const isi = bacaDaftar(daftar);
  if (!isi) {
    return gagal(
      `Daftar item tidak berbentuk benar; maksimal ${MAKS_ITEM} item berisi kunci dan tampil.`,
      "validasi",
    );
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const hasil = await simpanPreferensiTampilan(pengguna, {
    [permukaan]: isi,
  });
  if (!hasil.ok) return gagal(hasil.pesan ?? "Gagal menyimpan susunan.");

  // Navigasi ikut tergambar ulang di seluruh halaman, bukan hanya di
  // halaman pengaturannya.
  revalidatePath("/", "layout");
  return sukses(undefined, "Susunan tersimpan.");
}

/** Menghapus seluruh preferensi; susunan kembali ke bawaan. */
export async function kembalikanSusunanBawaan(): Promise<Hasil> {
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const hasil = await hapusPreferensiTampilan(pengguna);
  if (!hasil.ok) return gagal(hasil.pesan ?? "Gagal mengembalikan susunan.");

  revalidatePath("/", "layout");
  return sukses(undefined, "Susunan kembali ke bawaan.");
}
