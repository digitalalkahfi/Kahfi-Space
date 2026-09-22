"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { bolehKelolaAnggota } from "@/lib/data/anggota";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import { peranSah, peringkatPeran } from "@/lib/peran";
import type { KodeUnit, Peran } from "@/lib/types";

const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Peran yang memang bertugas di sebuah unit. */
const PERAN_BERUNIT: Peran[] = ["Leader", "Co-Leader", "Staff"];

type MasukanAnggota = {
  nama: string;
  email: string;
  role: Peran;
  jabatan: string;
  unitKode: KodeUnit | null;
  departemenId: string | null;
  programId: string | null;
};

function periksa(input: MasukanAnggota): string | null {
  if (input.nama.trim().length < 3) return "Nama minimal 3 huruf.";
  if (!POLA_EMAIL.test(input.email.trim())) return "Format email tidak sah.";
  if (!peranSah(input.role)) return "Peran tidak dikenali.";
  if (input.jabatan.trim().length < 3) return "Jabatan minimal 3 huruf.";

  // Unit menentukan cakupan RLS; Leader tanpa unit tidak akan melihat
  // siapa pun, dan Staff tanpa unit tidak bisa ditagih laporan.
  if (PERAN_BERUNIT.includes(input.role) && !input.unitKode) {
    return `${input.role} wajib ditempatkan di salah satu unit.`;
  }
  if (!PERAN_BERUNIT.includes(input.role) && input.unitKode) {
    return `${input.role} bekerja lintas unit, jadi tidak ditempatkan di satu unit.`;
  }
  if (input.programId && !input.unitKode) {
    return "Program menempel pada satu unit, jadi unitnya harus dipilih dulu.";
  }
  return null;
}

async function idUnit(kode: KodeUnit | null) {
  if (!kode) return null;
  const sb = await klienServer();
  const { data } = await sb.from("units").select("id").eq("kode", kode).maybeSingle();
  return data?.id ?? null;
}

function segarkan() {
  revalidatePath("/tim");
  revalidatePath("/beranda");
}

/**
 * Tambah anggota baru.
 *
 * Yang dibuat di sini hanya baris profil, bukan akun Supabase Auth —
 * aplikasi ini sengaja tidak pernah memegang kata sandi siapa pun.
 * Orangnya mendaftar sendiri lewat Auth memakai email yang sama, lalu
 * `supabase/auth.sql` menyatukan id profilnya dengan id Auth.
 */
export async function tambahAnggota(input: MasukanAnggota): Promise<Hasil> {
  const salah = periksa(input);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAnggota(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh menambah anggota.", "izin");
  }

  const sb = await klienServer();
  const { error } = await sb.from("users").insert({
    // `users.id` mengikuti `auth.users.id` dan karena itu tidak punya
    // nilai bawaan. Profil yang dibuat lebih dulu memakai id sementara;
    // saat orangnya mendaftar dengan email yang sama, `supabase/auth.sql`
    // menyamakan idnya dengan id Auth dan seluruh baris anak ikut terbawa
    // lewat foreign key on update cascade.
    id: crypto.randomUUID(),
    nama: input.nama.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    jabatan: input.jabatan.trim(),
    unit_id: await idUnit(input.unitKode),
    department_id: input.departemenId,
    program_id: input.programId,
    status: "aktif",
  });

  if (error) {
    if (error.code === "23505") {
      return gagal("Email itu sudah terdaftar.", "validasi");
    }
    return error.code === "42501"
      ? gagal("Kamu tidak berhak menambah anggota.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkan();
  return sukses(
    undefined,
    `${input.nama.trim()} ditambahkan. Ia bisa masuk setelah mendaftar dengan email tersebut.`,
  );
}

/** Ubah data anggota yang sudah ada. */
export async function ubahAnggota(
  id: string,
  input: MasukanAnggota,
): Promise<Hasil> {
  if (!id) return gagal("Anggota tidak dikenali.", "validasi");
  const salah = periksa(input);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAnggota(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh mengubah anggota.", "izin");
  }

  const sb = await klienServer();
  const { error } = await sb
    .from("users")
    .update({
      nama: input.nama.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      jabatan: input.jabatan.trim(),
      unit_id: await idUnit(input.unitKode),
      department_id: input.departemenId,
      program_id: input.programId,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return gagal("Email itu sudah dipakai anggota lain.", "validasi");
    if (error.code === "42501") return gagal("Kamu tidak berhak mengubah anggota ini.", "izin");
    // Pesan trigger penjaga pengelola terakhir diteruskan apa adanya.
    return gagal(error.message, "validasi");
  }

  segarkan();
  return sukses(undefined, "Data anggota diperbarui.");
}

/**
 * Aktifkan atau nonaktifkan anggota.
 * Anggota dinonaktifkan, bukan dihapus, supaya laporan, absensi, dan
 * riwayat KPI-nya tetap utuh.
 */
export async function ubahStatusAnggota(
  id: string,
  status: "aktif" | "nonaktif",
): Promise<Hasil> {
  if (!id) return gagal("Anggota tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAnggota(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh mengubah anggota.", "izin");
  }

  const sb = await klienServer();
  const { error } = await sb.from("users").update({ status }).eq("id", id);

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah anggota ini.", "izin")
      : gagal(error.message, "validasi");
  }

  segarkan();
  return sukses(
    undefined,
    status === "aktif"
      ? "Anggota diaktifkan kembali."
      : "Anggota dinonaktifkan; seluruh riwayatnya tetap tersimpan.",
  );
}

/**
 * Tetapkan atau lepaskan atasan seseorang.
 *
 * Atasan menentukan siapa yang boleh menugasi dan menyetujui izinnya,
 * jadi perubahannya berdiri sendiri — tidak ikut tenggelam di form data
 * diri. Rantai yang berputar ditolak database (migrasi 0044).
 */
export async function ubahAtasan(
  id: string,
  atasanId: string | null,
): Promise<Hasil> {
  if (!id) return gagal("Anggota tidak dikenali.", "validasi");
  if (atasanId === id) {
    return gagal("Seseorang tidak bisa menjadi atasan dirinya sendiri.", "validasi");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAnggota(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh mengubah atasan.", "izin");
  }

  const sb = await klienServer();

  if (atasanId) {
    // Diperiksa lebih dulu supaya alasannya jelas; database menolak hal
    // yang sama lewat jalur mana pun (migrasi 0044 & 0070).
    const { data: pihak, error: galatPihak } = await sb
      .from("users")
      .select("id, nama, role, status")
      .in("id", [id, atasanId]);

    if (galatPihak) return gagal(`Gagal memeriksa atasan: ${galatPihak.message}`);

    const bawahan = pihak?.find((p) => p.id === id);
    const calon = pihak?.find((p) => p.id === atasanId);
    if (!bawahan || !calon) return gagal("Anggota tidak ditemukan.", "validasi");

    if (calon.status !== "aktif") {
      return gagal(
        `${calon.nama} sudah nonaktif; izin dan tiket yang ditujukan kepadanya tidak akan pernah dibuka.`,
        "validasi",
      );
    }
    if (peringkatPeran(calon.role) > peringkatPeran(bawahan.role)) {
      return gagal(
        `${calon.nama} berperan ${calon.role}, lebih sempit daripada ${bawahan.role}. Garis pelaporannya terbalik.`,
        "validasi",
      );
    }
  }

  const { error } = await sb
    .from("users")
    .update({ atasan_id: atasanId })
    .eq("id", id);

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah atasan.", "izin")
      : gagal(error.message, "validasi");
  }

  segarkan();
  return sukses(
    undefined,
    atasanId ? "Atasan diperbarui." : "Atasan dilepas.",
  );
}
