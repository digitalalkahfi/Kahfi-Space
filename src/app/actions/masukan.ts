"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { bolehKelolaMasukan } from "@/lib/data/masukan";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import type {
  JenisMasukan,
  Keparahan,
  StatusMasukan,
} from "@/lib/masukan";

const JENIS_SAH: JenisMasukan[] = ["bug", "saran", "pertanyaan"];
const KEPARAHAN_SAH: Keparahan[] = ["ringan", "sedang", "berat", "kritis"];

function segarkan(id?: string) {
  revalidatePath("/masukan");
  if (id) revalidatePath(`/masukan/${id}`);
}

/**
 * Kirim masukan atau laporan bug.
 *
 * Siapa pun yang login boleh mengirim. Untuk bug, halaman tempat
 * masalahnya ditemui diminta terpisah — menelusuri bug tanpa tahu di
 * layar mana ia muncul hampir selalu berakhir dengan "tidak bisa
 * ditiru".
 */
export async function kirimMasukan(input: {
  jenis: JenisMasukan;
  judul: string;
  isi: string;
  keparahan: Keparahan | null;
  halaman: string;
}): Promise<Hasil> {
  const judul = input.judul.trim();
  if (judul.length < 10) {
    return gagal(
      "Tulis judul yang cukup jelas (minimal 10 huruf) — judul samar membuat masukannya sulit ditindaklanjuti.",
      "validasi",
    );
  }
  if (!JENIS_SAH.includes(input.jenis)) {
    return gagal("Jenis masukan tidak dikenali.", "validasi");
  }
  if (
    input.jenis === "bug" &&
    input.keparahan !== null &&
    !KEPARAHAN_SAH.includes(input.keparahan)
  ) {
    return gagal("Tingkat keparahan tidak dikenali.", "validasi");
  }
  if (input.jenis === "bug" && input.isi.trim().length < 20) {
    return gagal(
      "Untuk bug, ceritakan langkah yang menghasilkannya — tanpa itu biasanya berakhir 'tidak bisa ditiru'.",
      "validasi",
    );
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { error } = await sb.from("feedback").insert({
    jenis: input.jenis,
    judul,
    isi: input.isi.trim().slice(0, 2000),
    // Keparahan pada non-bug dikosongkan database (migrasi 0057).
    keparahan: input.jenis === "bug" ? (input.keparahan ?? "sedang") : null,
    halaman: input.halaman.trim().slice(0, 120),
    dilaporkan_oleh: pengguna.id,
  });

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengirim masukan.", "izin")
      : gagal(`Gagal mengirim: ${error.message}`);
  }

  segarkan();
  return sukses(
    undefined,
    "Masukan terkirim. Setiap perubahan statusnya akan terlihat di halaman ini.",
  );
}

/** Beri atau tarik dukungan pada sebuah masukan. */
export async function ubahDukungan(input: {
  masukanId: string;
  dukung: boolean;
}): Promise<Hasil> {
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { error } = input.dukung
    ? await sb
        .from("feedback_votes")
        .insert({ feedback_id: input.masukanId, user_id: pengguna.id })
    : await sb
        .from("feedback_votes")
        .delete()
        .eq("feedback_id", input.masukanId)
        .eq("user_id", pengguna.id);

  // Mendukung dua kali bukan kegagalan yang perlu dikeluhkan.
  if (error && error.code !== "23505") {
    return gagal(`Gagal menyimpan dukungan: ${error.message}`);
  }

  segarkan(input.masukanId);
  return sukses(
    undefined,
    input.dukung ? "Dukungan tercatat." : "Dukungan ditarik.",
  );
}

/**
 * Ubah status masukan, sekaligus menunjuk penanggung jawabnya.
 *
 * Setiap perubahan menyisakan jejak (migrasi 0057), dan penolakan wajib
 * disertai alasan — laporan yang menghilang tanpa kabar adalah cara
 * tercepat membuat orang berhenti melapor.
 */
export async function ubahStatusMasukan(input: {
  masukanId: string;
  status: StatusMasukan;
  alasanTolak?: string;
  ditugaskanKe?: string | null;
}): Promise<Hasil> {
  if (!input.masukanId) return gagal("Masukan tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const pengelola = bolehKelolaMasukan(pengguna);
  const sb = await klienServer();

  // Penanggung jawab boleh menggerakkan statusnya sendiri (0093), tetapi
  // penugasan dan penolakan tetap keputusan pengelola.
  if (!pengelola) {
    const { data: milik } = await sb
      .from("feedback")
      .select("ditugaskan_ke")
      .eq("id", input.masukanId)
      .maybeSingle();

    if (milik?.ditugaskan_ke !== pengguna.id) {
      return gagal(
        "Hanya pengelola atau penanggung jawabnya yang boleh mengubah status ini.",
        "izin",
      );
    }
    if (input.status !== "dikerjakan" && input.status !== "selesai") {
      return gagal(
        "Sebagai penanggung jawab, status hanya bisa digerakkan ke dikerjakan atau selesai.",
        "izin",
      );
    }
  }

  const { error } = await sb
    .from("feedback")
    .update(
      pengelola
        ? {
            status: input.status,
            alasan_tolak: (input.alasanTolak ?? "").trim().slice(0, 300),
            ditugaskan_ke: input.ditugaskanKe ?? null,
          }
        : { status: input.status },
    )
    .eq("id", input.masukanId);

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah masukan ini.", "izin")
      : gagal(error.message, "validasi");
  }

  segarkan(input.masukanId);
  return sukses(undefined, "Status masukan diperbarui dan pelapor bisa melihatnya.");
}

/** Tulis balasan pada sebuah masukan. */
export async function balasMasukan(input: {
  masukanId: string;
  isi: string;
}): Promise<Hasil> {
  const isi = input.isi.trim();
  if (isi.length < 2) return gagal("Tulis balasannya dulu.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { error } = await sb.from("feedback_comments").insert({
    feedback_id: input.masukanId,
    oleh_id: pengguna.id,
    isi: isi.slice(0, 1000),
  });

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak membalas di sini.", "izin")
      : gagal(`Gagal mengirim balasan: ${error.message}`);
  }

  segarkan(input.masukanId);
  return sukses(undefined, "Balasan terkirim.");
}

/**
 * Pengirim membetulkan judul atau isi laporannya sendiri.
 *
 * Hanya selama laporannya belum ditinjau — sesudah itu isinya sudah
 * menjadi bahan keputusan orang lain, dan mengubahnya diam-diam membuat
 * jejak peninjauan tidak lagi cocok dengan yang ditinjau (0093).
 */
export async function suntingMasukan(input: {
  masukanId: string;
  judul: string;
  isi: string;
}): Promise<Hasil> {
  const judul = input.judul.trim();
  if (judul.length < 10) {
    return gagal("Judul minimal 10 huruf supaya jelas dibaca orang.", "validasi");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { data, error } = await sb
    .from("feedback")
    .update({ judul, isi: input.isi.trim().slice(0, 2000) })
    .eq("id", input.masukanId)
    .select("id");

  if (error) {
    return error.code === "42501" || error.code === "P0001"
      ? gagal(
          "Laporan ini sudah ditinjau atau bukan milikmu, jadi tidak bisa disunting.",
          "izin",
        )
      : gagal(error.message, "validasi");
  }
  if (!data || data.length === 0) {
    return gagal(
      "Laporan ini sudah ditinjau atau bukan milikmu, jadi tidak bisa disunting.",
      "izin",
    );
  }

  segarkan(input.masukanId);
  return sukses(undefined, "Laporanmu diperbarui.");
}
