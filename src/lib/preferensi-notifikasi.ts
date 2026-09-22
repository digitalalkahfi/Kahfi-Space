import { KATEGORI_NOTIFIKASI, type KategoriNotifikasi } from "@/lib/notifikasi";
import type { Peran } from "@/lib/types";

/**
 * Preferensi notifikasi per kategori.
 *
 * Dua kanal, dan keduanya berdiri sendiri: in-app adalah rumah
 * notifikasi, WhatsApp hanya pelengkap. Karena itu mematikan WhatsApp
 * tidak pernah mematikan in-app — pesan yang tidak terkirim ke ponsel
 * tetap harus bisa ditemukan di aplikasi.
 */
export type Kanal = "inApp" | "whatsapp";

export type PreferensiKategori = {
  kategori: KategoriNotifikasi;
  inApp: boolean;
  whatsapp: boolean;
};

export type PreferensiNotifikasi = PreferensiKategori[];

/**
 * Peran yang boleh mematikan notifikasi.
 *
 * Hanya CEO dan Manager (PRD Fase 3). Bukan soal kepercayaan: mereka
 * penerima notifikasi lintas unit yang jumlahnya berlipat, sementara
 * notifikasi seorang Staff justru berisi tugas yang ditujukan
 * kepadanya — mematikannya berarti pekerjaan itu hilang tanpa jejak.
 */
export const PERAN_BOLEH_MEMATIKAN: Peran[] = ["CEO", "Manager"];

export function bolehMematikan(peran: Peran): boolean {
  return PERAN_BOLEH_MEMATIKAN.includes(peran);
}

/**
 * Bawaan untuk pengguna yang belum pernah mengatur apa pun.
 *
 * Semua in-app menyala, semua WhatsApp mati. Kanal yang mengirim pesan
 * ke ponsel pribadi tidak boleh menyala tanpa seseorang memilihnya —
 * itu bukan preferensi, itu pemberitahuan sepihak.
 */
export function preferensiAwal(): PreferensiNotifikasi {
  return KATEGORI_NOTIFIKASI.map((kategori) => ({
    kategori,
    inApp: true,
    whatsapp: false,
  }));
}

/**
 * Gabungkan preferensi tersimpan dengan bawaan.
 *
 * Kategori yang belum pernah diatur — termasuk kategori yang baru
 * ditambahkan setelah seseorang terakhir menyimpan — mengikuti bawaan.
 * Tanpa ini, menambah satu kategori berarti ia mati bagi semua orang
 * lama, dan tidak ada yang akan sadar.
 */
export function gabungPreferensi(
  tersimpan: Partial<PreferensiKategori>[],
): PreferensiNotifikasi {
  const peta = new Map(
    tersimpan
      .filter((p): p is PreferensiKategori & { kategori: KategoriNotifikasi } =>
        Boolean(p.kategori),
      )
      .map((p) => [p.kategori, p]),
  );

  return preferensiAwal().map((bawaan) => {
    const ada = peta.get(bawaan.kategori);
    return {
      kategori: bawaan.kategori,
      inApp: ada?.inApp ?? bawaan.inApp,
      whatsapp: ada?.whatsapp ?? bawaan.whatsapp,
    };
  });
}

/**
 * Terapkan satu perubahan, dengan pagar perannya.
 *
 * Peran yang tidak boleh mematikan tetap boleh MENYALAKAN — larangannya
 * satu arah. Dan WhatsApp tidak bisa menyala untuk kategori yang
 * in-app-nya mati: pesan yang dikirim ke ponsel tapi tidak bisa
 * ditemukan lagi di aplikasi adalah pesan yang hilang.
 */
export function ubahPreferensi(
  sekarang: PreferensiNotifikasi,
  kategori: KategoriNotifikasi,
  kanal: Kanal,
  nyala: boolean,
  peran: Peran,
): { hasil: PreferensiNotifikasi; ditolak?: string } {
  if (!nyala && !bolehMematikan(peran)) {
    return {
      hasil: sekarang,
      ditolak:
        "Hanya CEO dan Manager yang bisa mematikan notifikasi. Yang lain tetap menerimanya supaya tidak ada pekerjaan yang lewat tanpa diketahui.",
    };
  }

  const hasil = sekarang.map((p) => {
    if (p.kategori !== kategori) return p;

    if (kanal === "inApp") {
      // Mematikan in-app ikut mematikan WhatsApp-nya: kanal pelengkap
      // tidak boleh hidup sendirian tanpa rumahnya.
      return { ...p, inApp: nyala, whatsapp: nyala ? p.whatsapp : false };
    }
    if (nyala && !p.inApp) {
      return p; // ditolak diam-diam; pemanggil diberi tahu di bawah
    }
    return { ...p, whatsapp: nyala };
  });

  if (kanal === "whatsapp" && nyala) {
    const target = sekarang.find((p) => p.kategori === kategori);
    if (target && !target.inApp) {
      return {
        hasil: sekarang,
        ditolak:
          "Nyalakan dulu notifikasi di aplikasi untuk kategori ini — WhatsApp hanya pelengkapnya.",
      };
    }
  }

  return { hasil };
}

/** Apakah kategori ini dikirim lewat kanal tersebut? */
export function dikirimLewat(
  preferensi: PreferensiNotifikasi,
  kategori: KategoriNotifikasi,
  kanal: Kanal,
): boolean {
  const p = preferensi.find((x) => x.kategori === kategori);
  if (!p) return kanal === "inApp"; // bawaan: in-app menyala
  return kanal === "inApp" ? p.inApp : p.whatsapp && p.inApp;
}

/** Ringkasan untuk kalimat di layar. */
export function ringkasPreferensi(preferensi: PreferensiNotifikasi): {
  inApp: number;
  whatsapp: number;
  total: number;
} {
  return {
    inApp: preferensi.filter((p) => p.inApp).length,
    whatsapp: preferensi.filter((p) => p.whatsapp && p.inApp).length,
    total: preferensi.length,
  };
}
