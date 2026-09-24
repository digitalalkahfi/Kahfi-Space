"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { bolehKelolaAnggota, daftarAnggotaTim } from "@/lib/data/anggota";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import {
  adaManagerAktif,
  atasanDisarankan,
  periksaStruktur,
  petaBawahan,
  sebabAtasanTakSah,
} from "@/lib/atasan";
import { peranSah } from "@/lib/peran";
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
  /**
   * Atasan langsung. Hanya dipakai saat menambah; perubahan atasan
   * anggota lama lewat DialogAtasan, yang memeriksa siklus dan
   * memperlihatkan akibatnya lebih dulu.
   */
  atasanId?: string | null;
};

function periksa(input: MasukanAnggota): string | null {
  if (input.nama.trim().length < 3) return "Nama minimal 3 huruf.";
  if (!POLA_EMAIL.test(input.email.trim())) return "Format email tidak sah.";
  if (!peranSah(input.role)) return "Peran tidak dikenali.";
  if (input.jabatan.trim().length < 3) return "Jabatan minimal 3 huruf.";

  // Unit menentukan cakupan RLS; Leader tanpa unit tidak akan melihat
  // siapa pun. Staff boleh tanpa unit hanya sebagai tim manajemen —
  // langsung di bawah CEO atau Manager (dijaga aturan atasan dan 0164).
  if (
    PERAN_BERUNIT.includes(input.role) &&
    !input.unitKode &&
    input.role !== "Staff"
  ) {
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

/**
 * Atasan wajib bagi siapa pun kecuali CEO.
 *
 * Bukan formalitas: atasan itulah yang menyetujui izin dan menerima
 * laporannya. Anggota tanpa atasan tidak bisa mengajukan izin sama
 * sekali, dan itu baru ketahuan pada hari ia membutuhkannya.
 */
function periksaAtasan(input: MasukanAnggota): string | null {
  if (input.role === "CEO") return null;
  return input.atasanId
    ? null
    : "Pilih atasan langsungnya — dialah yang menyetujui izin dan menerima laporannya.";
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

/** Nama unit seperti yang dibaca kartu anggota (`keAnggota`), dari kodenya. */
async function namaUnit(kode: KodeUnit | null) {
  if (!kode) return "Manajemen";
  const sb = await klienServer();
  const { data } = await sb
    .from("units")
    .select("nama")
    .eq("kode", kode)
    .maybeSingle();
  return data?.nama ? data.nama.split(" (")[0] : "Manajemen";
}

function segarkan() {
  revalidatePath("/tim");
  revalidatePath("/tim/struktur");
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
  const salah = periksa(input) ?? periksaAtasan(input);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAnggota(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh menambah anggota.", "izin");
  }

  // Atasannya diperiksa terhadap hierarki di sini juga, bukan hanya di
  // formulir: formulir bisa saja lama, aturannya tidak boleh.
  if (input.atasanId) {
    const semua = await daftarAnggotaTim(pengguna);
    const calon = semua.find((a) => a.id === input.atasanId);
    if (!calon || calon.status !== "aktif") {
      return gagal(
        "Atasan yang dipilih tidak ditemukan atau nonaktif.",
        "validasi",
      );
    }
    const sebab = sebabAtasanTakSah(
      {
        id: "baru",
        nama: input.nama.trim(),
        role: input.role,
        unitNama: await namaUnit(input.unitKode),
      },
      calon,
      { adaManager: adaManagerAktif(semua) },
    );
    if (sebab) return gagal(sebab, "validasi");
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
    atasan_id: input.role === "CEO" ? null : (input.atasanId ?? null),
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

  // Peran atau unit yang berganti bisa membuat atasan lamanya melanggar
  // hierarki (Staff yang naik jadi Leader tidak lagi melapor ke
  // Co-Leader). Alih-alih ditolak basis data dengan pesan mentah — atau
  // atasannya hilang diam-diam — atasannya dipindahkan ke yang sesuai
  // aturan dan perpindahannya disebut.
  const semua = await daftarAnggotaTim(pengguna);
  const diri = semua.find((a) => a.id === id);
  if (!diri) return gagal("Anggota tidak ditemukan.", "validasi");

  const sesudah = {
    id,
    nama: input.nama.trim(),
    role: input.role,
    unitNama: await namaUnit(input.unitKode),
  };
  const opsi = { adaManager: adaManagerAktif(semua) };
  const kini = diri.atasanId
    ? semua.find((a) => a.id === diri.atasanId)
    : undefined;

  let atasanBaru: string | null | undefined;
  let catatanAtasan = "";
  if (kini && sebabAtasanTakSah(sesudah, kini, opsi) !== null) {
    const bawahan = new Set(petaBawahan(semua)[id] ?? []);
    const usul = atasanDisarankan(semua, sesudah, bawahan);
    atasanBaru = usul?.id ?? null;
    catatanAtasan = usul
      ? ` Atasannya dipindahkan dari ${kini.nama} ke ${usul.nama} agar sesuai aturan ${input.role}.`
      : ` Atasan lamanya (${kini.nama}) tidak lagi sesuai aturan ${input.role}; pilih atasan barunya lewat kartu anggota.`;
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
      ...(atasanBaru !== undefined ? { atasan_id: atasanBaru } : {}),
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505")
      return gagal("Email itu sudah dipakai anggota lain.", "validasi");
    if (error.code === "42501")
      return gagal("Kamu tidak berhak mengubah anggota ini.", "izin");
    // Pesan trigger penjaga pengelola terakhir diteruskan apa adanya.
    return gagal(error.message, "validasi");
  }

  segarkan();
  return sukses(undefined, `Data anggota diperbarui.${catatanAtasan}`);
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

  // Basis data melepas seluruh bawahan orang yang dinonaktifkan (0070)
  // — dan tidak mengembalikannya saat ia aktif lagi. Supaya tidak ada
  // yang tiba-tiba "belum punya atasan", bawahannya dipindahkan lebih
  // dulu ke atasan yang sesuai aturan, dan perpindahannya disebut.
  let catatan = "";
  if (status === "nonaktif") {
    const semua = await daftarAnggotaTim(pengguna);
    const sisa = semua.map((a) =>
      a.id === id ? { ...a, status: "nonaktif" as const } : a,
    );
    const cabang = petaBawahan(sisa);
    const dipindah: string[] = [];
    const lepas: string[] = [];

    for (const b of sisa) {
      if (b.atasanId !== id || b.status !== "aktif") continue;
      const usul = atasanDisarankan(sisa, b, new Set(cabang[b.id] ?? []));
      if (!usul) {
        lepas.push(b.nama);
        continue;
      }
      const { error: galatPindah } = await sb
        .from("users")
        .update({ atasan_id: usul.id })
        .eq("id", b.id);
      if (galatPindah) lepas.push(b.nama);
      else dipindah.push(`${b.nama} → ${usul.nama}`);
    }

    if (dipindah.length > 0)
      catatan += ` Bawahannya dipindahkan: ${dipindah.join(", ")}.`;
    if (lepas.length > 0)
      catatan += ` Belum ada atasan pengganti yang sesuai aturan untuk ${lepas.join(", ")}; pilihkan lewat kartu anggota.`;
  }

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
      ? "Anggota diaktifkan kembali. Periksa atasannya di kartu anggota bila sebelumnya dilepas."
      : `Anggota dinonaktifkan; seluruh riwayatnya tetap tersimpan.${catatan}`,
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
    return gagal(
      "Seseorang tidak bisa menjadi atasan dirinya sendiri.",
      "validasi",
    );
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAnggota(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh mengubah atasan.", "izin");
  }

  const sb = await klienServer();

  if (atasanId) {
    // Diperiksa terhadap aturan yang sama dengan dialognya supaya
    // alasannya jelas; database menolak siklus dan pembalikan peringkat
    // lewat jalur mana pun (migrasi 0044 & 0070).
    const semua = await daftarAnggotaTim(pengguna);
    const bawahan = semua.find((a) => a.id === id);
    const calon = semua.find((a) => a.id === atasanId);
    if (!bawahan || !calon)
      return gagal("Anggota tidak ditemukan.", "validasi");

    if (calon.status !== "aktif") {
      return gagal(
        `${calon.nama} sudah nonaktif; izin dan tiket yang ditujukan kepadanya tidak akan pernah dibuka.`,
        "validasi",
      );
    }
    if ((petaBawahan(semua)[id] ?? []).includes(atasanId)) {
      return gagal(
        `${calon.nama} adalah bawahan ${bawahan.nama}; garis pelaporannya akan berputar.`,
        "validasi",
      );
    }
    const sebab = sebabAtasanTakSah(bawahan, calon, {
      adaManager: adaManagerAktif(semua),
    });
    if (sebab) return gagal(sebab, "validasi");
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
  return sukses(undefined, atasanId ? "Atasan diperbarui." : "Atasan dilepas.");
}

/**
 * Menyambungkan garis pelaporan yang kosong atau melanggar aturan ke
 * atasan yang sesuai — hanya yang usulannya tunggal.
 *
 * Atasan yang sudah sah tidak disentuh, dan tidak ada yang dihapus:
 * merapikan bukan alasan mengganti keputusan yang sudah benar. Yang
 * calonnya tidak tunggal dikembalikan untuk diputuskan orang.
 */
export async function rapikanStruktur(): Promise<
  Hasil<{ diubah: number; gagal: string[] }>
> {
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAnggota(pengguna)) {
    return gagal(
      "Hanya CEO atau Manager yang boleh merapikan struktur.",
      "izin",
    );
  }

  const sb = await klienServer();
  const galat: string[] = [];
  let diubah = 0;

  // Bertahap: satu perbaikan membuka perbaikan berikutnya. Rantai yang
  // terbalik (CEO tercatat melapor ke Manager) baru bisa disusun ulang
  // setelah puncaknya dilepas, jadi daftarnya diperiksa lagi sesudah
  // tiap putaran sampai tidak ada lagi yang bisa disambungkan.
  for (let putaran = 0; putaran < 6; putaran += 1) {
    const semua = await daftarAnggotaTim(pengguna);
    const { ubah } = periksaStruktur(semua);
    // Yang sudah gagal tidak dicoba lagi di putaran berikutnya.
    const sisa = ubah.filter(
      (u) => !galat.some((g) => g.startsWith(`${u.nama}:`)),
    );
    if (sisa.length === 0) break;

    let berubah = 0;
    for (const u of sisa) {
      const { error } = await sb
        .from("users")
        .update({ atasan_id: u.ke?.id ?? null })
        .eq("id", u.id);
      if (error) galat.push(`${u.nama}: ${error.message}`);
      else {
        diubah += 1;
        berubah += 1;
      }
    }
    if (berubah === 0) break;
  }

  if (diubah === 0 && galat.length === 0) {
    return sukses({ diubah: 0, gagal: [] }, "Tidak ada yang perlu dirapikan.");
  }

  segarkan();
  if (galat.length > 0) {
    return gagal(
      `${diubah} orang tersambung, ${galat.length} gagal: ${galat.join("; ")}`,
      "validasi",
    );
  }
  return sukses(
    { diubah, gagal: [] },
    `${diubah} orang tersambung ke atasan yang sesuai aturan.`,
  );
}
