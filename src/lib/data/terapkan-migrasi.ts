// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { isiEksporLama } from "@/lib/data/migrasi";
import { golonganKunci } from "@/lib/ekspor-v1";
import { resolusiOrangV1 } from "@/lib/data/resolusi";
import { kontakV1, peranV1, programV1, statusV1, unitV1 } from "@/lib/peran-v1";
import { keAngka, keTanggal } from "@/lib/impor";
import {
  akunDiLaporan,
  akunV1,
  bakuAkun,
  catatanLaporan,
  medanLaporan,
  ratakanLaporan,
} from "@/lib/laporan-v1";
import { orangDitunggu } from "@/lib/rekap-pemetaan";
import { gabungGmv, gmvLaporanAkun, petaRekapAkun } from "@/lib/gmv-v1";
import {
  hariDariKejadian,
  hariIzin,
  koordinat,
  persetujuanIzin,
  statusHadir,
  tanggalWib,
} from "@/lib/izin-v1";
import {
  jejakQcDatar,
  jejakQcV1,
  prioritasV1,
  statusTugasV1,
} from "@/lib/tugas-v1";
import { arahV1, jenisKeluarV1, keteranganKas } from "@/lib/keuangan-v1";
import { PEMETAAN_V1 } from "@/lib/pemetaan-v1";
import { bacaPengumuman } from "@/lib/pengumuman-v1";
import { bacaAgenda } from "@/lib/agenda-v1";
import { bacaMasalah } from "@/lib/masalah-v1";
import { bacaMasukan } from "@/lib/masukan-v1";
import { bacaSampel } from "@/lib/sampel-v1";
import { bacaLms } from "@/lib/lms-v1";
import type { Peran } from "@/lib/types";

/**
 * Menerapkan pemetaan ekspor V1 ke tabel V2.
 *
 * Satu hal yang membedakan modul ini dari impor biasa: orang V2 tidak
 * bisa dibuat dari sini. `users.id` sama dengan `auth.users.id`, jadi
 * profil hanya ada setelah akun masuknya dibuat. Yang dikerjakan di sini
 * adalah menautkan orang V1 ke profil V2 yang sudah ada lalu melengkapi
 * profilnya — dan mengumpulkan sisanya untuk diputuskan orang, bukan
 * membuat profil hantu yang tidak pernah bisa dipakai masuk.
 */

/** Tabel tujuan yang boleh ditulis mesin migrasi. */
type TabelTujuan =
  | "users"
  | "accounts"
  | "daily_reports"
  | "attendance"
  | "tasks"
  | "transactions"
  | "announcements"
  | "agenda"
  | "problems"
  | "problem_events"
  | "feedback"
  | "feedback_comments"
  | "samples"
  | "sample_events"
  | "sample_scans"
  | "courses"
  | "course_modules"
  | "course_enrollments"
  | "module_progress";

type KlienDb = Awaited<ReturnType<typeof klienServer>>;

/**
 * Menulis satu catatan lama ke tabel tujuan, sekali saja.
 *
 * Inti idempotensinya ada di sini, di satu tempat: sebelum menulis,
 * petanya (`migrasi_peta`, 0154) ditanya apakah catatan ini sudah pernah
 * punya padanan. Kalau sudah, barisnya diperbarui; kalau belum, baris
 * baru dibuat dan padanannya dicatat.
 *
 * Petanya ditulis SESUDAH barisnya berhasil, bukan sebelum: peta yang
 * menunjuk baris yang gagal dibuat membuat pengulangan berikutnya
 * melewatinya diam-diam, dan catatan itu tidak akan pernah pindah.
 *
 * `cariLama` untuk catatan yang mungkin sudah ada di V2 tanpa lewat
 * migrasi — akun dengan username yang sama, misalnya. Tanpa itu, migrasi
 * akan membuat duplikat dari data yang sudah diketik orang sendiri.
 */
type OpsiTulis = {
  kelompok: string;
  idLama: string;
  tabel: TabelTujuan;
  isi: Record<string, unknown>;
  peta: Map<string, string>;
  cariLama?: () => Promise<string | null>;
  /**
   * Penulis khusus, untuk tabel yang aturan hariannya menutup jalur
   * biasa — kehadiran, laporan, dan arus kas (0158). Mengembalikan id
   * barisnya, atau null bila barisnya memang sudah ada.
   */
  lewatJalur?: (
    idSekarang: string | null,
  ) => Promise<{ id: string | null } | { galat: string }>;
};

async function tulisIdempoten(
  sb: KlienDb,
  opsi: OpsiTulis,
): Promise<{ id: string } | { galat: string }> {
  // Satu catatan yang gagal — termasuk karena jaringan putus di tengah
  // permintaan — tidak boleh menghentikan seluruh kelompoknya. Galatnya
  // dikembalikan sebagai hasil supaya tercatat dengan id lamanya.
  try {
    return await tulisIdempotenInti(sb, opsi);
  } catch (e) {
    return {
      galat:
        e instanceof Error ? e.message : "Kegagalan tak terduga saat menulis.",
    };
  }
}

async function tulisIdempotenInti(
  sb: KlienDb,
  opsi: OpsiTulis,
): Promise<{ id: string } | { galat: string }> {
  const sudah =
    opsi.peta.get(opsi.idLama) ??
    (opsi.cariLama ? await opsi.cariLama() : null);

  if (opsi.lewatJalur) {
    const lewat = await opsi.lewatJalur(sudah);
    if ("galat" in lewat) return lewat;
    if (!lewat.id) {
      return { galat: "Baris dengan penanda yang sama sudah ada di V2." };
    }

    const { error: galatJalur } = await sb.from("migrasi_peta").upsert(
      {
        kelompok: opsi.kelompok,
        id_lama: opsi.idLama,
        id_baru: lewat.id,
        tabel: opsi.tabel,
      },
      { onConflict: "kelompok,id_lama" },
    );
    if (galatJalur) return { galat: galatJalur.message };

    opsi.peta.set(opsi.idLama, lewat.id);
    return { id: lewat.id };
  }

  const { data: baris, error } = sudah
    ? await sb
        .from(opsi.tabel)
        .update(opsi.isi as never)
        .eq("id", sudah)
        .select("id")
        .single()
    : await sb
        .from(opsi.tabel)
        .insert(opsi.isi as never)
        .select("id")
        .single();

  if (error || !baris) {
    // Peta menunjuk baris yang sudah tidak ada (mis. dihapus orang
    // sesudah migrasi sebelumnya). Kalau dibiarkan, catatan ini akan
    // dilewati selamanya; jadi petanya dilupakan dan barisnya dibuat
    // ulang — sekali, bukan berulang.
    const hilang = sudah && (error?.code === "PGRST116" || !baris);
    if (hilang) {
      opsi.peta.delete(opsi.idLama);
      const { data: ulang, error: galatUlang } = await sb
        .from(opsi.tabel)
        .insert(opsi.isi as never)
        .select("id")
        .single();

      if (!galatUlang && ulang) {
        const { error: galatPetaUlang } = await sb.from("migrasi_peta").upsert(
          {
            kelompok: opsi.kelompok,
            id_lama: opsi.idLama,
            id_baru: ulang.id,
            tabel: opsi.tabel,
          },
          { onConflict: "kelompok,id_lama" },
        );
        if (galatPetaUlang) return { galat: galatPetaUlang.message };
        opsi.peta.set(opsi.idLama, ulang.id);
        return { id: ulang.id };
      }
    }

    return {
      galat:
        error?.code === "23505"
          ? "Baris dengan penanda yang sama sudah ada di V2."
          : (error?.message ?? "Gagal menyimpan."),
    };
  }

  const { error: galatPeta } = await sb.from("migrasi_peta").upsert(
    {
      kelompok: opsi.kelompok,
      id_lama: opsi.idLama,
      id_baru: baris.id,
      tabel: opsi.tabel,
    },
    { onConflict: "kelompok,id_lama" },
  );
  if (galatPeta) return { galat: galatPeta.message };

  opsi.peta.set(opsi.idLama, baris.id);
  return { id: baris.id };
}

/** Berapa baris peta ditarik sekali jalan; PostgREST memotong di 1000. */
const HALAMAN_PETA = 1000;

/**
 * Membaca peta sebuah kelompok sekali, untuk dipakai berulang.
 *
 * Ditarik per halaman: satu kelompok bisa lebih dari seribu catatan, dan
 * peta yang terpotong membuat catatan di luar potongan dianggap belum
 * pernah pindah — lalu dibuat lagi. Kegagalan membacanya dilempar, bukan
 * dikembalikan sebagai peta kosong, dengan alasan yang sama.
 */
async function bacaPeta(sb: KlienDb, kelompok: string) {
  const peta = new Map<string, string>();
  for (let dari = 0; ; dari += HALAMAN_PETA) {
    const { data, error } = await sb
      .from("migrasi_peta")
      .select("id_lama, id_baru")
      .eq("kelompok", kelompok)
      .order("id_lama")
      .range(dari, dari + HALAMAN_PETA - 1);
    if (error) {
      throw new Error(`Gagal membaca peta ${kelompok}: ${error.message}`);
    }
    for (const p of data ?? []) peta.set(p.id_lama, p.id_baru);
    if (!data || data.length < HALAMAN_PETA) break;
  }
  return peta;
}

export type HasilTerap = {
  kelompok: string;
  /** Catatan lama yang diperiksa. */
  diperiksa: number;
  /** Baris V2 yang ditulis (0 pada uji coba). */
  ditulis: number;
  /** Catatan yang menunggu keputusan orang. */
  tertahan: number;
  /** Penjelasan per catatan yang tidak jadi ditulis. */
  catatan: { idLama: string; pesan: string }[];
};

type BarisOrang = {
  idLama: string;
  idBaru: string;
  jabatan: string | null;
  role: Peran | null;
  unitKode: string | null;
  /** Nama program V2 yang tersirat dari divisi lama (mis. Mabit Scholar). */
  program: string | null;
  kontak: string | null;
  /** Null bila data lama tidak menyebut status; yang di V2 dibiarkan. */
  status: "aktif" | "nonaktif" | null;
  atasanLama: string | null;
};

/** Membaca users:list menjadi baris yang siap ditulis. */
function bacaOrang(
  isi: Record<string, unknown>,
  padanan: Map<string, string>,
): { siap: BarisOrang[]; tertahan: { idLama: string; pesan: string }[] } {
  const daftar = Array.isArray(isi["users:list"]) ? isi["users:list"] : [];
  const siap: BarisOrang[] = [];
  const tertahan: { idLama: string; pesan: string }[] = [];

  for (const o of daftar) {
    if (o === null || typeof o !== "object") continue;
    const baris = o as Record<string, unknown>;
    const idLama = typeof baris.id === "string" ? baris.id : "";
    if (idLama === "") continue;

    const idBaru = padanan.get(idLama);
    if (!idBaru) {
      tertahan.push({
        idLama,
        pesan: "Belum tertaut ke profil V2; menunggu keputusan.",
      });
      continue;
    }

    const role = peranV1(baris.role, baris.division);
    if (baris.role !== undefined && baris.role !== null && role === null) {
      // Peran yang tidak dikenali tidak ditebak: yang lain tetap
      // diperbarui, perannya saja yang dibiarkan seperti semula.
      tertahan.push({
        idLama,
        pesan: `Peran '${String(baris.role)}' tidak dikenali; peran V2 dibiarkan seperti sekarang.`,
      });
    }

    siap.push({
      idLama,
      idBaru,
      // Ekspor lama yang sebenarnya menyebut jabatan sebagai `jobTitle`.
      jabatan:
        typeof baris.position === "string"
          ? baris.position
          : typeof baris.jobTitle === "string"
            ? baris.jobTitle
            : null,
      role,
      unitKode: unitV1(baris.division),
      program: programV1(baris.division),
      // Nomor dibakukan ke +62…; yang tidak bisa dibakukan dibiarkan.
      kontak: kontakV1(baris.phone),
      // Status hanya dipindahkan bila data lama memang menyebutnya. Ekspor
      // yang sebenarnya tidak punya medan `active` sama sekali — menganggap
      // semuanya aktif akan mengaktifkan kembali orang yang sudah
      // dinonaktifkan di V2.
      status:
        baris.active === undefined || baris.active === null
          ? null
          : statusV1(baris.active),
      atasanLama: typeof baris.leaderId === "string" ? baris.leaderId : null,
    });
  }

  return { siap, tertahan };
}

/**
 * Menerapkan `users:list`: menautkan orang, melengkapi profil, lalu
 * memasang atasannya.
 *
 * Atasan dipasang pada langkah kedua karena `leaderId` menunjuk orang
 * lain di daftar yang sama — memasangnya sekaligus berarti setengahnya
 * pasti menunjuk orang yang belum sempat ditautkan.
 */
export async function terapkanUsersList(
  tahap: "uji_coba" | "sungguhan",
): Promise<HasilTerap> {
  const [isi, resolusi] = await Promise.all([
    isiEksporLama(),
    resolusiOrangV1(),
  ]);

  const padanan = new Map(resolusi.padanan.map((p) => [p.idLama, p.idBaru]));
  const { siap, tertahan } = bacaOrang(isi, padanan);

  const hasil: HasilTerap = {
    kelompok: "users:list",
    diperiksa: siap.length + resolusi.belum.length,
    ditulis: 0,
    tertahan: resolusi.belum.length,
    catatan: [
      ...resolusi.belum.map((b) => ({ idLama: b.idLama, pesan: b.alasan })),
      ...tertahan,
    ],
  };

  if (tahap === "uji_coba" || modeData() === "demo") return hasil;

  const sb = await klienServer();

  // Kode unit → id, program per unit, dan peran V2 saat ini, dibaca sekali.
  const [{ data: unitDb }, { data: programDb }, { data: peranDb }] =
    await Promise.all([
      sb.from("units").select("id, kode"),
      sb.from("programs").select("id, nama, unit_id"),
      sb.from("users").select("id, role"),
    ]);
  const unitId = new Map<string, string>(
    (unitDb ?? []).map((u) => [u.kode as string, u.id]),
  );
  // Program dikenali per (unit, nama): "Reguler" ada di tiap unit.
  const programId = new Map<string, string>(
    (programDb ?? []).map((p) => [`${p.unit_id}#${p.nama}`, p.id]),
  );
  const peranSekarang = new Map<string, string>(
    (peranDb ?? []).map((u) => [u.id, u.role as string]),
  );

  for (const o of siap) {
    const patch: Record<string, unknown> = {};
    if (o.status !== null) patch.status = o.status;
    if (o.jabatan !== null) patch.jabatan = o.jabatan;
    if (o.role !== null) {
      // Pemilik sistem tidak diturunkan oleh migrasi: sebutan peran di
      // sistem lama tidak lebih benar daripada wewenang yang sudah
      // ditetapkan di V2, dan CEO yang kehilangan perannya tidak bisa
      // memperbaikinya sendiri.
      if (peranSekarang.get(o.idBaru) === "CEO" && o.role !== "CEO") {
        hasil.catatan.push({
          idLama: o.idLama,
          pesan: `Di V2 orang ini CEO; peran lama '${o.role}' tidak diterapkan.`,
        });
      } else {
        patch.role = o.role;
      }
    }
    if (o.kontak !== null) patch.kontak = o.kontak;
    if (o.unitKode !== null) {
      const unit = unitId.get(o.unitKode) ?? null;
      patch.unit_id = unit;
      // Program hanya dipasang bila memang ada di unitnya (0043).
      if (unit && o.program !== null) {
        const program = programId.get(`${unit}#${o.program}`);
        if (program) patch.program_id = program;
      }
    }

    const { error } = await sb
      .from("users")
      .update(patch as never)
      .eq("id", o.idBaru);

    if (error) {
      hasil.catatan.push({ idLama: o.idLama, pesan: error.message });
      continue;
    }

    // Petanya ditulis setelah barisnya benar-benar berubah, bukan
    // sebelum: peta yang menunjuk pembaruan yang gagal membuat
    // pengulangan berikutnya melewatinya diam-diam.
    const { error: galatPeta } = await sb.from("migrasi_peta").upsert(
      {
        kelompok: "users:list",
        id_lama: o.idLama,
        id_baru: o.idBaru,
        tabel: "users",
      },
      { onConflict: "kelompok,id_lama" },
    );
    if (galatPeta) {
      hasil.catatan.push({ idLama: o.idLama, pesan: galatPeta.message });
      continue;
    }

    hasil.ditulis += 1;
  }

  // Langkah kedua: atasan, setelah semua orang punya padanan.
  for (const o of siap) {
    if (!o.atasanLama) continue;
    const atasan = padanan.get(o.atasanLama);
    if (!atasan) {
      hasil.catatan.push({
        idLama: o.idLama,
        pesan: `Atasannya (${o.atasanLama}) belum tertaut; atasan dibiarkan kosong.`,
      });
      continue;
    }
    if (atasan === o.idBaru) {
      // Basis data menolaknya juga; ditangkap di sini supaya pesannya
      // menyebut orangnya, bukan nomor kendala.
      hasil.catatan.push({
        idLama: o.idLama,
        pesan: "Di data lama orang ini menjadi atasan dirinya sendiri.",
      });
      continue;
    }

    const { error } = await sb
      .from("users")
      .update({ atasan_id: atasan })
      .eq("id", o.idBaru);
    if (error) {
      hasil.catatan.push({ idLama: o.idLama, pesan: error.message });
    }
  }

  // Orang yang belum tertaut dicatat supaya bisa diputuskan dari layar.
  if (resolusi.belum.length > 0) {
    const { error } = await sb.from("migrasi_orang_pending").upsert(
      resolusi.belum.map((b) => ({
        id_lama: b.idLama,
        nama: b.nama,
        alasan: b.alasan,
        kemunculan: ["users:list"],
      })),
      { onConflict: "id_lama" },
    );
    if (error) {
      hasil.catatan.push({ idLama: "-", pesan: error.message });
    }
  }

  return hasil;
}

/** Platform seluruh akun lama; V1 hanya mengenal satu. */
const PLATFORM_LAMA = "TikTok Shop";

/**
 * Unit akun yang ekspornya tidak menyebut divisi.
 *
 * Ekspor K-Space lama yang sebenarnya tidak punya medan divisi pada akun
 * sama sekali: seluruh akun affiliator memang akun unit affiliator.
 */
const UNIT_AKUN_BAWAAN = "affiliator";

/**
 * Menerapkan `affiliate-accounts:all`.
 *
 * Berbeda dari orang, akun boleh dibuat dari sini: id-nya tidak terikat
 * akun masuk siapa pun. Yang menentukan sebuah akun sudah ada atau belum
 * adalah petanya lebih dulu, baru username-nya — kalau hanya username,
 * akun yang di V2 sengaja diganti namanya akan dibuat ulang sebagai akun
 * kedua yang isinya sama.
 */
export async function terapkanAkun(
  tahap: "uji_coba" | "sungguhan",
): Promise<HasilTerap> {
  const [isi, resolusi] = await Promise.all([
    isiEksporLama(),
    resolusiOrangV1(),
  ]);

  const orang = new Map(resolusi.padanan.map((p) => [p.idLama, p.idBaru]));
  const daftar = Array.isArray(isi["affiliate-accounts:all"])
    ? (isi["affiliate-accounts:all"] as unknown[])
    : [];

  const hasil: HasilTerap = {
    kelompok: "affiliate-accounts:all",
    diperiksa: daftar.length,
    ditulis: 0,
    tertahan: 0,
    catatan: [],
  };

  type Siap = {
    idLama: string;
    username: string;
    unitKode: string;
    program: string | null;
    pic: string | null;
    coLeader: string | null;
    status: "aktif" | "nonaktif";
  };

  // Siapa melaporkan akun mana, dari laporan lama: sumber akun yang sudah
  // ditutup sebelum ekspor, dan sumber PIC (lihat di bawah).
  const dariLaporan = akunDiLaporan(
    Array.isArray(isi["daily-reports:all"]) ? isi["daily-reports:all"] : [],
  );

  const siap: Siap[] = [];
  for (const a of daftar) {
    if (a === null || typeof a !== "object") continue;
    const baris = a as Record<string, unknown>;
    const idLama = typeof baris.id === "string" ? baris.id : "";
    // Ekspor lama yang sebenarnya menyebut username akun sebagai `name`.
    const username =
      typeof baris.username === "string"
        ? baris.username.trim()
        : typeof baris.name === "string"
          ? baris.name.trim()
          : "";
    const divisiDisebut =
      baris.division !== undefined &&
      baris.division !== null &&
      baris.division !== "";
    const unitKode = divisiDisebut ? unitV1(baris.division) : UNIT_AKUN_BAWAAN;

    if (idLama === "" || username === "") {
      hasil.tertahan += 1;
      hasil.catatan.push({
        idLama: idLama || "(tanpa id)",
        pesan: "Akun tanpa id atau tanpa username tidak bisa dipetakan.",
      });
      continue;
    }
    if (!unitKode) {
      // Unit wajib di V2; menebaknya menaruh akun di departemen yang
      // salah, dan seluruh GMV-nya ikut salah tempat.
      hasil.tertahan += 1;
      hasil.catatan.push({
        idLama,
        pesan: `Divisi '${String(baris.division ?? "")}' tidak dikenali; unit wajib diisi.`,
      });
      continue;
    }

    if (!divisiDisebut) {
      hasil.catatan.push({
        idLama,
        pesan: `Divisi tidak disebut; akun masuk ke unit ${UNIT_AKUN_BAWAAN}.`,
      });
    }

    const picLama = typeof baris.picId === "string" ? baris.picId : null;
    const coLama =
      typeof baris.coLeaderId === "string" ? baris.coLeaderId : null;
    if (picLama && !orang.has(picLama)) {
      hasil.catatan.push({
        idLama,
        pesan: `PIC-nya (${picLama}) belum tertaut; akun masuk tanpa PIC.`,
      });
    }

    siap.push({
      idLama,
      username,
      unitKode,
      program: typeof baris.program === "string" ? baris.program : null,
      pic: picLama ? (orang.get(picLama) ?? null) : null,
      coLeader: coLama ? (orang.get(coLama) ?? null) : null,
      status: statusV1(baris.active),
    });
  }

  // Akun yang disebut laporan lama tetapi tidak ada di daftar akun: sudah
  // ditutup sebelum ekspor (mis. hawnahijab_, Jul 2026). Dibuat nonaktif
  // supaya laporannya punya tempat, bukan dibuang bersama laporannya.
  const terdaftar = new Set(siap.map((a) => akunV1(a.username)));
  for (const [baku, info] of dariLaporan) {
    if (terdaftar.has(baku)) continue;
    const idLama = `laporan-akun:${baku}`;
    hasil.diperiksa += 1;
    hasil.catatan.push({
      idLama,
      pesan: `Akun '${info.username}' tidak ada di daftar akun lama; dibuat nonaktif dari ${info.jumlah} laporan yang menyebutnya.`,
    });
    siap.push({
      idLama,
      username: info.username,
      unitKode: UNIT_AKUN_BAWAAN,
      program: null,
      pic: null,
      coLeader: null,
      status: "nonaktif",
    });
  }

  if (tahap === "uji_coba" || modeData() === "demo") return hasil;

  const sb = await klienServer();
  const [unitDb, programDb, orangDb, peta] = await Promise.all([
    sb.from("units").select("id, kode"),
    sb.from("programs").select("id, nama"),
    sb.from("users").select("id, nama, role, unit_id, status"),
    bacaPeta(sb, "affiliate-accounts:all"),
  ]);

  const unitId = new Map<string, string>(
    (unitDb.data ?? []).map((u) => [u.kode as string, u.id]),
  );
  const programId = new Map<string, string>(
    (programDb.data ?? []).map((p) => [p.nama, p.id]),
  );
  const orangDbId = new Map((orangDb.data ?? []).map((o) => [o.id, o]));

  /**
   * Penanggung jawab hanya dipasang bila V2 menerimanya (0038, 0061):
   * PIC harus Staff aktif di unit akun, co-leader harus Leader/Co-Leader
   * aktif di unit yang sama. Yang belum memenuhi syarat — semua orang
   * masih nonaktif sebelum ditempatkan — dibiarkan kosong beserta
   * catatannya, supaya akunnya tetap terbentuk dan orangnya bisa
   * dipasang sesudah aktivasi, bukan akunnya yang tertahan.
   */
  const layak = (
    idBaru: string | null,
    unit: string,
    peranBoleh: readonly string[],
  ): { id: string | null; sebab: string | null } => {
    if (!idBaru) return { id: null, sebab: null };
    const o = orangDbId.get(idBaru);
    if (!o) return { id: null, sebab: "tidak ditemukan di V2" };
    if (o.status !== "aktif")
      return { id: null, sebab: `${o.nama} masih nonaktif` };
    if (!peranBoleh.includes(o.role as string)) {
      return { id: null, sebab: `${o.nama} berperan ${o.role}` };
    }
    if (o.unit_id !== unit)
      return { id: null, sebab: `${o.nama} bukan anggota unit ini` };
    return { id: idBaru, sebab: null };
  };

  for (const a of siap) {
    const unit = unitId.get(a.unitKode);
    if (!unit) {
      hasil.tertahan += 1;
      hasil.catatan.push({
        idLama: a.idLama,
        pesan: `Unit '${a.unitKode}' tidak ada di V2.`,
      });
      continue;
    }

    // PIC di sistem lama adalah leadernya; PIC di V2 harus Staff aktif di
    // unit akun (0038, 0061). Bila PIC lama tidak memenuhi syarat, PIC
    // diturunkan dari Staff yang paling sering melaporkan akun ini, dan
    // PIC lama yang berperan Leader/Co-Leader menjadi co-leader akunnya.
    let pic = layak(a.pic, unit, ["Staff"]);
    if (!pic.id) {
      const pelapor = [
        ...(dariLaporan.get(akunV1(a.username) ?? "")?.pelapor ?? []),
      ].sort((x, y) => y[1] - x[1]);
      for (const [userLama, jumlah] of pelapor) {
        const calon = layak(orang.get(userLama) ?? null, unit, ["Staff"]);
        if (calon.id) {
          pic = calon;
          hasil.catatan.push({
            idLama: a.idLama,
            pesan: `PIC diturunkan dari pelapor terbanyak: ${orangDbId.get(calon.id)?.nama ?? calon.id} (${jumlah} laporan).`,
          });
          break;
        }
      }
    }
    if (!pic.id) {
      hasil.catatan.push({
        idLama: a.idLama,
        pesan: `PIC belum dipasang: ${pic.sebab ?? "tidak ada Staff yang pernah melaporkannya"}; pasang lewat layar Akun.`,
      });
    }
    const coLeader = layak(a.coLeader ?? a.pic, unit, ["Leader", "Co-Leader"]);
    if (coLeader.sebab && a.coLeader) {
      hasil.catatan.push({
        idLama: a.idLama,
        pesan: `Co-leader belum dipasang: ${coLeader.sebab}.`,
      });
    }

    const tulis = await tulisIdempoten(sb, {
      kelompok: "affiliate-accounts:all",
      idLama: a.idLama,
      tabel: "accounts",
      peta,
      isi: {
        platform: PLATFORM_LAMA,
        username: a.username,
        unit_id: unit,
        program_id: a.program ? (programId.get(a.program) ?? null) : null,
        pic_user_id: pic.id,
        co_leader_id: coLeader.id,
        status: a.status,
      },
      // Akun dengan username yang sama adalah akun yang sama — itulah
      // penanda yang dipakai orang sehari-hari.
      cariLama: async () => {
        const { data } = await sb
          .from("accounts")
          .select("id")
          .eq("platform", PLATFORM_LAMA)
          .eq("username", a.username)
          .maybeSingle();
        return data?.id ?? null;
      },
    });

    if ("galat" in tulis) {
      hasil.catatan.push({ idLama: a.idLama, pesan: tulis.galat });
      continue;
    }
    hasil.ditulis += 1;
  }

  return hasil;
}

/**
 * Menerapkan `daily-reports:all`.
 *
 * Dua hal yang menentukan benar-salahnya seluruh KPI ada di sini:
 * angkanya harus terbaca utuh ("4.176.000" adalah empat juta, bukan
 * empat koma satu), dan sasarannya harus tepat satu — akun ATAU unit,
 * tidak pernah dua-duanya (kendala `daily_reports_satu_sasaran`).
 *
 * Angka GMV-nya BUKAN dari yang diketik di laporan. Angka itu ternyata
 * menunjuk hari sebelumnya (lihat gmv-v1), jadi laporan akun mengambil
 * GMV dari rekap affiliator tanggal yang sama — nol bila rekapnya tidak
 * ada — dan angka yang diketik disimpan di catatan. Laporan unit masuk
 * dengan GMV nol: angka unit MCN/TAP datang dari rekap `gmv:daily`
 * (`terapkanRekapGmv`), dan menyalinnya di sini membuat GMV unit
 * terhitung dua kali.
 */
export async function terapkanLaporan(
  tahap: "uji_coba" | "sungguhan",
): Promise<HasilTerap> {
  const [isi, resolusi] = await Promise.all([
    isiEksporLama(),
    resolusiOrangV1(),
  ]);

  const orang = new Map(resolusi.padanan.map((p) => [p.idLama, p.idBaru]));
  const daftar = Array.isArray(isi["daily-reports:all"])
    ? (isi["daily-reports:all"] as unknown[])
    : [];

  const hasil: HasilTerap = {
    kelompok: "daily-reports:all",
    diperiksa: daftar.length,
    ditulis: 0,
    tertahan: 0,
    catatan: [],
  };

  type SiapLaporan = {
    idLama: string;
    userLama: string;
    tanggal: string;
    akun: string | null;
    unitKode: string | null;
    gmv: number;
    komisi: number | null;
    upload: number | null;
    catatan: string;
    dikirim: string | null;
  };

  const siap: SiapLaporan[] = [];
  const tahan = (idLama: string, pesan: string) => {
    hasil.tertahan += 1;
    hasil.catatan.push({ idLama, pesan });
  };

  // Divisi tiap orang di data lama. Laporan yang tidak menyebut akun
  // masuk sebagai laporan unit, dan ekspor yang sebenarnya tidak pernah
  // menyebut unit di laporannya — unitnya diambil dari divisi pelapor.
  const divisiOrang = new Map<string, unknown>();
  const daftarOrang = Array.isArray(isi["users:list"]) ? isi["users:list"] : [];
  for (const o of daftarOrang) {
    if (o === null || typeof o !== "object") continue;
    const u = o as Record<string, unknown>;
    if (typeof u.id === "string") divisiOrang.set(u.id, u.division);
  }

  // Rekap affiliator per akun per hari — sumber GMV laporan akun.
  const rekap = petaRekapAkun(gabungGmv(isi));

  for (const l of daftar) {
    if (l === null || typeof l !== "object") continue;
    const mentah = l as Record<string, unknown>;
    const idLama = typeof mentah.id === "string" ? mentah.id : "";
    if (idLama === "") continue;

    // Jawaban formulir lama diratakan menjadi medan berjudul
    // pertanyaannya, lalu medan intinya dicari apa pun ejaan judulnya.
    const baris = ratakanLaporan(mentah);
    const medan = medanLaporan(baris);

    const tanggal = keTanggal(medan.tanggal);
    if (!tanggal) {
      tahan(
        idLama,
        `Tanggal '${String(medan.tanggal ?? "")}' tidak terbaca; laporan tanpa tanggal tidak bisa ditempatkan.`,
      );
      continue;
    }

    const userLama = typeof medan.user === "string" ? medan.user : "";
    if (!userLama || !orang.has(userLama)) {
      tahan(
        idLama,
        userLama
          ? `Pelapornya (${userLama}) belum tertaut.`
          : "Laporan tanpa pelapor.",
      );
      continue;
    }

    const akun = akunV1(medan.akun);
    const divisi = medan.unit ?? divisiOrang.get(userLama);
    const unitKode = akun ? null : unitV1(divisi);
    if (!akun && !unitKode) {
      tahan(
        idLama,
        `Laporan tidak menyebut akun, dan divisi pelapornya ('${String(divisi ?? "")}') tidak punya unit di V2.`,
      );
      continue;
    }

    // GMV yang kosong berarti tidak ada GMV, bukan angka yang rusak.
    const gmvKosong =
      medan.gmv === undefined || medan.gmv === null || medan.gmv === "";
    const diketik = gmvKosong ? 0 : keAngka(medan.gmv);
    if (akun && diketik === null) {
      tahan(idLama, `GMV '${String(medan.gmv ?? "")}' bukan angka yang sah.`);
      continue;
    }

    // GMV laporan akun: rekap tanggal yang sama, atau nol. Laporan unit
    // selalu nol; angkanya dari rekap unit.
    const { gmv: gmvAkhir, keterangan } = akun
      ? gmvLaporanAkun(rekap, akun, tanggal, diketik)
      : { gmv: 0, keterangan: null };

    // Komisi tidak boleh melebihi GMV (kendala V2). Angka lama yang
    // melanggarnya tidak dibuang: komisinya dikosongkan dan nilai aslinya
    // ditulis di catatan, supaya laporannya tetap masuk dan angkanya
    // tetap bisa diperiksa orang.
    let komisi = keAngka(medan.komisi);
    let catatan = catatanLaporan(baris, medan.dipakai);
    if (keterangan) {
      catatan = `${catatan}\n${keterangan}`.trim().slice(0, 2000);
    }
    if (komisi !== null && komisi > gmvAkhir) {
      catatan =
        `${catatan}\nKomisi lama: ${komisi} (lebih besar dari GMV ${gmvAkhir}; dikosongkan saat migrasi)`
          .trim()
          .slice(0, 2000);
      komisi = null;
    }
    // Jumlah upload V2 dibatasi 0–500 per hari (kendala yang sama).
    let upload = keAngka(medan.upload);
    if (upload !== null && (upload < 0 || upload > 500)) {
      catatan =
        `${catatan}\nJumlah upload lama: ${upload} (di luar batas 0–500; dikosongkan saat migrasi)`
          .trim()
          .slice(0, 2000);
      upload = null;
    }

    siap.push({
      idLama,
      userLama,
      tanggal,
      akun,
      unitKode,
      // Laporan unit masuk dengan nol; angkanya dihitung dari akun.
      gmv: gmvAkhir,
      komisi,
      upload,
      catatan,
      dikirim: typeof medan.dikirim === "string" ? medan.dikirim : null,
    });
  }

  if (tahap === "uji_coba" || modeData() === "demo") return hasil;

  const sb = await klienServer();
  const [unitDb, akunDb, namaDb, peta] = await Promise.all([
    sb.from("units").select("id, kode"),
    sb.from("accounts").select("id, username"),
    sb.from("users").select("id, nama"),
    bacaPeta(sb, "daily-reports:all"),
  ]);

  const unitId = new Map<string, string>(
    (unitDb.data ?? []).map((u) => [u.kode as string, u.id]),
  );
  const namaOrang = new Map((namaDb.data ?? []).map((u) => [u.id, u.nama]));
  // Dicari lewat bentuk bakunya: formulir lama menulis "naimanurr" untuk
  // akun "naimanurr_". Yang terdaftar lebih dulu menang bila dua akun
  // bakunya sama.
  const akunId = new Map<string, string>();
  for (const a of akunDb.data ?? []) {
    const baku = akunV1(a.username);
    if (baku && !akunId.has(baku)) akunId.set(baku, a.id);
  }

  for (const l of siap) {
    const accountId = l.akun ? (akunId.get(l.akun) ?? null) : null;
    if (l.akun && !accountId) {
      tahan(l.idLama, `Akun '${l.akun}' tidak ada di V2.`);
      continue;
    }
    const unit = l.unitKode ? (unitId.get(l.unitKode) ?? null) : null;
    if (l.unitKode && !unit) {
      tahan(l.idLama, `Unit '${l.unitKode}' tidak ada di V2.`);
      continue;
    }

    const tulis = await tulisIdempoten(sb, {
      kelompok: "daily-reports:all",
      idLama: l.idLama,
      tabel: "daily_reports",
      peta,
      isi: {},
      lewatJalur: async (idSekarang) => {
        // Laporan yang sudah pernah pindah disamakan di tempat, bukan
        // dibuat lagi: pemetaan sebelumnya bisa saja menaruhnya dengan
        // angka yang diketik orang, dan menulis baris kedua akan
        // menggandakannya. Baris yang ternyata sudah dihapus dibuat ulang.
        if (idSekarang) {
          const sama = await samakanLaporan(
            sb,
            idSekarang,
            {
              user_id: orang.get(l.userLama) as string,
              tanggal: l.tanggal,
              account_id: accountId,
              unit_id: accountId ? null : unit,
              gmv: l.gmv,
              komisi: l.komisi,
              jumlah_upload: l.upload,
              catatan: l.catatan,
            },
            ALASAN_GMV_LAPORAN,
          );
          if (sama !== null) return sama;
        }

        const { data, error } = await sb.rpc("migrasi_tulis_laporan", {
          p_user: orang.get(l.userLama) as string,
          p_tanggal: l.tanggal,
          p_account: accountId,
          p_unit: accountId ? null : unit,
          p_gmv: l.gmv,
          p_komisi: l.komisi,
          p_upload: l.upload,
          p_catatan: l.catatan,
          p_dikirim: l.dikirim,
        });
        return error ? { galat: error.message } : { id: data };
      },
    });

    if ("galat" in tulis) {
      // Laporan untuk sasaran dan tanggal yang sama ditolak indeks
      // uniknya: V2 hanya punya satu laporan per sasaran per hari. Yang
      // kedua tidak dibuang — catatannya digabung ke laporan hari itu.
      if (tulis.galat.startsWith("Baris dengan penanda yang sama")) {
        hasil.catatan.push({
          idLama: l.idLama,
          pesan: await gabungLaporanGanda(sb, {
            idLama: l.idLama,
            tanggal: l.tanggal,
            accountId,
            unitId: accountId ? null : unit,
            pelapor: namaOrang.get(orang.get(l.userLama) ?? "") ?? l.userLama,
            catatan: l.catatan,
          }),
        });
        continue;
      }
      hasil.catatan.push({ idLama: l.idLama, pesan: tulis.galat });
      continue;
    }

    hasil.ditulis += 1;
  }

  return hasil;
}

/** Awalan bagian catatan yang berasal dari laporan lain pada hari yang sama. */
const PENANDA_GABUNG = "\n— Laporan lain hari itu dari ";

/**
 * Menggabungkan laporan kedua (dan seterusnya) untuk sasaran dan tanggal
 * yang sama ke catatan laporan yang sudah ada.
 *
 * Sistem lama membiarkan dua orang melapor untuk akun yang sama pada hari
 * yang sama; V2 tidak. Angkanya sudah diwakili rekap, jadi yang bernilai
 * dari laporan kedua adalah catatan kerjanya — dan itu yang dibawa, dengan
 * penanda id lamanya supaya pengulangan tidak menggandakannya. Petanya
 * dicatat di kelompok sendiri (`daily-reports:gabung`) supaya laporan yang
 * digabung tidak dianggap pemilik baris itu pada jalan berikutnya.
 */
async function gabungLaporanGanda(
  sb: KlienDb,
  l: {
    idLama: string;
    tanggal: string;
    accountId: string | null;
    unitId: string | null;
    pelapor: string;
    catatan: string;
  },
): Promise<string> {
  const dasar = sb
    .from("daily_reports")
    .select("id, catatan")
    .eq("tanggal", l.tanggal);
  const { data: ada, error } = await (
    l.accountId
      ? dasar.eq("account_id", l.accountId)
      : dasar.eq("unit_id", l.unitId as string)
  ).maybeSingle();
  if (error)
    return `Laporan ganda; gagal mencari laporan hari itu: ${error.message}`;
  if (!ada)
    return "Laporan ganda; laporan hari itu tidak ditemukan untuk digabung.";

  const penanda = `[laporan lama ${l.idLama}]`;
  if (!ada.catatan.includes(penanda)) {
    const tambahan = `${PENANDA_GABUNG}${l.pelapor} ${penanda}:\n${l.catatan}`;
    const gabungan = `${ada.catatan}${tambahan}`.slice(0, 2000);
    const { error: galatUbah } = await sb
      .from("daily_reports")
      .update({ catatan: gabungan })
      .eq("id", ada.id);
    if (galatUbah) return `Laporan ganda; gagal digabung: ${galatUbah.message}`;
  }

  const { error: galatPeta } = await sb.from("migrasi_peta").upsert(
    {
      kelompok: "daily-reports:gabung",
      id_lama: l.idLama,
      id_baru: ada.id,
      tabel: "daily_reports",
    },
    { onConflict: "kelompok,id_lama" },
  );
  if (galatPeta)
    return `Laporan ganda digabung, tetapi petanya gagal dicatat: ${galatPeta.message}`;
  return "Laporan ganda untuk sasaran dan tanggal yang sama; catatannya digabung ke laporan hari itu.";
}

const ALASAN_GMV_LAPORAN =
  "Migrasi K-Space lama: GMV laporan disamakan dengan rekap GMV affiliator tanggal yang sama; angka yang diketik di laporan lama menunjuk hari sebelumnya.";
const ALASAN_GMV_REKAP =
  "Migrasi K-Space lama: angka disamakan dengan rekap GMV harian sistem lama (affiliate-gmv:daily / gmv:daily).";

const angkaDb = (n: unknown): number | null =>
  n === null || n === undefined ? null : Number(n);

type KolomLaporan = {
  user_id: string;
  tanggal: string;
  account_id: string | null;
  unit_id: string | null;
  gmv: number;
  komisi: number | null;
  jumlah_upload: number | null;
  catatan: string;
};

/**
 * Menyamakan satu baris `daily_reports` yang sudah ada dengan nilai yang
 * seharusnya, menulis sesedikit mungkin.
 *
 * Kolom angka (GMV, komisi, jumlah upload) diubah lewat
 * `perbaiki_laporan_harian` supaya jejak revisinya (0005/0127) membawa
 * alasan yang bisa dibaca orang, bukan "perbaikan tanpa alasan tercatat";
 * kolom lainnya diubah langsung. Baris yang nilainya sudah sama tidak
 * disentuh sama sekali — pengulangan migrasi tidak boleh menumpuk revisi.
 * Hanya kolom yang disebut di `target` yang dibandingkan.
 *
 * Mengembalikan null bila barisnya sudah tidak ada (dihapus orang sesudah
 * migrasi sebelumnya), supaya pemanggil membuatnya lagi.
 */
async function samakanLaporan(
  sb: KlienDb,
  id: string,
  target: Partial<KolomLaporan>,
  alasan: string,
): Promise<{ id: string } | { galat: string } | null> {
  const { data: ada, error } = await sb
    .from("daily_reports")
    .select(
      "id, user_id, tanggal, account_id, unit_id, gmv, komisi, jumlah_upload, catatan",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return { galat: error.message };
  if (!ada) return null;

  const teks: Record<string, string | null> = {};
  for (const k of ["user_id", "tanggal", "account_id", "unit_id"] as const) {
    if (k in target && (ada[k] ?? null) !== (target[k] ?? null)) {
      teks[k] = target[k] ?? null;
    }
  }
  let catatan = "catatan" in target ? (target.catatan ?? "") : ada.catatan;
  // Catatan laporan lain yang sudah digabung ke baris ini (lihat
  // gabungLaporanGanda) bukan milik laporan ini; dipertahankan apa adanya.
  const ekorGabung = ada.catatan.indexOf(PENANDA_GABUNG);
  if ("catatan" in target && ekorGabung >= 0) {
    catatan = `${catatan}${ada.catatan.slice(ekorGabung)}`.slice(0, 2000);
  }

  const gmv = "gmv" in target ? (target.gmv ?? 0) : (angkaDb(ada.gmv) ?? 0);
  let komisi =
    "komisi" in target ? (target.komisi ?? null) : angkaDb(ada.komisi);
  const upload =
    "jumlah_upload" in target
      ? (target.jumlah_upload ?? null)
      : angkaDb(ada.jumlah_upload);
  // Komisi yang jadi lebih besar dari GMV barunya melanggar kendala V2;
  // dikosongkan dan angkanya dicatat, bukan dibiarkan gagal.
  if (komisi !== null && komisi > gmv) {
    catatan =
      `${catatan}\nKomisi lama: ${komisi} (lebih besar dari GMV ${gmv}; dikosongkan saat migrasi)`
        .trim()
        .slice(0, 2000);
    komisi = null;
  }
  const catatanBeda = catatan !== ada.catatan;
  const angkaBeda =
    gmv !== angkaDb(ada.gmv) ||
    komisi !== angkaDb(ada.komisi) ||
    upload !== angkaDb(ada.jumlah_upload);

  if (angkaBeda) {
    const { error: galatRpc } = await sb.rpc("perbaiki_laporan_harian", {
      p_report_id: id,
      p_gmv: gmv,
      p_alasan: alasan,
      p_catatan: catatanBeda ? catatan : null,
      p_komisi: komisi,
      p_jumlah_upload: upload,
    });
    if (galatRpc) return { galat: galatRpc.message };
  } else if (catatanBeda) {
    teks.catatan = catatan;
  }

  if (Object.keys(teks).length > 0) {
    const { error: galatUbah } = await sb
      .from("daily_reports")
      .update(teks as never)
      .eq("id", id);
    if (galatUbah) return { galat: galatUbah.message };
  }
  return { id };
}

/**
 * Tanggal (WIB) ekspor lama yang sedang dipakai; hari ini bila unggahannya
 * tidak mencatatnya. Rekap yang bertanggal sesudah itu adalah angka yang
 * belum terjadi — target atau salah ketik — dan tidak dibawa.
 */
async function tanggalEksporLama(): Promise<string> {
  const hariIni = tanggalWib(new Date().toISOString()) as string;
  if (modeData() === "demo") return hariIni;

  const sb = await klienServer();
  const { data } = await sb
    .from("kv_unggahan")
    .select("meta")
    .order("dimuat_pada", { ascending: false })
    .limit(1)
    .maybeSingle();
  const meta = (data?.meta ?? null) as Record<string, unknown> | null;
  const diekspor =
    meta && typeof meta.exportedAt === "string"
      ? tanggalWib(meta.exportedAt)
      : null;
  return diekspor ?? hariIni;
}

/**
 * Menerapkan rekap GMV lama ke `daily_reports`: `affiliate-gmv:daily`
 * (per akun) dan `gmv:daily` (per unit MCN/TAP).
 *
 * Rekap tidak punya tabel sendiri di V2 — angka harian hidup di
 * `daily_reports`, satu baris per sasaran per tanggal. Jadi tiap rekap
 * mencari baris sasarannya: kalau sudah ada (laporan yang pindah lebih
 * dulu, atau rekap ini sendiri pada jalan sebelumnya) angkanya disamakan
 * bila berbeda; kalau belum, baris baru dibuat lewat jalur migrasi (0158)
 * atas nama orang yang mencatat rekapnya. Mana yang dipakai bila beberapa
 * sumber menyebut sasaran yang sama diputuskan `gabungGmv`.
 */
export async function terapkanRekapGmv(
  tahap: "uji_coba" | "sungguhan",
  kunci: "affiliate-gmv:daily" | "gmv:daily",
): Promise<HasilTerap> {
  const [isi, resolusi, batasTanggal] = await Promise.all([
    isiEksporLama(),
    resolusiOrangV1(),
    tanggalEksporLama(),
  ]);

  const orang = new Map(resolusi.padanan.map((p) => [p.idLama, p.idBaru]));
  const sumber = kunci === "affiliate-gmv:daily" ? "affiliate" : "harian";
  const gabung = gabungGmv(isi);

  const hasil: HasilTerap = {
    kelompok: kunci,
    diperiksa: Array.isArray(isi[kunci]) ? isi[kunci].length : 0,
    ditulis: 0,
    tertahan: 0,
    catatan: [],
  };
  const tahan = (idLama: string, pesan: string) => {
    hasil.tertahan += 1;
    hasil.catatan.push({ idLama, pesan });
  };

  // Yang sengaja tidak dibawa (autoSynced, ganda, divisi internal) bukan
  // tertahan — tidak ada keputusan yang ditunggu — tetapi tetap disebut.
  for (const d of gabung.dilewati) {
    if (d.sumber === sumber)
      hasil.catatan.push({ idLama: d.idLama, pesan: d.alasan });
  }

  type SiapRekap = {
    idLama: string;
    userId: string;
    tanggal: string;
    akun: string | null;
    unitKode: string | null;
    gmv: number;
    komisi: number | null;
    upload: number | null;
    catatan: string;
    dikirim: string | null;
  };
  const siap: SiapRekap[] = [];
  for (const b of gabung.baris) {
    if (b.sumber !== sumber) continue;
    if (b.tanggal > batasTanggal) {
      tahan(
        b.idLama,
        `Bertanggal ${b.tanggal}, sesudah ekspor dibuat (${batasTanggal}); rekap yang belum terjadi tidak dibawa.`,
      );
      continue;
    }
    const userId = b.pencatat ? orang.get(b.pencatat) : undefined;
    if (!userId) {
      tahan(
        b.idLama,
        b.pencatat
          ? `Pencatatnya (${b.pencatat}) belum tertaut.`
          : "Rekap tanpa pencatat.",
      );
      continue;
    }

    const bagian = [
      `Rekap GMV ${b.akun ? "affiliator" : "unit"} sistem lama`,
      b.pesanan !== null ? `Pesanan: ${b.pesanan}` : null,
    ];
    siap.push({
      idLama: b.idLama,
      userId,
      tanggal: b.tanggal,
      akun: b.akun,
      unitKode: b.unit,
      gmv: b.gmv,
      komisi: b.komisi !== null && b.komisi <= b.gmv ? b.komisi : null,
      upload:
        b.upload !== null && b.upload >= 0 && b.upload <= 500 ? b.upload : null,
      catatan: bagian.filter((t) => t !== null).join(" · "),
      dikirim: b.diperbarui,
    });
  }

  if (tahap === "uji_coba" || modeData() === "demo") return hasil;

  const sb = await klienServer();
  const [unitDb, akunDb, peta] = await Promise.all([
    sb.from("units").select("id, kode"),
    sb.from("accounts").select("id, username"),
    bacaPeta(sb, kunci),
  ]);
  const unitId = new Map<string, string>(
    (unitDb.data ?? []).map((u) => [u.kode as string, u.id]),
  );
  const akunId = new Map<string, string>();
  for (const a of akunDb.data ?? []) {
    const baku = bakuAkun(a.username);
    if (baku && !akunId.has(baku)) akunId.set(baku, a.id);
  }

  for (const r of siap) {
    const accountId = r.akun ? (akunId.get(r.akun) ?? null) : null;
    if (r.akun && !accountId) {
      tahan(r.idLama, `Akun '${r.akun}' tidak ada di V2.`);
      continue;
    }
    const unit = r.unitKode ? (unitId.get(r.unitKode) ?? null) : null;
    if (!accountId && !unit) {
      tahan(r.idLama, `Unit '${r.unitKode ?? ""}' tidak ada di V2.`);
      continue;
    }

    const tulis = await tulisIdempoten(sb, {
      kelompok: kunci,
      idLama: r.idLama,
      tabel: "daily_reports",
      peta,
      isi: {},
      lewatJalur: async (idSekarang) => {
        // Baris sasaran: yang sudah dipetakan, atau yang sudah ada untuk
        // sasaran dan tanggal ini (laporan yang pindah lebih dulu).
        let id = idSekarang;
        if (!id) {
          const dasar = sb
            .from("daily_reports")
            .select("id")
            .eq("tanggal", r.tanggal);
          const { data: ada, error: galatCari } = await (
            accountId
              ? dasar.eq("account_id", accountId)
              : dasar.eq("unit_id", unit as string)
          ).maybeSingle();
          if (galatCari) return { galat: galatCari.message };
          id = ada?.id ?? null;
        }
        if (id) {
          // Hanya angkanya yang disamakan; pelapor, sasaran, tanggal, dan
          // catatan baris yang ada adalah milik laporannya.
          const sama = await samakanLaporan(
            sb,
            id,
            { gmv: r.gmv },
            ALASAN_GMV_REKAP,
          );
          if (sama !== null) return sama;
        }

        const { data, error } = await sb.rpc("migrasi_tulis_laporan", {
          p_user: r.userId,
          p_tanggal: r.tanggal,
          p_account: accountId,
          p_unit: accountId ? null : unit,
          p_gmv: r.gmv,
          p_komisi: r.komisi,
          p_upload: r.upload,
          p_catatan: r.catatan,
          p_dikirim: r.dikirim,
        });
        return error ? { galat: error.message } : { id: data };
      },
    });

    if ("galat" in tulis) {
      hasil.catatan.push({ idLama: r.idLama, pesan: tulis.galat });
      continue;
    }
    hasil.ditulis += 1;
  }

  return hasil;
}

/**
 * Mengumpulkan orang yang ditunggu keputusannya.
 *
 * Dijalankan terpisah dari pemetaan mana pun karena ia melintasi seluruh
 * kunci: seorang yang tidak ada di `users:list` bisa muncul sebagai
 * pelapor di laporan harian dan sebagai penerima di tugas. Dikumpulkan
 * sekali, dengan catatan di kunci mana saja ia muncul, supaya yang
 * memutuskan tahu berapa banyak data yang menggantung padanya.
 */
export async function kumpulkanOrangPending(
  tahap: "uji_coba" | "sungguhan",
): Promise<HasilTerap> {
  const [isi, resolusi] = await Promise.all([
    isiEksporLama(),
    resolusiOrangV1(),
  ]);

  const dariKunci = orangDitunggu(isi, PEMETAAN_V1);
  const namaLama = new Map(
    resolusi.belum.map((b) => [b.idLama, b.nama] as const),
  );

  // Dua sumber: orang yang ada di users:list tetapi tidak ketemu
  // padanannya, dan id yang ditunjuk data lain tanpa pernah ada di
  // daftar orang sama sekali.
  const gabungan = new Map<
    string,
    { idLama: string; nama: string; kemunculan: string[]; alasan: string }
  >();

  for (const b of resolusi.belum) {
    gabungan.set(b.idLama, {
      idLama: b.idLama,
      nama: b.nama,
      kemunculan: ["users:list"],
      alasan: b.alasan,
    });
  }
  for (const o of dariKunci) {
    const ada = gabungan.get(o.idLama);
    if (ada) {
      ada.kemunculan = [...new Set([...ada.kemunculan, ...o.kemunculan])];
      continue;
    }
    gabungan.set(o.idLama, {
      idLama: o.idLama,
      nama: namaLama.get(o.idLama) ?? "",
      kemunculan: o.kemunculan,
      alasan: `Ditunjuk ${o.jumlah} catatan tetapi tidak ada di users:list.`,
    });
  }

  const daftar = [...gabungan.values()];
  const hasil: HasilTerap = {
    kelompok: "orang-pending",
    diperiksa: daftar.length,
    ditulis: 0,
    tertahan: daftar.length,
    catatan: daftar.map((o) => ({
      idLama: o.idLama,
      pesan: `${o.alasan} Muncul di: ${o.kemunculan.join(", ")}.`,
    })),
  };

  if (tahap === "uji_coba" || modeData() === "demo" || daftar.length === 0) {
    return hasil;
  }

  const sb = await klienServer();
  const { error } = await sb.from("migrasi_orang_pending").upsert(
    daftar.map((o) => ({
      id_lama: o.idLama,
      nama: o.nama,
      kemunculan: o.kemunculan,
      alasan: o.alasan,
    })),
    { onConflict: "id_lama" },
  );

  if (error) {
    hasil.catatan.push({ idLama: "-", pesan: error.message });
    return hasil;
  }

  hasil.ditulis = daftar.length;
  return hasil;
}

/** Tanda yang dipasang pada kehadiran hasil migrasi. */
export const BUKTI_SISTEM_LAMA = "Bukti di sistem lama";

/**
 * Menerapkan `attendance:all`.
 *
 * Swafotonya tidak ikut: yang tersimpan di sistem lama hanya rujukan ke
 * `img:store`, dan `img:store` sengaja tidak dipindahkan. Kolom foto
 * yang kosong tanpa keterangan terbaca seolah orangnya tidak pernah
 * berswafoto, jadi tiap baris diberi tanda "bukti di sistem lama"
 * (0157) — bukan dibiarkan kosong begitu saja.
 */
export async function terapkanKehadiran(
  tahap: "uji_coba" | "sungguhan",
): Promise<HasilTerap> {
  const [isi, resolusi] = await Promise.all([
    isiEksporLama(),
    resolusiOrangV1(),
  ]);

  const orang = new Map(resolusi.padanan.map((p) => [p.idLama, p.idBaru]));
  // Ekspor lama yang sebenarnya menyimpan kejadian masuk/pulang, bukan
  // hari; disatukan dulu menjadi satu baris per orang per hari.
  const daftar = Array.isArray(isi["attendance:all"])
    ? hariDariKejadian(isi["attendance:all"] as unknown[])
    : [];

  const hasil: HasilTerap = {
    kelompok: "attendance:all",
    diperiksa: daftar.length,
    ditulis: 0,
    tertahan: 0,
    catatan: [],
  };

  type SiapHadir = {
    idLama: string;
    userId: string;
    tanggal: string;
    masuk: string | null;
    pulang: string | null;
    status: "hadir" | "terlambat" | "izin" | "sakit";
    lat: number | null;
    lng: number | null;
  };

  const siap: SiapHadir[] = [];
  for (const a of daftar) {
    if (a === null || typeof a !== "object") continue;
    const baris = a as Record<string, unknown>;
    const idLama = typeof baris.id === "string" ? baris.id : "";
    if (idLama === "") continue;

    const tanggal = keTanggal(baris.date);
    const userLama = typeof baris.userId === "string" ? baris.userId : "";
    const userId = userLama ? orang.get(userLama) : undefined;

    if (!tanggal || !userId) {
      hasil.tertahan += 1;
      hasil.catatan.push({
        idLama,
        pesan: !tanggal
          ? `Tanggal '${String(baris.date ?? "")}' tidak terbaca.`
          : `Orangnya (${userLama || "tidak disebut"}) belum tertaut.`,
      });
      continue;
    }

    const { lat, lng } = koordinat(baris.checkInLocation);
    siap.push({
      idLama,
      userId,
      tanggal,
      masuk: typeof baris.checkIn === "string" ? baris.checkIn : null,
      pulang: typeof baris.checkOut === "string" ? baris.checkOut : null,
      status: statusHadir(baris.status),
      lat,
      lng,
    });
  }

  if (tahap === "uji_coba" || modeData() === "demo") return hasil;

  const sb = await klienServer();
  const peta = await bacaPeta(sb, "attendance:all");

  for (const h of siap) {
    const tulis = await tulisIdempoten(sb, {
      kelompok: "attendance:all",
      idLama: h.idLama,
      tabel: "attendance",
      peta,
      isi: {},
      // Aturan harian melarang siapa pun mengabsenkan orang lain — benar
      // untuk hari ini, mustahil untuk kehadiran tahun lalu. Jalur
      // khususnya (0158) yang dipakai.
      lewatJalur: async () => {
        const { data, error } = await sb.rpc("migrasi_tulis_kehadiran", {
          p_user: h.userId,
          p_tanggal: h.tanggal,
          p_status: h.status,
          p_jam_masuk: h.masuk,
          p_jam_pulang: h.pulang,
          p_lat: h.lat,
          p_lng: h.lng,
          p_catatan_bukti: BUKTI_SISTEM_LAMA,
        });
        return error ? { galat: error.message } : { id: data };
      },
    });

    if ("galat" in tulis) {
      hasil.catatan.push({ idLama: h.idLama, pesan: tulis.galat });
      continue;
    }
    hasil.ditulis += 1;
  }

  return hasil;
}

/**
 * Menerapkan `attendance:config` ke satu baris `pengaturan`.
 *
 * Pengaturan V2 hanya satu baris (id = true), jadi tidak ada yang perlu
 * dipetakan id-nya; yang ada hanya menimpa atau tidak.
 */
export async function terapkanPengaturanAbsensi(
  tahap: "uji_coba" | "sungguhan",
): Promise<HasilTerap> {
  const isi = await isiEksporLama();
  const config = isi["attendance:config"];

  const hasil: HasilTerap = {
    kelompok: "attendance:config",
    diperiksa: config ? 1 : 0,
    ditulis: 0,
    tertahan: 0,
    catatan: [],
  };

  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    if (config !== undefined) {
      hasil.tertahan = 1;
      hasil.catatan.push({
        idLama: "attendance:config",
        pesan: "Isinya bukan objek pengaturan.",
      });
    }
    return hasil;
  }

  const o = config as Record<string, unknown>;
  // Ekspor lama yang sebenarnya menulis koordinat dan radius rata:
  // `lokasiLat`, `lokasiLng`, `radiusM`.
  const { lat, lng } = koordinat(
    o.lokasi ?? { lat: o.lokasiLat, lng: o.lokasiLng },
  );
  const patch: Record<string, unknown> = {};
  if (typeof o.jamMasuk === "string") patch.jam_masuk = o.jamMasuk;
  const toleransi = keAngka(o.toleransiMenit);
  if (toleransi !== null) patch.toleransi_menit = toleransi;
  const radius = keAngka(o.radiusMeter ?? o.radiusM);
  if (radius !== null) patch.radius_meter = radius;
  if (lat !== null) patch.kantor_lat = lat;
  if (lng !== null) patch.kantor_lng = lng;

  if (Object.keys(patch).length === 0) {
    hasil.tertahan = 1;
    hasil.catatan.push({
      idLama: "attendance:config",
      pesan: "Tidak ada satu pun medan yang dikenali.",
    });
    return hasil;
  }

  if (tahap === "uji_coba" || modeData() === "demo") return hasil;

  const sb = await klienServer();
  const { error } = await sb
    .from("pengaturan")
    .update(patch as never)
    .eq("id", true);

  if (error) {
    hasil.catatan.push({ idLama: "attendance:config", pesan: error.message });
    return hasil;
  }

  hasil.ditulis = 1;
  return hasil;
}

/**
 * Menerapkan `leave-requests:all`.
 *
 * V2 tidak punya tabel izin tersendiri: izin adalah baris kehadiran
 * berstatus izin atau sakit. Izin beberapa hari karena itu menjadi
 * beberapa baris, satu per hari — kalau hanya hari pertamanya yang
 * dibuat, hari-hari di tengahnya terbaca sebagai mangkir, dan orangnya
 * dinilai atas ketidakhadiran yang sudah pernah disetujui.
 */
export async function terapkanIzin(
  tahap: "uji_coba" | "sungguhan",
): Promise<HasilTerap> {
  const [isi, resolusi] = await Promise.all([
    isiEksporLama(),
    resolusiOrangV1(),
  ]);

  const orang = new Map(resolusi.padanan.map((p) => [p.idLama, p.idBaru]));
  const daftar = Array.isArray(isi["leave-requests:all"])
    ? (isi["leave-requests:all"] as unknown[])
    : [];

  const hasil: HasilTerap = {
    kelompok: "leave-requests:all",
    diperiksa: daftar.length,
    ditulis: 0,
    tertahan: 0,
    catatan: [],
  };

  // Hari yang orangnya tercatat absen masuk. Izin yang jatuh pada hari
  // itu tidak menimpa kehadirannya: bukti hadir lebih kuat daripada
  // pengajuan — apalagi pengajuan yang ditolak.
  const hariHadir = new Set<string>();
  const kejadian = Array.isArray(isi["attendance:all"])
    ? hariDariKejadian(isi["attendance:all"] as unknown[])
    : [];
  for (const h of kejadian) {
    if (h === null || typeof h !== "object") continue;
    const b = h as Record<string, unknown>;
    const tanggal = keTanggal(b.date);
    if (typeof b.userId === "string" && tanggal) {
      hariHadir.add(`${b.userId}#${tanggal}`);
    }
  }

  type SiapIzin = {
    idLama: string;
    userLama: string;
    userId: string;
    hari: string[];
    mulai: string;
    selesai: string;
    status: "izin" | "sakit";
    alasan: string;
    persetujuan: "diajukan" | "disetujui" | "ditolak";
    pemutus: string | null;
  };

  const siap: SiapIzin[] = [];
  for (const l of daftar) {
    if (l === null || typeof l !== "object") continue;
    const baris = l as Record<string, unknown>;
    const idLama = typeof baris.id === "string" ? baris.id : "";
    if (idLama === "") continue;

    // Ekspor lama yang sebenarnya menulis rentangnya sebagai `date` dan
    // `dateEnd` (yang kedua hanya ada pada izin beberapa hari).
    const mulai = keTanggal(baris.startDate ?? baris.date);
    const selesai = keTanggal(baris.endDate ?? baris.dateEnd) ?? mulai;
    const userLama = typeof baris.userId === "string" ? baris.userId : "";
    const userId = userLama ? orang.get(userLama) : undefined;

    if (!mulai || !selesai || !userId) {
      hasil.tertahan += 1;
      hasil.catatan.push({
        idLama,
        pesan: !mulai
          ? "Tanggal mulainya tidak terbaca."
          : `Pemohonnya (${userLama || "tidak disebut"}) belum tertaut.`,
      });
      continue;
    }

    const jenis =
      typeof baris.type === "string" ? baris.type.toLowerCase() : "";
    const pemutusLama =
      typeof baris.decidedById === "string" ? baris.decidedById : null;

    // Alasan dan catatan tambahan digabung; keduanya ditulis orang.
    const alasan = [baris.reason, baris.note]
      .filter((t): t is string => typeof t === "string" && t.trim() !== "")
      .map((t) => t.trim())
      .join(" — ");

    siap.push({
      idLama,
      userLama,
      userId,
      hari: hariIzin(mulai, selesai),
      mulai,
      selesai,
      status: jenis === "sakit" || jenis === "sick" ? "sakit" : "izin",
      alasan,
      persetujuan: persetujuanIzin(baris.status),
      pemutus: pemutusLama ? (orang.get(pemutusLama) ?? null) : null,
    });
  }

  if (tahap === "uji_coba" || modeData() === "demo") return hasil;

  const sb = await klienServer();
  const peta = await bacaPeta(sb, "leave-requests:all");

  for (const z of siap) {
    let gagalHari = 0;
    for (const [i, tanggal] of z.hari.entries()) {
      // Tiap hari punya penanda sendiri supaya pengulangan tidak
      // membuat baris kedua untuk hari yang sama.
      const idHari = z.hari.length > 1 ? `${z.idLama}#${tanggal}` : z.idLama;

      if (hariHadir.has(`${z.userLama}#${tanggal}`)) {
        gagalHari += 1;
        hasil.catatan.push({
          idLama: idHari,
          pesan: `Orangnya tercatat absen masuk pada ${tanggal}; kehadirannya dipertahankan dan izin (${z.persetujuan}) untuk hari itu tidak ditulis.`,
        });
        continue;
      }

      const tulis = await tulisIdempoten(sb, {
        kelompok: "leave-requests:all",
        idLama: idHari,
        tabel: "attendance",
        peta,
        isi: {},
        lewatJalur: async () => {
          const { data, error } = await sb.rpc("migrasi_tulis_kehadiran", {
            p_user: z.userId,
            p_tanggal: tanggal,
            p_status: z.status,
            p_alasan: z.alasan,
            p_persetujuan: z.persetujuan,
            p_disetujui_oleh: z.persetujuan === "diajukan" ? null : z.pemutus,
            p_catatan_bukti: `${BUKTI_SISTEM_LAMA} · izin ${z.mulai} s.d. ${z.selesai}`,
          });
          return error ? { galat: error.message } : { id: data };
        },
      });

      if ("galat" in tulis) {
        gagalHari += 1;
        hasil.catatan.push({
          idLama: idHari,
          pesan: `${tulis.galat}${i > 0 ? " (hari lanjutan izin ini)" : ""}`,
        });
      }
    }

    if (gagalHari === 0) hasil.ditulis += 1;
  }

  return hasil;
}

/**
 * Menerapkan `tasks:all` beserta jejak QC-nya.
 *
 * QC di V2 menempel pada tugasnya (kolom `qc_*`), bukan tabel terpisah,
 * jadi jejaknya ikut ditulis di baris yang sama. Yang tidak jelas
 * hasilnya masuk sebagai "belum" — menandainya lolos berarti meloloskan
 * pekerjaan yang tidak pernah ditinjau siapa pun.
 */
export async function terapkanTugas(
  tahap: "uji_coba" | "sungguhan",
  opsi: { todo?: boolean } = {},
): Promise<HasilTerap> {
  const kunci = opsi.todo ? "todos:all" : "tasks:all";
  const [isi, resolusi] = await Promise.all([
    isiEksporLama(),
    resolusiOrangV1(),
  ]);

  const orang = new Map(resolusi.padanan.map((p) => [p.idLama, p.idBaru]));
  const daftar = Array.isArray(isi[kunci]) ? (isi[kunci] as unknown[]) : [];

  const hasil: HasilTerap = {
    kelompok: kunci,
    diperiksa: daftar.length,
    ditulis: 0,
    tertahan: 0,
    catatan: [],
  };

  type SiapTugas = {
    idLama: string;
    isi: Record<string, unknown>;
  };

  const siap: SiapTugas[] = [];
  for (const t of daftar) {
    if (t === null || typeof t !== "object") continue;
    const baris = t as Record<string, unknown>;
    const idLama = typeof baris.id === "string" ? baris.id : "";
    if (idLama === "") continue;

    const judul = typeof baris.title === "string" ? baris.title.trim() : "";
    if (judul === "") {
      hasil.tertahan += 1;
      hasil.catatan.push({ idLama, pesan: "Tugas tanpa judul." });
      continue;
    }

    // Todo pribadi: pembuat dan penerimanya orang yang sama. Ekspor lama
    // yang sebenarnya menyebut pemiliknya sebagai `ownerId`.
    const penerimaLama = opsi.todo
      ? typeof baris.userId === "string"
        ? baris.userId
        : typeof baris.ownerId === "string"
          ? baris.ownerId
          : ""
      : typeof baris.assigneeId === "string"
        ? baris.assigneeId
        : "";
    const pembuatLama = opsi.todo
      ? penerimaLama
      : typeof baris.createdById === "string"
        ? baris.createdById
        : penerimaLama;

    const penerima = penerimaLama ? orang.get(penerimaLama) : undefined;
    const pembuat = pembuatLama ? orang.get(pembuatLama) : undefined;

    if (!penerima || !pembuat) {
      hasil.tertahan += 1;
      hasil.catatan.push({
        idLama,
        pesan: `Orangnya belum tertaut (${!penerima ? "penerima" : "pembuat"}: ${
          (!penerima ? penerimaLama : pembuatLama) || "tidak disebut"
        }).`,
      });
      continue;
    }

    // Jejak QC bisa berupa objek `qc` (contoh) atau medan-medan rata
    // `qcResult`, `qcNote`, … (ekspor yang sebenarnya).
    const qc = opsi.todo ? null : jejakQcV1(baris.qc ?? jejakQcDatar(baris));
    // Todo lama punya `status` (todo/in_progress/done) di samping `done`.
    const statusLama =
      typeof baris.status === "string" ? statusTugasV1(baris.status) : null;
    const selesai = opsi.todo
      ? baris.done === true || statusLama === "selesai"
      : statusLama === "selesai";
    // Tenggat: `dueDate` (contoh) atau `deadline` (ekspor sebenarnya).
    // Teks kosong berarti tidak ada tenggat, bukan waktu yang rusak.
    const waktu = (v: unknown) =>
      typeof v === "string" && v.trim() !== "" ? v : null;
    const tenggat =
      waktu(baris.dueDate) ?? waktu(baris.deadline) ?? waktu(baris.createdAt);

    siap.push({
      idLama,
      isi: {
        tipe: opsi.todo ? "pribadi" : "tiket",
        judul,
        deskripsi:
          typeof baris.description === "string" ? baris.description : "",
        konteks: typeof baris.context === "string" ? baris.context : "",
        pembuat_id: pembuat,
        penerima_id: penerima,
        tenggat,
        prioritas:
          opsi.todo && typeof baris.priority !== "string"
            ? "sedang"
            : prioritasV1(baris.priority),
        status: opsi.todo
          ? selesai
            ? "selesai"
            : (statusLama ?? "todo")
          : statusTugasV1(baris.status),
        // Tanpa waktu selesai, tugas lama yang sudah beres tetap
        // terhitung sebagai tunggakan pada rekap mingguan.
        ...(selesai ? { selesai_at: waktu(baris.completedAt) ?? tenggat } : {}),
        ...(qc
          ? {
              qc_status: qc.status,
              qc_by: qc.olehLama ? (orang.get(qc.olehLama) ?? null) : null,
              qc_at: waktu(qc.pada),
              qc_note: qc.catatan,
            }
          : {}),
      },
    });
  }

  if (tahap === "uji_coba" || modeData() === "demo") return hasil;

  const sb = await klienServer();
  const peta = await bacaPeta(sb, kunci);

  // Tugas lama tidak boleh membunyikan lonceng "Tugas baru" di ponsel
  // orang: notifikasinya dibungkam selama penulisan, lalu dipulihkan.
  const penerima = new Set(
    siap
      .filter((t) => t.isi.penerima_id !== t.isi.pembuat_id)
      .map((t) => t.isi.penerima_id as string),
  );
  const pulihkan = await bungkamNotifikasiTugas(sb, [...penerima]);

  try {
    for (const t of siap) {
      const tulis = await tulisIdempoten(sb, {
        kelompok: kunci,
        idLama: t.idLama,
        tabel: "tasks",
        peta,
        isi: t.isi,
      });

      if ("galat" in tulis) {
        hasil.catatan.push({ idLama: t.idLama, pesan: tulis.galat });
        continue;
      }
      hasil.ditulis += 1;
    }
  } finally {
    const galatPulih = await pulihkan();
    if (galatPulih) hasil.catatan.push({ idLama: "-", pesan: galatPulih });
  }

  return hasil;
}

/**
 * Mematikan notifikasi in-app kategori tugas untuk sejumlah orang, dan
 * mengembalikan cara memulihkannya.
 *
 * `terbitkan_notifikasi` (0116) menghormati `notification_preferences`:
 * bila in-app-nya mati, tidak ada baris notifikasi yang lahir sama
 * sekali — bukan lahir lalu dihapus. Preferensi yang sudah ada
 * dikembalikan persis; yang belum ada dikembalikan ke nilai bawaannya.
 */
async function bungkamNotifikasiTugas(
  sb: KlienDb,
  userIds: string[],
): Promise<() => Promise<string | null>> {
  if (userIds.length === 0) return async () => null;

  const { data: semula, error: galatBaca } = await sb
    .from("notification_preferences")
    .select("user_id, in_app, whatsapp")
    .eq("kategori", "tugas")
    .in("user_id", userIds);
  if (galatBaca) {
    throw new Error(
      `Gagal membaca preferensi notifikasi: ${galatBaca.message}`,
    );
  }

  const { error: galatBungkam } = await sb
    .from("notification_preferences")
    .upsert(
      userIds.map((user_id) => ({
        user_id,
        kategori: "tugas" as const,
        in_app: false,
        // WhatsApp tidak boleh menyala tanpa in-app (0115).
        whatsapp: false,
      })),
      { onConflict: "user_id,kategori" },
    );
  if (galatBungkam) {
    throw new Error(`Gagal membungkam notifikasi: ${galatBungkam.message}`);
  }

  const asli = new Map((semula ?? []).map((p) => [p.user_id, p]));
  return async () => {
    const { error } = await sb.from("notification_preferences").upsert(
      userIds.map((user_id) => {
        const p = asli.get(user_id);
        return {
          user_id,
          kategori: "tugas" as const,
          in_app: p ? p.in_app : true,
          whatsapp: p ? p.whatsapp : false,
        };
      }),
      { onConflict: "user_id,kategori" },
    );
    return error
      ? `Preferensi notifikasi tugas belum pulih (${error.message}); nyalakan kembali in-app kategori tugas untuk ${userIds.length} orang.`
      : null;
  };
}

/**
 * Menerapkan `todos:all`.
 *
 * Todo di V2 bukan jenis data tersendiri: ia tugas bertipe pribadi yang
 * pembuat dan penerimanya orang yang sama. Jadi yang dikerjakan persis
 * sama dengan tugas, hanya asal dan tipenya yang berbeda — dan itulah
 * sebabnya keduanya memakai satu jalur, bukan dua yang harus dijaga
 * tetap sama.
 */
export async function terapkanTodo(
  tahap: "uji_coba" | "sungguhan",
): Promise<HasilTerap> {
  return terapkanTugas(tahap, { todo: true });
}

/**
 * Menerapkan `keuangan:cashflow`.
 *
 * Arus kas lama hanya mencatat yang sudah terjadi: tidak ada pengajuan
 * dan tidak ada persetujuan di dalamnya. Jadi semuanya masuk berstatus
 * dibayar, tanpa melewati alur persetujuan V2 — meminta orang menyetujui
 * ulang transaksi tahun lalu bukan kehati-hatian, itu pekerjaan yang
 * hasilnya sudah pasti.
 */
export async function terapkanKas(
  tahap: "uji_coba" | "sungguhan",
): Promise<HasilTerap> {
  const [isi, resolusi] = await Promise.all([
    isiEksporLama(),
    resolusiOrangV1(),
  ]);

  const orang = new Map(resolusi.padanan.map((p) => [p.idLama, p.idBaru]));
  const daftar = Array.isArray(isi["keuangan:cashflow"])
    ? (isi["keuangan:cashflow"] as unknown[])
    : [];

  const hasil: HasilTerap = {
    kelompok: "keuangan:cashflow",
    diperiksa: daftar.length,
    ditulis: 0,
    tertahan: 0,
    catatan: [],
  };

  type SiapKas = {
    idLama: string;
    isi: Record<string, unknown>;
    unitKode: string | null;
  };

  const siap: SiapKas[] = [];
  for (const t of daftar) {
    if (t === null || typeof t !== "object") continue;
    const baris = t as Record<string, unknown>;
    const idLama = typeof baris.id === "string" ? baris.id : "";
    if (idLama === "") continue;

    // Ekspor lama yang sebenarnya menulis medannya dalam bahasa Indonesia:
    // `tanggal`, `tipe`, `jumlah`, `kategori`, `keterangan`, `divisi`.
    const tanggalMentah = baris.date ?? baris.tanggal;
    const jumlahMentah = baris.amount ?? baris.jumlah;
    const kategori = baris.category ?? baris.kategori;
    const tanggal = keTanggal(tanggalMentah);
    const jumlah = keAngka(jumlahMentah);

    if (!tanggal || jumlah === null || jumlah < 0) {
      hasil.tertahan += 1;
      hasil.catatan.push({
        idLama,
        pesan: !tanggal
          ? `Tanggal '${String(tanggalMentah ?? "")}' tidak terbaca.`
          : `Jumlah '${String(jumlahMentah ?? "")}' bukan angka yang sah.`,
      });
      continue;
    }

    const arah = arahV1(baris.type ?? baris.tipe);
    const jenis = arah === "keluar" ? jenisKeluarV1(kategori) : null;
    if (arah === "keluar" && !jenis) {
      hasil.catatan.push({
        idLama,
        pesan: `Kategori '${String(kategori ?? "")}' tidak dikenali; masuk sebagai beban dan kategori aslinya ditulis di keterangan.`,
      });
    }

    const pengajuLama =
      typeof baris.inputById === "string" ? baris.inputById : null;

    siap.push({
      idLama,
      unitKode: unitV1(baris.division ?? baris.divisi),
      isi: {
        tanggal,
        arah,
        // Jenis wajib untuk arah keluar; 'beban' adalah yang paling
        // netral dan tidak mengubah arti laporan keuangannya.
        jenis: arah === "keluar" ? (jenis ?? "beban") : null,
        jumlah,
        keterangan: keteranganKas(
          baris.description ?? baris.keterangan,
          kategori,
          jenis !== null,
        ),
        // Semuanya sudah terjadi: tidak melewati antrean persetujuan.
        status: "dibayar",
        diajukan_id: pengajuLama ? (orang.get(pengajuLama) ?? null) : null,
      },
    });
  }

  if (tahap === "uji_coba" || modeData() === "demo") return hasil;

  const sb = await klienServer();
  const [unitDb, peta] = await Promise.all([
    sb.from("units").select("id, kode"),
    bacaPeta(sb, "keuangan:cashflow"),
  ]);
  const unitId = new Map<string, string>(
    (unitDb.data ?? []).map((u) => [u.kode as string, u.id]),
  );

  for (const k of siap) {
    const tulis = await tulisIdempoten(sb, {
      kelompok: "keuangan:cashflow",
      idLama: k.idLama,
      tabel: "transactions",
      peta,
      isi: {},
      lewatJalur: async (idSekarang) => {
        // Pemasukan tidak melewati persetujuan: trigger 0097 langsung
        // menandainya dibayar saat dibuat, sehingga jalur khusus (0158)
        // — yang menaikkan status tahap demi tahap — menolaknya. Ditulis
        // langsung; yang sudah pernah pindah dibiarkan apa adanya.
        if (k.isi.arah === "masuk") {
          if (idSekarang) return { id: idSekarang };
          const { data: masuk, error: galatMasuk } = await sb
            .from("transactions")
            .insert({
              tanggal: k.isi.tanggal as string,
              arah: "masuk",
              jenis: null,
              jumlah: k.isi.jumlah as number,
              keterangan: k.isi.keterangan as string,
              unit_id: k.unitKode ? (unitId.get(k.unitKode) ?? null) : null,
              diajukan_id: k.isi.diajukan_id as string | null,
            })
            .select("id")
            .single();
          return galatMasuk ? { galat: galatMasuk.message } : { id: masuk.id };
        }

        const { data, error } = await sb.rpc("migrasi_tulis_transaksi", {
          p_tanggal: k.isi.tanggal as string,
          p_arah: k.isi.arah as "masuk" | "keluar",
          p_jenis: k.isi.jenis as
            | "beban"
            | "aset"
            | "direct_cost"
            | "creator_share"
            | "dividen"
            | null,
          p_jumlah: k.isi.jumlah as number,
          p_keterangan: k.isi.keterangan as string,
          p_unit: k.unitKode ? (unitId.get(k.unitKode) ?? null) : null,
          p_diajukan: k.isi.diajukan_id as string | null,
          p_id: idSekarang,
        });
        return error ? { galat: error.message } : { id: data };
      },
    });

    if ("galat" in tulis) {
      hasil.catatan.push({ idLama: k.idLama, pesan: tulis.galat });
      continue;
    }
    hasil.ditulis += 1;
  }

  return hasil;
}

/**
 * Mencatat kunci yang sengaja tidak dipetakan.
 *
 * Tidak menulis apa pun — itulah intinya. Yang dikerjakan hanya
 * menuliskan keputusannya ke catatan jalan migrasi, supaya laporan
 * akhirnya bisa menjawab pertanyaan yang pasti muncul kemudian: "kenapa
 * data sampel tidak ada di V2?" Jawaban yang hanya hidup di kepala orang
 * yang menulis kodenya bukan jawaban.
 */
export async function catatKunciTakDipetakan(): Promise<HasilTerap> {
  const isi = await isiEksporLama();

  const hasil: HasilTerap = {
    kelompok: "kunci-tak-dipetakan",
    diperiksa: 0,
    ditulis: 0,
    tertahan: 0,
    catatan: [],
  };

  for (const [kunci, nilai] of Object.entries(isi)) {
    const golongan = golonganKunci(kunci);
    if (golongan === "dikenal") continue;

    const jumlah = Array.isArray(nilai) ? nilai.length : 1;
    hasil.diperiksa += 1;
    hasil.tertahan += 1;

    const sebab =
      golongan === "referensi"
        ? "Dicatat sebagai rujukan angka lama; dipakai layar verifikasi, tidak ditulis ke tabel mana pun."
        : golongan === "diabaikan"
          ? "Sengaja tidak dibawa: isinya lampiran, cadangan, atau sisa alat bantu sistem lama."
          : "Belum dikenali. Tersimpan mentah dan menunggu keputusan; tidak ada yang membuangnya diam-diam.";

    hasil.catatan.push({
      idLama: kunci,
      pesan: `${jumlah} entri. ${sebab}`,
    });
  }

  return hasil;
}

// =====================================================================
// Kelompok tahap 2: pengumuman, kalender, masalah, masukan, sampel, LMS.
//
// Tabel-tabel ini tidak punya jalur migrasi khusus (0158); yang dipakai
// jalur biasa dengan klien tanpa sesi. Triggernya tetap berjalan, jadi
// tiap fungsi di bawah menghindari jalan yang mereka tutup: pengumuman
// disisipkan sebagai draf supaya tidak menyalakan notifikasi massal,
// agenda tidak pernah mengubah unitnya, status masukan tidak pernah
// diubah sesudah masuk, dan status sampel digerakkan lewat kejadian.
// =====================================================================

const larikLama = (isi: Record<string, unknown>, kunci: string): unknown[] =>
  Array.isArray(isi[kunci]) ? (isi[kunci] as unknown[]) : [];

async function petaUnit(sb: KlienDb) {
  const { data, error } = await sb.from("units").select("id, kode");
  if (error) throw new Error(`Gagal membaca unit: ${error.message}`);
  return new Map<string, string>(
    (data ?? []).map((u) => [u.kode as string, u.id]),
  );
}

function hasilKosong(kelompok: string, diperiksa: number): HasilTerap {
  return { kelompok, diperiksa, ditulis: 0, tertahan: 0, catatan: [] };
}

/** Menerapkan `announcements:all` ke `announcements`. */
export async function terapkanPengumuman(
  tahap: "uji_coba" | "sungguhan",
): Promise<HasilTerap> {
  const [isi, resolusi] = await Promise.all([
    isiEksporLama(),
    resolusiOrangV1(),
  ]);
  const orang = new Map(resolusi.padanan.map((p) => [p.idLama, p.idBaru]));
  const daftar = larikLama(isi, "announcements:all");
  const { siap, tertahan } = bacaPengumuman(daftar);
  const hasil = hasilKosong("announcements:all", daftar.length);
  hasil.tertahan = tertahan.length;
  hasil.catatan.push(...tertahan);
  if (tahap === "uji_coba" || modeData() === "demo") return hasil;

  const sb = await klienServer();
  const peta = await bacaPeta(sb, "announcements:all");
  for (const p of siap) {
    const dibuatOleh = p.dibuatOleh ? (orang.get(p.dibuatOleh) ?? null) : null;
    if (p.dibuatOleh && !dibuatOleh) {
      hasil.catatan.push({
        idLama: p.idLama,
        pesan: `Penulisnya (${p.dibuatOleh}) belum tertaut; pengumuman masuk tanpa penulis.`,
      });
    }
    const kolom = {
      slug: p.slug,
      judul: p.judul,
      ringkasan: p.ringkasan,
      isi: p.isi,
      dibuat_oleh: dibuatOleh,
      target_role: null,
      target_unit_id: null,
      disematkan: false,
    };
    const tulis = await tulisIdempoten(sb, {
      kelompok: "announcements:all",
      idLama: p.idLama,
      tabel: "announcements",
      peta,
      isi: {},
      cariLama: async () => {
        const { data } = await sb
          .from("announcements")
          .select("id")
          .eq("slug", p.slug)
          .maybeSingle();
        return data?.id ?? null;
      },
      lewatJalur: async (idSekarang) => {
        if (idSekarang) {
          const { data: ada, error } = await sb
            .from("announcements")
            .update(kolom)
            .eq("id", idSekarang)
            .select("id")
            .maybeSingle();
          if (error) return { galat: error.message };
          if (ada) return { id: ada.id };
        }
        // Disisipkan sebagai draf: pemicu notifikasi (0112/0116) hanya
        // menyala pada INSERT yang sudah terbit, dan pengumuman berbulan
        // lalu tidak boleh muncul sebagai notifikasi baru bagi semua orang.
        // Tanggal terbitnya dipasang lewat UPDATE, yang tidak memicu apa pun.
        const { data: baru, error: galatSisip } = await sb
          .from("announcements")
          .insert({
            ...kolom,
            published_at: null,
            created_at: p.dibuatPada ?? new Date().toISOString(),
          })
          .select("id")
          .single();
        if (galatSisip || !baru) {
          return {
            galat: galatSisip?.message ?? "Gagal menyisipkan pengumuman.",
          };
        }
        const { error: galatTerbit } = await sb
          .from("announcements")
          .update({ published_at: p.dibuatPada ?? new Date().toISOString() })
          .eq("id", baru.id);
        if (galatTerbit) return { galat: galatTerbit.message };
        return { id: baru.id };
      },
    });
    if ("galat" in tulis) {
      hasil.tertahan += 1;
      hasil.catatan.push({ idLama: p.idLama, pesan: tulis.galat });
      continue;
    }
    hasil.ditulis += 1;
  }
  return hasil;
}

/** Menerapkan `calendar:all` (dan `schedule:all` yang belum tersalin) ke `agenda`. */
export async function terapkanAgenda(
  tahap: "uji_coba" | "sungguhan",
): Promise<HasilTerap> {
  const [isi, resolusi] = await Promise.all([
    isiEksporLama(),
    resolusiOrangV1(),
  ]);
  const orang = new Map(resolusi.padanan.map((p) => [p.idLama, p.idBaru]));
  const { siap, tertahan } = bacaAgenda(isi);
  const hasil = hasilKosong(
    "calendar:all",
    larikLama(isi, "calendar:all").length +
      larikLama(isi, "schedule:all").length,
  );
  hasil.tertahan = tertahan.length;
  hasil.catatan.push(...tertahan);
  const tersalin =
    larikLama(isi, "schedule:all").length -
    siap.filter((a) => a.sumber === "schedule:all").length;
  if (tersalin > 0) {
    hasil.catatan.push({
      idLama: "schedule:all",
      pesan: `${tersalin} jadwal lama sudah disalin sistem lama ke kalendernya; catatannya digabungkan ke salinan itu, tidak dibawa dua kali.`,
    });
  }
  if (tahap === "uji_coba" || modeData() === "demo") return hasil;

  const sb = await klienServer();
  const peta = {
    "calendar:all": await bacaPeta(sb, "calendar:all"),
    "schedule:all": await bacaPeta(sb, "schedule:all"),
  };
  for (const a of siap) {
    const kolom = {
      judul: a.judul,
      keterangan: a.keterangan,
      jenis: a.jenis,
      tanggal: a.tanggal,
      jam_mulai: a.jamMulai,
      jam_selesai: a.jamSelesai,
      lokasi: a.lokasi,
    };
    const tulis = await tulisIdempoten(sb, {
      kelompok: a.sumber,
      idLama: a.idLama,
      tabel: "agenda",
      peta: peta[a.sumber],
      isi: {},
      lewatJalur: async (idSekarang) => {
        if (idSekarang) {
          // Unit tidak ikut diubah: trigger 0095 menolak perubahan unit
          // tanpa sesi, dan agenda lama memang untuk seluruh perusahaan.
          const { data: ada, error } = await sb
            .from("agenda")
            .update(kolom)
            .eq("id", idSekarang)
            .select("id")
            .maybeSingle();
          if (error) return { galat: error.message };
          if (ada) return { id: ada.id };
        }
        const { data, error } = await sb
          .from("agenda")
          .insert({
            ...kolom,
            unit_id: null,
            dibuat_oleh: a.dibuatOleh
              ? (orang.get(a.dibuatOleh) ?? null)
              : null,
            created_at: a.dibuatPada ?? new Date().toISOString(),
          })
          .select("id")
          .single();
        return error || !data
          ? { galat: error?.message ?? "Gagal menyisipkan agenda." }
          : { id: data.id };
      },
    });
    if ("galat" in tulis) {
      hasil.tertahan += 1;
      hasil.catatan.push({ idLama: a.idLama, pesan: tulis.galat });
      continue;
    }
    hasil.ditulis += 1;
  }
  return hasil;
}

/** Menerapkan `problems:all` ke `problems` beserta jejak penyelesaiannya. */
export async function terapkanMasalah(
  tahap: "uji_coba" | "sungguhan",
): Promise<HasilTerap> {
  const [isi, resolusi] = await Promise.all([
    isiEksporLama(),
    resolusiOrangV1(),
  ]);
  const orang = new Map(resolusi.padanan.map((p) => [p.idLama, p.idBaru]));
  const daftar = larikLama(isi, "problems:all");
  const { siap, tertahan } = bacaMasalah(daftar);
  const hasil = hasilKosong("problems:all", daftar.length);
  hasil.tertahan = tertahan.length;
  hasil.catatan.push(...tertahan);
  if (tahap === "uji_coba" || modeData() === "demo") return hasil;

  const sb = await klienServer();
  const [unit, peta, petaJejak] = await Promise.all([
    petaUnit(sb),
    bacaPeta(sb, "problems:all"),
    bacaPeta(sb, "problems:kejadian"),
  ]);
  for (const m of siap) {
    const unitId = m.unitKode ? (unit.get(m.unitKode) ?? null) : null;
    const kolom = {
      judul: m.judul,
      konteks: m.konteks,
      dampak: m.dampak,
      solusi: m.solusi,
    };
    const tulis = await tulisIdempoten(sb, {
      kelompok: "problems:all",
      idLama: m.idLama,
      tabel: "problems",
      peta,
      isi: {},
      lewatJalur: async (idSekarang) => {
        if (idSekarang) {
          // Status tidak ikut: mengubahnya lewat UPDATE menulis jejak baru
          // (0086) atas nama tidak seorang pun.
          const { data: ada, error } = await sb
            .from("problems")
            .update(kolom)
            .eq("id", idSekarang)
            .select("id")
            .maybeSingle();
          if (error) return { galat: error.message };
          if (ada) return { id: ada.id };
        }
        const { data, error } = await sb
          .from("problems")
          .insert({
            ...kolom,
            unit_id: unitId,
            dilaporkan_oleh: m.dilaporkanOleh
              ? (orang.get(m.dilaporkanOleh) ?? null)
              : null,
            status: m.status,
            created_at: m.dibuatPada ?? new Date().toISOString(),
            updated_at:
              m.diselesaikanPada ?? m.dibuatPada ?? new Date().toISOString(),
          })
          .select("id")
          .single();
        return error || !data
          ? { galat: error?.message ?? "Gagal menyisipkan masalah." }
          : { id: data.id };
      },
    });
    if ("galat" in tulis) {
      hasil.tertahan += 1;
      hasil.catatan.push({ idLama: m.idLama, pesan: tulis.galat });
      continue;
    }
    hasil.ditulis += 1;

    // Jejak penyelesaian, supaya riwayatnya terbaca seperti masalah V2.
    if (
      (m.status === "selesai" || m.status === "ditutup") &&
      m.diselesaikanPada
    ) {
      const jejak = await tulisIdempoten(sb, {
        kelompok: "problems:kejadian",
        idLama: `${m.idLama}#${m.status}`,
        tabel: "problem_events",
        peta: petaJejak,
        isi: {},
        lewatJalur: async (idSekarang) => {
          if (idSekarang) return { id: idSekarang };
          const { data, error } = await sb
            .from("problem_events")
            .insert({
              problem_id: tulis.id,
              dari: "baru",
              ke: m.status,
              oleh_id: m.diselesaikanOleh
                ? (orang.get(m.diselesaikanOleh) ?? null)
                : null,
              catatan: "Diselesaikan di sistem lama.",
              pada: m.diselesaikanPada ?? undefined,
            })
            .select("id")
            .single();
          return error || !data
            ? { galat: error?.message ?? "Gagal menulis jejak." }
            : { id: data.id };
        },
      });
      if ("galat" in jejak) {
        hasil.catatan.push({
          idLama: m.idLama,
          pesan: `Jejak penyelesaian tidak tertulis: ${jejak.galat}`,
        });
      }
    }
  }
  return hasil;
}

/** Menerapkan `feedback:all` ke `feedback` beserta balasannya. */
export async function terapkanMasukan(
  tahap: "uji_coba" | "sungguhan",
): Promise<HasilTerap> {
  const [isi, resolusi] = await Promise.all([
    isiEksporLama(),
    resolusiOrangV1(),
  ]);
  const orang = new Map(resolusi.padanan.map((p) => [p.idLama, p.idBaru]));
  const daftar = larikLama(isi, "feedback:all");
  const { siap, tertahan } = bacaMasukan(daftar);
  const hasil = hasilKosong("feedback:all", daftar.length);
  hasil.tertahan = tertahan.length;
  hasil.catatan.push(...tertahan);
  if (tahap === "uji_coba" || modeData() === "demo") return hasil;

  const sb = await klienServer();
  const [peta, petaKomentar] = await Promise.all([
    bacaPeta(sb, "feedback:all"),
    bacaPeta(sb, "feedback:komentar"),
  ]);
  let komentarDitulis = 0;
  for (const f of siap) {
    const tulis = await tulisIdempoten(sb, {
      kelompok: "feedback:all",
      idLama: f.idLama,
      tabel: "feedback",
      peta,
      isi: {},
      lewatJalur: async (idSekarang) => {
        // Masukan yang sudah masuk tidak diubah lagi: trigger 0093 menilai
        // siapa yang mengubah, dan tanpa sesi jawabannya "bukan siapa pun".
        if (idSekarang) return { id: idSekarang };
        const { data, error } = await sb
          .from("feedback")
          .insert({
            jenis: f.jenis,
            judul: f.judul,
            isi: f.isi,
            halaman: f.halaman,
            status: f.status,
            dilaporkan_oleh: f.dilaporkanOleh
              ? (orang.get(f.dilaporkanOleh) ?? null)
              : null,
            created_at: f.dibuatPada ?? new Date().toISOString(),
            updated_at: f.dibuatPada ?? new Date().toISOString(),
          })
          .select("id")
          .single();
        return error || !data
          ? { galat: error?.message ?? "Gagal menyisipkan masukan." }
          : { id: data.id };
      },
    });
    if ("galat" in tulis) {
      hasil.tertahan += 1;
      hasil.catatan.push({ idLama: f.idLama, pesan: tulis.galat });
      continue;
    }
    hasil.ditulis += 1;

    for (const k of f.komentar) {
      const komentar = await tulisIdempoten(sb, {
        kelompok: "feedback:komentar",
        idLama: k.idLama,
        tabel: "feedback_comments",
        peta: petaKomentar,
        isi: {},
        lewatJalur: async (idSekarang) => {
          if (idSekarang) return { id: idSekarang };
          const { data, error } = await sb
            .from("feedback_comments")
            .insert({
              feedback_id: tulis.id,
              oleh_id: k.oleh ? (orang.get(k.oleh) ?? null) : null,
              isi: k.isi,
              created_at: k.pada ?? new Date().toISOString(),
            })
            .select("id")
            .single();
          return error || !data
            ? { galat: error?.message ?? "Gagal menyisipkan balasan." }
            : { id: data.id };
        },
      });
      if ("galat" in komentar) {
        hasil.catatan.push({
          idLama: k.idLama,
          pesan: `Balasan tidak tertulis: ${komentar.galat}`,
        });
      } else {
        komentarDitulis += 1;
      }
    }
  }
  if (komentarDitulis > 0) {
    hasil.catatan.push({
      idLama: "feedback:komentar",
      pesan: `${komentarDitulis} balasan ikut ditulis sebagai komentar.`,
    });
  }
  return hasil;
}

/** Menerapkan `sampel:all` dan `sampel-usage:all` ke sampel V2. */
export async function terapkanSampel(
  tahap: "uji_coba" | "sungguhan",
): Promise<HasilTerap> {
  const [isi, resolusi] = await Promise.all([
    isiEksporLama(),
    resolusiOrangV1(),
  ]);
  const orang = new Map(resolusi.padanan.map((p) => [p.idLama, p.idBaru]));
  const { sampel, pindai, tertahan } = bacaSampel(isi);
  const hasil = hasilKosong(
    "sampel:all",
    larikLama(isi, "sampel:all").length +
      larikLama(isi, "sampel-usage:all").length,
  );
  hasil.tertahan = tertahan.length;
  hasil.catatan.push(...tertahan);
  if (tahap === "uji_coba" || modeData() === "demo") return hasil;

  const sb = await klienServer();
  const [unit, peta, petaKejadian, petaPindai] = await Promise.all([
    petaUnit(sb),
    bacaPeta(sb, "sampel:all"),
    bacaPeta(sb, "sampel:kejadian"),
    bacaPeta(sb, "sampel-usage:all"),
  ]);
  const unitAffiliator = unit.get(UNIT_AKUN_BAWAAN);
  if (!unitAffiliator) throw new Error("Unit affiliator tidak ada di V2.");

  for (const s of sampel) {
    const kolom = {
      nama: s.nama,
      kategori: s.kategori,
      catatan: s.catatan,
      link_produk: s.linkProduk,
    };
    const tulis = await tulisIdempoten(sb, {
      kelompok: "sampel:all",
      idLama: s.idLama,
      tabel: "samples",
      peta,
      isi: {},
      cariLama: async () => {
        const { data } = await sb
          .from("samples")
          .select("id")
          .ilike("kode", s.kode)
          .maybeSingle();
        return data?.id ?? null;
      },
      lewatJalur: async (idSekarang) => {
        if (idSekarang) {
          const { data: ada, error } = await sb
            .from("samples")
            .update(kolom)
            .eq("id", idSekarang)
            .select("id")
            .maybeSingle();
          if (error) return { galat: error.message };
          if (ada) return { id: ada.id };
        }
        // Masuk sebagai tersedia; pemegangnya dicatat sebagai kejadian di
        // bawah, karena V2 hanya mengubah status lewat kejadian (0049).
        const { data, error } = await sb
          .from("samples")
          .insert({
            ...kolom,
            kode: s.kode,
            unit_id: unitAffiliator,
            nilai: 0,
            status: "tersedia",
            created_at: s.dibuatPada ?? new Date().toISOString(),
          })
          .select("id")
          .single();
        return error || !data
          ? { galat: error?.message ?? "Gagal menyisipkan sampel." }
          : { id: data.id };
      },
    });
    if ("galat" in tulis) {
      hasil.tertahan += 1;
      hasil.catatan.push({ idLama: s.idLama, pesan: tulis.galat });
      continue;
    }
    hasil.ditulis += 1;

    if (s.pemegang) {
      const pemegang = orang.get(s.pemegang);
      if (!pemegang) {
        hasil.catatan.push({
          idLama: s.idLama,
          pesan: `Penerimanya (${s.pemegang}) belum tertaut; sampel tetap tersedia.`,
        });
        continue;
      }
      const kejadian = await tulisIdempoten(sb, {
        kelompok: "sampel:kejadian",
        idLama: `${s.idLama}#dipegang`,
        tabel: "sample_events",
        peta: petaKejadian,
        isi: {},
        lewatJalur: async (idSekarang) => {
          if (idSekarang) return { id: idSekarang };
          const { data, error } = await sb
            .from("sample_events")
            .insert({
              sample_id: tulis.id,
              ke: "dipegang",
              oleh_id: s.dibuatOleh ? (orang.get(s.dibuatOleh) ?? null) : null,
              pemegang_id: pemegang,
              catatan: "Penerima tercatat di sistem lama.",
              pada: s.dibuatPada ?? new Date().toISOString(),
            })
            .select("id")
            .single();
          return error || !data
            ? { galat: error?.message ?? "Gagal menulis kejadian." }
            : { id: data.id };
        },
      });
      if ("galat" in kejadian) {
        hasil.catatan.push({
          idLama: s.idLama,
          pesan: `Pemegang tidak tercatat: ${kejadian.galat}`,
        });
      }
    }
  }

  // Pindaian: kode yang tidak dikenal (sampel yang sudah dihapus di sistem
  // lama) tetap dicatat sebagai pindaian tak dikenali, seperti di V2.
  const { data: daftarSampel } = await sb.from("samples").select("id, kode");
  const idKode = new Map(
    (daftarSampel ?? []).map((x) => [x.kode.toUpperCase(), x.id]),
  );
  let pindaiDitulis = 0;
  for (const p of pindai) {
    const oleh = p.oleh ? orang.get(p.oleh) : undefined;
    if (!oleh) {
      hasil.tertahan += 1;
      hasil.catatan.push({
        idLama: p.idLama,
        pesan: `Pemindainya (${p.oleh ?? "tidak disebut"}) belum tertaut.`,
      });
      continue;
    }
    const sampleId = idKode.get(p.kode) ?? null;
    const tulis = await tulisIdempoten(sb, {
      kelompok: "sampel-usage:all",
      idLama: p.idLama,
      tabel: "sample_scans",
      peta: petaPindai,
      isi: {},
      lewatJalur: async (idSekarang) => {
        if (idSekarang) return { id: idSekarang };
        const { data, error } = await sb
          .from("sample_scans")
          .insert({
            kode: p.kode,
            sample_id: sampleId,
            oleh_id: oleh,
            dikenali: sampleId !== null,
            pada: p.pada ?? new Date().toISOString(),
          })
          .select("id")
          .single();
        return error || !data
          ? { galat: error?.message ?? "Gagal menulis pindaian." }
          : { id: data.id };
      },
    });
    if ("galat" in tulis) {
      hasil.tertahan += 1;
      hasil.catatan.push({ idLama: p.idLama, pesan: tulis.galat });
      continue;
    }
    pindaiDitulis += 1;
    hasil.ditulis += 1;
  }
  if (pindaiDitulis > 0) {
    hasil.catatan.push({
      idLama: "sampel-usage:all",
      pesan: `${pindaiDitulis} pindaian lama tercatat sebagai riwayat pindai.`,
    });
  }
  return hasil;
}

/** Menerapkan seluruh kunci `lms:*` ke kursus, modul, pendaftaran, dan kemajuan V2. */
export async function terapkanLms(
  tahap: "uji_coba" | "sungguhan",
): Promise<HasilTerap> {
  const [isi, resolusi] = await Promise.all([
    isiEksporLama(),
    resolusiOrangV1(),
  ]);
  const orang = new Map(resolusi.padanan.map((p) => [p.idLama, p.idBaru]));
  const lms = bacaLms(isi);
  const hasil = hasilKosong(
    "lms:courses:all",
    lms.kursus.length + lms.pendaftaran.length + lms.kemajuan.length,
  );
  hasil.catatan.push(...lms.catatan);
  if (tahap === "uji_coba" || modeData() === "demo") {
    hasil.tertahan = lms.pendaftaran.filter(
      (p) => !orang.has(p.userLama),
    ).length;
    return hasil;
  }

  const sb = await klienServer();
  const [unit, petaKursus, petaModul, petaDaftar, petaMaju] = await Promise.all(
    [
      petaUnit(sb),
      bacaPeta(sb, "lms:courses:all"),
      bacaPeta(sb, "lms:modul"),
      bacaPeta(sb, "lms:enrollments:all"),
      bacaPeta(sb, "lms:progress:all"),
    ],
  );
  const pembuat =
    lms.pendaftaran
      .map((p) => p.ditugaskanOleh)
      .find((id) => id && orang.has(id)) ?? null;

  // 1. Kursus dan modulnya.
  const idKursus = new Map<string, string>();
  const idModul = new Map<string, string>();
  for (const k of lms.kursus) {
    const tulis = await tulisIdempoten(sb, {
      kelompok: "lms:courses:all",
      idLama: k.idLama,
      tabel: "courses",
      peta: petaKursus,
      isi: {
        judul: k.judul,
        ringkasan: k.ringkasan,
        kategori: k.kategori,
        tingkat: "dasar",
        unit_id: k.unitKode ? (unit.get(k.unitKode) ?? null) : null,
        wajib_untuk: [],
        aktif: k.aktif,
        dibuat_oleh: pembuat ? (orang.get(pembuat) ?? null) : null,
        created_at: k.dibuatPada ?? new Date().toISOString(),
      },
    });
    if ("galat" in tulis) {
      hasil.tertahan += 1;
      hasil.catatan.push({ idLama: k.idLama, pesan: tulis.galat });
      continue;
    }
    hasil.ditulis += 1;
    idKursus.set(k.idLama, tulis.id);

    for (const m of k.modul) {
      const modul = await tulisIdempoten(sb, {
        kelompok: "lms:modul",
        idLama: m.idLama,
        tabel: "course_modules",
        peta: petaModul,
        isi: {
          course_id: tulis.id,
          urutan: m.urutan,
          judul: m.judul,
          isi: m.isi,
          durasi_menit: m.durasiMenit,
        },
        cariLama: async () => {
          const { data } = await sb
            .from("course_modules")
            .select("id")
            .eq("course_id", tulis.id)
            .eq("urutan", m.urutan)
            .maybeSingle();
          return data?.id ?? null;
        },
      });
      if ("galat" in modul) {
        hasil.catatan.push({
          idLama: m.idLama,
          pesan: `Modul tidak tertulis: ${modul.galat}`,
        });
        continue;
      }
      idModul.set(m.idLama, modul.id);
    }
  }

  // 2. Pendaftaran per kursus.
  const idDaftar = new Map<string, string>();
  let daftarDitulis = 0;
  for (const p of lms.pendaftaran) {
    const userId = orang.get(p.userLama);
    const courseId = idKursus.get(p.kursusLama);
    if (!userId || !courseId) {
      hasil.tertahan += 1;
      hasil.catatan.push({
        idLama: p.idLama,
        pesan: !userId
          ? `Pesertanya (${p.userLama}) belum tertaut.`
          : `Kursusnya (${p.kursusLama}) tidak tertulis.`,
      });
      continue;
    }
    const tulis = await tulisIdempoten(sb, {
      kelompok: "lms:enrollments:all",
      idLama: p.idLama,
      tabel: "course_enrollments",
      peta: petaDaftar,
      isi: {},
      cariLama: async () => {
        const { data } = await sb
          .from("course_enrollments")
          .select("id")
          .eq("course_id", courseId)
          .eq("user_id", userId)
          .maybeSingle();
        return data?.id ?? null;
      },
      lewatJalur: async (idSekarang) => {
        if (idSekarang) return { id: idSekarang };
        const { data, error } = await sb
          .from("course_enrollments")
          .insert({
            course_id: courseId,
            user_id: userId,
            dimulai_pada: p.dimulai ?? new Date().toISOString(),
          })
          .select("id")
          .single();
        return error || !data
          ? { galat: error?.message ?? "Gagal mendaftarkan." }
          : { id: data.id };
      },
    });
    if ("galat" in tulis) {
      hasil.tertahan += 1;
      hasil.catatan.push({ idLama: p.idLama, pesan: tulis.galat });
      continue;
    }
    daftarDitulis += 1;
    hasil.ditulis += 1;
    idDaftar.set(`${p.userLama}|${p.kursusLama}`, tulis.id);
  }

  // 3. Kemajuan modul yang sudah tuntas.
  let majuDitulis = 0;
  for (const m of lms.kemajuan) {
    const enrollmentId = idDaftar.get(`${m.userLama}|${m.kursusLama}`);
    const moduleId = idModul.get(m.modulLama);
    if (!enrollmentId || !moduleId) {
      hasil.tertahan += 1;
      hasil.catatan.push({
        idLama: m.idLama,
        pesan: !enrollmentId
          ? "Pendaftarannya tidak tertulis."
          : `Modulnya (${m.modulLama}) tidak tertulis.`,
      });
      continue;
    }
    const tulis = await tulisIdempoten(sb, {
      kelompok: "lms:progress:all",
      idLama: m.idLama,
      tabel: "module_progress",
      peta: petaMaju,
      isi: {},
      cariLama: async () => {
        const { data } = await sb
          .from("module_progress")
          .select("id")
          .eq("enrollment_id", enrollmentId)
          .eq("module_id", moduleId)
          .maybeSingle();
        return data?.id ?? null;
      },
      lewatJalur: async (idSekarang) => {
        if (idSekarang) return { id: idSekarang };
        const { data, error } = await sb
          .from("module_progress")
          .insert({
            enrollment_id: enrollmentId,
            module_id: moduleId,
            selesai_pada: m.selesaiPada ?? new Date().toISOString(),
          })
          .select("id")
          .single();
        return error || !data
          ? { galat: error?.message ?? "Gagal menulis kemajuan." }
          : { id: data.id };
      },
    });
    if ("galat" in tulis) {
      hasil.tertahan += 1;
      hasil.catatan.push({ idLama: m.idLama, pesan: tulis.galat });
      continue;
    }
    majuDitulis += 1;
    hasil.ditulis += 1;
  }

  hasil.catatan.push({
    idLama: "lms",
    pesan: `Kursus ${idKursus.size}, modul ${idModul.size}, pendaftaran ${daftarDitulis}, kemajuan ${majuDitulis} tertulis.`,
  });
  return hasil;
}
