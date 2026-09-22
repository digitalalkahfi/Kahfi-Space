"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import {
  bolehLihatKeuangan,
  izinPersetujuan,
  penyetujuiWajib,
  periksaTransaksi,
  perpindahanSah,
  ringkasKeuangan,
  statusAwal,
  type MasukanTransaksi,
  type StatusTransaksi,
} from "@/lib/keuangan";
import { daftarTransaksi, kasAwal } from "@/lib/data/keuangan";
import type { KodeUnit } from "@/lib/types";

function segarkan() {
  revalidatePath("/keuangan");
  revalidatePath("/keuangan/laporan");
  revalidatePath("/keuangan/waterfall");
  revalidatePath("/beranda");
}

/** Id unit dari kodenya; RLS unit terbuka untuk semua yang login. */
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

async function idAkun(username: string | null) {
  if (!username) return null;
  const sb = await klienServer();
  const { data } = await sb
    .from("accounts")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Catat transaksi keuangan.
 *
 * Status awalnya tidak dikirim dari sini: basis data yang menentukannya
 * (migrasi 0097), supaya jalur mana pun tunduk pada aturan yang sama.
 * Yang dikerjakan di sini pemeriksaan isian dan penerjemahan kode unit
 * atau username akun menjadi id.
 */
export async function catatTransaksi(
  input: MasukanTransaksi,
): Promise<Hasil<{ penyetuju: "CEO" | "Manager" }>> {
  const salah = periksaTransaksi(input);
  if (salah) return gagal(salah, "validasi");

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehLihatKeuangan(pengguna.role)) {
    return gagal(
      "Hanya Finance, Manager, atau CEO yang boleh mencatat transaksi.",
      "izin",
    );
  }

  const transaksi = await daftarTransaksi(pengguna);
  const ringkas = ringkasKeuangan(transaksi, await kasAwal());
  const penyetuju = penyetujuiWajib(ringkas.saldoKas);

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb.from("transactions").insert({
    tanggal: input.tanggal,
    arah: input.arah,
    jenis: input.jenis,
    unit_id: await idUnit(input.unitKode),
    account_id: await idAkun(input.akunUsername),
    keterangan: input.keterangan.trim(),
    jumlah: input.jumlah,
    diajukan_id: pengguna.id,
  });

  if (error) return gagal(`Gagal menyimpan transaksi: ${error.message}`);

  segarkan();

  return sukses(
    { penyetuju },
    input.arah === "masuk"
      ? "Pemasukan tercatat dan langsung masuk posisi kas."
      : `Pengajuan tercatat dan menunggu persetujuan ${penyetuju} (status awal: ${statusAwal(input.arah)}).`,
  );
}

/**
 * Perbaiki transaksi yang masih menunggu keputusan.
 *
 * Setelah diputuskan, isinya terkunci di basis data (migrasi 0097):
 * menaikkan nominal sesudah disetujui adalah cara paling mudah membuat
 * persetujuan kehilangan arti.
 */
export async function ubahTransaksi(
  transaksiId: string,
  input: MasukanTransaksi,
): Promise<Hasil> {
  if (!transaksiId) return gagal("Transaksi tidak dikenali.", "validasi");

  const salah = periksaTransaksi(input);
  if (salah) return gagal(salah, "validasi");

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehLihatKeuangan(pengguna.role)) {
    return gagal(
      "Hanya Finance, Manager, atau CEO yang boleh mengubah transaksi.",
      "izin",
    );
  }

  const transaksi = await daftarTransaksi(pengguna);
  const satu = transaksi.find((t) => t.id === transaksiId);
  if (!satu) return gagal("Transaksi tidak ditemukan.", "validasi");
  if (satu.status !== "diajukan") {
    return gagal(
      "Transaksi yang sudah diputuskan tidak bisa diubah; ajukan yang baru bila keliru.",
      "validasi",
    );
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb
    .from("transactions")
    .update({
      tanggal: input.tanggal,
      arah: input.arah,
      jenis: input.jenis,
      unit_id: await idUnit(input.unitKode),
      account_id: await idAkun(input.akunUsername),
      keterangan: input.keterangan.trim(),
      jumlah: input.jumlah,
    })
    .eq("id", transaksiId);

  if (error) return gagal(`Gagal mengubah transaksi: ${error.message}`);

  segarkan();
  return sukses(
    undefined,
    "Pengajuan diperbarui dan masih menunggu keputusan.",
  );
}

/**
 * Putuskan sebuah pengajuan pengeluaran.
 *
 * Keputusannya dicatat sebagai baris persetujuan, bukan sebagai
 * penyuntingan status (migrasi 0098): status transaksi memang hanya
 * berubah lewat jalur itu, sehingga keadaan dan jejaknya tidak pernah
 * berselisih. Aturan PRD §4 — ambang kas CEO dan larangan menyetujui
 * pengajuan sendiri — dijaga basis data; pemeriksaan di sini hanya
 * supaya pesannya bisa dibaca sebelum orang menekan tombol.
 */
export async function putuskanPengeluaran(input: {
  transaksiId: string;
  keputusan: "disetujui" | "ditolak" | "dibayar";
  catatan?: string;
}): Promise<Hasil> {
  if (!input.transaksiId) return gagal("Transaksi tidak dikenali.", "validasi");
  if (
    input.keputusan === "ditolak" &&
    (input.catatan ?? "").trim().length < 10
  ) {
    return gagal(
      "Sebutkan alasan penolakan (minimal 10 huruf) supaya pengajunya tahu apa yang perlu diperbaiki.",
      "validasi",
    );
  }

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehLihatKeuangan(pengguna.role)) {
    return gagal(
      "Hanya Finance, Manager, atau CEO yang berurusan dengan pengajuan ini.",
      "izin",
    );
  }

  const transaksi = await daftarTransaksi(pengguna);
  const satu = transaksi.find((t) => t.id === input.transaksiId);
  if (!satu) return gagal("Transaksi tidak ditemukan.", "validasi");

  if (!perpindahanSah(satu.status, input.keputusan as StatusTransaksi)) {
    return gagal(
      `Pengajuan berstatus ${satu.status} tidak bisa diubah menjadi ${input.keputusan}.`,
      "validasi",
    );
  }

  const ringkas = ringkasKeuangan(transaksi, await kasAwal());

  // Membayar adalah pelaksanaan keputusan orang lain, bukan persetujuan:
  // Finance boleh membayar pengajuan yang ia tulis sendiri.
  if (input.keputusan !== "dibayar") {
    const pengajuId = await idPengaju(input.transaksiId, satu.diajukanNama);
    const izin = izinPersetujuan(
      pengguna.role,
      pengguna.id,
      pengajuId,
      ringkas.saldoKas,
    );
    if (!izin.bolehPutuskan) return gagal(izin.alasan, "izin");
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb.from("transaction_approvals").insert({
    transaction_id: input.transaksiId,
    ke: input.keputusan,
    oleh_id: pengguna.id,
    catatan: (input.catatan ?? "").trim(),
  });

  if (error) return gagal(`Gagal mencatat keputusan: ${error.message}`);

  segarkan();

  return sukses(
    undefined,
    input.keputusan === "dibayar"
      ? "Pembayaran tercatat; posisi kas sudah ikut bergerak."
      : `Keputusan "${input.keputusan}" tercatat beserta jejaknya.`,
  );
}

/**
 * Id pengaju sebuah transaksi.
 *
 * Mode demo belum menyimpan id pengaju, hanya namanya; di sana nama
 * dipakai sebagai penggantinya supaya aturan "tidak menyetujui
 * pengajuan sendiri" tetap berlaku dan tetap teruji.
 */
async function idPengaju(transaksiId: string, namaPengaju: string | null) {
  if (modeData() === "demo") {
    const pengguna = await sesiSaatIni();
    return pengguna && namaPengaju === pengguna.nama ? pengguna.id : null;
  }

  const sb = await klienServer();
  const { data } = await sb
    .from("transactions")
    .select("diajukan_id")
    .eq("id", transaksiId)
    .maybeSingle();
  return data?.diajukan_id ?? null;
}
