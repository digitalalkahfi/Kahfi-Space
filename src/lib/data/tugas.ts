// Modul khusus server. Impor dari komponen klien akan gagal saat build,
// bukan diam-diam bocor ke browser.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { TANGGAL_ACUAN, dataContoh } from "@/lib/data/contoh";
import { hariIniWib, keTanggalWib } from "@/lib/format";
import { masukKalender } from "@/lib/kalender";
import {
  BATAS_DAFTAR,
  BATAS_PAPAN,
  BATAS_SELESAI_SEMUA,
  awalSelesaiSemua,
  masukPapan,
  masukPapanSemua,
  masukToDoHariIni,
  rentangHariWib,
  rentangTanggalWib,
  ringkasToDoTanggal,
} from "@/lib/papan-tanggal";
import type { BarisTugasTersaring } from "@/lib/supabase/types";
import type {
  Prioritas,
  StatusTugas,
  ToDo,
  Tugas,
  Pengguna,
} from "@/lib/types";

/**
 * "Hari ini" modul Tugas: tanggal WIB, atau tanggal acuan data contoh di
 * mode demo — supaya papan dan validasi tanggal memakai hari yang sama
 * dengan datanya.
 */
export function hariIniTugas(): string {
  return modeData() === "demo" ? TANGGAL_ACUAN : hariIniWib();
}

/**
 * "Sekarang" modul Tugas, untuk menandai deadline yang jamnya sudah
 * lewat. Dihitung sekali di server dan dikirim ke layar, supaya HTML
 * server dan peramban sepakat. Mode demo memakai siang hari tanggal
 * acuannya — kalau jam dinding, semua data contoh terbaca terlambat.
 */
export function sekarangTugas(): string {
  return modeData() === "demo"
    ? new Date(`${TANGGAL_ACUAN}T12:00:00+07:00`).toISOString()
    : new Date().toISOString();
}

const KOLOM = `
  id, tipe, judul, deskripsi, konteks, kriteria_selesai, target_angka,
  target_satuan, tenggat, tanpa_jam, prioritas, status, qc_status, qc_note,
  hasil_kerja, penerima_id, pembuat_id, goal_id, tonggak_id, selesai_at,
  penerima:penerima_id (nama),
  pembuat:pembuat_id (nama),
  goal:goal_id (judul, periode)
`;

type BarisTugas = {
  id: string;
  penerima_id?: string;
  pembuat_id?: string;
  goal_id?: string | null;
  tonggak_id?: string | null;
  qc_note?: string;
  hasil_kerja?: string;
  selesai_at?: string | null;
  tipe: "pribadi" | "tiket" | "komitmen_mingguan";
  judul: string;
  deskripsi: string;
  konteks: string;
  kriteria_selesai?: string;
  target_angka?: number | string | null;
  target_satuan?: string;
  tenggat: string | null;
  tanpa_jam?: boolean;
  prioritas: Prioritas;
  status: StatusTugas | "revisi" | "dibatalkan";
  qc_status: "belum" | "lolos" | "revisi";
  penerima: { nama: string } | null;
  pembuat: { nama: string } | null;
  goal: { judul: string; periode: string } | null;
};

/** Nama pendek: "Rian Hidayat" → "Rian H." */
function namaPendek(nama: string) {
  const bagian = nama.trim().split(/\s+/);
  return bagian.length > 1 ? `${bagian[0]} ${bagian[1][0]}.` : bagian[0];
}

function keStatus(s: BarisTugas["status"]): StatusTugas {
  if (s === "revisi") return "berjalan";
  if (s === "dibatalkan") return "todo";
  return s;
}

function keTugas(b: BarisTugas): Tugas {
  return {
    id: b.id,
    tipe: b.tipe,
    judul: b.judul,
    deskripsi: b.deskripsi,
    penerima: namaPendek(b.penerima?.nama ?? "—"),
    penerimaLengkap: b.penerima?.nama ?? "—",
    pembuat: namaPendek(b.pembuat?.nama ?? "—"),
    penerimaId: b.penerima_id ?? "",
    pembuatId: b.pembuat_id ?? "",
    tenggat: b.tenggat ?? "",
    tanpaJam: b.tanpa_jam ?? false,
    kriteriaSelesai: b.kriteria_selesai ?? "",
    // `numeric` bisa tiba sebagai teks dari PostgREST; dibaca sebagai angka.
    targetAngka:
      b.target_angka === null || b.target_angka === undefined
        ? null
        : Number(b.target_angka),
    targetSatuan: b.target_satuan ?? "",
    prioritas: b.prioritas,
    status: keStatus(b.status),
    statusAsli: b.status,
    qcStatus: b.qc_status,
    qcNote: b.qc_note ?? "",
    hasilKerja: b.hasil_kerja ?? "",
    konteks: b.konteks ?? "",
    goalId: b.goal_id ?? null,
    goalJudul: b.goal?.judul ?? null,
    goalPeriode: b.goal?.periode ?? null,
    selesaiPada: b.selesai_at ?? null,
    tonggakId: b.tonggak_id ?? null,
    label:
      b.konteks ||
      (b.tipe === "tiket"
        ? "Tiket"
        : b.tipe === "pribadi"
          ? "To-do"
          : "Komitmen"),
  };
}

function keToDo(b: BarisTugas): ToDo {
  return {
    id: b.id,
    judul: b.judul,
    // To-do baru mencatat keterangannya di deskripsi (boleh berparagraf);
    // Beranda cukup baris pertamanya.
    konteks: b.konteks || (b.deskripsi ?? "").split("\n")[0].trim(),
    jam: b.tenggat,
    tanggal: b.tenggat ? keTanggalWib(b.tenggat) : "",
    tanpaJam: b.tanpa_jam ?? false,
    prioritas: b.prioritas,
    selesai: b.status === "selesai",
    selesaiPada: b.selesai_at ?? null,
  };
}

// ---------------------------------------------------------------------
// Mode demo
// ---------------------------------------------------------------------
function tugasContoh(pengguna: Pengguna): BarisTugas[] {
  // Data contoh menyebut orang dengan namanya; id-nya diambil dari daftar
  // anggota contoh supaya kepemilikan dibandingkan lewat id, sama dengan
  // mode Supabase.
  const idDari = new Map(dataContoh.users.map((u) => [u.nama, u.id]));
  const lintas = pengguna.role === "CEO" || pengguna.role === "Manager";
  return dataContoh.tasks
    .filter((t) => {
      if (
        idDari.get(t.penerima) === pengguna.id ||
        idDari.get(t.pembuat) === pengguna.id
      ) {
        return true;
      }
      // To-do pribadi tidak pernah terlihat orang lain, sama dengan
      // `papan_tugas`/`daftar_tugas` (0182).
      return lintas && t.tipe !== "pribadi";
    })
    .map((t, i) => ({
      id: `contoh-${i}`,
      penerima_id: idDari.get(t.penerima),
      pembuat_id: idDari.get(t.pembuat),
      qc_note: "",
      hasil_kerja: "",
      // Data contoh tidak mencatat kapan tugasnya beres; dianggap beres
      // pada tenggatnya, supaya kolom Selesai tiap tanggal berisi yang
      // memang jatuh di tanggal itu.
      selesai_at:
        t.status === "selesai"
          ? (t.tenggat ?? `${dataContoh.tanggalAcuan}T16:40:00+07:00`)
          : null,
      tipe: t.tipe as BarisTugas["tipe"],
      judul: t.judul,
      deskripsi: t.deskripsi,
      konteks: t.konteks,
      tenggat: t.tenggat ?? null,
      tanpa_jam: "tanpa_jam" in t && t.tanpa_jam === true,
      kriteria_selesai:
        "kriteria_selesai" in t ? String(t.kriteria_selesai ?? "") : "",
      target_angka:
        "target_angka" in t && typeof t.target_angka === "number"
          ? t.target_angka
          : null,
      target_satuan: "target_satuan" in t ? String(t.target_satuan ?? "") : "",
      prioritas: t.prioritas as Prioritas,
      status: t.status as BarisTugas["status"],
      qc_status: t.qc as BarisTugas["qc_status"],
      penerima: { nama: t.penerima },
      pembuat: { nama: t.pembuat },
      goal_id: t.goal_unit
        ? (dataContoh.goals.find(
            (g) => g.unit === t.goal_unit && g.level === "leader",
          )?.id ?? null)
        : null,
      goal: t.goal_unit
        ? {
            judul:
              dataContoh.goals.find(
                (g) => g.unit === t.goal_unit && g.level === "leader",
              )?.judul ?? "Goal unit",
            periode: "2024-Q4",
          }
        : null,
    }));
}

/** Tugas hasil saringan basis data, lengkap dengan tanda batasnya. */
export type TugasTersaring = {
  tugas: Tugas[];
  /** Jumlah yang cocok sebelum dibatasi. */
  total: number;
  /** Batas tercapai — layar wajib mengatakannya, bukan memotong diam-diam. */
  terpotong: boolean;
};

/** Baris `papan_tugas`/`daftar_tugas` (0182) ke bentuk yang dikenal `keTugas`. */
function dariTersaring(r: BarisTugasTersaring): BarisTugas {
  return {
    id: r.id,
    penerima_id: r.penerima_id,
    pembuat_id: r.pembuat_id,
    goal_id: r.goal_id,
    tonggak_id: r.tonggak_id,
    qc_note: r.qc_note,
    hasil_kerja: r.hasil_kerja,
    selesai_at: r.selesai_at,
    tipe: r.tipe,
    judul: r.judul,
    deskripsi: r.deskripsi,
    konteks: r.konteks,
    kriteria_selesai: r.kriteria_selesai,
    target_angka: r.target_angka,
    target_satuan: r.target_satuan,
    tenggat: r.tenggat,
    tanpa_jam: r.tanpa_jam,
    prioritas: r.prioritas,
    status: r.status,
    qc_status: r.qc_status,
    penerima: r.penerima ? { nama: r.penerima } : null,
    pembuat: r.pembuat ? { nama: r.pembuat } : null,
    goal: r.goal_judul
      ? { judul: r.goal_judul, periode: r.goal_periode ?? "" }
      : null,
  };
}

function keTersaring(baris: BarisTugasTersaring[]): TugasTersaring {
  const total = Number(baris[0]?.total ?? 0);
  return {
    tugas: baris.map((r) => keTugas(dariTersaring(r))),
    total,
    terpotong: total > baris.length,
  };
}

/** Mode demo: pembatasan yang sama dengan fungsi basis datanya. */
function batasiContoh(cocok: Tugas[], batas: number): TugasTersaring {
  return {
    tugas: cocok.slice(0, batas),
    total: cocok.length,
    terpotong: cocok.length > batas,
  };
}

/**
 * Isi papan Kanban satu tanggal (D4).
 *
 * Disaring di basis data (`papan_tugas`, 0182) — bukan menarik semua
 * baris ke server lalu memilihnya — dan tetap tunduk RLS.
 */
export async function ambilPapanTugas(
  pengguna: Pengguna,
  tanggal: string,
  hariIni: string,
): Promise<TugasTersaring> {
  if (modeData() === "demo") {
    const cocok = tugasContoh(pengguna)
      .map(keTugas)
      .filter((t) => masukPapan(t, tanggal, hariIni));
    return batasiContoh(cocok, BATAS_PAPAN);
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("papan_tugas", {
    p_tanggal: tanggal,
    p_hari_ini: hariIni,
    p_batas: BATAS_PAPAN,
  });

  if (error) throw new Error(`Gagal memuat papan tugas: ${error.message}`);
  return keTersaring(data ?? []);
}

/**
 * Papan "Semua" — tampilan bawaan halaman Tugas: semua yang belum selesai
 * dari tanggal mana pun (sama dengan tampilan Daftar, `daftar_tugas`),
 * ditambah yang beres dalam 7 hari terakhir untuk kolom Selesai.
 *
 * Deadline adalah batas selesai, bukan hari mengerjakan: tiket bertenggat
 * pekan depan sudah harus terlihat sejak hari ini. Keduanya disaring di
 * basis data dan tunduk RLS; to-do pribadi hanya milik sendiri.
 */
export async function ambilPapanSemua(
  pengguna: Pengguna,
  hariIni: string,
): Promise<TugasTersaring> {
  if (modeData() === "demo") {
    const cocok = tugasContoh(pengguna)
      .map(keTugas)
      .filter((t) => masukPapanSemua(t, hariIni));
    return batasiContoh(cocok, BATAS_PAPAN + BATAS_SELESAI_SEMUA);
  }

  const sb = await klienServer();
  const [belum, selesai] = await Promise.all([
    sb.rpc("daftar_tugas", {
      p_acuan: hariIni,
      p_saringan: "semua",
      p_batas: BATAS_PAPAN,
    }),
    sb
      .from("tasks")
      .select(KOLOM)
      .eq("status", "selesai")
      .or(`tipe.neq.pribadi,penerima_id.eq.${pengguna.id}`)
      .gte("selesai_at", rentangHariWib(awalSelesaiSemua(hariIni)).awal)
      .order("selesai_at", { ascending: false })
      .limit(BATAS_SELESAI_SEMUA),
  ]);

  if (belum.error) {
    throw new Error(`Gagal memuat papan tugas: ${belum.error.message}`);
  }
  if (selesai.error) {
    throw new Error(`Gagal memuat tugas selesai: ${selesai.error.message}`);
  }

  const aktif = keTersaring(belum.data ?? []);
  const beres = (selesai.data as unknown as BarisTugas[]).map(keTugas);
  return {
    tugas: [...aktif.tugas, ...beres],
    total: aktif.total + beres.length,
    terpotong: aktif.terpotong || beres.length >= BATAS_SELESAI_SEMUA,
  };
}

/**
 * Tampilan Daftar: semua yang BELUM selesai, dikelompokkan menurut
 * tenggat di layar. Tugas selesai tidak dimuat.
 */
export async function ambilDaftarTugas(
  pengguna: Pengguna,
  hariIni: string,
): Promise<TugasTersaring> {
  if (modeData() === "demo") {
    const cocok = tugasContoh(pengguna)
      .map(keTugas)
      .filter(
        (t) => t.statusAsli !== "selesai" && t.statusAsli !== "dibatalkan",
      );
    return batasiContoh(cocok, BATAS_DAFTAR);
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("daftar_tugas", {
    p_acuan: hariIni,
    p_saringan: "semua",
    p_batas: BATAS_DAFTAR,
  });

  if (error) throw new Error(`Gagal memuat daftar tugas: ${error.message}`);
  return keTersaring(data ?? []);
}

const KOLOM_TODO =
  "id, judul, deskripsi, konteks, tenggat, tanpa_jam, prioritas, status, selesai_at";

/**
 * "To-do hari ini" di Beranda: to-do milik pengguna (dibandingkan lewat
 * id, bukan nama) yang bertenggat hari ini WIB, ditambah yang terlambat
 * dan belum selesai.
 */
export async function ambilToDo(
  pengguna: Pengguna,
  hariIni: string,
): Promise<ToDo[]> {
  const urut = (a: ToDo, b: ToDo) => (a.jam ?? "").localeCompare(b.jam ?? "");

  if (modeData() === "demo") {
    return tugasContoh(pengguna)
      .filter(
        (b) =>
          b.tipe === "pribadi" &&
          b.penerima_id === pengguna.id &&
          masukToDoHariIni(
            { status: b.status, tenggat: b.tenggat ?? "" },
            hariIni,
          ),
      )
      .map(keToDo)
      .sort(urut);
  }

  const sb = await klienServer();
  const { awal, akhir } = rentangHariWib(hariIni);
  const milikSaya = () =>
    sb
      .from("tasks")
      .select(KOLOM_TODO)
      .eq("tipe", "pribadi")
      .eq("penerima_id", pengguna.id);

  // Dua saringan sederhana alih-alih satu `or` bersarang: rentang hari
  // ini (apa pun statusnya, kecuali batal), dan yang terlambat.
  const [hari, telat] = await Promise.all([
    milikSaya()
      .neq("status", "dibatalkan")
      .gte("tenggat", awal)
      .lt("tenggat", akhir)
      .order("tenggat")
      .limit(200),
    milikSaya()
      .not("status", "in", "(selesai,dibatalkan)")
      .lt("tenggat", awal)
      .order("tenggat")
      .limit(200),
  ]);

  const galat = hari.error ?? telat.error;
  if (galat) throw new Error(`Gagal memuat to-do: ${galat.message}`);

  return [...(telat.data ?? []), ...(hari.data ?? [])]
    .map((b) => keToDo(b as unknown as BarisTugas))
    .sort(urut);
}

/**
 * Tiket & komitmen yang perlu perhatian: belum selesai, diurutkan dari
 * yang paling mendesak. Disaring di basis data, jadi tidak ada yang
 * tersisih oleh batas baris.
 */
export async function ambilTugasMendesak(
  pengguna: Pengguna,
  batas = 4,
): Promise<Tugas[]> {
  const bobot: Record<Prioritas, number> = { tinggi: 0, sedang: 1, rendah: 2 };

  if (modeData() === "demo") {
    return tugasContoh(pengguna)
      .filter((b) => b.tipe !== "pribadi" && b.status !== "selesai")
      .sort((a, b) => {
        const p = bobot[a.prioritas] - bobot[b.prioritas];
        if (p !== 0) return p;
        return (a.tenggat ?? "9999").localeCompare(b.tenggat ?? "9999");
      })
      .slice(0, batas)
      .map(keTugas);
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("tasks")
    .select(KOLOM)
    .neq("tipe", "pribadi")
    .not("status", "in", "(selesai,dibatalkan)")
    // Urutan enum prioritas_tugas: rendah < sedang < tinggi.
    .order("prioritas", { ascending: false })
    .order("tenggat", { ascending: true, nullsFirst: false })
    .limit(batas);

  if (error) throw new Error(`Gagal memuat tugas: ${error.message}`);
  return (data as unknown as BarisTugas[]).map(keTugas);
}

/** Berapa baris tenggat ditarik sekali jalan; PostgREST memotong di 1000. */
const HALAMAN_TENGGAT = 1000;

/**
 * Tenggat yang belum tuntas pada tanggal WIB `dari`–`sampai` (inklusif),
 * untuk kalender.
 *
 * Disaring per rentang di basis data dan tunduk RLS — bukan 200 baris
 * pertama sepanjang masa yang dipilih belakangan, yang membuat tenggat di
 * luar potongan itu hilang tanpa tanda bagi CEO/Manager. Ditarik per
 * halaman dengan alasan yang sama. To-do pribadi hanya milik sendiri,
 * lewat id; lihat `masukKalender`, padanannya untuk mode demo.
 */
export async function ambilTenggatKalender(
  pengguna: Pengguna,
  dari: string,
  sampai: string,
): Promise<Tugas[]> {
  if (modeData() === "demo") {
    return tugasContoh(pengguna)
      .map(keTugas)
      .filter((t) => masukKalender(t, pengguna.id, dari, sampai));
  }

  const sb = await klienServer();
  const { awal, akhir } = rentangTanggalWib(dari, sampai);
  const baris: BarisTugas[] = [];

  for (let mulai = 0; ; mulai += HALAMAN_TENGGAT) {
    const { data, error } = await sb
      .from("tasks")
      .select(KOLOM)
      .not("status", "in", "(selesai,dibatalkan)")
      .or(`tipe.neq.pribadi,penerima_id.eq.${pengguna.id}`)
      .gte("tenggat", awal)
      .lt("tenggat", akhir)
      // Urutan yang unik, supaya halaman tidak saling tumpang-tindih.
      .order("tenggat")
      .order("id")
      .range(mulai, mulai + HALAMAN_TENGGAT - 1);

    if (error) throw new Error(`Gagal memuat tenggat tugas: ${error.message}`);
    baris.push(...(data as unknown as BarisTugas[]));
    if (data.length < HALAMAN_TENGGAT) break;
  }

  return baris.map(keTugas);
}

/**
 * Riwayat to-do pribadi yang sudah selesai, terbaru dulu.
 * Dipakai untuk menengok kembali apa saja yang sudah dibereskan.
 */
export async function riwayatToDo(
  pengguna: Pengguna,
  batas = 50,
): Promise<ToDo[]> {
  if (modeData() === "demo") {
    return tugasContoh(pengguna)
      .filter(
        (b) =>
          b.tipe === "pribadi" &&
          b.status === "selesai" &&
          b.penerima_id === pengguna.id,
      )
      .sort((a, b) => (b.selesai_at ?? "").localeCompare(a.selesai_at ?? ""))
      .slice(0, batas)
      .map(keToDo);
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("tasks")
    .select(KOLOM_TODO)
    .eq("tipe", "pribadi")
    .eq("penerima_id", pengguna.id)
    .eq("status", "selesai")
    .order("selesai_at", { ascending: false })
    .limit(batas);

  if (error) throw new Error(`Gagal memuat riwayat to-do: ${error.message}`);
  return (data as unknown as BarisTugas[]).map(keToDo);
}

/**
 * Beban seorang penerima pada satu tanggal (unsur A pada SMART): jumlah
 * tiket & komitmen yang belum selesai/dibatalkan dengan tenggat di tanggal
 * itu (WIB). To-do pribadinya TIDAK dihitung — itu catatan pribadinya.
 * Tunduk RLS: pemberi tiket hanya menghitung yang memang boleh dilihatnya.
 */
export async function bebanPenerima(
  pengguna: Pengguna,
  penerimaId: string,
  tanggal: string,
): Promise<number> {
  if (modeData() === "demo") {
    return tugasContoh(pengguna).filter(
      (b) =>
        b.penerima_id === penerimaId &&
        b.tipe !== "pribadi" &&
        b.status !== "selesai" &&
        b.status !== "dibatalkan" &&
        b.tenggat !== null &&
        keTanggalWib(b.tenggat) === tanggal,
    ).length;
  }

  const sb = await klienServer();
  const { awal, akhir } = rentangHariWib(tanggal);
  const { count, error } = await sb
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("penerima_id", penerimaId)
    .in("tipe", ["tiket", "komitmen_mingguan"])
    .not("status", "in", "(selesai,dibatalkan)")
    .gte("tenggat", awal)
    .lt("tenggat", akhir);

  if (error) throw new Error(`Gagal menghitung beban: ${error.message}`);
  return count ?? 0;
}

/**
 * "To-do kamu: x dari y beres" untuk satu tanggal: to-do milik pengguna
 * (lewat id) yang bertenggat tanggal itu.
 */
export async function ringkasToDo(pengguna: Pengguna, tanggal: string) {
  let hitung: { total: number; selesai: number };

  if (modeData() === "demo") {
    hitung = ringkasToDoTanggal(
      tugasContoh(pengguna)
        .map(keTugas)
        .filter((t) => t.penerimaId === pengguna.id),
      tanggal,
    );
  } else {
    const sb = await klienServer();
    const { awal, akhir } = rentangHariWib(tanggal);
    const { data, error } = await sb
      .from("tasks")
      .select("status")
      .eq("tipe", "pribadi")
      .eq("penerima_id", pengguna.id)
      .neq("status", "dibatalkan")
      .gte("tenggat", awal)
      .lt("tenggat", akhir);

    if (error) throw new Error(`Gagal meringkas to-do: ${error.message}`);
    const baris = data ?? [];
    hitung = {
      total: baris.length,
      selesai: baris.filter((b) => b.status === "selesai").length,
    };
  }

  const { total, selesai } = hitung;
  return {
    total,
    selesai,
    belum: total - selesai,
    rasio: total > 0 ? (selesai / total) * 100 : 0,
  };
}

export type JejakQc = {
  id: string;
  hasil: "lolos" | "revisi";
  catatan: string;
  hasilKerja: string;
  diperiksaOleh: string;
  createdAt: string;
};

/**
 * Riwayat pemeriksaan beberapa tugas sekaligus.
 *
 * Satu kueri untuk seluruh papan, bukan satu per kartu: papan tugas bisa
 * memuat puluhan kartu, dan riwayat QC-nya diminta bersamaan.
 */
export async function jejakQcBanyak(
  taskIds: string[],
): Promise<Record<string, JejakQc[]>> {
  if (modeData() === "demo" || taskIds.length === 0) return {};

  const sb = await klienServer();
  const { data } = await sb
    .from("task_qc_log")
    .select(
      "id, task_id, hasil, catatan, hasil_kerja, created_at, users:diperiksa_oleh (nama)",
    )
    .in("task_id", taskIds)
    .order("created_at");

  const peta: Record<string, JejakQc[]> = {};
  for (const r of data ?? []) {
    const baris: JejakQc = {
      id: r.id,
      hasil: r.hasil as "lolos" | "revisi",
      catatan: r.catatan,
      hasilKerja: r.hasil_kerja,
      diperiksaOleh:
        (r.users as unknown as { nama: string } | null)?.nama ?? "Pemeriksa",
      createdAt: r.created_at,
    };
    (peta[r.task_id] ??= []).push(baris);
  }
  return peta;
}

/**
 * Riwayat pemeriksaan sebuah tugas.
 * Menyimpan konteks tiap putaran revisi, bukan hanya catatan terakhir.
 */
export async function jejakQc(taskId: string): Promise<JejakQc[]> {
  if (modeData() === "demo") return [];

  const sb = await klienServer();
  const { data } = await sb
    .from("task_qc_log")
    .select(
      "id, hasil, catatan, hasil_kerja, created_at, users:diperiksa_oleh (nama)",
    )
    .eq("task_id", taskId)
    .order("created_at");

  return (data ?? []).map((r) => ({
    id: r.id,
    hasil: r.hasil as "lolos" | "revisi",
    catatan: r.catatan,
    hasilKerja: r.hasil_kerja,
    diperiksaOleh:
      (r.users as unknown as { nama: string } | null)?.nama ?? "Pemeriksa",
    createdAt: r.created_at,
  }));
}
