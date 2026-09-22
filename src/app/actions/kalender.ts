"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { bolehKelolaAgenda } from "@/lib/data/kalender";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import type { JenisAgenda } from "@/lib/kalender";
import type { KodeUnit } from "@/lib/types";

const JENIS_SAH: JenisAgenda[] = ["rapat", "libur", "pelatihan", "lainnya"];
const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const POLA_JAM = /^\d{2}:\d{2}$/;

type MasukanAgenda = {
  judul: string;
  keterangan: string;
  jenis: JenisAgenda;
  tanggal: string;
  jamMulai: string | null;
  jamSelesai: string | null;
  unitKode: KodeUnit | null;
  lokasi: string;
};

function periksa(input: MasukanAgenda): string | null {
  if (input.judul.trim().length < 3) return "Judul agenda minimal 3 huruf.";
  if (!JENIS_SAH.includes(input.jenis)) return "Jenis agenda tidak dikenali.";
  if (!POLA_TANGGAL.test(input.tanggal)) return "Tanggal tidak sah.";

  if (input.jamMulai && !POLA_JAM.test(input.jamMulai)) {
    return "Jam mulai tidak sah.";
  }
  if (input.jamSelesai && !POLA_JAM.test(input.jamSelesai)) {
    return "Jam selesai tidak sah.";
  }
  if (input.jamSelesai && !input.jamMulai) {
    return "Isi jam mulainya dulu sebelum jam selesai.";
  }
  if (
    input.jamMulai &&
    input.jamSelesai &&
    input.jamSelesai <= input.jamMulai
  ) {
    return "Jam selesai harus setelah jam mulai.";
  }
  return null;
}

async function idUnit(kode: KodeUnit | null) {
  if (!kode) return null;
  const sb = await klienServer();
  const { data } = await sb.from("units").select("id").eq("kode", kode).maybeSingle();
  return data?.id ?? null;
}

function segarkan() {
  revalidatePath("/kalender");
  revalidatePath("/beranda");
}

/**
 * Tambah agenda ke kalender bersama.
 *
 * Hanya untuk hal yang tidak punya tempat lain. Tenggat tugas sengaja
 * tidak bisa dibuat dari sini: ia ditarik dari modul Tugas, dan
 * menyalinnya ke agenda akan membuat dua tanggal yang bisa berbeda.
 */
export async function tambahAgenda(input: MasukanAgenda): Promise<Hasil> {
  const salah = periksa(input);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAgenda(pengguna)) {
    return gagal(
      "Hanya Manager, CEO, atau Leader yang boleh menambah agenda.",
      "izin",
    );
  }

  // Leader hanya boleh mengatur agenda unitnya sendiri — sejalan policy
  // `agenda_unit_kelola`.
  const lintasUnit = pengguna.role === "CEO" || pengguna.role === "Manager";
  if (!lintasUnit && input.unitKode !== pengguna.unitId) {
    return gagal(
      "Kamu hanya bisa menambah agenda untuk unitmu sendiri.",
      "izin",
    );
  }

  const sb = await klienServer();
  const { error } = await sb.from("agenda").insert({
    judul: input.judul.trim(),
    keterangan: input.keterangan.trim().slice(0, 500),
    jenis: input.jenis,
    tanggal: input.tanggal,
    jam_mulai: input.jamMulai,
    jam_selesai: input.jamSelesai,
    unit_id: await idUnit(input.unitKode),
    lokasi: input.lokasi.trim().slice(0, 120),
    dibuat_oleh: pengguna.id,
  });

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak menambah agenda ini.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkan();

  const catatan = await catatanBentrok(input);
  return sukses(
    undefined,
    `Agenda ditambahkan ke kalender bersama.${catatan}`,
  );
}

/**
 * Peringatan bentrok, bila ada.
 *
 * Agendanya tetap disimpan: dua acara pada jam yang sama kadang memang
 * disengaja, dan menolaknya akan membuat orang mencatat di tempat lain —
 * persis kebiasaan yang hendak dihentikan kalender bersama. Yang penting
 * orangnya tahu sebelum menutup layar.
 */
async function catatanBentrok(input: MasukanAgenda): Promise<string> {
  if (!input.jamMulai || !input.jamSelesai || input.jenis === "libur") {
    return "";
  }

  const sb = await klienServer();
  const { data } = await sb
    .from("agenda")
    .select("judul, jam_mulai, jam_selesai, jenis, unit:units (kode)")
    .eq("tanggal", input.tanggal)
    .neq("jenis", "libur")
    .not("jam_mulai", "is", null);

  const bertabrakan = (data ?? []).filter((a) => {
    const unitLain = (a.unit as unknown as { kode: string } | null)?.kode ?? null;
    const orangSama =
      unitLain === null || input.unitKode === null || unitLain === input.unitKode;

    return (
      orangSama &&
      a.jam_mulai !== null &&
      a.jam_selesai !== null &&
      a.judul !== input.judul.trim() &&
      input.jamMulai! < a.jam_selesai &&
      a.jam_mulai < input.jamSelesai!
    );
  });

  if (bertabrakan.length === 0) return "";

  const daftar = bertabrakan
    .slice(0, 2)
    .map((a) => `${a.judul} (${a.jam_mulai?.slice(0, 5)})`)
    .join(", ");

  return ` Perhatikan: jamnya bertabrakan dengan ${daftar}.`;
}

/** Hapus agenda. Tenggat tugas tidak bisa dihapus dari sini. */
export async function hapusAgenda(agendaId: string): Promise<Hasil> {
  if (!agendaId) return gagal("Agenda tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  // Siapa yang berhak ditentukan RLS: pengelola, Leader unitnya, atau
  // pembuatnya sendiri (policy `agenda_hapus_sendiri`).
  const sb = await klienServer();
  const { data, error } = await sb
    .from("agenda")
    .delete()
    .eq("id", agendaId)
    .select("id");

  if (error) {
    return error.code === "42501"
      ? gagal(
          "Hanya pembuatnya, Leader unitnya, atau Manager yang boleh menghapus agenda ini.",
          "izin",
        )
      : gagal(`Gagal menghapus: ${error.message}`);
  }
  // RLS tidak menolak dengan galat: baris yang tak boleh disentuh sekadar
  // tidak ikut terhapus. Tanpa pemeriksaan ini, layar akan berkata
  // "berhasil" untuk sesuatu yang tidak terjadi.
  if (!data || data.length === 0) {
    return gagal(
      "Agenda itu tidak berubah — hanya pembuatnya, Leader unitnya, atau Manager yang boleh menghapusnya.",
      "izin",
    );
  }

  segarkan();
  return sukses(undefined, "Agenda dihapus.");
}

/**
 * Ubah agenda.
 *
 * Boleh dilakukan pembuatnya sendiri (policy `agenda_ubah_sendiri`),
 * selain oleh pengelola — salah ketik jam pada agenda yang kita buat
 * sendiri tidak seharusnya perlu meminta tolong Manager.
 */
export async function ubahAgenda(
  agendaId: string,
  input: MasukanAgenda,
): Promise<Hasil> {
  if (!agendaId) return gagal("Agenda tidak dikenali.", "validasi");
  const salah = periksa(input);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { data, error } = await sb
    .from("agenda")
    .update({
      judul: input.judul.trim(),
      keterangan: input.keterangan.trim().slice(0, 500),
      jenis: input.jenis,
      tanggal: input.tanggal,
      jam_mulai: input.jamMulai,
      jam_selesai: input.jamSelesai,
      unit_id: await idUnit(input.unitKode),
      lokasi: input.lokasi.trim().slice(0, 120),
    })
    .eq("id", agendaId)
    .select("id");

  if (error) {
    return error.code === "42501" || error.code === "P0001"
      ? gagal(
          "Hanya pembuatnya, Leader unitnya, atau Manager yang boleh mengubah agenda ini.",
          "izin",
        )
      : gagal(`Gagal menyimpan: ${error.message}`);
  }
  if (!data || data.length === 0) {
    return gagal(
      "Agenda itu tidak berubah — hanya pembuatnya, Leader unitnya, atau Manager yang boleh mengubahnya.",
      "izin",
    );
  }

  segarkan();
  const catatan = await catatanBentrok(input);
  return sukses(undefined, `Agenda diperbarui.${catatan}`);
}
