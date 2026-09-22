/**
 * Menyusun isi pesan WhatsApp dari sebuah notifikasi.
 *
 * Dipisah dari pengirimnya supaya bisa diuji tanpa jaringan — dan
 * karena bentuk pesannya adalah keputusan produk, bukan keputusan
 * teknis.
 */

import { LABEL_KATEGORI, type KategoriNotifikasi } from "@/lib/notifikasi";

/** Batas aman satu pesan WhatsApp; di atas ini gateway menolak. */
export const MAKS_PESAN = 4096;

export type IsiNotifikasi = {
  kategori: KategoriNotifikasi;
  judul: string;
  pesan: string;
  tautan: string;
};

/**
 * Pesan yang dikirim ke WhatsApp.
 *
 * Tiga hal, tidak lebih: kategori sebagai penanda, judulnya, dan satu
 * kalimat isi. Tautannya disertakan sebagai jalur, bukan URL penuh —
 * pesan WhatsApp mudah diteruskan, dan URL lengkap ke dasbor internal
 * yang diteruskan ke grup keluarga adalah kebocoran yang tidak
 * disengaja siapa pun.
 *
 * Tidak ada angka, nominal, maupun nama orang selain yang sudah ada di
 * judul: yang ini keluar dari aplikasi, dan apa pun yang keluar harus
 * cukup untuk mengajak orang membuka aplikasinya — tidak lebih.
 */
export function susunPesanWa(
  n: IsiNotifikasi,
  namaAplikasi = "K-Space",
): string {
  const baris = [`*${namaAplikasi} · ${LABEL_KATEGORI[n.kategori]}*`, n.judul];
  if (n.pesan.trim() !== "") baris.push(n.pesan.trim());
  baris.push(`Buka aplikasi → ${n.tautan}`);

  const teks = baris.join("\n");
  return teks.length <= MAKS_PESAN ? teks : `${teks.slice(0, MAKS_PESAN - 1)}…`;
}

export type HasilKirim =
  | { ok: true; balasan: string }
  | { ok: false; galat: string; balasan: string; bolehUlang: boolean };

/**
 * Menerjemahkan jawaban gateway jadi hasil yang bisa ditindaklanjuti.
 *
 * Yang penting bukan pesan galatnya, melainkan `bolehUlang`: mencoba
 * ulang nomor yang memang tidak terdaftar hanya menghabiskan kuota dan
 * menunda pesan lain di antrean, sementara tidak mencoba ulang saat
 * gateway sedang tumbang berarti kehilangan kabar yang sebenarnya bisa
 * sampai.
 *
 * Aturannya mengikuti status HTTP, bukan isi pesan: teks galat gateway
 * berubah-ubah antar versi, status tidak.
 */
export function bacaBalasanGateway(status: number, badan: string): HasilKirim {
  const balasan = badan.slice(0, 2000);

  if (status >= 200 && status < 300) {
    return { ok: true, balasan };
  }

  // 4xx = permintaannya yang salah (nomor, format, izin). Mengulang
  // permintaan yang sama akan salah lagi.
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return {
      ok: false,
      galat: `Gateway menolak (${status}). Periksa nomor tujuan atau kredensialnya.`,
      balasan,
      bolehUlang: false,
    };
  }

  // 408 waktu habis, 429 terlalu sering, 5xx gateway bermasalah —
  // semuanya keadaan sementara.
  return {
    ok: false,
    galat:
      status === 429
        ? "Gateway membatasi laju pengiriman; dicoba lagi nanti."
        : `Gateway tidak menjawab dengan benar (${status}); dicoba lagi nanti.`,
    balasan,
    bolehUlang: true,
  };
}

/** Kegagalan jaringan — selalu layak dicoba lagi. */
export function galatJaringan(pesan: string): HasilKirim {
  return {
    ok: false,
    galat: `Tidak bisa menghubungi gateway: ${pesan}`,
    balasan: "",
    bolehUlang: true,
  };
}
