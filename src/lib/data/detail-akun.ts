// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { daftarAkun, type AkunKelola } from "@/lib/data/akun";
import { akunKomisiTerlihat } from "@/lib/data/akses-komisi";
import { komisiAkunTerlihat } from "@/lib/komisi";
import { daftarTanggal, susunHari, type HariAkun } from "@/lib/detail-akun";
import type { Pengguna } from "@/lib/types";

const POLA_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Satu akun yang boleh dibuka pengguna ini, atau null (§5.1).
 *
 * Dibaca lewat klien biasa — `daftarAkun` tunduk pada RLS
 * `accounts_baca` (0173) — bukan klien admin. Akun yang tidak terbaca
 * berarti "tidak ditemukan atau tidak punya akses"; halaman tidak
 * membedakan keduanya supaya tidak membocorkan keberadaan akun orang
 * lain. Angka kepatuhan dan GMV periodenya ikut dari sumber yang sama
 * dengan tabel per akun.
 */
export async function akunTerbuka(
  pengguna: Pengguna,
  id: string,
  dari: string,
  sampai: string,
): Promise<AkunKelola | null> {
  if (modeData() !== "demo" && !POLA_UUID.test(id)) return null;
  const semua = await daftarAkun(pengguna, dari, sampai);
  return semua.find((a) => a.id === id) ?? null;
}

/**
 * Pengguna ini boleh melihat komisi akun ini (`boleh_lihat_komisi`,
 * 0212). Bila false, halaman tidak memuat satu angka komisi pun.
 */
export async function bolehLihatKomisiAkun(
  pengguna: Pengguna,
  akun: AkunKelola,
): Promise<boolean> {
  if (akun.unitKode !== "affiliator") return false;
  return komisiAkunTerlihat(await akunKomisiTerlihat(pengguna), akun.id);
}

/**
 * Hari demi hari satu akun pada rentang [dari, sampai].
 *
 * Daftar harinya berhenti di `hariIni` (hari setelahnya belum bisa
 * dilaporkan, jadi bukan "tidak lapor") — kecuali ada laporan yang
 * bertanggal lebih jauh: laporan apa pun dalam rentang selalu ikut,
 * supaya total halaman ini sama persis dengan tabel per akun (AC4).
 *
 * - Laporan: `daily_reports` milik akun ini (RLS `daily_reports_baca`).
 * - Komisi: HANYA lewat `komisi_akun()`, dan hanya dipanggil bila
 *   `lihatKomisi` — tanpa itu tidak ada angka komisi yang dimuat.
 * - Hari kerja: absensi PIC dengan jam masuk, definisi yang sama dengan
 *   `kepatuhan_minimum_akun`. Absensi yang tidak terbaca oleh pengguna
 *   ini (RLS) terhitung bukan hari kerja.
 */
export async function hariAkun(
  akun: AkunKelola,
  dari: string,
  sampai: string,
  hariIni: string,
  lihatKomisi: boolean,
): Promise<HariAkun[]> {
  const batas = sampai < hariIni ? sampai : hariIni;
  if (dari > sampai) return [];

  if (modeData() === "demo") {
    return hariAkunDemo(akun, dari, sampai, batas, lihatKomisi);
  }

  const akhir = sampai;
  const sb = await klienServer();
  const [laporan, komisi, absen] = await Promise.all([
    sb
      .from("daily_reports")
      .select("tanggal, gmv, jumlah_upload")
      .eq("account_id", akun.id)
      .gte("tanggal", dari)
      .lte("tanggal", akhir),
    lihatKomisi
      ? sb.rpc("komisi_akun", {
          p_dari: dari,
          p_sampai: akhir,
          p_account: akun.id,
        })
      : Promise.resolve({ data: null, error: null }),
    akun.picId
      ? sb
          .from("attendance")
          .select("tanggal")
          .eq("user_id", akun.picId)
          .not("jam_masuk", "is", null)
          .gte("tanggal", dari)
          .lte("tanggal", akhir)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const galat = laporan.error ?? komisi.error ?? absen.error;
  if (galat) throw new Error(`Gagal memuat data akun: ${galat.message}`);

  const perHari = new Map<string, { gmv: number; upload: number | null }>();
  for (const l of laporan.data ?? []) {
    perHari.set(l.tanggal, { gmv: Number(l.gmv), upload: l.jumlah_upload });
  }
  const komisiPer = komisi.data
    ? new Map(komisi.data.map((k) => [k.tanggal, Number(k.komisi)]))
    : null;
  // Hari setelah `batas` belum dinilai (laporannya belum jatuh tempo),
  // sama dengan `kepatuhan_minimum_akun`.
  const kerja = new Set(
    (absen.data ?? []).map((a) => a.tanggal).filter((t) => t <= batas),
  );
  return susunHari(
    daftarTanggal(dari, akhirHari(batas, perHari.keys())),
    perHari,
    komisiPer,
    kerja,
  );
}

/** Hari terakhir yang ditampilkan: `batas`, atau laporan terakhir bila lebih jauh. */
function akhirHari(batas: string, tanggalLaporan: Iterable<string>): string {
  let akhir = batas;
  for (const t of tanggalLaporan) if (t > akhir) akhir = t;
  return akhir;
}

/** Padanan mode demo, dari data contoh. */
function hariAkunDemo(
  akun: AkunKelola,
  awal: string,
  akhir: string,
  batas: string,
  lihatKomisi: boolean,
): HariAkun[] {
  const perHari = new Map<string, { gmv: number; upload: number | null }>();
  const komisi = new Map<string, number>();
  for (const l of dataContoh.daily_reports) {
    if (l.akun !== akun.username || l.tanggal < awal || l.tanggal > akhir) {
      continue;
    }
    perHari.set(l.tanggal, {
      gmv: l.gmv,
      upload: (l as { jumlah_upload?: number }).jumlah_upload ?? null,
    });
    const k = (l as { komisi?: number | null }).komisi;
    if (k !== undefined && k !== null) komisi.set(l.tanggal, k);
  }
  const kerja = new Set(
    dataContoh.attendance
      .filter(
        (t) =>
          t.user === akun.picNama &&
          Boolean(t.jam_masuk) &&
          t.tanggal >= awal &&
          t.tanggal <= batas,
      )
      .map((t) => t.tanggal),
  );
  return susunHari(
    daftarTanggal(awal, akhirHari(batas, perHari.keys())),
    perHari,
    lihatKomisi ? komisi : null,
    kerja,
  );
}
