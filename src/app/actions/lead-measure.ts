"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { bolehKelolaLeadMeasure } from "@/lib/data/grd";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";

function segarkan() {
  revalidatePath("/grd");
  revalidatePath("/grd/lead-measure");
}

/**
 * Batas 3 lead measure per goal dan syarat angka pendukung ditegakkan
 * trigger; pesannya sudah berbahasa Indonesia, jadi diteruskan apa adanya.
 */
function terjemahkan(galat: { code?: string; message: string }): Hasil {
  if (galat.code === "42501") {
    return gagal("Kamu tidak berhak mengubah lead measure ini.", "izin");
  }
  if (galat.code === "23514" || galat.code === "P0001") {
    return gagal(galat.message, "validasi");
  }
  return gagal(`Gagal menyimpan: ${galat.message}`);
}

/**
 * Catat realisasi harian sebuah lead measure.
 * Satu entri per (lead measure, tanggal) — mengisi ulang memperbarui, bukan
 * menambah, supaya papan skor tidak dobel.
 */
export async function catatLeadMeasure(input: {
  leadId: string;
  tanggal: string;
  nilai: number;
  nilaiPendukung?: number | null;
  catatan?: string;
}): Promise<Hasil> {
  if (!Number.isFinite(input.nilai) || input.nilai < 0) {
    return gagal("Nilai realisasi tidak sah.", "validasi");
  }
  if (input.nilai > 1_000_000) {
    return gagal("Nilai di luar batas wajar, periksa lagi.", "validasi");
  }
  const pendukung = input.nilaiPendukung ?? null;
  if (pendukung !== null && (!Number.isFinite(pendukung) || pendukung < 0)) {
    return gagal("Angka pendukung tidak sah.", "validasi");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { error } = await sb.from("lead_measure_entries").upsert(
    {
      lead_measure_id: input.leadId,
      user_id: pengguna.id,
      tanggal: input.tanggal,
      nilai: input.nilai,
      nilai_pendukung: pendukung,
      catatan: input.catatan?.trim() ?? "",
    },
    { onConflict: "lead_measure_id,tanggal" },
  );

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengisi lead measure ini.", "izin")
      : terjemahkan(error);
  }

  segarkan();
  return sukses(undefined, "Realisasi harian tersimpan.");
}

/**
 * Menambah lead measure sebuah goal.
 *
 * PRD membatasi 1–3 langkah kunci per goal; batasnya dijaga trigger
 * `batasi_lead_measure`, jadi pesannya datang dari database dan tetap sama
 * lewat jalur mana pun.
 */
export async function tambahLeadMeasure(input: {
  goalId: string;
  judul: string;
  satuan: string;
  targetMingguan: number;
  /** Nama angka pendamping, mis. "Peserta hadir MMC". Kosongkan bila tak ada. */
  labelPendukung?: string | null;
}): Promise<Hasil<string>> {
  const judul = input.judul.trim();
  if (judul.length < 3) return gagal("Judul minimal 3 huruf.", "validasi");
  if (!input.goalId) return gagal("Goal tidak dikenali.", "validasi");
  if (!Number.isFinite(input.targetMingguan) || input.targetMingguan <= 0) {
    return gagal("Target mingguan harus lebih dari nol.", "validasi");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaLeadMeasure(pengguna)) {
    return gagal(
      "Hanya CEO atau Manager yang boleh menyusun lead measure.",
      "izin",
    );
  }

  const sb = await klienServer();
  const { count } = await sb
    .from("lead_measures")
    .select("id", { count: "exact", head: true })
    .eq("goal_id", input.goalId)
    .eq("aktif", true);

  const { data, error } = await sb
    .from("lead_measures")
    .insert({
      goal_id: input.goalId,
      judul,
      satuan: input.satuan.trim() || "unit",
      target_mingguan: input.targetMingguan,
      label_pendukung: input.labelPendukung?.trim() || null,
      urutan: (count ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error) return terjemahkan(error) as Hasil<string>;

  segarkan();
  return sukses(data.id, `Lead measure "${judul}" ditambahkan.`);
}

/** Mengubah target mingguan atau label angka pendukung sebuah lead measure. */
export async function ubahLeadMeasure(input: {
  leadId: string;
  targetMingguan: number;
  labelPendukung?: string | null;
}): Promise<Hasil> {
  if (!input.leadId) return gagal("Lead measure tidak dikenali.", "validasi");
  if (!Number.isFinite(input.targetMingguan) || input.targetMingguan <= 0) {
    return gagal("Target mingguan harus lebih dari nol.", "validasi");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaLeadMeasure(pengguna)) {
    return gagal(
      "Hanya CEO atau Manager yang boleh mengubah lead measure.",
      "izin",
    );
  }

  const sb = await klienServer();
  const { error } = await sb
    .from("lead_measures")
    .update({
      target_mingguan: input.targetMingguan,
      label_pendukung: input.labelPendukung?.trim() || null,
    })
    .eq("id", input.leadId);

  if (error) return terjemahkan(error);

  segarkan();
  return sukses(undefined, "Lead measure diperbarui.");
}

/**
 * Menonaktifkan lead measure. Entri hariannya tidak dihapus: papan skor
 * pekan-pekan lalu tetap bisa dibaca apa adanya, dan kuota tiga langkah
 * kunci per goal langsung terbebaskan.
 */
export async function nonaktifkanLeadMeasure(leadId: string): Promise<Hasil> {
  if (!leadId) return gagal("Lead measure tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaLeadMeasure(pengguna)) {
    return gagal(
      "Hanya CEO atau Manager yang boleh menutup lead measure.",
      "izin",
    );
  }

  const sb = await klienServer();
  const { error } = await sb
    .from("lead_measures")
    .update({ aktif: false })
    .eq("id", leadId);

  if (error) return terjemahkan(error);

  segarkan();
  return sukses(undefined, "Lead measure dinonaktifkan; entrinya tetap tersimpan.");
}
