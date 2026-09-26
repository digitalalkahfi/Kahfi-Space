// Modul khusus server. Impor dari komponen klien akan gagal saat build,
// bukan diam-diam bocor ke browser.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { jamEfektifMasuk, menitTelat } from "@/lib/izin";
import { KANTOR, jarakDariKantor } from "@/lib/geo";
import type { Pengguna, StatusAbsen } from "@/lib/types";

export type PengaturanAbsensi = {
  jamMasuk: string;
  toleransiMenit: number;
  radiusMeter: number;
};

export type AbsensiHariIni = {
  ada: boolean;
  status: StatusAbsen;
  jamMasuk: string | null;
  jamPulang: string | null;
  lokasiValid: boolean;
  jarakMeter: number | null;
  terlambat: boolean;
  /** Alasan izin/sakit, bila statusnya itu. */
  alasan: string;
  /** Status persetujuan pengajuan izin/sakit. */
  persetujuan: "diajukan" | "disetujui" | "ditolak" | null;
  /** Selisih menit dari batas jam masuk; negatif berarti lebih awal. */
  selisihMenit: number | null;
  /** Laporan harian hari ini sudah terkirim — kunci Absen Pulang. */
  sudahLapor: boolean;
  /** Berapa kali absen masuk/pulang hari ini sudah diulang (migrasi 0171). */
  ulangMasuk: number;
  ulangPulang: number;
};

const KOSONG: AbsensiHariIni = {
  ada: false,
  status: "belum_absen",
  jamMasuk: null,
  jamPulang: null,
  lokasiValid: false,
  jarakMeter: null,
  terlambat: false,
  alasan: "",
  persetujuan: null,
  selisihMenit: null,
  sudahLapor: false,
  ulangMasuk: 0,
  ulangPulang: 0,
};

/** Pengaturan operasional absensi; nilai bawaan bila belum diatur. */
export async function pengaturanAbsensi(): Promise<PengaturanAbsensi> {
  const bawaan: PengaturanAbsensi = {
    jamMasuk: "08:00",
    toleransiMenit: 15,
    radiusMeter: KANTOR.radius,
  };
  if (modeData() === "demo") return bawaan;

  const sb = await klienServer();
  const { data } = await sb
    .from("pengaturan")
    .select("jam_masuk, toleransi_menit, radius_meter")
    .maybeSingle();

  return data
    ? {
        jamMasuk: data.jam_masuk.slice(0, 5),
        toleransiMenit: data.toleransi_menit,
        radiusMeter: data.radius_meter,
      }
    : bawaan;
}

/**
 * Selisih menit antara jam masuk tercatat dan batas toleransi.
 * Positif = terlambat sekian menit, negatif = lebih awal.
 */
export function selisihDariBatas(
  jamMasukIso: string,
  tanggal: string,
  jamMasukAturan: string,
  toleransiMenit: number,
) {
  const masuk = new Date(jamMasukIso);
  const batas = new Date(`${tanggal}T${jamMasukAturan}:00+07:00`);
  batas.setMinutes(batas.getMinutes() + toleransiMenit);
  return Math.round((masuk.getTime() - batas.getTime()) / 60_000);
}

/**
 * Keadaan absensi pengguna hari ini, termasuk apakah laporan hariannya
 * sudah masuk — dua hal yang menentukan terbuka atau terkuncinya
 * tombol Absen Pulang (PRD §2).
 */
export async function absensiHariIni(
  pengguna: Pengguna,
  tanggal: string,
): Promise<AbsensiHariIni> {
  if (modeData() === "demo") {
    const { attendance, daily_reports, accounts } = dataContoh;
    // Harus dicocokkan tanggalnya: seed menyimpan beberapa hari
    // sekaligus, dan baris pertama milik orang itu belum tentu hari ini.
    const a = attendance.find(
      (x) => x.user === pengguna.nama && x.tanggal === tanggal,
    );
    const akunSaya = accounts.filter((x) => x.pic === pengguna.nama);
    const unitBerakun = new Set(accounts.map((a) => a.unit));
    const wajibLapor =
      akunSaya.length > 0 ||
      (pengguna.role === "Leader" &&
        Boolean(pengguna.unitId) &&
        !unitBerakun.has(pengguna.unitId as string));

    const punyaLaporan = daily_reports.some(
      (l) =>
        l.tanggal === tanggal &&
        (l.user === pengguna.nama ||
          (l.akun ? akunSaya.some((a) => a.username === l.akun) : false)),
    );

    // Yang tidak punya sasaran lapor tidak pernah terkunci (lihat migrasi 0016).
    const sudahLapor = wajibLapor ? punyaLaporan : true;

    if (!a) return { ...KOSONG, sudahLapor };

    const jarak = jarakDariKantor(a);
    return {
      ada: true,
      status: (a.status === "alpa" ? "belum_absen" : a.status) as StatusAbsen,
      jamMasuk: a.jam_masuk ?? null,
      jamPulang: null,
      lokasiValid: jarak !== null && jarak <= KANTOR.radius,
      jarakMeter: jarak,
      terlambat: a.status === "terlambat",
      alasan: a.alasan ?? "",
      persetujuan: (a.persetujuan as AbsensiHariIni["persetujuan"]) ?? null,
      selisihMenit: a.jam_masuk
        ? selisihDariBatas(a.jam_masuk, tanggal, "08:00", 15)
        : null,
      sudahLapor,
      ulangMasuk: 0,
      ulangPulang: 0,
    };
  }

  const sb = await klienServer();
  const [{ data: absen }, { count }] = await Promise.all([
    sb
      .from("attendance")
      .select(
        "status, jam_masuk, jam_pulang, lokasi_valid, jarak_masuk_m, terlambat, alasan, persetujuan, ulang_masuk, ulang_pulang",
      )
      .eq("user_id", pengguna.id)
      .eq("tanggal", tanggal)
      .maybeSingle(),
    sb
      .from("daily_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", pengguna.id)
      .eq("tanggal", tanggal),
  ]);

  const sudahLapor = (count ?? 0) > 0;
  if (!absen) return { ...KOSONG, sudahLapor };

  const aturan = await pengaturanAbsensi();
  return {
    ada: true,
    status: (absen.status === "alpa"
      ? "belum_absen"
      : absen.status) as StatusAbsen,
    jamMasuk: absen.jam_masuk,
    jamPulang: absen.jam_pulang,
    lokasiValid: absen.lokasi_valid,
    jarakMeter: absen.jarak_masuk_m,
    terlambat: absen.terlambat,
    alasan: absen.alasan ?? "",
    persetujuan: absen.persetujuan,
    selisihMenit: absen.jam_masuk
      ? selisihDariBatas(
          absen.jam_masuk,
          tanggal,
          aturan.jamMasuk,
          aturan.toleransiMenit,
        )
      : null,
    sudahLapor,
    ulangMasuk: absen.ulang_masuk,
    ulangPulang: absen.ulang_pulang,
  };
}

export type BarisRekapAbsensi = {
  nama: string;
  unit: string;
  tanggal: string;
  status: StatusAbsen;
  jamMasuk: string | null;
  jamPulang: string | null;
  terlambat: boolean;
  /** Menit telat terhadap jam efektif masuk (migrasi 0132/0135). */
  menitTelat: number;
  /** Jam selesai izin berjam yang disetujui hari itu, bila ada. */
  izinSelesai: string | null;
  lokasiValid: boolean;
  jarakMeter: number | null;
  alasan: string;
  sudahLapor: boolean;
  /** Berapa kali absen masuk/pulang hari itu diulang (migrasi 0171). */
  ulangMasuk: number;
  ulangPulang: number;
};

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

/**
 * Rekap kehadiran satu rentang tanggal.
 * `hanyaSaya` membatasi ke diri sendiri; tanpa itu, cakupannya ditentukan
 * RLS — Staff tetap hanya melihat yang berhak ia lihat.
 */
export async function rekapAbsensi(
  pengguna: Pengguna,
  dari: string,
  sampai: string,
  hanyaSaya = false,
): Promise<BarisRekapAbsensi[]> {
  if (modeData() === "demo") {
    const { attendance, users, units, daily_reports, accounts } = dataContoh;
    const akunPic = new Map(accounts.map((a) => [a.username, a.pic]));

    const pelapor = new Set(
      daily_reports.map((l) =>
        [l.tanggal, l.akun ? akunPic.get(l.akun) : l.user].join("|"),
      ),
    );

    return attendance
      .filter((a) => a.tanggal >= dari && a.tanggal <= sampai)
      .filter((a) => !hanyaSaya || a.user === pengguna.nama)
      .map((a) => {
        const u = users.find((x) => x.nama === a.user);
        const unit = u?.unit
          ? (units.find((x) => x.kode === u.unit)?.nama.split(" (")[0] ?? "")
          : "Manajemen";
        const jarak = jarakDariKantor(a);
        const efektif = jamEfektifMasuk(BATAS_MASUK_DEMO, {
          jamSelesai:
            (a as { izin_jenis?: string }).izin_jenis === "jam"
              ? ((a as { izin_selesai?: string }).izin_selesai ?? null)
              : null,
          disetujui: a.persetujuan === "disetujui",
        });
        const telat = a.jam_masuk
          ? menitTelat(jamLokalWib(a.jam_masuk), efektif)
          : 0;
        return {
          nama: a.user,
          unit,
          tanggal: a.tanggal,
          // Sama seperti `hitung_absensi`: hadir/terlambat ditentukan
          // ulang dari jam efektif masuk.
          status:
            a.status === "hadir" || a.status === "terlambat"
              ? ((telat > 0 ? "terlambat" : "hadir") as StatusAbsen)
              : ((a.status === "alpa"
                  ? "belum_absen"
                  : a.status) as StatusAbsen),
          jamMasuk: a.jam_masuk ?? null,
          jamPulang: null,
          terlambat: telat > 0,
          menitTelat: telat,
          izinSelesai:
            (a as { izin_jenis?: string }).izin_jenis === "jam" &&
            a.persetujuan === "disetujui"
              ? ((a as { izin_selesai?: string }).izin_selesai ?? null)
              : null,
          lokasiValid: jarak !== null && jarak <= KANTOR.radius,
          jarakMeter: jarak,
          alasan: a.alasan ?? "",
          sudahLapor: pelapor.has([a.tanggal, a.user].join("|")),
          ulangMasuk: 0,
          ulangPulang: 0,
        };
      })
      .sort(
        (x, y) =>
          y.tanggal.localeCompare(x.tanggal) || x.nama.localeCompare(y.nama),
      );
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("rekap_absensi", {
    p_dari: dari,
    p_sampai: sampai,
    p_user: hanyaSaya ? pengguna.id : null,
  });

  if (error) throw new Error(`Gagal memuat rekap absensi: ${error.message}`);

  return (data ?? []).map((b) => ({
    nama: b.nama,
    unit: b.unit_nama,
    tanggal: b.tanggal,
    status: (b.status === "alpa" ? "belum_absen" : b.status) as StatusAbsen,
    jamMasuk: b.jam_masuk,
    jamPulang: b.jam_pulang,
    terlambat: b.terlambat,
    menitTelat: Number(b.menit_telat ?? 0),
    izinSelesai: b.izin_jenis === "jam" ? b.izin_selesai : null,
    lokasiValid: b.lokasi_valid,
    jarakMeter: b.jarak_masuk_m,
    alasan: b.alasan,
    sudahLapor: b.sudah_lapor,
    ulangMasuk: Number(b.ulang_masuk ?? 0),
    ulangPulang: Number(b.ulang_pulang ?? 0),
  }));
}

export type PengajuanIzin = {
  id: string;
  nama: string;
  inisial: string;
  unit: string;
  tanggal: string;
  /** Hari terakhir izin terencana; sama dengan `tanggal` bila sehari. */
  sampai: string;
  jenis: "izin" | "sakit" | "jam";
  /** Jam izin, hanya untuk izin berjam. */
  jamMulai: string | null;
  jamSelesai: string | null;
  alasan: string;
  persetujuan: "diajukan" | "disetujui" | "ditolak";
  /** Keterangan atasan saat menolak. */
  alasanKeputusan: string;
};

/**
 * Pengajuan izin/sakit yang menunggu keputusan.
 * RLS memastikan seorang atasan hanya melihat pengajuan bawahannya.
 */
export async function pengajuanMenunggu(
  pengguna: Pengguna,
): Promise<PengajuanIzin[]> {
  if (modeData() === "demo") {
    const { attendance, users, units } = dataContoh;
    const lintas = pengguna.role === "CEO" || pengguna.role === "Manager";

    return attendance
      .filter((a) => a.persetujuan === "diajukan")
      .filter((a) => {
        if (lintas) return true;
        const u = users.find((x) => x.nama === a.user);
        return u?.atasan === pengguna.nama || u?.unit === pengguna.unitId;
      })
      .map((a, i) => {
        const u = users.find((x) => x.nama === a.user);
        return {
          id: `contoh-${i}`,
          nama: a.user,
          inisial: u?.inisial ?? "?",
          unit: u?.unit
            ? (units.find((x) => x.kode === u.unit)?.nama.split(" (")[0] ?? "")
            : "Manajemen",
          tanggal: a.tanggal,
          sampai: a.tanggal,
          jenis: a.status as "izin" | "sakit",
          jamMulai: null,
          jamSelesai: null,
          alasan: a.alasan ?? "",
          persetujuan: "diajukan" as const,
          alasanKeputusan: "",
        };
      });
  }

  const sb = await klienServer();
  // Izin berjam tetap berstatus hadir/terlambat — orangnya memang masuk —
  // jadi antrean tidak boleh disaring lewat `status` saja (migrasi 0132).
  const { data, error } = await sb
    .from("attendance")
    .select(
      `id, tanggal, status, alasan, persetujuan, alasan_keputusan,
       izin_jenis, izin_mulai, izin_selesai,
       users:user_id (nama, units:unit_id (nama))`,
    )
    .eq("persetujuan", "diajukan")
    // Hari lanjutan izin terencana ikut hari pertamanya; satu pengajuan,
    // satu keputusan.
    .is("izin_induk_id", null)
    .or("status.in.(izin,sakit),izin_jenis.eq.jam")
    .order("tanggal", { ascending: false });

  if (error) throw new Error(`Gagal memuat pengajuan: ${error.message}`);

  // Hari terakhir tiap izin terencana, supaya antrean bisa menyebut
  // "3 hari" alih-alih hanya tanggal pertamanya.
  const { data: lanjutan } = await sb
    .from("attendance")
    .select("izin_induk_id, tanggal")
    .in(
      "izin_induk_id",
      (data ?? []).map((a) => a.id),
    );
  const hariTerakhir = new Map<string, string>();
  for (const l of lanjutan ?? []) {
    if (!l.izin_induk_id) continue;
    const kini = hariTerakhir.get(l.izin_induk_id);
    if (!kini || l.tanggal > kini) hariTerakhir.set(l.izin_induk_id, l.tanggal);
  }

  return (data ?? []).map((a) => {
    const u = a.users as unknown as {
      nama: string;
      units: { nama: string } | null;
    } | null;
    const nama = u?.nama ?? "—";
    const bagian = nama.trim().split(/\s+/);
    return {
      id: a.id,
      nama,
      inisial: (
        (bagian[0]?.[0] ?? "") +
        (bagian.length > 1 ? (bagian.at(-1)?.[0] ?? "") : "")
      ).toUpperCase(),
      unit: u?.units?.nama.split(" (")[0] ?? "Manajemen",
      tanggal: a.tanggal,
      sampai: hariTerakhir.get(a.id) ?? a.tanggal,
      jenis: a.izin_jenis === "jam" ? "jam" : (a.status as "izin" | "sakit"),
      jamMulai: a.izin_mulai,
      jamSelesai: a.izin_selesai,
      alasan: a.alasan,
      persetujuan: "diajukan" as const,
      alasanKeputusan: a.alasan_keputusan,
    };
  });
}

/** Satu pengajuan izin milik sendiri, beserta keputusannya. */
export type IzinSaya = {
  id: string;
  tanggal: string;
  sampai: string;
  jenis: "izin" | "sakit" | "jam";
  jamMulai: string | null;
  jamSelesai: string | null;
  alasan: string;
  persetujuan: "diajukan" | "disetujui" | "ditolak";
  alasanKeputusan: string;
  diputusOleh: string | null;
};

/**
 * Pengajuan izin milik pengguna sendiri.
 *
 * Tanpa daftar ini, pengaju tidak punya tempat melihat keputusannya —
 * termasuk alasan penolakan, yang justru bagian terpentingnya.
 */
export async function izinSaya(
  pengguna: Pengguna,
  sejak: string,
  batas = 20,
): Promise<IzinSaya[]> {
  if (modeData() === "demo") {
    const { attendance } = dataContoh;
    return attendance
      .filter((a) => a.user === pengguna.nama && a.persetujuan)
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
      .slice(0, batas)
      .map((a, i) => ({
        id: `contoh-izin-${i}`,
        tanggal: a.tanggal,
        sampai: a.tanggal,
        jenis: a.status as "izin" | "sakit",
        jamMulai: null,
        jamSelesai: null,
        alasan: a.alasan ?? "",
        persetujuan: a.persetujuan as IzinSaya["persetujuan"],
        alasanKeputusan: "",
        diputusOleh: null,
      }));
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("attendance")
    .select(
      `id, tanggal, status, alasan, persetujuan, alasan_keputusan,
       izin_jenis, izin_mulai, izin_selesai,
       pemutus:disetujui_oleh (nama)`,
    )
    .eq("user_id", pengguna.id)
    .not("persetujuan", "is", null)
    .is("izin_induk_id", null)
    .gte("tanggal", sejak)
    .order("tanggal", { ascending: false })
    .limit(batas);

  if (error) throw new Error(`Gagal memuat izin: ${error.message}`);

  const induk = (data ?? []).map((a) => a.id);
  const { data: lanjutan } = await sb
    .from("attendance")
    .select("izin_induk_id, tanggal")
    .in("izin_induk_id", induk);

  const hariTerakhir = new Map<string, string>();
  for (const l of lanjutan ?? []) {
    if (!l.izin_induk_id) continue;
    const kini = hariTerakhir.get(l.izin_induk_id);
    if (!kini || l.tanggal > kini) hariTerakhir.set(l.izin_induk_id, l.tanggal);
  }

  return (data ?? []).map((a) => ({
    id: a.id,
    tanggal: a.tanggal,
    sampai: hariTerakhir.get(a.id) ?? a.tanggal,
    jenis: a.izin_jenis === "jam" ? "jam" : (a.status as "izin" | "sakit"),
    jamMulai: a.izin_mulai,
    jamSelesai: a.izin_selesai,
    alasan: a.alasan,
    persetujuan: a.persetujuan as IzinSaya["persetujuan"],
    alasanKeputusan: a.alasan_keputusan,
    diputusOleh:
      (a.pemutus as unknown as { nama: string } | null)?.nama ?? null,
  }));
}

/**
 * URL sementara untuk melihat selfie absensi.
 *
 * Bucket-nya privat, jadi tautannya ditandatangani dan hanya berlaku sebentar.
 * RLS storage tetap memeriksa apakah pemanggil berhak melihatnya.
 */
export async function tautanSelfie(
  path: string | null,
  detik = 300,
): Promise<string | null> {
  if (!path || modeData() === "demo") return null;

  const sb = await klienServer();
  const { data } = await sb.storage
    .from("selfie-absensi")
    .createSignedUrl(path, detik);

  return data?.signedUrl ?? null;
}

export type RingkasRekap = {
  jumlahBaris: number;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  luarRadius: number;
  orang: number;
};

/**
 * Angka ringkas rekap kehadiran.
 * Di mode Supabase dihitung database supaya periode panjang tetap murah.
 */
export async function ringkasRekap(
  pengguna: Pengguna,
  dari: string,
  sampai: string,
  hanyaSaya = false,
): Promise<RingkasRekap> {
  if (modeData() === "demo") {
    const baris = await rekapAbsensi(pengguna, dari, sampai, hanyaSaya);
    return {
      jumlahBaris: baris.length,
      hadir: baris.filter(
        (b) => b.status === "hadir" || b.status === "terlambat",
      ).length,
      terlambat: baris.filter((b) => b.terlambat).length,
      izin: baris.filter((b) => b.status === "izin").length,
      sakit: baris.filter((b) => b.status === "sakit").length,
      luarRadius: baris.filter((b) => b.jamMasuk && !b.lokasiValid).length,
      orang: new Set(baris.map((b) => b.nama)).size,
    };
  }

  const sb = await klienServer();
  const { data } = await sb.rpc("ringkas_absensi", {
    p_dari: dari,
    p_sampai: sampai,
    p_user: hanyaSaya ? pengguna.id : null,
  });

  const r = data?.[0];
  return {
    jumlahBaris: Number(r?.jumlah_baris ?? 0),
    hadir: Number(r?.hadir ?? 0),
    terlambat: Number(r?.terlambat ?? 0),
    izin: Number(r?.izin ?? 0),
    sakit: Number(r?.sakit ?? 0),
    luarRadius: Number(r?.luar_radius ?? 0),
    orang: Number(r?.orang ?? 0),
  };
}
