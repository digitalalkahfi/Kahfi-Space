"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import {
  izinPutusAlokasi,
  periksaAlokasi,
  perpindahanAlokasiSah,
  type MasukanAlokasi,
} from "@/lib/budget";
import { daftarAlokasi, idUnitDariKode } from "@/lib/data/budget";
import { rupiahPenuh } from "@/lib/format";

/**
 * Mengajukan tambahan pagu untuk satu pos anggaran.
 *
 * Statusnya selalu 'diajukan' — tidak bisa dikirim sebagai sudah
 * disetujui, sekali pun yang mengirim seorang CEO. Pagu yang bisa
 * dinaikkan sendiri oleh yang membelanjakannya bukan anggaran,
 * melainkan saran.
 *
 * Statusnya tidak dikirim dari sini melainkan dibiarkan pada nilai
 * bawaan tabelnya, dan RLS pun menolak insert dengan status selain
 * 'diajukan' (migrasi 0148) — dua pagar untuk satu aturan.
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

  const sb = await klienServer();
  const unitId = await idUnitDariKode(input.unitKode);
  if (input.unitKode !== null && unitId === null) {
    return gagal("Unit tidak dikenali.", "validasi");
  }

  const { error } = await sb.from("budget_allocations").insert({
    periode: input.periode,
    unit_id: unitId,
    jenis: input.jenis,
    jumlah: input.jumlah,
    alasan: input.alasan.trim(),
    diajukan_id: pengguna.id,
  });

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengajukan alokasi.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkan();

  return sukses(
    undefined,
    `Pengajuan ${rupiahPenuh(input.jumlah)} terkirim dan menunggu keputusan.`,
  );
}

function segarkan() {
  revalidatePath("/keuangan/budget");
  revalidatePath("/keuangan/budget/riwayat");
}

/**
 * Memutuskan pengajuan alokasi: disetujui atau ditolak.
 *
 * Penolakan wajib beralasan — pengajuan yang ditolak tanpa keterangan
 * hanya akan diajukan ulang apa adanya. Aturan berjenjangnya sendiri
 * ada di `izinPutusAlokasi` supaya layar dan server memakai ukuran yang
 * sama.
 *
 * Pemeriksaan di sini ada supaya pesannya bisa dibaca manusia; yang
 * benar-benar menutup pintunya tetap database — trigger menolak
 * keputusan ulang dan keputusan atas pengajuan sendiri (migrasi 0148).
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

  const sb = await klienServer();
  const { error } = await sb
    .from("budget_allocations")
    .update({
      status: input.keputusan,
      diputuskan_id: pengguna.id,
      diputuskan_pada: new Date().toISOString(),
      catatan_keputusan: catatan,
    })
    .eq("id", input.alokasiId)
    // Hanya yang masih menunggu; kalau ada yang memutuskan lebih dulu,
    // yang kedua tidak menimpa keputusan pertama.
    .eq("status", "diajukan");

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak memutuskan pengajuan ini.", "izin")
      : gagal(error.message, "validasi");
  }

  segarkan();

  return sukses(
    undefined,
    input.keputusan === "disetujui"
      ? "Pengajuan disetujui; pagunya bertambah pada periode itu."
      : "Pengajuan ditolak beserta alasannya.",
  );
}
