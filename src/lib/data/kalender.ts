// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { ambilSemuaTugas } from "@/lib/data/tugas";
import { bentrok } from "@/lib/kalender";
import type { EntriKalender, JenisAgenda } from "@/lib/kalender";
import type { KodeUnit, Pengguna } from "@/lib/types";

/** Mengatur agenda: Manager/CEO untuk semua, Leader untuk unitnya. */
export function bolehKelolaAgenda(pengguna: Pengguna) {
  return (
    pengguna.role === "CEO" ||
    pengguna.role === "Manager" ||
    pengguna.role === "Leader" ||
    pengguna.role === "Co-Leader"
  );
}

function satu<T>(nilai: T | T[] | null | undefined): T | null {
  if (!nilai) return null;
  return Array.isArray(nilai) ? (nilai[0] ?? null) : nilai;
}

/**
 * Seluruh entri kalender pada satu bulan.
 *
 * Menggabungkan agenda yang diketik manual dengan tenggat tugas yang
 * sudah ada di modul Tugas. Menyalin tenggat ke tabel agenda akan
 * membuat dua sumber kebenaran yang cepat berbeda; menariknya saat
 * ditampilkan membuat kalender selalu ikut berubah saat tenggatnya
 * digeser.
 */
export async function entriKalender(
  pengguna: Pengguna,
  bulan: string,
): Promise<EntriKalender[]> {
  const akhir = new Date(`${bulan}T00:00:00Z`);
  akhir.setUTCMonth(akhir.getUTCMonth() + 1);
  akhir.setUTCDate(0);
  const sampai = akhir.toISOString().slice(0, 10);

  const [agenda, tugas] = await Promise.all([
    agendaBulan(pengguna, bulan, sampai),
    tenggatTugas(pengguna, bulan, sampai),
  ]);

  return [...agenda, ...tugas];
}

/**
 * Acara terdekat mulai hari ini, lintas bulan.
 *
 * Kalender hanya menolong kalau isinya terlihat tanpa harus dibuka —
 * rapat yang terlewat biasanya bukan karena tidak dicatat, melainkan
 * karena tidak pernah tampil di layar yang orang buka tiap pagi.
 *
 * Rentangnya dua bulan ke depan: cukup untuk menangkap acara di awal
 * bulan berikutnya, tanpa menarik seluruh kalender tahun ini.
 */
export async function agendaAkanDatang(
  pengguna: Pengguna,
  hariIni: string,
  batas = 4,
): Promise<EntriKalender[]> {
  const akhir = new Date(`${hariIni}T00:00:00Z`);
  akhir.setUTCMonth(akhir.getUTCMonth() + 2);
  const sampai = akhir.toISOString().slice(0, 10);

  const [agenda, tugas] = await Promise.all([
    agendaBulan(pengguna, hariIni, sampai),
    tenggatTugas(pengguna, hariIni, sampai),
  ]);

  return [...agenda, ...tugas]
    .sort(
      (a, b) =>
        a.tanggal.localeCompare(b.tanggal) ||
        (a.jamMulai ?? "").localeCompare(b.jamMulai ?? ""),
    )
    .slice(0, batas);
}

/**
 * Satu agenda beserta acara lain yang jamnya bertabrakan dengannya.
 *
 * Halaman detail berdiri sendiri supaya tautannya bisa dibagikan —
 * "lihat agendanya" di percakapan lebih menolong daripada menjelaskan
 * ulang tanggal dan jamnya.
 */
export async function agendaDariId(
  pengguna: Pengguna,
  id: string,
): Promise<{ entri: EntriKalender; bentrok: EntriKalender[] } | null> {
  if (modeData() === "demo") {
    // Id semu mode demo berbentuk "agenda-N"; bulannya tidak diketahui,
    // jadi dicari pada rentang data contoh.
    const semua = await agendaBulan(pengguna, "2000-01-01", "2100-12-31");
    const entri = semua.find((a) => a.id === id);
    if (!entri) return null;

    return {
      entri,
      bentrok: semua.filter((lain) => bentrok(entri, lain)),
    };
  }

  const sb = await klienServer();
  const { data } = await sb
    .from("agenda")
    .select("tanggal")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const sehari = await agendaBulan(pengguna, data.tanggal, data.tanggal);
  const entri = sehari.find((a) => a.id === id);
  if (!entri) return null;

  return {
    entri,
    bentrok: sehari.filter((lain) => bentrok(entri, lain)),
  };
}

async function agendaBulan(
  pengguna: Pengguna,
  dari: string,
  sampai: string,
): Promise<EntriKalender[]> {
  if (modeData() === "demo") {
    const { agenda, units } = dataContoh;
    void pengguna;

    return agenda
      .filter((a) => a.tanggal >= dari && a.tanggal <= sampai)
      .map((a, i) => {
        const unit = a.unit ? units.find((u) => u.kode === a.unit) : null;
        return {
          id: `agenda-${i + 1}`,
          sumber: "agenda" as const,
          judul: a.judul,
          keterangan: a.keterangan,
          jenis: a.jenis as JenisAgenda,
          tanggal: a.tanggal,
          jamMulai: a.jam_mulai,
          jamSelesai: a.jam_selesai,
          unitKode: (a.unit as KodeUnit) ?? null,
          unitNama: unit?.nama ? unit.nama.split(" (")[0] : "Semua unit",
          lokasi: a.lokasi,
          tautan: null,
          dibuatOleh: "Farhan Pratama",
        };
      });
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("agenda")
    .select(
      `id, judul, keterangan, jenis, tanggal, jam_mulai, jam_selesai, lokasi,
       unit:units (kode, nama),
       pembuat:users (nama)`,
    )
    .gte("tanggal", dari)
    .lte("tanggal", sampai)
    .order("tanggal");

  if (error) throw new Error(`Gagal memuat agenda: ${error.message}`);

  return (data ?? []).map((a) => {
    const unit = satu(a.unit);
    return {
      id: a.id,
      sumber: "agenda" as const,
      judul: a.judul,
      keterangan: a.keterangan,
      jenis: a.jenis as JenisAgenda,
      tanggal: a.tanggal,
      jamMulai: a.jam_mulai ? a.jam_mulai.slice(0, 5) : null,
      jamSelesai: a.jam_selesai ? a.jam_selesai.slice(0, 5) : null,
      unitKode: (unit?.kode as KodeUnit) ?? null,
      unitNama: unit?.nama ? unit.nama.split(" (")[0] : "Semua unit",
      lokasi: a.lokasi,
      tautan: null,
      dibuatOleh: satu(a.pembuat)?.nama ?? null,
    };
  });
}

/** Tenggat tugas ditarik dari modul Tugas, bukan disalin ke agenda. */
async function tenggatTugas(
  pengguna: Pengguna,
  dari: string,
  sampai: string,
): Promise<EntriKalender[]> {
  const tugas = await ambilSemuaTugas(pengguna);

  return tugas
    .filter((t) => {
      if (!t.tenggat) return false;
      const hari = t.tenggat.slice(0, 10);
      // Tugas yang sudah tuntas atau dibatalkan bukan lagi tenggat.
      return (
        hari >= dari &&
        hari <= sampai &&
        t.statusAsli !== "selesai" &&
        t.statusAsli !== "dibatalkan"
      );
    })
    .map((t) => ({
      id: `tugas-${t.id}`,
      sumber: "tugas" as const,
      judul: t.judul,
      keterangan: t.deskripsi,
      jenis: "tenggat" as const,
      tanggal: t.tenggat.slice(0, 10),
      jamMulai: t.tenggat.length > 10 ? t.tenggat.slice(11, 16) : null,
      jamSelesai: null,
      unitKode: null,
      unitNama: t.penerima ?? "",
      lokasi: "",
      tautan: "/tugas",
      dibuatOleh: null,
    }));
}
