// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { isiEksporLama } from "@/lib/data/migrasi";
import { golonganKunci } from "@/lib/ekspor-v1";
import { resolusiOrangV1 } from "@/lib/data/resolusi";
import { peranV1, statusV1, unitV1 } from "@/lib/peran-v1";
import { keAngka, keTanggal } from "@/lib/impor";
import { catatanLaporan } from "@/lib/laporan-v1";
import { orangDitunggu } from "@/lib/rekap-pemetaan";
import {
  hariIzin,
  koordinat,
  persetujuanIzin,
  statusHadir,
} from "@/lib/izin-v1";
import { jejakQcV1, prioritasV1, statusTugasV1 } from "@/lib/tugas-v1";
import { arahV1, jenisKeluarV1, keteranganKas } from "@/lib/keuangan-v1";
import { PEMETAAN_V1 } from "@/lib/pemetaan-v1";
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
  | "transactions";

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
async function tulisIdempoten(
  sb: KlienDb,
  opsi: {
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
  },
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

/** Membaca peta sebuah kelompok sekali, untuk dipakai berulang. */
async function bacaPeta(sb: KlienDb, kelompok: string) {
  const { data } = await sb
    .from("migrasi_peta")
    .select("id_lama, id_baru")
    .eq("kelompok", kelompok);
  return new Map((data ?? []).map((p) => [p.id_lama, p.id_baru]));
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
  kontak: string | null;
  status: "aktif" | "nonaktif";
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

    const role = peranV1(baris.role);
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
      jabatan: typeof baris.position === "string" ? baris.position : null,
      role,
      unitKode: unitV1(baris.division),
      kontak: typeof baris.phone === "string" ? baris.phone : null,
      status: statusV1(baris.active),
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

  // Kode unit → id, dibaca sekali.
  const { data: unitDb } = await sb.from("units").select("id, kode");
  const unitId = new Map<string, string>(
    (unitDb ?? []).map((u) => [u.kode as string, u.id]),
  );

  for (const o of siap) {
    const patch: Record<string, unknown> = { status: o.status };
    if (o.jabatan !== null) patch.jabatan = o.jabatan;
    if (o.role !== null) patch.role = o.role;
    if (o.kontak !== null) patch.kontak = o.kontak;
    if (o.unitKode !== null) patch.unit_id = unitId.get(o.unitKode) ?? null;

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

  const siap: Siap[] = [];
  for (const a of daftar) {
    if (a === null || typeof a !== "object") continue;
    const baris = a as Record<string, unknown>;
    const idLama = typeof baris.id === "string" ? baris.id : "";
    const username =
      typeof baris.username === "string" ? baris.username.trim() : "";
    const unitKode = unitV1(baris.division);

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

  if (tahap === "uji_coba" || modeData() === "demo") return hasil;

  const sb = await klienServer();
  const [unitDb, programDb, peta] = await Promise.all([
    sb.from("units").select("id, kode"),
    sb.from("programs").select("id, nama"),
    bacaPeta(sb, "affiliate-accounts:all"),
  ]);

  const unitId = new Map<string, string>(
    (unitDb.data ?? []).map((u) => [u.kode as string, u.id]),
  );
  const programId = new Map<string, string>(
    (programDb.data ?? []).map((p) => [p.nama, p.id]),
  );

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
        pic_user_id: a.pic,
        co_leader_id: a.coLeader,
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
 * Laporan non-Affiliator masuk dengan GMV nol dan bersasaran unit:
 * angka unit di V2 dihitung dari sumber lain, dan menyalinnya di sini
 * membuat GMV unit terhitung dua kali.
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

  for (const l of daftar) {
    if (l === null || typeof l !== "object") continue;
    const baris = l as Record<string, unknown>;
    const idLama = typeof baris.id === "string" ? baris.id : "";
    if (idLama === "") continue;

    const tanggal = keTanggal(baris["Tanggal Laporan"]);
    if (!tanggal) {
      tahan(
        idLama,
        `Tanggal '${String(baris["Tanggal Laporan"] ?? "")}' tidak terbaca; laporan tanpa tanggal tidak bisa ditempatkan.`,
      );
      continue;
    }

    const userLama = typeof baris.userId === "string" ? baris.userId : "";
    if (!userLama || !orang.has(userLama)) {
      tahan(
        idLama,
        userLama
          ? `Pelapornya (${userLama}) belum tertaut.`
          : "Laporan tanpa pelapor.",
      );
      continue;
    }

    const akun = typeof baris.Akun === "string" ? baris.Akun.trim() : null;
    const unitKode = akun ? null : unitV1(baris.Unit);
    if (!akun && !unitKode) {
      tahan(idLama, "Laporan tidak menyebut akun maupun unit yang dikenali.");
      continue;
    }

    const gmv = keAngka(baris.GMV);
    if (akun && gmv === null) {
      tahan(idLama, `GMV '${String(baris.GMV ?? "")}' bukan angka yang sah.`);
      continue;
    }

    siap.push({
      idLama,
      userLama,
      tanggal,
      akun,
      unitKode,
      // Laporan unit masuk dengan nol; angkanya dihitung dari akun.
      gmv: akun ? (gmv ?? 0) : 0,
      komisi: keAngka(baris.Komisi),
      upload: keAngka(baris["Jumlah Upload"]),
      catatan: catatanLaporan(baris),
      dikirim: typeof baris.createdAt === "string" ? baris.createdAt : null,
    });
  }

  if (tahap === "uji_coba" || modeData() === "demo") return hasil;

  const sb = await klienServer();
  const [unitDb, akunDb, peta] = await Promise.all([
    sb.from("units").select("id, kode"),
    sb.from("accounts").select("id, username"),
    bacaPeta(sb, "daily-reports:all"),
  ]);

  const unitId = new Map<string, string>(
    (unitDb.data ?? []).map((u) => [u.kode as string, u.id]),
  );
  const akunId = new Map((akunDb.data ?? []).map((a) => [a.username, a.id]));

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
      lewatJalur: async () => {
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
      // uniknya — itu bukan kegagalan, itu bukti pengulangan yang
      // memang ditahan.
      hasil.catatan.push({ idLama: l.idLama, pesan: tulis.galat });
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
  const daftar = Array.isArray(isi["attendance:all"])
    ? (isi["attendance:all"] as unknown[])
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
  const { lat, lng } = koordinat(o.lokasi);
  const patch: Record<string, unknown> = {};
  if (typeof o.jamMasuk === "string") patch.jam_masuk = o.jamMasuk;
  const toleransi = keAngka(o.toleransiMenit);
  if (toleransi !== null) patch.toleransi_menit = toleransi;
  const radius = keAngka(o.radiusMeter);
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

  type SiapIzin = {
    idLama: string;
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

    const mulai = keTanggal(baris.startDate);
    const selesai = keTanggal(baris.endDate) ?? mulai;
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

    siap.push({
      idLama,
      userId,
      hari: hariIzin(mulai, selesai),
      mulai,
      selesai,
      status: jenis === "sakit" || jenis === "sick" ? "sakit" : "izin",
      alasan: typeof baris.reason === "string" ? baris.reason : "",
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

    // Todo pribadi: pembuat dan penerimanya orang yang sama.
    const penerimaLama = opsi.todo
      ? typeof baris.userId === "string"
        ? baris.userId
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

    const qc = opsi.todo ? null : jejakQcV1(baris.qc);
    const selesai = opsi.todo
      ? baris.done === true
      : statusTugasV1(baris.status) === "selesai";

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
        tenggat:
          typeof baris.dueDate === "string"
            ? baris.dueDate
            : typeof baris.createdAt === "string"
              ? baris.createdAt
              : null,
        prioritas: opsi.todo ? "sedang" : prioritasV1(baris.priority),
        status: opsi.todo
          ? selesai
            ? "selesai"
            : "todo"
          : statusTugasV1(baris.status),
        // Tanpa waktu selesai, tugas lama yang sudah beres tetap
        // terhitung sebagai tunggakan pada rekap mingguan.
        ...(selesai
          ? {
              selesai_at:
                (typeof baris.completedAt === "string"
                  ? baris.completedAt
                  : null) ??
                (typeof baris.dueDate === "string" ? baris.dueDate : null) ??
                (typeof baris.createdAt === "string" ? baris.createdAt : null),
            }
          : {}),
        ...(qc
          ? {
              qc_status: qc.status,
              qc_by: qc.olehLama ? (orang.get(qc.olehLama) ?? null) : null,
              qc_at: qc.pada,
              qc_note: qc.catatan,
            }
          : {}),
      },
    });
  }

  if (tahap === "uji_coba" || modeData() === "demo") return hasil;

  const sb = await klienServer();
  const peta = await bacaPeta(sb, kunci);

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

  return hasil;
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

    const tanggal = keTanggal(baris.date);
    const jumlah = keAngka(baris.amount);

    if (!tanggal || jumlah === null || jumlah < 0) {
      hasil.tertahan += 1;
      hasil.catatan.push({
        idLama,
        pesan: !tanggal
          ? `Tanggal '${String(baris.date ?? "")}' tidak terbaca.`
          : `Jumlah '${String(baris.amount ?? "")}' bukan angka yang sah.`,
      });
      continue;
    }

    const arah = arahV1(baris.type);
    const jenis = arah === "keluar" ? jenisKeluarV1(baris.category) : null;
    if (arah === "keluar" && !jenis) {
      hasil.catatan.push({
        idLama,
        pesan: `Kategori '${String(baris.category ?? "")}' tidak dikenali; masuk sebagai beban dan kategori aslinya ditulis di keterangan.`,
      });
    }

    const pengajuLama =
      typeof baris.inputById === "string" ? baris.inputById : null;

    siap.push({
      idLama,
      unitKode: unitV1(baris.division),
      isi: {
        tanggal,
        arah,
        // Jenis wajib untuk arah keluar; 'beban' adalah yang paling
        // netral dan tidak mengubah arti laporan keuangannya.
        jenis: arah === "keluar" ? (jenis ?? "beban") : null,
        jumlah,
        keterangan: keteranganKas(
          baris.description,
          baris.category,
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
