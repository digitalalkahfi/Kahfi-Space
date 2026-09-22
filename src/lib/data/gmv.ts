import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { sasaranUntuk } from "@/lib/data/laporan";
import type { BarisGmv, BarisUnitHarian } from "@/lib/gmv";
import type { CapaianUnit, KodeUnit, Pengguna } from "@/lib/types";

type BarisDb = {
  tanggal: string;
  gmv: number;
  account_id: string | null;
  // Laporan tingkat akun tidak mengisi `unit_id`; unitnya menempel pada
  // akunnya. Tanpa ikut mengambilnya, seluruh laporan akun akan terbaca
  // sebagai "tanpa unit" dan rekap per lini jadi kosong.
  accounts: { username: string; units: { kode: KodeUnit } | null } | null;
  units: { nama: string; kode: KodeUnit } | null;
};

/**
 * Laporan GMV harian pada satu rentang tanggal.
 *
 * Membaca `daily_reports` apa adanya — tidak ada tabel agregat baru.
 * Cakupannya mengikuti RLS yang sudah berlaku: Staff melihat laporannya
 * sendiri dan akun yang ia pegang, CEO/Manager melihat semuanya. Karena
 * itu grafik yang sama bisa menunjukkan angka berbeda untuk dua orang,
 * dan itu memang disengaja.
 *
 * Target harian diambil dari sasaran yang berlaku pada `sampai`, bukan
 * dari target harian masing-masing tanggal. Target tidak disimpan per
 * hari; yang ada adalah target berjalan. Menampilkannya sebagai garis
 * pembanding tetap berguna, asal pembacanya tahu ia target hari ini.
 */
export async function laporanGmv(
  pengguna: Pengguna,
  dari: string,
  sampai: string,
): Promise<BarisGmv[]> {
  const sasaran = await sasaranUntuk(pengguna, sampai);

  const targetUntuk = (akunId: string | null, unitKode: KodeUnit | null) => {
    const cocok = sasaran.find((s) =>
      s.jenis === "akun" ? s.akun.id === akunId : s.unitId === unitKode,
    );
    if (!cocok) return 0;
    return cocok.jenis === "akun"
      ? cocok.akun.targetHarian
      : cocok.targetHarian;
  };

  if (modeData() === "demo") {
    const { daily_reports, accounts, units } = dataContoh;
    const lintas = pengguna.role === "CEO" || pengguna.role === "Manager";
    const akunSaya = new Set(
      accounts.filter((a) => a.pic === pengguna.nama).map((a) => a.username),
    );

    return daily_reports
      .filter((l) => l.tanggal >= dari && l.tanggal <= sampai)
      .filter(
        (l) =>
          lintas ||
          l.user === pengguna.nama ||
          (l.akun && akunSaya.has(l.akun)),
      )
      .map((l) => {
        const akun = l.akun
          ? accounts.find((a) => a.username === l.akun)
          : null;
        const unit = l.unit ? units.find((u) => u.kode === l.unit) : null;
        // Laporan tingkat akun tidak menyebut unit; unitnya ikut akunnya.
        const unitId = ((l.unit ?? akun?.unit) as KodeUnit) ?? null;
        return {
          tanggal: l.tanggal,
          gmv: l.gmv,
          target: targetUntuk(akun?.id ?? null, unitId),
          unitId,
          label: l.akun ?? unit?.nama ?? "—",
        };
      });
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("daily_reports")
    .select(
      "tanggal, gmv, account_id, accounts:account_id (username, units:unit_id (kode)), units:unit_id (nama, kode)",
    )
    .gte("tanggal", dari)
    .lte("tanggal", sampai)
    .order("tanggal", { ascending: true });

  if (error) throw new Error(`Gagal memuat laporan GMV: ${error.message}`);

  return (data as unknown as BarisDb[]).map((b) => {
    const unitId = b.units?.kode ?? b.accounts?.units?.kode ?? null;
    return {
      tanggal: b.tanggal,
      gmv: Number(b.gmv),
      // Target dicocokkan lewat akun bila laporannya tingkat akun, dan
      // lewat kode unit bila laporannya tingkat unit — sejalan
      // `targetUntuk` di lib/data/laporan.ts.
      target: targetUntuk(b.account_id, b.units?.kode ?? null),
      unitId,
      label: b.accounts?.username ?? b.units?.nama ?? "—",
    };
  });
}

// ---------------------------------------------------------------------
// Ringkasan GMV untuk Beranda
// ---------------------------------------------------------------------

export type RingkasanGmv = {
  unit: CapaianUnit[];
  gmvHariIni: number;
  gmvKemarin: number;
  targetHarian: number;
  targetBulanan: number;
  /** Sisa hari kalender pada bulan berjalan, tidak termasuk hari ini. */
  sisaHariBulanIni: number;
};

/** Nama singkat unit: bagian sebelum tanda kurung atau spasi pertama. */
function namaPendekUnit(nama: string): string {
  return nama.split(" (")[0].split(" ")[0];
}

/** Hari tersisa pada bulan `tanggal`, tidak termasuk hari itu sendiri. */
export function sisaHariBulan(tanggal: string): number {
  const [tahun, bulan, hari] = tanggal.split("-").map(Number);
  // Hari ke-0 bulan berikutnya = hari terakhir bulan ini; aman untuk
  // Februari kabisat tanpa tabel panjang bulan.
  const hariTerakhir = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
  return Math.max(0, hariTerakhir - hari);
}

function mundurSehari(tanggal: string): string {
  const [tahun, bulan, hari] = tanggal.split("-").map(Number);
  const d = new Date(Date.UTC(tahun, bulan - 1, hari - 1));
  return d.toISOString().slice(0, 10);
}

/**
 * GMV per unit hari ini vs kemarin vs target — isi kartu utama Beranda.
 *
 * Mode supabase memanggil RPC `ringkasan_gmv_unit` (migrasi 0008): yang
 * meringkas adalah basis data, supaya halaman ini tidak menarik seluruh
 * laporan hanya untuk beberapa angka, dan supaya target efektif dihitung
 * dengan aturan yang sama di semua pemanggil.
 *
 * Mode demo menirukan aturan RPC itu persis: target harian sebuah unit
 * diambil dari penjumlahan target akunnya bila ada, dan baru jatuh ke
 * target tingkat unit bila unit itu tidak punya akun bertarget.
 */
export async function ringkasanGmv(
  pengguna: Pengguna,
  tanggal: string,
): Promise<RingkasanGmv> {
  const unit =
    modeData() === "demo"
      ? ringkasanDemo(tanggal)
      : await ringkasanSupabase(tanggal);

  void pengguna; // Cakupan dibatasi RLS di mode supabase, bukan di sini.

  return {
    unit,
    gmvHariIni: unit.reduce((a, u) => a + u.gmv, 0),
    gmvKemarin: unit.reduce((a, u) => a + u.gmvKemarin, 0),
    targetHarian: unit.reduce((a, u) => a + u.target, 0),
    targetBulanan: unit.reduce((a, u) => a + u.targetBulanan, 0),
    sisaHariBulanIni: sisaHariBulan(tanggal),
  };
}

function ringkasanDemo(tanggal: string): CapaianUnit[] {
  const { units, accounts, daily_reports, goals, targetUnitHarian } =
    dataContoh;
  const kemarin = mundurSehari(tanggal);
  const awalBulan = `${tanggal.slice(0, 7)}-01`;

  const unitDariLaporan = (l: (typeof daily_reports)[number]) =>
    l.unit ?? accounts.find((a) => a.username === l.akun)?.unit ?? null;

  const jumlah = (kode: string, saring: (t: string) => boolean) =>
    daily_reports
      .filter((l) => unitDariLaporan(l) === kode && saring(l.tanggal))
      .reduce((a, l) => a + l.gmv, 0);

  return units.map((u) => {
    const akunUnit = accounts.filter((a) => a.unit === u.kode);
    const harianAkun = akunUnit.reduce((a, x) => a + (x.target_harian ?? 0), 0);
    const harianUnit =
      (targetUnitHarian as Record<string, number>)[u.kode] ?? 0;

    const bulananAkun = akunUnit.reduce((a, x) => {
      const g = goals.find(
        (g) => g.level === "account" && g.account === x.username,
      );
      return a + (g?.target_bulan ?? 0);
    }, 0);
    const bulananUnit =
      goals.find((g) => g.level === "leader" && g.unit === u.kode)
        ?.target_bulan ?? 0;

    return {
      unitId: u.kode as KodeUnit,
      nama: u.nama.split(" (")[0],
      namaPendek: namaPendekUnit(u.nama),
      keterangan: u.deskripsi ?? "",
      gmv: jumlah(u.kode, (t) => t === tanggal),
      target: harianAkun > 0 ? harianAkun : harianUnit,
      gmvKemarin: jumlah(u.kode, (t) => t === kemarin),
      gmvBulanIni: jumlah(u.kode, (t) => t >= awalBulan && t <= tanggal),
      targetBulanan: bulananAkun > 0 ? bulananAkun : bulananUnit,
    } satisfies CapaianUnit;
  });
}

type BarisRingkasan = {
  kode: string;
  nama: string;
  deskripsi: string | null;
  gmv_hari_ini: number;
  gmv_kemarin: number;
  target_harian: number;
  gmv_bulan_ini: number;
  target_bulanan: number;
};

async function ringkasanSupabase(tanggal: string): Promise<CapaianUnit[]> {
  const sb = await klienServer();
  const { data, error } = await sb.rpc("ringkasan_gmv_unit", {
    p_tanggal: tanggal,
  });

  if (error) throw new Error(`Gagal memuat ringkasan GMV: ${error.message}`);

  return (data as BarisRingkasan[]).map((b) => ({
    unitId: b.kode as KodeUnit,
    nama: b.nama.split(" (")[0],
    namaPendek: namaPendekUnit(b.nama),
    keterangan: b.deskripsi ?? "",
    gmv: Number(b.gmv_hari_ini),
    target: Number(b.target_harian),
    gmvKemarin: Number(b.gmv_kemarin),
    gmvBulanIni: Number(b.gmv_bulan_ini),
    targetBulanan: Number(b.target_bulanan),
  }));
}

// ---------------------------------------------------------------------
// Agregat untuk dasbor analitik
// ---------------------------------------------------------------------

/**
 * Batas panjang rentang yang masih menarik laporan satu per satu.
 *
 * Di bawah ini, rincian per laporan memang berguna dan jumlah barisnya
 * wajar. Di atasnya — setahun, misalnya — menarik ratusan baris hanya
 * untuk menjumlahkannya di aplikasi adalah pemborosan, dan tabel
 * rinciannya pun sudah terlalu panjang untuk dibaca siapa pun.
 */
export const BATAS_RINCI_HARI = 92;

export type SeriHarianDb = {
  tanggal: string;
  gmv: number;
  jumlahLaporan: number;
};

/**
 * GMV per hari pada sebuah rentang, dijumlahkan oleh basis data.
 *
 * Memakai RPC `gmv_harian` (migrasi 0110) di mode supabase: satu baris
 * per hari, bukan satu baris per laporan. Mode demo menghitung hal yang
 * sama dari data contoh supaya keduanya menghasilkan angka identik.
 */
export async function seriGmvHarian(
  pengguna: Pengguna,
  dari: string,
  sampai: string,
): Promise<SeriHarianDb[]> {
  if (modeData() === "demo") {
    const baris = await laporanGmv(pengguna, dari, sampai);
    const per = new Map<string, { gmv: number; n: number }>();
    for (const b of baris) {
      const ada = per.get(b.tanggal) ?? { gmv: 0, n: 0 };
      ada.gmv += b.gmv;
      ada.n += 1;
      per.set(b.tanggal, ada);
    }
    return [...per.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tanggal, n]) => ({
        tanggal,
        gmv: n.gmv,
        jumlahLaporan: n.n,
      }));
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("gmv_harian", {
    p_dari: dari,
    p_sampai: sampai,
  });
  if (error) throw new Error(`Gagal memuat agregat GMV: ${error.message}`);

  return (
    data as { tanggal: string; gmv: number; jumlah_laporan: number }[]
  ).map((b) => ({
    tanggal: b.tanggal,
    gmv: Number(b.gmv),
    jumlahLaporan: Number(b.jumlah_laporan),
  }));
}

export type RekapUnitDb = {
  unitId: KodeUnit | null;
  gmv: number;
};

/** Sumbangan tiap unit pada rentang yang sama, dijumlahkan basis data. */
export async function rekapUnitGmv(
  pengguna: Pengguna,
  dari: string,
  sampai: string,
): Promise<RekapUnitDb[]> {
  if (modeData() === "demo") {
    const baris = await laporanGmv(pengguna, dari, sampai);
    const per = new Map<string, RekapUnitDb>();
    for (const b of baris) {
      const kunci = b.unitId ?? "lainnya";
      const ada = per.get(kunci) ?? { unitId: b.unitId, gmv: 0 };
      ada.gmv += b.gmv;
      per.set(kunci, ada);
    }
    return [...per.values()].sort((a, b) => b.gmv - a.gmv);
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("gmv_harian_unit", {
    p_dari: dari,
    p_sampai: sampai,
  });
  if (error) throw new Error(`Gagal memuat rekap unit: ${error.message}`);

  return (data as { kode: KodeUnit | null; gmv: number }[]).map((b) => ({
    unitId: b.kode,
    gmv: Number(b.gmv),
  }));
}

/**
 * GMV harian dipecah per unit.
 *
 * Memakai RPC `gmv_harian_per_unit` (migrasi 0120) di mode supabase —
 * satu baris per (tanggal, unit), bukan satu baris per laporan. Mode
 * demo menghitung hal yang sama dari data contoh supaya keduanya
 * menghasilkan garis yang identik.
 */
export async function seriUnitHarian(
  pengguna: Pengguna,
  dari: string,
  sampai: string,
): Promise<BarisUnitHarian[]> {
  if (modeData() === "demo") {
    const baris = await laporanGmv(pengguna, dari, sampai);
    const per = new Map<string, BarisUnitHarian>();
    for (const b of baris) {
      if (b.unitId === null) continue;
      const kunci = `${b.tanggal}|${b.unitId}`;
      const ada = per.get(kunci);
      if (ada) ada.gmv += b.gmv;
      else per.set(kunci, { tanggal: b.tanggal, unitId: b.unitId, gmv: b.gmv });
    }
    return [...per.values()];
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("gmv_harian_per_unit", {
    p_dari: dari,
    p_sampai: sampai,
  });
  if (error) throw new Error(`Gagal memuat GMV per lini: ${error.message}`);

  return (data as { tanggal: string; kode: KodeUnit; gmv: number }[]).map(
    (b) => ({
      tanggal: b.tanggal,
      unitId: b.kode,
      gmv: Number(b.gmv),
    }),
  );
}
