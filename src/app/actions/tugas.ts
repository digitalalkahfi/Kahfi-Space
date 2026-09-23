"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import type { Prioritas } from "@/lib/types";

/** Centang / batal centang satu to-do pribadi. */
export async function ubahCentangToDo(
  id: string,
  selesai: boolean,
): Promise<Hasil> {
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { error } = await sb
    .from("tasks")
    .update({ status: selesai ? "selesai" : "todo" })
    .eq("id", id)
    .eq("penerima_id", pengguna.id)
    .eq("tipe", "pribadi");

  if (error) return gagal(`Gagal menyimpan: ${error.message}`);

  revalidatePath("/beranda");
  revalidatePath("/tugas");
  return sukses(
    undefined,
    selesai ? "To-do ditandai selesai." : "To-do dibuka lagi.",
  );
}

/** Tambah to-do pribadi baru. */
export async function tambahToDo(input: {
  judul: string;
  konteks?: string;
  tenggat?: string | null;
  prioritas?: Prioritas;
}): Promise<Hasil> {
  const judul = input.judul.trim();
  if (judul.length < 3) {
    return gagal("Judul to-do minimal 3 karakter.", "validasi");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { error } = await sb.from("tasks").insert({
    tipe: "pribadi",
    judul,
    konteks: input.konteks?.trim() ?? "",
    tenggat: input.tenggat ?? null,
    prioritas: input.prioritas ?? "sedang",
    pembuat_id: pengguna.id,
    penerima_id: pengguna.id,
  });

  if (error) return gagal(`Gagal menyimpan: ${error.message}`);

  revalidatePath("/beranda");
  revalidatePath("/tugas");
  return sukses(undefined, "To-do ditambahkan.");
}

/** Ubah status pengerjaan sebuah tiket. */
export async function ubahStatusTugas(
  id: string,
  status: "todo" | "berjalan" | "menunggu_qc",
  hasilKerja?: string,
): Promise<Hasil> {
  // Mengajukan pemeriksaan tanpa keterangan hasil membuat QC jadi menebak.
  if (status === "menunggu_qc" && (hasilKerja?.trim().length ?? 0) < 5) {
    return gagal(
      "Tulis ringkasan hasil kerjamu sebelum mengajukan pemeriksaan.",
      "validasi",
    );
  }

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  // `select()` bukan hiasan: RLS menolak dengan cara TIDAK mencocokkan
  // barisnya, bukan dengan galat. Tanpa memeriksa baris yang benar-benar
  // tersentuh, perpindahan yang ditolak akan dilaporkan sebagai berhasil
  // dan kartunya tetap pindah di layar.
  const { data, error } = await sb
    .from("tasks")
    .update(
      status === "menunggu_qc"
        ? { status, hasil_kerja: hasilKerja?.trim() ?? "" }
        : { status },
    )
    .eq("id", id)
    .select("id");

  if (error) return gagal(`Gagal menyimpan: ${error.message}`);
  if ((data ?? []).length === 0) {
    return gagal(
      "Tugas itu tidak ada, atau bukan tugas yang boleh kamu pindahkan.",
      "izin",
    );
  }

  revalidatePath("/tugas");
  revalidatePath("/beranda");
  return sukses(undefined, "Status tugas diperbarui.");
}

/**
 * Pemeriksaan (QC) oleh pemberi tugas atau atasan.
 * Database menolak kalau yang memeriksa adalah penerima tugas itu sendiri.
 */
export async function periksaTugas(
  id: string,
  hasil: "lolos" | "revisi",
  catatan = "",
): Promise<Hasil> {
  if (hasil === "revisi" && catatan.trim().length < 5) {
    return gagal(
      "Tulis catatan revisi agar jelas yang perlu diperbaiki.",
      "validasi",
    );
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { data, error } = await sb
    .from("tasks")
    .update({ qc_status: hasil, qc_note: catatan.trim() })
    .eq("id", id)
    .select("id");

  if (error) {
    return error.message.includes("Pemeriksaan (QC)")
      ? gagal("Pemeriksaan harus dilakukan pemberi tugas atau atasan.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }
  // Sama seperti `ubahStatusTugas`: RLS menolak tanpa galat, jadi yang
  // menentukan adalah ada tidaknya baris yang tersentuh.
  if ((data ?? []).length === 0) {
    return gagal(
      "Tugas itu tidak ada, atau bukan tugas yang boleh kamu periksa.",
      "izin",
    );
  }

  revalidatePath("/tugas");
  revalidatePath("/beranda");
  return sukses(
    undefined,
    hasil === "lolos"
      ? "Tugas dinyatakan selesai."
      : "Tugas dikembalikan untuk revisi.",
  );
}

/**
 * Buat tiket untuk anggota tim.
 *
 * Database menolak bila penerima bukan bawahan pembuatnya, jadi daftar
 * penerima di UI hanya soal kenyamanan — bukan satu-satunya penjaga.
 */
export async function buatTiket(input: {
  judul: string;
  deskripsi?: string;
  konteks?: string;
  penerimaId: string;
  tenggat?: string | null;
  prioritas?: Prioritas;
  /** "komitmen_mingguan" wajib menyertakan goalId (dijaga juga oleh database). */
  tipe?: "tiket" | "komitmen_mingguan";
  goalId?: string | null;
}): Promise<Hasil> {
  const judul = input.judul.trim();
  if (judul.length < 3)
    return gagal("Judul tiket minimal 3 karakter.", "validasi");
  if (!input.penerimaId) return gagal("Pilih penerima tiket.", "validasi");

  const tipe = input.tipe ?? "tiket";
  if (tipe === "komitmen_mingguan" && !input.goalId) {
    return gagal(
      "Komitmen mingguan harus terhubung ke sebuah goal.",
      "validasi",
    );
  }

  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { error } = await sb.from("tasks").insert({
    tipe,
    goal_id: tipe === "komitmen_mingguan" ? input.goalId : null,
    judul,
    deskripsi: input.deskripsi?.trim() ?? "",
    konteks: input.konteks?.trim() ?? "",
    pembuat_id: pengguna.id,
    penerima_id: input.penerimaId,
    tenggat: input.tenggat ?? null,
    prioritas: input.prioritas ?? "sedang",
  });

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu hanya bisa menugasi anggota yang kamu bawahi.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  revalidatePath("/tugas");
  revalidatePath("/beranda");
  return sukses(
    undefined,
    tipe === "komitmen_mingguan"
      ? "Komitmen mingguan terkirim ke penerima."
      : "Tiket terkirim ke penerima.",
  );
}
