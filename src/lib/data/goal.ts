// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { aktifDemo } from "@/lib/demo";
import { hariIniWib } from "@/lib/format";
import type { Pengguna } from "@/lib/types";
import {
  bandingKodeGrd,
  labelPeriode,
  lengkapiRentang,
  periodeDariTangga,
  type AnakTanggaGoal,
  type AnakTanggaLonggar,
  type LevelGoal,
} from "@/lib/goal";

/** Goal hanya dibuat/diubah CEO dan Manager — sejalan policy `goals_buat`. */
export function bolehKelolaGoal(pengguna: Pengguna) {
  return pengguna.role === "CEO" || pengguna.role === "Manager";
}

/**
 * Di modul GRD staf hanya melihat goal miliknya: goal yang dia pemiliknya,
 * atau goal akun yang dia pegang (0198). Peran lain mengikuti RLS.
 */
function goalMilikStaf<T extends { pemilikId: string | null }>(
  pengguna: Pengguna,
  datar: T[],
  picAkun: (g: T) => string | null,
): T[] {
  if (pengguna.role !== "Staff") return datar;
  return datar.filter(
    (g) => g.pemilikId === pengguna.id || picAkun(g) === pengguna.id,
  );
}

/**
 * Periode GRD yang berlaku pada sebuah tanggal (`periode_grd_berlaku`,
 * 0221): GRD terbaru yang sudah dimulai, jadi GRD bulan lalu tetap tampil
 * sampai GRD bulan ini diimpor. null = belum ada GRD sama sekali;
 * undefined = tidak terbaca, dan pemanggil TIDAK menyaring (tampilan lama)
 * supaya goal GRD tidak hilang hanya karena fungsinya gagal.
 */
async function periodeGrdBerlaku(
  tanggal: string,
): Promise<string | null | undefined> {
  const sb = await klienServer();
  const { data, error } = await sb.rpc("periode_grd_berlaku", {
    p_tanggal: tanggal,
  });
  if (error) {
    console.error(`Gagal membaca periode GRD berlaku: ${error.message}`);
    return undefined;
  }
  return data ?? null;
}

/** Saringan PostgREST `or`: goal di luar GRD, ditambah GRD periode itu. */
function saringPeriodeGrd(periode: string | null) {
  return periode
    ? `grd_periode.is.null,grd_periode.eq.${periode}`
    : "grd_periode.is.null";
}

export type GoalRingkas = {
  id: string;
  judul: string;
  level: string;
  satuan: string;
  targetGoal: number;
  periode: string;
};

/**
 * Goal aktif yang boleh dipakai sebagai induk komitmen mingguan: goal di
 * luar GRD dan goal GRD periode yang berlaku (bukan GRD bulan lalu).
 * RLS sudah membatasi barisnya; di mode demo penyaringannya ditiru.
 */
export async function goalAktif(pengguna: Pengguna): Promise<GoalRingkas[]> {
  if (modeData() === "demo") {
    const lintas = pengguna.role === "CEO" || pengguna.role === "Manager";
    return dataContoh.goals
      .filter(
        (g) =>
          lintas || g.unit === pengguna.unitId || g.pemilik === pengguna.nama,
      )
      .map((g) => ({
        id: g.id,
        judul: g.judul,
        level: g.level,
        satuan: "IDR",
        targetGoal: g.target_goal,
        periode: g.periode,
      }));
  }

  const sb = await klienServer();
  const periode = await periodeGrdBerlaku(hariIniWib());
  let kueri = sb
    .from("goals")
    .select("id, judul, level, satuan, target_goal, periode")
    .eq("status", "aktif");
  if (periode !== undefined) kueri = kueri.or(saringPeriodeGrd(periode));
  const { data, error } = await kueri.order("level").order("judul");

  if (error) throw new Error(`Gagal memuat goal: ${error.message}`);

  return (data ?? []).map((g) => ({
    id: g.id,
    judul: g.judul,
    level: g.level,
    satuan: g.satuan,
    targetGoal: Number(g.target_goal),
    periode: g.periode,
  }));
}

export type SimpulGoal = {
  id: string;
  judul: string;
  level: "company" | "manager" | "leader" | "account" | "staff";
  pemilik: string;
  jabatan: string;
  unit: string | null;
  akun: string | null;
  /** Id untuk mengisi ulang dialog ubah goal. */
  pemilikId: string | null;
  unitId: string | null;
  akunId: string | null;
  /** Label periode, mis. "15 Okt – 14 Des 2026"; dari anak tangganya bila ada. */
  periode: string;
  /** Anak tangga bulanan beserta rentang tanggalnya, urut dari bulan pertama. */
  bulan: AnakTanggaGoal[];
  /** Tanggal mulai dan selesai periode; null bila goal belum punya anak tangga. */
  mulai: string | null;
  selesai: string | null;
  satuan: string;
  /** null = base belum diukur (goal GRD staf pendukung). */
  targetBase: number | null;
  targetGoal: number;
  targetStretch: number;
  targetBulan: number;
  realisasi: number;
  rasio: number;
  parentId: string | null;
  /** Kode di file GRD, mis. "1.1.3"; null untuk goal di luar GRD. */
  kode: string | null;
  /** Tanggal "pada …" di rumusan goal GRD. */
  tenggat: string | null;
  jenisRealisasi: "gmv" | "isian";
  keterangan: string;
  /** draft = usulan yang belum disahkan; hanya terlihat CEO/Manager. */
  status: "aktif" | "draft";
  /** Ukuran GRD-nya; `bolehIsi` bila pembaca boleh mencatat capaiannya. */
  ukuran: { id: string; sumber: "gmv" | "isian"; bolehIsi: boolean } | null;
  anak: SimpulGoal[];
};

const URUTAN_LEVEL = ["company", "manager", "leader", "account", "staff"];

/**
 * Periode sebuah goal dibaca dari anak tangganya — bukan dari label yang
 * tersimpan, supaya goal lama berlabel "2026-Q3" pun tampil bertanggal.
 */
function periodeDari(
  bulanMentah: readonly AnakTanggaLonggar[],
  cadangan: string,
) {
  const bulan = bulanMentah
    .map(lengkapiRentang)
    .sort((a, b) => a.bulan.localeCompare(b.bulan));
  const periode = periodeDariTangga(bulan);
  return {
    bulan,
    mulai: periode?.mulai ?? null,
    selesai: periode?.selesai ?? null,
    periode: periode ? labelPeriode(periode.mulai, periode.selesai) : cadangan,
  };
}

/** Menyusun daftar datar menjadi pohon roll-down. */
function keTree(datar: Omit<SimpulGoal, "anak">[]): SimpulGoal[] {
  const peta = new Map<string, SimpulGoal>();
  for (const g of datar) peta.set(g.id, { ...g, anak: [] });

  const akar: SimpulGoal[] = [];
  for (const g of peta.values()) {
    const induk = g.parentId ? peta.get(g.parentId) : null;
    if (induk) induk.anak.push(g);
    else akar.push(g);
  }

  const urutkan = (daftar: SimpulGoal[]) => {
    daftar.sort(
      (a, b) =>
        URUTAN_LEVEL.indexOf(a.level) - URUTAN_LEVEL.indexOf(b.level) ||
        // Goal GRD mengikuti urutan kodenya di file, bukan abjad judul.
        (a.kode && b.kode ? bandingKodeGrd(a.kode, b.kode) : 0) ||
        a.judul.localeCompare(b.judul),
    );
    daftar.forEach((g) => urutkan(g.anak));
  };
  urutkan(akar);

  return akar;
}

/**
 * Pohon goal berjenjang beserta capaian bulan berjalan.
 * Inilah bentuk "roll-down": company → manager → leader → akun/staf.
 * Capaian dihitung di dalam rentang tanggal anak tangga bulan ini.
 */
export async function pohonGoal(
  pengguna: Pengguna,
  tanggal: string,
): Promise<SimpulGoal[]> {
  const awalBulan = `${tanggal.slice(0, 7)}-01`;

  if (modeData() === "demo") {
    const { goals, daily_reports, accounts, units, users } = dataContoh;
    const akunUnit = Object.fromEntries(
      accounts.map((a) => [a.username, a.unit]),
    );

    // Sama dengan `progres_goal` (0178): dari awal rentang anak tangga
    // bulan ini sampai tanggal acuan atau akhir rentangnya.
    const realisasiUntuk = (g: (typeof goals)[number]) => {
      const langkah = (g.bulan_list ?? [])
        .map(lengkapiRentang)
        .find((b) => b.bulan === awalBulan);
      const dari = langkah?.dari ?? awalBulan;
      const sampai =
        langkah && langkah.sampai < tanggal ? langkah.sampai : tanggal;
      const dalamRentang = daily_reports.filter(
        (l) => l.tanggal >= dari && l.tanggal <= sampai,
      );
      if (g.account) {
        return dalamRentang
          .filter((l) => l.akun === g.account)
          .reduce((a, l) => a + l.gmv, 0);
      }
      if (g.unit) {
        return dalamRentang
          .filter((l) => (l.unit ?? akunUnit[l.akun as string]) === g.unit)
          .reduce((a, l) => a + l.gmv, 0);
      }
      return dalamRentang.reduce((a, l) => a + l.gmv, 0);
    };

    const datar = goals.map((g) => {
      const realisasi = realisasiUntuk(g);
      return {
        id: g.id,
        judul: g.judul,
        level: g.level as SimpulGoal["level"],
        pemilik: g.pemilik,
        jabatan: users.find((u) => u.nama === g.pemilik)?.jabatan ?? "",
        unit: g.unit
          ? (units.find((u) => u.kode === g.unit)?.nama.split(" (")[0] ?? null)
          : null,
        akun: g.account ?? null,
        pemilikId: users.find((u) => u.nama === g.pemilik)?.id ?? null,
        unitId: g.unit
          ? (units.find((u) => u.kode === g.unit)?.id ?? null)
          : null,
        akunId: g.account
          ? (accounts.find((a) => a.username === g.account)?.id ?? null)
          : null,
        ...periodeDari(g.bulan_list ?? [], g.periode),
        satuan: "IDR",
        targetBase: g.target_base,
        targetGoal: g.target_goal,
        targetStretch: g.target_stretch,
        targetBulan: g.target_bulan,
        realisasi,
        rasio: g.target_bulan
          ? Math.round((realisasi / g.target_bulan) * 1000) / 10
          : 0,
        parentId: g.parent ?? null,
        kode: null,
        tenggat: null,
        jenisRealisasi: "gmv" as const,
        keterangan: "",
        status: "aktif" as const,
        ukuran: null,
      };
    });

    return keTree(
      goalMilikStaf(pengguna, datar, (g) =>
        g.akun
          ? (users.find(
              (u) =>
                u.nama === accounts.find((a) => a.username === g.akun)?.pic,
            )?.id ?? null)
          : null,
      ),
    );
  }

  const sb = await klienServer();
  // Usulan (draft) hanya untuk yang berwenang mengesahkannya.
  const status: ("aktif" | "draft")[] = bolehKelolaGoal(pengguna)
    ? ["aktif", "draft"]
    : ["aktif"];
  // Hanya GRD periode yang berlaku (0221): goal GRD bulan lalu tetap aktif
  // supaya angkanya utuh, tetapi tidak ikut tampil di bulan berikutnya.
  const periode = await periodeGrdBerlaku(tanggal);
  let kueri = sb
    .from("goals")
    .select(
      `id, judul, level, periode, satuan, target_base, target_goal,
       target_stretch, parent_goal_id, unit_id, account_id, pemilik_id,
       kode, tenggat, jenis_realisasi, keterangan, status, grd_periode,
       pemilik:pemilik_id (nama, jabatan),
       units:unit_id (nama),
       accounts:account_id (username, pic_user_id),
       goal_months (bulan, target, dari, sampai)`,
    )
    .in("status", status);
  if (periode !== undefined) kueri = kueri.or(saringPeriodeGrd(periode));
  const { data, error } = await kueri;

  if (error) throw new Error(`Gagal memuat goal: ${error.message}`);

  // Ukuran tiap goal GRD beserta hak mencatat capaiannya, tanpa menghitung
  // kurva (`kurva_grd` menghitung AKTUAL setiap titik — terlalu berat di
  // sini, dan hasilnya tidak dipakai).
  const ukuranGoal = new Map<
    string,
    { id: string; sumber: "gmv" | "isian"; bolehIsi: boolean }
  >();
  if (periode) {
    const { data: ukuran, error: galatUkuran } = await sb.rpc(
      "ukuran_goal_grd",
      { p_periode: periode },
    );
    if (galatUkuran) {
      console.error(`Gagal memuat ukuran GRD: ${galatUkuran.message}`);
    }
    for (const u of ukuran ?? []) {
      ukuranGoal.set(u.goal_id, {
        id: u.ukuran_id,
        sumber: u.sumber,
        bolehIsi: u.boleh_isi,
      });
    }
  }

  // Realisasi tiap goal dihitung database lewat `progres_goal` (0066):
  // satu aturan, satu tempat, dan goal unit ikut menghitung akun-akunnya.
  const { data: progres, error: galatProgres } = await sb.rpc("progres_goal", {
    p_bulan: awalBulan,
    p_sampai: tanggal,
  });
  // Capaian kosong lebih baik daripada halaman gagal, tetapi jangan diam:
  // tanpa catatan ini angka nol tidak bisa dilacak sebabnya.
  if (galatProgres) {
    console.error(`Gagal menghitung capaian goal: ${galatProgres.message}`);
  }

  const perGoal = new Map(
    (progres ?? []).map((p) => [
      p.goal_id,
      {
        target: Number(p.target_bulan),
        realisasi: Number(p.realisasi),
        rasio: Number(p.rasio),
      },
    ]),
  );

  const picAkun = new Map(
    (data ?? []).map((g) => [
      g.id,
      (g.accounts as unknown as { pic_user_id: string | null } | null)
        ?.pic_user_id ?? null,
    ]),
  );

  const datar = (data ?? []).map((g) => {
    const pemilik = g.pemilik as unknown as {
      nama: string;
      jabatan: string;
    } | null;
    const capaian = perGoal.get(g.id);
    const targetBulan = capaian?.target ?? 0;
    const realisasi = capaian?.realisasi ?? 0;

    return {
      id: g.id,
      judul: g.judul,
      level: g.level as SimpulGoal["level"],
      pemilik: pemilik?.nama ?? "—",
      jabatan: pemilik?.jabatan ?? "",
      unit:
        (g.units as unknown as { nama: string } | null)?.nama.split(" (")[0] ??
        null,
      akun:
        (g.accounts as unknown as { username: string } | null)?.username ??
        null,
      pemilikId: g.pemilik_id,
      unitId: g.unit_id,
      akunId: g.account_id,
      ...periodeDari((g.goal_months ?? []) as AnakTanggaLonggar[], g.periode),
      satuan: g.satuan,
      targetBase: g.target_base === null ? null : Number(g.target_base),
      targetGoal: Number(g.target_goal),
      targetStretch: Number(g.target_stretch),
      targetBulan,
      realisasi,
      rasio: capaian?.rasio ?? 0,
      parentId: g.parent_goal_id,
      kode: g.kode,
      tenggat: g.tenggat,
      jenisRealisasi: g.jenis_realisasi,
      keterangan: g.keterangan,
      status: g.status === "draft" ? ("draft" as const) : ("aktif" as const),
      ukuran: ukuranGoal.get(g.id) ?? null,
    };
  });

  return keTree(
    goalMilikStaf(pengguna, datar, (g) => picAkun.get(g.id) ?? null),
  );
}

export type AnakTanggaBulan = {
  bulan: string;
  /** Rentang tanggal periode di bulan ini (0178). */
  dari: string;
  sampai: string;
  target: number;
  realisasi: number;
  rasio: number;
  /** Tanggal acuan berada di dalam rentang anak tangga ini. */
  berjalan: boolean;
  /** Rentangnya belum dimulai pada tanggal acuan. */
  mendatang: boolean;
};

/** Anak tangga beserta capaiannya dari GMV dalam rentangnya. */
function capaianLangkah(
  b: AnakTanggaGoal,
  tanggal: string,
  realisasi: number,
): AnakTanggaBulan {
  return {
    ...b,
    realisasi,
    rasio: b.target ? Math.round((realisasi / b.target) * 1000) / 10 : 0,
    berjalan: tanggal >= b.dari && tanggal <= b.sampai,
    mendatang: tanggal < b.dari,
  };
}

/**
 * Anak tangga bulanan sebuah goal: target tiap bulan beserta capaiannya.
 * Realisasi dihitung di dalam rentang tanggal tiap anak tangga — penuh
 * untuk yang sudah lewat, sampai tanggal acuan untuk yang berjalan —
 * dan anak tangga yang belum dimulai belum punya realisasi.
 */
export async function anakTanggaBulanan(
  goalId: string,
  tanggal: string,
): Promise<AnakTanggaBulan[]> {
  /** Akhir hitungan sebuah anak tangga: akhir rentang, atau hari ini. */
  const sampaiHitung = (b: AnakTanggaGoal) =>
    b.sampai < tanggal ? b.sampai : tanggal;

  if (modeData() === "demo") {
    const { goals, daily_reports, accounts } = dataContoh;
    const g = goals.find((x) => x.id === goalId);
    if (!g) return [];

    const akunUnit = Object.fromEntries(
      accounts.map((a) => [a.username, a.unit]),
    );
    const cocok = (l: (typeof daily_reports)[number]) => {
      if (g.account) return l.akun === g.account;
      if (g.unit) return (l.unit ?? akunUnit[l.akun as string]) === g.unit;
      return true;
    };

    return (g.bulan_list ?? []).map(lengkapiRentang).map((b) => {
      const realisasi =
        tanggal < b.dari
          ? 0
          : daily_reports
              .filter(cocok)
              .filter(
                (l) => l.tanggal >= b.dari && l.tanggal <= sampaiHitung(b),
              )
              .reduce((a, l) => a + l.gmv, 0);
      return capaianLangkah(b, tanggal, realisasi);
    });
  }

  const sb = await klienServer();
  const { data: bulan } = await sb
    .from("goal_months")
    .select("bulan, target, dari, sampai")
    .eq("goal_id", goalId)
    .order("bulan");

  // Aturan yang sama dengan pohon goal (`realisasi_goal_rentang`, 0221):
  // goal GRD dihitung lewat ukurannya — goal perusahaan November = GMV MCN
  // + akun internal yang belum masuk MCN, tanpa hitung dobel — dan goal
  // lain lewat lingkup akun/unitnya (`gmv_goal_rentang`, 0178).
  const tangga = ((bulan ?? []) as AnakTanggaLonggar[]).map(lengkapiRentang);
  return Promise.all(
    tangga.map(async (b) => {
      if (tanggal < b.dari) return capaianLangkah(b, tanggal, 0);
      const { data: realisasi, error } = await sb.rpc(
        "realisasi_goal_rentang",
        { p_goal: goalId, p_dari: b.dari, p_sampai: sampaiHitung(b) },
      );
      if (error) {
        console.error(`Gagal menghitung anak tangga goal: ${error.message}`);
      }
      return capaianLangkah(b, tanggal, Number(realisasi ?? 0));
    }),
  );
}

export type PilihanGoal = {
  orang: { id: string; nama: string; jabatan: string }[];
  induk: {
    id: string;
    judul: string;
    level: LevelGoal;
    unitId: string | null;
  }[];
  unit: { id: string; kode: string; nama: string }[];
  akun: { id: string; username: string; unitId: string }[];
};

/**
 * Bahan isian dialog goal baru: calon pemilik, calon induk, unit, dan akun.
 * Hanya dipanggil untuk CEO/Manager — merekalah yang boleh membuat goal.
 */
export async function pilihanGoal(): Promise<PilihanGoal> {
  if (modeData() === "demo") {
    const { users, units, accounts, goals } = dataContoh;
    const idUnit = Object.fromEntries(units.map((u) => [u.kode, u.id]));
    return {
      orang: users
        .filter((u) => u.nama && aktifDemo(u))
        .map((u) => ({ id: u.id, nama: u.nama, jabatan: u.jabatan })),
      induk: goals.map((g) => ({
        id: g.id,
        judul: g.judul,
        level: g.level as LevelGoal,
        unitId: g.unit ? (idUnit[g.unit] ?? null) : null,
      })),
      unit: units.map((u) => ({ id: u.id, kode: u.kode, nama: u.nama })),
      akun: accounts.map((a) => ({
        id: a.id,
        username: a.username,
        unitId: idUnit[a.unit] ?? "",
      })),
    };
  }

  const sb = await klienServer();
  // Calon induk: goal di luar GRD dan GRD periode yang berlaku saja.
  const periode = await periodeGrdBerlaku(hariIniWib());
  let kueriInduk = sb
    .from("goals")
    .select(
      "id, judul, level, unit_id, account_id, accounts:account_id (unit_id)",
    )
    .eq("status", "aktif");
  if (periode !== undefined) {
    kueriInduk = kueriInduk.or(saringPeriodeGrd(periode));
  }
  const [orang, induk, unit, akun] = await Promise.all([
    sb
      .from("users")
      .select("id, nama, jabatan")
      .eq("status", "aktif")
      .order("nama"),
    kueriInduk.order("judul"),
    sb.from("units").select("id, kode, nama").order("kode"),
    sb
      .from("accounts")
      .select("id, username, unit_id")
      .eq("status", "aktif")
      .order("username"),
  ]);

  return {
    orang: (orang.data ?? []).map((o) => ({
      id: o.id,
      nama: o.nama,
      jabatan: o.jabatan,
    })),
    induk: (induk.data ?? []).map((g) => ({
      id: g.id,
      judul: g.judul,
      level: g.level as LevelGoal,
      unitId:
        g.unit_id ??
        (g.accounts as unknown as { unit_id: string } | null)?.unit_id ??
        null,
    })),
    unit: (unit.data ?? []).map((u) => ({
      id: u.id,
      kode: u.kode,
      nama: u.nama,
    })),
    akun: (akun.data ?? []).map((a) => ({
      id: a.id,
      username: a.username,
      unitId: a.unit_id,
    })),
  };
}
