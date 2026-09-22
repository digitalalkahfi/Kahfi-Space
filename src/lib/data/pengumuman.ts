// Modul khusus server. Impor dari komponen klien akan gagal saat build,
// bukan diam-diam bocor ke browser.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { pengumumanContoh } from "@/lib/data/contoh";
import type { KodeUnit, Peran, Pengguna, Pengumuman } from "@/lib/types";

const KOLOM = `
  id, slug, judul, ringkasan, isi, target_role, target_unit_id, disematkan,
  published_at,
  pembuat:dibuat_oleh (nama, jabatan),
  unit:target_unit_id (nama)
`;

type BarisGabung = {
  slug: string;
  judul: string;
  ringkasan: string;
  isi: string[];
  target_role: Peran | null;
  disematkan: boolean;
  published_at: string | null;
  pembuat: { nama: string; jabatan: string } | null;
  unit: { nama: string } | null;
};

function keDomain(b: BarisGabung): Pengumuman {
  return {
    id: b.slug,
    judul: b.judul,
    ringkasan: b.ringkasan,
    isi: b.isi,
    targetPeran: b.target_role ?? "Semua",
    targetUnit: b.unit?.nama.split(" (")[0] ?? null,
    dibuatOleh: b.pembuat?.nama ?? "Manajemen",
    jabatanPembuat: b.pembuat?.jabatan ?? "",
    publishedAt: b.published_at ?? new Date().toISOString(),
    disematkan: b.disematkan,
  };
}

/** Yang tersemat lebih dulu, lalu yang terbaru. */
function urutkan(daftar: Pengumuman[]) {
  return [...daftar].sort((a, b) => {
    if (a.disematkan !== b.disematkan) return a.disematkan ? -1 : 1;
    return b.publishedAt.localeCompare(a.publishedAt);
  });
}

/**
 * Penyaringan yang sama dengan fungsi SQL `pengumuman_untuk_saya`.
 * Di mode supabase pekerjaan ini dilakukan RLS; ini padanannya untuk
 * mode demo supaya perilakunya identik.
 */
function untukPengguna(
  p: Pengumuman,
  pengguna: Pengguna,
  unitNama: string | null,
) {
  // Sama seperti policy `announcements_baca`: CEO & Manager melihat semuanya.
  if (pengguna.role === "CEO" || pengguna.role === "Manager") return true;

  const cocokPeran =
    p.targetPeran === "Semua" || p.targetPeran === pengguna.role;
  const cocokUnit = p.targetUnit === null || p.targetUnit === unitNama;
  return cocokPeran && cocokUnit;
}

const NAMA_UNIT: Record<KodeUnit, string> = {
  affiliator: "Affiliator Network",
  mcn: "MCN",
  tap: "TAP",
};

/** Pengumuman yang boleh dilihat pengguna ini. */
export async function ambilPengumuman(
  pengguna: Pengguna,
): Promise<Pengumuman[]> {
  if (modeData() === "demo") {
    const unitNama = pengguna.unitId
      ? NAMA_UNIT[pengguna.unitId].split(" (")[0]
      : null;
    return urutkan(
      pengumumanContoh()
        .filter((p) => p.publishedAt !== null)
        .filter((p) => untukPengguna(p, pengguna, unitNama)),
    );
  }

  // RLS yang menyaring; query ini hanya meminta yang sudah tayang.
  const sb = await klienServer();
  const { data, error } = await sb
    .from("announcements")
    .select(KOLOM)
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("disematkan", { ascending: false })
    .order("published_at", { ascending: false });

  if (error) throw new Error(`Gagal memuat pengumuman: ${error.message}`);
  return (data as unknown as BarisGabung[]).map(keDomain);
}

/** Satu pengumuman berdasarkan slug; null bila tidak ada atau tidak berhak. */
export async function ambilPengumumanSatu(
  slug: string,
  pengguna: Pengguna,
): Promise<Pengumuman | null> {
  const semua = await ambilPengumuman(pengguna);
  const cocok = semua.find((p) => p.id === slug);
  if (cocok) return cocok;

  if (modeData() === "demo") return null;

  // Penulis & Manager boleh membuka yang belum tayang.
  const sb = await klienServer();
  const { data } = await sb
    .from("announcements")
    .select(KOLOM)
    .eq("slug", slug)
    .maybeSingle();

  return data ? keDomain(data as unknown as BarisGabung) : null;
}
