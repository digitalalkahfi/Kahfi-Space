"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { bebanPenerima, hariIniTugas } from "@/lib/data/tugas";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import { MIN_HASIL_KERJA, PESAN_TODO_TANPA_REVIEW } from "@/lib/kanban";
import {
  periksaTenggat,
  periksaTiketBaru,
  periksaToDoBaru,
  tanggalSah,
} from "@/lib/validasi-tugas";
import type { Prioritas } from "@/lib/types";

/** Pesan baku saat isi tiket diubah selain oleh pemberinya (D1, 0181). */
const PESAN_KUNCI_TIKET = "Isi tiket hanya bisa diubah oleh pemberi tiket.";

/** Centang / batal centang satu to-do pribadi. */
export async function ubahCentangToDo(
  id: string,
  selesai: boolean,
): Promise<Hasil> {
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { data, error } = await sb
    .from("tasks")
    .update({ status: selesai ? "selesai" : "todo" })
    .eq("id", id)
    .eq("penerima_id", pengguna.id)
    .eq("tipe", "pribadi")
    .select("id");

  if (error) return gagal(`Gagal menyimpan: ${error.message}`);
  // Penyaring id pemilik menolak tanpa galat: to-do orang lain hanya
  // menghasilkan nol baris, dan itu tidak boleh dilaporkan berhasil.
  if ((data ?? []).length === 0) {
    return gagal("To-do itu tidak ada, atau bukan milikmu.", "izin");
  }

  revalidatePath("/beranda");
  revalidatePath("/tugas");
  return sukses(
    undefined,
    selesai ? "To-do ditandai selesai." : "To-do dibuka lagi.",
  );
}

/**
 * Tambah to-do pribadi baru.
 *
 * Tanggal wajib, jam opsional (D3): to-do tanpa jam disimpan sebagai
 * 23:59 WIB tanggal itu dengan penanda `tanpa_jam`. Target (angka +
 * satuan) opsional — versi ringan SMART (D5).
 */
export async function tambahToDo(input: {
  judul: string;
  konteks?: string;
  /** Tanggal WIB, YYYY-MM-DD. */
  tanggal: string;
  /** Jam WIB, HH:MM; kosong = tanpa jam. */
  jam?: string | null;
  targetAngka?: string | number | null;
  targetSatuan?: string;
  prioritas?: Prioritas;
}): Promise<Hasil> {
  const cek = periksaToDoBaru({
    judul: input.judul,
    tanggal: input.tanggal,
    jam: input.jam,
    targetAngka: input.targetAngka,
    targetSatuan: input.targetSatuan,
    hariIni: hariIniTugas(),
  });
  if (!cek.ok) return gagal(cek.pesan, "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { error } = await sb.from("tasks").insert({
    tipe: "pribadi",
    judul: cek.nilai.judul,
    konteks: input.konteks?.trim() ?? "",
    tenggat: cek.nilai.tenggat,
    tanpa_jam: cek.nilai.tanpaJam,
    target_angka: cek.nilai.targetAngka,
    target_satuan: cek.nilai.targetSatuan,
    prioritas: input.prioritas ?? "sedang",
    pembuat_id: pengguna.id,
    penerima_id: pengguna.id,
  });

  if (error) return gagal(`Gagal menyimpan: ${error.message}`);

  revalidatePath("/beranda");
  revalidatePath("/tugas");
  return sukses(undefined, "To-do ditambahkan.");
}

/** Ubah status pengerjaan sebuah tiket (atau to-do yang tidak dicentang). */
export async function ubahStatusTugas(
  id: string,
  status: "todo" | "berjalan" | "menunggu_qc",
  hasilKerja?: string,
): Promise<Hasil> {
  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = modeData() === "demo" ? null : await klienServer();

  if (status === "menunggu_qc") {
    // To-do pribadi tidak punya tahap Review (D2). Constraint 0179 juga
    // menolaknya; memeriksanya di sini memberi pesan yang tepat alih-alih
    // meminta ringkasan hasil kerja yang tidak akan diperiksa siapa pun.
    if (sb) {
      const { data: tugas } = await sb
        .from("tasks")
        .select("tipe")
        .eq("id", id)
        .maybeSingle();
      if (tugas?.tipe === "pribadi") {
        return gagal(PESAN_TODO_TANPA_REVIEW, "validasi");
      }
    }
    // Mengajukan pemeriksaan tanpa keterangan hasil membuat QC jadi menebak.
    if ((hasilKerja?.trim().length ?? 0) < MIN_HASIL_KERJA) {
      return gagal(
        "Tulis ringkasan hasil kerjamu sebelum mengajukan pemeriksaan.",
        "validasi",
      );
    }
  }

  if (!sb) return BALASAN_DEMO;

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

  if (error) {
    return error.message.includes("tasks_pribadi_tanpa_review")
      ? gagal(PESAN_TODO_TANPA_REVIEW, "validasi")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }
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
 * Tanggal dan jam tenggat wajib (D3), begitu juga kriteria selesai (D5);
 * trigger 0180 & 0183 menjaga keduanya.
 */
export async function buatTiket(input: {
  judul: string;
  deskripsi?: string;
  konteks?: string;
  /** "Tiket dianggap selesai bila …" — wajib (D5). */
  kriteriaSelesai: string;
  targetAngka?: string | number | null;
  targetSatuan?: string;
  penerimaId: string;
  /** Tanggal WIB, YYYY-MM-DD. */
  tanggal: string;
  /** Jam WIB, HH:MM — wajib untuk tiket. */
  jam: string;
  prioritas?: Prioritas;
  /** "komitmen_mingguan" wajib menyertakan goalId (dijaga juga oleh database). */
  tipe?: "tiket" | "komitmen_mingguan";
  goalId?: string | null;
}): Promise<Hasil> {
  const tipe = input.tipe ?? "tiket";
  const cek = periksaTiketBaru({
    judul: input.judul,
    penerimaId: input.penerimaId,
    tipe,
    goalId: input.goalId,
    kriteriaSelesai: input.kriteriaSelesai,
    targetAngka: input.targetAngka,
    targetSatuan: input.targetSatuan,
    tanggal: input.tanggal,
    jam: input.jam,
    hariIni: hariIniTugas(),
  });
  if (!cek.ok) return gagal(cek.pesan, "validasi");

  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  const sb = await klienServer();
  const { error } = await sb.from("tasks").insert({
    tipe,
    goal_id: cek.nilai.goalId,
    judul: cek.nilai.judul,
    deskripsi: input.deskripsi?.trim() ?? "",
    konteks: input.konteks?.trim() ?? "",
    kriteria_selesai: cek.nilai.kriteriaSelesai,
    target_angka: cek.nilai.targetAngka,
    target_satuan: cek.nilai.targetSatuan,
    pembuat_id: pengguna.id,
    penerima_id: input.penerimaId,
    tenggat: cek.nilai.tenggat,
    prioritas: input.prioritas ?? "sedang",
  });

  if (error) {
    if (error.code === "42501") {
      return gagal(
        "Kamu hanya bisa menugasi anggota yang kamu bawahi.",
        "izin",
      );
    }
    if (error.message.includes("wajib punya tanggal")) {
      return gagal("Isi tanggal dan jam tenggat tiket.", "validasi");
    }
    return error.message.includes("wajib punya kriteria selesai")
      ? gagal("Tulis kriteria selesai tiketnya.", "validasi")
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

/**
 * Ubah tenggat sebuah tugas.
 *
 * To-do: hanya pemiliknya, jam opsional — inilah cara menjadwal ulang
 * to-do yang terlambat. Tiket & komitmen: hanya pemberi tiketnya (D1),
 * jam wajib; penerima yang butuh waktu lebih menghubungi pemberinya.
 * Basis data menolak juga (trigger 0181), dan pengingat tenggat terbit
 * lagi untuk tanggal barunya.
 */
export async function ubahTenggatTugas(
  id: string,
  tanggal: string,
  jam: string | null,
): Promise<Hasil> {
  const hariIni = hariIniTugas();
  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  if (modeData() === "demo") {
    const cek = periksaTenggat({ tanggal, jam, jamWajib: false, hariIni });
    return cek.ok ? BALASAN_DEMO : gagal(cek.pesan, "validasi");
  }

  const sb = await klienServer();
  const { data: tugas, error: galatBaca } = await sb
    .from("tasks")
    .select("tipe, pembuat_id, penerima_id")
    .eq("id", id)
    .maybeSingle();

  if (galatBaca) return gagal(`Gagal memuat tugas: ${galatBaca.message}`);
  if (!tugas) {
    return gagal("Tugas itu tidak ada, atau tidak terlihat olehmu.", "izin");
  }

  const todo = tugas.tipe === "pribadi";
  const pemilik = todo ? tugas.penerima_id : tugas.pembuat_id;
  if (pemilik !== pengguna.id) {
    return gagal(
      todo
        ? "Hanya pemilik to-do yang bisa memindahkan tanggalnya."
        : PESAN_KUNCI_TIKET,
      "izin",
    );
  }

  const cek = periksaTenggat({ tanggal, jam, jamWajib: !todo, hariIni });
  if (!cek.ok) return gagal(cek.pesan, "validasi");

  const { data, error } = await sb
    .from("tasks")
    .update({ tenggat: cek.nilai.tenggat, tanpa_jam: cek.nilai.tanpaJam })
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code !== "42501") {
      return gagal(`Gagal menyimpan: ${error.message}`);
    }
    return gagal(
      todo
        ? "Hanya pemilik to-do yang bisa memindahkan tanggalnya."
        : PESAN_KUNCI_TIKET,
      "izin",
    );
  }
  if ((data ?? []).length === 0) {
    return gagal(
      "Tugas itu tidak ada, atau bukan tugas yang boleh kamu ubah.",
      "izin",
    );
  }

  revalidatePath("/tugas");
  revalidatePath("/beranda");
  return sukses(
    undefined,
    todo ? "To-do dipindahkan ke tanggal lain." : "Tenggat tiket diperbarui.",
  );
}

/**
 * Info beban penerima untuk form tiket (unsur A pada SMART): berapa tiket
 * & komitmen aktif yang sudah bertenggat di tanggal itu. Hanya info — tidak
 * memblokir. To-do pribadi penerima tidak ikut dihitung, dan hitungannya
 * tunduk RLS.
 */
export async function hitungBebanPenerima(
  penerimaId: string,
  tanggal: string,
): Promise<Hasil<number>> {
  if (!penerimaId || !tanggalSah(tanggal)) {
    return gagal("Pilih penerima dan tanggalnya dulu.", "validasi");
  }

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");

  try {
    return sukses(await bebanPenerima(pengguna, penerimaId, tanggal));
  } catch (e) {
    return gagal(e instanceof Error ? e.message : "Gagal menghitung beban.");
  }
}
