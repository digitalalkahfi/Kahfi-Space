// Modul khusus server.
import "server-only";

import { dataContoh } from "@/lib/data/contoh";
import { bolehLihatKeuangan } from "@/lib/keuangan";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import type {
  Aset,
  BarisLogAset,
  JejakDataAset,
  KejadianAset,
  StatusAset,
} from "@/lib/aset";
import { bandingkanJejak, kodeAsetBerikutnya } from "@/lib/aset";
import type { KodeUnit, Pengguna } from "@/lib/types";

function satu<T>(nilai: T | T[] | null | undefined): T | null {
  if (!nilai) return null;
  return Array.isArray(nilai) ? (nilai[0] ?? null) : nilai;
}

/**
 * Daftar aset perusahaan.
 *
 * Dua jalan baca, sengaja: yang berhak melihat angka perusahaan membaca
 * tabel `assets` lengkap dengan rupiahnya, yang lain membaca view
 * `aset_publik` yang memang tidak memuat kolom itu (migrasi 0102). RLS
 * tidak bisa menyembunyikan satu kolom, jadi pemisahannya di sini —
 * bukan sekadar di tampilan, yang mana pun mudah dilewati.
 */
export async function daftarAset(pengguna: Pengguna): Promise<Aset[]> {
  if (modeData() === "demo") return asetDemo();

  const sb = await klienServer();

  if (!bolehLihatNilaiAset(pengguna)) {
    const { data, error } = await sb
      .from("aset_publik")
      .select(
        `id, kode, nama, kategori, tanggal, status, lokasi, berakhir, catatan,
         unit_kode, unit_nama, pemegang_id, pemegang_nama`,
      )
      .order("kode");

    if (error) throw new Error(`Gagal memuat aset: ${error.message}`);

    return (data ?? []).map((a) => {
      return {
        id: a.id,
        kode: a.kode,
        nama: a.nama,
        kategori: a.kategori,
        unitKode: (a.unit_kode as KodeUnit) ?? null,
        unitNama: a.unit_nama.split(" (")[0],
        tanggal: a.tanggal,
        // Nol, bukan tebakan: pemakainya memang tidak diberi angkanya,
        // dan layar menyembunyikan seluruh kolom rupiah untuknya.
        nilaiPerolehan: 0,
        masaManfaat: 0,
        residu: 0,
        status: a.status as StatusAset,
        pemegangId: a.pemegang_id,
        pemegangNama: a.pemegang_nama,
        lokasi: a.lokasi,
        berakhir: a.berakhir,
        transaksiId: null,
        catatan: a.catatan,
      } satisfies Aset;
    });
  }

  const { data, error } = await sb
    .from("assets")
    .select(
      `id, kode, nama, kategori, tanggal, nilai_perolehan, masa_manfaat, residu,
       status, lokasi, berakhir, transaction_id, catatan,
       unit:units (kode, nama),
       pemegang:users (id, nama)`,
    )
    .order("kode");

  if (error) throw new Error(`Gagal memuat aset: ${error.message}`);

  return (data ?? []).map((a) => {
    const unit = satu(a.unit);
    const pemegang = satu(a.pemegang);
    return {
      id: a.id,
      kode: a.kode,
      nama: a.nama,
      kategori: a.kategori,
      unitKode: (unit?.kode as KodeUnit) ?? null,
      unitNama: unit?.nama ? unit.nama.split(" (")[0] : "Perusahaan",
      tanggal: a.tanggal,
      nilaiPerolehan: Number(a.nilai_perolehan),
      masaManfaat: a.masa_manfaat,
      residu: Number(a.residu),
      status: a.status as StatusAset,
      pemegangId: pemegang?.id ?? null,
      pemegangNama: pemegang?.nama ?? null,
      lokasi: a.lokasi,
      berakhir: a.berakhir,
      transaksiId: a.transaction_id,
      catatan: a.catatan,
    } satisfies Aset;
  });
}

function asetDemo(): Aset[] {
  const { units, users } = dataContoh;

  return (dataContoh.aset ?? [])
    .map((a) => {
      const unit = a.unit ? units.find((u) => u.kode === a.unit) : null;
      const pemegang = a.pemegang
        ? users.find((u) => u.nama === a.pemegang)
        : null;
      const transaksi = a.transaksi
        ? (dataContoh.transaksi ?? []).find((t) => t.keterangan === a.transaksi)
        : null;

      return {
        // Id yang sama dengan seed.sql: mode demo dan Supabase menyebut
        // aset yang sama dengan nama yang sama.
        id: a.id,
        kode: a.kode,
        nama: a.nama,
        kategori: a.kategori,
        unitKode: (a.unit as KodeUnit) ?? null,
        unitNama: unit?.nama ? unit.nama.split(" (")[0] : "Perusahaan",
        tanggal: a.tanggal,
        nilaiPerolehan: a.nilai,
        masaManfaat: a.masa_manfaat,
        residu: a.residu,
        status: a.status as StatusAset,
        pemegangId: pemegang?.id ?? null,
        pemegangNama: a.pemegang ?? null,
        lokasi: a.lokasi,
        berakhir: a.berakhir ?? null,
        transaksiId: transaksi?.id ?? null,
        catatan: a.catatan,
      } satisfies Aset;
    })
    .sort((a, b) => a.kode.localeCompare(b.kode));
}

/**
 * Riwayat satu aset, terbaru dulu.
 *
 * Dibaca lewat RPC `riwayat_aset` (migrasi 0103) yang sengaja terbuka
 * untuk semua pengguna: riwayatnya tidak memuat rupiah, dan yang tahu di
 * mana barang terakhir terlihat sering bukan pemegang terdaftarnya.
 */
export async function riwayatAset(kode: string): Promise<KejadianAset[]> {
  if (modeData() === "demo") return riwayatDemo(kode);

  const sb = await klienServer();
  const { data, error } = await sb.rpc("riwayat_aset", { p_kode: kode });

  if (error) throw new Error(`Gagal memuat riwayat aset: ${error.message}`);

  return (data ?? []).map((k) => ({
    id: k.id,
    dari: k.dari,
    ke: k.ke,
    pemegangNama: k.pemegang_nama,
    olehNama: k.oleh_nama,
    lokasi: k.lokasi,
    catatan: k.catatan,
    pada: k.pada,
  }));
}

function riwayatDemo(kode: string): KejadianAset[] {
  return (dataContoh.aset_riwayat ?? [])
    .filter((k) => k.kode === kode)
    .map((k, i) => ({
      id: `${kode}-kejadian-${i + 1}`,
      dari: (k.dari as StatusAset | null) ?? null,
      ke: k.ke as StatusAset,
      pemegangNama: k.pemegang ?? null,
      olehNama: k.oleh ?? null,
      lokasi: k.lokasi,
      catatan: k.catatan,
      pada: k.pada,
    }))
    .sort((a, b) => b.pada.localeCompare(a.pada));
}

/** Log perubahan seluruh aset, terbaru dulu. */
export async function logPerubahanAset(
  pengguna: Pengguna,
): Promise<BarisLogAset[]> {
  if (modeData() === "demo") return logDemo(pengguna);

  const sb = await klienServer();
  const { data, error } = await sb.rpc("riwayat_aset", { p_kode: null });

  if (error) throw new Error(`Gagal memuat log aset: ${error.message}`);

  return (data ?? []).map((k) => ({
    id: k.id,
    asetId: k.asset_id,
    kode: k.kode,
    namaAset: k.nama_aset,
    unitNama: k.unit_nama.split(" (")[0],
    dari: k.dari,
    ke: k.ke,
    pemegangNama: k.pemegang_nama,
    olehNama: k.oleh_nama,
    lokasi: k.lokasi,
    catatan: k.catatan,
    pada: k.pada,
  }));
}

async function logDemo(pengguna: Pengguna): Promise<BarisLogAset[]> {
  const aset = await daftarAset(pengguna);
  const peta = new Map(aset.map((a) => [a.kode, a]));

  return (dataContoh.aset_riwayat ?? [])
    .flatMap((k, i) => {
      const milik = peta.get(k.kode);
      if (!milik) return [];
      return [
        {
          id: `log-aset-${i + 1}`,
          asetId: milik.id,
          kode: k.kode,
          namaAset: milik.nama,
          unitNama: milik.unitNama,
          dari: (k.dari as StatusAset | null) ?? null,
          ke: k.ke as StatusAset,
          pemegangNama: k.pemegang ?? null,
          olehNama: k.oleh ?? null,
          lokasi: k.lokasi,
          catatan: k.catatan,
          pada: k.pada,
        } satisfies BarisLogAset,
      ];
    })
    .sort(
      (a, b) => b.pada.localeCompare(a.pada) || a.kode.localeCompare(b.kode),
    );
}

/**
 * Jejak perubahan data sebuah aset.
 *
 * Hanya di mode Supabase: jejaknya ditulis trigger ke `audit_logs`
 * (migrasi 0104), dan data contoh tidak menyimpan riwayat penyuntingan.
 * Kosong berarti "belum pernah disunting" — bukan "tidak diketahui".
 */
export async function jejakDataAset(asetId: string): Promise<JejakDataAset[]> {
  if (modeData() === "demo") return [];

  const sb = await klienServer();
  const { data, error } = await sb.rpc("audit_aset", { p_aset: asetId });

  if (error) throw new Error(`Gagal memuat jejak aset: ${error.message}`);

  return (data ?? []).map((j) => ({
    id: j.id,
    aksi: j.aksi,
    olehNama: j.oleh_nama,
    pada: j.pada,
    perubahan: bandingkanJejak(j.nilai_lama, j.nilai_baru),
  }));
}

export type AsetDipegang = {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  unitNama: string;
  status: StatusAset;
  lokasi: string;
  sejak: string | null;
};

/**
 * Aset yang sedang dipegang seseorang.
 *
 * Pertanyaan ini muncul di dua saat yang sama pentingnya: ketika orang
 * pindah unit, dan ketika ia keluar. Sebelumnya jawabannya hanya bisa
 * dikumpulkan satu per satu dari daftar aset.
 */
export async function asetDipegang(
  penggunaId: string,
): Promise<AsetDipegang[]> {
  if (modeData() === "demo") {
    const { users } = dataContoh;
    const nama = users.find((u) => u.id === penggunaId)?.nama ?? null;
    if (!nama) return [];

    return (dataContoh.aset ?? [])
      .filter((a) => a.pemegang === nama && a.status !== "dilepas")
      .map((a) => {
        const unit = a.unit
          ? dataContoh.units.find((u) => u.kode === a.unit)
          : null;
        const terakhir = (dataContoh.aset_riwayat ?? [])
          .filter((k) => k.kode === a.kode && k.pemegang === nama)
          .map((k) => k.pada)
          .sort()
          .at(-1);

        return {
          id: a.id,
          kode: a.kode,
          nama: a.nama,
          kategori: a.kategori,
          unitNama: unit?.nama ? unit.nama.split(" (")[0] : "Perusahaan",
          status: a.status as StatusAset,
          lokasi: a.lokasi,
          sejak: terakhir ?? null,
        } satisfies AsetDipegang;
      })
      .sort((a, b) => a.kode.localeCompare(b.kode));
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("aset_dipegang", {
    p_user: penggunaId,
  });

  if (error)
    throw new Error(`Gagal memuat aset yang dipegang: ${error.message}`);

  return (data ?? []).map((a) => ({
    id: a.id,
    kode: a.kode,
    nama: a.nama,
    kategori: a.kategori,
    unitNama: a.unit_nama.split(" (")[0],
    status: a.status as StatusAset,
    lokasi: a.lokasi,
    sejak: a.sejak,
  }));
}

/** Satu aset menurut kodenya; kosong bila tidak ada. */
export async function asetDariKode(
  pengguna: Pengguna,
  kode: string,
): Promise<Aset | null> {
  const semua = await daftarAset(pengguna);
  return semua.find((a) => a.kode === kode.toUpperCase()) ?? null;
}

/** Nomor aset berikutnya, supaya form tidak menebak sendiri. */
export async function kodeBerikutnya(): Promise<string> {
  if (modeData() === "demo") {
    return kodeAsetBerikutnya((dataContoh.aset ?? []).map((a) => a.kode));
  }

  const sb = await klienServer();
  const { data } = await sb.from("assets").select("kode");
  return kodeAsetBerikutnya((data ?? []).map((a) => a.kode));
}

/**
 * Siapa boleh melihat angka rupiah aset.
 *
 * Daftar barangnya sendiri terbuka — mengetahui siapa memegang apa adalah
 * urusan operasional, dan menyembunyikannya justru membuat barang hilang
 * tanpa ada yang menyadari. Nilai perolehan dan nilai bukunya angka
 * perusahaan, jadi mengikuti pagar yang sama dengan modul Keuangan.
 */
export function bolehLihatNilaiAset(pengguna: Pengguna) {
  return bolehLihatKeuangan(pengguna.role);
}

/** Mengubah pemegang, status, atau mencatat aset baru. */
export function bolehKelolaAset(pengguna: Pengguna) {
  return (
    pengguna.role === "CEO" ||
    pengguna.role === "Manager" ||
    pengguna.role === "Finance"
  );
}
