/**
 * Menghitung angka sisi V1 langsung dari ekspor lama — modul murni.
 *
 * Sengaja dihitung ulang dari bahan mentahnya, bukan diambil dari
 * catatan migrasi. Catatan migrasi hanya tahu apa yang menurut dirinya
 * sendiri berhasil; ekspor lama tahu apa yang sebenarnya ada. Selisih
 * antara keduanya persis yang dicari layar verifikasi.
 */
import { keAngka } from "@/lib/impor";

export type GmvUnitBulan = {
  unit: string;
  bulan: string;
  gmv: number;
  laporan: number;
};

export type AngkaV1 = {
  anggota: number;
  anggotaAktif: number;
  akun: number;
  laporan: number;
  absensi: number;
  izin: number;
  tugas: number;
  todo: number;
  transaksi: number;
  kasMasuk: number;
  kasKeluar: number;
  saldo: number;
  gmv: GmvUnitBulan[];
};

const KOSONG: AngkaV1 = {
  anggota: 0,
  anggotaAktif: 0,
  akun: 0,
  laporan: 0,
  absensi: 0,
  izin: 0,
  tugas: 0,
  todo: 0,
  transaksi: 0,
  kasMasuk: 0,
  kasKeluar: 0,
  saldo: 0,
  gmv: [],
};

function larik(isi: Record<string, unknown>, kunci: string) {
  const nilai = isi[kunci];
  return Array.isArray(nilai) ? (nilai as Record<string, unknown>[]) : [];
}

/** Bulan sebuah tanggal, "2024-10-01" → "2024-10". */
function bulanDari(tanggal: unknown): string | null {
  if (typeof tanggal !== "string") return null;
  const cocok = /^(\d{4})-(\d{2})/.exec(tanggal.trim());
  return cocok ? `${cocok[1]}-${cocok[2]}` : null;
}

/**
 * Angka sisi V1 dari satu objek ekspor.
 *
 * Tidak pernah melempar: ekspor lama tidak seragam, dan layar verifikasi
 * yang mati karena satu baris menyimpang tidak membantu siapa pun.
 */
export function angkaEksporV1(isi: Record<string, unknown>): AngkaV1 {
  const orang = larik(isi, "users:list");
  const akun = larik(isi, "affiliate-accounts:all");
  const laporan = larik(isi, "daily-reports:all");
  const absensi = larik(isi, "attendance:all");
  const izin = larik(isi, "leave-requests:all");
  const tugas = larik(isi, "tasks:all");
  const todo = larik(isi, "todos:all");
  const kas = larik(isi, "keuangan:cashflow");

  // Unit sebuah laporan Affiliator datang dari akunnya, bukan dari
  // laporannya sendiri — laporan lama hanya menyebut nama akun.
  const unitAkun = new Map<string, string>();
  for (const a of akun) {
    const nama = typeof a.username === "string" ? a.username : null;
    const unit = typeof a.division === "string" ? a.division : null;
    if (nama && unit) unitAkun.set(nama, unit);
  }

  const gmv = new Map<string, GmvUnitBulan>();
  for (const l of laporan) {
    const bulan = bulanDari(l["Tanggal Laporan"]);
    if (!bulan) continue;

    const namaAkun = typeof l.Akun === "string" ? l.Akun : null;
    const unit = namaAkun
      ? (unitAkun.get(namaAkun) ?? "affiliator")
      : typeof l.Unit === "string"
        ? l.Unit
        : "(tanpa unit)";

    const kunci = `${unit}|${bulan}`;
    const baris = gmv.get(kunci) ?? { unit, bulan, gmv: 0, laporan: 0 };
    baris.gmv += keAngka(l.GMV) ?? 0;
    baris.laporan += 1;
    gmv.set(kunci, baris);
  }

  let masuk = 0;
  let keluar = 0;
  for (const t of kas) {
    const jumlah = keAngka(t.amount) ?? 0;
    // Sistem lama memakai "in"/"out"; yang lain dianggap keluar supaya
    // saldo tidak pernah tampak lebih besar dari yang sebenarnya.
    if (t.type === "in") masuk += jumlah;
    else keluar += jumlah;
  }

  return {
    ...KOSONG,
    anggota: orang.length,
    anggotaAktif: orang.filter((o) => o.active !== false).length,
    akun: akun.length,
    laporan: laporan.length,
    absensi: absensi.length,
    izin: izin.length,
    tugas: tugas.length,
    todo: todo.length,
    transaksi: kas.length,
    kasMasuk: masuk,
    kasKeluar: keluar,
    saldo: masuk - keluar,
    gmv: [...gmv.values()].sort(
      (a, b) => a.bulan.localeCompare(b.bulan) || a.unit.localeCompare(b.unit),
    ),
  };
}

export const ANGKA_V1_KOSONG = KOSONG;

export type TargetRujukan = {
  unit: string;
  bulan: string;
  target: number;
};

/**
 * Angka target lama yang hanya dicatat sebagai rujukan.
 *
 * `gmv:targets` dan `affiliate:goal` tidak dipetakan ke mana pun: target
 * di V2 hidup sebagai goal berjenjang dengan anak tangga bulanan, dan
 * menimpanya dengan angka lama akan mengubah dasar penilaian KPI yang
 * sedang berjalan.
 *
 * Tetapi ia tidak boleh hilang begitu saja: ketika angka capaian V1 dan
 * V2 berselisih, pertanyaan pertama selalu "targetnya waktu itu berapa".
 * Karena itu angkanya tetap dibaca — sebagai pembanding, bukan sebagai
 * sesuatu yang ditulis.
 */
export function targetRujukanV1(isi: Record<string, unknown>): TargetRujukan[] {
  const daftar = isi["gmv:targets"];
  if (!Array.isArray(daftar)) return [];

  const peta = new Map<string, TargetRujukan>();
  for (const t of daftar) {
    if (t === null || typeof t !== "object") continue;
    const baris = t as Record<string, unknown>;
    const unit = typeof baris.division === "string" ? baris.division : null;
    const bulan = bulanDari(baris.month);
    const target = keAngka(baris.target);
    if (!unit || !bulan || target === null) continue;

    const kunci = `${unit}|${bulan}`;
    const ada = peta.get(kunci);
    // Target yang sama disebut dua kali di ekspor lama bukan dua target;
    // yang terbaca belakangan menimpa, seperti di sistem lamanya.
    peta.set(kunci, ada ? { ...ada, target } : { unit, bulan, target });
  }

  return [...peta.values()].sort(
    (a, b) => a.bulan.localeCompare(b.bulan) || a.unit.localeCompare(b.unit),
  );
}

export type KehadiranBulan = {
  bulan: string;
  hadir: number;
  izin: number;
};

/**
 * Kehadiran lama per bulan.
 *
 * Total yang cocok belum berarti kehadirannya utuh: seribu baris di V1
 * dan seribu di V2 bisa saja jatuh di bulan yang berbeda-beda. Yang
 * menangkap itu hanya perbandingan per bulan.
 *
 * Izin beberapa hari dihitung per hari, sama seperti cara ia dipetakan:
 * di V2 satu izin tiga hari menjadi tiga baris kehadiran.
 */
export function kehadiranBulanV1(
  isi: Record<string, unknown>,
): KehadiranBulan[] {
  const peta = new Map<string, KehadiranBulan>();
  const tambah = (bulan: string, jenis: "hadir" | "izin", n = 1) => {
    const baris = peta.get(bulan) ?? { bulan, hadir: 0, izin: 0 };
    baris[jenis] += n;
    peta.set(bulan, baris);
  };

  for (const a of larik(isi, "attendance:all")) {
    const bulan = bulanDari(a.date);
    if (bulan) tambah(bulan, "hadir");
  }

  for (const z of larik(isi, "leave-requests:all")) {
    const mulai = typeof z.startDate === "string" ? z.startDate : null;
    const selesai = typeof z.endDate === "string" ? z.endDate : mulai;
    if (!mulai) continue;

    // Dihitung per hari supaya sebanding dengan cara ia dipetakan.
    const awal = new Date(`${mulai.slice(0, 10)}T00:00:00Z`);
    const akhir = new Date(`${(selesai ?? mulai).slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(awal.getTime())) continue;

    const habis = Number.isNaN(akhir.getTime()) || akhir < awal ? awal : akhir;
    for (
      let d = awal, n = 0;
      d <= habis && n < 62;
      d = new Date(d.getTime() + 86400000), n += 1
    ) {
      tambah(d.toISOString().slice(0, 7), "izin");
    }
  }

  return [...peta.values()].sort((a, b) => a.bulan.localeCompare(b.bulan));
}

export type KasBulan = {
  bulan: string;
  masuk: number;
  keluar: number;
};

/**
 * Arus kas lama per bulan.
 *
 * Saldo akhir yang cocok belum berarti arus kasnya utuh: satu transaksi
 * masuk yang hilang dan satu transaksi keluar yang hilang dengan jumlah
 * sama akan saling meniadakan, dan saldonya tetap bertemu. Yang
 * menangkap itu hanya perbandingan per bulan.
 */
export function kasBulanV1(isi: Record<string, unknown>): KasBulan[] {
  const peta = new Map<string, KasBulan>();

  for (const t of larik(isi, "keuangan:cashflow")) {
    const bulan = bulanDari(t.date);
    if (!bulan) continue;

    const jumlah = keAngka(t.amount) ?? 0;
    const baris = peta.get(bulan) ?? { bulan, masuk: 0, keluar: 0 };
    // Sama seperti penjumlahan totalnya: hanya penanda masuk yang
    // dikenali, supaya saldo tidak pernah tampak lebih besar.
    if (t.type === "in") baris.masuk += jumlah;
    else baris.keluar += jumlah;
    peta.set(bulan, baris);
  }

  return [...peta.values()].sort((a, b) => a.bulan.localeCompare(b.bulan));
}
