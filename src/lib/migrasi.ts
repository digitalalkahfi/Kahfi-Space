/**
 * Migrasi data lama — tipe & aturan murni, dipakai server maupun browser.
 */
import { PEMETAAN_V1 } from "@/lib/pemetaan-v1";

export type StatusMigrasi = "menunggu" | "berhasil" | "dilewati" | "gagal";
export type TahapMigrasi = "uji_coba" | "sungguhan";

export type RingkasEntitas = {
  entitas: string;
  total: number;
  berhasil: number;
  dilewati: number;
  gagal: number;
  menunggu: number;
};

export type JalanMigrasi = {
  id: string;
  tahap: TahapMigrasi;
  sumber: string;
  olehNama: string | null;
  dimulaiPada: string;
  selesaiPada: string | null;
  catatan: string;
};

/**
 * Kelompok yang dipindahkan, berurutan sesuai ketergantungannya.
 *
 * Diturunkan dari pemetaan V1 supaya tidak ada dua daftar yang harus
 * dijaga tetap sama: urutan di layar selalu urutan yang benar-benar
 * dijalankan. Urutan itu bukan hiasan — akun menunjuk orang, laporan
 * menunjuk keduanya, dan seluruh data operasional menunjuk orang.
 */
export const ENTITAS_MIGRASI: {
  kunci: string;
  label: string;
  catatan: string;
}[] = PEMETAAN_V1.map((p) => ({
  kunci: p.kunci,
  label: p.label,
  catatan: `Menjadi ${p.tabelBaru}.`,
}));

export const LABEL_STATUS: Record<StatusMigrasi, string> = {
  menunggu: "Menunggu",
  berhasil: "Berhasil",
  dilewati: "Dilewati",
  gagal: "Gagal",
};

export const GAYA_STATUS: Record<StatusMigrasi, string> = {
  menunggu: "bg-muted text-muted-foreground",
  berhasil: "bg-ok-fill text-ok-text",
  dilewati: "bg-info-fill text-info-text",
  gagal: "bg-danger-fill text-danger-text",
};

/** Sebuah jalan dianggap tuntas bila tidak ada lagi yang menunggu. */
export function tuntas(ringkas: RingkasEntitas[]) {
  return ringkas.length > 0 && ringkas.every((r) => r.menunggu === 0);
}

/** Gagal satu pun berarti migrasi belum boleh dianggap beres. */
export function jumlahGagal(ringkas: RingkasEntitas[]) {
  return ringkas.reduce((a, r) => a + r.gagal, 0);
}

export type BarisVerifikasi = {
  entitas: string;
  label: string;
  tabelBaru: string;
  /** Entri entitas ini di ekspor kv_store. */
  sumber: number;
  /** Yang tercatat berhasil pada eksekusi terakhir. */
  berhasil: number;
  dilewati: number;
  gagal: number;
  /**
   * Dari yang tercatat berhasil, berapa yang barisnya terbukti ada
   * sekarang di tabel tujuan (dicocokkan lewat id barunya, 0077).
   * Baris yang dibuat orang sesudah migrasi tidak ikut terhitung.
   */
  tujuan: number;
};

export type PenilaianBaris = {
  cocok: boolean;
  keterangan: string;
};

/**
 * Menilai selisih antara sumber dan tujuan.
 *
 * Selisih tidak otomatis berarti salah: entri yang sengaja dilewati dan
 * yang gagal memang tidak ikut pindah. Yang benar-benar mencurigakan
 * adalah ketika yang tercatat berhasil ternyata tidak ada di tabel
 * tujuan — itulah kehilangan data yang tidak menimbulkan galat apa pun.
 */
export function nilaiBaris(b: BarisVerifikasi): PenilaianBaris {
  const terhitung = b.berhasil + b.dilewati + b.gagal;

  // Belum pernah diperiksa bukan berarti tidak cocok; menandainya merah
  // hanya membuat orang terbiasa mengabaikan peringatan.
  if (terhitung === 0) {
    return {
      cocok: true,
      keterangan: `${b.sumber} entri menunggu; migrasi belum pernah dijalankan untuk entitas ini.`,
    };
  }

  if (b.sumber !== terhitung) {
    return {
      cocok: false,
      keterangan: `${b.sumber} entri di sumber, tapi hanya ${terhitung} yang tercatat diperiksa. Ada entri yang terlewat sama sekali.`,
    };
  }

  if (b.berhasil > b.tujuan) {
    return {
      cocok: false,
      keterangan: `${b.berhasil} entri tercatat berhasil, tapi hanya ${b.tujuan} yang barisnya terbukti ada di ${b.tabelBaru}. Sisanya hilang tanpa galat.`,
    };
  }

  if (b.gagal > 0) {
    return {
      cocok: false,
      keterangan: `${b.gagal} entri gagal dan belum masuk. Migrasi belum boleh dianggap selesai.`,
    };
  }

  if (b.dilewati > 0) {
    return {
      cocok: true,
      keterangan: `${b.dilewati} entri sengaja dilewati; sisanya cocok.`,
    };
  }

  return { cocok: true, keterangan: "Seluruh entri berpindah utuh." };
}

/**
 * Kolom baru yang tidak punya padanan di `kv_store` lama dan memang
 * dibiarkan kosong setelah migrasi.
 *
 * Dipakai layar verifikasi supaya kolom kosong terbaca sebagai "tidak
 * pernah ada di data lama", bukan sebagai baris yang gagal pindah.
 * Pembedanya `wajib`: kolom bawaan yang wajib memang diisi nilai bawaan
 * (mis. `platform`), sedangkan yang tidak wajib tetap kosong.
 */
export function kolomTanpaSumber(entitas: string): string[] {
  const peta = PEMETAAN_V1.find((p) => p.kunci === entitas);
  if (!peta) return [];
  return peta.baris
    .filter((b) => b.medanLama === null && b.ubahan === "bawaan" && !b.wajib)
    .map((b) => b.kolomBaru);
}
