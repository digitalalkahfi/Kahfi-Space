"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import {
  izinPutusAlokasi,
  periksaAlokasi,
  perpindahanAlokasiSah,
  type MasukanAlokasi,
} from "@/lib/budget";
import { daftarAlokasi } from "@/lib/data/budget";
import { rupiahPenuh } from "@/lib/format";

/**
 * Mengajukan tambahan pagu untuk satu pos anggaran.
 *
 * Statusnya selalu 'diajukan' — tidak bisa dikirim sebagai sudah
 * disetujui, sekali pun yang mengirim seorang CEO. Pagu yang bisa
 * dinaikkan sendiri oleh yang membelanjakannya bukan anggaran,
 * melainkan saran.
 *
 * BELUM MENYIMPAN: tabel alokasi menyusul di lapisan backend Fase 3;
 * yang dikerjakan di sini pemeriksaan isian dan wewenangnya.
 */
export async function ajukanAlokasi(input: MasukanAlokasi): Promise<Hasil> {
  const salah = periksaAlokasi(input);
  if (salah) return gagal(salah, "validasi");

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  // Siapa pun yang memimpin belanja unitnya boleh mengajukan; yang
  // memutuskan orang lain (PRD Fase 3: persetujuan berjenjang).
  const bolehAjukan = [
    "CEO",
    "Manager",
    "Finance",
    "Leader",
    "Co-Leader",
  ].includes(pengguna.role);

  if (!bolehAjukan) {
    return gagal(
      "Pengajuan alokasi diajukan Leader ke atas; sampaikan lewat atasanmu.",
      "izin",
    );
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  revalidatePath("/keuangan/budget");

  return sukses(
    undefined,
    `Pengajuan ${rupiahPenuh(input.jumlah)} sudah sah dan berstatus diajukan, tetapi belum tersimpan: tabel alokasi menyusul di lapisan backend.`,
  );
}

/**
 * Memutuskan pengajuan alokasi: disetujui atau ditolak.
 *
 * Penolakan wajib beralasan — pengajuan yang ditolak tanpa keterangan
 * hanya akan diajukan ulang apa adanya. Aturan berjenjangnya sendiri
 * ada di `izinPutusAlokasi` supaya layar dan server memakai ukuran yang
 * sama.
 *
 * BELUM MENYIMPAN: tabel alokasi menyusul di lapisan backend Fase 3.
 */
export async function putuskanAlokasi(input: {
  alokasiId: string;
  keputusan: "disetujui" | "ditolak";
  catatan?: string;
}): Promise<Hasil> {
  if (!input.alokasiId) return gagal("Pengajuan tidak dikenali.", "validasi");

  const catatan = (input.catatan ?? "").trim();
  if (input.keputusan === "ditolak" && catatan.length < 10) {
    return gagal(
      "Sebutkan alasan penolakan (minimal 10 huruf) supaya pengajunya tahu apa yang perlu diperbaiki.",
      "validasi",
    );
  }

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const alokasi = (await daftarAlokasi(pengguna)).find(
    (a) => a.id === input.alokasiId,
  );
  if (!alokasi) return gagal("Pengajuan tidak ditemukan.", "validasi");

  if (!perpindahanAlokasiSah(alokasi.status, input.keputusan)) {
    return gagal(
      `Pengajuan berstatus ${alokasi.status} tidak bisa diputuskan lagi.`,
      "validasi",
    );
  }

  const izin = izinPutusAlokasi(pengguna.role, pengguna.nama, alokasi);
  if (!izin.bolehPutuskan) return gagal(izin.alasan, "izin");

  if (modeData() === "demo") return BALASAN_DEMO;

  revalidatePath("/keuangan/budget");

  return sukses(
    undefined,
    `Keputusan "${input.keputusan}" sah dan berwenang, tetapi belum tersimpan: tabel alokasi menyusul di lapisan backend.`,
  );
}
