"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import {
  MIN_ALASAN_TOLAK,
  periksaIzin,
  tanggalRentang,
  type BentukIzin,
  type IsiIzin,
} from "@/lib/izin";

type Titik = { lat: number; lng: number };

/** Ringkasan yang dikembalikan ke UI setelah absen tercatat. */
export type HasilAbsen = {
  status: "hadir" | "terlambat";
  terlambat: boolean;
  lokasiValid: boolean;
  jarakMeter: number | null;
  jam: string;
};

/**
 * Absen hanya untuk hari berjalan; tanggal lain harus lewat pengajuan izin.
 *
 * Sengaja "en-CA": lokal itu menghasilkan YYYY-MM-DD, bentuk yang dibaca
 * PostgreSQL. Ini nilai untuk database, bukan teks yang dibaca orang —
 * yang tampil di layar diformat `lib/format.ts` dalam bahasa Indonesia.
 * Zona waktunya tetap Jakarta supaya pergantian harinya ikut WIB.
 */
function tanggalHariIni() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function titikSah(t: Titik | undefined): t is Titik {
  return (
    !!t &&
    Number.isFinite(t.lat) &&
    Number.isFinite(t.lng) &&
    Math.abs(t.lat) <= 90 &&
    Math.abs(t.lng) <= 180 &&
    // (0, 0) adalah jawaban GPS yang rusak atau aplikasi lokasi palsu, bukan
    // tempat siapa pun bekerja; jaraknya ke kantor (±11.800 km) bahkan
    // melampaui kolom jarak_masuk_m sehingga simpanannya gagal mentah.
    !(t.lat === 0 && t.lng === 0)
  );
}

/** Tanggal di halaman sudah lewat: tab dibiarkan terbuka sejak kemarin. */
const PESAN_HALAMAN_BASI =
  "Halaman ini dibuka sebelum hari berganti. Muat ulang halaman, lalu absen lagi.";

/** Absen masuk. Validitas radius dan keterlambatan dihitung database. */
export async function absenMasuk(input: {
  tanggal: string;
  titik?: Titik;
  fotoUrl?: string | null;
}): Promise<Hasil<HasilAbsen | undefined>> {
  if (!titikSah(input.titik)) {
    return gagal(
      "Lokasi belum terbaca. Izinkan akses lokasi lalu coba lagi.",
      "validasi",
    );
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const hariIni = tanggalHariIni();
  if (input.tanggal !== hariIni) {
    return gagal(
      input.tanggal < hariIni
        ? PESAN_HALAMAN_BASI
        : "Absen hanya bisa dilakukan untuk hari ini. Untuk tanggal lain, ajukan izin.",
      "validasi",
    );
  }

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const KOLOM = "status, terlambat, lokasi_valid, jarak_masuk_m, jam_masuk";
  const isi = {
    jam_masuk: new Date().toISOString(),
    lat_masuk: input.titik.lat,
    lng_masuk: input.titik.lng,
    foto_masuk_url: input.fotoUrl ?? null,
  };

  // Baris hari ini bisa sudah ada tanpa jam masuk: sesudah absen ulang
  // (0171), atau karena izin beberapa jam diajukan sebelum datang. Absen
  // berikutnya mengisi baris itu, bukan membuat baris baru yang pasti
  // ditolak kunci unik per tanggal.
  const { data: ada } = await sb
    .from("attendance")
    .select("id, jam_masuk, status, persetujuan")
    .eq("user_id", pengguna.id)
    .eq("tanggal", input.tanggal)
    .maybeSingle();

  if (ada?.jam_masuk) {
    return gagal("Kamu sudah absen masuk hari ini.", "validasi");
  }
  // Izin/sakit sehari penuh yang masih berlaku memang tidak perlu absen.
  // Yang sudah ditolak atasan tidak berlaku lagi, jadi orangnya boleh absen.
  if (
    ada &&
    (ada.status === "izin" || ada.status === "sakit") &&
    ada.persetujuan !== "ditolak"
  ) {
    return gagal(
      `Hari ini kamu tercatat ${ada.status === "sakit" ? "sakit" : "izin"} (${
        ada.persetujuan === "disetujui" ? "sudah disetujui" : "menunggu persetujuan"
      }), jadi absen masuk tidak diperlukan. Bila ternyata kamu masuk, minta atasan menolak pengajuannya dulu.`,
      "validasi",
    );
  }

  // Status terlambat, validitas lokasi, dan jaraknya dihitung trigger database;
  // hasilnya diambil kembali supaya UI melaporkan angka yang sama persis.
  // `.is("jam_masuk", null)`: dua ketukan yang hampir bersamaan sama-sama
  // lolos pemeriksaan di atas; yang kedua tidak boleh menimpa jam masuk.
  const { data, error } = ada
    ? await sb
        .from("attendance")
        .update({ ...isi, status: "hadir" })
        .eq("id", ada.id)
        .is("jam_masuk", null)
        .select(KOLOM)
        .maybeSingle()
    : await sb
        .from("attendance")
        .insert({ user_id: pengguna.id, tanggal: input.tanggal, ...isi })
        .select(KOLOM)
        .single();

  if (error) {
    return error.code === "23505"
      ? gagal("Kamu sudah absen masuk hari ini.", "validasi")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }
  if (!data) return gagal("Kamu sudah absen masuk hari ini.", "validasi");

  revalidatePath("/absensi");
  revalidatePath("/beranda");

  const jam = new Date(data.jam_masuk ?? Date.now())
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    })
    .replace(".", ":");

  const pesan = [
    `Absen masuk tercatat ${jam} WIB`,
    data.terlambat ? "— tercatat terlambat" : "— tepat waktu",
    data.lokasi_valid ? "" : ", di luar radius kantor",
  ]
    .join("")
    .concat(".");

  return sukses(
    {
      status: data.terlambat ? "terlambat" : "hadir",
      terlambat: data.terlambat,
      lokasiValid: data.lokasi_valid,
      jarakMeter: data.jarak_masuk_m,
      jam,
    },
    pesan,
  );
}

/**
 * Absen pulang. Database menolak bila laporan harian hari itu belum masuk —
 * aturan ini tidak bisa dilangkahi lewat API.
 */
export async function absenPulang(input: {
  tanggal: string;
  titik?: Titik;
  fotoUrl?: string | null;
}): Promise<Hasil> {
  if (!titikSah(input.titik)) {
    return gagal(
      "Lokasi belum terbaca. Izinkan akses lokasi lalu coba lagi.",
      "validasi",
    );
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  if (input.tanggal !== tanggalHariIni()) {
    return gagal(
      input.tanggal < tanggalHariIni()
        ? PESAN_HALAMAN_BASI
        : "Absen pulang hanya untuk hari ini.",
      "validasi",
    );
  }

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  // `.select()` dipakai supaya kita tahu barisnya benar-benar terubah.
  // Tanpa itu, absen pulang tanpa absen masuk akan "berhasil" tanpa efek.
  const { data, error } = await sb
    .from("attendance")
    .update({
      jam_pulang: new Date().toISOString(),
      lat_pulang: input.titik.lat,
      lng_pulang: input.titik.lng,
      foto_pulang_url: input.fotoUrl ?? null,
    })
    .eq("user_id", pengguna.id)
    .eq("tanggal", input.tanggal)
    .select("jam_pulang")
    .maybeSingle();

  if (error) {
    return error.message.includes("Absen pulang terkunci")
      ? gagal(
          "Absen pulang masih terkunci — kirim laporan harian dulu.",
          "validasi",
        )
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  if (!data) {
    return gagal(
      "Belum ada catatan absen masuk hari ini, jadi absen pulang tidak bisa dicatat.",
      "validasi",
    );
  }

  revalidatePath("/absensi");
  revalidatePath("/beranda");

  const jam = new Date(data.jam_pulang ?? Date.now())
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    })
    .replace(".", ":");

  return sukses(undefined, `Absen pulang tercatat ${jam} WIB. Terima kasih!`);
}

/**
 * Absen ulang: kosongkan catatan masuk/pulang hari ini supaya bisa diabsen
 * lagi. Untuk GPS yang meleset — waktu hanya maju, jadi yang bisa
 * diperbaiki hanya lokasinya. Batas, syarat, dan hitungannya dijaga
 * fungsi database `absen_ulang` (migrasi 0171).
 */
export async function absenUlang(
  tahap: "masuk" | "pulang",
): Promise<Hasil<{ sisa: number } | undefined>> {
  if (tahap !== "masuk" && tahap !== "pulang") {
    return gagal("Tahap absen ulang tidak dikenal.", "validasi");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { data, error } = await sb.rpc("absen_ulang", { p_tahap: tahap });

  if (error) {
    // Pesan dari database sudah ditulis untuk dibaca orang.
    return gagal(error.message.replace(/^.*?: /, ""), "validasi");
  }

  revalidatePath("/absensi");
  revalidatePath("/beranda");

  const sisa = Number(data?.[0]?.sisa ?? 0);
  return sukses(
    { sisa },
    `Catatan absen ${tahap} dihapus. Silakan absen ${tahap} lagi sekarang.`,
  );
}

/**
 * Ajukan izin: sakit hari berjalan, izin terencana sehari atau lebih
 * (minimal H-1), atau izin beberapa jam pada hari berjalan.
 *
 * Izin terencana yang lebih dari sehari disimpan sebagai satu baris
 * absensi per hari — begitulah seluruh aplikasi membaca kehadiran — yang
 * disatukan lewat `izin_induk_id`, sehingga atasan cukup memutuskan
 * sekali (migrasi 0132).
 */
export async function ajukanIzin(input: {
  bentuk: BentukIzin;
  mulai: string;
  selesai?: string;
  jamMulai?: string;
  jamSelesai?: string;
  alasan: string;
}): Promise<Hasil> {
  const isi: IsiIzin = {
    bentuk: input.bentuk,
    mulai: input.mulai,
    selesai: input.selesai ?? input.mulai,
    jamMulai: input.jamMulai ?? "",
    jamSelesai: input.jamSelesai ?? "",
    alasan: input.alasan,
  };
  const hariIni = tanggalHariIni();
  // Sakit dan izin berjam selalu untuk hari berjalan; tanggal kemarin
  // berarti tab izin dibiarkan terbuka sejak sebelum hari berganti.
  if (isi.bentuk !== "terencana" && isi.mulai < hariIni) {
    return gagal(
      "Halaman ini dibuka sebelum hari berganti. Muat ulang halaman, lalu ajukan lagi.",
      "validasi",
    );
  }
  const salah = periksaIzin(isi, hariIni);
  if (salah) return gagal(salah, "validasi");

  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const alasan = isi.alasan.trim();

  if (isi.bentuk === "jam") {
    // Orangnya tetap masuk; statusnya jangan disentuh supaya absen masuk
    // yang menyusul tetap menghitung hadir/terlambat seperti biasa.
    const { error } = await sb.from("attendance").upsert(
      {
        user_id: pengguna.id,
        tanggal: isi.mulai,
        izin_jenis: "jam",
        izin_mulai: isi.jamMulai,
        izin_selesai: isi.jamSelesai,
        alasan,
        persetujuan: "diajukan",
      },
      { onConflict: "user_id,tanggal" },
    );
    if (error) return gagal(...pesanGalatIzin(error));
    segarkanIzin();
    return sukses(
      undefined,
      `Izin ${isi.jamMulai}–${isi.jamSelesai} terkirim, menunggu persetujuan atasan.`,
    );
  }

  if (isi.bentuk === "sakit") {
    // Sakit sehari penuh menggantikan izin beberapa jam yang terlanjur
    // diajukan hari ini. Jamnya harus ikut dilepas: database melarang
    // izin berjam pada baris sakit (0132), dan tanpa ini pengajuannya
    // gagal dengan pesan yang tidak ada hubungannya dengan sakit.
    const { data: ada } = await sb
      .from("attendance")
      .select("izin_jenis")
      .eq("user_id", pengguna.id)
      .eq("tanggal", isi.mulai)
      .maybeSingle();
    const lepasIzinJam =
      ada?.izin_jenis === "jam"
        ? { izin_jenis: null, izin_mulai: null, izin_selesai: null }
        : {};

    const { error } = await sb.from("attendance").upsert(
      {
        user_id: pengguna.id,
        tanggal: isi.mulai,
        status: "sakit",
        alasan,
        persetujuan: "diajukan",
        ...lepasIzinJam,
      },
      { onConflict: "user_id,tanggal" },
    );
    if (error) return gagal(...pesanGalatIzin(error));
    segarkanIzin();
    return sukses(
      undefined,
      "Pengajuan terkirim, menunggu persetujuan atasan.",
    );
  }

  // Terencana: seluruh harinya dibuat satu RPC, satu transaksi. Dua
  // perjalanan terpisah bisa berhenti di tengah dan menyisakan izin
  // sehari yang disangka tiga hari oleh pengajunya (migrasi 0134).
  const hari = tanggalRentang(isi.mulai, isi.selesai);
  const { error } = await sb.rpc("ajukan_izin_terencana", {
    p_mulai: isi.mulai,
    p_selesai: isi.selesai,
    p_alasan: alasan,
  });
  if (error) return gagal(...pesanGalatIzin(error));

  segarkanIzin();
  return sukses(
    undefined,
    hari.length > 1
      ? `Izin ${hari.length} hari terkirim, menunggu satu persetujuan atasan.`
      : "Pengajuan terkirim, menunggu persetujuan atasan.",
  );
}

function segarkanIzin() {
  revalidatePath("/absensi");
  revalidatePath("/absensi/izin");
  revalidatePath("/beranda");
}

/** Pagar database diterjemahkan ke kalimat yang bisa ditindaklanjuti. */
function pesanGalatIzin(error: {
  code?: string;
  message: string;
}): [string, "validasi" | "galat"] {
  if (/paling lambat H-1/.test(error.message)) {
    return [
      "Izin terencana diajukan paling lambat H-1. Untuk hari ini, pilih sakit atau izin beberapa jam.",
      "validasi",
    ];
  }
  if (/jam_izin_lengkap/.test(error.message)) {
    return ["Jam mulai dan jam selesai izin belum benar.", "validasi"];
  }
  if (/jam_izin_tetap_hadir/.test(error.message)) {
    return [
      "Hari ini sudah tercatat izin/sakit sehari penuh, jadi izin berjam tidak berlaku.",
      "validasi",
    ];
  }
  if (
    /attendance_izin_beralasan|jam_izin_beralasan|Tulis alasan minimal/.test(
      error.message,
    )
  ) {
    return ["Tulis alasan minimal 5 karakter.", "validasi"];
  }
  // Pesan ajukan_izin_terencana (0134) sudah ditulis untuk dibaca orang.
  if (/paling lama 30 hari|tidak boleh sebelum tanggal mulai/.test(error.message)) {
    return [`${error.message}.`, "validasi"];
  }
  // Galat yang tidak dikenali dicatat utuh di log server supaya laporan
  // "izin error" berikutnya bisa ditelusuri tanpa menebak.
  console.error("ajukanIzin gagal:", error.code, error.message);
  return [`Gagal menyimpan: ${error.message}`, "galat"];
}

/**
 * Atasan menyetujui atau menolak pengajuan izin/sakit.
 * Database menolak bila yang memutuskan adalah pengaju itu sendiri.
 */
export async function putuskanIzin(
  attendanceId: string,
  keputusan: "disetujui" | "ditolak",
  alasan = "",
): Promise<Hasil> {
  // Penolakan tanpa keterangan hanya menyisakan pertanyaan bagi pengaju;
  // database menolaknya juga (migrasi 0133), ini supaya pesannya jelas
  // sebelum perjalanan bolak-balik.
  if (keputusan === "ditolak" && alasan.trim().length < MIN_ALASAN_TOLAK) {
    return gagal(
      `Tulis alasan penolakan minimal ${MIN_ALASAN_TOLAK} karakter.`,
      "validasi",
    );
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { data, error } = await sb
    .from("attendance")
    .update({
      persetujuan: keputusan,
      disetujui_oleh: pengguna.id,
      disetujui_pada: new Date().toISOString(),
      alasan_keputusan: keputusan === "ditolak" ? alasan.trim() : "",
    })
    .eq("id", attendanceId)
    // Hanya pengajuan yang masih menunggu; mencegah keputusan ganda
    // saat dua atasan membuka layar yang sama.
    .eq("persetujuan", "diajukan")
    .select("id")
    .maybeSingle();

  if (error) {
    return error.message.includes("diputuskan atasan")
      ? gagal("Pengajuanmu sendiri harus diputuskan atasan.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  if (!data) {
    return gagal(
      "Pengajuan ini sudah diputuskan atau bukan wewenangmu.",
      "izin",
    );
  }

  segarkanIzin();
  return sukses(
    undefined,
    keputusan === "disetujui"
      ? "Pengajuan disetujui; telat hari itu langsung dihitung ulang."
      : "Pengajuan ditolak beserta alasannya.",
  );
}
