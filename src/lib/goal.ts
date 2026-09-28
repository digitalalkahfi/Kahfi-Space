/** Aturan goal yang dipakai server maupun layar; tanpa akses database. */
import { geserBulan } from "@/lib/kalender";
import { hariDalamBulan, hariDalamRentang } from "@/lib/periode-finance";

/** Batas lead measure aktif per goal; ditegakkan trigger `batasi_lead_measure`. */
export const MAKS_LEAD_MEASURE = 3;

export type LevelGoal = "company" | "manager" | "leader" | "account" | "staff";

export const LEVEL_GOAL: LevelGoal[] = [
  "company",
  "manager",
  "leader",
  "account",
  "staff",
];

export const NAMA_LEVEL: Record<LevelGoal, string> = {
  company: "Perusahaan",
  manager: "Manager",
  leader: "Leader / unit",
  account: "Akun",
  staff: "Staf",
};

/** Induk yang sah berada lebih tinggi di tangga roll-down — sejalan 0065. */
export function bolehJadiInduk(anak: LevelGoal, induk: LevelGoal) {
  return LEVEL_GOAL.indexOf(induk) < LEVEL_GOAL.indexOf(anak);
}

/** Label periode goal, mis. "2024-Q4" — bentuk kolom `goals.periode` lama. */
export function periodeKuartal(tanggal: string) {
  const bulan = Number(tanggal.slice(5, 7));
  return `${tanggal.slice(0, 4)}-Q${Math.ceil(bulan / 3)}`;
}

// ---------------------------------------------------------------------
// Anak tangga dan periode goal
//
// Periode goal ditulis sampai ke tanggalnya (SMART: terikat waktu):
// tanggal mulai dan tanggal selesai. Di database periode itu dipotong per
// bulan kalender menjadi anak tangga `goal_months`, masing-masing dengan
// rentang tanggal yang dicakupnya di bulan itu (migrasi 0178). Satu aturan
// ini dipakai dialog tambah, dialog ubah, server, dan mode demo, supaya
// yang dipratinjau persis yang disimpan dan dihitung.
// ---------------------------------------------------------------------

/** Lama periode paling panjang, sejalan pemeriksaan `ubah_goal` (0178). */
export const MAKS_BULAN_GOAL = 12;

/** Anak tangga tersimpan: target bagian periode yang jatuh di satu bulan. */
export type AnakTanggaGoal = {
  /** Bulan kalender anak tangga, "YYYY-MM-01". */
  bulan: string;
  /** Tanggal pertama dan terakhir periode di bulan itu. */
  dari: string;
  sampai: string;
  target: number;
};

/**
 * Bentuk longgar: data lama dan data contoh belum membawa rentang, yang
 * artinya bulan penuh — sama dengan bawaan trigger di database (0178).
 */
export type AnakTanggaLonggar = {
  bulan: string;
  target: number;
  dari?: string | null;
  sampai?: string | null;
};

/** Tanggal terakhir bulan sebuah tanggal, "YYYY-MM-DD". */
export function akhirBulan(tanggal: string): string {
  return `${tanggal.slice(0, 7)}-${String(hariDalamBulan(tanggal)).padStart(2, "0")}`;
}

/** Anak tangga dengan rentang lengkap; tanpa rentang berarti bulan penuh. */
export function lengkapiRentang(b: AnakTanggaLonggar): AnakTanggaGoal {
  return {
    bulan: `${b.bulan.slice(0, 7)}-01`,
    dari: b.dari ? b.dari.slice(0, 10) : `${b.bulan.slice(0, 7)}-01`,
    sampai: b.sampai ? b.sampai.slice(0, 10) : akhirBulan(b.bulan),
    target: Number(b.target),
  };
}

/**
 * Target harian dari anak tangga GRD pada satu tanggal: tiap anak tangga
 * yang rentangnya mencakup tanggal itu dibagi rata ke hari di dalam
 * rentangnya, lalu dijumlahkan. Di luar rentang targetnya nol.
 *
 * Rumusnya sengaja sama persis dengan `target_harian_akun` dan
 * `target_harian_unit` di database (0178; untuk bulan penuh sama dengan
 * 0006). Pelapor tidak pernah mengetik target; angka ini satu-satunya
 * sumbernya, dan mode demo harus menghasilkan angka yang sama dengan mode
 * Supabase — bukan mirip.
 */
export function targetHarianGrd(
  bulanList: readonly AnakTanggaLonggar[],
  tanggal: string,
): number {
  return bulanList.reduce((jumlah, mentah) => {
    const b = lengkapiRentang(mentah);
    if (tanggal < b.dari || tanggal > b.sampai) return jumlah;
    return jumlah + b.target / hariDalamRentang(b);
  }, 0);
}

/**
 * Cara membaca angka target sebuah goal:
 * - "bulanan": angka itu target SETIAP bulan penuh (GMV bulanan); bulan
 *   yang hanya terpakai sebagian mendapat bagian menurut jumlah harinya;
 * - "total"  : angka itu untuk seluruh periode, dibagi rata per hari.
 * Untuk periode tepat satu bulan penuh keduanya sama.
 */
export type ModeTarget = "bulanan" | "total";

export const NAMA_MODE_TARGET: Record<ModeTarget, string> = {
  bulanan: "Sama setiap bulan",
  total: "Total seluruh periode",
};

/** Tanggal "YYYY-MM-DD" yang benar-benar ada di kalender. */
export function tanggalSah(tanggal: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return false;
  const [t, b, h] = tanggal.split("-").map(Number);
  const d = new Date(Date.UTC(t, b - 1, h));
  return (
    d.getUTCFullYear() === t &&
    d.getUTCMonth() === b - 1 &&
    d.getUTCDate() === h
  );
}

/** Geser tanggal sebanyak `n` hari, bebas zona waktu. */
function geserHari(tanggal: string, n: number): string {
  const [t, b, h] = tanggal.split("-").map(Number);
  return new Date(Date.UTC(t, b - 1, h + n)).toISOString().slice(0, 10);
}

/**
 * Geser tanggal sebanyak `n` bulan. Tanggal yang tidak ada di bulan tujuan
 * (31 Jan + 1 bulan) jatuh ke akhir bulan itu — sama dengan
 * `date + interval` di PostgreSQL.
 */
function geserBulanTanggal(tanggal: string, n: number): string {
  const tujuan = geserBulan(`${tanggal.slice(0, 7)}-01`, n);
  const hari = Math.min(Number(tanggal.slice(8, 10)), hariDalamBulan(tujuan));
  return `${tujuan.slice(0, 8)}${String(hari).padStart(2, "0")}`;
}

/** Tanggal selesai untuk periode tepat `n` bulan sejak `mulai`. */
export function selesaiSetelah(mulai: string, n: number): string {
  return geserHari(geserBulanTanggal(mulai, n), -1);
}

/** Tanggal selesai paling jauh untuk sebuah tanggal mulai. */
export function batasSelesaiGoal(mulai: string): string {
  return selesaiSetelah(mulai, MAKS_BULAN_GOAL);
}

/** Alasan periode tidak sah, atau null bila sah — sama di layar dan server. */
export function periksaPeriode(mulai: string, selesai: string): string | null {
  if (!tanggalSah(mulai)) return "Tanggal mulai belum diisi dengan benar.";
  if (!tanggalSah(selesai)) return "Tanggal selesai belum diisi dengan benar.";
  if (selesai < mulai) {
    return "Tanggal selesai tidak boleh sebelum tanggal mulai.";
  }
  if (selesai > batasSelesaiGoal(mulai)) {
    return `Periode goal paling lama ${MAKS_BULAN_GOAL} bulan.`;
  }
  return null;
}

/** Banyaknya hari dalam periode, tanggal mulai dan selesai ikut dihitung. */
export function jumlahHariPeriode(mulai: string, selesai: string): number {
  return hariDalamRentang({ dari: mulai, sampai: selesai });
}

/** Periode tepat satu bulan kalender penuh: cara baca target tidak berpengaruh. */
export function satuBulanPenuh(mulai: string, selesai: string): boolean {
  return mulai.slice(8, 10) === "01" && selesai === akhirBulan(mulai);
}

/**
 * Periode dipotong per bulan kalender: rentang setiap anak tangga.
 * Periode yang tidak sah menghasilkan daftar kosong.
 */
export function potongPerBulan(
  mulai: string,
  selesai: string,
): Omit<AnakTanggaGoal, "target">[] {
  if (periksaPeriode(mulai, selesai)) return [];
  const bulanAkhir = `${selesai.slice(0, 7)}-01`;
  const hasil: Omit<AnakTanggaGoal, "target">[] = [];
  for (let bulan = `${mulai.slice(0, 7)}-01`; bulan <= bulanAkhir;) {
    hasil.push({
      bulan,
      dari: hasil.length === 0 ? mulai : bulan,
      sampai: bulan === bulanAkhir ? selesai : akhirBulan(bulan),
    });
    bulan = geserBulan(bulan, 1);
  }
  return hasil;
}

/**
 * Anak tangga menurut cara baca targetnya.
 * - "bulanan": target × hari yang dicakup ÷ hari sebulan, dibulatkan.
 * - "total"  : target dibagi menurut jumlah hari tiap potongan; sisa
 *   pembulatan jatuh ke anak tangga terakhir supaya jumlahnya persis sama
 *   dengan target goal.
 */
export function susunAnakTangga(
  mulai: string,
  selesai: string,
  target: number,
  mode: ModeTarget,
): AnakTanggaGoal[] {
  const potongan = potongPerBulan(mulai, selesai);
  if (mode === "bulanan") {
    return potongan.map((p) => ({
      ...p,
      target: Math.round(
        (target * hariDalamRentang(p)) / hariDalamBulan(p.bulan),
      ),
    }));
  }
  const totalHari = jumlahHariPeriode(mulai, selesai);
  let terbagi = 0;
  return potongan.map((p, i) => {
    const bagian =
      i === potongan.length - 1
        ? target - terbagi
        : Math.floor((target * hariDalamRentang(p)) / totalHari);
    terbagi += bagian;
    return { ...p, target: bagian };
  });
}

/** Periode sebuah goal dibaca dari anak tangganya; null bila belum ada. */
export function periodeDariTangga(
  tangga: readonly AnakTanggaLonggar[],
): { mulai: string; selesai: string } | null {
  if (tangga.length === 0) return null;
  const lengkap = tangga.map(lengkapiRentang);
  return {
    mulai: lengkap.reduce((a, b) => (b.dari < a ? b.dari : a), lengkap[0].dari),
    selesai: lengkap.reduce(
      (a, b) => (b.sampai > a ? b.sampai : a),
      lengkap[0].sampai,
    ),
  };
}

/**
 * Cara baca target sebuah goal yang sudah tersimpan, ditebak dari anak
 * tangganya. "kustom" berarti anak tangganya tidak sesuai kedua cara —
 * mis. data lama yang targetnya menanjak tiap bulan.
 */
export function tebakModeTarget(
  tangga: readonly AnakTanggaLonggar[],
  targetGoal: number,
): ModeTarget | "kustom" {
  if (tangga.length === 0) return "bulanan";
  const lengkap = tangga.map(lengkapiRentang);
  const bulanan = lengkap.every(
    (b) =>
      Math.abs(
        b.target -
          Math.round(
            (targetGoal * hariDalamRentang(b)) / hariDalamBulan(b.bulan),
          ),
      ) <= 1,
  );
  if (bulanan) return "bulanan";
  const jumlah = lengkap.reduce((a, b) => a + b.target, 0);
  if (Math.abs(jumlah - targetGoal) < 1) return "total";
  return "kustom";
}

const BULAN_PENDEK = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const namaBulan = (tanggal: string) =>
  BULAN_PENDEK[Number(tanggal.slice(5, 7)) - 1];

/** "15 Okt 2026" — tanggal goal yang dibaca orang. */
export function tanggalGoal(tanggal: string): string {
  return `${Number(tanggal.slice(8, 10))} ${namaBulan(tanggal)} ${tanggal.slice(0, 4)}`;
}

/**
 * Label periode lengkap dengan tanggalnya: "1 – 31 Okt 2026",
 * "15 Okt – 14 Des 2026", atau "15 Nov 2026 – 14 Jan 2027".
 * Disimpan juga di kolom `goals.periode`.
 */
export function labelPeriode(mulai: string, selesai: string): string {
  if (mulai === selesai) return tanggalGoal(mulai);
  const hariMulai = Number(mulai.slice(8, 10));
  if (mulai.slice(0, 7) === selesai.slice(0, 7)) {
    return `${hariMulai} – ${tanggalGoal(selesai)}`;
  }
  if (mulai.slice(0, 4) === selesai.slice(0, 4)) {
    return `${hariMulai} ${namaBulan(mulai)} – ${tanggalGoal(selesai)}`;
  }
  return `${tanggalGoal(mulai)} – ${tanggalGoal(selesai)}`;
}

/** Letak tanggal acuan terhadap periode goal. */
export function statusPeriode(
  mulai: string,
  selesai: string,
  tanggal: string,
): "belum" | "berjalan" | "lewat" {
  if (tanggal < mulai) return "belum";
  if (tanggal > selesai) return "lewat";
  return "berjalan";
}

/**
 * Keterangan waktu sebuah goal terhadap tanggal acuan: "Sisa 3 hari",
 * "Hari terakhir", "Mulai 15 Okt 2026", atau "Berakhir 31 Okt 2026".
 */
export function keteranganTenggat(
  mulai: string,
  selesai: string,
  tanggal: string,
): string {
  const status = statusPeriode(mulai, selesai, tanggal);
  if (status === "belum") return `Mulai ${tanggalGoal(mulai)}`;
  if (status === "lewat") return `Berakhir ${tanggalGoal(selesai)}`;
  const sisa = jumlahHariPeriode(tanggal, selesai) - 1;
  return sisa === 0 ? "Hari terakhir" : `Sisa ${sisa} hari`;
}

// ---------------------------------------------------------------------
// Hapus goal
// ---------------------------------------------------------------------

/** Apa saja yang ikut terdampak bila sebuah goal dihapus. */
export type DampakHapusGoal = {
  anakTangga: number;
  turunan: number;
  leadMeasure: number;
  catatanLeadMeasure: number;
  komitmen: number;
};

/**
 * Kalimat dampak untuk dialog konfirmasi hapus goal; hanya yang memang
 * terdampak yang disebut. Sejalan aturan database: anak tangga dan lead
 * measure ikut terhapus (cascade), goal turunan dilepas dari induknya
 * (set null), dan komitmen mingguan diturunkan menjadi tiket (0022).
 */
export function kalimatDampakHapus(d: DampakHapusGoal): string[] {
  const kalimat: string[] = [];
  if (d.anakTangga > 0) {
    kalimat.push(`${d.anakTangga} anak tangga bulanannya ikut terhapus.`);
  }
  if (d.leadMeasure > 0) {
    kalimat.push(
      d.catatanLeadMeasure > 0
        ? `${d.leadMeasure} lead measure beserta ${d.catatanLeadMeasure} catatan hariannya ikut terhapus.`
        : `${d.leadMeasure} lead measure-nya ikut terhapus.`,
    );
  }
  if (d.turunan > 0) {
    kalimat.push(
      `${d.turunan} goal turunannya tidak ikut terhapus, tetapi kehilangan induk dan menjadi goal teratas.`,
    );
  }
  if (d.komitmen > 0) {
    kalimat.push(
      `${d.komitmen} komitmen mingguannya tidak dihapus, tetapi diubah menjadi tiket biasa.`,
    );
  }
  kalimat.push("Riwayat perubahan goal ini tetap tersimpan di jejak audit.");
  return kalimat;
}
