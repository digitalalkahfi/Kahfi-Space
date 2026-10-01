// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { rencanaGrd } from "@/lib/data/rencana";
import type { StatusTonggak, Tonggak } from "@/lib/rencana";
import type { BarisTabelGrd, BlokSel, TabelGrd } from "@/lib/tabel-grd";
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

const blok = (
  id: string | null,
  kode: string | null,
  teks: string | null,
  label: string | null,
): BlokSel | null =>
  id ? { id, kode: kode ?? "", teks: teks ?? "", label: label ?? "" } : null;

/**
 * Tabel GRD Cascade satu periode — `tabel_grd` (0197): goal dan rencana
 * operasional yang sama dengan tampilan hierarki, disusun seperti sheet.
 *
 * Mode demo belum punya susunan sheet; kolomnya disusun dari goal contoh
 * (perusahaan → operasional → goal yang dilayani tiap rencana).
 */
export async function tabelGrd(
  pengguna: Pengguna,
  periode: string,
): Promise<TabelGrd> {
  if (modeData() === "demo") {
    const rencana = await rencanaGrd(pengguna, periode);
    const goals = dataContoh.goals;
    const perusahaan = goals.find((g) => g.level === "company");
    const manager = goals.find((g) => g.level === "manager");
    const sel = (kode: string, teks: string | undefined) =>
      teks ? { id: `demo-${kode}-${teks}`, kode, teks, label: "" } : null;
    return {
      judul: "",
      catatan: "",
      baris: rencana.map((r): BarisTabelGrd => ({
        rencanaId: r.id,
        kode: r.kode,
        judul: r.judul,
        jenis: r.jenis,
        picTeks: r.picTeks,
        jadwalTeks: r.jadwalTeks,
        tonggak: r.tonggak,
        blok: {
          perusahaan: sel("1", perusahaan?.judul),
          manager: sel("1.1", manager?.judul),
          leader: r.goalJudul
            ? sel(r.indukKode, r.goalJudul)
            : sel(
                r.indukKode,
                r.indukKode === "M" ? "Tonggak Manager" : r.indukKode,
              ),
        },
      })),
    };
  }

  const sb = await klienServer();
  const [{ data, error }, { data: kepala }] = await Promise.all([
    sb.rpc("tabel_grd", { p_periode: periode }),
    sb
      .from("grd_cascade_blok")
      .select("kolom, teks, urutan")
      .eq("grd_periode", periode)
      .in("kolom", ["judul", "catatan"])
      .order("urutan"),
  ]);
  if (error) throw new Error(`Gagal memuat Tabel GRD: ${error.message}`);

  return {
    judul: kepala?.find((k) => k.kolom === "judul")?.teks ?? "",
    catatan: kepala?.find((k) => k.kolom === "catatan")?.teks ?? "",
    baris: (data ?? []).map((r) => ({
      rencanaId: r.rencana_id,
      kode: r.kode,
      judul: r.judul,
      jenis: r.jenis,
      picTeks: r.pic_teks,
      jadwalTeks: r.jadwal_teks,
      tonggak: ((r.tonggak as TonggakDb[] | null) ?? []).map(keTonggak),
      blok: {
        perusahaan: blok(r.p_id, r.p_kode, r.p_teks, r.p_label),
        manager: blok(r.m_id, r.m_kode, r.m_teks, r.m_label),
        leader: blok(r.l_id, r.l_kode, r.l_teks, r.l_label),
      },
    })),
  };
}
