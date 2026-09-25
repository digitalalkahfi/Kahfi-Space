"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import {
  STATUS_PENJUAL_SAH,
  izinPenjual,
  type StatusPenjual,
} from "@/lib/penjual";
import type { KodeUnit } from "@/lib/types";

const UNIT_SAH: KodeUnit[] = ["affiliator", "mcn", "tap"];

export type MasukanPenjual = {
  namaToko: string;
  namaKontak: string;
  telepon: string;
  kategori: string;
  status: StatusPenjual;
  komisiPersen: number | null;
  catatan: string;
  unitKode: KodeUnit;
  picUserId: string | null;
};

function segarkan() {
  revalidatePath("/penjual");
}

/** Validasi yang mencerminkan kendala tabel `sellers` (0166). */
function periksa(input: MasukanPenjual): string | null {
  if (input.namaToko.trim().length < 2) {
    return "Tulis nama toko atau brand-nya (minimal 2 huruf).";
  }
  if (!STATUS_PENJUAL_SAH.includes(input.status)) {
    return "Status mitra tidak dikenali.";
  }
  if (!UNIT_SAH.includes(input.unitKode)) return "Unit tidak dikenali.";
  if (
    input.komisiPersen !== null &&
    (!Number.isFinite(input.komisiPersen) ||
      input.komisiPersen < 0 ||
      input.komisiPersen > 100)
  ) {
    return "Komisi ditulis dalam persen, antara 0 dan 100.";
  }
  return null;
}

async function idUnit(kode: KodeUnit) {
  const sb = await klienServer();
  const { data } = await sb
    .from("units")
    .select("id")
    .eq("kode", kode)
    .maybeSingle();
  return data?.id ?? null;
}

function kolomDari(input: MasukanPenjual, unitId: string) {
  return {
    nama_toko: input.namaToko.trim().slice(0, 120),
    nama_kontak: input.namaKontak.trim().slice(0, 80),
    telepon: input.telepon.trim().slice(0, 40),
    kategori: input.kategori.trim().slice(0, 60),
    status: input.status,
    komisi_persen: input.komisiPersen,
    catatan: input.catatan.trim().slice(0, 1000),
    unit_id: unitId,
    pic_user_id: input.picUserId,
  };
}

const PESAN_IZIN =
  "Hanya Manager, CEO, atau Leader/Co-Leader unitnya yang boleh mengubah mitra ini (PIC-nya boleh memperbarui catatannya).";

/**
 * Tambah mitra baru.
 *
 * Yang berhak: CEO/Manager untuk unit mana pun, Leader/Co-Leader untuk
 * unitnya sendiri (policy `sellers_kelola` dan `sellers_unit_kelola`).
 */
export async function tambahPenjual(input: MasukanPenjual): Promise<Hasil> {
  const salah = periksa(input);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!izinPenjual(pengguna).tambah) {
    return gagal(
      "Hanya Manager, CEO, atau Leader/Co-Leader unit yang boleh menambah mitra.",
      "izin",
    );
  }

  const unitId = await idUnit(input.unitKode);
  if (!unitId) return gagal("Unit tidak ditemukan.", "validasi");

  const sb = await klienServer();
  const { error } = await sb
    .from("sellers")
    .insert({ ...kolomDari(input, unitId), dibuat_oleh: pengguna.id });

  if (error) {
    return error.code === "42501"
      ? gagal(PESAN_IZIN, "izin")
      : gagal(error.message, "validasi");
  }

  segarkan();
  return sukses(undefined, `Mitra ${input.namaToko.trim()} tercatat.`);
}

/** Ubah data mitra; siapa yang boleh ditentukan RLS (lihat `izinPenjual`). */
export async function ubahPenjual(
  penjualId: string,
  input: MasukanPenjual,
): Promise<Hasil> {
  if (!penjualId) return gagal("Mitra tidak dikenali.", "validasi");
  const salah = periksa(input);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const unitId = await idUnit(input.unitKode);
  if (!unitId) return gagal("Unit tidak ditemukan.", "validasi");

  const sb = await klienServer();
  const { data, error } = await sb
    .from("sellers")
    .update(kolomDari(input, unitId))
    .eq("id", penjualId)
    .select("id");

  if (error) {
    return error.code === "42501" || error.code === "P0001"
      ? gagal(PESAN_IZIN, "izin")
      : gagal(error.message, "validasi");
  }
  // RLS tidak menolak dengan galat: baris yang tak boleh disentuh sekadar
  // tidak berubah.
  if (!data || data.length === 0) return gagal(PESAN_IZIN, "izin");

  segarkan();
  return sukses(undefined, "Data mitra diperbarui.");
}

/** Hapus mitra. Untuk yang pernah bekerja sama, lebih baik ditandai nonaktif. */
export async function hapusPenjual(penjualId: string): Promise<Hasil> {
  if (!penjualId) return gagal("Mitra tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { data, error } = await sb
    .from("sellers")
    .delete()
    .eq("id", penjualId)
    .select("id");

  if (error) {
    return error.code === "42501"
      ? gagal(PESAN_IZIN, "izin")
      : gagal(`Gagal menghapus: ${error.message}`);
  }
  if (!data || data.length === 0) return gagal(PESAN_IZIN, "izin");

  segarkan();
  return sukses(undefined, "Mitra dihapus.");
}
