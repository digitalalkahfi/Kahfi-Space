/**
 * Aturan kata sandi.
 *
 * Ditulis sebagai daftar syarat yang bisa ditampilkan satu per satu,
 * bukan satu ekspresi reguler raksasa: orang yang ditolak perlu tahu
 * syarat mana yang belum terpenuhi, dan sebuah regex hanya bisa
 * menjawab "tidak".
 */

export const SANDI_MIN = 10;
/**
 * Berapa karakter BERLAINAN yang minimal dipakai.
 *
 * Sandi sepanjang apa pun yang hanya memakai tiga karakter berbeda
 * ("AbAbAb1111") hampir tidak menambah ruang tebakan.
 */
export const RAGAM_MIN = 6;
export const SANDI_MAKS = 72; // Batas bcrypt yang dipakai Supabase Auth.

export type SyaratSandi = {
  kunci: string;
  label: string;
  penuhi: (sandi: string) => boolean;
};

export const SYARAT_SANDI: SyaratSandi[] = [
  {
    kunci: "panjang",
    label: `Minimal ${SANDI_MIN} karakter`,
    penuhi: (s) => s.length >= SANDI_MIN,
  },
  {
    kunci: "huruf-besar",
    label: "Ada huruf besar",
    penuhi: (s) => /[A-Z]/.test(s),
  },
  {
    kunci: "huruf-kecil",
    label: "Ada huruf kecil",
    penuhi: (s) => /[a-z]/.test(s),
  },
  { kunci: "angka", label: "Ada angka", penuhi: (s) => /\d/.test(s) },
];

/**
 * Sandi yang sudah bocor di mana-mana.
 *
 * Bukan daftar lengkap — itu pekerjaan layanan pemeriksa kebocoran —
 * melainkan yang benar-benar sering muncul di lingkungan kerja
 * berbahasa Indonesia. Tujuannya mencegat tebakan pertama penyerang,
 * yang justru paling sering berhasil.
 */
const SANDI_UMUM = new Set([
  // Semuanya huruf kecil: yang dibandingkan adalah sandi yang sudah
  // dikecilkan, jadi entri bercampur huruf besar tidak akan pernah cocok.
  "password",
  "password1",
  "passw0rd",
  "qwerty123",
  "12345678",
  "123456789",
  "1234567890",
  "admin123",
  "adminadmin",
  "rahasia123",
  "katasandi1",
  "letmein123",
  "iloveyou1",
]);

/**
 * Pola yang membuat sandi panjang tetap mudah ditebak.
 *
 * Empat syarat bentuk di atas bisa dipenuhi tanpa menambah kesulitan
 * menebak sama sekali — "Aaaaaaaaa1" memenuhi keempatnya. Yang benar-
 * benar melindungi adalah tidak adanya pola; ini memeriksanya.
 */
const DERET = "abcdefghijklmnopqrstuvwxyz";
const ANGKA_URUT = "01234567890";
const BARIS_KIBOR = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

/** Apakah `sandi` memuat potongan berurutan sepanjang `panjang`? */
function memuatDeret(sandi: string, panjang = 4): boolean {
  const kecil = sandi.toLowerCase();
  const sumber = [DERET, ANGKA_URUT, ...BARIS_KIBOR];

  for (const baris of sumber) {
    const terbalik = [...baris].reverse().join("");
    for (const arah of [baris, terbalik]) {
      for (let i = 0; i + panjang <= arah.length; i++) {
        if (kecil.includes(arah.slice(i, i + panjang))) return true;
      }
    }
  }
  return false;
}

/** Berapa banyak karakter berbeda yang benar-benar dipakai. */
export function ragamKarakter(sandi: string): number {
  return new Set(sandi).size;
}

/** Karakter yang sama diulang beruntun, mis. "aaaa". */
function adaUlanganBeruntun(sandi: string, panjang = 3): boolean {
  let beruntun = 1;
  for (let i = 1; i < sandi.length; i++) {
    beruntun = sandi[i] === sandi[i - 1] ? beruntun + 1 : 1;
    if (beruntun > panjang) return true;
  }
  return false;
}

export type HasilSandi = {
  ok: boolean;
  /** Syarat yang belum terpenuhi — kosong berarti semuanya lolos. */
  belum: string[];
  pesan?: string;
};

/**
 * Apakah sandi ini layak dipakai.
 *
 * Mengembalikan syarat mana yang belum terpenuhi, bukan sekadar
 * true/false: "kata sandi tidak memenuhi syarat" membuat orang mencoba
 * berkali-kali sambil menebak syarat mana yang dimaksud.
 */
export function periksaSandi(
  sandi: string,
  konteks: { email?: string; nama?: string } = {},
): HasilSandi {
  if (sandi.length > SANDI_MAKS) {
    return {
      ok: false,
      belum: [],
      pesan: `Kata sandi maksimal ${SANDI_MAKS} karakter.`,
    };
  }

  const belum = SYARAT_SANDI.filter((s) => !s.penuhi(sandi)).map(
    (s) => s.label,
  );
  if (belum.length > 0) return { ok: false, belum };

  if (SANDI_UMUM.has(sandi.toLowerCase())) {
    return {
      ok: false,
      belum: [],
      pesan: "Kata sandi ini terlalu sering dipakai orang; pilih yang lain.",
    };
  }

  // Sandi yang memuat nama atau email pemiliknya adalah tebakan pertama
  // siapa pun yang mengenalnya.
  const kecil = sandi.toLowerCase();
  const nama = konteks.nama?.toLowerCase().split(" ")[0];
  const akun = konteks.email?.toLowerCase().split("@")[0];
  for (const bagian of [nama, akun]) {
    if (bagian && bagian.length >= 4 && kecil.includes(bagian)) {
      return {
        ok: false,
        belum: [],
        pesan:
          "Jangan pakai nama atau alamat emailmu sendiri — itu tebakan pertama orang yang mengenalmu.",
      };
    }
  }

  // Pola — diperiksa terakhir karena paling mahal dijelaskan, dan baru
  // relevan setelah bentuknya benar.
  if (adaUlanganBeruntun(sandi)) {
    return {
      ok: false,
      belum: [],
      pesan:
        "Ada huruf atau angka yang sama berulang beruntun; itu tidak menambah kesulitan menebak.",
    };
  }

  if (memuatDeret(sandi)) {
    return {
      ok: false,
      belum: [],
      pesan:
        "Ada urutan yang mudah ditebak (mis. abcd, 1234, atau qwerty). Ganti bagian itu.",
    };
  }

  if (ragamKarakter(sandi) < RAGAM_MIN) {
    return {
      ok: false,
      belum: [],
      pesan: `Terlalu sedikit karakter berbeda; pakai setidaknya ${RAGAM_MIN} karakter yang berlainan.`,
    };
  }

  return { ok: true, belum: [] };
}

export type Kekuatan = "lemah" | "sedang" | "kuat";

/**
 * Perkiraan kekuatan sandi untuk penunjuk di layar.
 *
 * Bukan ukuran keamanan sungguhan — hanya cara memberi tahu bahwa
 * menambah panjang jauh lebih berpengaruh daripada menambah satu simbol.
 */
export function kekuatanSandi(sandi: string): Kekuatan {
  if (sandi.length === 0) return "lemah";
  const ragam = SYARAT_SANDI.filter((s) => s.penuhi(sandi)).length;
  const adaSimbol = /[^A-Za-z0-9]/.test(sandi);
  const skor = ragam + (adaSimbol ? 1 : 0) + (sandi.length >= 16 ? 1 : 0);

  if (sandi.length < SANDI_MIN || skor <= 2) return "lemah";
  if (skor <= 4) return "sedang";
  return "kuat";
}

export const LABEL_KEKUATAN: Record<Kekuatan, string> = {
  lemah: "Lemah",
  sedang: "Cukup",
  kuat: "Kuat",
};

/** Apakah sandi baru boleh menggantikan yang lama. */
export function sandiBaruSah(
  lama: string,
  baru: string,
  ulang: string,
): { ok: boolean; pesan?: string } {
  if (lama === "") return { ok: false, pesan: "Isi kata sandi saat ini dulu." };
  if (baru === "") return { ok: false, pesan: "Isi kata sandi baru." };
  if (baru === lama) {
    return { ok: false, pesan: "Kata sandi baru masih sama dengan yang lama." };
  }
  if (ulang !== baru) {
    return { ok: false, pesan: "Ulangan kata sandi belum sama." };
  }
  return { ok: true };
}
