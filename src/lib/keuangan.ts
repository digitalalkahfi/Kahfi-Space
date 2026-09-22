/**
 * Keuangan — tipe & perhitungan murni, tanpa akses database.
 *
 * Aturannya mengikuti PRD §4: tiap transaksi punya arah masuk/keluar,
 * pengeluaran wajib berjenis, dan NPM dihitung terhadap net revenue —
 * bukan terhadap pendapatan kotor. Pemisahan beban dan aset ada di sini
 * sejak awal, sebab pencampuran keduanyalah yang membuat NPM lama salah.
 */
import type { KodeUnit } from "@/lib/types";

export type ArahTransaksi = "masuk" | "keluar";

/** Jenis pengeluaran (PRD §4). Pemasukan tidak memakai jenis ini. */
export type JenisKeluar =
  "beban" | "aset" | "direct_cost" | "creator_share" | "dividen";

export type StatusTransaksi = "diajukan" | "disetujui" | "ditolak" | "dibayar";

export type Transaksi = {
  id: string;
  tanggal: string;
  arah: ArahTransaksi;
  /** Wajib untuk arah keluar, kosong untuk arah masuk. */
  jenis: JenisKeluar | null;
  /** Kategori pendapatan per unit; wajib untuk arah masuk. */
  unitKode: KodeUnit | null;
  unitNama: string;
  /** Akun affiliator bila transaksinya menyangkut satu akun; boleh kosong. */
  akunUsername: string | null;
  keterangan: string;
  jumlah: number;
  status: StatusTransaksi;
  /** Id pengaju; dipakai menegakkan "tidak menyetujui pengajuan sendiri". */
  diajukanId: string | null;
  diajukanNama: string | null;
  disetujuiNama: string | null;
};

/**
 * Satu keputusan atas sebuah transaksi.
 *
 * Posisi kas saat itu ikut direkam: ambang wewenang CEO (PRD §4)
 * bergantung pada angka yang berubah terus, jadi tanpa merekamnya
 * keputusan lama tidak bisa dinilai ulang dengan adil.
 */
export type KeputusanTransaksi = {
  id: string;
  dari: StatusTransaksi | null;
  ke: StatusTransaksi;
  olehNama: string | null;
  catatan: string;
  saldoKas: number;
  penyetujuWajib: string | null;
  pada: string;
};

export const LABEL_JENIS_KELUAR: Record<JenisKeluar, string> = {
  beban: "Beban",
  aset: "Aset",
  direct_cost: "Direct cost akun",
  creator_share: "Creator share",
  dividen: "Dividen",
};

export const LABEL_STATUS_TRANSAKSI: Record<StatusTransaksi, string> = {
  diajukan: "Menunggu persetujuan",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
  dibayar: "Dibayar",
};

export const GAYA_STATUS_TRANSAKSI: Record<StatusTransaksi, string> = {
  diajukan: "bg-warn-fill text-warn-text",
  disetujui: "bg-info-fill text-info-text",
  ditolak: "bg-danger-fill text-danger-text",
  dibayar: "bg-ok-fill text-ok-text",
};

/**
 * Batas kas yang menaikkan persetujuan ke CEO (PRD §4).
 *
 * Di bawah angka ini setiap pengeluaran — sekecil apa pun — wajib
 * disetujui CEO: saat kas menipis, keputusan membelanjakannya bukan lagi
 * urusan operasional.
 */
export const BATAS_KAS_CEO = 150_000_000;

/** Siapa yang harus menyetujui sebuah pengajuan pengeluaran. */
export function penyetujuiWajib(saldoKas: number): "CEO" | "Manager" {
  return saldoKas < BATAS_KAS_CEO ? "CEO" : "Manager";
}

/** Transaksi yang sudah benar-benar menggerakkan kas. */
export function menggerakkanKas(t: Transaksi) {
  return t.status === "dibayar";
}

export type RingkasKeuangan = {
  /** Uang masuk yang sudah diterima. */
  pendapatan: number;
  /** Pengeluaran langsung yang melekat pada pendapatan. */
  directCost: number;
  creatorShare: number;
  /** Pendapatan setelah direct cost & creator share — dasar NPM. */
  netRevenue: number;
  beban: number;
  aset: number;
  dividen: number;
  labaBersih: number;
  /** Laba bersih ÷ net revenue, dalam persen. */
  npm: number;
  saldoKas: number;
  menungguPersetujuan: number;
};

/**
 * Ringkasan keuangan sebuah periode.
 *
 * Aset sengaja TIDAK mengurangi laba: membeli barang bernilai bukan
 * beban, melainkan memindahkan bentuk kekayaan. Pencampuran keduanya
 * persis yang membuat NPM sistem lama salah (PRD §1). Kas tetap
 * berkurang, karena uangnya memang keluar.
 */
/** Ringkasan kosong — dipakai saat angkanya memang tidak boleh dilihat. */
export const RINGKAS_KOSONG: RingkasKeuangan = {
  pendapatan: 0,
  directCost: 0,
  creatorShare: 0,
  netRevenue: 0,
  beban: 0,
  aset: 0,
  dividen: 0,
  labaBersih: 0,
  npm: 0,
  saldoKas: 0,
  menungguPersetujuan: 0,
};

export function ringkasKeuangan(
  daftar: Transaksi[],
  saldoAwal = 0,
): RingkasKeuangan {
  const jumlah = (pilih: (t: Transaksi) => boolean) =>
    daftar
      .filter((t) => menggerakkanKas(t) && pilih(t))
      .reduce((a, t) => a + t.jumlah, 0);

  const pendapatan = jumlah((t) => t.arah === "masuk");
  const directCost = jumlah((t) => t.jenis === "direct_cost");
  const creatorShare = jumlah((t) => t.jenis === "creator_share");
  const beban = jumlah((t) => t.jenis === "beban");
  const aset = jumlah((t) => t.jenis === "aset");
  const dividen = jumlah((t) => t.jenis === "dividen");

  const netRevenue = pendapatan - directCost - creatorShare;
  const labaBersih = netRevenue - beban;

  const menungguPersetujuan = daftar
    .filter((t) => t.status === "diajukan")
    .reduce((a, t) => a + t.jumlah, 0);

  return {
    pendapatan,
    directCost,
    creatorShare,
    netRevenue,
    beban,
    aset,
    dividen,
    labaBersih,
    npm: netRevenue > 0 ? Math.round((labaBersih / netRevenue) * 1000) / 10 : 0,
    saldoKas:
      saldoAwal +
      pendapatan -
      directCost -
      creatorShare -
      beban -
      aset -
      dividen,
    menungguPersetujuan,
  };
}

export type BarisWaterfall = {
  label: string;
  nilai: number;
  /** true bila baris ini hasil akhir, bukan penambah/pengurang. */
  total: boolean;
};

/**
 * Waterfall manajemen: dari pendapatan sampai laba bersih.
 *
 * Dividen dan aset tidak masuk: keduanya bukan bagian dari laba,
 * melainkan pemakaian laba dan perpindahan bentuk kekayaan.
 */
export function waterfallManajemen(r: RingkasKeuangan): BarisWaterfall[] {
  return [
    { label: "Pendapatan", nilai: r.pendapatan, total: false },
    { label: "Direct cost akun", nilai: -r.directCost, total: false },
    { label: "Creator share", nilai: -r.creatorShare, total: false },
    { label: "Net revenue", nilai: r.netRevenue, total: true },
    { label: "Beban", nilai: -r.beban, total: false },
    { label: "Laba bersih", nilai: r.labaBersih, total: true },
  ];
}

/** Hanya Finance, Manager, dan CEO yang membuka modul Keuangan. */
export function bolehLihatKeuangan(peran: string) {
  return peran === "Finance" || peran === "Manager" || peran === "CEO";
}

export type MasukanTransaksi = {
  tanggal: string;
  arah: ArahTransaksi;
  jenis: JenisKeluar | null;
  unitKode: KodeUnit | null;
  akunUsername: string | null;
  keterangan: string;
  jumlah: number;
};

/**
 * Pemeriksaan isian transaksi — satu tempat, dipakai layar maupun server.
 *
 * Aturan PRD §4 yang dijaga di sini: pengeluaran wajib berjenis, dan
 * pemasukan wajib menyebut unit pendapatannya. Keduanya bukan formalitas:
 * tanpa jenis, beban dan aset kembali bercampur; tanpa unit, pendapatan
 * tidak bisa dibandingkan dengan targetnya.
 */
export function periksaTransaksi(input: MasukanTransaksi): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.tanggal)) {
    return "Tanggal transaksi tidak sah.";
  }
  if (input.keterangan.trim().length < 5) {
    return "Tulis keterangan singkat (minimal 5 huruf) supaya transaksinya bisa ditelusuri.";
  }
  if (!Number.isFinite(input.jumlah) || input.jumlah <= 0) {
    return "Nominal harus lebih dari nol.";
  }
  if (input.jumlah > 100_000_000_000) {
    return "Nominal di luar batas wajar, periksa lagi.";
  }

  if (input.arah === "keluar") {
    if (input.jenis === null) {
      return "Pengeluaran wajib berjenis: beban, aset, direct cost, creator share, atau dividen.";
    }
    if (input.jenis === "direct_cost" && input.unitKode === null) {
      return "Direct cost menempel pada unit; pilih unitnya.";
    }
  } else {
    if (input.jenis !== null) {
      return "Pemasukan tidak memakai jenis pengeluaran.";
    }
    if (input.unitKode === null) {
      return "Pemasukan wajib menyebut unit pendapatannya.";
    }
  }

  return null;
}

/**
 * Status awal sebuah pengajuan.
 *
 * Pemasukan dicatat apa adanya — uang yang sudah masuk tidak perlu
 * disetujui. Pengeluaran selalu mulai dari 'diajukan', sekecil apa pun.
 */
export function statusAwal(arah: ArahTransaksi): StatusTransaksi {
  return arah === "masuk" ? "dibayar" : "diajukan";
}

export type SaringanTransaksi = {
  cari: string;
  arah: ArahTransaksi | "semua";
  jenis: JenisKeluar | "semua";
  unit: string;
  status: StatusTransaksi | "semua";
  dari: string;
  sampai: string;
};

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

const ARAH_SAH: ArahTransaksi[] = ["masuk", "keluar"];
const JENIS_SAH: JenisKeluar[] = [
  "beban",
  "aset",
  "direct_cost",
  "creator_share",
  "dividen",
];
const STATUS_SAH: StatusTransaksi[] = [
  "diajukan",
  "disetujui",
  "ditolak",
  "dibayar",
];

export const SARINGAN_TRANSAKSI_KOSONG: SaringanTransaksi = {
  cari: "",
  arah: "semua",
  jenis: "semua",
  unit: "semua",
  status: "semua",
  dari: "",
  sampai: "",
};

/** Membaca saringan dari parameter URL, menolak nilai yang tidak dikenal. */
export function bacaSaringanTransaksi(params: {
  cari?: string | string[];
  arah?: string | string[];
  jenis?: string | string[];
  unit?: string | string[];
  status?: string | string[];
  dari?: string | string[];
  sampai?: string | string[];
}): SaringanTransaksi {
  const satu = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";

  const arah = satu(params.arah);
  const jenis = satu(params.jenis);
  const status = satu(params.status);
  const dari = satu(params.dari);
  const sampai = satu(params.sampai);

  return {
    cari: satu(params.cari).trim().slice(0, 60),
    arah: ARAH_SAH.includes(arah as ArahTransaksi)
      ? (arah as ArahTransaksi)
      : "semua",
    jenis: JENIS_SAH.includes(jenis as JenisKeluar)
      ? (jenis as JenisKeluar)
      : "semua",
    unit: satu(params.unit) || "semua",
    status: STATUS_SAH.includes(status as StatusTransaksi)
      ? (status as StatusTransaksi)
      : "semua",
    dari: POLA_TANGGAL.test(dari) ? dari : "",
    sampai: POLA_TANGGAL.test(sampai) ? sampai : "",
  };
}

export function transaksiTersaring(s: SaringanTransaksi) {
  return (
    s.cari !== "" ||
    s.arah !== "semua" ||
    s.jenis !== "semua" ||
    s.unit !== "semua" ||
    s.status !== "semua" ||
    s.dari !== "" ||
    s.sampai !== ""
  );
}

/**
 * Menyaring daftar transaksi.
 *
 * Pencarian menjangkau keterangan, unit, dan akunnya: orang mencari
 * "iklan skincare" atau "@fashion_hijab", bukan nomor transaksi.
 */
export function saringTransaksi(
  daftar: Transaksi[],
  s: SaringanTransaksi,
): Transaksi[] {
  const kata = s.cari.toLowerCase();

  return daftar.filter((t) => {
    if (s.arah !== "semua" && t.arah !== s.arah) return false;
    if (s.jenis !== "semua" && t.jenis !== s.jenis) return false;
    if (s.unit !== "semua" && t.unitNama !== s.unit) return false;
    if (s.status !== "semua" && t.status !== s.status) return false;
    if (s.dari && t.tanggal < s.dari) return false;
    if (s.sampai && t.tanggal > s.sampai) return false;

    if (kata === "") return true;
    return [t.keterangan, t.unitNama, t.akunUsername ?? ""].some((x) =>
      x.toLowerCase().includes(kata),
    );
  });
}

/** Rentang bulan sebuah tanggal, untuk saringan periode bawaan. */
export function rentangBulan(tanggal: string) {
  const dari = `${tanggal.slice(0, 7)}-01`;
  const akhir = new Date(
    Date.UTC(Number(tanggal.slice(0, 4)), Number(tanggal.slice(5, 7)), 0),
  );
  return { dari, sampai: akhir.toISOString().slice(0, 10) };
}

export type BarisLaporan = {
  label: string;
  nilai: number;
  /** Baris hasil penjumlahan, bukan komponen. */
  total?: boolean;
  /** Keterangan singkat; menjelaskan angka yang mudah disalahpahami. */
  catatan?: string;
};

/**
 * Laporan arus kas.
 *
 * Disusun per aktivitas, bukan per jenis: pertanyaan yang dijawab arus
 * kas adalah "uangnya dari mana dan ke mana", bukan "untung berapa".
 * Pembelian aset karena itu berdiri sendiri sebagai arus investasi —
 * di laba rugi ia tidak muncul sama sekali.
 */
export function laporanCashFlow(
  r: RingkasKeuangan,
  saldoAwal: number,
): BarisLaporan[] {
  const operasi = r.pendapatan - r.directCost - r.creatorShare - r.beban;

  return [
    { label: "Saldo kas awal", nilai: saldoAwal, total: true },
    { label: "Penerimaan usaha", nilai: r.pendapatan },
    { label: "Direct cost akun", nilai: -r.directCost },
    { label: "Creator share", nilai: -r.creatorShare },
    { label: "Beban operasional", nilai: -r.beban },
    { label: "Arus kas operasi", nilai: operasi, total: true },
    {
      label: "Pembelian aset",
      nilai: -r.aset,
      catatan: "Arus investasi; tidak mengurangi laba.",
    },
    {
      label: "Dividen dibayar",
      nilai: -r.dividen,
      catatan: "Arus pendanaan; pemakaian laba yang sudah jadi.",
    },
    { label: "Saldo kas akhir", nilai: r.saldoKas, total: true },
  ];
}

/**
 * Laporan laba rugi (P&L).
 *
 * Aset dan dividen sengaja tidak ada di sini — keduanya bukan biaya.
 * Menampilkannya akan mengulangi persis kesalahan yang membuat NPM lama
 * keliru.
 */
export function laporanLabaRugi(r: RingkasKeuangan): BarisLaporan[] {
  return [
    { label: "Pendapatan", nilai: r.pendapatan },
    { label: "Direct cost akun", nilai: -r.directCost },
    { label: "Creator share", nilai: -r.creatorShare },
    {
      label: "Net revenue",
      nilai: r.netRevenue,
      total: true,
      catatan: "Dasar perhitungan NPM.",
    },
    { label: "Beban operasional", nilai: -r.beban },
    { label: "Laba bersih", nilai: r.labaBersih, total: true },
  ];
}

export type KontribusiUnit = {
  unitNama: string;
  pendapatan: number;
  directCost: number;
  creatorShare: number;
  netRevenue: number;
  /** Bagian unit ini terhadap net revenue seluruh perusahaan, persen. */
  porsi: number;
};

/**
 * Kontribusi tiap unit terhadap net revenue.
 *
 * Beban perusahaan sengaja tidak dibagi ke unit: membagi sewa kantor
 * dengan rumus apa pun menghasilkan angka yang terasa pasti padahal
 * dasarnya pilihan sewenang-wenang. Yang ditampilkan hanya yang benar-
 * benar melekat pada unitnya.
 */
export function kontribusiUnit(daftar: Transaksi[]): KontribusiUnit[] {
  const peta = new Map<string, KontribusiUnit>();

  const ambil = (nama: string) => {
    const ada = peta.get(nama);
    if (ada) return ada;
    const baru: KontribusiUnit = {
      unitNama: nama,
      pendapatan: 0,
      directCost: 0,
      creatorShare: 0,
      netRevenue: 0,
      porsi: 0,
    };
    peta.set(nama, baru);
    return baru;
  };

  for (const t of daftar) {
    if (!menggerakkanKas(t)) continue;
    if (t.arah === "masuk") {
      ambil(t.unitNama).pendapatan += t.jumlah;
    } else if (t.jenis === "direct_cost") {
      ambil(t.unitNama).directCost += t.jumlah;
    } else if (t.jenis === "creator_share") {
      ambil(t.unitNama).creatorShare += t.jumlah;
    }
  }

  const hasil = [...peta.values()].map((u) => ({
    ...u,
    netRevenue: u.pendapatan - u.directCost - u.creatorShare,
  }));

  const total = hasil.reduce((a, u) => a + u.netRevenue, 0);

  return hasil
    .map((u) => ({
      ...u,
      porsi: total > 0 ? Math.round((u.netRevenue / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.netRevenue - a.netRevenue);
}

/** Selisih dua periode pada tiap langkah waterfall. */
export function bandingkanWaterfall(
  sekarang: RingkasKeuangan,
  sebelumnya: RingkasKeuangan,
): { label: string; nilai: number; selisih: number; total: boolean }[] {
  const lalu = new Map(
    waterfallManajemen(sebelumnya).map((b) => [b.label, b.nilai]),
  );

  return waterfallManajemen(sekarang).map((b) => ({
    ...b,
    selisih: b.nilai - (lalu.get(b.label) ?? 0),
  }));
}

/**
 * Periode pembanding sebelum sebuah rentang.
 *
 * Rentang yang tepat satu bulan kalender dibandingkan dengan bulan
 * sebelumnya — itulah yang orang maksud dengan "dibanding bulan lalu",
 * meski jumlah harinya berbeda. Rentang lain memakai jendela sepanjang
 * hari yang sama, sebab "pekan lalu" memang berarti tujuh hari lagi.
 */
export function periodeSebelumnya(dari: string, sampai: string) {
  const sebulanPenuh =
    dari === rentangBulan(dari).dari && sampai === rentangBulan(dari).sampai;

  if (sebulanPenuh) {
    const bulanLalu = new Date(`${dari}T00:00:00Z`);
    bulanLalu.setUTCMonth(bulanLalu.getUTCMonth() - 1);
    return rentangBulan(bulanLalu.toISOString().slice(0, 10));
  }

  const mulai = new Date(`${dari}T00:00:00Z`);
  const akhir = new Date(`${sampai}T00:00:00Z`);
  const hari = Math.round((akhir.getTime() - mulai.getTime()) / 86_400_000) + 1;

  const sampaiLalu = new Date(mulai);
  sampaiLalu.setUTCDate(sampaiLalu.getUTCDate() - 1);
  const dariLalu = new Date(sampaiLalu);
  dariLalu.setUTCDate(dariLalu.getUTCDate() - (hari - 1));

  return {
    dari: dariLalu.toISOString().slice(0, 10),
    sampai: sampaiLalu.toISOString().slice(0, 10),
  };
}

export type IzinPersetujuan = {
  /** Boleh menyetujui/menolak pengajuan ini. */
  bolehPutuskan: boolean;
  /** Alasan singkat bila tidak boleh; dipakai layar apa adanya. */
  alasan: string;
};

/**
 * Siapa yang boleh memutuskan sebuah pengajuan pengeluaran.
 *
 * PRD §4: pengeluaran disetujui Manager/CEO, dan bila kas di bawah
 * Rp 150 juta seluruh pengeluaran wajib disetujui CEO. Yang mengajukan
 * tidak boleh menyetujui pengajuannya sendiri — sekalipun ia Manager:
 * persetujuan yang bisa diberikan kepada diri sendiri tidak menahan apa
 * pun.
 */
export function izinPersetujuan(
  peran: string,
  penggunaId: string,
  pengajuId: string | null,
  saldoKas: number,
): IzinPersetujuan {
  const wajib = penyetujuiWajib(saldoKas);

  if (pengajuId !== null && pengajuId === penggunaId) {
    return {
      bolehPutuskan: false,
      alasan: "Pengajuanmu sendiri diputuskan orang lain.",
    };
  }

  if (wajib === "CEO") {
    return peran === "CEO"
      ? { bolehPutuskan: true, alasan: "" }
      : {
          bolehPutuskan: false,
          alasan: `Kas di bawah ${BATAS_KAS_CEO.toLocaleString("id-ID")}: hanya CEO yang bisa memutuskan.`,
        };
  }

  return peran === "CEO" || peran === "Manager"
    ? { bolehPutuskan: true, alasan: "" }
    : {
        bolehPutuskan: false,
        alasan: "Hanya Manager atau CEO yang memutuskan pengeluaran.",
      };
}

/** Perpindahan status pengajuan yang masuk akal. */
export function perpindahanSah(
  dari: StatusTransaksi,
  ke: StatusTransaksi,
): boolean {
  if (dari === "diajukan") return ke === "disetujui" || ke === "ditolak";
  // Yang sudah disetujui tinggal dibayar; menolak setelah menyetujui
  // berarti keputusannya berubah, dan itu perlu jejaknya sendiri.
  if (dari === "disetujui") return ke === "dibayar";
  return false;
}
