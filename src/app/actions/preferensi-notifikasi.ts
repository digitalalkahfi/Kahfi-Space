"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { preferensiSaya } from "@/lib/data/preferensi-notifikasi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import { KATEGORI_NOTIFIKASI } from "@/lib/notifikasi";
import type { KategoriNotifikasiDb } from "@/lib/supabase/types";
import { bolehMematikan, type Kanal } from "@/lib/preferensi-notifikasi";

const KANAL: Kanal[] = ["inApp", "whatsapp"];

/**
 * Menyalakan atau mematikan satu kanal pada satu kategori.
 *
 * Pagar perannya diperiksa DI SINI juga, bukan hanya di layar: tombol
 * yang disembunyikan bukan tombol yang tidak ada, dan Server Action
 * bisa dipanggil langsung oleh siapa pun yang punya sesi.
 *
 * Pagar perannya ada di DUA tempat dengan sengaja: di sini supaya
 * pesannya bisa dibaca manusia, dan di trigger `jaga_matikan_notifikasi`
 * (migrasi 0115) supaya tetap berlaku bagi pemanggil yang tidak lewat
 * sini sama sekali.
 */
export async function ubahSatuPreferensi(
  kategori: string,
  kanal: string,
  nyala: boolean,
): Promise<Hasil> {
  if (!(KATEGORI_NOTIFIKASI as readonly string[]).includes(kategori)) {
    return gagal("Kategori tidak dikenali.", "validasi");
  }
  if (!(KANAL as string[]).includes(kanal)) {
    return gagal("Kanal tidak dikenali.", "validasi");
  }

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  if (!nyala && kanal === "inApp" && !bolehMematikan(pengguna.role)) {
    return gagal(
      "Hanya CEO dan Manager yang bisa mematikan notifikasi di aplikasi.",
      "izin",
    );
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  // Keadaan sekarang dibaca dulu supaya kanal yang TIDAK disentuh tidak
  // ikut terhapus oleh upsert. Baris preferensi memuat dua kanal
  // sekaligus, dan menulis salah satunya saja akan mengembalikan yang
  // lain ke bawaan diam-diam.
  const sekarang = await preferensiSaya(pengguna);
  const baris = sekarang.find((p) => p.kategori === kategori);
  const inApp = kanal === "inApp" ? nyala : (baris?.inApp ?? true);
  // Mematikan in-app ikut mematikan WhatsApp-nya; CHECK di basis data
  // menolak kombinasi lain, jadi ini bukan kesopanan melainkan syarat.
  const whatsapp = !inApp
    ? false
    : kanal === "whatsapp"
      ? nyala
      : (baris?.whatsapp ?? false);

  const sb = await klienServer();
  const { error } = await sb.from("notification_preferences").upsert(
    {
      user_id: pengguna.id,
      // Sudah dipastikan salah satu KATEGORI_NOTIFIKASI di atas.
      kategori: kategori as KategoriNotifikasiDb,
      in_app: inApp,
      whatsapp,
    },
    { onConflict: "user_id,kategori" },
  );

  if (error) {
    return error.code === "42501"
      ? gagal(
          "Hanya CEO dan Manager yang bisa mematikan notifikasi di aplikasi.",
          "izin",
        )
      : gagal(`Gagal menyimpan preferensi: ${error.message}`);
  }

  revalidatePath("/notifikasi/preferensi");
  return sukses(undefined, "Preferensi tersimpan.");
}

/** Dipakai lapisan backend setelah tabelnya ada. */
export async function segarkanPreferensi() {
  revalidatePath("/notifikasi/preferensi");
}
