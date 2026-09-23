// Modul khusus server. Impor dari komponen klien akan gagal saat build,
// bukan diam-diam bocor ke browser.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh, TANGGAL_ACUAN } from "@/lib/data/contoh";
import {
  rekapMinimumPerAkun,
  rekapMinimumPerOrang,
  type BarisRekap,
} from "@/lib/rekap-minimum";
import {
  BATAS_MINIMUM_LEVEL,
  batasMinimum,
  hitungKepatuhanMinimum,
  rataKepatuhan,
  KEPATUHAN_KOSONG,
  type HariKepatuhan,
  type Kepatuhan,
  type TrenTigaHari,
} from "@/lib/batas-minimum";

export type { TrenTigaHari };

/** Satu anak tangga tabel rujukan level → batas minimum unggahan. */
export type BarisBatasMinimum = { level: number; minimum: number };

/**
 * Tabel rujukan level → batas minimum unggahan.
 *
 * Di mode Supabase dibaca dari tabel `batas_minimum_level` (migrasi 0136)
 * supaya angka yang dipakai layar sama persis dengan yang dipakai SQL;
 * di mode demo dibaca dari `BATAS_MINIMUM_LEVEL`. Tes di
 * `supabase/tests/batas-minimum.test.mjs` menjaga keduanya tetap sama.
 */
export async function tabelBatasMinimum(): Promise<BarisBatasMinimum[]> {
  if (modeData() === "demo") {
    return BATAS_MINIMUM_LEVEL.map((minimum, level) => ({ level, minimum }));
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("batas_minimum_level")
    .select("level, minimum_unggahan")
    .order("level");
  if (error) throw new Error(`Gagal memuat batas minimum: ${error.message}`);

  return (data ?? []).map((b) => ({
    level: b.level,
    minimum: b.minimum_unggahan,
  }));
}

/** Satu baris acuan beserta akun aktif yang sedang memakainya. */
export type SebaranLevel = BarisBatasMinimum & {
  akun: number;
  /** Username akun di level itu, urut abjad; untuk keterangan barisnya. */
  contoh: string[];
};

/**
 * Tabel acuan plus sebaran akun aktif per level.
 *
 * Halaman acuan hanya perlu mencacah akun per level, bukan seluruh
 * keterangan tiap akun — memuat daftar akun lengkap berarti ikut
 * menghitung kepatuhan dan riwayat level yang tidak ditampilkan sama
 * sekali di halaman itu.
 */
export async function sebaranLevel(): Promise<SebaranLevel[]> {
  const acuan = await tabelBatasMinimum();
  const per = new Map<number, string[]>();

  if (modeData() === "demo") {
    for (const a of dataContoh.accounts) {
      const level = (a as { level?: number }).level ?? null;
      if (level === null) continue;
      per.set(level, [...(per.get(level) ?? []), a.username]);
    }
  } else {
    const sb = await klienServer();
    const { data, error } = await sb
      .from("accounts")
      .select("username, level")
      .eq("status", "aktif")
      .not("level", "is", null)
      .order("username");
    if (error) throw new Error(`Gagal memuat sebaran level: ${error.message}`);

    for (const a of data ?? []) {
      if (a.level === null) continue;
      per.set(a.level, [...(per.get(a.level) ?? []), a.username]);
    }
  }

  return acuan.map((b) => {
    const contoh = [...(per.get(b.level) ?? [])].sort((x, y) =>
      x.localeCompare(y),
    );
    return { ...b, akun: contoh.length, contoh };
  });
}

/**
 * Kepatuhan sebuah akun terhadap batas minimum levelnya pada satu rentang.
 *
 * Mode Supabase memanggil `kepatuhan_minimum_akun` (migrasi 0138); mode
 * demo menghitung sendiri lewat `hitungKepatuhanMinimum` dengan fakta
 * yang sama. Dua jalan, satu rumus — itu yang diuji di
 * `supabase/tests/kepatuhan-minimum.test.mjs`.
 */
export async function kepatuhanAkun(
  akunId: string,
  dari: string,
  sampai: string,
): Promise<Kepatuhan> {
  if (modeData() === "demo") {
    return kepatuhanAkunDemo(akunId, dari, sampai);
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("kepatuhan_minimum_akun", {
    p_account_id: akunId,
    p_dari: dari,
    p_sampai: sampai,
  });
  if (error) throw new Error(`Gagal memuat kepatuhan akun: ${error.message}`);

  const baris = (data ?? [])[0];
  if (!baris) return { ...KEPATUHAN_KOSONG };
  return {
    hariKerja: baris.hari_kerja,
    terpenuhi: baris.terpenuhi,
    rasio: baris.rasio === null ? null : Number(baris.rasio),
    minimum: baris.minimum,
  };
}

/**
 * Tren tiga hari kerja terakhir seluruh akun yang boleh dilihat pemanggil.
 *
 * Mode Supabase membaca view `tren_kepatuhan_tiga_hari` (migrasi 0140) —
 * view itu `security_invoker`, jadi Staff tetap hanya melihat akunnya
 * sendiri. Mode demo menyusun bentuk yang sama dari seed.
 */
export async function trenTigaHari(): Promise<TrenTigaHari[]> {
  if (modeData() === "demo") return trenDemo();

  const sb = await klienServer();
  const { data, error } = await sb
    .from("tren_kepatuhan_tiga_hari")
    .select("*")
    .order("username");
  if (error) throw new Error(`Gagal memuat tren kepatuhan: ${error.message}`);

  return (data ?? []).map((b) => ({
    akunId: b.account_id,
    username: b.username,
    level: b.level,
    minimum: b.minimum,
    hariDinilai: b.hari_dinilai,
    jumlahTerpenuhi: b.jumlah_terpenuhi,
    hari: (b.tanggal ?? []).map((tanggal, i) => ({
      tanggal,
      unggahan: b.unggahan?.[i] ?? null,
      terpenuhi: b.terpenuhi?.[i] ?? false,
    })),
    arah: b.arah,
    beruntunKurang: b.beruntun_kurang,
  }));
}

/** Kepatuhan seseorang, plus berapa akunnya yang benar-benar dinilai. */
export type KepatuhanOrang = Kepatuhan & { akunDinilai: number };

/**
 * Rata-rata kepatuhan seluruh akun aktif yang dipegang seseorang.
 *
 * Rata-rata per AKUN, bukan per hari yang digabung — supaya satu akun
 * ramai tidak menutupi satu akun sepi. Akun tanpa level tidak ikut
 * dinilai sama sekali.
 */
export async function kepatuhanOrang(
  userId: string,
  dari: string,
  sampai: string,
): Promise<KepatuhanOrang> {
  if (modeData() === "demo") {
    return kepatuhanOrangDemo(userId, dari, sampai);
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("kepatuhan_minimum_orang", {
    p_user_id: userId,
    p_dari: dari,
    p_sampai: sampai,
  });
  if (error) throw new Error(`Gagal memuat kepatuhan orang: ${error.message}`);

  const baris = (data ?? [])[0];
  if (!baris) return { ...KEPATUHAN_KOSONG, akunDinilai: 0 };
  return {
    akunDinilai: baris.akun_dinilai,
    hariKerja: baris.hari_kerja,
    terpenuhi: baris.terpenuhi,
    rasio: baris.rasio === null ? null : Number(baris.rasio),
    minimum: null,
  };
}

// ---------------------------------------------------------------------
// Mode demo — fakta yang sama, dari seed.
// ---------------------------------------------------------------------

/** Hari-hari akun dalam rentang, apa adanya: absensi PIC + laporannya. */
function hariAkunDemo(
  akunId: string,
  dari: string,
  sampai: string,
): { hari: HariKepatuhan[]; minimum: number | null } | null {
  const { accounts, attendance, daily_reports } = dataContoh;
  const akun = accounts.find((a) => a.id === akunId);
  if (!akun) return null;

  // Hanya hari dengan jam masuk yang dinilai; izin yang sudah disetujui
  // tidak boleh ikut menjadi pembagi.
  const masuk = attendance.filter(
    (t) =>
      t.user === akun.pic &&
      t.tanggal >= dari &&
      t.tanggal <= sampai &&
      Boolean(t.jam_masuk),
  );

  const unggahan = new Map<string, number>();
  for (const l of daily_reports) {
    if (l.akun !== akun.username) continue;
    const jumlah = (l as { jumlah_upload?: number }).jumlah_upload;
    if (jumlah === undefined) continue;
    unggahan.set(l.tanggal, (unggahan.get(l.tanggal) ?? 0) + jumlah);
  }

  return {
    hari: masuk.map((t) => ({
      tanggal: t.tanggal,
      hariKerja: true,
      unggahan: unggahan.get(t.tanggal) ?? null,
    })),
    minimum: batasMinimum((akun as { level?: number }).level ?? null),
  };
}

function kepatuhanAkunDemo(
  akunId: string,
  dari: string,
  sampai: string,
): Kepatuhan {
  const fakta = hariAkunDemo(akunId, dari, sampai);
  if (!fakta) return { ...KEPATUHAN_KOSONG };
  return hitungKepatuhanMinimum(fakta.hari, fakta.minimum);
}

function kepatuhanOrangDemo(
  userId: string,
  dari: string,
  sampai: string,
): KepatuhanOrang {
  const { users, accounts } = dataContoh;
  const orang = users.find((u) => u.id === userId);
  if (!orang) return { ...KEPATUHAN_KOSONG, akunDinilai: 0 };

  const daftar = accounts
    .filter((a) => a.pic === orang.nama)
    .map((a) => kepatuhanAkunDemo(a.id, dari, sampai));

  const dinilai = daftar.filter((k) => k.rasio !== null).length;
  return { ...rataKepatuhan(daftar), akunDinilai: dinilai };
}

/** Padanan view `tren_kepatuhan_tiga_hari` untuk mode demo. */
function trenDemo(): TrenTigaHari[] {
  const { accounts } = dataContoh;

  return accounts
    .filter((a) => (a as { status?: string }).status !== "nonaktif")
    .map((a) => {
      const level = (a as { level?: number }).level ?? null;
      const minimum = batasMinimum(level);
      const fakta = hariAkunDemo(a.id, "0001-01-01", TANGGAL_ACUAN);
      const hari = (fakta?.hari ?? [])
        .sort((x, y) => x.tanggal.localeCompare(y.tanggal))
        .slice(-3)
        .map((h) => ({
          tanggal: h.tanggal,
          unggahan: h.unggahan,
          terpenuhi: minimum !== null && (h.unggahan ?? 0) >= minimum,
        }));

      const awal = hari[0]?.unggahan ?? 0;
      const akhir = hari[hari.length - 1]?.unggahan ?? 0;

      return {
        akunId: a.id,
        username: a.username,
        level,
        minimum,
        hariDinilai: hari.length,
        jumlahTerpenuhi: hari.filter((h) => h.terpenuhi).length,
        hari,
        arah:
          hari.length < 2
            ? null
            : akhir > awal
              ? ("naik" as const)
              : akhir < awal
                ? ("turun" as const)
                : ("datar" as const),
        // Tanpa level tidak ada standar yang dilanggar, jadi nol —
        // sama seperti view-nya, bukan "semua harinya kurang".
        beruntunKurang:
          minimum === null
            ? 0
            : beruntunKurangDemo(hari.map((h) => h.terpenuhi)),
      };
    })
    .sort((x, y) => x.username.localeCompare(y.username));
}

/** Berapa nilai `false` beruntun di ekor daftar — 0 bila ujungnya lulus. */
function beruntunKurangDemo(terpenuhi: readonly boolean[]): number {
  let n = 0;
  for (let i = terpenuhi.length - 1; i >= 0 && !terpenuhi[i]; i -= 1) n += 1;
  return n;
}

/** Satu akun dalam rekap kepatuhan massal. */
export type RekapAkun = {
  akunId: string;
  username: string;
  minimum: number;
  laporan: number;
  terpenuhi: number;
  rasio: number;
  kurangTerdalam: number;
};

/**
 * Rekap terpenuhi/kurang per akun pada satu rentang, dari laporan yang
 * masuk.
 *
 * Bedanya dengan `kepatuhanAkun`: yang ini hanya menghitung hari yang
 * DILAPORKAN, yang itu menghitung hari KERJA. Dua pertanyaan berbeda
 * yang sengaja dijawab terpisah.
 *
 * Mode demo memakai `rekapMinimumPerAkun` atas riwayat yang sama, jadi
 * kedua mode menjawab dengan aturan yang identik.
 */
export async function rekapAkun(
  dari: string,
  sampai: string,
  riwayatDemo: readonly BarisRekap[] = [],
  /**
   * Sembunyikan akun yang SELALU memenuhi.
   *
   * Yang dinilai akunnya sepanjang rentang, bukan barisnya satu per
   * satu: menyaring per baris membuat penyebut ikut menyusut dan setiap
   * akun terbaca 0% patuh.
   */
  hanyaKurang = false,
): Promise<RekapAkun[]> {
  if (modeData() === "demo") {
    return rekapMinimumPerAkun(riwayatDemo)
      .filter((r) => r.minimum !== null)
      .filter((r) => !hanyaKurang || r.terpenuhi < r.laporan)
      .map((r) => ({
        akunId: r.kunci,
        username: r.label,
        minimum: r.minimum ?? 0,
        laporan: r.laporan,
        terpenuhi: r.terpenuhi,
        rasio: r.rasio,
        kurangTerdalam: r.kurangTerdalam,
      }));
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("rekap_minimum_akun", {
    p_dari: dari,
    p_sampai: sampai,
    p_hanya_kurang: hanyaKurang,
  });
  if (error) throw new Error(`Gagal memuat rekap minimum: ${error.message}`);

  return (data ?? []).map((r) => ({
    akunId: r.account_id,
    username: r.username,
    minimum: r.minimum,
    laporan: r.laporan,
    terpenuhi: r.terpenuhi,
    rasio: Number(r.rasio),
    kurangTerdalam: r.kurang_terdalam,
  }));
}

/** Satu orang dalam rekap kepatuhan massal. */
export type RekapOrang = {
  nama: string;
  /** null bila ia memegang akun dengan level berbeda. */
  minimum: number | null;
  akun: number;
  laporan: number;
  terpenuhi: number;
  rasio: number;
  kurangTerdalam: number;
};

/**
 * Rekap terpenuhi/kurang per ORANG pada satu rentang.
 *
 * Satu orang bisa memegang beberapa akun, dan yang ditegur Leader
 * adalah orangnya — jadi rekap per akun saja tidak menjawab "siapa".
 */
export async function rekapOrang(
  dari: string,
  sampai: string,
  riwayatDemo: readonly BarisRekap[] = [],
  /** Sembunyikan orang yang seluruh laporannya memenuhi minimum. */
  hanyaKurang = false,
): Promise<RekapOrang[]> {
  if (modeData() === "demo") {
    return rekapMinimumPerOrang(riwayatDemo)
      .filter((r) => !hanyaKurang || r.terpenuhi < r.laporan)
      .map((r) => ({
        nama: r.label,
        minimum: r.minimum,
        akun: new Set(
          riwayatDemo
            .filter(
              (b) => b.pelaporNama === r.label && b.minimumUpload !== null,
            )
            .map((b) => b.akunId),
        ).size,
        laporan: r.laporan,
        terpenuhi: r.terpenuhi,
        rasio: r.rasio,
        kurangTerdalam: r.kurangTerdalam,
      }));
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("rekap_minimum_orang", {
    p_dari: dari,
    p_sampai: sampai,
    p_hanya_kurang: hanyaKurang,
  });
  if (error) throw new Error(`Gagal memuat rekap minimum: ${error.message}`);

  return (data ?? []).map((r) => ({
    nama: r.pelapor_nama,
    minimum: r.minimum,
    akun: r.akun,
    laporan: r.laporan,
    terpenuhi: r.terpenuhi,
    rasio: Number(r.rasio),
    kurangTerdalam: r.kurang_terdalam,
  }));
}

/** Satu perubahan level sebuah akun (tabel `account_level_events`). */
export type JejakLevel = {
  id: string;
  dari: number | null;
  ke: number | null;
  olehNama: string | null;
  alasan: string;
  pada: string;
};

/**
 * Riwayat perubahan level sebuah akun, terbaru lebih dulu.
 *
 * Jejaknya lahir dari trigger, bukan dari layar (migrasi 0137), jadi
 * tidak ada perubahan level yang bisa lolos tanpa tercatat.
 *
 * Mode demo mengembalikan daftar kosong: seed tidak menyimpan riwayat
 * level, dan mengarang jejak palsu akan membuat orang percaya pada
 * riwayat yang tidak pernah terjadi.
 */
export async function jejakLevelAkun(akunId: string): Promise<JejakLevel[]> {
  if (modeData() === "demo") {
    return (await jejakLevelSemuaAkun()).get(akunId) ?? [];
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("account_level_events")
    .select("id, dari, ke, alasan, created_at, oleh:oleh_id (nama)")
    .eq("account_id", akunId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Gagal memuat riwayat level: ${error.message}`);

  return (data ?? []).map((b) => {
    const oleh = b.oleh as unknown as { nama: string } | null;
    return {
      id: b.id,
      dari: b.dari,
      ke: b.ke,
      olehNama: oleh?.nama ?? null,
      alasan: b.alasan,
      pada: b.created_at,
    };
  });
}

/** Semua yang perlu diketahui satu akun soal batas minimumnya. */
export type RingkasanMinimumAkun = {
  akunId: string;
  level: number | null;
  minimum: number | null;
  /** Kepatuhan terhadap HARI KERJA pada rentang yang diminta. */
  kepatuhan: Kepatuhan;
  /** Tren tiga hari kerja terakhir; null bila belum ada hari dinilai. */
  tren: TrenTigaHari | null;
  jejakLevel: JejakLevel[];
};

/**
 * Satu panggilan untuk panel level di halaman akun.
 *
 * Panel itu menampilkan level, batas minimumnya, kepatuhan bulan
 * berjalan, tren tiga hari, dan riwayat perubahan levelnya sekaligus.
 * Mengambilnya lima kali dari lima tempat berarti lima keadaan yang
 * bisa berbeda umur — dan angka yang tidak sepakat satu sama lain di
 * satu kartu lebih buruk daripada angka yang terlambat.
 */
export async function ringkasanMinimumAkun(
  akunId: string,
  dari: string,
  sampai: string,
): Promise<RingkasanMinimumAkun> {
  const [kepatuhan, semuaTren, jejak] = await Promise.all([
    kepatuhanAkun(akunId, dari, sampai),
    trenTigaHari(),
    jejakLevelAkun(akunId),
  ]);

  const tren = semuaTren.find((t) => t.akunId === akunId) ?? null;
  return {
    akunId,
    level: tren?.level ?? null,
    // Batas minimumnya diambil dari kepatuhan bila trennya tidak ada —
    // akun yang belum punya hari kerja tetap punya level dan batas.
    minimum: tren?.minimum ?? kepatuhan.minimum,
    kepatuhan,
    tren,
    jejakLevel: jejak,
  };
}

/**
 * Kepatuhan seluruh akun yang terlihat pemanggil, satu panggilan.
 *
 * Dipakai halaman Kelola Akun, yang menampilkan kepatuhan bulan
 * berjalan di tiap baris — memanggilnya satu per satu berarti satu
 * perjalanan jaringan per akun.
 */
export async function kepatuhanSemuaAkun(
  dari: string,
  sampai: string,
  /** Akun yang perlu dinilai di mode demo; diabaikan mode Supabase. */
  akunDemo: readonly string[] = [],
): Promise<Map<string, Kepatuhan>> {
  if (modeData() === "demo") {
    return new Map(
      akunDemo.map((id) => [id, kepatuhanAkunDemo(id, dari, sampai)]),
    );
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("kepatuhan_minimum_semua", {
    p_dari: dari,
    p_sampai: sampai,
  });
  if (error) throw new Error(`Gagal memuat kepatuhan: ${error.message}`);

  return new Map(
    (data ?? []).map((b) => [
      b.account_id,
      {
        hariKerja: b.hari_kerja,
        terpenuhi: b.terpenuhi,
        rasio: b.rasio === null ? null : Number(b.rasio),
        minimum: b.minimum,
      },
    ]),
  );
}

/**
 * Riwayat level SELURUH akun yang terlihat pemanggil, dikelompokkan per
 * akun. Alasan yang sama dengan `kepatuhanSemuaAkun`: satu halaman,
 * satu panggilan.
 */
export async function jejakLevelSemuaAkun(): Promise<
  Map<string, JejakLevel[]>
> {
  if (modeData() === "demo") return jejakLevelDemo();

  const sb = await klienServer();
  const { data, error } = await sb
    .from("account_level_events")
    .select("id, account_id, dari, ke, alasan, created_at, oleh:oleh_id (nama)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Gagal memuat riwayat level: ${error.message}`);

  const per = new Map<string, JejakLevel[]>();
  for (const b of data ?? []) {
    const oleh = b.oleh as unknown as { nama: string } | null;
    const daftar = per.get(b.account_id) ?? [];
    daftar.push({
      id: b.id,
      dari: b.dari,
      ke: b.ke,
      olehNama: oleh?.nama ?? null,
      alasan: b.alasan,
      pada: b.created_at,
    });
    per.set(b.account_id, daftar);
  }
  return per;
}

/** Padanan `account_level_events` untuk mode demo, dari seed. */
function jejakLevelDemo(): Map<string, JejakLevel[]> {
  const { accounts } = dataContoh;
  const peristiwa =
    (dataContoh as { level_events?: BarisLevelSeed[] }).level_events ?? [];

  const per = new Map<string, JejakLevel[]>();
  for (const [i, e] of peristiwa.entries()) {
    const akun = accounts.find((a) => a.username === e.akun);
    if (!akun) continue;
    const daftar = per.get(akun.id) ?? [];
    daftar.push({
      id: `${akun.id}-${i}`,
      dari: e.dari,
      ke: e.ke,
      olehNama: e.oleh,
      alasan: e.alasan,
      pada: e.pada,
    });
    per.set(akun.id, daftar);
  }

  // Terbaru lebih dulu, sama seperti urutan dari database.
  for (const daftar of per.values()) {
    daftar.sort((a, b) => b.pada.localeCompare(a.pada));
  }
  return per;
}

/** Bentuk satu baris `level_events` di seed. */
type BarisLevelSeed = {
  akun: string;
  dari: number | null;
  ke: number;
  oleh: string;
  alasan: string;
  pada: string;
};
