// Modul khusus server. Impor dari komponen klien akan gagal saat build,
// bukan diam-diam bocor ke browser.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import type {
  AkunAffiliator,
  KodeUnit,
  LaporanHarian,
  Pengguna,
  RevisiLaporan,
  SasaranLaporan,
} from "@/lib/types";

/** Berapa hari dalam bulan tanggal tersebut. */
function hariDalamBulan(tanggal: string) {
  return new Date(
    Number(tanggal.slice(0, 4)),
    Number(tanggal.slice(5, 7)),
    0,
  ).getDate();
}

// ---------------------------------------------------------------------
// Sasaran laporan: akun yang dipegang PIC, atau unit yang dipimpin Leader.
// ---------------------------------------------------------------------
export async function sasaranUntuk(
  pengguna: Pengguna,
  tanggal: string,
): Promise<SasaranLaporan[]> {
  const hari = hariDalamBulan(tanggal);

  if (modeData() === "demo") {
    const { accounts, units, goals } = dataContoh;
    const lintas = pengguna.role === "CEO" || pengguna.role === "Manager";

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
          targetHarian: a.target_harian,
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
      .map((u) => {
        const goal = goals.find(
          (g) => g.unit === u.kode && g.level === "leader",
        );
        return {
          jenis: "unit" as const,
          unitId: u.kode as KodeUnit,
          nama: u.nama,
          targetHarian: Math.round((goal?.target_bulan ?? 0) / hari),
        };
      });

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

// ---------------------------------------------------------------------
// Riwayat laporan
// ---------------------------------------------------------------------
type BarisLaporan = {
  id: string;
  tanggal: string;
  account_id: string | null;
  unit_id: string | null;
  gmv: number;
  catatan: string;
  status: "terkirim" | "revisi";
  submitted_at: string;
  accounts: { username: string } | null;
  units: { nama: string; kode: KodeUnit } | null;
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
    const lintas = pengguna.role === "CEO" || pengguna.role === "Manager";
    const akunSaya = new Set(
      accounts.filter((a) => a.pic === pengguna.nama).map((a) => a.username),
    );

    return daily_reports
      .filter(
        (l) =>
          lintas ||
          l.user === pengguna.nama ||
          (l.akun && akunSaya.has(l.akun)),
      )
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
          gmv: l.gmv,
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
    .from("daily_reports")
    .select(
      "id, tanggal, account_id, unit_id, gmv, catatan, status, submitted_at, accounts:account_id (username), units:unit_id (nama, kode)",
    )
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
    id: b.id,
    tanggal: b.tanggal,
    akunId: b.account_id,
    unitId: b.units?.kode ?? null,
    label: b.accounts?.username ?? b.units?.nama ?? "—",
    gmv: Number(b.gmv),
    // Laporan tingkat unit dicocokkan lewat kode unit, bukan account_id.
    target: targetUntuk(sasaran, b.account_id, b.units?.kode ?? null),
    catatan: b.catatan,
    status: b.status,
    submittedAt: b.submitted_at,
    jumlahRevisi: jumlahRevisi.get(b.id) ?? 0,
  }));
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
      "id, report_id, gmv_lama, gmv_baru, alasan, created_at, users:diubah_oleh (nama)",
    )
    .eq("report_id", reportId)
    .order("created_at");

  return (data ?? []).map((r) => ({
    id: r.id,
    reportId: r.report_id,
    gmvLama: Number(r.gmv_lama),
    gmvBaru: Number(r.gmv_baru),
    alasan: r.alasan,
    diubahOleh: (r.users as unknown as { nama: string } | null)?.nama ?? "—",
    createdAt: r.created_at,
  }));
}

/** Satu laporan beserta jejak revisinya — untuk halaman detail. */
export async function ambilLaporan(
  id: string,
  pengguna: Pengguna,
  tanggal: string,
): Promise<{ laporan: LaporanHarian; jejak: RevisiLaporan[] } | null> {
  if (modeData() === "demo") {
    const riwayat = await riwayatLaporan(pengguna, tanggal, 200);
    const laporan = riwayat.find((r) => r.id === id);
    return laporan ? { laporan, jejak: [] } : null;
  }

  const sb = await klienServer();
  const { data } = await sb
    .from("daily_reports")
    .select(
      "id, tanggal, account_id, unit_id, gmv, catatan, status, submitted_at, accounts:account_id (username), units:unit_id (nama, kode)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const b = data as unknown as BarisLaporan;
  const sasaran = await sasaranUntuk(pengguna, b.tanggal);
  const jejak = await jejakRevisi(id);

  return {
    laporan: {
      id: b.id,
      tanggal: b.tanggal,
      akunId: b.account_id,
      unitId: b.units?.kode ?? null,
      label: b.accounts?.username ?? b.units?.nama ?? "—",
      gmv: Number(b.gmv),
      target: targetUntuk(sasaran, b.account_id, b.units?.kode ?? null),
      catatan: b.catatan,
      status: b.status,
      submittedAt: b.submitted_at,
      jumlahRevisi: jejak.length,
    },
    jejak,
  };
}
