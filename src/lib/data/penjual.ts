// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import {
  urutkanPenjual,
  type Penjual,
  type StatusPenjual,
} from "@/lib/penjual";
import type { KodeUnit, Pengguna } from "@/lib/types";

function satu<T>(nilai: T | T[] | null | undefined): T | null {
  if (!nilai) return null;
  return Array.isArray(nilai) ? (nilai[0] ?? null) : nilai;
}

const KOLOM_PENJUAL = `id, nama_toko, nama_kontak, telepon, kategori, status, komisi_persen,
  catatan, dibuat_oleh, created_at, updated_at,
  unit:units (kode, nama),
  pic:users!sellers_pic_user_id_fkey (id, nama)`;

/** Mitra yang terlihat pengguna (RLS: unitnya sendiri; manajemen semua). */
export async function daftarPenjual(pengguna: Pengguna): Promise<Penjual[]> {
  if (modeData() === "demo") return penjualDemo(pengguna);

  const sb = await klienServer();
  const { data, error } = await sb
    .from("sellers")
    .select(KOLOM_PENJUAL)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Gagal memuat penjual: ${error.message}`);

  return urutkanPenjual(
    (data ?? []).map((p) => {
      const unit = satu(p.unit);
      const pic = satu(p.pic);
      return {
        id: p.id,
        namaToko: p.nama_toko,
        namaKontak: p.nama_kontak,
        telepon: p.telepon,
        kategori: p.kategori,
        status: p.status as StatusPenjual,
        komisiPersen: p.komisi_persen === null ? null : Number(p.komisi_persen),
        catatan: p.catatan,
        unitKode: (unit?.kode as KodeUnit) ?? "affiliator",
        unitNama: unit?.nama ? unit.nama.split(" (")[0] : "-",
        picId: pic?.id ?? null,
        picNama: pic?.nama ?? null,
        dibuatOlehId: p.dibuat_oleh,
        dibuatPada: p.created_at,
        diperbaruiPada: p.updated_at,
      };
    }),
  );
}

export async function penjualDariId(
  pengguna: Pengguna,
  id: string,
): Promise<Penjual | null> {
  const semua = await daftarPenjual(pengguna);
  return semua.find((p) => p.id === id) ?? null;
}

// ---------------------------------------------------------------------
// Mode demo — cakupan baca menirukan policy `sellers_baca`.
// ---------------------------------------------------------------------
function penjualDemo(pengguna: Pengguna): Penjual[] {
  const { sellers, units, users } = dataContoh;
  const idNama = (nama: string | null) =>
    nama ? (users.find((u) => u.nama === nama)?.id ?? null) : null;

  return urutkanPenjual(
    sellers
      .map((s, i) => {
        const unit = units.find((u) => u.kode === s.unit);
        return {
          id: `penjual-${i + 1}`,
          namaToko: s.nama_toko,
          namaKontak: s.nama_kontak,
          telepon: s.telepon,
          kategori: s.kategori,
          status: s.status as StatusPenjual,
          komisiPersen: s.komisi_persen,
          catatan: s.catatan,
          unitKode: s.unit as KodeUnit,
          unitNama: unit?.nama ? unit.nama.split(" (")[0] : "-",
          picId: idNama(s.pic),
          picNama: s.pic,
          dibuatOlehId: idNama(s.dibuat_oleh),
          dibuatPada: `${dataContoh.tanggalAcuan}T09:00:00+07:00`,
          diperbaruiPada: `${dataContoh.tanggalAcuan}T09:00:00+07:00`,
        } satisfies Penjual;
      })
      .filter((p) => {
        if (
          pengguna.role === "CEO" ||
          pengguna.role === "Manager" ||
          pengguna.role === "Finance"
        ) {
          return true;
        }
        return p.unitKode === pengguna.unitId;
      }),
  );
}
