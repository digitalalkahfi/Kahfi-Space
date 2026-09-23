// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { isiEksporLama } from "@/lib/data/migrasi";
import {
  resolusiOrang,
  type HasilResolusi,
  type OrangBaru,
  type OrangLama,
} from "@/lib/resolusi-orang";
import type { Kamus } from "@/lib/impor";

/**
 * Menautkan orang V1 ke orang V2, dan menyiapkan kamus untuk pemetaan.
 *
 * Penautan ini yang menentukan apakah laporan lama punya pelapor yang
 * benar. Keputusan yang sudah diambil orang (`migrasi_orang_pending`)
 * selalu menang atas hasil penautan otomatis — kalau tidak, keputusan
 * yang sudah diambil bisa tertimpa tiap kali pemetaan diulang.
 */

/** Daftar orang di ekspor lama. */
export async function orangLamaEkspor(): Promise<OrangLama[]> {
  const isi = await isiEksporLama();
  const daftar = isi["users:list"];
  if (!Array.isArray(daftar)) return [];

  return daftar
    .filter(
      (o): o is Record<string, unknown> => o !== null && typeof o === "object",
    )
    .map((o) => ({
      id: typeof o.id === "string" ? o.id : "",
      nama: typeof o.name === "string" ? o.name : "",
      // Ekspor lama yang sebenarnya menyebut surel sebagai `gmail`.
      email:
        typeof o.email === "string"
          ? o.email
          : typeof o.gmail === "string"
            ? o.gmail
            : null,
    }))
    .filter((o) => o.id !== "");
}

/** Daftar orang di V2. */
async function orangBaru(): Promise<OrangBaru[]> {
  if (modeData() === "demo") {
    return dataContoh.users.map((u) => ({
      id: u.id,
      nama: u.nama,
      email: u.email,
    }));
  }

  const sb = await klienServer();
  const { data, error } = await sb.from("users").select("id, nama, email");
  if (error || !data) return [];
  return data.map((u) => ({ id: u.id, nama: u.nama, email: u.email }));
}

export type ResolusiTersimpan = {
  /** Id lama → id V2, dari keputusan yang sudah diambil orang. */
  keputusan: Record<string, string>;
  /** Id lama yang sengaja diabaikan; datanya tetap tanpa penunjuk. */
  diabaikan: string[];
};

/** Keputusan penautan yang sudah tersimpan. */
export async function keputusanOrang(): Promise<ResolusiTersimpan> {
  if (modeData() === "demo") return { keputusan: {}, diabaikan: [] };

  const sb = await klienServer();
  const [peta, pending] = await Promise.all([
    sb
      .from("migrasi_peta")
      .select("id_lama, id_baru")
      .eq("kelompok", "users:list"),
    sb.from("migrasi_orang_pending").select("id_lama, user_id, diabaikan"),
  ]);

  const keputusan: Record<string, string> = {};
  for (const p of peta.data ?? []) keputusan[p.id_lama] = p.id_baru;
  for (const p of pending.data ?? []) {
    if (p.user_id) keputusan[p.id_lama] = p.user_id;
  }

  return {
    keputusan,
    diabaikan: (pending.data ?? [])
      .filter((p) => p.diabaikan)
      .map((p) => p.id_lama),
  };
}

/**
 * Penautan orang V1 → V2, hasil otomatis digabung keputusan tersimpan.
 *
 * Yang sudah diputuskan orang tidak ikut dinilai ulang; ia hanya
 * dipindahkan ke daftar padanan dengan cara "email" supaya layar tidak
 * perlu tahu bedanya.
 */
export async function resolusiOrangV1(): Promise<HasilResolusi> {
  const [lama, baru, tersimpan] = await Promise.all([
    orangLamaEkspor(),
    orangBaru(),
    keputusanOrang(),
  ]);

  const otomatis = resolusiOrang(lama, baru);
  const namaLama = new Map(lama.map((o) => [o.id, o.nama]));

  // Keputusan orang menang; sisanya tetap seperti hasil otomatis.
  const padanan = otomatis.padanan.filter(
    (p) => !(p.idLama in tersimpan.keputusan),
  );
  for (const [idLama, idBaru] of Object.entries(tersimpan.keputusan)) {
    padanan.push({
      idLama,
      idBaru,
      nama: namaLama.get(idLama) ?? idLama,
      cara: "email",
    });
  }

  const belum = otomatis.belum.filter(
    (b) =>
      !(b.idLama in tersimpan.keputusan) &&
      !tersimpan.diabaikan.includes(b.idLama),
  );

  return { padanan, belum };
}

/**
 * Kamus pemetaan: nilai apa adanya dari ekspor lama → id V2.
 *
 * Akun didaftarkan dua kali, lewat id lamanya dan lewat username-nya,
 * karena ekspor lama menyebutnya dengan dua bentuk berbeda di tempat
 * yang berbeda.
 */
export async function bangunKamusV1(): Promise<Kamus> {
  const [resolusi, isi] = await Promise.all([
    resolusiOrangV1(),
    isiEksporLama(),
  ]);

  const pengguna: Record<string, string> = {};
  for (const p of resolusi.padanan) pengguna[p.idLama] = p.idBaru;

  const akun: Record<string, string> = {};
  const unit: Record<string, string> = {};
  const program: Record<string, string> = {};

  if (modeData() === "demo") {
    for (const u of dataContoh.units) {
      unit[u.kode] = u.id;
      unit[u.nama] = u.id;
    }
    for (const p of dataContoh.programs) program[p.nama] = p.id;
    for (const a of dataContoh.accounts) akun[a.username] = a.id;
  } else {
    const sb = await klienServer();
    const [unitDb, programDb, akunDb, petaAkun] = await Promise.all([
      sb.from("units").select("id, kode, nama"),
      sb.from("programs").select("id, nama"),
      sb.from("accounts").select("id, username"),
      sb
        .from("migrasi_peta")
        .select("id_lama, id_baru")
        .eq("kelompok", "affiliate-accounts:all"),
    ]);

    for (const u of unitDb.data ?? []) {
      unit[u.kode] = u.id;
      unit[u.nama] = u.id;
    }
    for (const p of programDb.data ?? []) program[p.nama] = p.id;
    for (const a of akunDb.data ?? []) akun[a.username] = a.id;
    for (const p of petaAkun.data ?? []) akun[p.id_lama] = p.id_baru;
  }

  // Id akun lama ikut didaftarkan lewat username-nya, supaya kunci GMV
  // yang menyebut accountId tetap ketemu meski akunnya belum dipetakan.
  const daftarAkun = isi["affiliate-accounts:all"];
  if (Array.isArray(daftarAkun)) {
    for (const a of daftarAkun) {
      if (a === null || typeof a !== "object") continue;
      const baris = a as Record<string, unknown>;
      const idLama = typeof baris.id === "string" ? baris.id : null;
      const username =
        typeof baris.username === "string" ? baris.username : null;
      if (idLama && username && akun[username] && !akun[idLama]) {
        akun[idLama] = akun[username];
      }
    }
  }

  return { unit, program, pengguna, akun };
}

export type TautanOrang = {
  idLama: string;
  namaLama: string;
  idBaru: string;
  namaBaru: string;
  cara: "email" | "nama";
  /** Benar bila tautannya sudah tersimpan, bukan hasil dugaan sesaat. */
  tersimpan: boolean;
};

/**
 * Orang yang sudah tertaut, beserta bagaimana tautannya terjadi.
 *
 * Yang tertaut lewat surel praktis pasti benar — surel kerja unik dan
 * memang dipakai masuk. Yang tertaut lewat nama tidak: dua orang bisa
 * bernama sama, dan satu orang bisa berganti nama. Karena itu keduanya
 * dibedakan di sini, supaya yang lemah bisa ditinjau sebelum migrasi
 * sungguhan dijalankan — bukan sesudah datanya menempel pada orang yang
 * keliru.
 */
export async function tautanOrang(): Promise<TautanOrang[]> {
  const [resolusi, lama, baru, tersimpan] = await Promise.all([
    resolusiOrangV1(),
    orangLamaEkspor(),
    orangBaru(),
    keputusanOrang(),
  ]);

  const namaLama = new Map(lama.map((o) => [o.id, o.nama]));
  const namaBaru = new Map(baru.map((o) => [o.id, o.nama]));

  return resolusi.padanan
    .map((p) => ({
      idLama: p.idLama,
      namaLama: namaLama.get(p.idLama) ?? p.nama,
      idBaru: p.idBaru,
      namaBaru: namaBaru.get(p.idBaru) ?? "(tidak ditemukan)",
      cara: p.cara,
      tersimpan: p.idLama in tersimpan.keputusan,
    }))
    .sort(
      (a, b) =>
        Number(a.cara === "email") - Number(b.cara === "email") ||
        a.namaLama.localeCompare(b.namaLama),
    );
}
