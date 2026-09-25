"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import {
  KATEGORI_CATATAN_SAH,
  VISIBILITAS_CATATAN_SAH,
  type KategoriCatatan,
  type VisibilitasCatatan,
} from "@/lib/catatan";
import type { KodeUnit } from "@/lib/types";

export type MasukanCatatan = {
  judul: string;
  isi: string;
  kategori: KategoriCatatan;
  visibilitas: VisibilitasCatatan;
  /** Unit tujuan bila dibagikan ke unit. */
  unitKode: KodeUnit | null;
  lampiran: string[];
};

const MAKS_LAMPIRAN = 10;

function segarkan(id?: string) {
  revalidatePath("/catatan");
  if (id) revalidatePath(`/catatan/${id}`);
}

/** Validasi yang mencerminkan kendala tabel `notes` dan trigger `jaga_catatan` (0167). */
function periksa(input: MasukanCatatan): string | null {
  if (input.judul.trim().length < 3) {
    return "Tulis judul catatannya (minimal 3 huruf).";
  }
  if (!KATEGORI_CATATAN_SAH.includes(input.kategori)) {
    return "Kategori tidak dikenali.";
  }
  if (!VISIBILITAS_CATATAN_SAH.includes(input.visibilitas)) {
    return "Lingkup catatan tidak dikenali.";
  }
  if (input.visibilitas === "unit" && !input.unitKode) {
    return "Sebutkan unit yang boleh membaca catatan ini.";
  }
  if (input.lampiran.length > MAKS_LAMPIRAN) {
    return `Lampiran paling banyak ${MAKS_LAMPIRAN} tautan.`;
  }
  if (input.lampiran.some((l) => !/^https?:\/\/\S+$/.test(l.trim()))) {
    return "Lampiran harus berupa tautan yang diawali http:// atau https://.";
  }
  return null;
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

async function kolomDari(input: MasukanCatatan) {
  return {
    judul: input.judul.trim().slice(0, 160),
    isi: input.isi.replace(/\r\n/g, "\n").trim().slice(0, 20000),
    kategori: input.kategori,
    visibilitas: input.visibilitas,
    unit_id: input.visibilitas === "unit" ? await idUnit(input.unitKode) : null,
    lampiran: input.lampiran.map((l) => l.trim()).filter((l) => l !== ""),
  };
}

const PESAN_MILIK = "Hanya penulisnya yang boleh mengubah catatan ini.";

/** Tulis catatan baru; selalu atas nama yang masuk (policy `notes_tulis`). */
export async function tambahCatatan(
  input: MasukanCatatan,
): Promise<Hasil<{ id: string }>> {
  const salah = periksa(input);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { data, error } = await sb
    .from("notes")
    .insert({ ...(await kolomDari(input)), dibuat_oleh: pengguna.id })
    .select("id")
    .single();

  if (error || !data) {
    return error?.code === "42501"
      ? gagal("Kamu tidak berhak menulis catatan.", "izin")
      : gagal(error?.message ?? "Gagal menyimpan.", "validasi");
  }

  segarkan(data.id);
  return sukses({ id: data.id }, "Catatan tersimpan.");
}

export async function ubahCatatan(
  catatanId: string,
  input: MasukanCatatan,
): Promise<Hasil> {
  if (!catatanId) return gagal("Catatan tidak dikenali.", "validasi");
  const salah = periksa(input);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { data, error } = await sb
    .from("notes")
    .update(await kolomDari(input))
    .eq("id", catatanId)
    .select("id");

  if (error) {
    return error.code === "42501"
      ? gagal(PESAN_MILIK, "izin")
      : gagal(error.message, "validasi");
  }
  if (!data || data.length === 0) return gagal(PESAN_MILIK, "izin");

  segarkan(catatanId);
  return sukses(undefined, "Catatan diperbarui.");
}

/** Sematkan atau lepaskan sematan; hanya penulisnya, dan hanya di mejanya sendiri. */
export async function sematkanCatatan(
  catatanId: string,
  disematkan: boolean,
): Promise<Hasil> {
  if (!catatanId) return gagal("Catatan tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { data, error } = await sb
    .from("notes")
    .update({ disematkan })
    .eq("id", catatanId)
    .select("id");

  if (error) return gagal(error.message, "validasi");
  if (!data || data.length === 0) return gagal(PESAN_MILIK, "izin");

  segarkan(catatanId);
  return sukses(
    undefined,
    disematkan ? "Catatan disematkan di atas." : "Sematan dilepas.",
  );
}

export async function hapusCatatan(catatanId: string): Promise<Hasil> {
  if (!catatanId) return gagal("Catatan tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { data, error } = await sb
    .from("notes")
    .delete()
    .eq("id", catatanId)
    .select("id");

  if (error) return gagal(`Gagal menghapus: ${error.message}`);
  if (!data || data.length === 0) return gagal(PESAN_MILIK, "izin");

  segarkan();
  return sukses(undefined, "Catatan dihapus.");
}
