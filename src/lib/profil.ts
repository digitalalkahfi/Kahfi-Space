import type { AnggotaTim } from "@/lib/types";

/**
 * Profil diri — apa yang seseorang lihat dan boleh ubah tentang dirinya.
 *
 * Bentuknya sengaja meminjam `AnggotaTim` (halaman /tim sudah memetakan
 * unit, departemen, program, dan atasan dari sumber yang sama) lalu
 * menambah satu hal yang hanya relevan untuk diri sendiri: nomor kontak.
 */
export type ProfilDiri = AnggotaTim & {
  /** Nomor WhatsApp resmi, tersimpan ternormalisasi (+62…). */
  kontak: string | null;
  /** Kapan nomor itu dibuktikan milik orangnya; null berarti belum. */
  kontakTerverifikasiPada: string | null;
  /** Persetujuan dihubungi lewat WhatsApp. */
  whatsappOptin: boolean;
  fotoUrl: string | null;
};

export type KesiapanWhatsapp =
  "siap" | "belum-ada-nomor" | "belum-diverifikasi" | "belum-setuju";

export const PESAN_KESIAPAN: Record<KesiapanWhatsapp, string> = {
  siap: "Nomormu siap menerima notifikasi WhatsApp.",
  "belum-ada-nomor": "Belum ada nomor kontak, jadi tidak ada yang bisa dituju.",
  "belum-diverifikasi":
    "Nomor sudah diisi tapi belum dibuktikan milikmu. Sebelum itu, tidak ada pesan yang dikirim ke sana.",
  "belum-setuju":
    "Nomor sudah terverifikasi, tinggal persetujuanmu untuk dihubungi lewat WhatsApp.",
};

/**
 * Apa yang masih kurang sebelum WhatsApp bisa dipakai.
 *
 * Tiga syaratnya diperiksa berurutan dan dilaporkan SATU per satu.
 * Menyebut ketiganya sekaligus membuat orang memperbaiki yang salah:
 * yang belum punya nomor tidak perlu tahu soal opt-in.
 */
export function kesiapanWhatsapp(profil: {
  kontak: string | null;
  kontakTerverifikasiPada: string | null;
  whatsappOptin: boolean;
}): KesiapanWhatsapp {
  if (profil.kontak === null) return "belum-ada-nomor";
  if (profil.kontakTerverifikasiPada === null) return "belum-diverifikasi";
  if (!profil.whatsappOptin) return "belum-setuju";
  return "siap";
}

/**
 * Medan yang hanya pengelola boleh ubah.
 *
 * Bukan keputusan tampilan — trigger `jaga_ubah_diri` (migrasi 0041,
 * dilengkapi 0108) menolaknya di basis data. Daftar ini ada supaya
 * halaman profil menjelaskan alasannya sebelum orang mencoba, bukan
 * setelah gagal.
 */
export type MedanTerkunci = {
  /** Kunci pada ProfilDiri, supaya nilainya tidak perlu dipetakan manual. */
  kunci: keyof ProfilDiri;
  label: string;
  /** Kenapa terkunci — ditampilkan apa adanya, bukan sebagai tooltip. */
  alasan: string;
  /**
   * `wewenang` menentukan siapa boleh melihat angka siapa; `penempatan`
   * hanya mengikuti keputusan di atasnya. Dipisah supaya orang tahu mana
   * yang benar-benar penting untuk diperbaiki kalau keliru.
   */
  golongan: "wewenang" | "penempatan";
  /**
   * Sudah ditolak trigger `jaga_ubah_diri` di basis data?
   *
   * Semuanya kini true: 0041 menjaga peran, unit, status, atasan,
   * jabatan, dan email; 0108 menambahkan program dan departemen yang
   * sebelumnya terkunci hanya di layar.
   */
  dijagaDb: boolean;
};

export const MEDAN_TERKUNCI: MedanTerkunci[] = [
  {
    kunci: "role",
    label: "Peran",
    alasan:
      "Menentukan wewenang — termasuk angka perusahaan mana yang terlihat.",
    golongan: "wewenang",
    dijagaDb: true,
  },
  {
    kunci: "unitNama",
    label: "Unit",
    alasan: "Menentukan data unit mana yang masuk cakupanmu.",
    golongan: "wewenang",
    dijagaDb: true,
  },
  {
    kunci: "program",
    label: "Program",
    alasan: "Penempatan program ditetapkan pengelola.",
    golongan: "wewenang",
    dijagaDb: true,
  },
  {
    kunci: "atasanNama",
    label: "Atasan",
    alasan: "Garis pelaporan menentukan siapa yang menyetujui pengajuanmu.",
    golongan: "wewenang",
    dijagaDb: true,
  },
  {
    kunci: "jabatan",
    label: "Jabatan",
    alasan: "Mengikuti penempatan; diubah bersama peran dan unit.",
    golongan: "penempatan",
    dijagaDb: true,
  },
  {
    kunci: "departemen",
    label: "Departemen",
    alasan: "Mengikuti unit, kecuali program tertentu yang berdiri sendiri.",
    golongan: "penempatan",
    dijagaDb: true,
  },
  {
    kunci: "email",
    label: "Email",
    alasan: "Kunci yang menghubungkan profil ini ke akun masuk.",
    golongan: "penempatan",
    dijagaDb: true,
  },
];

/** Medan terkunci pada satu golongan, berurutan seperti daftarnya. */
export function medanTerkunci(golongan: MedanTerkunci["golongan"]) {
  return MEDAN_TERKUNCI.filter((m) => m.golongan === golongan);
}

/**
 * Nilai sebuah medan terkunci sebagai teks siap tampil.
 *
 * Yang kosong ditulis "Belum ditetapkan", bukan "—": tanda hubung
 * membuat orang menebak apakah datanya hilang atau memang belum diisi.
 */
export function nilaiMedan(profil: ProfilDiri, medan: MedanTerkunci): string {
  const nilai = profil[medan.kunci];
  if (nilai === null || nilai === undefined || nilai === "") {
    return "Belum ditetapkan";
  }
  return String(nilai);
}

/** Medan yang boleh diubah sendiri (sisi lain dari daftar di atas). */
export const MEDAN_SENDIRI = ["nama", "fotoUrl", "kontak"] as const;
export type MedanSendiri = (typeof MEDAN_SENDIRI)[number];

export function bolehUbahSendiri(medan: string): medan is MedanSendiri {
  return (MEDAN_SENDIRI as readonly string[]).includes(medan);
}

/**
 * Nomor Indonesia apa pun → bentuk baku `+62…`.
 *
 * Orang menuliskannya dengan cara yang berbeda-beda (08…, 62…, +62…,
 * pakai spasi, strip, atau tanda kurung). Yang disimpan hanya satu
 * bentuk, supaya nomor yang sama tidak pernah terbaca sebagai dua nomor
 * berbeda saat gateway WhatsApp mencarinya.
 *
 * Mengembalikan null bila bukan nomor Indonesia yang masuk akal.
 */
export function normalkanKontak(mentah: string): string | null {
  const bersih = mentah.trim().replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(bersih)) return null;

  let angka = bersih.replace(/^\+/, "");
  if (angka.startsWith("0")) angka = `62${angka.slice(1)}`;
  else if (angka.startsWith("8")) angka = `62${angka}`;

  // Nomor seluler Indonesia selalu 62 lalu 8, total 11–15 angka.
  if (!/^628\d{8,12}$/.test(angka)) return null;
  return `+${angka}`;
}

export function kontakSah(mentah: string): boolean {
  return normalkanKontak(mentah) !== null;
}

/**
 * Tampilan nomor: `+62 812-3456-7890`.
 *
 * Dikelompokkan supaya bisa dibaca ulang dan dicocokkan dengan layar
 * ponsel; yang tersimpan tetap bentuk rapatnya.
 */
export function formatKontak(nomor: string | null): string | null {
  const baku = nomor ? normalkanKontak(nomor) : null;
  if (!baku) return null;

  const angka = baku.slice(3); // buang "+62"
  const bagian = [angka.slice(0, 3), angka.slice(3, 7), angka.slice(7)].filter(
    (b) => b.length > 0,
  );
  return `+62 ${bagian.join("-")}`;
}

/**
 * Apa yang masih kosong di profil ini.
 *
 * Dipakai untuk mengajak melengkapi, bukan untuk menghakimi: nomor
 * kontak baru benar-benar berguna setelah kanal WhatsApp menyala, dan
 * foto tidak pernah wajib.
 */
export function kelengkapanProfil(profil: ProfilDiri): {
  lengkap: boolean;
  kurang: string[];
} {
  const kurang: string[] = [];
  if (!profil.kontak) kurang.push("nomor kontak");
  if (!profil.fotoUrl) kurang.push("foto");
  return { lengkap: kurang.length === 0, kurang };
}

/* ------------------------------------------------------------------ *
 * Aturan untuk apa yang boleh diubah sendiri
 * ------------------------------------------------------------------ */

export const NAMA_MIN = 2;
export const NAMA_MAKS = 80;

/**
 * Merapikan nama tampilan sebelum disimpan.
 *
 * Spasi ganda dan spasi di ujung adalah hasil salin-tempel, bukan
 * maksud orangnya; kalau dibiarkan, dua nama yang sama akan terbaca
 * berbeda di daftar tim dan di kolom PIC.
 */
export function rapikanNama(mentah: string): string {
  return mentah.trim().replace(/\s+/g, " ");
}

/**
 * Apakah nama ini layak disimpan.
 *
 * Mengembalikan alasan, bukan sekadar true/false: pesan "nama tidak
 * valid" membuat orang menebak bagian mana yang salah.
 */
export function periksaNama(mentah: string): { ok: boolean; pesan?: string } {
  const nama = rapikanNama(mentah);
  if (nama.length === 0)
    return { ok: false, pesan: "Nama tidak boleh kosong." };
  if (nama.length < NAMA_MIN) {
    return { ok: false, pesan: `Nama minimal ${NAMA_MIN} huruf.` };
  }
  if (nama.length > NAMA_MAKS) {
    return { ok: false, pesan: `Nama maksimal ${NAMA_MAKS} huruf.` };
  }
  // Nama orang boleh memakai huruf, spasi, titik, apostrof, dan tanda
  // hubung. Angka dan tanda baca lain hampir selalu salah tempel.
  if (!/^[\p{L}\p{M}.'\- ]+$/u.test(nama)) {
    return {
      ok: false,
      pesan:
        "Nama hanya boleh berisi huruf, spasi, titik, apostrof, dan tanda hubung.",
    };
  }
  return { ok: true };
}

/** Tipe berkas foto yang diterima; selain ini ditolak sebelum diunggah. */
export const AVATAR_TIPE = ["image/jpeg", "image/png", "image/webp"] as const;
/** Batas ukuran foto profil: 2 MB. */
export const AVATAR_MAKS_BYTE = 2 * 1024 * 1024;

/**
 * Apakah berkas ini layak jadi foto profil.
 *
 * Diperiksa di klien supaya orang tahu sebelum menunggu unggahan
 * selesai; pemeriksaan yang mengikat tetap ada di sisi penyimpanan.
 */
export function periksaBerkasAvatar(berkas: { type: string; size: number }): {
  ok: boolean;
  pesan?: string;
} {
  if (!(AVATAR_TIPE as readonly string[]).includes(berkas.type)) {
    return { ok: false, pesan: "Foto harus berformat JPG, PNG, atau WebP." };
  }
  if (berkas.size > AVATAR_MAKS_BYTE) {
    const mb = (berkas.size / 1024 / 1024).toFixed(1);
    return { ok: false, pesan: `Foto ${mb} MB terlalu besar; maksimal 2 MB.` };
  }
  if (berkas.size === 0) {
    return { ok: false, pesan: "Berkasnya kosong." };
  }
  return { ok: true };
}

/** Inisial dari nama — cadangan saat foto belum ada. */
export function inisialNama(nama: string): string {
  const kata = rapikanNama(nama).split(" ").filter(Boolean);
  if (kata.length === 0) return "?";
  if (kata.length === 1) return kata[0].slice(0, 2).toUpperCase();
  return (kata[0][0] + kata[kata.length - 1][0]).toUpperCase();
}
