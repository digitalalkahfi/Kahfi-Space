// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { daftarAnggota } from "@/lib/data/sesi";
import { AMBANG_LULUS_KUIS, wajibBagi } from "@/lib/lms";
import type {
  HasilKuis,
  Kursus,
  SoalDenganKunci,
  ModulKursus,
  PercobaanKuis,
  ProgresOrang,
  SoalKuis,
  TingkatKursus,
} from "@/lib/lms";
import type { KodeUnit, Pengguna, Peran } from "@/lib/types";

/** Menyusun kursus adalah wewenang CEO/Manager. */
export function bolehKelolaKursus(pengguna: Pengguna) {
  return pengguna.role === "CEO" || pengguna.role === "Manager";
}

function satu<T>(nilai: T | T[] | null | undefined): T | null {
  if (!nilai) return null;
  return Array.isArray(nilai) ? (nilai[0] ?? null) : nilai;
}

/**
 * Katalog kursus beserta kemajuan pengguna sendiri.
 *
 * Katalognya terbuka bagi semua anggota — menyembunyikan kursus dari
 * orang yang tidak diwajibkan hanya menghalangi yang ingin belajar
 * sendiri.
 */
/**
 * Kursus yang terlihat pengguna.
 *
 * Kursus nonaktif sengaja tetap dibawa untuk pengelola — merekalah yang
 * perlu menghidupkannya kembali — dan disembunyikan dari peserta, yang
 * hanya perlu melihat yang masih berlaku.
 */
export async function daftarKursus(pengguna: Pengguna): Promise<Kursus[]> {
  if (modeData() === "demo") return kursusDemo(pengguna);

  const sb = await klienServer();
  const { data, error } = await sb
    .from("courses")
    .select(
      `id, judul, ringkasan, kategori, tingkat, wajib_untuk, aktif,
       unit:units (kode, nama),
       modul:course_modules (id, urutan, judul, isi, durasi_menit)`,
    )
    .order("judul");

  if (error) throw new Error(`Gagal memuat kursus: ${error.message}`);

  const kelola = bolehKelolaKursus(pengguna);

  const { data: daftarIkut, error: galatIkut } = await sb
    .from("course_enrollments")
    .select("id, course_id, selesai_pada")
    .eq("user_id", pengguna.id);

  if (galatIkut) throw new Error(`Gagal memuat pendaftaran: ${galatIkut.message}`);

  const ikutPerKursus = new Map(
    (daftarIkut ?? []).map((e) => [e.course_id, e]),
  );

  const { data: kemajuan } = await sb
    .from("module_progress")
    .select("module_id, enrollment_id")
    .in(
      "enrollment_id",
      (daftarIkut ?? []).map((e) => e.id),
    );

  const modulTuntas = new Set((kemajuan ?? []).map((k) => k.module_id));

  return (data ?? [])
    .filter((k) => k.aktif || kelola)
    .map((k) => {
    const unit = satu(k.unit);
    const ikut = ikutPerKursus.get(k.id);
    return {
      id: k.id,
      judul: k.judul,
      ringkasan: k.ringkasan,
      kategori: k.kategori,
      tingkat: k.tingkat as TingkatKursus,
      unitKode: (unit?.kode as KodeUnit) ?? null,
      unitNama: unit?.nama ? unit.nama.split(" (")[0] : "Semua unit",
      wajibUntuk: (k.wajib_untuk ?? []) as Peran[],
      aktif: k.aktif,
      modul: (k.modul ?? [])
        .map((m) => ({
          id: m.id,
          urutan: m.urutan,
          judul: m.judul,
          isi: m.isi,
          durasiMenit: m.durasi_menit,
          tuntas: modulTuntas.has(m.id),
        }))
        .sort((a, b) => a.urutan - b.urutan) satisfies ModulKursus[],
      terdaftar: ikut !== undefined,
      selesaiPada: ikut?.selesai_pada ?? null,
    };
  });
}

/** Satu kursus beserta kemajuan pengguna. */
export async function kursusDariId(
  pengguna: Pengguna,
  id: string,
): Promise<Kursus | null> {
  const semua = await daftarKursus(pengguna);
  return semua.find((k) => k.id === id) ?? null;
}

// ---------------------------------------------------------------------
// Mode demo
// ---------------------------------------------------------------------
function kursusDemo(pengguna: Pengguna): Kursus[] {
  const { courses, enrollments, units } = dataContoh;

  return courses.map((c, i) => {
    const ikut = enrollments.find(
      (e) => e.kursus === c.judul && e.orang === pengguna.nama,
    );
    const unit = c.unit ? units.find((u) => u.kode === c.unit) : null;
    const modul = c.modul.map((m, j) => ({
      id: `kursus-${i + 1}-modul-${j + 1}`,
      urutan: j + 1,
      judul: m.judul,
      // Seed menyimpan materinya sebagai larik paragraf.
      isi: (m.isi ?? []).join("\n\n"),
      durasiMenit: m.durasi,
      tuntas: (ikut?.tuntas ?? 0) > j,
    })) satisfies ModulKursus[];

    return {
      id: `kursus-${i + 1}`,
      judul: c.judul,
      ringkasan: c.ringkasan,
      kategori: c.kategori,
      tingkat: c.tingkat as TingkatKursus,
      unitKode: (c.unit as KodeUnit) ?? null,
      unitNama: unit?.nama ? unit.nama.split(" (")[0] : "Semua unit",
      wajibUntuk: c.wajib_untuk as Peran[],
      aktif: true,
      modul,
      terdaftar: ikut !== undefined,
      selesaiPada:
        ikut && modul.length > 0 && modul.every((m) => m.tuntas)
          ? `${dataContoh.tanggalAcuan}T15:00:00+07:00`
          : null,
    } satisfies Kursus;
  });
}

// ---------------------------------------------------------------------
// Kuis
// ---------------------------------------------------------------------

/**
 * Soal kuis sebuah modul.
 *
 * Kunci jawabannya tidak pernah ikut terbaca di sini — ia tinggal di
 * tabel `quiz_keys` yang tertutup bagi peserta (migrasi 0056).
 */
export async function soalKuis(modulId: string): Promise<SoalKuis[]> {
  if (modeData() === "demo") return soalDemo(modulId);

  const sb = await klienServer();
  const { data, error } = await sb
    .from("quiz_questions")
    .select("id, urutan, pertanyaan, pilihan")
    .eq("module_id", modulId)
    .order("urutan");

  if (error) throw new Error(`Gagal memuat soal: ${error.message}`);

  return (data ?? []).map((s) => ({
    id: s.id,
    urutan: s.urutan,
    pertanyaan: s.pertanyaan,
    pilihan: s.pilihan,
  }));
}

/** Riwayat percobaan kuis pengguna pada satu modul. */
export async function percobaanKuis(
  pengguna: Pengguna,
  kursusId: string,
  modulId: string,
): Promise<PercobaanKuis[]> {
  if (modeData() === "demo") return [];

  const sb = await klienServer();
  const { data: ikut } = await sb
    .from("course_enrollments")
    .select("id")
    .eq("course_id", kursusId)
    .eq("user_id", pengguna.id)
    .maybeSingle();

  if (!ikut) return [];

  const { data, error } = await sb
    .from("quiz_attempts")
    .select("id, skor, lulus, dikerjakan_pada")
    .eq("enrollment_id", ikut.id)
    .eq("module_id", modulId)
    .order("dikerjakan_pada", { ascending: false });

  if (error) throw new Error(`Gagal memuat percobaan: ${error.message}`);

  return (data ?? []).map((p) => ({
    id: p.id,
    skor: p.skor,
    lulus: p.lulus,
    dikerjakanPada: p.dikerjakan_pada,
  }));
}

// Mode demo: soal diambil dari seed, tanpa kunci jawabannya.
function soalDemo(modulId: string): SoalKuis[] {
  const { courses, quiz } = dataContoh;

  // Id modul demo berbentuk "kursus-<i>-modul-<j>".
  const cocok = /^kursus-(\d+)-modul-(\d+)$/.exec(modulId);
  if (!cocok) return [];

  const kursus = courses[Number(cocok[1]) - 1];
  const modul = kursus?.modul[Number(cocok[2]) - 1];
  if (!modul) return [];

  const set = quiz.find((q) => q.modul === modul.judul);
  return (set?.soal ?? []).map((s, i) => ({
    id: `${modulId}-soal-${i + 1}`,
    urutan: i + 1,
    pertanyaan: s.pertanyaan,
    pilihan: s.pilihan,
  }));
}

/**
 * Menilai kuis di mode demo.
 *
 * Dikerjakan di server dan tidak menyimpan apa pun — kunci jawabannya
 * tetap tidak pernah menyeberang ke browser, dan tidak ada percobaan
 * yang tercatat. Tanpa ini, hasil kuis sama sekali tidak bisa ditinjau
 * sebelum Supabase terpasang.
 */
export function nilaiKuisDemo(
  modulId: string,
  jawaban: number[],
): HasilKuis | null {
  const { courses, quiz } = dataContoh;
  const cocok = /^kursus-(\d+)-modul-(\d+)$/.exec(modulId);
  if (!cocok) return null;

  const modul = courses[Number(cocok[1]) - 1]?.modul[Number(cocok[2]) - 1];
  const set = modul ? quiz.find((q) => q.modul === modul.judul) : undefined;
  if (!set || set.soal.length === 0) return null;

  const benar = set.soal.filter((s, i) => jawaban[i] === s.benar).length;
  const skor = Math.round((benar / set.soal.length) * 100);

  return {
    skor,
    lulus: skor >= AMBANG_LULUS_KUIS,
    benar,
    total: set.soal.length,
  };
}

/**
 * Soal beserta kunci jawabannya.
 *
 * Hanya dipanggil dari halaman pengelola; RLS `quiz_keys_kelola`
 * memastikan peserta biasa tidak mendapat apa pun dari sini walau
 * pemanggilannya lolos.
 */
export async function soalDenganKunci(
  modulId: string,
): Promise<SoalDenganKunci[]> {
  if (modeData() === "demo") {
    // Mode demo membaca dari seed; halamannya hanya dibuka pengelola.
    const { courses, quiz } = dataContoh;
    const cocok = /^kursus-(\d+)-modul-(\d+)$/.exec(modulId);
    if (!cocok) return [];
    const modul = courses[Number(cocok[1]) - 1]?.modul[Number(cocok[2]) - 1];
    const set = modul ? quiz.find((q) => q.modul === modul.judul) : undefined;

    return (set?.soal ?? []).map((s, i) => ({
      id: `${modulId}-soal-${i + 1}`,
      urutan: i + 1,
      pertanyaan: s.pertanyaan,
      pilihan: s.pilihan,
      jawabanBenar: s.benar,
      penjelasan: s.penjelasan,
    }));
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("quiz_questions")
    .select("id, urutan, pertanyaan, pilihan, kunci:quiz_keys (jawaban_benar, penjelasan)")
    .eq("module_id", modulId)
    .order("urutan");

  if (error) throw new Error(`Gagal memuat soal: ${error.message}`);

  return (data ?? []).map((s) => {
    const kunci = satu(s.kunci);
    return {
      id: s.id,
      urutan: s.urutan,
      pertanyaan: s.pertanyaan,
      pilihan: s.pilihan,
      jawabanBenar: kunci?.jawaban_benar ?? 0,
      penjelasan: kunci?.penjelasan ?? "",
    };
  });
}

/**
 * Progres belajar orang-orang yang boleh dilihat pengguna.
 *
 * Cakupannya ditentukan RLS `enrollments_baca`: setiap orang melihat
 * dirinya sendiri, dan atasan melihat bawahannya. Kursus wajibnya
 * ditentukan peran masing-masing, bukan peran yang melihat.
 */
export async function progresBelajarTim(
  pengguna: Pengguna,
): Promise<ProgresOrang[]> {
  const semuaKursus = await daftarKursus(pengguna);
  const anggota = await daftarAnggota();

  // Siapa yang boleh dilihat: cerminan `boleh_orang()` di database.
  const terlihat = anggota.filter((a) => {
    if (pengguna.role === "CEO" || pengguna.role === "Manager") return true;
    if (pengguna.role === "Leader" || pengguna.role === "Co-Leader") {
      return a.unitId === pengguna.unitId;
    }
    return a.id === pengguna.id;
  });

  if (modeData() === "demo") {
    const { enrollments, courses } = dataContoh;

    return terlihat.map((a) => {
      const miliknya = enrollments.filter((e) => e.orang === a.nama);
      const tuntasPenuh = miliknya.filter((e) => {
        const kursus = courses.find((c) => c.judul === e.kursus);
        return kursus && e.tuntas >= kursus.modul.length;
      });
      const wajib = semuaKursus.filter((k) => wajibBagi(k, a.role));
      const wajibSelesai = wajib.filter((k) =>
        tuntasPenuh.some((e) => e.kursus === k.judul),
      );

      return {
        userId: a.id,
        nama: a.nama,
        inisial: a.inisial,
        jabatan: a.jabatan,
        unitNama: a.unitId ?? "Manajemen",
        peran: a.role,
        wajib: wajib.length,
        wajibSelesai: wajibSelesai.length,
        wajibTertunda: wajib
          .filter((k) => !wajibSelesai.includes(k))
          .map((k) => k.judul),
        berjalan: miliknya.length - tuntasPenuh.length,
        selesai: tuntasPenuh.length,
      } satisfies ProgresOrang;
    });
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("course_enrollments")
    .select("user_id, course_id, selesai_pada");

  if (error) throw new Error(`Gagal memuat progres tim: ${error.message}`);

  const perOrang = new Map<string, typeof data>();
  for (const e of data ?? []) {
    perOrang.set(e.user_id, [...(perOrang.get(e.user_id) ?? []), e]);
  }

  return terlihat.map((a) => {
    const miliknya = perOrang.get(a.id) ?? [];
    const selesai = miliknya.filter((e) => e.selesai_pada !== null);
    const wajib = semuaKursus.filter((k) => wajibBagi(k, a.role));
    const wajibSelesai = wajib.filter((k) =>
      selesai.some((e) => e.course_id === k.id),
    );

    return {
      userId: a.id,
      nama: a.nama,
      inisial: a.inisial,
      jabatan: a.jabatan,
      unitNama: a.unitId ?? "Manajemen",
      peran: a.role,
      wajib: wajib.length,
      wajibSelesai: wajibSelesai.length,
      wajibTertunda: wajib
        .filter((k) => !wajibSelesai.includes(k))
        .map((k) => k.judul),
      berjalan: miliknya.length - selesai.length,
      selesai: selesai.length,
    } satisfies ProgresOrang;
  });
}
