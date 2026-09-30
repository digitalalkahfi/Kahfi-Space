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

/** Selisih WIB terhadap UTC. WIB tidak mengenal musim panas. */
const SELISIH_WIB_MS = 7 * 3_600_000;

/**
 * Tanggal (YYYY-MM-DD) sebuah waktu menurut WIB; "" bila waktunya rusak.
 *
 * `toISOString().slice(0, 10)` memberi tanggal UTC, yang tertinggal
 * sehari antara 00.00 dan 06.59 WIB.
 */
export function keTanggalWib(waktu: Date | string): string {
  const d = typeof waktu === "string" ? new Date(waktu) : waktu;
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + SELISIH_WIB_MS).toISOString().slice(0, 10);
}

/** Tanggal hari ini (YYYY-MM-DD) di zona Asia/Jakarta. */
export function hariIniWib(sekarang: Date = new Date()): string {
  return keTanggalWib(sekarang);
}

/** Jam (HH:MM) sebuah waktu menurut WIB — untuk mengisi ulang `<input type="time">`. */
export function keJamWib(waktu: Date | string): string {
  const d = typeof waktu === "string" ? new Date(waktu) : waktu;
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + SELISIH_WIB_MS).toISOString().slice(11, 16);
}

/**
 * "Hari ini", "Besok", "Kemarin", atau "2 Okt" — tanggal kalender
 * relatif terhadap `hariIni` (keduanya YYYY-MM-DD, WIB).
 */
export function tanggalKalenderRelatif(tanggal: string, hariIni: string) {
  if (!tanggal) return "";
  const selisih = Math.round(
    (Date.parse(`${tanggal}T00:00:00Z`) - Date.parse(`${hariIni}T00:00:00Z`)) /
      86_400_000,
  );
  if (selisih === 0) return "Hari ini";
  if (selisih === 1) return "Besok";
  if (selisih === -1) return "Kemarin";
  return tanggalKalenderPendek(tanggal, hariIni);
}

/**
 * "Rabu, 16 September 2026" untuk tanggal kalender (YYYY-MM-DD).
 *
 * Dibaca sebagai UTC, sama seperti `bulanPanjang`: tanggal tanpa jam
 * yang diurai di zona barat Greenwich mundur sehari.
 */
export function tanggalKalenderPanjang(tanggal: string) {
  return new Date(`${tanggal}T00:00:00Z`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "16 Sep" / "16 Sep 2025" untuk tanggal kalender; tahun hanya bila beda. */
export function tanggalKalenderPendek(tanggal: string, acuan?: string) {
  const tahunSama = acuan ? acuan.slice(0, 4) === tanggal.slice(0, 4) : false;
  return new Date(`${tanggal}T00:00:00Z`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    ...(tahunSama ? {} : { year: "numeric" }),
    timeZone: "UTC",
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

/**
 * "Hari ini", "Kemarin", atau tanggal pendek — relatif terhadap `acuan`,
 * keduanya dibaca sebagai tanggal kalender WIB.
 *
 * Bukan zona waktu mesin yang merender: saat SSR itu UTC, di peramban
 * WIB, sehingga cap waktu 00.00–06.59 WIB berlabel "Kemarin" di server
 * tetapi "Hari ini" di peramban.
 */
export function tanggalRelatif(tanggal: Date | string, acuan: Date | string) {
  const hari = keTanggalWib(tanggal);
  if (!hari) return "";

  const selisih = Math.round(
    (Date.parse(`${keTanggalWib(acuan)}T00:00:00Z`) -
      Date.parse(`${hari}T00:00:00Z`)) /
      86_400_000,
  );

  if (selisih === 0) return "Hari ini";
  if (selisih === 1) return "Kemarin";
  return tanggalKalenderPendek(hari);
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
