const RUPIAH_STEPS = [
  { batas: 1_000_000_000_000, suffix: "T" },
  { batas: 1_000_000_000, suffix: "M" },
  { batas: 1_000_000, suffix: "Jt" },
  { batas: 1_000, suffix: "Rb" },
] as const;

function angkaId(nilai: number, digit: number, pangkas: boolean) {
  const teks = nilai.toLocaleString("id-ID", {
    minimumFractionDigits: pangkas ? 0 : digit,
    maximumFractionDigits: digit,
  });
  return teks;
}

/**
 * Rp 34,20 Jt / Rp 850 Jt / Rp 400 Rb — format ringkas ala dasbor.
 * `digit` = jumlah desimal, `pangkas` membuang desimal nol (20,0 Jt → 20 Jt).
 */
export function rupiahRingkas(
  nilai: number,
  { digit = 1, pangkas = true, prefix = true } = {},
) {
  const tanda = nilai < 0 ? "-" : "";
  const abs = Math.abs(nilai);
  const awalan = prefix ? "Rp " : "";

  for (const step of RUPIAH_STEPS) {
    if (abs >= step.batas) {
      return `${tanda}${awalan}${angkaId(abs / step.batas, digit, pangkas)} ${step.suffix}`;
    }
  }
  return `${tanda}${awalan}${angkaId(abs, 0, true)}`;
}

/** Rp 34.200.000 — format penuh untuk detail & tabel. */
export function rupiahPenuh(nilai: number) {
  return nilai.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

/** 91,2% — persentase gaya Indonesia (koma desimal). */
export function persen(nilai: number, digit = 1) {
  return `${nilai.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digit,
  })}%`;
}

/**
 * Rasio capaian terhadap target dalam persen — apa adanya, boleh lewat 100
 * supaya teks "116,7% dari target" tetap jujur. Pemagaran 0–100 dilakukan
 * di komponen bar, bukan di sini.
 */
export function rasioCapaian(capaian: number, target: number) {
  if (target <= 0) return 0;
  return Math.max(0, (capaian / target) * 100);
}

/** Kamis, 24 Oktober 2024 */
export function tanggalPanjang(tanggal: Date | string) {
  const d = typeof tanggal === "string" ? new Date(tanggal) : tanggal;
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** 14:20 WIB */
export function jamWib(tanggal: Date | string) {
  const d = typeof tanggal === "string" ? new Date(tanggal) : tanggal;
  const jam = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });
  return `${jam.replace(".", ":")} WIB`;
}

/** 24 Okt 2024 — bentuk pendek untuk daftar & metadata. */
export function tanggalPendek(tanggal: Date | string) {
  const d = typeof tanggal === "string" ? new Date(tanggal) : tanggal;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "Hari ini", "Kemarin", atau tanggal pendek — relatif terhadap `acuan`. */
export function tanggalRelatif(tanggal: Date | string, acuan: Date | string) {
  const d = typeof tanggal === "string" ? new Date(tanggal) : tanggal;
  const a = typeof acuan === "string" ? new Date(acuan) : acuan;

  const hari = (x: Date) =>
    Math.floor(
      new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime() /
        86_400_000,
    );
  const selisih = hari(a) - hari(d);

  if (selisih === 0) return "Hari ini";
  if (selisih === 1) return "Kemarin";
  return tanggalPendek(d);
}

/**
 * "Oktober 2024" — label bulan untuk judul periode.
 *
 * Selalu dibaca sebagai UTC: string "2024-10-01" yang diurai di zona
 * WIB tetap menunjuk 1 Oktober, tetapi di zona barat Greenwich ia
 * mundur menjadi 30 September dan labelnya berubah bulan.
 */
export function bulanPanjang(bulan: string) {
  return new Date(`${bulan.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString(
    "id-ID",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
}

/** "Okt 2024" — bentuk pendek untuk deret dan label sempit. */
export function bulanPendek(bulan: string) {
  return new Date(`${bulan.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString(
    "id-ID",
    { month: "short", year: "numeric", timeZone: "UTC" },
  );
}

/** 342.163 — bilangan bulat gaya Indonesia, untuk jumlah dan cacah. */
export function bilangan(nilai: number) {
  return Math.round(nilai).toLocaleString("id-ID");
}
