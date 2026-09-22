"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";

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
    Math.abs(t.lng) <= 180
  );
}

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
      "Absen hanya bisa dilakukan untuk hari ini. Untuk tanggal lain, ajukan izin.",
      "validasi",
    );
  }

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  // Status terlambat, validitas lokasi, dan jaraknya dihitung trigger database;
  // hasilnya diambil kembali supaya UI melaporkan angka yang sama persis.
  const { data, error } = await sb
    .from("attendance")
    .insert({
      user_id: pengguna.id,
      tanggal: input.tanggal,
      jam_masuk: new Date().toISOString(),
      lat_masuk: input.titik.lat,
      lng_masuk: input.titik.lng,
      foto_masuk_url: input.fotoUrl ?? null,
    })
    .select("status, terlambat, lokasi_valid, jarak_masuk_m, jam_masuk")
    .single();

  if (error) {
    return error.code === "23505"
      ? gagal("Kamu sudah absen masuk hari ini.", "validasi")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

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
    return gagal("Absen pulang hanya untuk hari ini.", "validasi");
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

/** Ajukan izin atau sakit; menunggu persetujuan atasan. */
export async function ajukanIzin(input: {
  tanggal: string;
  jenis: "izin" | "sakit";
  alasan: string;
}): Promise<Hasil> {
  if (input.alasan.trim().length < 5) {
    return gagal("Tulis alasan singkat agar atasan bisa menilai.", "validasi");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { error } = await sb.from("attendance").upsert(
    {
      user_id: pengguna.id,
      tanggal: input.tanggal,
      status: input.jenis,
      alasan: input.alasan.trim(),
      persetujuan: "diajukan",
    },
    { onConflict: "user_id,tanggal" },
  );

  if (error) return gagal(`Gagal menyimpan: ${error.message}`);

  revalidatePath("/absensi");
  revalidatePath("/beranda");
  return sukses(undefined, "Pengajuan terkirim, menunggu persetujuan atasan.");
}

/**
 * Atasan menyetujui atau menolak pengajuan izin/sakit.
 * Database menolak bila yang memutuskan adalah pengaju itu sendiri.
 */
export async function putuskanIzin(
  attendanceId: string,
  keputusan: "disetujui" | "ditolak",
): Promise<Hasil> {
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

  revalidatePath("/absensi");
  revalidatePath("/absensi/izin");
  return sukses(
    undefined,
    keputusan === "disetujui" ? "Pengajuan disetujui." : "Pengajuan ditolak.",
  );
}
