/**
 * Pesan error yang aman.
 *
 * Pesan asli dari driver database bisa memuat alamat server, nama
 * pengguna, bahkan potongan connection string. Karena itu pesan asli
 * TIDAK PERNAH diteruskan ke Claude atau ke log. Yang keluar hanya
 * kalimat tetap dari daftar di bawah, dipilih menurut kode error.
 */

/** Error yang pesannya memang ditulis untuk dibaca pengguna. */
export class GalatPengguna extends Error {
  constructor(pesan, kode = "input") {
    super(pesan);
    this.name = "GalatPengguna";
    this.kode = kode;
  }
}

// Pesan `raise exception` dari fungsi asisten.* (0217) yang boleh
// diteruskan apa adanya. Di luar daftar ini pesan database dibuang.
const PESAN_DB_BOLEH = new Set(["Rentang tanggal tidak valid", "Rentang maksimal 92 hari"]);

const JARINGAN = new Set([
  "ENOTFOUND",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EAI_AGAIN",
  "EPIPE",
]);

/** Ubah error apa pun menjadi { kode, pesan } yang bebas rahasia. */
export function galatAman(e) {
  if (e instanceof GalatPengguna) return { kode: e.kode, pesan: e.message };

  const kode = typeof e?.code === "string" ? e.code : "";
  const asli = typeof e?.message === "string" ? e.message : "";

  if (kode === "P0001" && PESAN_DB_BOLEH.has(asli)) return { kode: "input", pesan: asli };
  if (kode === "57014")
    return { kode: "waktu_habis", pesan: "Database terlalu lama menjawab (batas 15 detik). Coba rentang yang lebih kecil." };
  if (kode === "42501" || kode === "25006")
    return { kode: "ditolak", pesan: "Database menolak: peran asisten_baca hanya boleh membaca lewat fungsi asisten.*." };
  if (kode === "42883" || kode === "3F000")
    return { kode: "belum_ada", pesan: "Fungsi asisten.* belum ada di database ini. Migration 0217 mungkin belum diterapkan." };
  if (kode === "28P01" || kode === "28000")
    return { kode: "sandi", pesan: "Database menolak login asisten_baca. Periksa sandi di Keychain, atau peran sedang dimatikan (nologin)." };
  if (kode === "XX000" && /tenant or user not found/i.test(asli))
    return { kode: "pengguna", pesan: "Pooler Supabase tidak mengenali nama pengguna. Periksa 'user' di berkas setelan (bentuk: asisten_baca.<kode-proyek>)." };
  if (JARINGAN.has(kode))
    return { kode: "jaringan", pesan: "Tidak bisa menghubungi database. Periksa koneksi internet Mac ini." };
  if (/certificate|self.signed|SSL|TLS/i.test(kode + " " + asli) && !/password/i.test(asli))
    return { kode: "ssl", pesan: "Sambungan aman (SSL) ke database gagal diverifikasi. Periksa 'caPath' di berkas setelan." };

  return { kode: "lain", pesan: "Terjadi kesalahan saat membaca database. Rinciannya sengaja tidak ditampilkan." };
}
