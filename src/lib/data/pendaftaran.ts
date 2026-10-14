// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { bolehKelolaAnggota, daftarAnggotaTim } from "@/lib/data/anggota";
import type {
  BarisPendaftaranAkun,
  StatusAkses,
  StatusPendaftaranDb,
} from "@/lib/supabase/types";
import type { AnggotaTim, Pengguna } from "@/lib/types";

/** Satu pendaftaran seperti yang dibaca layar. */
export type Pendaftaran = {
  id: string;
  email: string;
  namaGoogle: string;
  fotoUrl: string | null;
  noWa: string | null;
  unitDiajukan: string | null;
  catatan: string | null;
  status: StatusPendaftaranDb;
  diputuskanOleh: string | null;
  diputuskanPada: string | null;
  alasanTolak: string | null;
  cara: "baru" | "sambung" | null;
  dibuatPada: string;
};

function kePendaftaran(
  b: BarisPendaftaranAkun,
  nama: Map<string, string>,
): Pendaftaran {
  return {
    id: b.id,
    email: b.email,
    namaGoogle: b.nama_google,
    fotoUrl: b.foto_url,
    noWa: b.no_wa,
    unitDiajukan: b.unit_diajukan,
    catatan: b.catatan,
    status: b.status,
    diputuskanOleh: b.diputuskan_oleh
      ? (nama.get(b.diputuskan_oleh) ?? null)
      : null,
    diputuskanPada: b.diputuskan_pada,
    alasanTolak: b.alasan_tolak,
    cara: b.cara,
    dibuatPada: b.dibuat_pada,
  };
}

/**
 * Akun yang sedang login: status aksesnya dan, bila ada, pendaftarannya.
 * Dipakai layar /menunggu — akun di sana tidak punya profil aktif,
 * jadi `sesiSaatIni()` memang kosong.
 */
export async function keadaanAkunSaya(): Promise<{
  email: string;
  status: StatusAkses | null;
  pendaftaran: Pendaftaran | null;
} | null> {
  if (modeData() === "demo") return null;

  const sb = await klienServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const [{ data: status }, { data: baris }] = await Promise.all([
    sb.rpc("status_akses_saya"),
    sb.from("pendaftaran_akun").select("*").eq("id", user.id).maybeSingle(),
  ]);

  return {
    email: user.email ?? "",
    status: status ?? null,
    pendaftaran: baris ? kePendaftaran(baris, new Map()) : null,
  };
}

/** Daftar pendaftaran satu status — hanya CEO/Manager (RLS 0209 juga). */
export async function daftarPendaftaran(
  pengguna: Pengguna,
  status: StatusPendaftaranDb,
): Promise<Pendaftaran[]> {
  if (!bolehKelolaAnggota(pengguna) || modeData() === "demo") return [];

  const sb = await klienServer();
  const { data, error } = await sb
    .from("pendaftaran_akun")
    .select("*")
    .eq("status", status)
    .order(status === "menunggu" ? "dibuat_pada" : "diputuskan_pada", {
      ascending: status === "menunggu",
    })
    .limit(200);
  if (error) throw new Error(`Gagal memuat pendaftaran: ${error.message}`);

  const pemutus = [
    ...new Set((data ?? []).map((d) => d.diputuskan_oleh).filter(Boolean)),
  ] as string[];
  const nama = new Map<string, string>();
  if (pemutus.length > 0) {
    const { data: orang } = await sb
      .from("users")
      .select("id, nama")
      .in("id", pemutus);
    for (const o of orang ?? []) nama.set(o.id, o.nama);
  }

  return (data ?? []).map((d) => kePendaftaran(d, nama));
}

/** Angka badge menu Tim: pendaftaran yang menunggu. 0 bagi selain CEO/Manager. */
export async function jumlahPendaftaranMenunggu(
  pengguna: Pengguna,
): Promise<number> {
  if (!bolehKelolaAnggota(pengguna) || modeData() === "demo") return 0;

  const sb = await klienServer();
  const { count, error } = await sb
    .from("pendaftaran_akun")
    .select("id", { count: "exact", head: true })
    .eq("status", "menunggu");
  // Badge bukan hal yang layak menjatuhkan seluruh halaman.
  if (error) return 0;
  return count ?? 0;
}

/**
 * Profil yang boleh dipilih untuk "Sambungkan": aktif dan belum punya
 * akun login (BR-05). `null` bila daftar akun login tak terbaca —
 * layar lalu menampilkan semua profil aktif dan database yang menolak
 * profil yang ternyata sudah punya akun (E3).
 */
export async function profilBisaDisambung(
  pengguna: Pengguna,
): Promise<AnggotaTim[]> {
  const semua = await daftarAnggotaTim(pengguna);
  return semua
    .filter((a) => a.status === "aktif" && a.punyaLogin !== true)
    .sort((a, b) => a.nama.localeCompare(b.nama));
}

/**
 * Identitas Google yang tersambung ke akun yang sedang login.
 * `null` = belum tersambung (atau mode demo).
 */
export async function googleTersambung(): Promise<{ email: string } | null> {
  if (modeData() === "demo") return null;
  const sb = await klienServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const google = user?.identities?.find((i) => i.provider === "google");
  if (!google) return null;
  const email = google.identity_data?.email;
  return { email: typeof email === "string" ? email : "" };
}
