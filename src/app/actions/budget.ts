"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import {
  anggaranBentrok,
  judulAnggaran,
  periksaAnggaran,
  type MasukanAnggaran,
} from "@/lib/budget";
import { daftarAnggaran, idUnitDariKode } from "@/lib/data/budget";
import { bolehLihatKeuangan } from "@/lib/keuangan";

/**
 * Menetapkan atau membetulkan pagu anggaran.
 *
 * Satu pos (periode + unit + jenis) hanya boleh punya satu pagu; itu
 * dijaga dua kali — di sini supaya pesannya bisa dibaca manusia, dan
 * oleh unique constraint di database supaya dua penyimpanan bersamaan
 * tidak bisa menyelinap di antara pemeriksaan dan penulisan.
 */
export async function simpanAnggaran(
  input: MasukanAnggaran,
  anggaranId?: string,
): Promise<Hasil> {
  const salah = periksaAnggaran(input);
  if (salah) return gagal(salah, "validasi");

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehLihatKeuangan(pengguna.role)) {
    return gagal(
      "Hanya Finance, Manager, atau CEO yang menetapkan anggaran.",
      "izin",
    );
  }

  const semua = await daftarAnggaran(pengguna);
  if (anggaranId && !semua.some((a) => a.id === anggaranId)) {
    return gagal("Anggaran tidak ditemukan.", "validasi");
  }
  if (anggaranBentrok(semua, input, anggaranId)) {
    return gagal(
      "Pos itu sudah punya pagu untuk periode ini. Betulkan pagunya, jangan tambah baris baru.",
      "validasi",
    );
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const unitId = await idUnitDariKode(input.unitKode);
  if (input.unitKode !== null && unitId === null) {
    return gagal("Unit tidak dikenali.", "validasi");
  }

  const baris = {
    periode: input.periode,
    unit_id: unitId,
    jenis: input.jenis,
    jumlah: input.jumlah,
    catatan: input.catatan,
  };

  const { error } = anggaranId
    ? await sb.from("budgets").update(baris).eq("id", anggaranId)
    : await sb.from("budgets").insert({ ...baris, dibuat_oleh: pengguna.id });

  if (error) {
    // 23505 = unique violation: ada yang menyimpan pos yang sama lebih
    // dulu, di antara pemeriksaan di atas dan penulisan ini.
    if (error.code === "23505") {
      return gagal(
        "Pos itu baru saja diberi pagu oleh orang lain. Muat ulang halamannya, lalu betulkan pagunya.",
        "validasi",
      );
    }
    return error.code === "42501"
      ? gagal("Kamu tidak berhak menetapkan anggaran.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkan();

  const nama = judulAnggaran({
    ...input,
    id: anggaranId ?? "",
    unitNama: input.unitKode ?? "Perusahaan",
    disetujuiNama: null,
  });

  return sukses(
    undefined,
    anggaranId ? `Pagu ${nama} diperbarui.` : `Pagu ${nama} ditetapkan.`,
  );
}

function segarkan() {
  revalidatePath("/keuangan/budget");
  revalidatePath("/keuangan/budget/riwayat");
}
