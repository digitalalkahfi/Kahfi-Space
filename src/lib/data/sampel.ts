// Modul khusus server.
import "server-only";

import { normalkanKode } from "@/lib/sampel";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { TANGGAL_ACUAN, dataContoh } from "@/lib/data/contoh";
import type { KejadianSampel, Sampel, StatusSampel } from "@/lib/sampel";
import type { BarisRiwayat } from "@/lib/saring-sampel";
import type { KodeUnit, Pengguna } from "@/lib/types";

/** Menambah atau menyunting sampel adalah wewenang CEO/Manager. */
export function bolehKelolaSampel(pengguna: Pengguna) {
  return pengguna.role === "CEO" || pengguna.role === "Manager";
}

function satu<T>(nilai: T | T[] | null | undefined): T | null {
  if (!nilai) return null;
  return Array.isArray(nilai) ? (nilai[0] ?? null) : nilai;
}

/**
 * Sampel yang terlihat pengguna. Penyaringannya dikerjakan RLS;
 * mode demo menirukan cakupan yang sama.
 */
export async function daftarSampel(pengguna: Pengguna): Promise<Sampel[]> {
  if (modeData() === "demo") return sampelDemo(pengguna);

  const sb = await klienServer();
  const { data, error } = await sb
    .from("samples")
    .select(
      `id, kode, nama, kategori, nilai, status, kreator, brand, link_produk,
       catatan, updated_at,
       unit:units (kode, nama),
       pemegang:users (id, nama),
       akun:accounts (id, username)`,
    )
    .order("kode");

  if (error) throw new Error(`Gagal memuat sampel: ${error.message}`);

  return (data ?? []).map((s) => {
    const unit = satu(s.unit);
    const pemegang = satu(s.pemegang);
    return {
      id: s.id,
      kode: s.kode,
      nama: s.nama,
      kategori: s.kategori,
      unitKode: (unit?.kode as KodeUnit) ?? null,
      unitNama: unit?.nama ? unit.nama.split(" (")[0] : "—",
      nilai: Number(s.nilai),
      status: s.status as StatusSampel,
      pemegangId: pemegang?.id ?? null,
      pemegangNama: pemegang?.nama ?? null,
      akunId: satu(s.akun)?.id ?? null,
      akunUsername: satu(s.akun)?.username ?? null,
      kreator: s.kreator,
      brand: s.brand,
      linkProduk: s.link_produk,
      catatan: s.catatan,
      diperbaruiPada: s.updated_at,
    };
  });
}

/** Riwayat perpindahan sebuah sampel, terbaru lebih dulu. */
export async function riwayatSampel(
  sampelId: string,
): Promise<KejadianSampel[]> {
  if (modeData() === "demo") return riwayatDemo(sampelId);

  const sb = await klienServer();
  const { data, error } = await sb
    .from("sample_events")
    .select(
      `id, dari, ke, kreator, catatan, pada,
       oleh:users!sample_events_oleh_id_fkey (nama),
       pemegang:users!sample_events_pemegang_id_fkey (nama)`,
    )
    .eq("sample_id", sampelId)
    .order("pada", { ascending: false });

  if (error) throw new Error(`Gagal memuat riwayat sampel: ${error.message}`);

  return (data ?? []).map((k) => ({
    id: k.id,
    dari: (k.dari as StatusSampel) ?? null,
    ke: k.ke as StatusSampel,
    olehNama: satu(k.oleh)?.nama ?? null,
    pemegangNama: satu(k.pemegang)?.nama ?? null,
    kreator: k.kreator,
    catatan: k.catatan,
    pada: k.pada,
  }));
}

/** Satu sampel berdasarkan kode QR-nya. */
export async function sampelDariKode(
  pengguna: Pengguna,
  kode: string,
): Promise<Sampel | null> {
  // Isi QR dinormalkan dulu: tautan cetakan lama, awalan "kode:", dan
  // spasi tak-putus semuanya tetap mengarah ke sampel yang sama.
  const bersih = normalkanKode(kode);
  if (!bersih) return null;

  if (modeData() === "demo") {
    return (
      sampelDemo(pengguna).find(
        (s) => s.kode.toLowerCase() === bersih.toLowerCase(),
      ) ?? null
    );
  }

  // Dicari langsung ke database, bukan dengan menarik seluruh daftar:
  // pemindaian terjadi berkali-kali dalam semenit, dan RLS tetap yang
  // menentukan boleh-tidaknya baris itu terlihat.
  const sb = await klienServer();
  const { data, error } = await sb
    .from("samples")
    .select(
      `id, kode, nama, kategori, nilai, status, kreator, brand, link_produk,
       catatan, updated_at,
       unit:units (kode, nama),
       pemegang:users (id, nama),
       akun:accounts (id, username)`,
    )
    .ilike("kode", bersih)
    .maybeSingle();

  if (error || !data) return null;

  const unit = data.unit as unknown as { kode: string; nama: string } | null;
  const pemegang = data.pemegang as unknown as {
    id: string;
    nama: string;
  } | null;

  return {
    id: data.id,
    kode: data.kode,
    nama: data.nama,
    kategori: data.kategori,
    unitKode: (unit?.kode as Sampel["unitKode"]) ?? null,
    unitNama: unit?.nama.split(" (")[0] ?? "—",
    nilai: Number(data.nilai),
    status: data.status as Sampel["status"],
    pemegangId: pemegang?.id ?? null,
    pemegangNama: pemegang?.nama ?? null,
    akunId: (data.akun as unknown as { id: string } | null)?.id ?? null,
    akunUsername:
      (data.akun as unknown as { username: string } | null)?.username ?? null,
    kreator: data.kreator,
    brand: data.brand,
    linkProduk: data.link_produk,
    catatan: data.catatan,
    diperbaruiPada: data.updated_at,
  };
}

// ---------------------------------------------------------------------
// Mode demo — cakupan baca menirukan policy `samples_baca`.
// ---------------------------------------------------------------------
function sampelDemo(pengguna: Pengguna): Sampel[] {
  const { samples, units, users } = dataContoh;

  return samples
    .map((s) => {
      const pemegang = s.pemegang
        ? users.find((u) => u.nama === s.pemegang)
        : null;
      const unit = units.find((u) => u.kode === s.unit);
      const akun = dataContoh.accounts.find((a) => a.username === s.akun);
      return {
        id: s.kode,
        kode: s.kode,
        nama: s.nama,
        kategori: s.kategori,
        unitKode: (s.unit as KodeUnit) ?? null,
        unitNama: unit?.nama ? unit.nama.split(" (")[0] : "—",
        nilai: s.nilai,
        status: s.status as StatusSampel,
        pemegangId: pemegang?.id ?? null,
        pemegangNama: s.pemegang ?? null,
        akunId: akun?.id ?? null,
        akunUsername: akun?.username ?? null,
        kreator: s.kreator ?? "",
        brand: s.brand ?? "",
        linkProduk: s.link || null,
        catatan: "",
        diperbaruiPada: `${dataContoh.tanggalAcuan}T10:00:00+07:00`,
      } satisfies Sampel;
    })
    .filter((s) => {
      if (
        pengguna.role === "CEO" ||
        pengguna.role === "Manager" ||
        pengguna.role === "Finance"
      ) {
        return true;
      }
      if (pengguna.role === "Leader" || pengguna.role === "Co-Leader") {
        return s.unitKode === pengguna.unitId;
      }
      // Staf melihat unitnya sendiri dan apa pun yang sedang ia pegang.
      return s.unitKode === pengguna.unitId || s.pemegangNama === pengguna.nama;
    })
    .sort((a, b) => a.kode.localeCompare(b.kode));
}

/**
 * Riwayat mode demo, diturunkan dari jalur yang sama dengan seed.
 *
 * Mengembalikan daftar kosong akan membuat halaman bertentangan dengan
 * dirinya sendiri: statusnya "dikirim", riwayatnya "belum pernah
 * berpindah". Lebih jujur menunjukkan perjalanan yang memang menghasilkan
 * keadaan itu.
 */
const JALUR_DEMO: Record<StatusSampel, StatusSampel[]> = {
  tersedia: [],
  dipegang: ["dipegang"],
  dikirim: ["dipegang", "dikirim"],
  diterima: ["dipegang", "dikirim", "diterima"],
  dikembalikan: ["dipegang", "dikirim", "diterima", "dikembalikan"],
  hilang: ["dipegang", "hilang"],
};

function riwayatDemo(sampelId: string): KejadianSampel[] {
  const s = dataContoh.samples.find((x) => x.kode === sampelId);
  if (!s) return [];

  const langkah = JALUR_DEMO[s.status as StatusSampel] ?? [];
  const acuan = new Date(`${dataContoh.tanggalAcuan}T10:00:00+07:00`);

  return langkah
    .map((ke, i) => {
      const pada = new Date(acuan);
      pada.setDate(pada.getDate() - (langkah.length - i));
      return {
        id: `${s.kode}-${i}`,
        dari: (i === 0 ? "tersedia" : langkah[i - 1]) as StatusSampel,
        ke,
        olehNama: "Farhan Pratama",
        pemegangNama:
          ke === "tersedia" || ke === "dikembalikan"
            ? null
            : (s.pemegang ?? null),
        kreator: ke === "dikirim" || ke === "diterima" ? (s.kreator ?? "") : "",
        catatan: "",
        pada: pada.toISOString(),
      } satisfies KejadianSampel;
    })
    .reverse();
}

/**
 * Seluruh perpindahan yang boleh dilihat pengguna, terbaru lebih dulu.
 *
 * Dibaca sekali lalu disaring di aplikasi: jumlah barisnya sebanding
 * dengan jumlah sampel, bukan dengan jumlah transaksi harian, jadi jauh
 * lebih murah daripada satu query per kombinasi saringan.
 */
export async function riwayatSemuaSampel(
  pengguna: Pengguna,
): Promise<BarisRiwayat[]> {
  const sampel = await daftarSampel(pengguna);
  const perId = new Map(sampel.map((s) => [s.id, s]));

  if (modeData() === "demo") {
    return sampel
      .flatMap((s) => riwayatDemo(s.id).map((k) => keBarisRiwayat(k, s)))
      .sort((a, b) => b.pada.localeCompare(a.pada));
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("sample_events")
    .select(
      `id, sample_id, dari, ke, kreator, catatan, pada,
       oleh:users!sample_events_oleh_id_fkey (nama),
       pemegang:users!sample_events_pemegang_id_fkey (nama)`,
    )
    .order("pada", { ascending: false })
    .limit(500);

  if (error) throw new Error(`Gagal memuat riwayat sampel: ${error.message}`);

  return (data ?? []).flatMap((k) => {
    const s = perId.get(k.sample_id);
    // Perpindahan sampel yang tidak terlihat pengguna ikut tersaring.
    if (!s) return [];
    return [
      keBarisRiwayat(
        {
          id: k.id,
          dari: (k.dari as StatusSampel) ?? null,
          ke: k.ke as StatusSampel,
          olehNama: satu(k.oleh)?.nama ?? null,
          pemegangNama: satu(k.pemegang)?.nama ?? null,
          kreator: k.kreator,
          catatan: k.catatan,
          pada: k.pada,
        },
        s,
      ),
    ];
  });
}

function keBarisRiwayat(k: KejadianSampel, s: Sampel): BarisRiwayat {
  return {
    id: k.id,
    sampelId: s.id,
    kode: s.kode,
    namaSampel: s.nama,
    unitNama: s.unitNama,
    dari: k.dari,
    ke: k.ke,
    olehNama: k.olehNama,
    pemegangNama: k.pemegangNama,
    kreator: k.kreator,
    catatan: k.catatan,
    pada: k.pada,
  };
}

/** Waktu semu mode demo: sekian hari sebelum tanggal acuan data contoh. */
function tanggalLalu(hari: number) {
  const d = new Date(`${TANGGAL_ACUAN}T09:00:00Z`);
  d.setUTCDate(d.getUTCDate() - hari);
  return d.toISOString();
}

export type KodeAsing = {
  kode: string;
  jumlah: number;
  terakhir: string;
};

/**
 * Kode yang dipindai tetapi tidak dikenali, diurutkan dari yang paling
 * sering.
 *
 * Ini bukan daftar kesalahan orang: kode asing yang berulang menandai
 * label tertukar, stiker lama yang masih beredar, atau barang dari luar
 * yang masuk ke gudang — masalah yang hanya terlihat kalau dihitung.
 */
export async function kodeAsing(batas = 10): Promise<KodeAsing[]> {
  if (modeData() === "demo") {
    const hitung = new Map<string, { jumlah: number; terakhir: string }>();
    for (const s of dataContoh.sample_scans ?? []) {
      if (s.dikenali) continue;
      const pada = tanggalLalu(s.lalu_hari);
      const ada = hitung.get(s.kode);
      hitung.set(s.kode, {
        jumlah: (ada?.jumlah ?? 0) + 1,
        terakhir: ada && ada.terakhir > pada ? ada.terakhir : pada,
      });
    }
    return [...hitung.entries()]
      .map(([kode, n]) => ({ kode, jumlah: n.jumlah, terakhir: n.terakhir }))
      .sort(
        (a, b) => b.jumlah - a.jumlah || b.terakhir.localeCompare(a.terakhir),
      )
      .slice(0, batas);
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("kode_asing", {});

  if (error || !data) return [];

  return data.slice(0, batas).map((k) => ({
    kode: k.kode,
    jumlah: Number(k.jumlah),
    terakhir: k.terakhir,
  }));
}

export type PemindaianTerakhir = {
  id: string;
  kode: string;
  dikenali: boolean;
  pada: string;
  olehNama: string | null;
  sampelNama: string | null;
  berlanjut: boolean;
};

/**
 * Pemindaian terbaru yang boleh dilihat pengguna ini.
 *
 * Saringan tanggal dan jenis dikerjakan database; pencarian teks
 * dikerjakan di memori atas baris yang memang sudah dibaca, sebab
 * jumlahnya sudah dibatasi lebih dulu.
 */
export async function riwayatScan(
  saringan?: {
    dari?: string;
    sampai?: string;
    jenis?: "semua" | "dikenali" | "asing";
  },
  batas = 50,
): Promise<PemindaianTerakhir[]> {
  const dari = saringan?.dari ?? "";
  const sampai = saringan?.sampai ?? "";
  const jenis = saringan?.jenis ?? "semua";

  if (modeData() === "demo") {
    const { sample_scans = [], samples } = dataContoh;
    return sample_scans
      .map((s, i) => ({
        id: `contoh-scan-${i}`,
        kode: s.kode,
        dikenali: s.dikenali,
        pada: tanggalLalu(s.lalu_hari),
        olehNama: s.oleh,
        sampelNama: s.dikenali
          ? (samples.find((x) => x.kode === s.kode)?.nama ?? null)
          : null,
        berlanjut: false,
      }))
      .filter((s) => {
        if (jenis === "dikenali" && !s.dikenali) return false;
        if (jenis === "asing" && s.dikenali) return false;
        const hari = s.pada.slice(0, 10);
        if (dari && hari < dari) return false;
        if (sampai && hari > sampai) return false;
        return true;
      })
      .sort((a, b) => b.pada.localeCompare(a.pada))
      .slice(0, batas);
  }

  const sb = await klienServer();
  let kueri = sb.from("sample_scans").select(
    `id, kode, dikenali, pada, kejadian_id,
       oleh:users (nama), sampel:samples (nama)`,
  );

  if (jenis !== "semua") kueri = kueri.eq("dikenali", jenis === "dikenali");
  if (dari) kueri = kueri.gte("pada", `${dari}T00:00:00Z`);
  if (sampai) kueri = kueri.lte("pada", `${sampai}T23:59:59Z`);

  const { data, error } = await kueri
    .order("pada", { ascending: false })
    .limit(batas);

  if (error || !data) return [];

  return data.map((s) => ({
    id: s.id,
    kode: s.kode,
    dikenali: s.dikenali,
    pada: s.pada,
    olehNama: (s.oleh as unknown as { nama: string } | null)?.nama ?? null,
    sampelNama: (s.sampel as unknown as { nama: string } | null)?.nama ?? null,
    berlanjut: s.kejadian_id !== null,
  }));
}

/**
 * Ancar-ancar kode berikutnya untuk layar tambah sampel.
 *
 * Hanya ancar-ancar: kode yang sesungguhnya dibangkitkan database saat
 * penyimpanan (0081), sebab orang lain bisa mendahului sedetik sebelumnya.
 */
export async function kodeSampelBerikutnya(): Promise<string | null> {
  if (modeData() === "demo") {
    const nomor = dataContoh.samples
      .map((s) => Number(s.kode.replace(/^SMP-/i, "")))
      .filter((n) => Number.isFinite(n));
    const berikut = (nomor.length > 0 ? Math.max(...nomor) : 0) + 1;
    return `SMP-${String(berikut).padStart(4, "0")}`;
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("kode_sampel_berikutnya", {});
  return error ? null : (data ?? null);
}
