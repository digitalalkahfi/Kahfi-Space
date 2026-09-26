// Modul khusus server. Impor dari komponen klien akan gagal saat build,
// bukan diam-diam bocor ke browser.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { aktifDemo } from "@/lib/demo";
import { jamEfektifMasuk, menitTelat } from "@/lib/izin";
import {
  daftarHariKerja,
  susunRekapOrang,
  wajibAbsen,
  type BarisKehadiranOrang,
  type RekapOrang,
} from "@/lib/rekap-kehadiran";
import type { Peran, Pengguna } from "@/lib/types";
import type {
  JenisIzinDb,
  StatusKehadiranDb,
  StatusPersetujuanDb,
} from "@/lib/supabase/types";

export type { RekapOrang };

/** Batas masuk mode demo: 08:00 + toleransi 15 menit (migrasi 0010). */
const BATAS_MASUK_DEMO = "08:15";

/** Jam WIB dari cap waktu ISO. */
function jamLokalWib(iso: string) {
  return new Date(iso)
    .toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    })
    .slice(0, 5);
}

type UserContoh = (typeof dataContoh.users)[number];
type AbsenContoh = (typeof dataContoh.attendance)[number] & {
  izin_jenis?: string | null;
  izin_selesai?: string | null;
};

/**
 * Padanan `boleh_orang` (migrasi 0002) untuk mode demo: CEO & Manager
 * melihat semua; Leader & Co-Leader unitnya dan bawahan langsungnya;
 * yang lain hanya dirinya sendiri.
 */
function dalamCakupanDemo(pengguna: Pengguna, u: UserContoh) {
  if (u.nama === pengguna.nama) return true;
  if (pengguna.role === "CEO" || pengguna.role === "Manager") return true;
  if (pengguna.role === "Leader" || pengguna.role === "Co-Leader") {
    return (
      (pengguna.unitId !== null && u.unit === pengguna.unitId) ||
      u.atasan === pengguna.nama
    );
  }
  return false;
}

function rekapDemo(
  pengguna: Pengguna,
  dari: string,
  sampai: string,
  hanyaSaya: boolean,
): RekapOrang[] {
  const { users, units, attendance, agenda } = dataContoh;
  const hariIni = dataContoh.tanggalAcuan;
  const libur = new Set(
    agenda.filter((g) => g.jenis === "libur" && !g.unit).map((g) => g.tanggal),
  );
  // Hari yang belum datang tidak bisa ditagih.
  const hari = daftarHariKerja(
    dari,
    hariIni < sampai ? hariIni : sampai,
    libur,
  );

  // Padanan tanggal terdaftar di SQL: data contoh tidak punya kolom itu,
  // jadi orang tanpa catatan dianggap terdaftar sejak absensi tertua.
  const terdaftar =
    attendance
      .map((a) => a.tanggal)
      .filter((t) => t <= hariIni)
      .sort()[0] ?? hariIni;

  const baris: BarisKehadiranOrang[] = [];

  for (const u of users) {
    if (!aktifDemo(u)) continue;
    if (!dalamCakupanDemo(pengguna, u)) continue;
    if (hanyaSaya && u.nama !== pengguna.nama) continue;

    const milik = attendance.filter((a) => a.user === u.nama) as AbsenContoh[];
    const wajib = wajibAbsen(u.role as Peran);
    // Sama seperti SQL: ditagih sejak terdaftar atau absen pertamanya,
    // mana yang lebih dulu.
    const mulai = [terdaftar, ...milik.map((a) => a.tanggal)].sort()[0];

    const tanggal = new Set<string>();
    if (wajib) for (const t of hari) if (t >= mulai) tanggal.add(t);
    for (const a of milik) {
      if (a.tanggal >= dari && a.tanggal <= sampai) tanggal.add(a.tanggal);
    }

    const unit = u.unit
      ? (units.find((x) => x.kode === u.unit)?.nama.split(" (")[0] ?? "")
      : "Manajemen";

    for (const t of tanggal) {
      const a = milik.find((x) => x.tanggal === t);
      const efektif = a
        ? jamEfektifMasuk(BATAS_MASUK_DEMO, {
            jamSelesai:
              a.izin_jenis === "jam" ? (a.izin_selesai ?? null) : null,
            disetujui: a.persetujuan === "disetujui",
          })
        : BATAS_MASUK_DEMO;
      const telat = a?.jam_masuk
        ? menitTelat(jamLokalWib(a.jam_masuk), efektif)
        : 0;
      // Padanan `hitung_absensi`: hadir/terlambat ditentukan ulang dari
      // jam efektif masuk, bukan dibaca apa adanya dari seed.
      const status: StatusKehadiranDb | null = !a
        ? null
        : a.status === "hadir" || a.status === "terlambat"
          ? telat > 0
            ? "terlambat"
            : "hadir"
          : (a.status as StatusKehadiranDb);

      baris.push({
        userId: u.id,
        nama: u.nama,
        unit,
        role: u.role as Peran,
        wajibAbsen: wajib,
        tanggal: t,
        status,
        jamMasuk: a?.jam_masuk ?? null,
        jamPulang: null,
        menitTelat: telat,
        izinJenis: (a?.izin_jenis as JenisIzinDb | undefined) ?? null,
        izinSelesai: a?.izin_selesai ?? null,
        lokasiValid: a?.jam_masuk ? true : false,
        alasan: a?.alasan ?? "",
        persetujuan: (a?.persetujuan as StatusPersetujuanDb | null) ?? null,
      });
    }
  }

  return susunRekapOrang(baris, hariIni);
}

/**
 * Rekap kehadiran per orang dalam satu rentang, termasuk hari kerja
 * tanpa catatan. Cakupannya ditentukan basis data (`boleh_orang`):
 * CEO & Manager seluruh tim, Leader & Co-Leader unitnya, sisanya diri
 * sendiri. `hanyaSaya` mempersempit ke diri sendiri.
 */
export async function rekapKehadiranOrang(
  pengguna: Pengguna,
  dari: string,
  sampai: string,
  hanyaSaya: boolean,
  hariIni: string,
): Promise<RekapOrang[]> {
  if (modeData() === "demo")
    return rekapDemo(pengguna, dari, sampai, hanyaSaya);

  const sb = await klienServer();
  const { data, error } = await sb.rpc("rekap_kehadiran_orang", {
    p_dari: dari,
    p_sampai: sampai,
    p_user: hanyaSaya ? pengguna.id : null,
  });

  if (error) throw new Error(`Gagal memuat rekap kehadiran: ${error.message}`);

  return susunRekapOrang(
    (data ?? []).map((b) => ({
      userId: b.user_id,
      nama: b.nama,
      unit: b.unit_nama,
      role: b.role as Peran,
      wajibAbsen: b.wajib_absen,
      tanggal: b.tanggal,
      status: b.status,
      jamMasuk: b.jam_masuk,
      jamPulang: b.jam_pulang,
      menitTelat: Number(b.menit_telat ?? 0),
      izinJenis: b.izin_jenis,
      izinSelesai: b.izin_selesai,
      lokasiValid: b.lokasi_valid,
      alasan: b.alasan,
      persetujuan: b.persetujuan,
    })),
    hariIni,
  );
}
