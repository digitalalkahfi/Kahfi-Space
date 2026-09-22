"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { bolehKelolaGoal } from "@/lib/data/goal";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import { anakTangga } from "@/lib/goal";
import type { LevelGoal } from "@/lib/goal";

function segarkan() {
  revalidatePath("/grd");
  revalidatePath("/grd/goal");
}

/**
 * Menerjemahkan galat database menjadi kalimat yang berarti bagi pemakai.
 * Aturan roll-down dan batas 3 goal ditegakkan trigger, jadi pesannya
 * datang apa adanya dari sana — di sini hanya dipilihkan nadanya.
 */
function terjemahkan<T>(galat: { code?: string; message: string }): Hasil<T> {
  if (galat.code === "42501") {
    return gagal("Hanya CEO atau Manager yang boleh mengelola goal.", "izin");
  }
  if (galat.code === "23514" || galat.code === "P0001") {
    return gagal(galat.message, "validasi");
  }
  return gagal(`Gagal menyimpan: ${galat.message}`);
}

export type MasukanGoal = {
  judul: string;
  level: LevelGoal;
  pemilikId: string;
  indukId: string | null;
  unitId: string | null;
  akunId: string | null;
  satuan: string;
  targetBase: number;
  targetGoal: number;
  targetStretch: number;
  periode: string;
  /** Bulan pertama anak tangga, mis. "2024-10-01". */
  mulaiBulan: string;
  jumlahBulan: number;
};

function periksa(input: MasukanGoal): string | null {
  if (input.judul.trim().length < 3) {
    return "Judul goal minimal 3 huruf.";
  }
  if (!input.pemilikId) return "Goal harus punya pemilik.";
  if (input.level === "leader" && !input.unitId) {
    return "Goal level leader harus menunjuk unit.";
  }
  if (input.level === "account" && !input.akunId) {
    return "Goal level akun harus menunjuk akun.";
  }
  for (const [nama, nilai] of [
    ["Target base", input.targetBase],
    ["Target goal", input.targetGoal],
    ["Target stretch", input.targetStretch],
  ] as const) {
    if (!Number.isFinite(nilai) || nilai < 0) return `${nama} tidak sah.`;
  }
  if (
    input.targetBase > input.targetGoal ||
    input.targetGoal > input.targetStretch
  ) {
    return "Target harus menanjak: base ≤ goal ≤ stretch.";
  }
  if (!/^\d{4}-\d{2}-01$/.test(input.mulaiBulan)) {
    return "Bulan mulai harus tanggal 1.";
  }
  if (input.jumlahBulan < 1 || input.jumlahBulan > 12) {
    return "Anak tangga bulanan antara 1 sampai 12 bulan.";
  }
  return null;
}

/**
 * Membuat goal baru sekaligus anak tangga bulanannya.
 *
 * Goal tanpa anak tangga tidak punya target bulan berjalan, sehingga
 * seluruh rekap GRD — matriks WRM, KPI GMV, rasio pohon goal — membacanya
 * sebagai target 0. Karena itu keduanya dibuat sekali jalan.
 */
export async function tambahGoal(input: MasukanGoal): Promise<Hasil<string>> {
  const salah = periksa(input);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaGoal(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh membuat goal.", "izin");
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("goals")
    .insert({
      judul: input.judul.trim(),
      level: input.level,
      pemilik_id: input.pemilikId,
      parent_goal_id: input.indukId,
      unit_id: input.unitId,
      account_id: input.akunId,
      satuan: input.satuan || "IDR",
      target_base: input.targetBase,
      target_goal: input.targetGoal,
      target_stretch: input.targetStretch,
      periode: input.periode,
      dibuat_oleh: pengguna.id,
    })
    .select("id")
    .single();

  if (error) return terjemahkan(error);

  const tangga = anakTangga(
    input.mulaiBulan,
    input.jumlahBulan,
    input.targetGoal,
  );
  const { error: galatBulan } = await sb.from("goal_months").insert(
    tangga.map((t) => ({ goal_id: data.id, bulan: t.bulan, target: t.target })),
  );

  if (galatBulan) {
    // Goal tanpa anak tangga lebih menyesatkan daripada tidak ada goal.
    await sb.from("goals").delete().eq("id", data.id);
    return terjemahkan(galatBulan);
  }

  segarkan();
  return sukses(data.id, `Goal "${input.judul.trim()}" dibuat.`);
}

/** Mengubah tangga target sebuah goal beserta anak tangga bulanannya. */
export async function ubahTargetGoal(input: {
  goalId: string;
  targetBase: number;
  targetGoal: number;
  targetStretch: number;
}): Promise<Hasil> {
  if (!input.goalId) return gagal("Goal tidak dikenali.", "validasi");
  if (
    input.targetBase > input.targetGoal ||
    input.targetGoal > input.targetStretch
  ) {
    return gagal("Target harus menanjak: base ≤ goal ≤ stretch.", "validasi");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaGoal(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh mengubah goal.", "izin");
  }

  const sb = await klienServer();
  const { data: lama, error: galatBaca } = await sb
    .from("goals")
    .select("target_goal, goal_months (bulan, target)")
    .eq("id", input.goalId)
    .maybeSingle();

  if (galatBaca) return terjemahkan(galatBaca);
  if (!lama) return gagal("Goal tidak ditemukan.", "validasi");

  const { error } = await sb
    .from("goals")
    .update({
      target_base: input.targetBase,
      target_goal: input.targetGoal,
      target_stretch: input.targetStretch,
    })
    .eq("id", input.goalId);

  if (error) return terjemahkan(error);

  // Anak tangga ikut bergeser dengan proporsi yang sama, supaya jumlah
  // bulanannya tetap sejalan dengan target tahunannya.
  const bulan = (lama.goal_months ?? []) as { bulan: string; target: number }[];
  const sebelum = Number(lama.target_goal);
  if (bulan.length > 0 && sebelum > 0 && sebelum !== input.targetGoal) {
    const rasio = input.targetGoal / sebelum;
    for (const b of bulan) {
      await sb
        .from("goal_months")
        .update({ target: Math.round(Number(b.target) * rasio) })
        .eq("goal_id", input.goalId)
        .eq("bulan", b.bulan);
    }
  }

  segarkan();
  return sukses(undefined, "Target goal diperbarui.");
}

/**
 * Menutup goal: sengaja bukan penghapusan, sebab riwayat capaian dan jejak
 * perubahannya tetap dibutuhkan. Kuota 3 goal aktif per orang langsung
 * terbebaskan, dan statusnya jujur — tercapai atau dibatalkan.
 */
export async function tutupGoal(
  goalId: string,
  hasil: "selesai" | "dibatalkan",
): Promise<Hasil> {
  if (!goalId) return gagal("Goal tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaGoal(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh menutup goal.", "izin");
  }

  const sb = await klienServer();
  const { error } = await sb
    .from("goals")
    .update({ status: hasil })
    .eq("id", goalId);

  if (error) return terjemahkan(error);

  segarkan();
  return sukses(
    undefined,
    hasil === "selesai"
      ? "Goal ditandai selesai; riwayatnya tetap tersimpan."
      : "Goal dibatalkan; riwayatnya tetap tersimpan.",
  );
}
