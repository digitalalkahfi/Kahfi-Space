/**
 * Menyatukan tiga sumber GMV ekspor V1 — modul murni.
 *
 * Angka GMV yang sama muncul di tiga tempat berbeda di sistem lama:
 * pada laporan harian yang diketik orang, pada `affiliate-gmv:daily`,
 * dan pada `gmv:daily` yang sebagiannya ditarik otomatis dari keduanya
 * (`autoSynced`). Memindahkan ketiganya apa adanya membuat GMV
 * perusahaan terhitung dua sampai tiga kali lipat — kesalahan yang tidak
 * menimbulkan satu pun galat dan langsung merusak seluruh KPI.
 *
 * Jadi ketiganya disatukan di sini, dengan urutan kepercayaan yang
 * tetap: laporan yang diketik orang lebih dipercaya daripada angka
 * turunan, dan angka turunan yang lebih rinci lebih dipercaya daripada
 * yang hanya menyebut totalnya.
 */
import { keAngka, keTanggal } from "@/lib/impor";

export type SumberGmv = "laporan" | "affiliate" | "harian";

export const URUTAN_SUMBER: Record<SumberGmv, number> = {
  laporan: 1,
  affiliate: 2,
  harian: 3,
};

export const LABEL_SUMBER: Record<SumberGmv, string> = {
  laporan: "Laporan harian yang diketik orang",
  affiliate: "Rekap GMV affiliator",
  harian: "Rekap GMV harian",
};

export type BarisGmv = {
  idLama: string;
  tanggal: string;
  /** Penunjuk akun apa adanya: id lama atau username. */
  akun: string | null;
  /** Kode unit, untuk angka yang bukan per akun. */
  unit: string | null;
  gmv: number;
  komisi: number | null;
  upload: number | null;
  sumber: SumberGmv;
};

export type Dilewati = {
  idLama: string;
  sumber: SumberGmv;
  alasan: string;
};

export type HasilGabung = {
  baris: BarisGmv[];
  dilewati: Dilewati[];
};

/** Sasaran sebuah angka: satu akun pada satu tanggal, atau satu unit. */
function sasaran(b: BarisGmv) {
  return `${b.tanggal}|${b.akun ? `akun:${b.akun}` : `unit:${b.unit ?? "-"}`}`;
}

function bacaLarik(isi: Record<string, unknown>, kunci: string) {
  const nilai = isi[kunci];
  return Array.isArray(nilai) ? (nilai as Record<string, unknown>[]) : [];
}

/**
 * Menyatukan ketiga sumber menjadi satu angka per sasaran per hari.
 *
 * Yang kalah tidak dibuang diam-diam: setiap baris yang tidak dipakai
 * dilaporkan beserta sebabnya, supaya selisih di layar verifikasi bisa
 * dijelaskan tanpa menebak.
 */
export function gabungGmv(isi: Record<string, unknown>): HasilGabung {
  const kandidat: BarisGmv[] = [];
  const dilewati: Dilewati[] = [];

  // Sumber 1 — laporan harian yang diketik orang.
  for (const l of bacaLarik(isi, "daily-reports:all")) {
    const tanggal = keTanggal(l["Tanggal Laporan"]);
    const idLama = typeof l.id === "string" ? l.id : "";
    if (!tanggal || idLama === "") continue;

    const akun = typeof l.Akun === "string" ? l.Akun.trim() : null;
    const unit = typeof l.Unit === "string" ? l.Unit.trim() : null;
    if (!akun && !unit) continue;

    kandidat.push({
      idLama,
      tanggal,
      akun,
      unit: akun ? null : unit,
      gmv: keAngka(l.GMV) ?? 0,
      komisi: keAngka(l.Komisi),
      upload: keAngka(l["Jumlah Upload"]),
      sumber: "laporan",
    });
  }

  // Sumber 2 — rekap affiliator, paling rinci di antara angka turunan.
  for (const g of bacaLarik(isi, "affiliate-gmv:daily")) {
    const tanggal = keTanggal(g.date);
    const idLama = typeof g.id === "string" ? g.id : "";
    const akun = typeof g.accountId === "string" ? g.accountId : null;
    if (!tanggal || idLama === "") continue;
    if (!akun) {
      dilewati.push({
        idLama,
        sumber: "affiliate",
        alasan: "Tidak menyebut akun mana pun.",
      });
      continue;
    }

    kandidat.push({
      idLama,
      tanggal,
      akun,
      unit: null,
      gmv: keAngka(g.gmv) ?? 0,
      komisi: keAngka(g.commission),
      upload: keAngka(g.uploads),
      sumber: "affiliate",
    });
  }

  // Sumber 3 — rekap harian. Yang bertanda autoSynced adalah salinan
  // otomatis dari kedua sumber di atas; membawanya berarti menghitung
  // angka yang sama dua kali.
  for (const g of bacaLarik(isi, "gmv:daily")) {
    const idLama = typeof g.id === "string" ? g.id : "";
    if (idLama === "") continue;

    if (g.autoSynced === true) {
      dilewati.push({
        idLama,
        sumber: "harian",
        alasan:
          "Ditandai autoSynced — salinan otomatis dari sumber lain; membawanya menggandakan GMV.",
      });
      continue;
    }

    const tanggal = keTanggal(g.date);
    if (!tanggal) {
      dilewati.push({
        idLama,
        sumber: "harian",
        alasan: `Tanggal '${String(g.date ?? "")}' tidak terbaca.`,
      });
      continue;
    }

    const akun = typeof g.accountId === "string" ? g.accountId : null;
    const unit = typeof g.division === "string" ? g.division.trim() : null;
    if (!akun && !unit) {
      dilewati.push({
        idLama,
        sumber: "harian",
        alasan: "Tidak menyebut akun maupun divisi.",
      });
      continue;
    }

    kandidat.push({
      idLama,
      tanggal,
      akun,
      unit: akun ? null : unit,
      gmv: keAngka(g.gmv) ?? 0,
      komisi: null,
      upload: null,
      sumber: "harian",
    });
  }

  // Satu sasaran per hari hanya boleh diwakili satu angka.
  const terpilih = new Map<string, BarisGmv>();
  for (const b of kandidat) {
    const kunci = sasaran(b);
    const sudah = terpilih.get(kunci);
    if (!sudah) {
      terpilih.set(kunci, b);
      continue;
    }

    const menang =
      URUTAN_SUMBER[b.sumber] < URUTAN_SUMBER[sudah.sumber] ? b : sudah;
    const kalah = menang === b ? sudah : b;

    terpilih.set(kunci, menang);
    dilewati.push({
      idLama: kalah.idLama,
      sumber: kalah.sumber,
      alasan: `Angka yang sama sudah diwakili ${LABEL_SUMBER[menang.sumber].toLowerCase()} untuk ${kunci.replace("|", " · ")}.`,
    });
  }

  return {
    baris: [...terpilih.values()].sort(
      (a, b) =>
        a.tanggal.localeCompare(b.tanggal) ||
        sasaran(a).localeCompare(sasaran(b)),
    ),
    dilewati,
  };
}

/** Ringkasan dari mana angka yang dipakai berasal. */
export function ringkasGabungGmv(hasil: HasilGabung) {
  const per: Record<SumberGmv, number> = {
    laporan: 0,
    affiliate: 0,
    harian: 0,
  };
  for (const b of hasil.baris) per[b.sumber] += 1;
  return {
    ...per,
    dipakai: hasil.baris.length,
    dilewati: hasil.dilewati.length,
    total: hasil.baris.length + hasil.dilewati.length,
  };
}

export type SebabDilewati = {
  sebab: string;
  jumlah: number;
  /** Beberapa contoh id lamanya, untuk ditelusuri bila perlu. */
  contoh: string[];
};

/**
 * Mengelompokkan yang dilewati menurut sebabnya.
 *
 * Daftar mentah berisi ribuan baris dan tidak terbaca siapa pun. Yang
 * perlu dilihat orang bukan barisnya satu per satu, melainkan: ada
 * berapa macam sebab, dan yang mana paling banyak. Dari situ baru jelas
 * apakah pelewatannya memang disengaja atau ada yang salah.
 */
export function sebabDilewati(hasil: HasilGabung): SebabDilewati[] {
  const peta = new Map<string, SebabDilewati>();

  for (const d of hasil.dilewati) {
    // Alasan yang menyebut tanggal dan akun tertentu dipendekkan supaya
    // ribuan baris yang sebabnya sama tidak menjadi ribuan kelompok.
    const sebab = d.alasan.includes("sudah diwakili")
      ? "Angka yang sama sudah diwakili sumber yang lebih dipercaya."
      : d.alasan;

    const ada = peta.get(sebab) ?? { sebab, jumlah: 0, contoh: [] };
    ada.jumlah += 1;
    if (ada.contoh.length < 5) ada.contoh.push(d.idLama);
    peta.set(sebab, ada);
  }

  return [...peta.values()].sort((a, b) => b.jumlah - a.jumlah);
}
