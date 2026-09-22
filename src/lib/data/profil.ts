import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { KOLOM_ANGGOTA, daftarAnggotaTim, keAnggota } from "@/lib/data/anggota";
import { kontakSah, normalkanKontak, type ProfilDiri } from "@/lib/profil";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import type { Pengguna } from "@/lib/types";

/**
 * Profil diri pengguna yang sedang login.
 *
 * Pemetaan unit/departemen/program/atasan TIDAK ditulis ulang di sini —
 * `keAnggota` sudah melakukannya untuk halaman /tim, dan dua salinan
 * pemetaan yang sama adalah cara paling mudah membuat halaman profil dan
 * halaman tim menyebut atasan yang berbeda untuk orang yang sama.
 *
 * Mengembalikan null bila akun Auth ini tidak punya baris di `users`.
 * Itu keadaan nyata (akun dibuat tapi profil kepegawaiannya belum), dan
 * lebih jujur ditampilkan sebagai keadaan kosong daripada ditutupi
 * dengan profil karangan dari isi sesi.
 */
export async function profilSaya(
  pengguna: Pengguna,
): Promise<ProfilDiri | null> {
  const dasar = await barisDiri(pengguna);
  if (!dasar) return null;

  const kontak = await kontakDiri(pengguna);
  const wa = await kesiapanDiri(pengguna);

  return {
    ...dasar,
    kontak,
    kontakTerverifikasiPada: wa.terverifikasiPada,
    whatsappOptin: wa.optin,
    fotoUrl: pengguna.fotoUrl,
  };
}

/**
 * Keadaan verifikasi dan persetujuan WhatsApp.
 *
 * Mode demo membacanya dari data contoh; yang tidak disebut di sana
 * berarti belum — bukan diam-diam dianggap siap. Menganggap seseorang
 * setuju dihubungi padahal ia tidak pernah menyatakannya adalah
 * kesalahan yang tidak bisa ditarik kembali setelah pesannya terkirim.
 */
async function kesiapanDiri(pengguna: Pengguna): Promise<{
  terverifikasiPada: string | null;
  optin: boolean;
}> {
  if (modeData() === "demo") {
    const u = dataContoh.users.find((x) => x.id === pengguna.id) as
      { wa_terverifikasi?: string; wa_optin?: boolean } | undefined;
    return {
      terverifikasiPada: u?.wa_terverifikasi ?? null,
      optin: u?.wa_optin === true,
    };
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("users")
    .select("kontak_terverifikasi_pada, whatsapp_optin")
    .eq("id", pengguna.id)
    .maybeSingle();

  if (error || !data) return { terverifikasiPada: null, optin: false };
  return {
    terverifikasiPada: data.kontak_terverifikasi_pada,
    optin: data.whatsapp_optin,
  };
}

async function barisDiri(pengguna: Pengguna) {
  if (modeData() === "demo") {
    return (
      (await daftarAnggotaTim(pengguna)).find((a) => a.id === pengguna.id) ??
      null
    );
  }

  // Dibaca langsung per baris, bukan dicari di daftar tim: daftar itu
  // menyaring `status = 'aktif'` untuk peran biasa, sehingga orang yang
  // baru dinonaktifkan tapi sesinya masih hidup akan melihat "profil
  // tidak ditemukan" — padahal profilnya ada, hanya statusnya berubah.
  const sb = await klienServer();
  const { data, error } = await sb
    .from("users")
    .select(KOLOM_ANGGOTA)
    .eq("id", pengguna.id)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat profil: ${error.message}`);
  if (!data) return null;

  const { count } = await sb
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("pic_user_id", pengguna.id)
    .eq("status", "aktif");

  return keAnggota(data, count ?? 0);
}

async function kontakDiri(pengguna: Pengguna): Promise<string | null> {
  if (modeData() === "demo") {
    const u = dataContoh.users.find((x) => x.id === pengguna.id);
    const mentah = u && "kontak" in u ? (u.kontak as string) : null;
    // Data contoh menuliskannya seperti orang menulis (08…, +62 …);
    // yang dipakai aplikasi selalu bentuk bakunya, sama seperti yang
    // tersimpan di basis data (CHECK users_kontak_baku, 0108).
    return mentah ? normalkanKontak(mentah) : null;
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("users")
    .select("kontak")
    .eq("id", pengguna.id)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat nomor kontak: ${error.message}`);
  return data?.kontak ?? null;
}

/**
 * Menyimpan nomor kontak seseorang.
 *
 * Ditaruh di lapisan data, bukan langsung di Server Action, karena ada
 * dua pintu masuk yang perlu berperilaku persis sama: form di halaman
 * profil dan endpoint PATCH /api/profil. Dua salinan aturan normalisasi
 * adalah cara paling mudah membuat keduanya menyimpan bentuk yang
 * berbeda untuk nomor yang sama.
 *
 * Normalisasi di sini bukan satu-satunya penjaga — CHECK
 * `users_kontak_baku` (migrasi 0108) menolak apa pun di luar bentuk
 * baku. Yang dilakukan fungsi ini adalah membuat penolakan itu tidak
 * perlu terjadi.
 */
export async function simpanKontak(
  pengguna: Pengguna,
  mentah: string,
): Promise<Hasil<{ kontak: string | null }>> {
  const kosong = mentah.trim() === "";
  if (!kosong && !kontakSah(mentah)) {
    return gagal(
      "Belum berupa nomor seluler Indonesia. Contoh: 0812-3456-7890.",
      "validasi",
    );
  }

  const baku = kosong ? null : normalkanKontak(mentah);

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb
    .from("users")
    .update({ kontak: baku })
    .eq("id", pengguna.id);

  if (error) {
    return error.code === "23514"
      ? gagal(
          "Nomor itu ditolak basis data; periksa lagi angkanya.",
          "validasi",
        )
      : gagal(`Gagal menyimpan nomor: ${error.message}`);
  }

  return sukses(
    { kontak: baku },
    baku === null
      ? "Nomor kontak dihapus. Pemberitahuan tetap muncul di dalam aplikasi."
      : `Nomor kontak disimpan sebagai ${baku}.`,
  );
}

/**
 * Keadaan kontak seorang ANGGOTA — untuk halaman /tim/[id].
 *
 * Yang dikembalikan hanya nomor dan status verifikasinya, bukan
 * profilnya: pengelola perlu keduanya untuk memutuskan verifikasi, dan
 * tidak perlu apa pun lagi dari kotak masuk orang itu.
 *
 * RLS pada `users` yang menentukan siapa boleh membacanya; tidak ada
 * pemeriksaan peran yang ditulis ulang di sini.
 */
export async function kontakAnggota(userId: string): Promise<{
  kontak: string | null;
  terverifikasi: boolean;
}> {
  if (modeData() === "demo") {
    const u = dataContoh.users.find((x) => x.id === userId) as
      { kontak?: string; wa_terverifikasi?: string } | undefined;
    return {
      kontak: u?.kontak ? (normalkanKontak(u.kontak) ?? null) : null,
      terverifikasi: Boolean(u?.wa_terverifikasi),
    };
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("users")
    .select("kontak, kontak_terverifikasi_pada")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return { kontak: null, terverifikasi: false };
  return {
    kontak: data.kontak,
    terverifikasi: data.kontak_terverifikasi_pada !== null,
  };
}
