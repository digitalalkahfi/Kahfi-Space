/**
 * Ekspor Excel memakai SheetJS.
 *
 * Paket dipasang dari tarball resmi cdn.sheetjs.com, bukan dari registry npm —
 * rilis `xlsx` di npm berhenti di 0.18.5 dan membawa advisory yang sudah
 * diperbaiki di 0.19.3+. Jangan ganti ke `npm i xlsx`.
 *
 * Modulnya diimpor dinamis supaya tidak ikut bundel awal; halaman ini dibuka
 * dari HP dan ekspor hanya dipakai sesekali.
 */
export type KolomEkspor<T> = {
  judul: string;
  ambil: (baris: T) => string | number;
  /** Lebar kolom dalam karakter. */
  lebar?: number;
};

export async function unduhExcel<T>({
  baris,
  kolom,
  namaBerkas,
  namaSheet = "Data",
}: {
  baris: T[];
  kolom: KolomEkspor<T>[];
  /** Tanpa ekstensi; ".xlsx" ditambahkan otomatis. */
  namaBerkas: string;
  namaSheet?: string;
}) {
  const XLSX = await import("xlsx");

  const isi = baris.map((b) =>
    Object.fromEntries(kolom.map((k) => [k.judul, k.ambil(b)])),
  );

  const sheet = XLSX.utils.json_to_sheet(isi, {
    header: kolom.map((k) => k.judul),
  });
  sheet["!cols"] = kolom.map((k) => ({ wch: k.lebar ?? 16 }));

  const buku = XLSX.utils.book_new();
  // Nama sheet Excel maksimal 31 karakter.
  XLSX.utils.book_append_sheet(buku, sheet, namaSheet.slice(0, 31));
  XLSX.writeFile(buku, `${namaBerkas}.xlsx`);
}

/**
 * Satu lembar siap tulis. Bentuk barisnya sudah diratakan menjadi
 * `Record`, sehingga beberapa lembar dengan tipe data berbeda bisa
 * dikumpulkan dalam satu array tanpa cast.
 */
export type LembarEkspor = {
  nama: string;
  header: string[];
  lebar: number[];
  isi: Record<string, string | number>[];
};

/** Meratakan baris bertipe `T` memakai definisi kolomnya. */
export function lembarEkspor<T>(
  nama: string,
  baris: T[],
  kolom: KolomEkspor<T>[],
): LembarEkspor {
  return {
    nama,
    header: kolom.map((k) => k.judul),
    lebar: kolom.map((k) => k.lebar ?? 16),
    isi: baris.map((b) =>
      Object.fromEntries(kolom.map((k) => [k.judul, k.ambil(b)])),
    ),
  };
}

/**
 * Satu berkas berisi beberapa lembar.
 *
 * Laporan keuangan selalu dibaca berpasangan — arus kas menjelaskan
 * "uangnya ke mana", laba rugi menjelaskan "untungnya berapa" — dan
 * mengirim dua berkas terpisah membuat keduanya cepat terpisah pula.
 */
export async function unduhExcelBeberapaLembar({
  lembar,
  namaBerkas,
}: {
  lembar: LembarEkspor[];
  namaBerkas: string;
}) {
  const XLSX = await import("xlsx");
  const buku = XLSX.utils.book_new();

  for (const l of lembar) {
    const sheet = XLSX.utils.json_to_sheet(l.isi, { header: l.header });
    sheet["!cols"] = l.lebar.map((wch) => ({ wch }));
    // Nama sheet Excel maksimal 31 karakter.
    XLSX.utils.book_append_sheet(buku, sheet, l.nama.slice(0, 31));
  }

  XLSX.writeFile(buku, `${namaBerkas}.xlsx`);
}

/** k-space-laporan-harian-2024-10-24 */
export function namaBerkasTanggal(awalan: string, tanggal = new Date()) {
  const iso = tanggal.toISOString().slice(0, 10);
  return `${awalan}-${iso}`;
}
