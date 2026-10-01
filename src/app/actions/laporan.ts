"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import {
  BALASAN_DEMO,
  gagal,
  sukses,
  type Hasil,
  type KodeGagal,
} from "@/lib/data/hasil";
import {
  alasanTanggalLaporan,
  periksaIsiLaporan,
  type IsiLaporan,
  type KalenderLaporan,
} from "@/lib/laporan";
import {
  hariIniLaporan,
  kalenderLaporan,
  mulaiSasaranLaporan,
  sasaranUntuk,
  unitLaporan,
  unitSasaranLaporan,
} from "@/lib/data/laporan";
import type { KodeUnit } from "@/lib/types";

/**
 * Pesan yang bisa dibaca pelapor untuk pagar yang ditegakkan database.
 *
 * Nama constraint dan teks `raise` tidak boleh sampai ke layar: pelapor
 * tidak bisa berbuat apa-apa dengan "daily_reports_komisi_wajar". Yang
 * tidak dikenali tetap ditampilkan apa adanya supaya tidak ada kegagalan
 * yang hilang diam-diam.
 */
function pesanGalatLaporan(error: {
  code?: string;
  message: string;
}): [string, KodeGagal] {
  const cocok: [RegExp, string][] = [
    [/komisi_tak_lebih_dari_gmv/, "Komisi tidak mungkin melebihi GMV-nya."],
    [/komisi_wajar/, "Nilai komisi di luar batas wajar, periksa lagi."],
    [/upload_wajar/, "Jumlah upload di luar batas wajar, periksa lagi."],
    [/gmv_wajar/, "Nilai GMV di luar batas wajar, periksa lagi."],
    [/hanya melaporkan GMV/, error.message],
    [/bertanggal masa depan/, "Laporan tidak bisa bertanggal masa depan."],
  ];
  for (const [pola, pesan] of cocok) {
    if (pola.test(error.message)) return [pesan, "validasi"];
  }
  return [`Gagal menyimpan: ${error.message}`, "galat"];
}

/** Sasaran berbentuk "akun:<uuid>" atau "unit:<kode>". */
function uraikanSasaran(kunci: string) {
  const [jenis, nilai] = kunci.split(":");
  if (jenis !== "akun" && jenis !== "unit") return null;
  return { jenis, nilai } as const;
}

/**
 * Kirim laporan harian — satu-satunya tempat GMV masuk ke sistem.
 * Database memaksa satu laporan per (sasaran, tanggal).
 *
 * Tanggalnya boleh hari ini atau susulan untuk tanggal yang terlewat,
 * sejak sasarannya terdaftar di K-Space — aturan yang sama dengan
 * kalender di form.
 */
export async function kirimLaporanHarian(input: {
  sasaran: string;
  gmv: number;
  komisi?: number | null;
  jumlahUpload?: number | null;
  gmvLive?: number | null;
  jamLive?: number | null;
  catatan?: string;
  tanggal: string;
}): Promise<Hasil<{ id: string }>> {
  const sasaran = uraikanSasaran(input.sasaran);
  if (!sasaran) return gagal("Pilih akun atau unit dulu.", "validasi");
  const salahTanggal = alasanTanggalLaporan(
    input.tanggal,
    hariIniLaporan(),
    await mulaiSasaranLaporan(input.sasaran),
  );
  if (salahTanggal) return gagal(salahTanggal, "validasi");

  // Departemen sasaran menentukan kolom mana yang sah, dan pemeriksaannya
  // memakai fungsi yang sama dengan form — kiriman yang tidak lewat form
  // tidak boleh lolos dari aturan yang dilihat pelapor di layar.
  const isi: IsiLaporan = {
    gmv: input.gmv,
    komisi: input.komisi ?? null,
    jumlahUpload: input.jumlahUpload ?? null,
    gmvLive: input.gmvLive ?? null,
    jamLive: input.jamLive ?? null,
    catatan: input.catatan?.trim() ?? "",
  };
  const unit = await unitSasaranLaporan(input.sasaran);
  const salah = periksaIsiLaporan(unit, isi);
  if (salah) return gagal(salah, "validasi");

  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();

  let unitId: string | null = null;
  if (sasaran.jenis === "unit") {
    const { data } = await sb
      .from("units")
      .select("id")
      .eq("kode", sasaran.nilai as KodeUnit)
      .maybeSingle();
    if (!data) return gagal("Unit tidak dikenal.", "validasi");
    unitId = data.id;
  }

  const { data, error } = await sb
    .from("daily_reports")
    .insert({
      user_id: pengguna.id,
      tanggal: input.tanggal,
      account_id: sasaran.jenis === "akun" ? sasaran.nilai : null,
      unit_id: unitId,
      gmv: isi.gmv,
      komisi: isi.komisi,
      jumlah_upload: isi.jumlahUpload,
      gmv_live: isi.gmvLive ?? null,
      jam_live: isi.jamLive ?? null,
      catatan: isi.catatan,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return gagal(
        "Laporan untuk sasaran ini pada tanggal tersebut sudah ada. Perbaiki lewat Riwayat laporan bila angkanya keliru.",
        "validasi",
      );
    }
    if (error.code === "42501") {
      return gagal("Kamu bukan penanggung jawab sasaran ini.", "izin");
    }
    return gagal(...pesanGalatLaporan(error));
  }

  revalidatePath("/laporan-harian");
  revalidatePath("/beranda");
  return sukses({ id: data.id }, "Laporan harian terkirim.");
}

/**
 * Perbaiki angka GMV. Lewat RPC supaya alasan tercatat di jejak revisi
 * dalam satu transaksi — tidak ada jalan mengubah angka tanpa jejak.
 */
export async function perbaikiLaporan(input: {
  reportId: string;
  gmv: number;
  komisi?: number | null;
  jumlahUpload?: number | null;
  /** null = tidak diubah (0191). */
  gmvLive?: number | null;
  jamLive?: number | null;
  alasan: string;
  catatan?: string;
}): Promise<Hasil> {
  if (input.alasan.trim().length < 10) {
    return gagal("Alasan perbaikan minimal 10 karakter.", "validasi");
  }

  // Departemennya diambil dari laporan yang diperbaiki, bukan dari kiriman:
  // pemanggil tidak boleh menentukan sendiri kolom mana yang sah baginya.
  const unit = await unitLaporan(input.reportId);
  const salah = periksaIsiLaporan(unit, {
    gmv: input.gmv,
    komisi: input.komisi ?? null,
    jumlahUpload: input.jumlahUpload ?? null,
    gmvLive: input.gmvLive ?? null,
    jamLive: input.jamLive ?? null,
    catatan: input.catatan?.trim() ?? "",
  });
  if (salah) return gagal(salah, "validasi");

  // Pemeriksaan sesi yang sama dengan `kirimLaporanHarian`: tanpa ini,
  // sesi yang sudah kedaluwarsa akan memanggil RPC sebagai anon dan
  // mendapat pesan galat database, bukan pesan yang bisa dibaca orang.
  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb.rpc("perbaiki_laporan_harian", {
    p_report_id: input.reportId,
    p_gmv: input.gmv,
    p_komisi: input.komisi ?? null,
    p_jumlah_upload: input.jumlahUpload ?? null,
    p_gmv_live: input.gmvLive ?? null,
    p_jam_live: input.jamLive ?? null,
    p_alasan: input.alasan.trim(),
    p_catatan: input.catatan?.trim() ?? null,
  });

  if (error) {
    if (error.message.includes("bukan milikmu")) {
      return gagal("Laporan ini bukan milikmu.", "izin");
    }
    return gagal(...pesanGalatLaporan(error));
  }

  revalidatePath("/laporan-harian");
  revalidatePath("/laporan-harian/riwayat");
  revalidatePath("/beranda");
  return sukses(undefined, "Perbaikan tersimpan beserta jejaknya.");
}

/**
 * Isi kalender tanggal laporan untuk bulan lain, saat pelapor menggeser
 * bulan di pemilih tanggal. Sasarannya milik pengguna yang sedang masuk.
 */
export async function ambilKalenderLaporan(
  bulan: string,
  persona?: string,
): Promise<Hasil<KalenderLaporan>> {
  if (!/^\d{4}-\d{2}-01$/.test(bulan)) {
    return gagal("Bulan tidak dikenali.", "validasi");
  }
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const hariIni = hariIniLaporan();
  try {
    const sasaran = await sasaranUntuk(pengguna, hariIni);
    return sukses(await kalenderLaporan(bulan, hariIni, sasaran));
  } catch (e) {
    return gagal(e instanceof Error ? e.message : "Gagal memuat kalender.");
  }
}
