"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import {
  LABEL_STATUS_ASET,
  periksaAset,
  periksaPerpindahanAset,
  type MasukanAset,
  type MasukanPerpindahanAset,
} from "@/lib/aset";
import { bolehKelolaAset, daftarAset, kodeBerikutnya } from "@/lib/data/aset";
import type { KodeUnit } from "@/lib/types";

function segarkan() {
  revalidatePath("/aset");
  revalidatePath("/aset/riwayat");
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
 * Catat aset baru.
 *
 * Aset yang lahir dari transaksi dibuatkan basis data sendiri (migrasi
 * 0105); jalur ini untuk barang yang sudah ada sebelum modul Keuangan
 * menyala, atau yang diperoleh di luar pembelian — hibah, misalnya.
 */
export async function tambahAset(input: MasukanAset): Promise<Hasil> {
  const salah = periksaAset(input);
  if (salah) return gagal(salah, "validasi");

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAset(pengguna)) {
    return gagal(
      "Hanya Finance, Manager, atau CEO yang mencatat aset.",
      "izin",
    );
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  const kode = input.kode.trim() || (await kodeBerikutnya());
  const sb = await klienServer();
  const { error } = await sb.from("assets").insert({
    kode,
    nama: input.nama.trim(),
    kategori: input.kategori.trim(),
    unit_id: await idUnit(input.unitKode),
    tanggal: input.tanggal,
    nilai_perolehan: input.nilaiPerolehan,
    masa_manfaat: input.masaManfaat,
    residu: input.residu,
    lokasi: input.lokasi.trim(),
    catatan: input.catatan.trim(),
  });

  if (error) return gagal(`Gagal menyimpan aset: ${error.message}`);

  segarkan();
  return sukses(undefined, `${kode} tercatat sebagai aset perusahaan.`);
}

/**
 * Perbaiki data aset.
 *
 * Statusnya tidak ikut: ia hanya berubah lewat pencatatan perpindahan
 * (migrasi 0102), supaya keadaan barang dan jejaknya tidak berselisih.
 * Perubahan nilai dan masa manfaat meninggalkan jejak audit (0104) —
 * keduanya menulis ulang nilai buku secara surut.
 */
export async function ubahAset(
  asetId: string,
  input: MasukanAset,
): Promise<Hasil> {
  if (!asetId) return gagal("Aset tidak dikenali.", "validasi");

  const salah = periksaAset(input);
  if (salah) return gagal(salah, "validasi");

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAset(pengguna)) {
    return gagal(
      "Hanya Finance, Manager, atau CEO yang mengubah data aset.",
      "izin",
    );
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb
    .from("assets")
    .update({
      nama: input.nama.trim(),
      kategori: input.kategori.trim(),
      unit_id: await idUnit(input.unitKode),
      tanggal: input.tanggal,
      nilai_perolehan: input.nilaiPerolehan,
      masa_manfaat: input.masaManfaat,
      residu: input.residu,
      lokasi: input.lokasi.trim(),
      catatan: input.catatan.trim(),
    })
    .eq("id", asetId);

  if (error) return gagal(`Gagal mengubah aset: ${error.message}`);

  segarkan();
  return sukses(undefined, "Data aset diperbarui.");
}

/**
 * Catat perpindahan pemegang atau keadaan sebuah aset.
 *
 * Disimpan sebagai kejadian, bukan sebagai penyuntingan status: basis
 * data memang hanya menerima perubahan lewat jalur itu (migrasi 0102),
 * sehingga keadaan barang selalu cocok dengan riwayatnya.
 */
export async function catatPerpindahanAset(
  input: MasukanPerpindahanAset,
): Promise<Hasil> {
  if (!input.asetId) return gagal("Aset tidak dikenali.", "validasi");

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAset(pengguna)) {
    return gagal(
      "Hanya Finance, Manager, atau CEO yang boleh mengubah pemegang aset.",
      "izin",
    );
  }

  const aset = (await daftarAset(pengguna)).find((a) => a.id === input.asetId);
  if (!aset) return gagal("Aset tidak ditemukan.", "validasi");

  const salah = periksaPerpindahanAset(input, aset);
  if (salah) return gagal(salah, "validasi");

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb.from("asset_events").insert({
    asset_id: input.asetId,
    ke: input.ke,
    oleh_id: pengguna.id,
    pemegang_id: input.pemegangId,
    lokasi: input.lokasi.trim(),
    catatan: input.catatan.trim(),
  });

  if (error) return gagal(`Gagal mencatat perpindahan: ${error.message}`);

  segarkan();
  revalidatePath(`/aset/${aset.kode}`);

  const keadaan =
    input.ke === aset.status
      ? "pindah tangan"
      : `menjadi ${LABEL_STATUS_ASET[input.ke].toLowerCase()}`;

  return sukses(undefined, `Perpindahan ${aset.kode} (${keadaan}) tercatat.`);
}
