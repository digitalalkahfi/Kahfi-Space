"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { bolehKelolaKursus, nilaiKuisDemo } from "@/lib/data/lms";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import type { HasilKuis, TingkatKursus } from "@/lib/lms";
import type { KodeUnit, Peran } from "@/lib/types";

function segarkan(kursusId?: string) {
  revalidatePath("/lms");
  if (kursusId) revalidatePath(`/lms/${kursusId}`);
}

/** Mulai mengikuti sebuah kursus. */
export async function ikutiKursus(kursusId: string): Promise<Hasil> {
  if (!kursusId) return gagal("Kursus tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { error } = await sb
    .from("course_enrollments")
    .insert({ course_id: kursusId, user_id: pengguna.id });

  if (error) {
    if (error.code === "23505") {
      return gagal("Kamu sudah mengikuti kursus ini.", "validasi");
    }
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mendaftar kursus ini.", "izin")
      : gagal(`Gagal mendaftar: ${error.message}`);
  }

  segarkan(kursusId);
  return sukses(undefined, "Kursus dimulai. Selamat belajar.");
}

/**
 * Tandai satu modul tuntas, atau batalkan penandaannya.
 *
 * Kelulusan kursus tidak disetel di sini — ia dihitung ulang database
 * dari modul yang tuntas (migrasi 0054). Dengan begitu tidak pernah ada
 * kursus yang tampak lulus sementara modulnya belum semua terbuka.
 */
export async function tandaiModul(input: {
  kursusId: string;
  modulId: string;
  tuntas: boolean;
}): Promise<Hasil> {
  if (!input.kursusId || !input.modulId) {
    return gagal("Modul tidak dikenali.", "validasi");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { data: ikut, error: galatIkut } = await sb
    .from("course_enrollments")
    .select("id")
    .eq("course_id", input.kursusId)
    .eq("user_id", pengguna.id)
    .maybeSingle();

  if (galatIkut) return gagal(`Gagal memeriksa pendaftaran: ${galatIkut.message}`);
  if (!ikut) {
    return gagal("Ikuti kursusnya dulu sebelum menandai modul.", "validasi");
  }

  const { error } = input.tuntas
    ? await sb
        .from("module_progress")
        .insert({ enrollment_id: ikut.id, module_id: input.modulId })
    : await sb
        .from("module_progress")
        .delete()
        .eq("enrollment_id", ikut.id)
        .eq("module_id", input.modulId);

  if (error) {
    if (error.code === "23505") {
      // Sudah ditandai sebelumnya — bukan kegagalan yang perlu dikeluhkan.
      segarkan(input.kursusId);
      return sukses(undefined, "Modul sudah tertandai tuntas.");
    }
    return error.code === "42501"
      ? gagal("Kamu tidak berhak menandai modul ini.", "izin")
      : gagal(error.message, "validasi");
  }

  segarkan(input.kursusId);
  return sukses(
    undefined,
    input.tuntas ? "Modul ditandai tuntas." : "Penandaan tuntas dibatalkan.",
  );
}

// ---------------------------------------------------------------------
// Menyusun kursus (CEO/Manager)
// ---------------------------------------------------------------------

type MasukanKursus = {
  judul: string;
  ringkasan: string;
  kategori: string;
  tingkat: TingkatKursus;
  unitKode: KodeUnit | null;
  wajibUntuk: Peran[];
};

function periksaKursus(input: MasukanKursus): string | null {
  if (input.judul.trim().length < 5) return "Judul kursus minimal 5 huruf.";
  if (!["dasar", "menengah", "lanjutan"].includes(input.tingkat)) {
    return "Tingkat kursus tidak dikenali.";
  }
  return null;
}

async function idUnit(kode: KodeUnit | null) {
  if (!kode) return null;
  const sb = await klienServer();
  const { data } = await sb.from("units").select("id").eq("kode", kode).maybeSingle();
  return data?.id ?? null;
}

async function pastikanPengelola() {
  const pengguna = await sesiSaatIni();
  if (!pengguna) return { salah: gagal("Sesi berakhir, silakan masuk lagi.", "izin") };
  if (!bolehKelolaKursus(pengguna)) {
    return {
      salah: gagal("Hanya CEO atau Manager yang boleh menyusun kursus.", "izin"),
    };
  }
  return { pengguna };
}

/** Tambah kursus baru. Modulnya disusun setelah kursusnya ada. */
export async function tambahKursus(input: MasukanKursus): Promise<Hasil> {
  const salah = periksaKursus(input);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const cek = await pastikanPengelola();
  if (cek.salah) return cek.salah;

  const sb = await klienServer();
  const { error } = await sb.from("courses").insert({
    judul: input.judul.trim(),
    ringkasan: input.ringkasan.trim().slice(0, 400),
    kategori: input.kategori.trim().slice(0, 60),
    tingkat: input.tingkat,
    unit_id: await idUnit(input.unitKode),
    wajib_untuk: input.wajibUntuk,
    dibuat_oleh: cek.pengguna?.id ?? null,
  });

  if (error) return gagal(`Gagal menyimpan: ${error.message}`);

  segarkan();
  return sukses(undefined, "Kursus dibuat. Lanjutkan dengan menyusun modulnya.");
}

/** Ubah keterangan kursus. */
export async function ubahKursus(
  kursusId: string,
  input: MasukanKursus,
): Promise<Hasil> {
  if (!kursusId) return gagal("Kursus tidak dikenali.", "validasi");
  const salah = periksaKursus(input);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const cek = await pastikanPengelola();
  if (cek.salah) return cek.salah;

  const sb = await klienServer();
  const { error } = await sb
    .from("courses")
    .update({
      judul: input.judul.trim(),
      ringkasan: input.ringkasan.trim().slice(0, 400),
      kategori: input.kategori.trim().slice(0, 60),
      tingkat: input.tingkat,
      unit_id: await idUnit(input.unitKode),
      wajib_untuk: input.wajibUntuk,
    })
    .eq("id", kursusId);

  if (error) return gagal(`Gagal menyimpan: ${error.message}`);

  segarkan(kursusId);
  return sukses(undefined, "Kursus diperbarui.");
}

/**
 * Tambah modul di urutan terakhir.
 *
 * Menambah modul mengubah arti "selesai" bagi setiap peserta — database
 * menghitung ulang kelulusan mereka (migrasi 0054), jadi orang yang
 * sudah lulus kembali berstatus berjalan sampai modul barunya tuntas.
 */
export async function tambahModul(input: {
  kursusId: string;
  judul: string;
  isi: string;
  durasiMenit: number;
}): Promise<Hasil> {
  if (input.judul.trim().length < 3) {
    return gagal("Judul modul minimal 3 huruf.", "validasi");
  }
  if (
    !Number.isFinite(input.durasiMenit) ||
    input.durasiMenit < 1 ||
    input.durasiMenit > 600
  ) {
    return gagal("Durasi modul antara 1 dan 600 menit.", "validasi");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const cek = await pastikanPengelola();
  if (cek.salah) return cek.salah;

  const sb = await klienServer();
  const { data: terakhir } = await sb
    .from("course_modules")
    .select("urutan")
    .eq("course_id", input.kursusId)
    .order("urutan", { ascending: false })
    .limit(1);

  const { error } = await sb.from("course_modules").insert({
    course_id: input.kursusId,
    urutan: (terakhir?.[0]?.urutan ?? 0) + 1,
    judul: input.judul.trim(),
    isi: input.isi.trim(),
    durasi_menit: input.durasiMenit,
  });

  if (error) return gagal(`Gagal menyimpan: ${error.message}`);

  segarkan(input.kursusId);
  return sukses(
    undefined,
    "Modul ditambahkan. Peserta yang sudah lulus kembali berstatus berjalan sampai modul ini mereka tuntaskan.",
  );
}

/** Ubah isi sebuah modul. */
export async function ubahModul(input: {
  kursusId: string;
  modulId: string;
  judul: string;
  isi: string;
  durasiMenit: number;
}): Promise<Hasil> {
  if (input.judul.trim().length < 3) {
    return gagal("Judul modul minimal 3 huruf.", "validasi");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const cek = await pastikanPengelola();
  if (cek.salah) return cek.salah;

  const sb = await klienServer();
  const { error } = await sb
    .from("course_modules")
    .update({
      judul: input.judul.trim(),
      isi: input.isi.trim(),
      durasi_menit: input.durasiMenit,
    })
    .eq("id", input.modulId);

  if (error) return gagal(`Gagal menyimpan: ${error.message}`);

  segarkan(input.kursusId);
  return sukses(undefined, "Modul diperbarui.");
}

/**
 * Pindahkan modul satu tingkat ke atas atau ke bawah.
 *
 * Penukarannya dikerjakan database dalam satu langkah (0089): nomor modul
 * unik per kursus, jadi menukarnya dari aplikasi selalu melewati keadaan
 * dua baris bernomor sama — yang ditolak, dan meninggalkan urutan
 * setengah jadi.
 */
export async function pindahModul(input: {
  kursusId: string;
  modulId: string;
  arah: "naik" | "turun";
}): Promise<Hasil> {
  if (!input.modulId) return gagal("Modul tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const cek = await pastikanPengelola();
  if (cek.salah) return cek.salah;

  const sb = await klienServer();
  const { error } = await sb.rpc("pindah_urutan_modul", {
    p_modul: input.modulId,
    p_arah: input.arah === "naik" ? -1 : 1,
  });

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah urutan modul.", "izin")
      : gagal(error.message, "validasi");
  }

  segarkan(input.kursusId);
  return sukses(undefined, "Urutan modul diperbarui.");
}

/** Hapus modul; nomor modul sisanya dirapatkan database (migrasi 0055). */
export async function hapusModul(input: {
  kursusId: string;
  modulId: string;
}): Promise<Hasil> {
  if (modeData() === "demo") return BALASAN_DEMO;

  const cek = await pastikanPengelola();
  if (cek.salah) return cek.salah;

  const sb = await klienServer();
  const { error } = await sb
    .from("course_modules")
    .delete()
    .eq("id", input.modulId);

  if (error) return gagal(`Gagal menghapus: ${error.message}`);

  segarkan(input.kursusId);
  return sukses(
    undefined,
    "Modul dihapus dan nomor modul sisanya dirapatkan.",
  );
}

/**
 * Kirim jawaban kuis dan terima skornya.
 *
 * Penilaian dikerjakan fungsi database `nilai_kuis` yang membaca kunci
 * jawaban; aplikasi ini tidak pernah memegangnya. Yang kembali hanya
 * skor dan kelulusan — tanpa petunjuk jawaban mana yang salah, supaya
 * menebak lewat percobaan berulang tidak lebih murah daripada belajar.
 */
export async function kirimKuis(input: {
  kursusId: string;
  modulId: string;
  jawaban: number[];
}): Promise<Hasil<HasilKuis>> {
  if (input.jawaban.length === 0) {
    return gagal("Jawab dulu soalnya.", "validasi");
  }
  if (input.jawaban.some((j) => !Number.isInteger(j) || j < 0)) {
    return gagal("Ada jawaban yang tidak sah.", "validasi");
  }
  // Mode demo menilai di server tanpa menyimpan apa pun: kunci
  // jawabannya tetap tidak menyeberang, dan tidak ada percobaan yang
  // tercatat. Yang dikembalikan ditandai jelas sebagai tidak tersimpan.
  if (modeData() === "demo") {
    const hasilDemo = nilaiKuisDemo(input.modulId, input.jawaban);
    if (!hasilDemo) return BALASAN_DEMO;
    return sukses(
      hasilDemo,
      `Skor ${hasilDemo.skor} — mode demo, hasilnya tidak tersimpan.`,
    );
  }

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { data, error } = await sb.rpc("nilai_kuis", {
    p_module: input.modulId,
    p_jawaban: input.jawaban,
  });

  if (error) return gagal(error.message, "validasi");

  const hasil = data?.[0];
  if (!hasil) return gagal("Kuis tidak bisa dinilai.", "galat");

  segarkan(input.kursusId);

  return sukses(
    {
      skor: hasil.skor,
      lulus: hasil.lulus,
      benar: hasil.benar,
      total: hasil.total,
    },
    hasil.lulus
      ? `Lulus dengan skor ${hasil.skor}. Modul ini otomatis tertandai tuntas.`
      : `Skor ${hasil.skor}, belum mencapai ambang lulus. Baca ulang materinya lalu coba lagi.`,
  );
}

// ---------------------------------------------------------------------
// Menyusun soal kuis (CEO/Manager)
// ---------------------------------------------------------------------

type MasukanSoal = {
  pertanyaan: string;
  pilihan: string[];
  jawabanBenar: number;
  penjelasan: string;
};

function periksaSoal(input: MasukanSoal): string | null {
  if (input.pertanyaan.trim().length < 5) return "Pertanyaan minimal 5 huruf.";

  const bersih = input.pilihan.map((p) => p.trim()).filter(Boolean);
  if (bersih.length < 2) return "Sediakan minimal dua pilihan jawaban.";
  if (bersih.length > 6) return "Maksimal enam pilihan jawaban.";
  if (new Set(bersih.map((p) => p.toLowerCase())).size !== bersih.length) {
    return "Ada pilihan jawaban yang sama persis.";
  }
  if (input.jawabanBenar < 0 || input.jawabanBenar >= bersih.length) {
    return "Tandai dulu pilihan mana yang benar.";
  }
  return null;
}

/** Tambah soal di urutan terakhir modul. */
export async function tambahSoal(input: {
  kursusId: string;
  modulId: string;
  soal: MasukanSoal;
}): Promise<Hasil> {
  const salah = periksaSoal(input.soal);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const cek = await pastikanPengelola();
  if (cek.salah) return cek.salah;

  const sb = await klienServer();
  const { data: terakhir } = await sb
    .from("quiz_questions")
    .select("urutan")
    .eq("module_id", input.modulId)
    .order("urutan", { ascending: false })
    .limit(1);

  const pilihan = input.soal.pilihan.map((p) => p.trim()).filter(Boolean);

  const { data: soalBaru, error } = await sb
    .from("quiz_questions")
    .insert({
      module_id: input.modulId,
      urutan: (terakhir?.[0]?.urutan ?? 0) + 1,
      pertanyaan: input.soal.pertanyaan.trim(),
      pilihan,
    })
    .select("id")
    .single();

  if (error || !soalBaru) {
    return gagal(`Gagal menyimpan soal: ${error?.message ?? "tidak diketahui"}`);
  }

  // Kunci ditulis terpisah; bila gagal, soalnya ikut dibatalkan supaya
  // tidak ada soal tanpa kunci yang membuat penilaian salah diam-diam.
  const { error: galatKunci } = await sb.from("quiz_keys").insert({
    question_id: soalBaru.id,
    jawaban_benar: input.soal.jawabanBenar,
    penjelasan: input.soal.penjelasan.trim().slice(0, 300),
  });

  if (galatKunci) {
    await sb.from("quiz_questions").delete().eq("id", soalBaru.id);
    return gagal(`Gagal menyimpan kunci: ${galatKunci.message}`);
  }

  segarkan(input.kursusId);
  return sukses(undefined, "Soal ditambahkan.");
}

/** Ubah sebuah soal beserta kuncinya. */
export async function ubahSoal(input: {
  kursusId: string;
  soalId: string;
  soal: MasukanSoal;
}): Promise<Hasil> {
  const salah = periksaSoal(input.soal);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const cek = await pastikanPengelola();
  if (cek.salah) return cek.salah;

  const sb = await klienServer();
  const pilihan = input.soal.pilihan.map((p) => p.trim()).filter(Boolean);

  const { error } = await sb
    .from("quiz_questions")
    .update({ pertanyaan: input.soal.pertanyaan.trim(), pilihan })
    .eq("id", input.soalId);

  if (error) return gagal(`Gagal menyimpan soal: ${error.message}`);

  const { error: galatKunci } = await sb.from("quiz_keys").upsert(
    {
      question_id: input.soalId,
      jawaban_benar: input.soal.jawabanBenar,
      penjelasan: input.soal.penjelasan.trim().slice(0, 300),
    },
    { onConflict: "question_id" },
  );

  if (galatKunci) return gagal(`Gagal menyimpan kunci: ${galatKunci.message}`);

  segarkan(input.kursusId);
  return sukses(undefined, "Soal diperbarui.");
}

/** Hapus sebuah soal; kuncinya ikut terhapus lewat foreign key. */
export async function hapusSoal(input: {
  kursusId: string;
  soalId: string;
}): Promise<Hasil> {
  if (modeData() === "demo") return BALASAN_DEMO;

  const cek = await pastikanPengelola();
  if (cek.salah) return cek.salah;

  const sb = await klienServer();
  const { error } = await sb
    .from("quiz_questions")
    .delete()
    .eq("id", input.soalId);

  if (error) return gagal(`Gagal menghapus: ${error.message}`);

  segarkan(input.kursusId);
  return sukses(
    undefined,
    "Soal dihapus. Skor percobaan lama tetap tersimpan apa adanya.",
  );
}

/**
 * Pensiunkan kursus, atau hidupkan kembali.
 *
 * Kursus yang sudah diikuti orang tidak dihapus (0088): riwayat belajar
 * mereka menggantung padanya. Menonaktifkan menyembunyikannya dari
 * peserta baru sambil menyimpan seluruh catatan yang sudah ada.
 */
export async function ubahAktifKursus(
  kursusId: string,
  aktif: boolean,
): Promise<Hasil> {
  if (!kursusId) return gagal("Kursus tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const cek = await pastikanPengelola();
  if (cek.salah) return cek.salah;

  const sb = await klienServer();
  const { data, error } = await sb
    .from("courses")
    .update({ aktif })
    .eq("id", kursusId)
    .select("judul")
    .maybeSingle();

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah kursus ini.", "izin")
      : gagal(error.message, "validasi");
  }
  if (!data) return gagal("Kursus tidak ditemukan.", "validasi");

  segarkan(kursusId);
  return sukses(
    undefined,
    aktif
      ? `"${data.judul}" aktif lagi dan bisa diikuti.`
      : `"${data.judul}" dipensiunkan; riwayat belajar pesertanya tetap tersimpan.`,
  );
}
