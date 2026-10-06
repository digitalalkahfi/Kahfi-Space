"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { bebanPenerima, hariIniTugas } from "@/lib/data/tugas";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import {
  MIN_HASIL_KERJA,
  PESAN_TODO_TANPA_REVIEW,
  peranLintasUnit,
} from "@/lib/kanban";
import { keJamWib, keTanggalWib } from "@/lib/format";
import {
  PESAN_HAPUS_TIKET_GRD,
  PESAN_TENGGAT_GRD,
  bolehUbahTenggatTiketGrd,
} from "@/lib/tiket-grd";
import {
  periksaDelegasi,
  periksaTenggat,
  periksaTiketBaru,
  periksaToDoBaru,
  periksaUbahTiket,
  periksaUbahToDo,
  tanggalSah,
  type TenggatLama,
} from "@/lib/validasi-tugas";
import type { Prioritas } from "@/lib/types";

/**
 * Pesan baku saat isi tiket diubah selain oleh pemberinya, CEO, atau
 * Manager (D1, 0181; CEO/Manager sejak 0205).
 */
const PESAN_KUNCI_TIKET =
  "Isi tiket hanya bisa diubah oleh pemberi tiket, CEO, atau Manager.";

/** Pesan baku saat to-do diubah selain oleh pemiliknya (D1, 0181). */
const PESAN_KUNCI_TODO = "Hanya pemilik to-do yang bisa mengubahnya.";

/** Tiket yang lolos QC sudah jadi bagian nilai KPI penerimanya (0184). */
const PESAN_TIKET_SELESAI =
  "Tiket yang sudah selesai tidak bisa diubah atau dihapus lagi — nilainya sudah masuk KPI penerima.";

/** Yang sudah mulai dikerjakan tidak dipindah tangan (0184). */
const PESAN_PENERIMA_TERKUNCI =
  "Penerima hanya bisa diganti selama tiket belum mulai dikerjakan.";

/**
 * Form mengirim Target? Form to-do & tiket tidak lagi menampilkan Target;
 * target lama yang sudah tersimpan tidak boleh ikut terhapus saat edit.
 */
function adaTarget(input: {
  targetAngka?: string | number | null;
  targetSatuan?: string;
}): boolean {
  return input.targetAngka !== undefined || input.targetSatuan !== undefined;
}

/** Tenggat tersimpan dibaca sebagai tanggal & jam WIB untuk isian edit. */
function tenggatLama(tenggat: string | null, tanpaJam: boolean): TenggatLama {
  if (!tenggat) return { tanggal: "", jam: null };
  return {
    tanggal: keTanggalWib(tenggat),
    jam: tanpaJam ? null : keJamWib(tenggat),
  };
}

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
  /** Penjelasan to-do; boleh berparagraf. */
  deskripsi?: string;
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
    deskripsi: input.deskripsi?.trim() ?? "",
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
  // Tonggak GRD ber-tiket mengikuti statusnya (0200).
  revalidatePath("/grd/rencana");
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
  // QC lolos menyelesaikan tonggak GRD-nya (0200).
  revalidatePath("/grd/rencana");
  revalidatePath("/grd/scorecard");
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
 * to-do yang terlambat. Tiket & komitmen: pemberi tiketnya atau CEO/Manager
 * (D1; CEO/Manager sejak 0205), jam wajib; penerima yang butuh waktu lebih
 * menghubungi pemberinya.
 * Tiket dari rencana GRD: hanya CEO/Manager, siapa pun pemberinya —
 * tenggat tonggaknya ikut berubah (0200). Basis data menolak juga
 * (trigger 0181, 0200), dan pengingat tenggat terbit lagi untuk tanggal
 * barunya.
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
    .select("tipe, pembuat_id, penerima_id, tonggak_id")
    .eq("id", id)
    .maybeSingle();

  if (galatBaca) return gagal(`Gagal memuat tugas: ${galatBaca.message}`);
  if (!tugas) {
    return gagal("Tugas itu tidak ada, atau tidak terlihat olehmu.", "izin");
  }

  const todo = tugas.tipe === "pribadi";
  const dariGrd = tugas.tonggak_id !== null;
  const lintas = peranLintasUnit(pengguna.role);
  if (dariGrd) {
    if (!bolehUbahTenggatTiketGrd(pengguna.role)) {
      return gagal(PESAN_TENGGAT_GRD, "izin");
    }
  } else if (todo) {
    if (tugas.penerima_id !== pengguna.id) {
      return gagal("Hanya pemilik to-do yang bisa mengubah deadline-nya.", "izin");
    }
  } else if (tugas.pembuat_id !== pengguna.id && !lintas) {
    return gagal(PESAN_KUNCI_TIKET, "izin");
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
      dariGrd
        ? PESAN_TENGGAT_GRD
        : todo
          ? "Hanya pemilik to-do yang bisa mengubah deadline-nya."
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
  // Tenggat tonggaknya ikut berubah (0200).
  if (dariGrd) revalidatePath("/grd/rencana");
  return sukses(
    undefined,
    todo ? "Deadline to-do diperbarui." : "Deadline tiket diperbarui.",
  );
}

/**
 * Edit to-do pribadi — hanya pemiliknya (D1).
 *
 * Tanggal yang tidak disentuh boleh tetap lampau (mengganti judul to-do
 * yang terlambat tidak memaksa memindahkan tanggalnya); yang diubah tidak
 * boleh sebelum hari ini. Tenggat yang sama tidak ditulis ulang supaya
 * pengingatnya tidak ikut di-reset.
 */
export async function ubahToDo(
  id: string,
  input: {
    judul: string;
    deskripsi?: string;
    konteks?: string;
    /** Tanggal WIB, YYYY-MM-DD. */
    tanggal: string;
    /** Jam WIB, HH:MM; kosong = tanpa jam. */
    jam?: string | null;
    /** Tidak dikirim form (Target sudah tidak diisi); bila ada, ditulis. */
    targetAngka?: string | number | null;
    targetSatuan?: string;
    prioritas?: Prioritas;
  },
): Promise<Hasil> {
  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { data: lama, error: galatBaca } = await sb
    .from("tasks")
    .select("tipe, penerima_id, tenggat, tanpa_jam")
    .eq("id", id)
    .maybeSingle();

  if (galatBaca) return gagal(`Gagal memuat to-do: ${galatBaca.message}`);
  if (!lama || lama.tipe !== "pribadi" || lama.penerima_id !== pengguna.id) {
    return gagal(PESAN_KUNCI_TODO, "izin");
  }

  const cek = periksaUbahToDo({
    judul: input.judul,
    tanggal: input.tanggal,
    jam: input.jam,
    targetAngka: input.targetAngka,
    targetSatuan: input.targetSatuan,
    hariIni: hariIniTugas(),
    lama: tenggatLama(lama.tenggat, lama.tanpa_jam),
  });
  if (!cek.ok) return gagal(cek.pesan, "validasi");

  const { data, error } = await sb
    .from("tasks")
    .update({
      judul: cek.nilai.judul,
      // Target lama tetap utuh bila form tidak mengirimnya.
      ...(adaTarget(input)
        ? {
            target_angka: cek.nilai.targetAngka,
            target_satuan: cek.nilai.targetSatuan,
          }
        : {}),
      ...(input.deskripsi !== undefined
        ? { deskripsi: input.deskripsi.trim() }
        : {}),
      ...(input.konteks !== undefined ? { konteks: input.konteks.trim() } : {}),
      ...(input.prioritas ? { prioritas: input.prioritas } : {}),
      ...(cek.nilai.tenggatBerubah
        ? { tenggat: cek.nilai.tenggat, tanpa_jam: cek.nilai.tanpaJam }
        : {}),
    })
    .eq("id", id)
    .select("id");

  if (error) {
    return error.code === "42501"
      ? gagal(PESAN_KUNCI_TODO, "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }
  if ((data ?? []).length === 0) {
    return gagal("To-do itu tidak ada, atau bukan milikmu.", "izin");
  }

  revalidatePath("/tugas");
  revalidatePath("/beranda");
  return sukses(undefined, "To-do diperbarui.");
}

/**
 * Delegasikan to-do ke bawahan: to-do berubah menjadi tiket dari
 * pemiliknya untuk orang yang dipilih (0186).
 *
 * Deadline dan deskripsinya ikut, statusnya mulai lagi dari To Do, dan
 * penerima dikabari (notifikasi penugasan ulang, 0112). Hasilnya
 * diperiksa pemiliknya lewat QC seperti tiket biasa. Basis data menolak
 * bila penerimanya bukan orang yang boleh ditugasi pemilik to-do.
 */
export async function delegasikanToDo(
  id: string,
  input: {
    penerimaId: string;
    judul: string;
    deskripsi?: string;
    konteks?: string;
    /** Tanggal WIB, YYYY-MM-DD. */
    tanggal: string;
    /** Jam WIB, HH:MM — wajib: tiket selalu berjam. */
    jam: string;
    prioritas?: Prioritas;
  },
): Promise<Hasil> {
  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { data: lama, error: galatBaca } = await sb
    .from("tasks")
    .select("tipe, penerima_id, status")
    .eq("id", id)
    .maybeSingle();

  if (galatBaca) return gagal(`Gagal memuat to-do: ${galatBaca.message}`);
  if (!lama || lama.tipe !== "pribadi" || lama.penerima_id !== pengguna.id) {
    return gagal(PESAN_KUNCI_TODO, "izin");
  }
  if (lama.status === "selesai") {
    return gagal(
      "To-do yang sudah selesai tidak perlu didelegasikan.",
      "validasi",
    );
  }

  const cek = periksaDelegasi({
    judul: input.judul,
    penerimaId: input.penerimaId,
    idPemilik: pengguna.id,
    tanggal: input.tanggal,
    jam: input.jam,
    hariIni: hariIniTugas(),
  });
  if (!cek.ok) return gagal(cek.pesan, "validasi");

  const { data, error } = await sb
    .from("tasks")
    .update({
      tipe: "tiket",
      penerima_id: input.penerimaId,
      status: "todo",
      judul: cek.nilai.judul,
      // Deadline selalu ditulis: tiket berjam, dan tidak lampau.
      tenggat: cek.nilai.tenggat,
      tanpa_jam: false,
      ...(input.deskripsi !== undefined
        ? { deskripsi: input.deskripsi.trim() }
        : {}),
      ...(input.konteks !== undefined ? { konteks: input.konteks.trim() } : {}),
      ...(input.prioritas ? { prioritas: input.prioritas } : {}),
    })
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.message.includes("boleh kamu tugasi")) {
      return gagal(
        "Kamu hanya bisa mendelegasikan ke anggota yang kamu bawahi.",
        "izin",
      );
    }
    if (error.message.includes("Pilih bawahan")) {
      return gagal("Pilih bawahan yang akan mengerjakannya.", "validasi");
    }
    return error.code === "42501"
      ? gagal(PESAN_KUNCI_TODO, "izin")
      : gagal(`Gagal mendelegasikan: ${error.message}`);
  }
  if ((data ?? []).length === 0) {
    return gagal("To-do itu tidak ada, atau bukan milikmu.", "izin");
  }

  revalidatePath("/tugas");
  revalidatePath("/beranda");
  return sukses(undefined, "To-do didelegasikan sebagai tiket.");
}

/**
 * Edit tiket & komitmen — pemberinya atau CEO/Manager (0205), selama belum
 * selesai (0184). Pemberi dikabari bila orang lain yang mengubahnya.
 *
 * Isiannya SMART seperti tiket baru; jenisnya (tiket/komitmen) tetap.
 * Penerima boleh diganti selama tiket masih To Do dan penerima barunya
 * boleh ditugasi — basis data menjaga keduanya lagi, dan mengabari
 * penerima lama maupun baru.
 */
export async function ubahTiket(
  id: string,
  input: {
    judul: string;
    deskripsi?: string;
    kriteriaSelesai: string;
    targetAngka?: string | number | null;
    targetSatuan?: string;
    penerimaId: string;
    /** Tanggal WIB, YYYY-MM-DD. */
    tanggal: string;
    /** Jam WIB, HH:MM — wajib untuk tiket. */
    jam: string;
    prioritas?: Prioritas;
    goalId?: string | null;
  },
): Promise<Hasil> {
  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { data: lama, error: galatBaca } = await sb
    .from("tasks")
    .select(
      "tipe, pembuat_id, penerima_id, status, tenggat, tanpa_jam, kriteria_selesai, tonggak_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (galatBaca) return gagal(`Gagal memuat tiket: ${galatBaca.message}`);
  if (!lama) {
    return gagal("Tiket itu tidak ada, atau tidak terlihat olehmu.", "izin");
  }
  if (lama.tipe === "pribadi") {
    return gagal("Ini to-do pribadi, bukan tiket.", "validasi");
  }
  // Pemberinya, atau CEO/Manager (0205); database menjaga hal yang sama.
  if (lama.pembuat_id !== pengguna.id && !peranLintasUnit(pengguna.role)) {
    return gagal(PESAN_KUNCI_TIKET, "izin");
  }
  if (lama.status === "selesai") return gagal(PESAN_TIKET_SELESAI, "validasi");

  const gantiPenerima = input.penerimaId !== lama.penerima_id;
  if (gantiPenerima && lama.status !== "todo") {
    return gagal(PESAN_PENERIMA_TERKUNCI, "validasi");
  }

  const cek = periksaUbahTiket({
    judul: input.judul,
    penerimaId: input.penerimaId,
    tipe: lama.tipe,
    goalId: input.goalId,
    kriteriaSelesai: input.kriteriaSelesai,
    targetAngka: input.targetAngka,
    targetSatuan: input.targetSatuan,
    tanggal: input.tanggal,
    jam: input.jam,
    hariIni: hariIniTugas(),
    lama: tenggatLama(lama.tenggat, lama.tanpa_jam),
    kriteriaLama: lama.kriteria_selesai,
  });
  if (!cek.ok) return gagal(cek.pesan, "validasi");

  // Tenggat tiket GRD punya jalurnya sendiri ("Ubah deadline", hanya
  // CEO/Manager); form edit tidak menggesernya diam-diam (0200).
  if (lama.tonggak_id !== null && cek.nilai.tenggatBerubah) {
    return gagal(PESAN_TENGGAT_GRD, "izin");
  }

  const { data, error } = await sb
    .from("tasks")
    .update({
      judul: cek.nilai.judul,
      kriteria_selesai: cek.nilai.kriteriaSelesai,
      ...(adaTarget(input)
        ? {
            target_angka: cek.nilai.targetAngka,
            target_satuan: cek.nilai.targetSatuan,
          }
        : {}),
      goal_id: cek.nilai.goalId,
      ...(input.deskripsi !== undefined
        ? { deskripsi: input.deskripsi.trim() }
        : {}),
      ...(input.prioritas ? { prioritas: input.prioritas } : {}),
      ...(gantiPenerima ? { penerima_id: input.penerimaId } : {}),
      ...(cek.nilai.tenggatBerubah
        ? { tenggat: cek.nilai.tenggat, tanpa_jam: cek.nilai.tanpaJam }
        : {}),
    })
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.message.includes("sudah selesai")) {
      return gagal(PESAN_TIKET_SELESAI, "validasi");
    }
    if (error.message.includes("belum mulai dikerjakan")) {
      return gagal(PESAN_PENERIMA_TERKUNCI, "validasi");
    }
    if (error.message.includes("boleh kamu tugasi")) {
      return gagal(
        "Penerima baru harus anggota yang boleh kamu tugasi.",
        "izin",
      );
    }
    if (error.message.includes("tasks_komitmen_punya_goal")) {
      return gagal(
        "Komitmen mingguan harus terhubung ke sebuah goal.",
        "validasi",
      );
    }
    return error.code === "42501"
      ? gagal(PESAN_KUNCI_TIKET, "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }
  if ((data ?? []).length === 0) {
    return gagal(
      "Tiket itu tidak ada, atau bukan tiket yang boleh kamu ubah.",
      "izin",
    );
  }

  revalidatePath("/tugas");
  revalidatePath("/beranda");
  return sukses(
    undefined,
    gantiPenerima ? "Tiket dialihkan ke penerima baru." : "Tiket diperbarui.",
  );
}

/**
 * Hapus to-do (oleh pemiliknya) atau tiket (oleh pemberinya).
 *
 * Tiket yang sudah selesai boleh dihapus pemberinya, kecuali ikut KPI bulan
 * yang sudah dikunci (0206). Tiket dari rencana GRD: pemberinya yang
 * CEO/Manager; tonggaknya ditandai supaya tidak dibuatkan tiket lagi.
 * Penerima tiket dikabari basis data; to-do tidak mengabari siapa pun.
 */
export async function hapusTugas(id: string): Promise<Hasil> {
  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { data: lama, error: galatBaca } = await sb
    .from("tasks")
    .select("tipe, pembuat_id, penerima_id, status, tonggak_id")
    .eq("id", id)
    .maybeSingle();

  if (galatBaca) return gagal(`Gagal memuat tugas: ${galatBaca.message}`);
  if (!lama) {
    return gagal("Tugas itu tidak ada, atau tidak terlihat olehmu.", "izin");
  }
  const todo = lama.tipe === "pribadi";
  const pemilik = todo ? lama.penerima_id : lama.pembuat_id;
  if (pemilik !== pengguna.id) {
    return gagal(
      todo
        ? "Hanya pemilik to-do yang bisa menghapusnya."
        : "Hanya pemberi tiket yang bisa menghapusnya.",
      "izin",
    );
  }
  // Tiket dari rencana GRD: pemberinya yang CEO/Manager (0206). Tonggaknya
  // lalu tidak dibuatkan tiket lagi.
  if (lama.tonggak_id !== null && !peranLintasUnit(pengguna.role)) {
    return gagal(PESAN_HAPUS_TIKET_GRD, "izin");
  }

  // Sama seperti update: RLS menolak dengan tidak mencocokkan baris, jadi
  // yang menentukan adalah baris yang benar-benar terhapus.
  const { data, error } = await sb
    .from("tasks")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.message.includes("rencana GRD hanya bisa dihapus")) {
      return gagal(PESAN_HAPUS_TIKET_GRD, "izin");
    }
    // Tiket selesai yang ikut KPI bulan terkunci, atau bulan GRD terkunci:
    // pesan databasenya sudah jelas.
    return error.code === "check_violation" || error.code === "23514"
      ? gagal(error.message, "validasi")
      : gagal(`Gagal menghapus: ${error.message}`);
  }
  if ((data ?? []).length === 0) {
    return gagal(
      "Tugas itu tidak ada, atau bukan tugas yang boleh kamu hapus.",
      "izin",
    );
  }

  revalidatePath("/tugas");
  revalidatePath("/beranda");
  // Tonggaknya kini dikelola manual (0206).
  if (lama.tonggak_id !== null) revalidatePath("/grd/rencana");
  return sukses(undefined, todo ? "To-do dihapus." : "Tiket dihapus.");
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
