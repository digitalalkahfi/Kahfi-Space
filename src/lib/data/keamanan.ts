import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import { periksaSandi, sandiBaruSah } from "@/lib/keamanan";
import { coba, reset, type Gerbang } from "@/lib/gerbang-coba";
import type { Pengguna } from "@/lib/types";

/**
 * Lima percobaan per lima menit per akun.
 *
 * Cukup longgar untuk orang yang salah ketik beberapa kali, cukup ketat
 * untuk membuat penebakan tidak ada gunanya: 60 tebakan per jam tidak
 * akan menemukan sandi yang memenuhi aturan di lib/keamanan.ts.
 */
export const GERBANG_SANDI: Gerbang = { batas: 5, jendela: 5 * 60_000 };

/**
 * Membuktikan bahwa yang di depan layar tahu sandi akunnya sendiri.
 *
 * Satu-satunya cara membuktikannya lewat Supabase Auth adalah mencoba
 * masuk dengan sandi itu — tidak ada API "periksa saja". Efek sampingnya
 * sesi ikut disegarkan, dan itu tidak apa-apa: pemiliknya memang sedang
 * membuktikan dirinya.
 *
 * Dibatasi percobaannya karena fungsi ini, tanpa pembatas, adalah alat
 * tebak sandi bagi siapa pun yang berhasil mencuri satu sesi.
 */
export async function verifikasiSandi(
  pengguna: Pengguna,
  sandi: string,
): Promise<Hasil<{ sisaPercobaan: number }>> {
  if (sandi === "") {
    return gagal("Isi kata sandi saat ini dulu.", "validasi");
  }

  const putusan = coba(`sandi:${pengguna.id}`, GERBANG_SANDI);
  if (!putusan.boleh) {
    const menit = Math.ceil(putusan.tungguDetik / 60);
    return gagal(
      `Terlalu banyak percobaan. Coba lagi dalam ${menit} menit.`,
      "izin",
    );
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb.auth.signInWithPassword({
    email: pengguna.email,
    password: sandi,
  });

  if (error) {
    return gagal(
      putusan.sisa === 0
        ? "Kata sandi saat ini tidak cocok. Percobaan berikutnya baru bisa beberapa menit lagi."
        : `Kata sandi saat ini tidak cocok. Sisa ${putusan.sisa} percobaan.`,
      "izin",
    );
  }

  // Berhasil membuktikan diri: hitungannya dikosongkan supaya salah
  // ketik hari ini tidak menghambat penggantian sandi besok.
  reset(`sandi:${pengguna.id}`);
  return sukses({ sisaPercobaan: GERBANG_SANDI.batas }, "Kata sandi cocok.");
}

/**
 * Mengganti kata sandi lewat Supabase Auth.
 *
 * Urutannya penting dan tidak boleh ditukar:
 * 1. bentuk isian diperiksa (tiga kolom terisi, ulangan cocok, tidak
 *    sama dengan yang lama) — murah, tidak menyentuh jaringan;
 * 2. sandi baru diperiksa terhadap aturan — juga murah;
 * 3. baru sandi lama dibuktikan.
 *
 * Kalau langkah 3 didahulukan, setiap salah ketik pada kolom ulangan
 * ikut memakan jatah percobaan verifikasi, dan orang yang cuma
 * kepeleset mengetik jadi terkunci lima menit tanpa alasan.
 */
export async function gantiSandiPengguna(
  pengguna: Pengguna,
  lama: string,
  baru: string,
  ulang: string,
): Promise<Hasil> {
  const bentuk = sandiBaruSah(lama, baru, ulang);
  if (!bentuk.ok) {
    return gagal(bentuk.pesan ?? "Periksa lagi isiannya.", "validasi");
  }

  const layak = periksaSandi(baru, {
    nama: pengguna.nama,
    email: pengguna.email,
  });
  if (!layak.ok) {
    return gagal(
      layak.pesan ??
        `Kata sandi baru belum memenuhi: ${layak.belum.join(", ").toLowerCase()}.`,
      "validasi",
    );
  }

  const bukti = await verifikasiSandi(pengguna, lama);
  if (!bukti.ok) return bukti;

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb.auth.updateUser({ password: baru });
  if (error) return gagal(`Gagal mengganti kata sandi: ${error.message}`);

  return sukses(
    undefined,
    "Kata sandi diganti. Perangkat lain yang masih masuk akan diminta masuk ulang.",
  );
}
