"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { bolehKelolaAkun } from "@/lib/data/akun";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import { levelSah, LEVEL_MAKS, LEVEL_MIN } from "@/lib/batas-minimum";
import { kodeUnitSah } from "@/lib/unit-pelaporan";
import type { KodeUnit } from "@/lib/types";

/** Username akun: diawali @, huruf/angka/titik/garis bawah. */
const POLA_USERNAME = /^@[a-z0-9._]{3,30}$/i;

function segarkan() {
  revalidatePath("/grd");
  revalidatePath("/grd/akun");
  revalidatePath("/laporan-harian");
}

/**
 * Tunjuk atau lepas PIC sebuah akun.
 *
 * Mengganti PIC memindahkan kewajiban Laporan Harian akun itu, jadi
 * perubahannya sengaja dibuat eksplisit satu akun pada satu waktu.
 */
export async function ubahPicAkun(input: {
  akunId: string;
  picId: string | null;
}): Promise<Hasil> {
  if (!input.akunId) return gagal("Akun tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAkun(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh mengubah PIC.", "izin");
  }

  const sb = await klienServer();

  if (input.picId) {
    // PIC wajib staf aktif di unit akun tersebut — kalau tidak, kewajiban
    // laporan harian jatuh ke orang yang tidak memegang unit itu.
    const { data: akun, error: galatAkun } = await sb
      .from("accounts")
      .select("unit_id")
      .eq("id", input.akunId)
      .maybeSingle();

    if (galatAkun) return gagal(`Gagal memeriksa akun: ${galatAkun.message}`);
    if (!akun) return gagal("Akun tidak ditemukan.", "validasi");

    const { data: calon, error: galatCalon } = await sb
      .from("users")
      .select("id, role, status, unit_id")
      .eq("id", input.picId)
      .maybeSingle();

    if (galatCalon)
      return gagal(`Gagal memeriksa calon PIC: ${galatCalon.message}`);
    if (!calon || calon.status !== "aktif") {
      return gagal("Calon PIC tidak aktif.", "validasi");
    }
    if (calon.role !== "Staff") {
      return gagal("PIC akun harus berperan Staff.", "validasi");
    }
    if (calon.unit_id !== akun.unit_id) {
      return gagal("PIC harus berasal dari unit akun tersebut.", "validasi");
    }
  }

  const { error } = await sb
    .from("accounts")
    .update({ pic_user_id: input.picId })
    .eq("id", input.akunId);

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah akun ini.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkan();
  return sukses(
    undefined,
    input.picId ? "PIC akun diperbarui." : "PIC akun dilepas.",
  );
}

/**
 * Aktifkan atau nonaktifkan akun.
 * Akun dinonaktifkan, bukan dihapus, supaya riwayat GMV-nya tetap utuh.
 */
export async function ubahStatusAkun(input: {
  akunId: string;
  status: "aktif" | "nonaktif";
}): Promise<Hasil> {
  if (!input.akunId) return gagal("Akun tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAkun(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh mengubah akun.", "izin");
  }

  const sb = await klienServer();
  const { error } = await sb
    .from("accounts")
    .update({ status: input.status })
    .eq("id", input.akunId);

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah akun ini.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkan();
  return sukses(
    undefined,
    input.status === "aktif"
      ? "Akun diaktifkan kembali."
      : "Akun dinonaktifkan; riwayat GMV-nya tetap tersimpan.",
  );
}

/** Tambah akun baru beserta PIC dan programnya. */
export async function tambahAkun(input: {
  username: string;
  unitKode: KodeUnit;
  programId: string | null;
  picId: string | null;
}): Promise<Hasil> {
  const username = input.username.trim();
  if (!POLA_USERNAME.test(username)) {
    return gagal(
      "Username diawali @ dan terdiri dari 3–30 huruf, angka, titik, atau garis bawah.",
      "validasi",
    );
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAkun(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh menambah akun.", "izin");
  }

  const sb = await klienServer();
  const { data: unit, error: galatUnit } = await sb
    .from("units")
    .select("id")
    .eq("kode", input.unitKode)
    .maybeSingle();

  if (galatUnit) return gagal(`Gagal memeriksa unit: ${galatUnit.message}`);
  if (!unit) return gagal("Unit tidak dikenali.", "validasi");

  const { error } = await sb.from("accounts").insert({
    platform: "TikTok Shop",
    username,
    unit_id: unit.id,
    program_id: input.programId,
    pic_user_id: input.picId,
  });

  if (error) {
    if (error.code === "23505") {
      return gagal("Akun dengan username itu sudah terdaftar.", "validasi");
    }
    return error.code === "42501"
      ? gagal("Kamu tidak berhak menambah akun.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkan();
  return sukses(undefined, `Akun ${username} ditambahkan.`);
}

/**
 * Tunjuk atau lepas co-leader sebuah akun.
 *
 * Kolom ini bukan sekadar keterangan: co-leader ikut melihat akun beserta
 * GMV dan laporan hariannya. Karena itu calonnya dibatasi pimpinan aktif di
 * unit akun tersebut — sama seperti penjagaan database 0061.
 */
export async function ubahCoLeaderAkun(input: {
  akunId: string;
  coLeaderId: string | null;
}): Promise<Hasil> {
  if (!input.akunId) return gagal("Akun tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAkun(pengguna)) {
    return gagal(
      "Hanya CEO atau Manager yang boleh mengubah co-leader.",
      "izin",
    );
  }

  const sb = await klienServer();

  if (input.coLeaderId) {
    const { data: akun, error: galatAkun } = await sb
      .from("accounts")
      .select("unit_id")
      .eq("id", input.akunId)
      .maybeSingle();

    if (galatAkun) return gagal(`Gagal memeriksa akun: ${galatAkun.message}`);
    if (!akun) return gagal("Akun tidak ditemukan.", "validasi");

    const { data: calon, error: galatCalon } = await sb
      .from("users")
      .select("id, role, status, unit_id")
      .eq("id", input.coLeaderId)
      .maybeSingle();

    if (galatCalon) {
      return gagal(`Gagal memeriksa calon co-leader: ${galatCalon.message}`);
    }
    if (!calon || calon.status !== "aktif") {
      return gagal("Calon co-leader tidak aktif.", "validasi");
    }
    if (calon.role !== "Leader" && calon.role !== "Co-Leader") {
      return gagal("Co-leader akun harus Leader atau Co-Leader.", "validasi");
    }
    if (calon.unit_id !== akun.unit_id) {
      return gagal(
        "Co-leader harus berasal dari unit akun tersebut.",
        "validasi",
      );
    }
  }

  const { error } = await sb
    .from("accounts")
    .update({ co_leader_id: input.coLeaderId })
    .eq("id", input.akunId);

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah akun ini.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkan();
  return sukses(
    undefined,
    input.coLeaderId
      ? "Co-leader akun diperbarui."
      : "Co-leader akun dilepas; aksesnya ke akun ini ikut berhenti.",
  );
}

/**
 * Pindahkan akun ke program lain (mis. Reguler → Mabit Scholar).
 * Program harus milik unit akun itu — database menjaganya sejak 0043.
 */
export async function ubahProgramAkun(input: {
  akunId: string;
  programId: string | null;
}): Promise<Hasil> {
  if (!input.akunId) return gagal("Akun tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAkun(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh mengubah program.", "izin");
  }

  const sb = await klienServer();
  const { error } = await sb
    .from("accounts")
    .update({ program_id: input.programId })
    .eq("id", input.akunId);

  if (error) {
    if (error.code === "42501") {
      return gagal("Kamu tidak berhak mengubah akun ini.", "izin");
    }
    return error.code === "P0001"
      ? gagal(error.message, "validasi")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  segarkan();
  return sukses(undefined, "Program akun diperbarui.");
}

/**
 * Ubah level sebuah akun beserta alasannya.
 *
 * Levelnya menentukan batas minimum unggahan harian PIC-nya, jadi
 * menaikkannya berarti menaikkan beban orang — karena itu alasannya
 * wajib, dan jejaknya ditulis database, bukan oleh layar ini.
 */
export async function ubahLevelAkun(input: {
  akunId: string;
  level: number;
  alasan: string;
}): Promise<Hasil> {
  if (!input.akunId) return gagal("Akun tidak dikenali.", "validasi");
  if (!levelSah(input.level)) {
    return gagal(
      `Level harus antara ${LEVEL_MIN} dan ${LEVEL_MAKS}.`,
      "validasi",
    );
  }
  if (input.alasan.trim().length < 10) {
    return gagal(
      "Tulis alasan perubahan level, minimal 10 karakter.",
      "validasi",
    );
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAkun(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh mengubah level.", "izin");
  }

  const sb = await klienServer();
  const { error } = await sb.rpc("ubah_level_akun", {
    p_account_id: input.akunId,
    p_level: input.level,
    p_alasan: input.alasan.trim(),
  });

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah akun ini.", "izin")
      : gagal(error.message, "validasi");
  }

  segarkan();
  return sukses(undefined, `Level akun disetel ke ${input.level}.`);
}

/**
 * Memindahkan akun ke unit lain.
 *
 * Bukan sekadar mengganti satu kolom: PIC dan co-leader wajib berasal
 * dari unit akun itu (migrasi 0038 & 0061), dan programnya menempel
 * pada unit pula. Memindahkan unit tanpa melepas ketiganya akan
 * ditolak database — jadi dilepas di sini, secara sadar, dan
 * pemanggilnya diberi tahu apa yang ikut terlepas.
 */
export async function pindahUnitAkun(input: {
  akunId: string;
  unitKode: KodeUnit;
}): Promise<Hasil> {
  if (!input.akunId) return gagal("Akun tidak dikenali.", "validasi");
  if (!kodeUnitSah(input.unitKode)) {
    return gagal("Unit tujuan tidak dikenali.", "validasi");
  }

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehKelolaAkun(pengguna)) {
    return gagal("Hanya CEO atau Manager yang memindahkan akun.", "izin");
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const sb = await klienServer();
  const { data: akun, error: galatAkun } = await sb
    .from("accounts")
    .select("unit_id, pic_user_id, co_leader_id, program_id, unit:units (kode)")
    .eq("id", input.akunId)
    .maybeSingle();

  if (galatAkun) return gagal(`Gagal memeriksa akun: ${galatAkun.message}`);
  if (!akun) return gagal("Akun tidak ditemukan.", "validasi");
  if (akun.unit?.kode === input.unitKode) {
    return gagal("Akun itu sudah berada di unit tersebut.", "validasi");
  }

  const { data: unit, error: galatUnit } = await sb
    .from("units")
    .select("id, nama")
    .eq("kode", input.unitKode)
    .maybeSingle();

  if (galatUnit) return gagal(`Gagal memeriksa unit: ${galatUnit.message}`);
  if (!unit) return gagal("Unit tujuan tidak ditemukan.", "validasi");

  const { error } = await sb
    .from("accounts")
    .update({
      unit_id: unit.id,
      // Ketiganya menempel pada unit lama; tidak ada yang bisa
      // "ikut pindah" tanpa ditunjuk ulang oleh orang.
      pic_user_id: null,
      co_leader_id: null,
      program_id: null,
    })
    .eq("id", input.akunId);

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak memindahkan akun ini.", "izin")
      : gagal(`Gagal memindahkan: ${error.message}`);
  }

  segarkan();

  const dilepas = [
    akun.pic_user_id ? "PIC" : null,
    akun.co_leader_id ? "co-leader" : null,
    akun.program_id ? "program" : null,
  ].filter((x) => x !== null);

  return sukses(
    undefined,
    dilepas.length === 0
      ? `Akun dipindahkan ke ${unit.nama}.`
      : `Akun dipindahkan ke ${unit.nama}; ${dilepas.join(", ")} dilepas dan perlu ditunjuk ulang.`,
  );
}
