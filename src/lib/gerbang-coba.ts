/**
 * Pembatas percobaan sederhana.
 *
 * Dipakai endpoint verifikasi kata sandi. Tanpa pembatas, endpoint itu
 * berubah menjadi alat tebak sandi: siapa pun yang berhasil mencuri satu
 * sesi bisa mencoba ribuan sandi per menit untuk menemukan sandi yang
 * kemungkinan besar dipakai orang itu di layanan lain juga.
 *
 * Disimpan di memori proses — cukup untuk satu instans, dan sengaja
 * tidak berpura-pura lebih: kalau aplikasi ini kelak berjalan di banyak
 * instans, pembatas sesungguhnya harus pindah ke basis data atau Redis.
 * Yang penting sekarang, pintunya tidak terbuka lebar.
 */

export type Gerbang = {
  /** Berapa percobaan diizinkan dalam satu jendela. */
  batas: number;
  /** Panjang jendela dalam milidetik. */
  jendela: number;
};

export type Putusan = {
  boleh: boolean;
  /** Sisa percobaan pada jendela berjalan. */
  sisa: number;
  /** Detik sampai jendela terbuka lagi; 0 bila masih boleh. */
  tungguDetik: number;
};

type Catatan = { mulai: number; jumlah: number };

/**
 * Menghitung putusan tanpa menyentuh apa pun di luar argumennya.
 *
 * Dipisah dari penyimpanannya supaya bisa diuji tanpa menunggu waktu
 * nyata berlalu.
 */
export function putusanGerbang(
  catatan: Catatan | undefined,
  sekarang: number,
  gerbang: Gerbang,
): { putusan: Putusan; berikutnya: Catatan } {
  const segar =
    catatan === undefined || sekarang - catatan.mulai >= gerbang.jendela;

  const dasar: Catatan = segar
    ? { mulai: sekarang, jumlah: 0 }
    : { ...catatan };

  if (dasar.jumlah >= gerbang.batas) {
    const sisaMs = gerbang.jendela - (sekarang - dasar.mulai);
    return {
      putusan: {
        boleh: false,
        sisa: 0,
        tungguDetik: Math.max(1, Math.ceil(sisaMs / 1000)),
      },
      // Percobaan saat ditutup TIDAK menambah hitungan: kalau menambah,
      // orang yang menunggu dengan sabar tidak akan pernah bisa masuk
      // karena jendelanya terus diperpanjang oleh percobaannya sendiri.
      berikutnya: dasar,
    };
  }

  const berikutnya = { ...dasar, jumlah: dasar.jumlah + 1 };
  return {
    putusan: {
      boleh: true,
      sisa: gerbang.batas - berikutnya.jumlah,
      tungguDetik: 0,
    },
    berikutnya,
  };
}

const catatan = new Map<string, Catatan>();

/** Catat satu percobaan untuk `kunci` dan putuskan boleh atau tidak. */
export function coba(kunci: string, gerbang: Gerbang): Putusan {
  const sekarang = Date.now();
  const { putusan, berikutnya } = putusanGerbang(
    catatan.get(kunci),
    sekarang,
    gerbang,
  );
  catatan.set(kunci, berikutnya);

  // Bersihkan catatan yang jendelanya sudah lewat, supaya peta ini tidak
  // tumbuh selamanya pada proses yang hidup lama.
  if (catatan.size > 1000) {
    for (const [k, c] of catatan) {
      if (sekarang - c.mulai >= gerbang.jendela) catatan.delete(k);
    }
  }

  return putusan;
}

/** Hapus hitungan untuk `kunci` — dipakai setelah percobaan berhasil. */
export function reset(kunci: string): void {
  catatan.delete(kunci);
}
