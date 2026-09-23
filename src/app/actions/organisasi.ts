"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { bolehKelolaProgram } from "@/lib/data/program";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import { kodeUnitSah } from "@/lib/unit-pelaporan";

const MIN_NAMA = 3;
const MAKS_NAMA = 40;

function segarkan() {
  revalidatePath("/tim");
  revalidatePath("/tim/struktur");
  revalidatePath("/tim/program");
}

/** Pemeriksaan nama yang sama untuk departemen maupun unit. */
function periksaNama(nama: string) {
  const bersih = nama.trim();
  if (bersih.length < MIN_NAMA || bersih.length > MAKS_NAMA) {
    return `Nama ${MIN_NAMA}–${MAKS_NAMA} huruf.`;
  }
  return null;
}

/**
 * Menambah departemen.
 *
 * Departemen berbeda dari unit: unit adalah tiga jalur pelaporan yang
 * dikunci di kode aplikasi (`affiliator`, `mcn`, `tap`), sedangkan
 * departemen adalah pengelompokan orang yang boleh bertambah seiring
 * perusahaan tumbuh.
 */
export async function tambahDepartemen(input: {
  nama: string;
}): Promise<Hasil> {
  const salah = periksaNama(input.nama);
  if (salah) return gagal(salah, "validasi");

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaProgram(pengguna)) {
    return gagal("Hanya CEO atau Manager yang mengelola departemen.", "izin");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb
    .from("departments")
    .insert({ nama: input.nama.trim() });

  if (error) {
    if (error.code === "23505") {
      return gagal(`Departemen "${input.nama.trim()}" sudah ada.`, "validasi");
    }
    return error.code === "42501"
      ? gagal("Kamu tidak berhak menambah departemen.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkan();
  return sukses(undefined, `Departemen ${input.nama.trim()} ditambahkan.`);
}

/**
 * Mengganti nama departemen.
 *
 * Bukan membuat baris baru: anggota yang menempel padanya tetap
 * menunjuk id yang sama, jadi mengganti nama tidak memutus satu pun
 * penempatan. Menghapus departemen sengaja tidak disediakan — anggota
 * lama akan kehilangan penempatannya diam-diam (`on delete set null`).
 */
export async function ubahNamaDepartemen(input: {
  departemenId: string;
  nama: string;
}): Promise<Hasil> {
  if (!input.departemenId) {
    return gagal("Departemen tidak dikenali.", "validasi");
  }
  const salah = periksaNama(input.nama);
  if (salah) return gagal(salah, "validasi");

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaProgram(pengguna)) {
    return gagal("Hanya CEO atau Manager yang mengelola departemen.", "izin");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb
    .from("departments")
    .update({ nama: input.nama.trim() })
    .eq("id", input.departemenId);

  if (error) {
    if (error.code === "23505") {
      return gagal(`Departemen "${input.nama.trim()}" sudah ada.`, "validasi");
    }
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah departemen ini.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkan();
  return sukses(undefined, "Nama departemen diperbarui.");
}

/**
 * Mengubah nama tampilan & keterangan sebuah unit.
 *
 * Kodenya TIDAK bisa diubah: `affiliator`, `mcn`, dan `tap` dipakai di
 * seluruh kode aplikasi sebagai tipe, bukan sebagai data. Yang boleh
 * berubah hanya bagaimana unit itu disebut di layar.
 */
export async function ubahUnit(input: {
  kode: string;
  nama: string;
  deskripsi?: string;
}): Promise<Hasil> {
  if (!kodeUnitSah(input.kode)) {
    return gagal("Unit tidak dikenali.", "validasi");
  }
  const salah = periksaNama(input.nama);
  if (salah) return gagal(salah, "validasi");

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaProgram(pengguna)) {
    return gagal("Hanya CEO atau Manager yang mengelola unit.", "izin");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { error } = await sb
    .from("units")
    .update({
      nama: input.nama.trim(),
      deskripsi: (input.deskripsi ?? "").trim(),
    })
    .eq("kode", input.kode);

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah unit ini.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkan();
  return sukses(undefined, `Unit ${input.nama.trim()} diperbarui.`);
}
