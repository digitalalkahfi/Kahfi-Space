// Modul khusus server. Impor dari komponen klien akan gagal saat build,
// bukan diam-diam bocor ke browser.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh, TANGGAL_ACUAN } from "@/lib/data/contoh";
import { targetHarianGrd } from "@/lib/goal";
import { bolehLihatLaporan } from "@/lib/laporan";
import { batasMinimum } from "@/lib/batas-minimum";
import type {
  AkunAffiliator,
  KodeUnit,
  LaporanHarian,
  Pengguna,
  RevisiLaporan,
  SasaranLaporan,
} from "@/lib/types";

// ---------------------------------------------------------------------
// Sasaran laporan: akun yang dipegang PIC, atau unit yang dipimpin Leader.
// ---------------------------------------------------------------------
export async function sasaranUntuk(
  pengguna: Pengguna,
  tanggal: string,
): Promise<SasaranLaporan[]> {
  if (modeData() === "demo") {
    const { accounts, units, goals } = dataContoh;
    const lintas = pengguna.role === "CEO" || pengguna.role === "Manager";

    // Target tidak pernah diketik pelapor: dihitung dari anak tangga GRD
    // yang aktif, dengan rumus yang sama dengan `target_harian_akun` di
    // database — supaya mode demo dan mode Supabase tidak berbeda angka.
    const targetGoal = (cocok: (g: (typeof goals)[number]) => boolean) =>
      Math.round(
        targetHarianGrd(
          goals.filter(cocok).flatMap((g) => g.bulan_list ?? []),
          tanggal,
        ),
      );

    const akun: SasaranLaporan[] = accounts
      .filter((a) => lintas || a.pic === pengguna.nama)
      .map((a) => ({
        jenis: "akun" as const,
        akun: {
          id: a.id,
          platform: "TikTok Shop",
          username: a.username,
          picNama: a.pic,
          unitId: a.unit as KodeUnit,
          program: a.program === "Reguler" ? null : a.program,
          targetHarian: targetGoal(
            (g) => g.level === "account" && g.account === a.username,
          ),
          level: (a as { level?: number }).level ?? null,
          status: "aktif",
        } satisfies AkunAffiliator,
      }));

    // Unit tanpa akun aktif melapor di tingkat unit, oleh Leader-nya.
    const unitBerakun = new Set(accounts.map((a) => a.unit));
    const unit: SasaranLaporan[] = units
      .filter((u) => !unitBerakun.has(u.kode))
      .filter(
        (u) =>
          lintas || (pengguna.role === "Leader" && pengguna.unitId === u.kode),
      )
      .map((u) => ({
        jenis: "unit" as const,
        unitId: u.kode as KodeUnit,
        nama: u.nama,
        targetHarian: targetGoal(
          (g) => g.unit === u.kode && g.account === null,
        ),
      }));

    return [...akun, ...unit];
  }

  // Database yang menentukan siapa berhak atas apa, supaya UI tidak pernah
  // menawarkan sasaran yang nanti ditolak saat disimpan.
  const sb = await klienServer();
  const { data, error } = await sb.rpc("sasaran_laporan_saya", {
    p_tanggal: tanggal,
  });
  if (error) throw new Error(`Gagal memuat sasaran laporan: ${error.message}`);

  return (data ?? []).map((b) =>
    b.jenis === "akun"
      ? {
          jenis: "akun" as const,
          akun: {
            id: b.akun_id as string,
            platform: "TikTok Shop",
            username: b.label,
            picNama: b.pic_nama ?? "—",
            unitId: b.unit_kode as KodeUnit,
            program: b.program,
            targetHarian: Math.round(Number(b.target_harian)),
            level: b.level,
            status: "aktif" as const,
          },
        }
      : {
          jenis: "unit" as const,
          unitId: b.unit_kode as KodeUnit,
          nama: b.label,
          targetHarian: Math.round(Number(b.target_harian)),
        },
  );
}

/**
 * Departemen sebuah kunci sasaran ("akun:<uuid>" atau "unit:<kode>").
 * Dipakai Server Action untuk tahu kolom mana yang boleh ikut disimpan,
 * sebelum barisnya sempat menyentuh database.
 */
export async function unitSasaranLaporan(
  kunci: string,
): Promise<KodeUnit | null> {
  const [jenis, nilai] = kunci.split(":");
  if (!jenis || !nilai) return null;

  if (jenis === "unit") {
    return (
      (["affiliator", "mcn", "tap"] as const).find((k) => k === nilai) ?? null
    );
  }
  if (jenis !== "akun") return null;

  if (modeData() === "demo") {
    const akun = dataContoh.accounts.find((a) => a.id === nilai);
    return (akun?.unit as KodeUnit) ?? null;
  }

  const sb = await klienServer();
  const { data } = await sb
    .from("accounts")
    .select("units:unit_id (kode)")
    .eq("id", nilai)
    .maybeSingle();
  const unit = data?.units as unknown as { kode: KodeUnit } | null;
  return unit?.kode ?? null;
}

/**
 * Departemen sebuah laporan yang sudah tersimpan. Dipakai saat
 * memperbaiki: kolom yang sah ditentukan laporannya, bukan kiriman.
 */
export async function unitLaporan(reportId: string): Promise<KodeUnit | null> {
  if (modeData() === "demo") {
    // Id laporan contoh berbentuk "<tanggal>-<akun|unit>-<urutan>".
    const bagian = reportId.split("-");
    const tengah = bagian.slice(3, -1).join("-");
    const akun = dataContoh.accounts.find((a) => a.username === tengah);
    if (akun) return akun.unit as KodeUnit;
    return (
      (["affiliator", "mcn", "tap"] as const).find((k) => k === tengah) ?? null
    );
  }

  const sb = await klienServer();
  const { data } = await sb
    .from("daily_reports")
    .select("accounts:account_id (units:unit_id (kode)), units:unit_id (kode)")
    .eq("id", reportId)
    .maybeSingle();
  if (!data) return null;

  const lewatAkun = data.accounts as unknown as {
    units: { kode: KodeUnit } | null;
  } | null;
  const lewatUnit = data.units as unknown as { kode: KodeUnit } | null;
  return lewatAkun?.units?.kode ?? lewatUnit?.kode ?? null;
}

/**
 * CO sampel hari ini per kunci sasaran ("akun:<uuid>").
 *
 * Angkanya ditarik dari log pemindaian QR sampel, bukan diketik pelapor:
 * sampel yang sudah discan hari itu adalah bukti pemakaiannya. Sasaran
 * tingkat unit tidak punya CO sampel, jadi tidak ikut dikembalikan; kunci
 * yang tidak ada di peta berarti nol.
 */
export async function coSampelHariIni(
  tanggal: string,
): Promise<Record<string, number>> {
  if (modeData() === "demo") {
    const { sample_scans = [], samples, accounts } = dataContoh;
    const peta: Record<string, number> = {};
    for (const scan of sample_scans) {
      if (!scan.dikenali) continue;
      const hari = tanggalScanContoh(scan.lalu_hari);
      if (hari !== tanggal) continue;
      const sampel = samples.find((s) => s.kode === scan.kode);
      const akun = sampel?.akun
        ? accounts.find((a) => a.username === sampel.akun)
        : null;
      if (!akun) continue;
      const kunci = `akun:${akun.id}`;
      peta[kunci] = (peta[kunci] ?? 0) + 1;
    }
    return peta;
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("co_sampel_akun", {
    p_tanggal: tanggal,
  });
  // Angka ini ikut dilaporkan, jadi kegagalan baca tidak boleh menyamar
  // sebagai "belum ada scan" — nol palsu lebih berbahaya dari halaman gagal.
  if (error) throw new Error(`Gagal memuat CO sampel: ${error.message}`);

  return Object.fromEntries(
    (data ?? []).map((b) => [`akun:${b.account_id}`, Number(b.jumlah)]),
  );
}

/** Tanggal pemindaian contoh: seed menyimpan jarak hari dari tanggal acuan. */
function tanggalScanContoh(laluHari: number) {
  const d = new Date(`${TANGGAL_ACUAN}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - laluHari);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------
// Riwayat laporan
// ---------------------------------------------------------------------
/**
 * Satu baris dari view `riwayat_laporan_minimum` (migrasi 0141).
 *
 * Bentuknya datar, bukan bersarang seperti hasil join supabase-js:
 * batas minimum ikut dihitung di database supaya level → angka batas
 * hanya diterjemahkan di satu tempat.
 */
type BarisLaporan = {
  id: string;
  tanggal: string;
  account_id: string | null;
  unit_id: string | null;
  gmv: number;
  komisi: number | null;
  jumlah_upload: number | null;
  catatan: string;
  status: "terkirim" | "revisi";
  submitted_at: string;
  akun_username: string | null;
  akun_level: number | null;
  minimum_unggahan: number | null;
  akun_unit_kode: KodeUnit | null;
  unit_kode: KodeUnit | null;
  unit_nama: string | null;
  pelapor_nama: string | null;
};

function targetUntuk(
  sasaran: SasaranLaporan[],
  akunId: string | null,
  unitKode: string | null,
) {
  const cocok = sasaran.find((s) =>
    s.jenis === "akun" ? s.akun.id === akunId : s.unitId === unitKode,
  );
  return cocok
    ? cocok.jenis === "akun"
      ? cocok.akun.targetHarian
      : cocok.targetHarian
    : 0;
}

export async function riwayatLaporan(
  pengguna: Pengguna,
  tanggal: string,
  batas = 60,
): Promise<LaporanHarian[]> {
  const sasaran = await sasaranUntuk(pengguna, tanggal);

  if (modeData() === "demo") {
    const { daily_reports, accounts, units } = dataContoh;

    return daily_reports
      .filter((l) => {
        const akun = l.akun
          ? accounts.find((a) => a.username === l.akun)
          : null;
        return bolehLihatLaporan(pengguna, {
          pelapor: l.user,
          unitLaporan: (l.unit as KodeUnit) ?? null,
          departemen: ((akun?.unit ?? l.unit) as KodeUnit) ?? null,
          picAkun: akun?.pic ?? null,
        });
      })
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
      .slice(0, batas)
      .map((l, i) => {
        const akun = l.akun
          ? accounts.find((a) => a.username === l.akun)
          : null;
        const unit = l.unit ? units.find((u) => u.kode === l.unit) : null;
        return {
          id: `${l.tanggal}-${l.akun ?? l.unit}-${i}`,
          tanggal: l.tanggal,
          akunId: akun?.id ?? null,
          unitId: (l.unit as KodeUnit) ?? null,
          label: l.akun ?? unit?.nama ?? "—",
          departemen: ((akun?.unit ?? l.unit) as KodeUnit) ?? null,
          pelaporNama: l.user,
          gmv: l.gmv,
          komisi: l.komisi ?? null,
          jumlahUpload: l.jumlah_upload ?? null,
          minimumUpload: batasMinimum(
            (akun as { level?: number } | null | undefined)?.level ?? null,
          ),
          coSampel: null,
          target: targetUntuk(sasaran, akun?.id ?? null, l.unit),
          catatan: l.catatan,
          status: "terkirim",
          submittedAt: `${l.tanggal}T${l.jam}:00+07:00`,
          jumlahRevisi: 0,
        } satisfies LaporanHarian;
      });
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("riwayat_laporan_minimum")
    .select("*")
    .order("tanggal", { ascending: false })
    .order("submitted_at", { ascending: false })
    .limit(batas);

  if (error) throw new Error(`Gagal memuat riwayat: ${error.message}`);

  const baris = data as unknown as BarisLaporan[];
  const { data: revisi } = await sb
    .from("daily_report_revisions")
    .select("report_id")
    .in(
      "report_id",
      baris.map((b) => b.id),
    );

  const jumlahRevisi = new Map<string, number>();
  for (const r of revisi ?? []) {
    jumlahRevisi.set(r.report_id, (jumlahRevisi.get(r.report_id) ?? 0) + 1);
  }

  return baris.map((b) => ({
    ...bentukLaporan(b, sasaran),
    jumlahRevisi: jumlahRevisi.get(b.id) ?? 0,
  }));
}

/**
 * Satu baris view jadi satu `LaporanHarian`.
 *
 * Dipakai riwayat maupun halaman rincian: dua tempat yang menyusun
 * bentuk yang sama sendiri-sendiri akan berbeda pada kolom yang jarang
 * dilihat — dan justru kolom itulah yang salah tanpa ketahuan.
 */
function bentukLaporan(
  b: BarisLaporan,
  sasaran: SasaranLaporan[],
): Omit<LaporanHarian, "jumlahRevisi"> {
  return {
    id: b.id,
    tanggal: b.tanggal,
    akunId: b.account_id,
    unitId: b.unit_kode,
    label: b.akun_username ?? b.unit_nama ?? "—",
    departemen: b.akun_unit_kode ?? b.unit_kode,
    pelaporNama: b.pelapor_nama ?? "—",
    gmv: Number(b.gmv),
    komisi: b.komisi === null ? null : Number(b.komisi),
    jumlahUpload: b.jumlah_upload,
    minimumUpload: b.minimum_unggahan,
    coSampel: null,
    // Laporan tingkat unit dicocokkan lewat kode unit, bukan account_id.
    target: targetUntuk(sasaran, b.account_id, b.unit_kode),
    catatan: b.catatan,
    status: b.status,
    submittedAt: b.submitted_at,
  };
}

/** Sasaran yang laporannya sudah masuk hari ini. */
export async function sudahDilaporkan(
  pengguna: Pengguna,
  tanggal: string,
): Promise<string[]> {
  if (modeData() === "demo") {
    const { daily_reports, accounts } = dataContoh;
    // Semua sasaran yang sudah dilapor siapa pun — penyaringan "punya siapa"
    // dilakukan pemanggil lewat `sasaranUntuk`.
    return daily_reports
      .filter((l) => l.tanggal === tanggal)
      .map((l) =>
        l.akun
          ? `akun:${accounts.find((a) => a.username === l.akun)?.id}`
          : `unit:${l.unit}`,
      );
  }

  const sb = await klienServer();
  const { data } = await sb
    .from("daily_reports")
    .select("account_id, unit_id, units:unit_id (kode)")
    .eq("tanggal", tanggal);

  return (data ?? []).map((r) => {
    const unit = r.units as unknown as { kode: string } | null;
    return r.account_id ? `akun:${r.account_id}` : `unit:${unit?.kode}`;
  });
}

/** Jejak revisi satu laporan. */
export async function jejakRevisi(reportId: string): Promise<RevisiLaporan[]> {
  if (modeData() === "demo") return [];

  const sb = await klienServer();
  const { data } = await sb
    .from("daily_report_revisions")
    .select(
      `id, report_id, gmv_lama, gmv_baru, komisi_lama, komisi_baru,
       upload_lama, upload_baru, alasan, created_at, users:diubah_oleh (nama)`,
    )
    .eq("report_id", reportId)
    .order("created_at");

  return (data ?? []).map((r) => ({
    id: r.id,
    reportId: r.report_id,
    gmvLama: Number(r.gmv_lama),
    gmvBaru: Number(r.gmv_baru),
    komisiLama: r.komisi_lama === null ? null : Number(r.komisi_lama),
    komisiBaru: r.komisi_baru === null ? null : Number(r.komisi_baru),
    uploadLama: r.upload_lama,
    uploadBaru: r.upload_baru,
    alasan: r.alasan,
    diubahOleh: (r.users as unknown as { nama: string } | null)?.nama ?? "—",
    createdAt: r.created_at,
  }));
}

/** Satu laporan beserta jejak revisinya — untuk halaman detail. */
/**
 * CO sampel satu laporan: dihitung ulang dari log pemindaian pada tanggal
 * laporan itu, bukan dibaca dari barisnya — angka itu memang tidak pernah
 * disimpan di `daily_reports`.
 */
async function lengkapiCoSampel(laporan: LaporanHarian) {
  if (!laporan.akunId) return laporan;
  const peta = await coSampelHariIni(laporan.tanggal);
  return { ...laporan, coSampel: peta[`akun:${laporan.akunId}`] ?? 0 };
}

export async function ambilLaporan(
  id: string,
  pengguna: Pengguna,
  tanggal: string,
): Promise<{ laporan: LaporanHarian; jejak: RevisiLaporan[] } | null> {
  if (modeData() === "demo") {
    const riwayat = await riwayatLaporan(pengguna, tanggal, 200);
    const laporan = riwayat.find((r) => r.id === id);
    return laporan
      ? { laporan: await lengkapiCoSampel(laporan), jejak: [] }
      : null;
  }

  const sb = await klienServer();
  const { data } = await sb
    .from("riwayat_laporan_minimum")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const b = data as unknown as BarisLaporan;
  const sasaran = await sasaranUntuk(pengguna, b.tanggal);
  const jejak = await jejakRevisi(id);

  const laporan: LaporanHarian = {
    ...bentukLaporan(b, sasaran),
    jumlahRevisi: jejak.length,
  };

  return { laporan: await lengkapiCoSampel(laporan), jejak };
}
