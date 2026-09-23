"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { bolehKelolaProgram } from "@/lib/data/program";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import { kodeUnitSah } from "@/lib/unit-pelaporan";

/** Nama program: 3–40 huruf, bukan sekadar spasi. */
const MIN_NAMA = 3;
const MAKS_NAMA = 40;

function segarkan() {
  revalidatePath("/tim");
  revalidatePath("/tim/program");
  revalidatePath("/tim/struktur");
}

/**
 * Menambah program pada sebuah unit.
 *
 * Program menempel pada unit, bukan berdiri sendiri: "Reguler" di
 * Affiliator dan "Reguler" di MCN adalah dua hal berbeda, dan database
 * memang hanya melarang nama yang sama DALAM satu unit (migrasi 0001).
 */
export async function tambahProgram(input: {
  nama: string;
  unitKode: string;
}): Promise<Hasil> {
  const nama = input.nama.trim();
  if (nama.length < MIN_NAMA || nama.length > MAKS_NAMA) {
    return gagal(`Nama program ${MIN_NAMA}–${MAKS_NAMA} huruf.`, "validasi");
  }
  if (!kodeUnitSah(input.unitKode)) {
    return gagal("Unit tidak dikenali.", "validasi");
  }

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaProgram(pengguna)) {
    return gagal("Hanya CEO atau Manager yang mengelola program.", "izin");
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { data: unit, error: galatUnit } = await sb
    .from("units")
    .select("id")
    .eq("kode", input.unitKode)
    .maybeSingle();

  if (galatUnit) return gagal(`Gagal memeriksa unit: ${galatUnit.message}`);
  if (!unit) return gagal("Unit tidak ditemukan.", "validasi");

  const { error } = await sb
    .from("programs")
    .insert({ nama, unit_id: unit.id });

  if (error) {
    if (error.code === "23505") {
      return gagal(
        `Unit itu sudah punya program bernama "${nama}".`,
        "validasi",
      );
    }
    return error.code === "42501"
      ? gagal("Kamu tidak berhak menambah program.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkan();
  return sukses(undefined, `Program ${nama} ditambahkan.`);
}

/**
 * Menghidupkan atau menonaktifkan program.
 *
 * Bukan penghapusan: anggota dan akun yang pernah memakainya tetap
 * menunjuk baris ini, dan menghapusnya akan memutus riwayat mereka.
 * Program nonaktif hilang dari pilihan form, tapi tetap terbaca pada
 * data lama.
 */
export async function ubahStatusProgram(input: {
  programId: string;
  aktif: boolean;
}): Promise<Hasil> {
  if (!input.programId) return gagal("Program tidak dikenali.", "validasi");

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaProgram(pengguna)) {
    return gagal("Hanya CEO atau Manager yang mengelola program.", "izin");
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb
    .from("programs")
    .update({ aktif: input.aktif })
    .eq("id", input.programId);

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah program ini.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkan();
  return sukses(
    undefined,
    input.aktif
      ? "Program diaktifkan dan kembali muncul di pilihan."
      : "Program dinonaktifkan; data lama yang memakainya tetap utuh.",
  );
}
