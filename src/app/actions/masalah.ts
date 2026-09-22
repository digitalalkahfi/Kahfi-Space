"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { bolehKelolaMasalah } from "@/lib/data/masalah";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import {
  MIN_SOLUSI,
  type DampakMasalah,
  type StatusMasalah,
} from "@/lib/masalah";
import type { KodeUnit } from "@/lib/types";

const DAMPAK_SAH: DampakMasalah[] = ["rendah", "sedang", "tinggi"];

function segarkan(id?: string) {
  revalidatePath("/masalah");
  if (id) revalidatePath(`/masalah/${id}`);
}

async function idUnit(kode: KodeUnit | null) {
  if (!kode) return null;
  const sb = await klienServer();
  const { data } = await sb
    .from("units")
    .select("id")
    .eq("kode", kode)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Laporkan masalah baru.
 *
 * Siapa pun yang login boleh melaporkan. Menyaring pelapor — misalnya
 * hanya Leader ke atas — membuat masalah yang paling dekat dengan
 * pekerjaan harian justru tidak pernah sampai ke permukaan.
 */
export async function laporkanMasalah(input: {
  judul: string;
  konteks: string;
  unitKode: KodeUnit | null;
  dampak: DampakMasalah;
}): Promise<Hasil> {
  const judul = input.judul.trim();
  if (judul.length < 10) {
    return gagal(
      "Tulis judul yang cukup jelas (minimal 10 huruf) — judul samar membuat masalahnya sulit ditelusuri.",
      "validasi",
    );
  }
  if (!DAMPAK_SAH.includes(input.dampak)) {
    return gagal("Tingkat dampak tidak dikenali.", "validasi");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { error } = await sb.from("problems").insert({
    judul,
    konteks: input.konteks.trim().slice(0, 600),
    unit_id: await idUnit(input.unitKode),
    dilaporkan_oleh: pengguna.id,
    dampak: input.dampak,
  });

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak melaporkan masalah.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkan();
  return sukses(
    undefined,
    "Laporan tercatat. Manajemen akan menerimanya dan menuliskan solusinya di sini.",
  );
}

/**
 * Ubah status masalah.
 *
 * Aturan yang menentukan status boleh berubah atau tidak ada di database
 * (migrasi 0053), dan pesannya diteruskan apa adanya: alasannya selalu
 * menyebut apa yang kurang, jadi lebih menolong daripada pesan umum.
 */
export async function ubahStatusMasalah(input: {
  masalahId: string;
  status: StatusMasalah;
  alasan?: string;
}): Promise<Hasil> {
  if (!input.masalahId) return gagal("Masalah tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaMasalah(pengguna)) {
    return gagal(
      "Hanya CEO atau Manager yang boleh mengubah status masalah.",
      "izin",
    );
  }

  const sb = await klienServer();
  const { error } = await sb
    .from("problems")
    .update({
      status: input.status,
      ditutup_alasan: (input.alasan ?? "").trim().slice(0, 300),
    })
    .eq("id", input.masalahId);

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah masalah ini.", "izin")
      : gagal(error.message, "validasi");
  }

  segarkan(input.masalahId);
  return sukses(undefined, "Status masalah diperbarui.");
}

/**
 * Tulis atau perbarui solusi sebuah laporan.
 *
 * Boleh sekaligus menandainya selesai: itulah langkah yang sebenarnya
 * dilakukan orang — menulis jawabannya dan menutup perkaranya dalam satu
 * gerakan. Dipisah jadi dua tombol, yang kedua sering terlupa dan papan
 * penuh laporan "diproses" yang sudah lama beres.
 *
 * Keduanya satu UPDATE supaya trigger `jaga_status_masalah` (0121)
 * membaca solusi yang baru, bukan yang tersimpan sebelumnya.
 */
export async function simpanSolusiMasalah(input: {
  masalahId: string;
  solusi: string;
  tandaiSelesai: boolean;
}): Promise<Hasil> {
  const solusi = input.solusi.trim();
  if (!input.masalahId) return gagal("Masalah tidak dikenali.", "validasi");
  if (input.tandaiSelesai && solusi.length < MIN_SOLUSI) {
    return gagal(
      `Tulis solusinya dulu (minimal ${MIN_SOLUSI} huruf) sebelum menandai selesai.`,
      "validasi",
    );
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaMasalah(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh menulis solusi.", "izin");
  }

  const sb = await klienServer();
  const { error } = await sb
    .from("problems")
    .update({
      solusi: solusi.slice(0, 1000),
      ...(input.tandaiSelesai ? { status: "selesai" as const } : {}),
    })
    .eq("id", input.masalahId);

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah laporan ini.", "izin")
      : gagal(error.message, "validasi");
  }

  segarkan(input.masalahId);
  return sukses(
    undefined,
    input.tandaiSelesai
      ? "Solusi tersimpan dan laporan ditandai selesai."
      : "Solusi tersimpan.",
  );
}
