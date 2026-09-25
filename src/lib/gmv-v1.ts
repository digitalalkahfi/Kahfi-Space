/**
 * Menyatukan tiga sumber GMV ekspor V1 — modul murni.
 *
 * Angka GMV yang sama muncul di tiga tempat berbeda di sistem lama:
 * pada rekap per akun per hari (`affiliate-gmv:daily`), pada rekap per
 * divisi (`gmv:daily`, yang sebagiannya salinan otomatis dari rekap akun
 * — `autoSynced`), dan pada laporan harian yang diketik orang.
 * Memindahkan ketiganya apa adanya membuat GMV perusahaan terhitung dua
 * sampai tiga kali lipat — kesalahan yang tidak menimbulkan satu pun
 * galat dan langsung merusak seluruh KPI.
 *
 * Urutan kepercayaannya ditetapkan dari data sungguhan (ekspor 25 Sep
 * 2026), bukan dari dugaan:
 *
 * 1. `affiliate-gmv:daily` — rekap akun per hari. Inilah angka yang
 *    dipakai dasbor sistem lama sendiri: `gmv:daily` divisi internal
 *    yang bertanda `autoSynced` adalah jumlah rekap ini.
 * 2. `gmv:daily` yang bukan `autoSynced` — rekap unit MCN dan TAP yang
 *    diketik leadernya; satu-satunya sumber angka untuk kedua unit itu.
 * 3. Laporan harian. Angka GMV yang diketik di dalamnya ternyata
 *    menunjuk HARI SEBELUMNYA (355 dari 545 laporan cocok dengan rekap
 *    tanggal kemarin, hanya 22 yang cocok tanggal yang sama; judul
 *    pertanyaannya pun "GMV … (Kemarin)"), dan sebagian salah ketik.
 *    Laporan tetap dibawa — isinya catatan kerja — tetapi angkanya tidak
 *    boleh menjadi GMV hari itu bila rekapnya ada.
 *
 * Yang kalah tidak dibuang diam-diam: setiap baris yang tidak dipakai
 * dilaporkan beserta sebabnya, supaya selisih di layar verifikasi bisa
 * dijelaskan tanpa menebak.
 */
import { keAngka, keTanggal } from "@/lib/impor";
import { bakuAkun, medanLaporan, ratakanLaporan } from "@/lib/laporan-v1";
import { unitV1 } from "@/lib/peran-v1";

export type SumberGmv = "affiliate" | "harian" | "laporan";

export const URUTAN_SUMBER: Record<SumberGmv, number> = {
  affiliate: 1,
  harian: 2,
  laporan: 3,
};

export const LABEL_SUMBER: Record<SumberGmv, string> = {
  affiliate: "Rekap GMV affiliator",
  harian: "Rekap GMV harian unit",
  laporan: "Laporan harian yang diketik orang",
};

export type BarisGmv = {
  idLama: string;
  tanggal: string;
  /** Nama akun dalam bentuk baku (`bakuAkun`), atau null untuk angka unit. */
  akun: string | null;
  /** Kode unit V2, untuk angka yang bukan per akun. */
  unit: string | null;
  gmv: number;
  komisi: number | null;
  upload: number | null;
  /** Jumlah pesanan menurut rekap lama; V2 tidak punya kolomnya. */
  pesanan: number | null;
  /** Id orang lama yang mencatat angka ini. */
  pencatat: string | null;
  /** Kapan angka ini terakhir diubah di sistem lama (ISO), bila tercatat. */
  diperbarui: string | null;
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
export function sasaranGmv(b: {
  tanggal: string;
  akun: string | null;
  unit: string | null;
}) {
  return `${b.tanggal}|${b.akun ? `akun:${b.akun}` : `unit:${b.unit ?? "-"}`}`;
}

function bacaLarik(isi: Record<string, unknown>, kunci: string) {
  const nilai = isi[kunci];
  return Array.isArray(nilai) ? (nilai as Record<string, unknown>[]) : [];
}

const teks = (nilai: unknown) =>
  typeof nilai === "string" && nilai.trim() !== "" ? nilai.trim() : null;

/**
 * Nama akun baku dari id akun lama. Rekap affiliator menunjuk akun lewat
 * `accountId` (id di `affiliate-accounts:all`), dan mesin migrasi mencari
 * akun V2 lewat username bakunya — jadi keduanya harus bertemu di sini.
 */
function namaAkunLama(isi: Record<string, unknown>) {
  const peta = new Map<string, string>();
  for (const a of bacaLarik(isi, "affiliate-accounts:all")) {
    const id = teks(a.id);
    const nama = bakuAkun(a.username ?? a.name ?? a.nama);
    if (id && nama) peta.set(id, nama);
  }
  return peta;
}

/** Divisi tiap orang lama, untuk laporan yang tidak menyebut unitnya. */
function divisiOrangLama(isi: Record<string, unknown>) {
  const peta = new Map<string, unknown>();
  for (const o of bacaLarik(isi, "users:list")) {
    const id = teks(o.id);
    if (id) peta.set(id, o.division);
  }
  return peta;
}

/**
 * Menyatukan ketiga sumber menjadi satu angka per sasaran per hari.
 */
export function gabungGmv(isi: Record<string, unknown>): HasilGabung {
  const kandidat: BarisGmv[] = [];
  const dilewati: Dilewati[] = [];
  const namaAkun = namaAkunLama(isi);
  const divisiOrang = divisiOrangLama(isi);

  // Sumber 1 — rekap affiliator, angka yang dipakai dasbor lama.
  for (const g of bacaLarik(isi, "affiliate-gmv:daily")) {
    const tanggal = keTanggal(g.date);
    const idLama = teks(g.id) ?? "";
    if (idLama === "") continue;
    if (!tanggal) {
      dilewati.push({
        idLama,
        sumber: "affiliate",
        alasan: `Tanggal '${String(g.date ?? "")}' tidak terbaca.`,
      });
      continue;
    }

    // Akun dicari lewat id-nya di daftar akun lama; ekspor yang tidak
    // punya daftar itu (atau contoh) menyebut namanya langsung.
    const idAkun = teks(g.accountId);
    const akun =
      (idAkun ? namaAkun.get(idAkun) : null) ??
      bakuAkun(g.accountName) ??
      bakuAkun(idAkun);
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
      pesanan: keAngka(g.orders),
      pencatat: teks(g.inputById),
      diperbarui: teks(g.updatedAt) ?? teks(g.createdAt),
      sumber: "affiliate",
    });
  }

  // Sumber 2 — rekap harian per divisi. Yang bertanda autoSynced adalah
  // salinan otomatis dari rekap akun; membawanya berarti menghitung
  // angka yang sama dua kali. Divisi internal (unit Affiliator Network di
  // V2) pun tidak dibawa: GMV unit itu dihitung V2 dari akun-akunnya.
  for (const g of bacaLarik(isi, "gmv:daily")) {
    const idLama = teks(g.id) ?? "";
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

    const idAkun = teks(g.accountId);
    const akun = idAkun ? (namaAkun.get(idAkun) ?? bakuAkun(idAkun)) : null;
    const divisi = teks(g.division);
    const unit = akun ? null : divisi ? unitV1(divisi) : null;
    if (!akun && !divisi) {
      dilewati.push({
        idLama,
        sumber: "harian",
        alasan: "Tidak menyebut akun maupun divisi.",
      });
      continue;
    }
    if (!akun && !unit) {
      dilewati.push({
        idLama,
        sumber: "harian",
        alasan: `Divisi '${divisi}' tidak punya unit di V2.`,
      });
      continue;
    }
    if (!akun && unit === "affiliator") {
      dilewati.push({
        idLama,
        sumber: "harian",
        alasan:
          "GMV unit Affiliator Network dihitung V2 dari akun-akunnya; rekap divisi internal tidak dibawa supaya tidak dobel.",
      });
      continue;
    }

    kandidat.push({
      idLama,
      tanggal,
      akun,
      unit,
      gmv: keAngka(g.gmv) ?? 0,
      komisi: null,
      upload: null,
      pesanan: keAngka(g.orders),
      pencatat: teks(g.inputById),
      diperbarui: teks(g.updatedAt) ?? teks(g.createdAt),
      sumber: "harian",
    });
  }

  // Sumber 3 — laporan harian. Dibaca lewat perataan yang sama dengan
  // mesin migrasi, jadi bentuk contoh, bentuk mentah (`fieldsSnapshot`),
  // dan bentuk transformed sama-sama terbaca.
  for (const l of bacaLarik(isi, "daily-reports:all")) {
    const idLama = teks(l.id) ?? "";
    if (idLama === "") continue;
    const datar = ratakanLaporan(l);
    const medan = medanLaporan(datar);
    const tanggal = keTanggal(medan.tanggal);
    if (!tanggal) continue;

    const akun = bakuAkun(medan.akun);
    const pelapor = teks(medan.user);
    const divisi = medan.unit ?? (pelapor ? divisiOrang.get(pelapor) : null);
    const unit = akun ? null : unitV1(divisi);
    if (!akun && !unit) continue;

    kandidat.push({
      idLama,
      tanggal,
      akun,
      unit,
      gmv: keAngka(medan.gmv) ?? 0,
      komisi: keAngka(medan.komisi),
      upload: keAngka(medan.upload),
      pesanan: null,
      pencatat: pelapor,
      diperbarui: teks(l.updatedAt) ?? teks(medan.dikirim),
      sumber: "laporan",
    });
  }

  // Satu sasaran per hari hanya boleh diwakili satu angka: sumber yang
  // lebih dipercaya menang; di dalam sumber yang sama, yang terakhir
  // diperbarui menang (rekap lama pernah menyimpan dua entri untuk hari
  // yang sama, dan yang lebih baru adalah koreksinya).
  const terpilih = new Map<string, BarisGmv>();
  for (const b of kandidat) {
    const kunci = sasaranGmv(b);
    const sudah = terpilih.get(kunci);
    if (!sudah) {
      terpilih.set(kunci, b);
      continue;
    }

    let menang: BarisGmv;
    if (URUTAN_SUMBER[b.sumber] !== URUTAN_SUMBER[sudah.sumber]) {
      menang =
        URUTAN_SUMBER[b.sumber] < URUTAN_SUMBER[sudah.sumber] ? b : sudah;
    } else {
      menang = (b.diperbarui ?? "") > (sudah.diperbarui ?? "") ? b : sudah;
    }
    const kalah = menang === b ? sudah : b;

    terpilih.set(kunci, menang);
    dilewati.push({
      idLama: kalah.idLama,
      sumber: kalah.sumber,
      alasan:
        kalah.sumber === menang.sumber
          ? `Entri ganda untuk ${kunci.replace("|", " · ")}; yang terakhir diperbarui (${menang.idLama}) yang dipakai.`
          : `Angka yang sama sudah diwakili ${LABEL_SUMBER[menang.sumber].toLowerCase()} untuk ${kunci.replace("|", " · ")}.`,
    });
  }

  return {
    baris: [...terpilih.values()].sort(
      (a, b) =>
        a.tanggal.localeCompare(b.tanggal) ||
        sasaranGmv(a).localeCompare(sasaranGmv(b)),
    ),
    dilewati,
  };
}

/**
 * Rekap akun per hari, dikunci `akun#tanggal`, untuk dipakai mesin
 * migrasi laporan: GMV sebuah laporan akun diambil dari sini, bukan dari
 * angka yang diketik di laporannya.
 */
export function petaRekapAkun(hasil: HasilGabung): Map<string, BarisGmv> {
  const peta = new Map<string, BarisGmv>();
  for (const b of hasil.baris) {
    if (b.sumber === "affiliate" && b.akun) {
      peta.set(`${b.akun}#${b.tanggal}`, b);
    }
  }
  return peta;
}

/**
 * GMV yang ditulis untuk laporan akun: rekap tanggal yang sama, atau nol
 * bila rekapnya tidak ada.
 *
 * Nol, bukan angka yang diketik: angka yang diketik menunjuk hari
 * sebelumnya, yang sudah terwakili rekap hari itu — membawanya berarti
 * menghitungnya dua kali. Angka yang diketik tidak hilang: ia ditulis ke
 * catatan laporan supaya tetap bisa diperiksa orang.
 */
export function gmvLaporanAkun(
  rekap: Map<string, BarisGmv>,
  akun: string,
  tanggal: string,
  diketik: number | null,
): { gmv: number; keterangan: string | null } {
  const ada = rekap.get(`${akun}#${tanggal}`);
  const gmv = ada ? ada.gmv : 0;
  if (diketik === null || diketik === gmv) return { gmv, keterangan: null };
  return {
    gmv,
    keterangan: ada
      ? `GMV yang diketik di laporan lama: ${diketik}. GMV harian diambil dari rekap affiliator tanggal yang sama; angka yang diketik menunjuk hari sebelumnya.`
      : `GMV yang diketik di laporan lama: ${diketik}. Tidak ada rekap affiliator untuk tanggal ini, jadi GMV harian ditulis nol; angka yang diketik menunjuk hari sebelumnya yang sudah terwakili rekapnya.`,
  };
}

/** Ringkasan dari mana angka yang dipakai berasal. */
export function ringkasGabungGmv(hasil: HasilGabung) {
  const per: Record<SumberGmv, number> = {
    affiliate: 0,
    harian: 0,
    laporan: 0,
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
      : d.alasan.includes("Entri ganda")
        ? "Entri ganda dalam sumber yang sama; yang terakhir diperbarui dipakai."
        : d.alasan;

    const ada = peta.get(sebab) ?? { sebab, jumlah: 0, contoh: [] };
    ada.jumlah += 1;
    if (ada.contoh.length < 5) ada.contoh.push(d.idLama);
    peta.set(sebab, ada);
  }

  return [...peta.values()].sort((a, b) => b.jumlah - a.jumlah);
}
