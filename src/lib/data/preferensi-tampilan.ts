// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { bolehLihatKeuangan } from "@/lib/keuangan";
import { menuPendamping, menuUtama, pintasanAtas } from "@/lib/navigasi";
import {
  katalogTampilan,
  preferensiBawaan,
  selaraskanPreferensi,
  PERMUKAAN,
  type ItemTampilan,
  type PermukaanTampilan,
  type PreferensiTampilan,
} from "@/lib/tampilan";
import type { Pengguna } from "@/lib/types";

export type KatalogTampilan = Record<PermukaanTampilan, ItemTampilan[]>;

/**
 * Katalog item yang boleh dipilih pengguna ini.
 *
 * Dirakit di server dan dipakai DUA kali: sekali untuk menggambar
 * halaman pengaturan, sekali lagi untuk menyaring apa pun yang
 * dikirim balik. Satu sumber untuk keduanya berarti tidak ada celah
 * antara "yang ditawarkan" dan "yang diterima".
 */
export function katalogUntuk(pengguna: Pengguna): KatalogTampilan {
  return katalogTampilan(
    { utama: menuUtama, pendamping: menuPendamping, pintasan: pintasanAtas },
    {
      peran: pengguna.role,
      izin: {
        keuangan: bolehLihatKeuangan(pengguna.role),
        migrasi: pengguna.role === "CEO" || pengguna.role === "Manager",
      },
    },
  );
}

/**
 * Preferensi tampilan pengguna yang sedang masuk.
 *
 * Yang belum pernah diatur mengikuti bawaan — bukan "tidak punya
 * preferensi". Pembedaan itu hanya berguna bagi basis data; bagi
 * layar, orang yang belum pernah membuka halaman pengaturan tetap
 * punya susunan yang berlaku.
 *
 * Hasilnya selalu lewat `selaraskanPreferensi`, dan itu yang menutup
 * celah wewenang: baris yang tersimpan di luar katalog peran ini —
 * entah karena perannya turun, entah karena seseorang menulis langsung
 * ke tabelnya — dibuang saat dibaca, jadi ia tidak pernah tergambar.
 */
export type SusunanTersimpan = {
  preferensi: PreferensiTampilan;
  /**
   * Ada baris tersimpan untuk orang ini.
   *
   * Dibedakan dari "susunannya kebetulan sama dengan bawaan": tombol
   * "Kembalikan ke bawaan" hanya berguna bila memang ada yang bisa
   * dihapus, dan menebaknya dari isi preferensi akan salah untuk orang
   * yang sengaja menyusun ulang lalu kembali ke susunan awal.
   */
  tersimpan: boolean;
};

export async function preferensiTampilanSaya(
  pengguna: Pengguna,
): Promise<SusunanTersimpan> {
  const katalog = katalogUntuk(pengguna);

  // Mode demo tidak punya tempat menyimpan per pengguna; yang berlaku
  // bawaan, dan layar menyebutnya apa adanya.
  if (modeData() === "demo") {
    return { preferensi: preferensiBawaan(katalog), tersimpan: false };
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("preferensi_tampilan")
    .select("permukaan, kunci_item, tampil, urutan")
    .eq("pengguna_id", pengguna.id)
    .order("urutan", { ascending: true });

  // Gagal membaca bukan alasan menampilkan navigasi kosong: yang
  // berlaku bawaan, dan orangnya tetap bisa bekerja.
  if (error || !data || data.length === 0) {
    return { preferensi: preferensiBawaan(katalog), tersimpan: false };
  }

  const tersimpan: Partial<PreferensiTampilan> = {};
  for (const permukaan of PERMUKAAN) {
    const baris = data
      .filter((b) => b.permukaan === permukaan)
      .map((b) => ({ kunci: b.kunci_item, tampil: b.tampil }));
    if (baris.length > 0) tersimpan[permukaan] = baris;
  }

  return {
    preferensi: selaraskanPreferensi(katalog, tersimpan),
    tersimpan: true,
  };
}

/**
 * Menyimpan susunan satu pengguna.
 *
 * Diselaraskan lebih dulu dengan katalognya, jadi kunci di luar
 * wewenang peran tidak pernah sampai ke tabel — personalisasi hanya
 * mengurangi akses, tidak pernah menambah (PRD §Fase 3).
 *
 * Penulisannya mengganti SELURUH daftar sebuah permukaan, bukan upsert
 * satu per satu: yang disimpan adalah susunan, dan susunan yang
 * diperbarui sebagian menghasilkan urutan campuran antara yang lama
 * dan yang baru.
 *
 * Penggantian itu lewat RPC `simpan_susunan_tampilan` (0124) supaya
 * hapus dan sisip terjadi dalam satu transaksi. Dua permintaan
 * terpisah bisa berhenti di tengah, dan yang tersisa adalah permukaan
 * tanpa baris — yang menurut aturan tabelnya berarti "ikut bawaan".
 * Susunan yang baru diatur hilang tanpa pesan apa pun.
 */
export async function simpanPreferensiTampilan(
  pengguna: Pengguna,
  diminta: Partial<PreferensiTampilan>,
): Promise<{ ok: boolean; pesan?: string }> {
  const katalog = katalogUntuk(pengguna);
  const bersih = selaraskanPreferensi(katalog, diminta);

  const sb = await klienServer();
  const permukaanDiubah = PERMUKAAN.filter((p) => diminta[p] !== undefined);

  for (const permukaan of permukaanDiubah) {
    const { error } = await sb.rpc("simpan_susunan_tampilan", {
      p_permukaan: permukaan,
      p_item: bersih[permukaan].map((b) => ({
        kunci: b.kunci,
        tampil: b.tampil,
      })),
    });
    if (error) return { ok: false, pesan: error.message };
  }

  return { ok: true };
}

/** Menghapus seluruh preferensi; susunan kembali ke bawaan. */
export async function hapusPreferensiTampilan(
  pengguna: Pengguna,
): Promise<{ ok: boolean; pesan?: string }> {
  const sb = await klienServer();
  const { error } = await sb
    .from("preferensi_tampilan")
    .delete()
    .eq("pengguna_id", pengguna.id);

  return error ? { ok: false, pesan: error.message } : { ok: true };
}
