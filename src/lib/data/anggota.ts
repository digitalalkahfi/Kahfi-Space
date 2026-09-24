// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { inisialDari } from "@/lib/data/sesi";
import { URUTAN_PERAN } from "@/lib/peran";
import type { AnggotaTim, KodeUnit, Peran, Pengguna } from "@/lib/types";

// Tipe domainnya tinggal di modul murni; diekspor ulang di sini agar
// pemanggil sisi server tidak perlu tahu perbedaannya.
export type { AnggotaTim };

/**
 * Relasi ke tabel yang sama (users → atasan) tidak bisa dipastikan
 * tunggal oleh supabase-js, jadi hasilnya bisa berupa larik berisi satu.
 */
function satu<T>(nilai: T | T[] | null | undefined): T | null {
  if (!nilai) return null;
  return Array.isArray(nilai) ? (nilai[0] ?? null) : nilai;
}

/** Hanya CEO dan Manager yang boleh mengubah data anggota (policy `users_kelola`). */
export function bolehKelolaAnggota(pengguna: Pengguna) {
  return pengguna.role === "CEO" || pengguna.role === "Manager";
}

/**
 * Daftar anggota tim yang terlihat pengguna.
 *
 * Anggota nonaktif ikut ditampilkan bagi yang berwenang: mereka tetap
 * memiliki riwayat, dan menyembunyikannya membuat orang mengira datanya
 * hilang. Bagi yang tidak berwenang, hanya anggota aktif yang relevan.
 */
/** Departemen seorang anggota di mode demo: miliknya sendiri, atau unitnya. */
function namaDepartemen(u: { unit?: string | null; departemen?: string }) {
  if ("departemen" in u && u.departemen) return u.departemen;
  if (!u.unit) return null;
  return dataContoh.units.find((x) => x.kode === u.unit)?.department ?? null;
}

/** Id semu departemen di mode demo — urutannya sama dengan pilihan organisasi. */
function departemenId(u: { unit?: string | null; departemen?: string }) {
  const nama = namaDepartemen(u);
  if (!nama) return null;
  const i = dataContoh.departments.findIndex((d) => d.nama === nama);
  return i < 0 ? null : `contoh-dep-${i}`;
}

export async function daftarAnggotaTim(
  pengguna: Pengguna,
): Promise<AnggotaTim[]> {
  const bolehLihatNonaktif = bolehKelolaAnggota(pengguna);

  if (modeData() === "demo") return anggotaDemo(bolehLihatNonaktif);

  const sb = await klienServer();
  const permintaan = sb.from("users").select(KOLOM_ANGGOTA).order("nama");

  const { data, error } = bolehLihatNonaktif
    ? await permintaan
    : await permintaan.eq("status", "aktif");

  if (error) throw new Error(`Gagal memuat anggota tim: ${error.message}`);

  const { data: akun } = await sb
    .from("accounts")
    .select("pic_user_id")
    .eq("status", "aktif");

  const beban = new Map<string, number>();
  for (const a of akun ?? []) {
    if (!a.pic_user_id) continue;
    beban.set(a.pic_user_id, (beban.get(a.pic_user_id) ?? 0) + 1);
  }

  return (data ?? []).map((u) => keAnggota(u, beban.get(u.id) ?? 0));
}

/**
 * Pilihan kolom untuk sebuah baris anggota.
 *
 * Ditulis sekali dan dipakai dua tempat — daftar tim dan profil diri —
 * karena dua salinan pilihan kolom adalah cara paling mudah membuat
 * kedua halaman menampilkan atasan yang berbeda untuk orang yang sama.
 *
 * Atasan disematkan lewat KOLOM kunci asingnya (`atasan_id (…)`), bukan
 * lewat nama tabel. `users` merujuk ke `users` sendiri, dan petunjuk
 * bernama tabel (`users!atasan_id`) dibaca PostgREST sebagai arah
 * sebaliknya: daftar bawahan — sehingga bawahan pertama tampil sebagai
 * "atasan". Petunjuk bernama kendala bergantung pada nama kendala di
 * basis data yang ternyata berbeda di produksi.
 */
export const KOLOM_ANGGOTA = `id, nama, email, role, jabatan, status,
   unit:units (kode, nama),
   departemen:departments (id, nama),
   program:programs (id, nama),
   atasan:atasan_id (id, nama)` as const;

type BarisAnggota = {
  id: string;
  nama: string;
  email: string | null;
  role: string;
  jabatan: string;
  status: string;
  unit: { kode: string; nama: string } | null;
  departemen: { id: string; nama: string } | null;
  program: { id: string; nama: string } | null;
  atasan: { id: string; nama: string } | { id: string; nama: string }[] | null;
};

/** Satu baris `users` → bentuk domain yang dipakai seluruh aplikasi. */
export function keAnggota(u: BarisAnggota, akunDipegang: number): AnggotaTim {
  return {
    id: u.id,
    nama: u.nama,
    email: u.email ?? "",
    role: u.role as Peran,
    jabatan: u.jabatan,
    unitKode: (u.unit?.kode as KodeUnit) ?? null,
    unitNama: u.unit?.nama ? u.unit.nama.split(" (")[0] : "Manajemen",
    departemenId: u.departemen?.id ?? null,
    departemen: u.departemen?.nama ?? null,
    programId: u.program?.id ?? null,
    program: u.program?.nama ?? null,
    atasanId: satu(u.atasan)?.id ?? null,
    atasanNama: satu(u.atasan)?.nama ?? null,
    inisial: inisialDari(u.nama),
    status: u.status as "aktif" | "nonaktif",
    akunDipegang,
  };
}

/** Dikelompokkan per unit, karena begitulah tim ini bekerja sehari-hari. */
export function kelompokkanPerUnit(daftar: AnggotaTim[]) {
  const peta = new Map<string, AnggotaTim[]>();
  for (const a of daftar) {
    peta.set(a.unitNama, [...(peta.get(a.unitNama) ?? []), a]);
  }

  return (
    [...peta.entries()]
      .map(([unit, anggota]) => ({
        unit,
        unitKode: anggota[0]?.unitKode ?? null,
        anggota: [...anggota].sort(
          (a, b) =>
            URUTAN_PERAN.indexOf(a.role) - URUTAN_PERAN.indexOf(b.role) ||
            a.nama.localeCompare(b.nama),
        ),
      }))
      // Manajemen selalu di atas, sisanya menurut abjad unit.
      .sort((a, b) => {
        if (a.unit === "Manajemen") return -1;
        if (b.unit === "Manajemen") return 1;
        return a.unit.localeCompare(b.unit);
      })
  );
}

// ---------------------------------------------------------------------
// Mode demo
// ---------------------------------------------------------------------
function anggotaDemo(bolehLihatNonaktif: boolean): AnggotaTim[] {
  const { users, units, accounts } = dataContoh;

  const beban = new Map<string, number>();
  for (const a of accounts) {
    beban.set(a.pic, (beban.get(a.pic) ?? 0) + 1);
  }

  return users
    .filter(
      (u) =>
        bolehLihatNonaktif || ("status" in u ? u.status : "aktif") === "aktif",
    )
    .map((u) => ({
      id: u.id,
      nama: u.nama,
      email: u.email ?? "",
      role: u.role as Peran,
      jabatan: u.jabatan,
      unitKode: (u.unit as KodeUnit) ?? null,
      unitNama: u.unit
        ? (units.find((x) => x.kode === u.unit)?.nama.split(" (")[0] ?? "—")
        : "Manajemen",
      // Paritas dengan basis data: departemen ikut unit kecuali disebut
      // sendiri (mis. Mabit Scholar), sama seperti trigger 0068.
      departemenId: departemenId(u),
      departemen: namaDepartemen(u),
      programId:
        dataContoh.programs.find(
          (p) => p.nama === ("program" in u ? u.program : null),
        )?.id ?? null,
      program: "program" in u ? (u.program ?? null) : null,
      atasanId: u.atasan
        ? (users.find((x) => x.nama === u.atasan)?.id ?? null)
        : null,
      atasanNama: u.atasan ?? null,
      inisial: u.inisial,
      status: ("status" in u ? u.status : "aktif") as "aktif" | "nonaktif",
      akunDipegang: beban.get(u.nama) ?? 0,
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama));
}

export type JejakAnggota = {
  id: string;
  aksi: "insert" | "update" | "delete";
  waktu: string;
  olehNama: string | null;
  /** Hanya kolom yang benar-benar berubah, sudah berbentuk kalimat. */
  perubahan: { label: string; dari: string; ke: string }[];
};

const LABEL_KOLOM: Record<string, string> = {
  nama: "Nama",
  email: "Email",
  role: "Peran",
  jabatan: "Jabatan",
  unit_id: "Unit",
  department_id: "Departemen",
  program_id: "Program",
  atasan_id: "Atasan",
  status: "Status",
};

/**
 * Riwayat perubahan data seorang anggota.
 *
 * Jejaknya ditulis trigger `users_audit` (0072) berisi cuplikan kolom
 * sebelum dan sesudah. Di sini cuplikan itu diterjemahkan menjadi
 * perubahan per kolom — id unit, departemen, program, dan atasan diganti
 * namanya, karena uuid tidak berarti apa pun bagi yang membacanya.
 */
export async function jejakAnggota(
  anggotaId: string,
  batas = 20,
): Promise<JejakAnggota[]> {
  if (modeData() === "demo") return [];

  const sb = await klienServer();
  const { data, error } = await sb
    .from("audit_logs")
    .select("id, aksi, created_at, nilai_lama, nilai_baru, oleh:user_id (nama)")
    .eq("entitas", "users")
    .eq("entitas_id", anggotaId)
    .order("created_at", { ascending: false })
    .limit(batas);

  // Jejak hanya terbuka untuk pengelola angka; bagi yang lain kosong
  // bukan galat.
  if (error) return [];

  const perluNama = new Set<string>();
  for (const baris of data ?? []) {
    for (const sisi of [baris.nilai_lama, baris.nilai_baru]) {
      const nilai = (sisi ?? {}) as Record<string, string | null>;
      for (const kolom of [
        "unit_id",
        "department_id",
        "program_id",
        "atasan_id",
      ]) {
        const v = nilai[kolom];
        if (v) perluNama.add(v);
      }
    }
  }

  const nama = new Map<string, string>();
  if (perluNama.size > 0) {
    const daftar = [...perluNama];
    const [unit, departemen, program, orang] = await Promise.all([
      sb.from("units").select("id, nama").in("id", daftar),
      sb.from("departments").select("id, nama").in("id", daftar),
      sb.from("programs").select("id, nama").in("id", daftar),
      sb.from("users").select("id, nama").in("id", daftar),
    ]);
    for (const kumpulan of [
      unit.data,
      departemen.data,
      program.data,
      orang.data,
    ]) {
      for (const baris of kumpulan ?? []) nama.set(baris.id, baris.nama);
    }
  }

  const tampil = (kolom: string, nilai: string | null | undefined) => {
    if (nilai === null || nilai === undefined || nilai === "") return "—";
    return kolom.endsWith("_id") ? (nama.get(nilai) ?? "—") : nilai;
  };

  return (data ?? []).map((baris) => {
    const lama = (baris.nilai_lama ?? {}) as Record<string, string | null>;
    const baru = (baris.nilai_baru ?? {}) as Record<string, string | null>;

    const perubahan = Object.keys(LABEL_KOLOM)
      .filter((k) => (lama[k] ?? null) !== (baru[k] ?? null))
      .map((k) => ({
        label: LABEL_KOLOM[k],
        dari: tampil(k, lama[k]),
        ke: tampil(k, baru[k]),
      }));

    return {
      id: baris.id,
      aksi: baris.aksi as JejakAnggota["aksi"],
      waktu: baris.created_at,
      olehNama:
        (baris.oleh as unknown as { nama: string } | null)?.nama ?? null,
      perubahan,
    };
  });
}
