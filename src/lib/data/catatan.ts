// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import {
  urutkanCatatan,
  type Catatan,
  type KategoriCatatan,
  type VisibilitasCatatan,
} from "@/lib/catatan";
import type { KodeUnit, Pengguna } from "@/lib/types";

function satu<T>(nilai: T | T[] | null | undefined): T | null {
  if (!nilai) return null;
  return Array.isArray(nilai) ? (nilai[0] ?? null) : nilai;
}

const KOLOM_CATATAN = `id, judul, isi, kategori, visibilitas, disematkan, lampiran,
  created_at, updated_at,
  unit:units (kode, nama),
  pemilik:users!notes_dibuat_oleh_fkey (id, nama)`;

/**
 * Catatan yang terlihat pengguna: miliknya sendiri, yang dibagikan ke
 * unitnya, dan yang dibagikan ke seluruh perusahaan (RLS `notes_baca`).
 */
export async function daftarCatatan(pengguna: Pengguna): Promise<Catatan[]> {
  if (modeData() === "demo") return catatanDemo(pengguna);

  const sb = await klienServer();
  const { data, error } = await sb
    .from("notes")
    .select(KOLOM_CATATAN)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Gagal memuat catatan: ${error.message}`);

  return urutkanCatatan(
    (data ?? []).map((c) => {
      const unit = satu(c.unit);
      const pemilik = satu(c.pemilik);
      return {
        id: c.id,
        judul: c.judul,
        isi: c.isi,
        kategori: c.kategori as KategoriCatatan,
        visibilitas: c.visibilitas as VisibilitasCatatan,
        unitKode: (unit?.kode as KodeUnit) ?? null,
        unitNama: unit?.nama ? unit.nama.split(" (")[0] : null,
        disematkan: c.disematkan,
        lampiran: c.lampiran ?? [],
        pemilikId: pemilik?.id ?? "",
        pemilikNama: pemilik?.nama ?? "Tidak diketahui",
        dibuatPada: c.created_at,
        diperbaruiPada: c.updated_at,
      };
    }),
    pengguna.id,
  );
}

export async function catatanDariId(
  pengguna: Pengguna,
  id: string,
): Promise<Catatan | null> {
  const semua = await daftarCatatan(pengguna);
  return semua.find((c) => c.id === id) ?? null;
}

// ---------------------------------------------------------------------
// Mode demo — cakupan baca menirukan policy `notes_baca`.
// ---------------------------------------------------------------------
function catatanDemo(pengguna: Pengguna): Catatan[] {
  const { notes, units, users } = dataContoh;
  const pengelola = pengguna.role === "CEO" || pengguna.role === "Manager";

  return urutkanCatatan(
    notes
      .map((n, i) => {
        const unit = n.unit ? units.find((u) => u.kode === n.unit) : null;
        const pemilik = users.find((u) => u.nama === n.dibuat_oleh);
        return {
          id: `catatan-${i + 1}`,
          judul: n.judul,
          isi: n.isi,
          kategori: n.kategori as KategoriCatatan,
          visibilitas: n.visibilitas as VisibilitasCatatan,
          unitKode: (n.unit as KodeUnit | null) ?? null,
          unitNama: unit?.nama ? unit.nama.split(" (")[0] : null,
          disematkan: n.disematkan,
          lampiran: n.lampiran,
          pemilikId: pemilik?.id ?? "",
          pemilikNama: n.dibuat_oleh,
          dibuatPada: `${dataContoh.tanggalAcuan}T09:00:00+07:00`,
          diperbaruiPada: `${dataContoh.tanggalAcuan}T09:00:00+07:00`,
        } satisfies Catatan;
      })
      .filter(
        (c) =>
          c.pemilikId === pengguna.id ||
          c.visibilitas === "perusahaan" ||
          (c.visibilitas === "unit" &&
            (pengelola || c.unitKode === pengguna.unitId)),
      ),
    pengguna.id,
  );
}
