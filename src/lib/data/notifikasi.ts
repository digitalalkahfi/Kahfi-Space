import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { tautanAman, type Notifikasi } from "@/lib/notifikasi";
import type { KategoriNotifikasi } from "@/lib/notifikasi";
import type { Pengguna } from "@/lib/types";

type BarisDb = {
  id: string;
  kategori: string;
  judul: string;
  pesan: string;
  tautan: string | null;
  dibaca_pada: string | null;
  created_at: string;
};

/**
 * Berapa notifikasi terbaru yang ditarik sekaligus.
 *
 * Daftar yang lebih panjang dari ini tidak pernah dibaca sampai habis;
 * yang dicari orang selalu ada di atas. Batasnya penting justru karena
 * lencana TIDAK boleh ikut dibatasi — lihat `jumlahBelumDibacaSaya`.
 */
export const BATAS_DAFTAR = 200;

/**
 * Notifikasi milik pengguna yang sedang masuk.
 *
 * Cakupannya dibatasi RLS (`notifikasi_baca_milik_sendiri`, migrasi
 * 0111): tidak ada `where user_id = …` di sini, dan memang tidak boleh
 * ada — dua pagar yang seolah-olah setara membuat orang berhenti
 * memeriksa yang benar.
 */
export async function daftarNotifikasi(
  pengguna: Pengguna,
): Promise<Notifikasi[]> {
  if (modeData() === "demo") {
    return dataContoh.notifications
      .filter((n) => n.untuk === pengguna.nama)
      .map((n, i) => ({
        id: `${pengguna.id}-${i}`,
        kategori: n.kategori as KategoriNotifikasi,
        judul: n.judul,
        pesan: n.pesan,
        // Tautan yang keluar dari aplikasi tidak pernah dipercaya,
        // bahkan dari data contoh sendiri.
        tautan: tautanAman(n.tautan) ? n.tautan : "/beranda",
        dibacaPada: n.dibaca ?? null,
        dibuatPada: n.dibuat,
      }))
      .sort((a, b) => b.dibuatPada.localeCompare(a.dibuatPada));
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("notifications")
    .select("id, kategori, judul, pesan, tautan, dibaca_pada, created_at")
    .order("created_at", { ascending: false })
    .limit(BATAS_DAFTAR);

  // Tabelnya ada sejak migrasi 0111, jadi tidak ada lagi kegagalan yang
  // dimaafkan. Menelan galat query berarti gangguan sungguhan akan
  // terlihat sebagai "belum ada notifikasi", dan orang akan menunggu
  // kabar yang tidak akan pernah datang.
  if (error) throw new Error(`Gagal memuat notifikasi: ${error.message}`);

  return (data as BarisDb[]).map((b) => ({
    id: b.id,
    kategori: b.kategori as KategoriNotifikasi,
    judul: b.judul,
    pesan: b.pesan,
    tautan: b.tautan && tautanAman(b.tautan) ? b.tautan : "/beranda",
    dibacaPada: b.dibaca_pada,
    dibuatPada: b.created_at,
  }));
}

/**
 * Jumlah notifikasi yang belum dibaca — angka pada lencana lonceng.
 *
 * Dihitung terpisah dari `daftarNotifikasi`, bukan dari panjang
 * daftarnya: daftar itu dibatasi 200 baris terbaru, dan lencana yang
 * ikut terbatas akan diam di angka yang sama begitu seseorang
 * menumpuk lebih banyak dari itu. Basis data yang menghitung — tanpa
 * mengirim satu baris pun (`head: true`).
 */
export async function jumlahBelumDibacaSaya(
  pengguna: Pengguna,
): Promise<number> {
  if (modeData() === "demo") {
    return dataContoh.notifications.filter(
      (n) => n.untuk === pengguna.nama && !n.dibaca,
    ).length;
  }

  const sb = await klienServer();
  const { count, error } = await sb
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("dibaca_pada", null);

  // Lencana yang salah lebih baik daripada app-bar yang gagal dirender:
  // kegagalan menghitung dicatat, tapi tidak menjatuhkan seluruh
  // halaman. Daftarnya sendiri tetap melempar (lihat daftarNotifikasi).
  if (error) {
    console.error("Gagal menghitung notifikasi belum dibaca:", error.message);
    return 0;
  }
  return count ?? 0;
}
