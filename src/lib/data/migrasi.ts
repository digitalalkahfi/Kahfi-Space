// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import type {
  BarisVerifikasi,
  JalanMigrasi,
  RingkasEntitas,
  StatusMigrasi,
  TahapMigrasi,
} from "@/lib/migrasi";
import {
  entitasDari,
  masalahKv,
  ringkasKv,
  type EntriKv,
} from "@/lib/kv-store";
import { PEMETAAN } from "@/lib/pemetaan";
import type { Pengguna } from "@/lib/types";

export type CatatanMigrasi = {
  id: string;
  entitas: string;
  kunciLama: string;
  idBaru: string | null;
  status: StatusMigrasi;
  pesan: string;
};

/** Migrasi adalah pekerjaan CEO/Manager (policy `migrasi_*_kelola`). */
export function bolehMigrasi(pengguna: Pengguna) {
  return pengguna.role === "CEO" || pengguna.role === "Manager";
}

/**
 * Riwayat eksekusi migrasi, terbaru lebih dulu.
 *
 * Mode demo tidak terhubung sistem lama sama sekali, jadi daftarnya
 * kosong — bukan diisi contoh, supaya tidak ada yang mengira migrasi
 * pernah dijalankan padahal belum.
 */
export async function riwayatMigrasi(): Promise<JalanMigrasi[]> {
  if (modeData() === "demo") return [];

  const sb = await klienServer();
  const { data, error } = await sb
    .from("migrasi_jalan")
    .select(
      "id, tahap, sumber, dimulai_pada, selesai_pada, catatan, oleh:users (nama)",
    )
    .order("dimulai_pada", { ascending: false })
    .limit(20);

  if (error) throw new Error(`Gagal memuat riwayat migrasi: ${error.message}`);

  return (data ?? []).map((j) => ({
    id: j.id,
    tahap: j.tahap as TahapMigrasi,
    sumber: j.sumber,
    olehNama: Array.isArray(j.oleh) ? (j.oleh[0]?.nama ?? null) : (j.oleh?.nama ?? null),
    dimulaiPada: j.dimulai_pada,
    selesaiPada: j.selesai_pada,
    catatan: j.catatan,
  }));
}

/** Ringkasan per entitas untuk satu eksekusi (default: yang terbaru). */
export async function ringkasMigrasi(
  jalanId?: string,
): Promise<RingkasEntitas[]> {
  if (modeData() === "demo") return [];

  const sb = await klienServer();
  const { data, error } = await sb.rpc("ringkas_migrasi", {
    p_jalan: jalanId,
  });

  if (error) throw new Error(`Gagal memuat ringkasan migrasi: ${error.message}`);

  return (data ?? []).map((r) => ({
    entitas: r.entitas,
    total: Number(r.total),
    berhasil: Number(r.berhasil),
    dilewati: Number(r.dilewati),
    gagal: Number(r.gagal),
    menunggu: Number(r.menunggu),
  }));
}

/** Entri yang gagal atau dilewati — itulah yang perlu ditindaklanjuti. */
export async function catatanBermasalah(
  jalanId: string,
): Promise<CatatanMigrasi[]> {
  if (modeData() === "demo") return [];

  const sb = await klienServer();
  const { data, error } = await sb
    .from("migrasi_catatan")
    .select("id, entitas, kunci_lama, id_baru, status, pesan")
    .eq("jalan_id", jalanId)
    .in("status", ["gagal", "dilewati"])
    .order("entitas")
    .limit(200);

  if (error) throw new Error(`Gagal memuat catatan migrasi: ${error.message}`);

  return (data ?? []).map((c) => ({
    id: c.id,
    entitas: c.entitas,
    kunciLama: c.kunci_lama,
    idBaru: c.id_baru,
    status: c.status as StatusMigrasi,
    pesan: c.pesan,
  }));
}

// ---------------------------------------------------------------------
// Ekspor kv_store
// ---------------------------------------------------------------------

/** Berapa baris ditarik sekali jalan; kv_store lama bisa puluhan ribu baris. */
const HALAMAN_KV = 1000;

/**
 * Membaca tiruan ekspor kv_store yang dihasilkan
 * `scripts/buat-kv-store-tiruan.mjs`.
 *
 * Berkasnya ada di repositori supaya parser dan pemetaan bisa
 * dikembangkan dan diuji tanpa akses ke sistem lama. Isinya sengaja
 * memuat entri rusak yang lazim ditemui pada ekspor sungguhan.
 */
export async function eksporTiruan() {
  const { default: berkas } = await import(
    "../../../supabase/migrasi/kv-store-contoh.json"
  );

  const entri = berkas.entri as EntriKv[];
  return {
    sumber: berkas.sumber,
    dibuatPada: berkas.dibuat_pada,
    jumlah: entri.length,
    entri,
    ringkas: ringkasKv(entri),
    masalah: masalahKv(entri),
    tiruan: true,
  };
}

/**
 * Ekspor kv_store yang dipakai migrasi.
 *
 * Sumber sebenarnya adalah `kv_store_lama` — salinan mentah sistem lama
 * yang dimuat ke basis data ini (0074). Selama tabel itu masih kosong,
 * yang dipakai adalah berkas contoh di repositori: uji coba tetap bisa
 * dijalankan, dan layar menyebut apa adanya bahwa datanya tiruan.
 *
 * Seluruh baris ditarik bertahap, bukan sekaligus, karena kv_store lama
 * bisa berisi puluhan ribu entri.
 */
export async function eksporKvStore() {
  if (modeData() === "demo") return eksporTiruan();

  const sb = await klienServer();
  const { count, error: galatHitung } = await sb
    .from("kv_store_lama")
    .select("key", { count: "exact", head: true });

  if (galatHitung || !count) return eksporTiruan();

  const entri: EntriKv[] = [];
  let terakhir = "";

  // Ditarik per halaman dengan penanda kunci terakhir: `range()` pada
  // tabel yang sedang dimuat bisa melewatkan atau menggandakan baris.
  for (;;) {
    const { data, error } = await sb
      .from("kv_store_lama")
      .select("key, value")
      .gt("key", terakhir)
      .order("key")
      .limit(HALAMAN_KV);

    if (error) break;
    if (!data || data.length === 0) break;

    for (const baris of data) entri.push({ key: baris.key, value: baris.value });
    terakhir = data[data.length - 1].key;
    if (data.length < HALAMAN_KV) break;
  }

  const { data: waktu } = await sb
    .from("kv_store_lama")
    .select("dimuat_pada")
    .order("dimuat_pada", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    sumber: "kv_store",
    dibuatPada: waktu?.dimuat_pada ?? new Date().toISOString(),
    jumlah: entri.length,
    entri,
    ringkas: ringkasKv(entri),
    masalah: masalahKv(entri),
    tiruan: false,
  };
}

// ---------------------------------------------------------------------
// Persetujuan pemetaan
// ---------------------------------------------------------------------

export type Persetujuan = {
  entitas: string;
  versi: string;
  olehNama: string | null;
  pada: string;
  catatan: string;
};

/**
 * Persetujuan yang masih berlaku, dikunci per (entitas, versi).
 *
 * Yang dikembalikan hanya persetujuan yang sidik versinya masih cocok
 * dengan pemetaan saat ini — begitu pemetaan disunting, persetujuan
 * lamanya tidak lagi terhitung.
 */
export async function persetujuanPemetaan(): Promise<Persetujuan[]> {
  if (modeData() === "demo") return [];

  const sb = await klienServer();
  const { data, error } = await sb
    .from("migrasi_persetujuan")
    .select("entitas, versi, disetujui_pada, catatan, oleh:users (nama)")
    .order("disetujui_pada", { ascending: false });

  if (error) throw new Error(`Gagal memuat persetujuan: ${error.message}`);

  return (data ?? []).map((p) => ({
    entitas: p.entitas,
    versi: p.versi,
    olehNama: Array.isArray(p.oleh)
      ? (p.oleh[0]?.nama ?? null)
      : (p.oleh?.nama ?? null),
    pada: p.disetujui_pada,
    catatan: p.catatan,
  }));
}

// ---------------------------------------------------------------------
// Verifikasi jumlah baris
// ---------------------------------------------------------------------


/**
 * Membandingkan jumlah entri di sumber, yang tercatat pindah, dan yang
 * benar-benar ada di tabel tujuan.
 *
 * Perbandingan ini yang menangkap kehilangan diam-diam: baris yang
 * tercatat "berhasil" tetapi ternyata tidak ada di database sama sekali.
 */
export async function verifikasiJumlah(
  jalanId?: string,
): Promise<BarisVerifikasi[]> {
  const ekspor = await eksporKvStore();

  const perEntitasSumber = new Map<string, number>();
  for (const e of ekspor.entri) {
    const jenis = entitasDari(e.key);
    perEntitasSumber.set(jenis, (perEntitasSumber.get(jenis) ?? 0) + 1);
  }

  const ringkas = await ringkasMigrasi(jalanId);
  const perEntitasLog = new Map(ringkas.map((r) => [r.entitas, r]));

  const jumlahTujuan = await hitungTerbukti(jalanId);

  return PEMETAAN.map((p) => {
    const log = perEntitasLog.get(p.kunci);
    return {
      entitas: p.kunci,
      label: p.label,
      tabelBaru: p.tabelBaru,
      sumber: perEntitasSumber.get(p.kunci) ?? 0,
      berhasil: log?.berhasil ?? 0,
      dilewati: log?.dilewati ?? 0,
      gagal: log?.gagal ?? 0,
      tujuan: jumlahTujuan[p.kunci] ?? 0,
    };
  });
}

/**
 * Berapa entri yang tercatat berhasil dan barisnya memang ada sekarang.
 *
 * Sengaja bukan jumlah seluruh tabel tujuan: tabel itu ikut menampung
 * baris yang dibuat orang sesudah migrasi, sehingga jumlahnya berhenti
 * membuktikan apa pun. Yang dihitung di sini hanya baris yang benar-benar
 * berasal dari migrasi ini (0077).
 */
async function hitungTerbukti(jalanId?: string): Promise<Record<string, number>> {
  if (modeData() === "demo") {
    // Mode demo tidak punya tabel tujuan yang bisa dihitung.
    return {};
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("verifikasi_migrasi", {
    p_jalan: jalanId,
  });

  if (error || !data) return {};
  return Object.fromEntries(data.map((r) => [r.entitas, r.ada_di_tujuan]));
}

// ---------------------------------------------------------------------
// Pembekuan K-Space lama
// ---------------------------------------------------------------------

export type StatusLama = {
  readonly: boolean;
  pada: string | null;
  olehNama: string | null;
  url: string;
};

/**
 * Apakah K-Space lama sudah dibekukan.
 *
 * Dibaca di seluruh halaman, jadi kegagalannya tidak boleh menjatuhkan
 * apa pun: bila statusnya tak terbaca, dianggap belum dibekukan — itu
 * pilihan yang aman, karena paling buruk orang melihat satu pengingat
 * tambahan.
 */
export async function statusKspaceLama(): Promise<StatusLama> {
  const bawaan: StatusLama = {
    readonly: false,
    pada: null,
    olehNama: null,
    url: "",
  };
  if (modeData() === "demo") return bawaan;

  const sb = await klienServer();
  const { data, error } = await sb
    .from("pengaturan")
    .select("lama_readonly, lama_readonly_pada, lama_url, oleh:users (nama)")
    .maybeSingle();

  if (error || !data) return bawaan;

  return {
    readonly: data.lama_readonly,
    pada: data.lama_readonly_pada,
    olehNama: Array.isArray(data.oleh)
      ? (data.oleh[0]?.nama ?? null)
      : (data.oleh?.nama ?? null),
    url: data.lama_url,
  };
}

export type KejadianLama = {
  id: string;
  readonly: boolean;
  pada: string;
  olehNama: string | null;
  catatan: string;
};

/**
 * Riwayat pembekuan dan pembukaan K-Space lama.
 *
 * Keadaan sekarang saja tidak cukup: jendela saat sistem lama sempat
 * dibuka kembali adalah waktu ketika laporan bisa terlanjur masuk ke
 * tempat yang datanya tidak akan ikut pindah (0078).
 */
export async function riwayatKspaceLama(batas = 10): Promise<KejadianLama[]> {
  if (modeData() === "demo") return [];

  const sb = await klienServer();
  const { data, error } = await sb
    .from("kspace_lama_log")
    .select("id, readonly, pada, catatan, oleh:users (nama)")
    .order("pada", { ascending: false })
    .limit(batas);

  if (error || !data) return [];

  return data.map((k) => ({
    id: k.id,
    readonly: k.readonly,
    pada: k.pada,
    olehNama: (k.oleh as unknown as { nama: string } | null)?.nama ?? null,
    catatan: k.catatan,
  }));
}
