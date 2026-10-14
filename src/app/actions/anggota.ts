"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { klienAdmin } from "@/lib/supabase/admin";
import { buatSandiSementara, WAJIB_GANTI_SANDI } from "@/lib/keamanan";
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
import {
  POLA_EMAIL,
  periksa,
  periksaAtasan,
  type MasukanAnggota,
} from "@/lib/validasi-anggota";
import { periksaAlasanTolak } from "@/lib/pendaftaran";
import type { AnggotaTim, KodeUnit, Pengguna } from "@/lib/types";

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

/**
 * Atasan orang baru diperiksa terhadap hierarki (BR-04). Dipakai
 * "Tambah anggota" dan persetujuan pendaftaran Google, supaya keduanya
 * tidak bisa berbeda aturan.
 */
async function sebabAtasanAnggotaBaru(
  pengguna: Pengguna,
  input: MasukanAnggota,
): Promise<string | null> {
  if (!input.atasanId) return null;
  const semua: AnggotaTim[] = await daftarAnggotaTim(pengguna);
  const calon = semua.find((a) => a.id === input.atasanId);
  if (!calon || calon.status !== "aktif") {
    return "Atasan yang dipilih tidak ditemukan atau nonaktif.";
  }
  return sebabAtasanTakSah(
    {
      id: "baru",
      nama: input.nama.trim(),
      role: input.role,
      unitNama: await namaUnit(input.unitKode),
    },
    calon,
    { adaManager: adaManagerAktif(semua) },
  );
}

/** Akun login yang baru dibuat; kata sandinya hanya ada di balasan ini. */
export type AkunLoginBaru = { nama: string; email: string; sandi: string };

/**
 * Membuat akun login (Supabase Auth) untuk profil anggota yang sudah ada,
 * dengan kata sandi sementara yang ditampilkan SEKALI kepada CEO/Manager
 * dan tidak pernah disimpan aplikasi. Pemiliknya wajib menggantinya saat
 * pertama masuk (`harusGantiSandiDulu`, middleware).
 *
 * `supabase/auth.sql` menyamakan id profil dengan id akun Auth lewat
 * email yang sama; bila jembatan itu belum terpasang, penyamaannya
 * dikerjakan di sini (foreign key ikut lewat on update cascade).
 */
async function buatAkunAuth(profil: {
  id: string;
  nama: string;
  email: string;
}): Promise<Hasil<AkunLoginBaru>> {
  let admin: ReturnType<typeof klienAdmin>;
  try {
    admin = klienAdmin();
  } catch {
    return gagal(
      "Pembuatan akun login belum diaktifkan di server (kunci layanan Supabase belum dipasang).",
    );
  }

  const { data: ada } = await admin.auth.admin.getUserById(profil.id);
  if (ada?.user) {
    return gagal(`${profil.nama} sudah punya akun login.`, "validasi");
  }

  const sandi = buatSandiSementara({ nama: profil.nama, email: profil.email });
  const { data, error } = await admin.auth.admin.createUser({
    email: profil.email,
    password: sandi,
    email_confirm: true,
    user_metadata: { nama: profil.nama, [WAJIB_GANTI_SANDI]: true },
  });
  if (error || !data.user) {
    return /already|registered|exists/i.test(error?.message ?? "")
      ? gagal(
          `Email ${profil.email} sudah dipakai akun login lain. Periksa emailnya di data anggota.`,
          "validasi",
        )
      : gagal(
          `Gagal membuat akun login: ${error?.message ?? "tanpa keterangan"}`,
        );
  }

  const idAuth = data.user.id;
  const { data: sudahSama } = await admin
    .from("users")
    .select("id")
    .eq("id", idAuth)
    .maybeSingle();
  if (!sudahSama) {
    const { error: gagalSamakan } = await admin
      .from("users")
      .update({ id: idAuth })
      .eq("id", profil.id);
    if (gagalSamakan) {
      // Akun tanpa profil tidak berguna dan membingungkan: batalkan.
      await admin.auth.admin.deleteUser(idAuth);
      return gagal(
        `Akun login belum bisa disambungkan ke profil ${profil.nama}: ${gagalSamakan.message}`,
      );
    }
  }

  return sukses({ nama: profil.nama, email: profil.email, sandi });
}

/**
 * Tombol "Buat akun login" untuk anggota yang profilnya sudah ada tetapi
 * belum bisa masuk (mis. didaftarkan sebelum fitur ini ada).
 */
export async function buatAkunLogin(
  anggotaId: string,
): Promise<Hasil<AkunLoginBaru>> {
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAnggota(pengguna)) {
    return gagal(
      "Hanya CEO atau Manager yang boleh membuat akun login.",
      "izin",
    );
  }

  // Email anggota tidak terbuka lewat RLS biasa (hanya `kontak_orang`);
  // hak CEO/Manager sudah diperiksa di atas, jadi dibaca lewat klien admin.
  let admin: ReturnType<typeof klienAdmin>;
  try {
    admin = klienAdmin();
  } catch {
    return gagal(
      "Pembuatan akun login belum diaktifkan di server (kunci layanan Supabase belum dipasang).",
    );
  }
  const { data: profil } = await admin
    .from("users")
    .select("id, nama, email, status")
    .eq("id", anggotaId)
    .maybeSingle();
  if (!profil) return gagal("Anggota tidak ditemukan.", "validasi");
  if (profil.status !== "aktif") {
    return gagal(
      "Aktifkan anggota ini dulu sebelum membuat akun login.",
      "validasi",
    );
  }
  if (!profil.email || !POLA_EMAIL.test(profil.email)) {
    return gagal(
      "Anggota ini belum punya email yang sah. Isi emailnya dulu lewat tombol ubah.",
      "validasi",
    );
  }

  const hasil = await buatAkunAuth({
    id: profil.id,
    nama: profil.nama,
    email: profil.email.toLowerCase(),
  });
  if (hasil.ok) segarkan();
  return hasil;
}

function segarkan() {
  revalidatePath("/tim");
  revalidatePath("/tim/struktur");
  revalidatePath("/beranda");
}

/**
 * Tambah anggota baru: baris profil, lalu langsung akun login dengan
 * kata sandi sementara (`buatAkunAuth`). Kata sandinya dikembalikan
 * sekali untuk diteruskan CEO/Manager kepada orangnya; aplikasi tidak
 * menyimpannya. Bila akun login gagal dibuat, profil tetap tersimpan dan
 * akunnya bisa dibuat belakangan lewat tombol "Buat akun login".
 */
export async function tambahAnggota(
  input: MasukanAnggota,
): Promise<Hasil<{ akun: AkunLoginBaru | null }>> {
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
  const sebab = await sebabAtasanAnggotaBaru(pengguna, input);
  if (sebab) return gagal(sebab, "validasi");

  const sb = await klienServer();
  // `users.id` mengikuti `auth.users.id` dan karena itu tidak punya nilai
  // bawaan. Profil memakai id sementara; begitu akun login dibuat,
  // `supabase/auth.sql` menyamakan idnya dengan id Auth.
  const idSementara = crypto.randomUUID();
  const email = input.email.trim().toLowerCase();
  const { error } = await sb.from("users").insert({
    id: idSementara,
    nama: input.nama.trim(),
    email,
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

  const akun = await buatAkunAuth({
    id: idSementara,
    nama: input.nama.trim(),
    email,
  });
  segarkan();
  return akun.ok
    ? sukses(
        { akun: akun.data },
        `${input.nama.trim()} ditambahkan dan akun loginnya sudah dibuat.`,
      )
    : sukses(
        { akun: null },
        `${input.nama.trim()} ditambahkan, tetapi akun loginnya belum dibuat: ${akun.pesan} Coba lagi lewat tombol "Buat akun login".`,
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

// ---------------------------------------------------------------------
// Persetujuan pendaftaran Google (docs/DAFTAR-GOOGLE-PERSETUJUAN.md)
//
// Ketiganya memanggil fungsi database (0209) yang mengubah profil dan
// status pendaftaran dalam satu transaksi, dan yang sekali lagi
// memeriksa bahwa pemanggilnya CEO/Manager AKTIF serta pendaftarannya
// belum diputuskan orang lain. Tidak butuh kunci service role.
// ---------------------------------------------------------------------

/** Status pendaftaran yang sedang dilihat approver saat menekan tombol. */
type StatusAwal = "menunggu" | "ditolak";

const HANYA_PENGELOLA =
  "Hanya CEO atau Manager yang boleh memutuskan pendaftaran.";

function segarkanPendaftaran() {
  segarkan();
  revalidatePath("/tim/pendaftaran");
}

/** Galat RPC keputusan → balasan; pesan dari database sudah berbahasa pengguna. */
function gagalKeputusan(error: { code?: string; message: string }) {
  return error.code === "42501"
    ? gagal(HANYA_PENGELOLA, "izin")
    : gagal(error.message, "validasi");
}

async function pengelolaAktif(): Promise<Pengguna | ReturnType<typeof gagal>> {
  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAnggota(pengguna)) return gagal(HANYA_PENGELOLA, "izin");
  return pengguna;
}

/** Setujui sebagai ANGGOTA BARU: profil dibuat dengan id akun Google-nya. */
export async function setujuiPendaftaranBaru(
  pendaftaranId: string,
  statusAwal: StatusAwal,
  input: MasukanAnggota,
): Promise<Hasil> {
  const salah = periksa(input) ?? periksaAtasan(input);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await pengelolaAktif();
  if ("ok" in pengguna) return pengguna;

  const sebab = await sebabAtasanAnggotaBaru(pengguna, input);
  if (sebab) return gagal(sebab, "validasi");

  const sb = await klienServer();
  const { error } = await sb.rpc("setujui_pendaftaran_baru", {
    p_id: pendaftaranId,
    p_status_awal: statusAwal,
    p_nama: input.nama.trim(),
    p_role: input.role,
    p_jabatan: input.jabatan.trim(),
    p_unit: await idUnit(input.unitKode),
    p_departemen: input.departemenId,
    p_program: input.programId,
    p_atasan: input.role === "CEO" ? null : (input.atasanId ?? null),
  });
  if (error) return gagalKeputusan(error);

  segarkanPendaftaran();
  return sukses(
    undefined,
    `${input.nama.trim()} disetujui. Ia langsung bisa memakai K-Space setelah membuka ulang halaman.`,
  );
}

/**
 * Setujui dengan MENYAMBUNGKAN ke profil yang sudah ada (jalur C).
 * Database menolak profil nonaktif, profil yang sudah punya akun login,
 * dan email Google yang sudah dipakai profil lain.
 */
export async function sambungkanPendaftaran(
  pendaftaranId: string,
  statusAwal: StatusAwal,
  profilId: string,
): Promise<Hasil> {
  if (!profilId) return gagal("Pilih profil yang akan disambungkan.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await pengelolaAktif();
  if ("ok" in pengguna) return pengguna;

  const sb = await klienServer();
  const { error } = await sb.rpc("sambungkan_pendaftaran", {
    p_id: pendaftaranId,
    p_status_awal: statusAwal,
    p_profil: profilId,
  });
  if (error) return gagalKeputusan(error);

  segarkanPendaftaran();
  return sukses(
    undefined,
    "Akun Google tersambung ke profilnya. Riwayatnya tetap utuh.",
  );
}

/** Tolak pendaftaran; alasan wajib (BR-07). */
export async function tolakPendaftaran(
  pendaftaranId: string,
  alasan: string,
): Promise<Hasil> {
  const salah = periksaAlasanTolak(alasan);
  if (salah) return gagal(salah, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await pengelolaAktif();
  if ("ok" in pengguna) return pengguna;

  const sb = await klienServer();
  const { error } = await sb.rpc("tolak_pendaftaran", {
    p_id: pendaftaranId,
    p_alasan: alasan.trim(),
  });
  if (error) return gagalKeputusan(error);

  segarkanPendaftaran();
  return sukses(undefined, "Pendaftaran ditolak.");
}
