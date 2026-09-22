import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import type { Pengiriman, StatusKirim } from "@/lib/kirim-wa";
import type { KategoriNotifikasi } from "@/lib/notifikasi";
import type { Pengguna } from "@/lib/types";

type BarisDb = {
  id: string;
  notification_id: string;
  tujuan: string;
  status: StatusKirim;
  percobaan: number;
  galat: string;
  dikirim_pada: string | null;
  created_at: string;
  notifications: { judul: string; kategori: KategoriNotifikasi } | null;
};

/**
 * Riwayat pengiriman WhatsApp untuk notifikasi milik pengguna ini.
 *
 * Cakupannya dibatasi RLS (`kirim_wa_baca_milik_sendiri`, migrasi
 * 0117): seseorang hanya melihat pengiriman atas notifikasinya sendiri.
 * Itu yang menjawab "kenapa saya tidak dapat WhatsApp-nya" tanpa
 * membuka kotak masuk orang lain.
 */
export async function riwayatKirimSaya(
  pengguna: Pengguna,
): Promise<Pengiriman[]> {
  if (modeData() === "demo") {
    const sumber =
      "notification_delivery" in dataContoh
        ? (dataContoh.notification_delivery as {
            untuk: string;
            notifikasi: string;
            tujuan: string;
            status: string;
            percobaan: number;
            galat: string;
            dikirim: string | null;
            dibuat: string;
          }[])
        : [];

    return sumber
      .filter((k) => k.untuk === pengguna.nama)
      .map((k, i) => {
        const asal = dataContoh.notifications.find(
          (n) => n.untuk === k.untuk && n.judul === k.notifikasi,
        );
        return {
          id: `${pengguna.id}-kirim-${i}`,
          notifikasiId: `${pengguna.id}-${i}`,
          kategori: (asal?.kategori ?? "tugas") as KategoriNotifikasi,
          judul: k.notifikasi,
          tujuan: k.tujuan,
          status: k.status as StatusKirim,
          percobaan: k.percobaan,
          galat: k.galat,
          dikirimPada: k.dikirim,
          dibuatPada: k.dibuat,
        };
      })
      .sort((a, b) => b.dibuatPada.localeCompare(a.dibuatPada));
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("notification_delivery")
    .select(
      "id, notification_id, tujuan, status, percobaan, galat, dikirim_pada, created_at, notifications:notification_id (judul, kategori)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(`Gagal memuat riwayat kirim: ${error.message}`);

  return (data as unknown as BarisDb[]).map((b) => ({
    id: b.id,
    notifikasiId: b.notification_id,
    kategori: b.notifications?.kategori ?? "tugas",
    judul: b.notifications?.judul ?? "Notifikasi",
    tujuan: b.tujuan,
    status: b.status,
    percobaan: b.percobaan,
    galat: b.galat,
    dikirimPada: b.dikirim_pada,
    dibuatPada: b.created_at,
  }));
}

/**
 * Status pengiriman WhatsApp per notifikasi.
 *
 * Dipakai daftar notifikasi untuk menandai mana yang tidak sampai ke
 * ponsel. Itulah wujud nyata "cadangan in-app": bukan sekadar bahwa
 * notifikasinya ada, melainkan bahwa orangnya TAHU pesan WhatsApp-nya
 * gagal — tanpa itu ia akan menganggap tidak ada kabar sama sekali.
 *
 * Hanya yang berstatus `gagal` yang dipetakan. Yang terkirim tidak
 * perlu ditandai (tidak ada yang salah), dan yang masih antre belum
 * tentu gagal — menandainya lebih awal hanya membuat cemas.
 */
export async function kirimGagalPerNotifikasi(
  pengguna: Pengguna,
): Promise<Set<string>> {
  const riwayat = await riwayatKirimSaya(pengguna);
  return new Set(
    riwayat.filter((k) => k.status === "gagal").map((k) => k.notifikasiId),
  );
}
