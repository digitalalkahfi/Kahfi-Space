// Modul khusus server. Impor dari komponen klien akan gagal saat build,
// bukan diam-diam bocor ke browser.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { jamEfektifMasuk, menitTelat } from "@/lib/izin";
import { batasMinimum } from "@/lib/batas-minimum";
import type { AnggotaKehadiran, Pengguna, StatusAbsen } from "@/lib/types";

export type RekapKehadiran = {
  tim: AnggotaKehadiran[];
  total: number;
  sudahAbsen: number;
  /** Jumlah orang yang punya sasaran laporan harian. */
  wajibLapor: number;
  sudahLapor: number;
  /** Berapa orang telat hari ini, dan totalnya berapa menit. */
  telat: number;
  totalMenitTelat: number;
};

/** `alpa` di database = "belum absen" dalam bahasa antarmuka. */
function keStatus(s: string): StatusAbsen {
  return s === "alpa" ? "belum_absen" : (s as StatusAbsen);
}

function rangkum(tim: AnggotaKehadiran[]): RekapKehadiran {
  const wajib = tim.filter((a) => a.wajibLapor);
  return {
    tim,
    total: tim.length,
    sudahAbsen: tim.filter(
      (a) => a.statusAbsen === "hadir" || a.statusAbsen === "terlambat",
    ).length,
    // Penyebutnya orang yang memang punya sasaran lapor, bukan seluruh tim.
    wajibLapor: wajib.length,
    sudahLapor: wajib.filter((a) => a.sudahLapor).length,
    // Menit telat sudah memperhitungkan izin berjam yang disetujui, jadi
    // orang yang izinnya disetujui tidak ikut terhitung telat.
    telat: tim.filter((a) => a.menitTelat > 0).length,
    totalMenitTelat: tim.reduce((a, x) => a + x.menitTelat, 0),
  };
}

/** Cakupan sama dengan RLS: Leader & Co-Leader hanya unitnya sendiri. */
function dalamCakupan(pengguna: Pengguna, unitNama: string) {
  if (pengguna.role === "CEO" || pengguna.role === "Manager") return true;
  if (!pengguna.unitId) return false;
  const milik = { affiliator: "Affiliator", mcn: "MCN", tap: "TAP" }[
    pengguna.unitId
  ];
  return unitNama.startsWith(milik);
}

/**
 * Batas masuk mode demo: jam kerja 08:00 + toleransi 15 menit, sama
 * dengan nilai bawaan tabel `pengaturan` (migrasi 0010). Mode demo tidak
 * punya tabel itu, tapi angkanya harus sama supaya rekapnya tidak beda.
 */
const BATAS_MASUK_DEMO = "08:15";

/** Jam WIB dari cap waktu ISO, untuk dibandingkan dengan batas masuk. */
function jamLokal(iso: string) {
  return new Date(iso)
    .toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    })
    .slice(0, 5);
}

/**
 * Status kehadiran contoh setelah jam efektif diperhitungkan.
 * Izin & sakit tidak ikut dihitung ulang — keduanya bukan soal jam.
 */
function statusDemo(status: string, telat: number): StatusAbsen {
  if (status === "hadir" || status === "terlambat") {
    return telat > 0 ? "terlambat" : "hadir";
  }
  return keStatus(status);
}

/** Batas masuk yang berlaku bagi satu baris absensi contoh. */
function efektifDemo(a: {
  izin_jenis?: string | null;
  izin_selesai?: string | null;
  persetujuan?: string | null;
}) {
  return jamEfektifMasuk(BATAS_MASUK_DEMO, {
    jamSelesai: a.izin_jenis === "jam" ? (a.izin_selesai ?? null) : null,
    disetujui: a.persetujuan === "disetujui",
  });
}

function hitungDemo(pengguna: Pengguna, tanggal: string): RekapKehadiran {
  const { users, units, attendance, daily_reports, accounts } = dataContoh;

  const pelapor = new Set(
    daily_reports.filter((l) => l.tanggal === tanggal).map((l) => l.user),
  );

  // Padanan `wajib_lapor_harian` di SQL: PIC akun aktif, plus Leader unit
  // yang tidak punya akun (MCN & TAP melapor per unit).
  const picAkun = new Set(accounts.map((a) => a.pic));
  const unitBerakun = new Set(accounts.map((a) => a.unit));
  const wajibLapor = (u: (typeof users)[number]) =>
    picAkun.has(u.nama) ||
    (u.role === "Leader" &&
      Boolean(u.unit) &&
      !unitBerakun.has(u.unit as string));

  const tim = users
    .map((u) => {
      const unitNama = u.unit
        ? (units.find((x) => x.kode === u.unit)?.nama.split(" (")[0] ?? "")
        : "Manajemen";
      // Tanggalnya ikut dicocokkan: seed menyimpan beberapa hari, dan
      // baris pertama milik seseorang belum tentu hari yang diminta.
      const a = attendance.find(
        (x) => x.user === u.nama && x.tanggal === tanggal,
      );
      const telat = a?.jam_masuk
        ? menitTelat(jamLokal(a.jam_masuk), efektifDemo(a))
        : 0;
      return {
        id: u.id,
        nama: u.nama,
        inisial: u.inisial,
        fotoUrl: null,
        unit: unitNama,
        // Padanan `hitung_absensi` di SQL: hadir/terlambat ditentukan
        // ulang dari jam efektif masuk, bukan dibaca apa adanya dari seed.
        statusAbsen: statusDemo(a?.status ?? "alpa", telat),
        jamMasuk: a?.jam_masuk ?? null,
        menitTelat: telat,
        izinSampai:
          a?.izin_jenis === "jam" && a?.persetujuan === "disetujui"
            ? (a.izin_selesai ?? null)
            : null,
        wajibLapor: wajibLapor(u),
        sudahLapor: pelapor.has(u.nama),
        ...unggahanDemo(u.nama, tanggal),
      } satisfies AnggotaKehadiran;
    })
    .filter((a) => dalamCakupan(pengguna, a.unit))
    .sort((a, b) => a.nama.localeCompare(b.nama));

  return rangkum(tim);
}

/**
 * Padanan dua kolom baru `status_tim_harian` (migrasi 0145) untuk mode
 * demo: unggahan hari itu dan batas minimumnya, sama-sama dijumlahkan
 * seluruh akun yang dipegang orang tersebut.
 */
function unggahanDemo(nama: string, tanggal: string) {
  const { accounts, daily_reports } = dataContoh;
  const miliknya = accounts.filter((a) => a.pic === nama);
  if (miliknya.length === 0)
    return { unggahanHariIni: null, minimumUnggahan: null };

  const username = new Set(miliknya.map((a) => a.username));
  const laporan = daily_reports.filter(
    (l) =>
      l.tanggal === tanggal &&
      l.akun !== null &&
      username.has(l.akun) &&
      (l as { jumlah_upload?: number }).jumlah_upload !== undefined,
  );

  const batas = miliknya
    .map((a) => batasMinimum((a as { level?: number }).level ?? null))
    .filter((m) => m !== null);

  return {
    unggahanHariIni:
      laporan.length === 0
        ? null
        : laporan.reduce(
            (a, l) =>
              a + ((l as { jumlah_upload?: number }).jumlah_upload ?? 0),
            0,
          ),
    minimumUnggahan:
      batas.length === 0 ? null : batas.reduce((a, b) => a + b, 0),
  };
}

type BarisStatus = {
  user_id: string;
  nama: string;
  inisial: string;
  unit_nama: string;
  status: string;
  jam_masuk: string | null;
  menit_telat: number;
  izin_jenis: string | null;
  izin_selesai: string | null;
  wajib_lapor: boolean;
  sudah_lapor: boolean;
  unggahan_hari_ini: number | null;
  minimum_unggahan: number | null;
};

/**
 * Siapa sudah absen dan siapa belum kirim laporan hari ini.
 * Dihitung PostgreSQL lewat `status_tim_harian`; RLS membatasi barisnya.
 */
export async function rekapKehadiran(
  pengguna: Pengguna,
  tanggal: string,
): Promise<RekapKehadiran> {
  if (modeData() === "demo") return hitungDemo(pengguna, tanggal);

  const sb = await klienServer();
  const { data, error } = await sb.rpc("status_tim_harian", {
    p_tanggal: tanggal,
  });

  if (error) throw new Error(`Gagal memuat kehadiran: ${error.message}`);

  const tim: AnggotaKehadiran[] = (data as unknown as BarisStatus[]).map(
    (b) => ({
      id: b.user_id,
      nama: b.nama,
      inisial: b.inisial,
      fotoUrl: null,
      unit: b.unit_nama,
      statusAbsen: keStatus(b.status),
      jamMasuk: b.jam_masuk,
      menitTelat: Number(b.menit_telat ?? 0),
      izinSampai: b.izin_jenis === "jam" ? b.izin_selesai : null,
      wajibLapor: b.wajib_lapor,
      sudahLapor: b.sudah_lapor,
      unggahanHariIni: b.unggahan_hari_ini,
      minimumUnggahan: b.minimum_unggahan,
    }),
  );

  return rangkum(tim);
}
