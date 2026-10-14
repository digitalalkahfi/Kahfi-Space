// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { daftarAkun } from "@/lib/data/akun";
import { bolehLihatKomisiSemua } from "@/lib/komisi";
import {
  barisAkunAffiliator,
  barisLaporanUnit,
  type BarisAkunAffiliator,
} from "@/lib/akun-affiliator";
import type { Pengguna } from "@/lib/types";

/**
 * Detail per akun Affiliator untuk CEO/Manager (§4.4): satu baris per
 * akun, angka dihitung per AKUN — bukan per orang — sehingga akun yang
 * pindah PIC di tengah periode tetap utuh angkanya (E6).
 *
 * Memakai ulang `daftarAkun` (PIC, level, batas minimum, kepatuhan, GMV
 * periode) dan menambah total upload, hari lapor, serta komisi dari
 * `komisi_affiliator` (0210).
 *
 * Mengembalikan null bagi selain CEO/Manager: halamannya sudah
 * mengalihkan mereka, dan fungsi ini tidak boleh menjadi jalan lain.
 */
export async function detailAkunAffiliator(
  pengguna: Pengguna,
  dari: string,
  sampai: string,
): Promise<BarisAkunAffiliator[] | null> {
  if (!bolehLihatKomisiSemua(pengguna.role)) return null;

  const akun = (await daftarAkun(pengguna, dari, sampai)).filter(
    (a) => a.unitKode === "affiliator",
  );

  if (modeData() === "demo") {
    const nama = new Map(akun.map((a) => [a.username, a.id]));
    const laporan = dataContoh.daily_reports
      .filter((l) => l.akun && nama.has(l.akun))
      .filter((l) => l.tanggal >= dari && l.tanggal <= sampai)
      .map((l) => ({
        accountId: nama.get(l.akun as string) as string,
        upload: (l as { jumlah_upload?: number }).jumlah_upload ?? null,
        komisi: (l as { komisi?: number }).komisi ?? null,
      }));
    return barisAkunAffiliator(akun, laporan);
  }

  const sb = await klienServer();
  const { data: unit } = await sb
    .from("units")
    .select("id")
    .eq("kode", "affiliator")
    .maybeSingle();

  const [
    { data: lap, error },
    { data: lapUnit, error: galatUnit },
    { data: komisi, error: galatKomisi },
  ] = await Promise.all([
    sb
      .from("daily_reports")
      .select("account_id, jumlah_upload")
      .in(
        "account_id",
        akun.map((a) => a.id),
      )
      .gte("tanggal", dari)
      .lte("tanggal", sampai),
    // Laporan tingkat unit Affiliator (tanpa akun) ikut dihitung kartu
    // Affiliator di dasbor, jadi tampil sebagai baris sendiri supaya
    // total tabel sama dengan kartu itu (AC7).
    unit
      ? sb
          .from("daily_reports")
          .select("gmv, jumlah_upload")
          .eq("unit_id", unit.id)
          .is("account_id", null)
          .gte("tanggal", dari)
          .lte("tanggal", sampai)
      : Promise.resolve({ data: [], error: null }),
    sb.rpc("komisi_affiliator", { p_dari: dari, p_sampai: sampai }),
  ]);
  const galat = error ?? galatUnit;
  if (galat) throw new Error(`Gagal memuat laporan akun: ${galat.message}`);
  if (galatKomisi) {
    throw new Error(`Gagal memuat komisi akun: ${galatKomisi.message}`);
  }

  // Komisi dibaca per akun dari RPC; laporan lainnya per baris.
  const komisiPer = new Map<string, number>();
  let komisiUnit = 0;
  for (const k of komisi ?? []) {
    if (k.account_id === null) komisiUnit += Number(k.komisi);
    else komisiPer.set(k.account_id, Number(k.komisi));
  }
  const laporan = (lap ?? []).map((l) => ({
    accountId: l.account_id as string,
    upload: l.jumlah_upload,
    komisi: null,
  }));
  const baris = barisAkunAffiliator(akun, laporan, komisiPer);

  const unitBaris = lapUnit ?? [];
  if (unitBaris.length > 0 || komisiUnit > 0) {
    baris.push(
      barisLaporanUnit(
        unitBaris.map((l) => ({ gmv: Number(l.gmv), upload: l.jumlah_upload })),
        komisiUnit,
      ),
    );
  }
  return baris;
}
