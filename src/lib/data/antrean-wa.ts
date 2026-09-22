import "server-only";

import { klienAdmin } from "@/lib/supabase/admin";
import { kirimPesanWa } from "@/lib/data/pengirim-wa";
import { layakDicoba, urutkanAntrean } from "@/lib/antrean-wa";
import { MAKS_PERCOBAAN } from "@/lib/kirim-wa";
import type { KategoriNotifikasi } from "@/lib/notifikasi";

export type HasilProses = {
  diperiksa: number;
  dikirim: number;
  gagal: number;
  dilewati: number;
};

/**
 * Mengerjakan antrean pengiriman WhatsApp satu putaran.
 *
 * Dijalankan pekerjaan terjadwal, bukan permintaan pengguna: memanggil
 * layanan luar di tengah permintaan berarti halaman menunggu jaringan
 * pihak ketiga.
 *
 * Memakai klien service-role karena antrean ini bukan milik siapa pun —
 * RLS pada `notification_delivery` hanya mengizinkan pemilik
 * notifikasinya MEMBACA, dan memang seharusnya begitu.
 *
 * Tidak pernah melempar karena satu pesan gagal. Satu nomor yang
 * bermasalah tidak boleh menghentikan antrean di belakangnya — itu
 * cara paling cepat membuat seluruh kanal berhenti tanpa ada yang
 * sadar.
 */
export async function prosesAntreanWa(
  batas = 50,
  sekarang = new Date(),
): Promise<HasilProses> {
  const sb = klienAdmin();

  const { data, error } = await sb
    .from("notification_delivery")
    .select(
      "id, tujuan, percobaan, created_at, notifications:notification_id (kategori, judul, pesan, tautan)",
    )
    .in("status", ["antre", "gagal"])
    .lt("percobaan", MAKS_PERCOBAAN)
    .order("created_at", { ascending: true })
    .limit(batas);

  if (error) throw new Error(`Gagal membaca antrean: ${error.message}`);

  type Baris = {
    id: string;
    tujuan: string;
    percobaan: number;
    created_at: string;
    notifications: {
      kategori: KategoriNotifikasi;
      judul: string;
      pesan: string;
      tautan: string;
    } | null;
  };

  const baris = urutkanAntrean(
    (data as unknown as Baris[]).map((b) => ({
      ...b,
      dibuatPada: b.created_at,
    })),
  );

  const hasil: HasilProses = {
    diperiksa: baris.length,
    dikirim: 0,
    gagal: 0,
    dilewati: 0,
  };

  for (const b of baris) {
    // Jeda antar percobaan dihitung dari percobaan terakhirnya; tanpa
    // itu, gateway yang sedang tumbang akan dihantam tiap putaran.
    const { data: terakhir } = await sb
      .from("notification_delivery_attempts")
      .select("created_at")
      .eq("delivery_id", b.id)
      .order("urutan", { ascending: false })
      .limit(1)
      .maybeSingle();

    const boleh = layakDicoba(
      {
        id: b.id,
        percobaan: b.percobaan,
        terakhirPada: terakhir?.created_at ?? null,
      },
      sekarang,
      MAKS_PERCOBAAN,
    );

    if (!boleh || !b.notifications) {
      hasil.dilewati += 1;
      continue;
    }

    const kirim = await kirimPesanWa(b.tujuan, {
      kategori: b.notifications.kategori,
      judul: b.notifications.judul,
      pesan: b.notifications.pesan,
      tautan: b.notifications.tautan,
    });

    // Yang 4xx tidak diulang: menaikkan percobaan sampai batas membuat
    // barisnya berhenti dengan sendirinya, dan alasannya tetap tercatat.
    const percobaanTerpakai =
      kirim.ok || kirim.bolehUlang ? 1 : MAKS_PERCOBAAN - b.percobaan;

    for (let i = 0; i < percobaanTerpakai; i++) {
      await sb.rpc("catat_percobaan_kirim", {
        p_delivery: b.id,
        p_status: kirim.ok ? "terkirim" : "gagal",
        p_galat: kirim.ok ? "" : kirim.galat,
        p_balasan: kirim.balasan,
      });
    }

    if (kirim.ok) hasil.dikirim += 1;
    else hasil.gagal += 1;
  }

  return hasil;
}
