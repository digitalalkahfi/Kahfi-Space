/**
 * Kalender bersama — tipe & perhitungan murni.
 */
import { keJamWib, keTanggalWib } from "@/lib/format";
import type { KodeUnit, Tugas } from "@/lib/types";

export type JenisAgenda = "rapat" | "libur" | "pelatihan" | "lainnya";

/** Sumber sebuah entri: diketik manual, atau ditarik dari modul lain. */
export type SumberEntri = "agenda" | "tugas";

export type EntriKalender = {
  id: string;
  sumber: SumberEntri;
  judul: string;
  keterangan: string;
  jenis: JenisAgenda | "tenggat";
  tanggal: string;
  jamMulai: string | null;
  jamSelesai: string | null;
  unitKode: KodeUnit | null;
  unitNama: string;
  lokasi: string;
  /** Tautan ke sumbernya bila entrinya ditarik dari modul lain. */
  tautan: string | null;
  /** Siapa yang membuat agendanya; kosong untuk entri tarikan. */
  dibuatOleh: string | null;
};

export const LABEL_JENIS_AGENDA: Record<JenisAgenda | "tenggat", string> = {
  rapat: "Rapat",
  libur: "Libur",
  pelatihan: "Pelatihan",
  lainnya: "Lainnya",
  tenggat: "Tenggat",
};

export const GAYA_JENIS_AGENDA: Record<
  JenisAgenda | "tenggat",
  { kelas: string; titik: string }
> = {
  rapat: { kelas: "bg-info-fill text-info-text", titik: "bg-secondary" },
  libur: { kelas: "bg-ok-fill text-ok-text", titik: "bg-ok" },
  pelatihan: {
    kelas: "bg-accentmuted-fill text-accentmuted-text",
    titik: "bg-unit-tap",
  },
  lainnya: { kelas: "bg-muted text-muted-foreground", titik: "bg-muted-foreground/50" },
  tenggat: { kelas: "bg-warn-fill text-warn-text", titik: "bg-warn" },
};

/** Tanggal pertama pada petak kalender (Senin pada pekan tanggal 1). */
export function awalPetak(bulan: string): string {
  const d = new Date(`${bulan}T00:00:00Z`);
  d.setUTCDate(1);
  const geser = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - geser);
  return d.toISOString().slice(0, 10);
}

/**
 * Enam pekan penuh, selalu.
 *
 * Jumlah baris yang berubah-ubah membuat tinggi halaman melompat saat
 * berpindah bulan, dan tombol navigasinya ikut berpindah tempat.
 */
export function petakBulan(bulan: string): string[][] {
  const mulai = new Date(`${awalPetak(bulan)}T00:00:00Z`);
  const pekan: string[][] = [];

  for (let p = 0; p < 6; p++) {
    const baris: string[] = [];
    for (let h = 0; h < 7; h++) {
      baris.push(mulai.toISOString().slice(0, 10));
      mulai.setUTCDate(mulai.getUTCDate() + 1);
    }
    pekan.push(baris);
  }

  return pekan;
}

export function bulanDari(tanggal: string) {
  return `${tanggal.slice(0, 7)}-01`;
}

export function geserBulan(bulan: string, langkah: number): string {
  const d = new Date(`${bulan}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + langkah);
  return `${d.toISOString().slice(0, 7)}-01`;
}

export function dalamBulan(tanggal: string, bulan: string) {
  return tanggal.slice(0, 7) === bulan.slice(0, 7);
}

/** Entri dikelompokkan per tanggal, terurut berdasarkan jamnya. */
export function perTanggal(
  daftar: EntriKalender[],
): Record<string, EntriKalender[]> {
  const hasil: Record<string, EntriKalender[]> = {};

  for (const e of daftar) {
    hasil[e.tanggal] = [...(hasil[e.tanggal] ?? []), e];
  }

  for (const tanggal of Object.keys(hasil)) {
    hasil[tanggal].sort((a, b) => {
      // Agenda sepanjang hari tampil lebih dulu.
      if (!a.jamMulai && b.jamMulai) return -1;
      if (a.jamMulai && !b.jamMulai) return 1;
      return (a.jamMulai ?? "").localeCompare(b.jamMulai ?? "");
    });
  }

  return hasil;
}

/**
 * Dua agenda dianggap bentrok bila jamnya beririsan pada hari yang sama
 * dan menyangkut orang yang sama.
 *
 * "Orang yang sama" berarti sama-sama seluruh perusahaan, sama-sama satu
 * unit, atau satu di antaranya berlaku untuk semua orang. Agenda dua unit
 * berbeda bukan bentrok — pesertanya memang berbeda.
 *
 * Agenda sepanjang hari tidak dihitung bentrok dengan apa pun: libur dan
 * rapat memang bisa hidup berdampingan di hari yang sama.
 */
export function bentrok(a: EntriKalender, b: EntriKalender): boolean {
  if (a.id === b.id || a.tanggal !== b.tanggal) return false;
  if (a.jenis === "libur" || b.jenis === "libur") return false;

  const jam = (e: EntriKalender) =>
    e.jamMulai && e.jamSelesai ? [e.jamMulai, e.jamSelesai] : null;

  const ja = jam(a);
  const jb = jam(b);
  if (!ja || !jb) return false;

  const orangSama =
    a.unitKode === null || b.unitKode === null || a.unitKode === b.unitKode;
  if (!orangSama) return false;

  return ja[0] < jb[1] && jb[0] < ja[1];
}

/**
 * Id agenda yang jamnya bertabrakan dengan agenda lain.
 *
 * Dipakai layar kalender untuk menandainya — jadwal yang saling terlihat
 * baru menolong kalau bentroknya ikut kelihatan.
 */
export function idBentrok(daftar: EntriKalender[]): Set<string> {
  const hasil = new Set<string>();

  for (let i = 0; i < daftar.length; i += 1) {
    for (let j = i + 1; j < daftar.length; j += 1) {
      if (bentrok(daftar[i], daftar[j])) {
        hasil.add(daftar[i].id);
        hasil.add(daftar[j].id);
      }
    }
  }

  return hasil;
}

/** Bagian tugas yang dibutuhkan untuk menjadi entri tenggat. */
export type TugasKalender = Pick<
  Tugas,
  | "id"
  | "tipe"
  | "judul"
  | "deskripsi"
  | "penerima"
  | "penerimaId"
  | "tenggat"
  | "tanpaJam"
  | "statusAsli"
>;

/**
 * Tenggat ini masuk kalender `dari`–`sampai` (tanggal WIB, inklusif)?
 * Padanan saringan kueri `ambilTenggatKalender` — dipakai mode demo.
 *
 * Yang sudah tuntas atau dibatalkan bukan lagi tenggat. To-do pribadi
 * hanya milik sendiri, dibandingkan lewat id: aturan modul Tugas
 * (`papan_tugas`/`daftar_tugas`, 0182), walau RLS mengizinkan
 * CEO/Manager membacanya.
 */
export function masukKalender(
  t: TugasKalender,
  penggunaId: string,
  dari: string,
  sampai: string,
): boolean {
  if (t.statusAsli === "selesai" || t.statusAsli === "dibatalkan") {
    return false;
  }
  if (t.tipe === "pribadi" && t.penerimaId !== penggunaId) return false;

  const hari = t.tenggat ? keTanggalWib(t.tenggat) : "";
  return hari !== "" && hari >= dari && hari <= sampai;
}

/**
 * Tugas sebagai entri tenggat, bertanggal dan berjam WIB.
 *
 * `timestamptz` tiba dari basis data dalam UTC; memotong teksnya
 * menaruh tenggat 00.00–06.59 WIB di hari sebelumnya dan menampilkan jam
 * UTC berlabel WIB. To-do tanpa jam tersimpan 23.59 WIB — jam itu bukan
 * janji, jadi entrinya sepanjang hari.
 */
export function keEntriTenggat(t: TugasKalender): EntriKalender {
  return {
    id: `tugas-${t.id}`,
    sumber: "tugas",
    judul: t.judul,
    keterangan: t.deskripsi,
    jenis: "tenggat",
    tanggal: keTanggalWib(t.tenggat),
    jamMulai: t.tanpaJam ? null : keJamWib(t.tenggat) || null,
    jamSelesai: null,
    unitKode: null,
    unitNama: t.penerima,
    lokasi: "",
    tautan: "/tugas",
    dibuatOleh: null,
  };
}
