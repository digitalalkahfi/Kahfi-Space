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
import { PEMETAAN_V1 } from "@/lib/pemetaan-v1";
import { orangDitunggu } from "@/lib/rekap-pemetaan";
import { gabungGmv, ringkasGabungGmv, sebabDilewati } from "@/lib/gmv-v1";
import { dataContoh } from "@/lib/data/contoh";
import {
  KUNCI_DIKENAL,
  KUNCI_META,
  bacaEksporV1,
  golonganKunci,
  jumlahEntri,
  medanEkspor,
  type BarisUnggah,
  type GolonganKunci,
} from "@/lib/ekspor-v1";
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
    olehNama: Array.isArray(j.oleh)
      ? (j.oleh[0]?.nama ?? null)
      : (j.oleh?.nama ?? null),
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

  if (error)
    throw new Error(`Gagal memuat ringkasan migrasi: ${error.message}`);

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
 * Membaca contoh ekspor K-Space V1 yang ikut dalam repositori.
 *
 * Berkasnya ada di sini supaya pembacaan dan pemetaan bisa dikembangkan
 * tanpa akses ke sistem lama, dan supaya mode demo punya sesuatu yang
 * nyata untuk ditampilkan. Bentuknya sama persis dengan ekspor
 * sungguhan; isinya data demo tanpa satu pun medan kata sandi.
 */
export async function eksporContoh() {
  const { default: berkas } =
    await import("../../../supabase/migrasi/ekspor-contoh.json");

  const isi = berkas as Record<string, unknown>;
  const meta = bacaEksporV1(isi);

  // Satu kunci ekspor = satu entri, persis seperti isi kv_store_lama.
  const entri: EntriKv[] = Object.entries(isi)
    .filter(([k]) => k !== "_meta")
    .map(([key, value]) => ({ key, value }));

  return {
    sumber: "ekspor-contoh.json",
    dibuatPada:
      (meta.ok ? meta.meta?.diekspor : null) ?? new Date().toISOString(),
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
 * Sumber sebenarnya adalah `kv_store_lama` — isi ekspor yang diunggah
 * lewat layar migrasi (0074 & 0152). Selama tabel itu masih kosong, yang
 * dipakai adalah contoh ekspor di repositori: layar tetap bisa dicoba,
 * dan disebut apa adanya bahwa datanya contoh.
 *
 * Seluruh baris ditarik bertahap, bukan sekaligus, karena kv_store lama
 * bisa berisi puluhan ribu entri.
 */
export async function eksporKvStore() {
  if (modeData() === "demo") return eksporContoh();

  const sb = await klienServer();
  const { count, error: galatHitung } = await sb
    .from("kv_store_lama")
    .select("key", { count: "exact", head: true });

  if (galatHitung || !count) return eksporContoh();

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

    for (const baris of data)
      entri.push({ key: baris.key, value: baris.value });
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
  /**
   * Angka yang dilihat saat menyetujui.
   *
   * Persetujuan atas pemetaan tanpa angkanya hanya menyetujui bentuk;
   * yang sebenarnya diputuskan orang adalah "pemetaan ini, untuk data
   * sebanyak ini". Null untuk persetujuan lama yang belum mencatatnya.
   */
  rekap: { ekspor: number; terpetakan: number; butuhKeputusan: number } | null;
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
    .select(
      "entitas, versi, disetujui_pada, catatan, pemetaan, oleh:users (nama)",
    )
    .order("disetujui_pada", { ascending: false });

  if (error) throw new Error(`Gagal memuat persetujuan: ${error.message}`);

  return (data ?? []).map((p) => {
    const isi = p.pemetaan as { rekap?: unknown } | null;
    const rekap =
      isi &&
      typeof isi === "object" &&
      isi.rekap &&
      typeof isi.rekap === "object"
        ? (isi.rekap as Persetujuan["rekap"])
        : null;

    return {
      entitas: p.entitas,
      versi: p.versi,
      olehNama: Array.isArray(p.oleh)
        ? (p.oleh[0]?.nama ?? null)
        : (p.oleh?.nama ?? null),
      pada: p.disetujui_pada,
      catatan: p.catatan,
      rekap,
    };
  });
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

  // Satu kunci ekspor memuat seluruh catatannya sekaligus, jadi yang
  // dihitung isinya — bukan jumlah barisnya di kv_store_lama.
  const perEntitasSumber = new Map<string, number>();
  for (const e of ekspor.entri) {
    const jenis = entitasDari(e.key);
    perEntitasSumber.set(
      jenis,
      (perEntitasSumber.get(jenis) ?? 0) + jumlahEntri(e.value),
    );
  }

  const ringkas = await ringkasMigrasi(jalanId);
  const perEntitasLog = new Map(ringkas.map((r) => [r.entitas, r]));

  const jumlahTujuan = await hitungTerbukti(jalanId);

  return PEMETAAN_V1.map((p) => {
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
async function hitungTerbukti(
  jalanId?: string,
): Promise<Record<string, number>> {
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

// ---------------------------------------------------------------------
// Kunci ekspor yang sudah tersimpan
// ---------------------------------------------------------------------

export type KunciLama = {
  baris: BarisUnggah[];
  /** Berkas ekspor terakhir yang diunggah, bila tercatat. */
  berkas: string | null;
  dimuatPada: string | null;
};

/**
 * Kunci ekspor lama yang sudah ada di `kv_store_lama` sekarang.
 *
 * Dipakai supaya layar unggah tetap jujur setelah halaman disegarkan:
 * tanpa ini, satu-satunya yang tahu isi tabelnya adalah tab browser yang
 * kebetulan baru saja mengunggah, dan orang berikutnya melihat layar
 * kosong seolah belum ada apa-apa.
 *
 * Golongannya dihitung database lewat `golongan_kunci()` (0152) — fungsi
 * yang sama yang diuji setara dengan `golonganKunci()` di kode aplikasi,
 * supaya layar tidak pernah menggolongkan kunci berbeda dari yang
 * menyimpannya.
 */
export async function kunciLamaTersimpan(): Promise<KunciLama> {
  const kosong: KunciLama = { baris: [], berkas: null, dimuatPada: null };

  // Mode demo tidak terhubung sistem lama, jadi yang dibaca adalah contoh
  // ekspor di repositori — bentuknya persis ekspor sungguhan, isinya data
  // demo. Layar menyebut nama berkasnya apa adanya supaya tidak ada yang
  // mengira ekspor aslinya sudah masuk.
  if (modeData() === "demo") return eksporContohV1();

  const sb = await klienServer();
  const { data, error } = await sb.rpc("ringkas_kunci_lama");
  if (error || !data || data.length === 0) return kosong;

  const { data: unggahan } = await sb
    .from("kv_unggahan")
    .select("berkas, dimuat_pada")
    .order("dimuat_pada", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    baris: data.map((r) => ({
      kunci: r.kunci,
      golongan: r.golongan as GolonganKunci,
      jumlah: Number(r.jumlah),
      // Yang terbaca dari tabel ini menurut definisinya tersimpan.
      disimpan: true,
    })),
    berkas: unggahan?.berkas ?? null,
    dimuatPada: unggahan?.dimuat_pada ?? null,
  };
}

/**
 * Contoh ekspor K-Space V1 yang ikut dalam repositori.
 *
 * Berkasnya dibuat `scripts/buat-ekspor-contoh.mjs` dan tidak memuat satu
 * pun medan kata sandi. Gunanya dua: mode demo punya sesuatu yang nyata
 * untuk ditampilkan, dan pembacaan ekspor bisa dikembangkan tanpa akses
 * ke sistem lama.
 */
export async function eksporContohV1(): Promise<KunciLama> {
  const { default: berkas } =
    await import("../../../supabase/migrasi/ekspor-contoh.json");

  const dibaca = bacaEksporV1(berkas);
  if (!dibaca.ok) return { baris: [], berkas: null, dimuatPada: null };

  return {
    baris: dibaca.isi.map(({ kunci, golongan, jumlah, disimpan }) => ({
      kunci,
      golongan,
      jumlah,
      disimpan,
    })),
    berkas: "ekspor-contoh.json",
    dimuatPada: dibaca.meta?.diekspor ?? null,
  };
}

/**
 * Medan yang benar-benar muncul di tiap kunci ekspor lama.
 *
 * Dipakai layar pemetaan untuk menemukan medan yang tidak disebut
 * pemetaan sama sekali — kehilangan yang tidak menimbulkan galat apa pun
 * dan karena itu paling mudah lolos.
 */
export async function medanEksporLama(): Promise<Record<string, string[]>> {
  if (modeData() === "demo") {
    const { default: berkas } =
      await import("../../../supabase/migrasi/ekspor-contoh.json");
    const isi = berkas as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(isi)
        .filter(([k]) => k !== "_meta")
        .map(([k, v]) => [k, medanEkspor(v)]),
    );
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("medan_kunci_lama", {});
  if (error || !data) return {};
  return Object.fromEntries(data.map((r) => [r.kunci, r.medan ?? []]));
}

/**
 * Isi ekspor lama yang dipakai menghitung rekap dan pembanding.
 *
 * Hanya kunci yang benar-benar dipetakan yang ditarik: satu kunci saja
 * bisa berisi belasan megabita, dan menariknya seluruhnya tiap kali
 * halaman dibuka memindahkan seluruh data lama lewat jaringan tanpa
 * satu pun angkanya berubah.
 */
export async function isiEksporLama(): Promise<Record<string, unknown>> {
  if (modeData() === "demo") {
    const { default: berkas } =
      await import("../../../supabase/migrasi/ekspor-contoh.json");
    return berkas as Record<string, unknown>;
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("kv_store_lama")
    .select("key, value")
    .in(
      "key",
      KUNCI_DIKENAL.map((k) => k.kunci),
    );

  if (error || !data) return {};
  return Object.fromEntries(data.map((b) => [b.key, b.value]));
}

/**
 * Berapa catatan tiap kelompok yang sudah punya padanan di V2.
 *
 * Dihitung dari `migrasi_peta` (0154/0155), bukan dari jumlah baris
 * tabel tujuan: tabel tujuan ikut menampung baris yang dibuat orang
 * sesudah migrasi, sehingga jumlahnya berhenti membuktikan apa pun.
 */
export async function hitunganPeta(): Promise<Record<string, number>> {
  if (modeData() === "demo") return {};

  const sb = await klienServer();
  const { data, error } = await sb.rpc("ringkas_peta_kelompok");
  if (error || !data) return {};
  return Object.fromEntries(data.map((r) => [r.kelompok, Number(r.jumlah)]));
}

export type OrangPending = {
  idLama: string;
  nama: string;
  alasan: string;
  kemunculan: string[];
  /** Id V2 bila sudah ditautkan. */
  userId: string | null;
  diabaikan: boolean;
  /** Berapa catatan lama yang menggantung pada orang ini. */
  jumlah: number;
};

/**
 * Orang V1 yang menunggu keputusan.
 *
 * Mode demo menghitungnya langsung dari contoh ekspor: tidak ada tabel
 * untuk menyimpannya, dan menampilkan daftar kosong akan membuat layar
 * ini terbaca seolah tidak ada yang perlu diputuskan.
 */
export async function orangPending(): Promise<OrangPending[]> {
  if (modeData() === "demo") {
    const isi = await isiEksporLama();
    return orangDitunggu(isi, PEMETAAN_V1).map((o) => ({
      idLama: o.idLama,
      nama: "",
      alasan: `Ditunjuk ${o.jumlah} catatan tetapi tidak ada di users:list.`,
      kemunculan: o.kemunculan,
      userId: null,
      diabaikan: false,
      jumlah: o.jumlah,
    }));
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("daftar_orang_pending");
  if (error || !data) return [];

  // Berapa catatan yang menggantung dihitung ulang dari ekspornya, bukan
  // disimpan: ekspor bisa diunggah ulang, dan angka yang tersimpan akan
  // menua tanpa ada yang menyadarinya. Angka inilah yang menentukan mana
  // yang harus diputuskan lebih dulu.
  const isi = await isiEksporLama();
  const beban = new Map(
    orangDitunggu(isi, PEMETAAN_V1).map((o) => [o.idLama, o.jumlah]),
  );

  return data
    .map((o) => ({
      idLama: o.id_lama,
      nama: o.nama,
      alasan: o.alasan,
      kemunculan: o.kemunculan ?? [],
      userId: o.user_id,
      diabaikan: o.diabaikan,
      jumlah: beban.get(o.id_lama) ?? 0,
    }))
    .sort(
      (a, b) =>
        Number(Boolean(a.userId || a.diabaikan)) -
          Number(Boolean(b.userId || b.diabaikan)) ||
        b.jumlah - a.jumlah ||
        a.idLama.localeCompare(b.idLama),
    );
}

/** Anggota V2 yang bisa dipilih sebagai padanan. */
export async function calonPadanan(): Promise<
  { id: string; nama: string; email: string | null }[]
> {
  if (modeData() === "demo") {
    return dataContoh.users.map((u) => ({
      id: u.id,
      nama: u.nama,
      email: u.email,
    }));
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("users")
    .select("id, nama, email")
    .order("nama");
  if (error || !data) return [];
  return data;
}

/**
 * Seluruh kunci yang ada di ekspor, beserta golongan dan isinya.
 *
 * Dipakai layar pemetaan supaya yang meninjau melihat juga apa yang
 * TIDAK dipetakan. Daftar pemetaan saja hanya menjawab "ini menjadi
 * apa"; pertanyaan yang sama pentingnya — "apa yang tidak ikut" — tidak
 * terjawab di mana pun kalau kunci diabaikan tidak ikut ditampilkan.
 */
export async function barisKunciEkspor(): Promise<BarisUnggah[]> {
  const isi = await isiEksporLama();
  return Object.entries(isi)
    .filter(([k]) => k !== KUNCI_META)
    .map(([kunci, nilai]) => {
      const golongan = golonganKunci(kunci);
      return {
        kunci,
        golongan,
        jumlah: jumlahEntri(nilai),
        disimpan: golongan !== "diabaikan",
      };
    })
    .sort((a, b) => a.kunci.localeCompare(b.kunci));
}

/** Ringkasan penyatuan angka GMV dari ketiga sumbernya. */
export async function ringkasGmvLama() {
  const hasil = gabungGmv(await isiEksporLama());
  const r = ringkasGabungGmv(hasil);

  return {
    // Urut menurut kepercayaannya (lihat gmv-v1): rekap affiliator adalah
    // angka yang dipakai dasbor lama, laporan hanya mengisi yang tersisa.
    dipakai: [
      { sumber: "affiliate" as const, jumlah: r.affiliate },
      { sumber: "harian" as const, jumlah: r.harian },
      { sumber: "laporan" as const, jumlah: r.laporan },
    ],
    dilewati: sebabDilewati(hasil),
  };
}

/**
 * Cuplikan isi tiap kunci ekspor: dua catatan pertama, apa adanya.
 *
 * Pemetaan hanya menyebut nama medan. Apakah medan itu benar-benar
 * berisi yang dikira — tanggal yang gayanya lain, angka yang ditulis
 * sebagai teks, penunjuk yang isinya nama alih-alih id — baru kelihatan
 * dari isinya. Dua catatan cukup: yang dicari bentuknya, bukan datanya.
 */
export async function cuplikanKunci(): Promise<Record<string, string>> {
  const isi = await isiEksporLama();
  const hasil: Record<string, string> = {};

  for (const [kunci, nilai] of Object.entries(isi)) {
    if (kunci === KUNCI_META) continue;
    const contoh = Array.isArray(nilai) ? nilai.slice(0, 2) : nilai;
    const teks = JSON.stringify(contoh, null, 2);
    if (!teks) continue;
    hasil[kunci] =
      teks.length > 2500 ? `${teks.slice(0, 2500)}\n… (dipotong)` : teks;
  }

  return hasil;
}

export type RingkasKelompokJalan = {
  kelompok: string;
  diperiksa: number;
  ditulis: number;
  tertahan: number;
};

/**
 * Hasil tiap kelompok pada sebuah jalan migrasi.
 *
 * Dibaca dari `migrasi_ringkas` (0161), bukan dihitung dari catatan:
 * catatan hanya memuat yang bermasalah, jadi jumlah yang berhasil tidak
 * ada di sana sama sekali.
 */
export async function ringkasJalanKelompok(
  jalanId?: string,
): Promise<RingkasKelompokJalan[]> {
  if (modeData() === "demo") return [];

  const sb = await klienServer();
  const { data, error } = await sb.rpc("ringkas_jalan_kelompok", {
    p_jalan: jalanId ?? null,
  });
  if (error || !data) return [];

  return data.map((r) => ({
    kelompok: r.kelompok,
    diperiksa: Number(r.diperiksa),
    ditulis: Number(r.ditulis),
    tertahan: Number(r.tertahan),
  }));
}
