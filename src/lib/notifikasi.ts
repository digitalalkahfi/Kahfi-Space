/**
 * Pusat notifikasi in-app.
 *
 * Satu notifikasi = satu peristiwa yang terjadi pada seseorang. Ia
 * bukan pesan bebas: setiap notifikasi menunjuk ke satu tempat di
 * aplikasi, dan kalau tidak ada tempat yang bisa dituju, peristiwanya
 * tidak layak jadi notifikasi.
 */

export const KATEGORI_NOTIFIKASI = [
  "tugas",
  "tenggat",
  "pengumuman",
  "izin",
  "transaksi",
  "anggaran",
  "masukan",
] as const;

export type KategoriNotifikasi = (typeof KATEGORI_NOTIFIKASI)[number];

export const LABEL_KATEGORI: Record<KategoriNotifikasi, string> = {
  tugas: "Tugas",
  tenggat: "Tenggat",
  pengumuman: "Pengumuman",
  izin: "Izin & sakit",
  transaksi: "Transaksi",
  anggaran: "Anggaran",
  masukan: "Masukan & Kaizen",
};

/** Penjelasan singkat, dipakai di halaman preferensi. */
export const KETERANGAN_KATEGORI: Record<KategoriNotifikasi, string> = {
  tugas: "Tugas atau tiket baru ditugaskan kepadamu",
  tenggat: "Tenggat mendekat atau sudah lewat",
  pengumuman: "Pengumuman baru untuk peran atau unitmu",
  izin: "Keputusan atas pengajuan izin atau sakit",
  transaksi: "Keputusan atas transaksi yang kamu ajukan",
  anggaran: "Keputusan atas anggaran dan alokasinya",
  masukan: "Balasan atas masukan, bug, atau masalah yang kamu kirim",
};

export const GAYA_KATEGORI: Record<
  KategoriNotifikasi,
  { latar: string; teks: string }
> = {
  tugas: { latar: "bg-info-fill", teks: "text-info-text" },
  tenggat: { latar: "bg-warn-fill", teks: "text-warn-text" },
  pengumuman: { latar: "bg-accentmuted-fill", teks: "text-accentmuted-text" },
  izin: { latar: "bg-muted", teks: "text-muted-foreground" },
  transaksi: { latar: "bg-ok-fill", teks: "text-ok-text" },
  anggaran: { latar: "bg-ok-fill", teks: "text-ok-text" },
  masukan: { latar: "bg-info-fill", teks: "text-info-text" },
};

export type Notifikasi = {
  id: string;
  kategori: KategoriNotifikasi;
  judul: string;
  pesan: string;
  /** Ke mana notifikasi ini membawa; selalu jalur internal. */
  tautan: string;
  dibacaPada: string | null;
  dibuatPada: string;
};

export function belumDibaca(daftar: Notifikasi[]): Notifikasi[] {
  return daftar.filter((n) => n.dibacaPada === null);
}

export function jumlahBelumDibaca(daftar: Notifikasi[]): number {
  return belumDibaca(daftar).length;
}

/**
 * Angka pada lencana lonceng.
 *
 * Di atas 99 ditulis "99+": lebar lencana tidak boleh tumbuh mengikuti
 * angkanya, dan selisih antara 128 dan 341 notifikasi tak terbaca tidak
 * mengubah apa pun yang akan dilakukan orangnya.
 */
export function labelLencana(jumlah: number): string | null {
  if (jumlah <= 0) return null;
  return jumlah > 99 ? "99+" : String(jumlah);
}

export type Kelompok = "hari-ini" | "kemarin" | "pekan-ini" | "lebih-lama";

export const LABEL_KELOMPOK: Record<Kelompok, string> = {
  "hari-ini": "Hari ini",
  kemarin: "Kemarin",
  "pekan-ini": "Pekan ini",
  "lebih-lama": "Lebih lama",
};

const URUTAN_KELOMPOK: Kelompok[] = [
  "hari-ini",
  "kemarin",
  "pekan-ini",
  "lebih-lama",
];

function selisihHari(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );
}

export function kelompokWaktu(dibuatPada: string, hariIni: string): Kelompok {
  const tanggal = dibuatPada.slice(0, 10);
  const jarak = selisihHari(tanggal, hariIni);
  if (jarak <= 0) return "hari-ini";
  if (jarak === 1) return "kemarin";
  if (jarak <= 7) return "pekan-ini";
  return "lebih-lama";
}

/**
 * Notifikasi dikelompokkan per rentang waktu, terbaru lebih dulu.
 *
 * Kelompok yang kosong tidak ikut muncul: judul "Kemarin" di atas ruang
 * kosong membuat orang mengira ada yang gagal dimuat.
 */
export function kelompokkanNotifikasi(
  daftar: Notifikasi[],
  hariIni: string,
): { kelompok: Kelompok; label: string; isi: Notifikasi[] }[] {
  const per = new Map<Kelompok, Notifikasi[]>();
  for (const n of daftar) {
    const k = kelompokWaktu(n.dibuatPada, hariIni);
    per.set(k, [...(per.get(k) ?? []), n]);
  }

  return URUTAN_KELOMPOK.filter((k) => (per.get(k)?.length ?? 0) > 0).map(
    (k) => ({
      kelompok: k,
      label: LABEL_KELOMPOK[k],
      isi: [...(per.get(k) ?? [])].sort((a, b) =>
        b.dibuatPada.localeCompare(a.dibuatPada),
      ),
    }),
  );
}

export type SaringanNotifikasi = {
  kategori: KategoriNotifikasi | "semua";
  hanyaBelumDibaca: boolean;
};

export const SARINGAN_AWAL: SaringanNotifikasi = {
  kategori: "semua",
  hanyaBelumDibaca: false,
};

export function bacaSaringanNotifikasi(
  params: Record<string, string | string[] | undefined>,
): SaringanNotifikasi {
  const satu = (n: string | string[] | undefined) =>
    Array.isArray(n) ? n[0] : n;
  const kategori = satu(params.kategori);
  return {
    kategori:
      kategori && (KATEGORI_NOTIFIKASI as readonly string[]).includes(kategori)
        ? (kategori as KategoriNotifikasi)
        : "semua",
    hanyaBelumDibaca: satu(params.belum) === "1",
  };
}

export function saringNotifikasi(
  daftar: Notifikasi[],
  saringan: SaringanNotifikasi,
): Notifikasi[] {
  return daftar.filter((n) => {
    if (saringan.kategori !== "semua" && n.kategori !== saringan.kategori) {
      return false;
    }
    if (saringan.hanyaBelumDibaca && n.dibacaPada !== null) return false;
    return true;
  });
}

/** Berapa notifikasi per kategori — untuk angka di bar saringan. */
export function hitungPerKategori(
  daftar: Notifikasi[],
): Record<KategoriNotifikasi | "semua", number> {
  const hasil = { semua: daftar.length } as Record<
    KategoriNotifikasi | "semua",
    number
  >;
  for (const k of KATEGORI_NOTIFIKASI) {
    hasil[k] = daftar.filter((n) => n.kategori === k).length;
  }
  return hasil;
}

/**
 * Apakah tautan notifikasi aman dibuka?
 *
 * Notifikasi selalu menunjuk ke dalam aplikasi. Tautan yang diawali
 * `//` atau menyebut skema sendiri berarti keluar — dan kolom yang
 * berakhir di href adalah jalan masuk yang sudah terlalu sering dipakai
 * untuk melempar orang ke tempat lain.
 */
export function tautanAman(tautan: string): boolean {
  return /^\/(?!\/)[^\s]*$/.test(tautan);
}
