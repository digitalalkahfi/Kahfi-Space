// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import type { Rencana, StatusTonggak, Tonggak } from "@/lib/rencana";
import type { Pengguna } from "@/lib/types";

type TonggakDb = {
  id: string;
  kunci: string;
  judul: string;
  tenggat: string | null;
  status: StatusTonggak;
  selesai_pada: string | null;
  catatan: string;
};

const keTonggak = (t: TonggakDb): Tonggak => ({
  id: t.id,
  kunci: t.kunci,
  judul: t.judul,
  tenggat: t.tenggat ? String(t.tenggat).slice(0, 10) : null,
  status: t.status,
  selesaiPada: t.selesai_pada,
  catatan: t.catatan ?? "",
});

/**
 * Rencana operasional GRD satu periode beserta tonggaknya — dari
 * `rencana_grd` (0192), termasuk apakah pengguna boleh mencentang.
 *
 * Mode demo memakai `grd_rencana` di data contoh; hak centangnya ditiru
 * sederhana: CEO/Manager, atau orang yang disebut di kolom SIAPA.
 */
export async function rencanaGrd(
  pengguna: Pengguna,
  periode: string,
): Promise<Rencana[]> {
  if (modeData() === "demo") {
    const lintas = pengguna.role === "CEO" || pengguna.role === "Manager";
    return dataContoh.grd_rencana
      .filter((r) => r.periode === periode)
      .map((r, n) => ({
        id: `demo-rencana-${n}`,
        kode: r.kode,
        goalKode: r.goal ? r.induk_kode : null,
        goalJudul: r.goal,
        indukKode: r.induk_kode,
        judul: r.judul,
        jenis: r.jenis as Rencana["jenis"],
        picTeks: r.pic_teks,
        picNama: r.pic,
        jadwalTeks: r.jadwal_teks,
        bolehCentang: lintas || r.pic.includes(pengguna.nama),
        tonggak: r.tonggak.map((t, i) =>
          keTonggak({
            id: `demo-tonggak-${n}-${i}`,
            kunci: t.kunci,
            judul: t.judul,
            tenggat: t.tenggat,
            status: t.status as StatusTonggak,
            selesai_pada: t.selesai_pada,
            catatan: "",
          }),
        ),
      }));
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("rencana_grd", { p_periode: periode });
  if (error) throw new Error(`Gagal memuat rencana GRD: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.rencana_id,
    kode: r.kode,
    goalKode: r.goal_kode,
    goalJudul: r.goal_judul,
    indukKode: r.induk_kode,
    judul: r.judul,
    jenis: r.jenis,
    picTeks: r.pic_teks,
    picNama: r.pic_nama ?? [],
    jadwalTeks: r.jadwal_teks,
    bolehCentang: r.boleh_centang,
    tonggak: ((r.tonggak as TonggakDb[] | null) ?? []).map(keTonggak),
  }));
}
