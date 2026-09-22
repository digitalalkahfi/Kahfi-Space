"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import type { SumberKpi } from "@/lib/kpi";

function segarkanKpi() {
  revalidatePath("/grd");
  revalidatePath("/grd/kpi");
  revalidatePath("/grd/scorecard");
}

/**
 * Kunci KPI satu bulan menjadi snapshot permanen.
 *
 * Tidak ada jalan membatalkan: begitu terkunci, trigger database menolak
 * setiap perubahan maupun penghapusan. Karena itu database juga menolak
 * bulan yang belum selesai dan bulan yang belum berdata — pesan galatnya
 * diteruskan apa adanya supaya alasannya jelas di layar.
 */
export async function kunciKpiBulan(bulan: string): Promise<Hasil<number>> {
  if (!/^\d{4}-\d{2}-01$/.test(bulan)) {
    return gagal("Periode harus tanggal 1 sebuah bulan.", "validasi");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (pengguna.role !== "CEO" && pengguna.role !== "Manager") {
    return gagal("Hanya CEO atau Manager yang boleh mengunci KPI.", "izin");
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("kunci_kpi_bulan", { p_bulan: bulan });

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengunci KPI.", "izin")
      : gagal(error.message, "validasi");
  }

  revalidatePath("/grd");
  revalidatePath("/grd/scorecard");

  const jumlah = Number(data ?? 0);
  return sukses(
    jumlah,
    jumlah > 0
      ? `${jumlah} skor KPI dikunci dan tidak bisa diubah lagi.`
      : "Semua skor bulan ini sudah terkunci sebelumnya.",
  );
}

/** Indikator KPI hanya disusun CEO/Manager — sejalan `kpi_def_kelola`. */
function bolehKelola(peran: string) {
  return peran === "CEO" || peran === "Manager";
}

function periksaTarget(input: {
  targetBase: number;
  targetGoal: number;
  targetStretch: number;
}): string | null {
  for (const [nama, nilai] of [
    ["Target base", input.targetBase],
    ["Target goal", input.targetGoal],
    ["Target stretch", input.targetStretch],
  ] as const) {
    if (!Number.isFinite(nilai)) return `${nama} tidak sah.`;
  }
  return input.targetBase <= input.targetGoal &&
    input.targetGoal <= input.targetStretch
    ? null
    : "Target harus menanjak: base ≤ goal ≤ stretch.";
}

/** Total bobot indikator aktif sebuah jabatan, untuk diberitahukan ke layar. */
async function totalBobot(
  sb: Awaited<ReturnType<typeof klienServer>>,
  jabatan: string,
) {
  const { data } = await sb
    .from("kpi_definitions")
    .select("bobot")
    .eq("jabatan", jabatan)
    .eq("aktif", true);

  return (data ?? []).reduce((a, d) => a + Number(d.bobot), 0);
}

function catatanBobot(jabatan: string, total: number) {
  return Math.abs(total - 100) < 0.01
    ? ""
    : ` Bobot ${jabatan} kini ${total.toLocaleString("id-ID")} — belum genap 100.`;
}

export type MasukanIndikatorKpi = {
  jabatan: string;
  namaKpi: string;
  bobot: number;
  satuan: string;
  targetBase: number;
  targetGoal: number;
  targetStretch: number;
  sumberData: SumberKpi;
};

/**
 * Menambah indikator KPI sebuah jabatan.
 *
 * Bobot sengaja tidak dipaksa berjumlah 100 saat disimpan: menyusun ulang
 * satu jabatan selalu melewati keadaan setengah jadi. Totalnya dikembalikan
 * dalam pesan supaya ketimpangan terlihat, bukan tersembunyi.
 */
export async function tambahIndikatorKpi(
  input: MasukanIndikatorKpi,
): Promise<Hasil> {
  const nama = input.namaKpi.trim();
  const jabatan = input.jabatan.trim();
  if (nama.length < 3) return gagal("Nama indikator minimal 3 huruf.", "validasi");
  if (!jabatan) return gagal("Jabatan tidak boleh kosong.", "validasi");
  if (!Number.isFinite(input.bobot) || input.bobot <= 0 || input.bobot > 100) {
    return gagal("Bobot antara 1 sampai 100.", "validasi");
  }
  const salah = periksaTarget(input);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelola(pengguna.role)) {
    return gagal("Hanya CEO atau Manager yang boleh menyusun KPI.", "izin");
  }

  const sb = await klienServer();
  const { error } = await sb.from("kpi_definitions").insert({
    jabatan,
    nama_kpi: nama,
    bobot: input.bobot,
    satuan: input.satuan.trim() || "unit",
    target_base: input.targetBase,
    target_goal: input.targetGoal,
    target_stretch: input.targetStretch,
    sumber_data: input.sumberData,
  });

  if (error) {
    if (error.code === "23505") {
      return gagal(`Indikator "${nama}" sudah ada untuk ${jabatan}.`, "validasi");
    }
    return error.code === "42501"
      ? gagal("Kamu tidak berhak menyusun KPI.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkanKpi();
  const total = await totalBobot(sb, jabatan);
  return sukses(
    undefined,
    `Indikator "${nama}" ditambahkan.${catatanBobot(jabatan, total)}`,
  );
}

/** Mengubah bobot dan tangga target sebuah indikator. */
export async function ubahIndikatorKpi(input: {
  indikatorId: string;
  bobot: number;
  targetBase: number;
  targetGoal: number;
  targetStretch: number;
}): Promise<Hasil> {
  if (!input.indikatorId) return gagal("Indikator tidak dikenali.", "validasi");
  if (!Number.isFinite(input.bobot) || input.bobot <= 0 || input.bobot > 100) {
    return gagal("Bobot antara 1 sampai 100.", "validasi");
  }
  const salah = periksaTarget(input);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelola(pengguna.role)) {
    return gagal("Hanya CEO atau Manager yang boleh mengubah KPI.", "izin");
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("kpi_definitions")
    .update({
      bobot: input.bobot,
      target_base: input.targetBase,
      target_goal: input.targetGoal,
      target_stretch: input.targetStretch,
    })
    .eq("id", input.indikatorId)
    .select("jabatan")
    .maybeSingle();

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah KPI.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }
  if (!data) return gagal("Indikator tidak ditemukan.", "validasi");

  segarkanKpi();
  const total = await totalBobot(sb, data.jabatan);
  return sukses(
    undefined,
    `Indikator diperbarui.${catatanBobot(data.jabatan, total)}`,
  );
}

/**
 * Menonaktifkan atau menghidupkan kembali sebuah indikator.
 *
 * Bukan penghapusan: snapshot bulan yang sudah dikunci menyimpan rinciannya
 * sendiri, tetapi bulan berjalan langsung dihitung ulang tanpa indikator
 * ini — karena itu pesannya menyebut akibat tersebut apa adanya.
 */
export async function ubahAktifIndikatorKpi(
  indikatorId: string,
  aktif: boolean,
): Promise<Hasil> {
  if (!indikatorId) return gagal("Indikator tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelola(pengguna.role)) {
    return gagal("Hanya CEO atau Manager yang boleh mengubah KPI.", "izin");
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("kpi_definitions")
    .update({ aktif })
    .eq("id", indikatorId)
    .select("jabatan, nama_kpi")
    .maybeSingle();

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah KPI.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }
  if (!data) return gagal("Indikator tidak ditemukan.", "validasi");

  segarkanKpi();
  const total = await totalBobot(sb, data.jabatan);
  return sukses(
    undefined,
    aktif
      ? `"${data.nama_kpi}" dihitung lagi mulai bulan berjalan.${catatanBobot(data.jabatan, total)}`
      : `"${data.nama_kpi}" tidak lagi dihitung mulai bulan berjalan; bulan yang sudah dikunci tidak berubah.${catatanBobot(data.jabatan, total)}`,
  );
}
