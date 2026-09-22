"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { bolehKelolaSampel, sampelDariKode } from "@/lib/data/sampel";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import { normalkanKode, tautanProdukSah } from "@/lib/sampel";
import type { Sampel, StatusSampel } from "@/lib/sampel";
import type { KodeUnit } from "@/lib/types";

/**
 * Mengganti tautan etalase produk sebuah sampel.
 *
 * Berdiri sendiri, terpisah dari form penyuntingan penuh: mengganti link
 * adalah pekerjaan sehari-hari yang dilakukan orang yang sedang membuka
 * produknya, sementara menyunting nama dan nilainya jauh lebih jarang.
 * Yang penting: stiker QR tidak ikut berubah, jadi barangnya tidak perlu
 * dicetak ulang.
 */
export async function ubahTautanProduk(
  sampelId: string,
  tautan: string,
): Promise<Hasil> {
  if (!sampelId) return gagal("Sampel tidak dikenali.", "validasi");

  const bersih = tautan.trim();
  if (bersih !== "" && !tautanProdukSah(bersih)) {
    return gagal("Tautan harus diawali http:// atau https://.", "validasi");
  }
  if (bersih.length > 300) {
    return gagal("Tautan terlalu panjang, periksa lagi.", "validasi");
  }

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb
    .from("samples")
    .update({ link_produk: bersih || null })
    .eq("id", sampelId);

  if (error) {
    return error.code === "42501"
      ? gagal("Hanya CEO atau Manager yang boleh mengubah sampel.", "izin")
      : gagal(`Gagal menyimpan tautan: ${error.message}`);
  }

  segarkan();
  return sukses(
    undefined,
    bersih === ""
      ? "Tautan produk dihapus; stiker QR-nya tetap berlaku."
      : "Tautan produk diperbarui; stiker QR-nya tidak perlu dicetak ulang.",
  );
}

/** Kode QR: huruf, angka, dan tanda hubung — mudah dibaca pemindai. */
const POLA_KODE = /^[A-Z0-9][A-Z0-9-]{2,29}$/i;

export type MasukanSampel = {
  kode: string;
  nama: string;
  kategori: string;
  unitKode: KodeUnit | null;
  /** Akun affiliator yang memakainya; database menjaga agar se-unit. */
  akunId: string | null;
  nilai: number;
  /** Brand atau seller pemilik produk. */
  brand: string;
  /** Kreator/PIC yang memegang atau memakai sampelnya. */
  kreator: string;
  /** Tautan etalase produk (TikTok Shop / Shopee). */
  linkProduk: string;
  catatan: string;
};

function periksa(input: MasukanSampel): string | null {
  // Kode boleh kosong: artinya minta dibangkitkan berurutan (0081).
  if (input.kode.trim() !== "" && !POLA_KODE.test(input.kode.trim())) {
    return "Kode terdiri dari 3–30 huruf, angka, atau tanda hubung.";
  }
  if (input.nama.trim().length < 3) return "Nama sampel minimal 3 huruf.";
  if (!Number.isFinite(input.nilai) || input.nilai < 0) {
    return "Nilai sampel tidak sah.";
  }
  if (input.nilai > 1_000_000_000) {
    return "Nilai di luar batas wajar, periksa lagi.";
  }
  if (input.linkProduk.trim() !== "" && !tautanProdukSah(input.linkProduk)) {
    return "Tautan produk harus diawali http:// atau https://.";
  }
  return null;
}

function segarkan() {
  revalidatePath("/sampel");
}

async function idUnit(kode: KodeUnit | null) {
  if (!kode) return null;
  const sb = await klienServer();
  const { data } = await sb
    .from("units")
    .select("id")
    .eq("kode", kode)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Tambah sampel baru.
 *
 * Sampel selalu lahir dalam keadaan 'tersedia' di gudang; statusnya
 * setelah itu hanya berubah lewat pencatatan perpindahan, tidak pernah
 * disetel langsung. Kalau boleh disetel, riwayatnya akan berbohong.
 */
export async function tambahSampel(input: MasukanSampel): Promise<Hasil> {
  const salah = periksa(input);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaSampel(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh menambah sampel.", "izin");
  }

  const sb = await klienServer();
  const unitId = await idUnit(input.unitKode);
  if (!unitId)
    return gagal("Sampel harus ditempatkan di sebuah unit.", "validasi");

  const kode = input.kode.trim().toUpperCase();

  // Tanpa kode, database yang membangkitkannya berurutan sekaligus
  // menyisipkan barisnya — dua orang yang menambah bersamaan tidak
  // pernah mendapat kode yang sama.
  if (kode === "") {
    const { data, error } = await sb.rpc("buat_sampel", {
      p_nama: input.nama.trim(),
      p_unit: unitId,
      p_kategori: input.kategori.trim(),
      p_nilai: input.nilai,
      p_catatan: input.catatan.trim().slice(0, 300),
    });

    if (error) {
      return error.code === "42501"
        ? gagal("Kamu tidak berhak menambah sampel.", "izin")
        : gagal(error.message, "validasi");
    }

    if (input.akunId && data?.id) {
      const { error: galatAkun } = await sb
        .from("samples")
        .update({ account_id: input.akunId })
        .eq("id", data.id);
      if (galatAkun) return gagal(galatAkun.message, "validasi");
    }

    segarkan();
    return sukses(undefined, `Sampel ${data?.kode ?? ""} ditambahkan.`);
  }

  const { error } = await sb.from("samples").insert({
    kode,
    nama: input.nama.trim(),
    kategori: input.kategori.trim(),
    unit_id: unitId,
    account_id: input.akunId,
    nilai: input.nilai,
    kreator: input.kreator.trim().slice(0, 80),
    brand: input.brand.trim().slice(0, 80),
    link_produk: input.linkProduk.trim() || null,
    catatan: input.catatan.trim().slice(0, 300),
  });

  if (error) {
    if (error.code === "23505") {
      return gagal("Kode itu sudah dipakai sampel lain.", "validasi");
    }
    return error.code === "42501"
      ? gagal("Kamu tidak berhak menambah sampel.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkan();
  return sukses(undefined, `Sampel ${kode} ditambahkan.`);
}

/**
 * Ubah keterangan sampel.
 *
 * Statusnya sengaja tidak ikut di sini — ia hanya berubah lewat
 * pencatatan perpindahan, supaya riwayatnya selalu cocok dengan
 * keadaannya.
 */
export async function ubahSampel(
  id: string,
  input: MasukanSampel,
): Promise<Hasil> {
  if (!id) return gagal("Sampel tidak dikenali.", "validasi");
  const salah = periksa(input);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaSampel(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh mengubah sampel.", "izin");
  }

  const sb = await klienServer();
  const { error } = await sb
    .from("samples")
    .update({
      kode: input.kode.trim().toUpperCase(),
      nama: input.nama.trim(),
      kategori: input.kategori.trim(),
      unit_id: await idUnit(input.unitKode),
      account_id: input.akunId,
      nilai: input.nilai,
      kreator: input.kreator.trim().slice(0, 80),
      brand: input.brand.trim().slice(0, 80),
      link_produk: input.linkProduk.trim() || null,
      catatan: input.catatan.trim().slice(0, 300),
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return gagal("Kode itu sudah dipakai sampel lain.", "validasi");
    }
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah sampel ini.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkan();
  return sukses(undefined, "Keterangan sampel diperbarui.");
}

/**
 * Cari sampel dari kode QR-nya.
 *
 * Dipakai pemindai maupun pengetikan manual, jadi kodenya dirapikan
 * dulu: pembaca QR kerap menyertakan spasi atau mengembalikan huruf
 * dengan besar-kecil yang berbeda dari stikernya.
 */
export async function cariSampel(kode: string): Promise<Hasil<Sampel>> {
  const mentah = kode.trim().slice(0, 300);
  if (!mentah) return gagal("Kode kosong.", "validasi");

  // Yang dicatat sebagai kode adalah hasil normalisasinya bila terbaca,
  // dan isi mentahnya bila tidak — supaya kode asing yang berulang bisa
  // dikenali bentuknya, bukan sekadar "tidak dikenali".
  const bersih = normalkanKode(mentah) || mentah.slice(0, 60);

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sampel = await sampelDariKode(pengguna, mentah);

  // Pemindaian dicatat apa adanya — termasuk yang tidak dikenali, sebab
  // kode asing yang berulang justru yang menunjukkan label tertukar
  // atau stiker lama yang masih beredar (0080).
  await catatPemindaian(pengguna.id, bersih, sampel?.id ?? null);

  if (!sampel) {
    return gagal(
      `Kode ${bersih} tidak ditemukan, atau bukan sampel yang boleh kamu lihat.`,
      "validasi",
    );
  }

  return sukses(sampel);
}

/** Menyimpan satu baris riwayat pemindaian; kegagalannya tidak menghalangi. */
async function catatPemindaian(
  olehId: string,
  kode: string,
  sampelId: string | null,
) {
  if (modeData() === "demo") return;

  const sb = await klienServer();
  await sb.from("sample_scans").insert({
    kode: kode.slice(0, 60),
    sample_id: sampelId,
    oleh_id: olehId,
    dikenali: sampelId !== null,
  });
}

/**
 * Catat perpindahan sampel.
 *
 * Inilah satu-satunya cara status sampel berubah (migrasi 0049): setiap
 * perubahan meninggalkan jejak siapa, kapan, dan ke tangan siapa. Tanpa
 * itu, pertanyaan "sekarang ada di siapa" tidak pernah bisa dijawab
 * dengan pasti.
 */
export async function catatPerpindahan(input: {
  sampelId: string;
  ke: StatusSampel;
  pemegangId?: string | null;
  kreator?: string;
  catatan?: string;
}): Promise<Hasil> {
  if (!input.sampelId) return gagal("Sampel tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  if (input.ke === "dipegang" && !input.pemegangId) {
    return gagal("Pilih dulu siapa yang memegangnya.", "validasi");
  }
  if (
    (input.ke === "dikirim" || input.ke === "diterima") &&
    !(input.kreator ?? "").trim()
  ) {
    return gagal("Sebutkan kreator tujuannya.", "validasi");
  }
  if (input.ke === "hilang" && (input.catatan ?? "").trim().length < 10) {
    // Barang hilang selalu perlu keterangan; tanpa itu jejaknya tidak
    // menolong siapa pun saat ditelusuri kemudian.
    return gagal(
      "Tulis keterangan singkat (minimal 10 huruf) tentang bagaimana hilangnya.",
      "validasi",
    );
  }

  const sb = await klienServer();
  const { data: kejadian, error } = await sb
    .from("sample_events")
    .insert({
      sample_id: input.sampelId,
      ke: input.ke,
      oleh_id: pengguna.id,
      pemegang_id: input.pemegangId ?? null,
      kreator: (input.kreator ?? "").trim().slice(0, 80),
      catatan: (input.catatan ?? "").trim().slice(0, 300),
    })
    .select("id")
    .single();

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mencatat perpindahan sampel ini.", "izin")
      : gagal(error.message, "validasi");
  }

  // Pemindaian terakhir orang ini atas sampel yang sama disambungkan ke
  // perpindahannya, supaya riwayat scan bisa dibaca sebagai "dipindai,
  // lalu dipindahkan" — bukan dua catatan yang tidak berhubungan.
  if (kejadian) {
    const { data: scan } = await sb
      .from("sample_scans")
      .select("id")
      .eq("sample_id", input.sampelId)
      .eq("oleh_id", pengguna.id)
      .is("kejadian_id", null)
      .order("pada", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (scan) {
      await sb
        .from("sample_scans")
        .update({ kejadian_id: kejadian.id })
        .eq("id", scan.id);
    }
  }

  revalidatePath("/sampel");
  revalidatePath("/sampel/riwayat");
  revalidatePath(`/sampel/${encodeURIComponent(input.sampelId)}`);
  return sukses(undefined, "Perpindahan tercatat.");
}

/**
 * Hapus sampel yang salah dibuat.
 *
 * Hanya untuk barang yang belum pernah menyentuh apa pun — belum pernah
 * berpindah, belum pernah dipindai, dan masih di gudang. Sampel yang
 * sudah berjejak tidak dihapus melainkan ditandai hilang atau
 * dikembalikan, supaya riwayatnya tetap bisa ditelusuri (0082).
 */
export async function hapusSampel(id: string): Promise<Hasil> {
  if (!id) return gagal("Sampel tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaSampel(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh menghapus sampel.", "izin");
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("samples")
    .delete()
    .eq("id", id)
    .select("kode");

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak menghapus sampel ini.", "izin")
      : gagal(error.message, "validasi");
  }
  if (!data || data.length === 0) {
    // Penolakan trigger pada BEFORE DELETE bisa tampil sebagai
    // penghapusan yang tidak mengenai baris apa pun.
    return gagal(
      "Sampel itu tidak bisa dihapus — kemungkinan sudah punya riwayat perpindahan atau pemindaian.",
      "validasi",
    );
  }

  segarkan();
  revalidatePath("/sampel/riwayat");
  return sukses(undefined, `Sampel ${data[0].kode} dihapus.`);
}
