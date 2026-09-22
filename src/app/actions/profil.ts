"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import { periksaNama, rapikanNama } from "@/lib/profil";
import { simpanKontak } from "@/lib/data/profil";

/**
 * Mengubah nama tampilan sendiri.
 *
 * Hanya nama — bukan peran, unit, jabatan, atasan, atau email. Yang
 * menolak perubahan itu bukan kode di sini melainkan trigger
 * `jaga_ubah_diri` (migrasi 0041); action ini sengaja tidak mengirim
 * kolom-kolom tersebut sama sekali, supaya penolakan tidak pernah perlu
 * terjadi.
 */
export async function ubahNamaSaya(nama: string): Promise<Hasil> {
  const periksa = periksaNama(nama);
  if (!periksa.ok)
    return gagal(periksa.pesan ?? "Nama tidak bisa dipakai.", "validasi");

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const bersih = rapikanNama(nama);
  if (bersih === pengguna.nama) {
    return sukses(undefined, "Tidak ada yang berubah.");
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb
    .from("users")
    .update({ nama: bersih })
    .eq("id", pengguna.id);

  if (error) {
    return error.code === "42501"
      ? gagal("Perubahan ini ditolak basis data.", "izin")
      : gagal(`Gagal menyimpan nama: ${error.message}`);
  }

  segarkan();
  return sukses(undefined, "Nama tampilan diperbarui.");
}

/**
 * Menyimpan alamat foto profil yang sudah diunggah.
 *
 * Berkasnya sendiri diunggah dari browser langsung ke Supabase Storage
 * (lihat lib/data/foto-profil.ts); yang sampai ke sini hanya URL-nya.
 * Dengan begitu foto tidak perlu singgah di server aplikasi, dan batas
 * ukurannya ditentukan bucket — bukan batas badan permintaan Server
 * Action yang jauh lebih ketat.
 *
 * URL-nya tetap diperiksa: hanya alamat di dalam bucket `foto-profil`
 * yang diterima, supaya kolom ini tidak bisa dipakai menyematkan gambar
 * dari mana saja ke daftar tim.
 */
export async function ubahFotoSaya(url: string | null): Promise<Hasil> {
  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  if (url !== null && !fotoProfilSah(url, pengguna.id)) {
    return gagal("Alamat foto tidak dikenali.", "validasi");
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb
    .from("users")
    .update({ foto_url: url })
    .eq("id", pengguna.id);

  if (error) return gagal(`Gagal menyimpan foto: ${error.message}`);

  segarkan();
  return sukses(
    undefined,
    url === null ? "Foto profil dihapus." : "Foto profil diperbarui.",
  );
}

/**
 * Apakah URL ini benar-benar berkas milik orang ini di bucket foto-profil?
 *
 * Kolom `foto_url` berakhir di atribut src sebuah <img> yang dilihat
 * seluruh tim. Tanpa pemeriksaan ini, ia jadi tempat menyematkan gambar
 * dari domain mana pun — termasuk yang melacak siapa saja yang membuka
 * daftar tim.
 */
function fotoProfilSah(url: string, penggunaId: string): boolean {
  try {
    const alamat = new URL(url);
    if (alamat.protocol !== "https:") return false;
    return alamat.pathname.includes(
      `/storage/v1/object/public/foto-profil/${penggunaId}/`,
    );
  } catch {
    return false;
  }
}

/**
 * Menyimpan nomor kontak sendiri.
 *
 * Nomornya dinormalkan dulu (08…, 62…, +62… → +62…) supaya yang
 * tersimpan hanya satu bentuk: gateway WhatsApp mencari nomor secara
 * persis, dan dua tulisan untuk nomor yang sama berarti satu di
 * antaranya tidak akan pernah ketemu.
 *
 * Kolomnya ada sejak migrasi 0108, lengkap dengan CHECK yang menolak
 * apa pun di luar bentuk baku — jadi normalisasi di sini bukan satu-
 * satunya penjaga, melainkan yang membuat penolakan itu tidak perlu
 * terjadi.
 */
export async function ubahKontakSaya(mentah: string): Promise<Hasil> {
  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const hasil = await simpanKontak(pengguna, mentah);
  if (hasil.ok) segarkan();
  return hasil.ok ? sukses(undefined, hasil.pesan) : hasil;
}

function segarkan() {
  revalidatePath("/profil");
  revalidatePath("/tim");
  // Halaman preferensi menampilkan nomor tujuannya; ikut disegarkan.
  revalidatePath("/notifikasi/preferensi");
}

/**
 * Menyatakan setuju (atau menarik persetujuan) dihubungi lewat WhatsApp.
 *
 * Persetujuan hanya bisa diberikan atas nomor yang SUDAH terverifikasi.
 * Urutannya tidak boleh dibalik: setuju dihubungi di nomor yang belum
 * dibuktikan milik siapa adalah persetujuan atas nama orang lain.
 *
 * Menariknya kembali selalu boleh, tanpa syarat apa pun — persetujuan
 * yang tidak bisa dicabut bukan persetujuan.
 */
export async function ubahOptinWhatsapp(setuju: boolean): Promise<Hasil> {
  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();

  if (setuju) {
    const { data, error: galatBaca } = await sb
      .from("users")
      .select("kontak, kontak_terverifikasi_pada")
      .eq("id", pengguna.id)
      .maybeSingle();

    if (galatBaca) return gagal(`Gagal membaca profil: ${galatBaca.message}`);
    if (!data?.kontak) {
      return gagal("Isi dulu nomor kontak di halaman ini.", "validasi");
    }
    if (!data.kontak_terverifikasi_pada) {
      return gagal(
        "Nomor belum diverifikasi. Pengelola yang memverifikasinya setelah kamu mengirim pesan pertama ke nomor resmi perusahaan.",
        "validasi",
      );
    }
  }

  const { error } = await sb
    .from("users")
    .update({ whatsapp_optin: setuju })
    .eq("id", pengguna.id);

  if (error) return gagal(`Gagal menyimpan persetujuan: ${error.message}`);

  segarkan();
  return sukses(
    undefined,
    setuju
      ? "Kamu setuju dihubungi lewat WhatsApp. Bisa dicabut kapan saja."
      : "Persetujuan dicabut. Notifikasi tetap muncul di aplikasi.",
  );
}
