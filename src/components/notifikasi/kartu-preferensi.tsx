import Link from "next/link";
import { Lock, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  KETERANGAN_KATEGORI,
  LABEL_KATEGORI,
  type KategoriNotifikasi,
} from "@/lib/notifikasi";
import {
  bolehMematikan,
  ringkasPreferensi,
  type PreferensiNotifikasi,
} from "@/lib/preferensi-notifikasi";
import type { Peran } from "@/lib/types";

/** Satu baris: nama kategori, keterangannya, dan dua saklarnya. */
function Baris({
  kategori,
  inApp,
  whatsapp,
  saklar,
}: {
  kategori: KategoriNotifikasi;
  inApp: boolean;
  whatsapp: boolean;
  saklar: (kanal: "inApp" | "whatsapp", nyala: boolean) => React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 border-b border-border-subtle py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] leading-[18px] font-semibold">
          {LABEL_KATEGORI[kategori]}
        </p>
        <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
          {KETERANGAN_KATEGORI[kategori]}
        </p>
      </div>

      {/* Alasan terkuncinya ditulis sekali di kepala kartu, bukan
          diulang tujuh kali di tiap baris — pengulangan yang sama
          persis berhenti dibaca setelah kali kedua. Kanal in-app yang
          terkunci sudah menampilkan dirinya sebagai keterangan. */}
      <div className="flex flex-wrap items-center gap-2">
        {saklar("inApp", inApp)}
        {saklar("whatsapp", whatsapp)}
      </div>
    </div>
  );
}

/**
 * Pengaturan notifikasi per kategori.
 *
 * Saklarnya dua, bukan satu: in-app adalah rumah notifikasi, WhatsApp
 * hanya pelengkap. Karena itu WhatsApp tidak pernah bisa menyala
 * sendirian — pesan yang sampai di ponsel tapi tidak bisa ditemukan
 * lagi di aplikasi adalah pesan yang hilang.
 */
export function KartuPreferensi({
  preferensi,
  peran,
  kontak,
  saklar,
}: {
  preferensi: PreferensiNotifikasi;
  peran: Peran;
  /** Nomor WhatsApp pada profil; null berarti kanal itu belum bisa dipakai. */
  kontak: string | null;
  saklar: (
    kategori: KategoriNotifikasi,
    kanal: "inApp" | "whatsapp",
    nyala: boolean,
  ) => React.ReactNode;
}) {
  const bisaMatikan = bolehMematikan(peran);
  const ringkas = ringkasPreferensi(preferensi);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-2 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">
            Kategori peristiwa
          </h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {ringkas.inApp} dari {ringkas.total} kategori muncul di aplikasi;{" "}
            {ringkas.whatsapp} di antaranya juga dikirim ke WhatsApp.
          </p>
        </div>

        {bisaMatikan ? null : (
          <p
            className={cn(
              "flex items-start gap-2 rounded-xl bg-muted px-3 py-2",
              "text-[11px] leading-[14px] text-pretty text-muted-foreground",
            )}
          >
            <Lock className="mt-0.5 size-3 shrink-0" />
            Notifikasi di aplikasi tidak bisa dimatikan untuk peranmu — isinya
            tugas dan keputusan yang ditujukan kepadamu, dan mematikannya
            berarti pekerjaan itu hilang tanpa jejak. Kanal WhatsApp tetap bisa
            kamu atur sendiri.
          </p>
        )}

        <div>
          {preferensi.map((p) => (
            <Baris
              key={p.kategori}
              kategori={p.kategori}
              inApp={p.inApp}
              whatsapp={p.whatsapp}
              saklar={(kanal, nyala) => saklar(p.kategori, kanal, nyala)}
            />
          ))}
        </div>

        {kontak === null ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-pretty text-warn-text">
            <Smartphone className="size-3 shrink-0" />
            Belum ada nomor tujuan, jadi kanal WhatsApp belum bisa dipakai.
            <Link
              href="/profil"
              className="font-semibold underline underline-offset-2"
            >
              Isi nomor kontak di Profil
            </Link>
          </p>
        ) : (
          <p className="flex items-start gap-2 text-[11px] leading-[14px] text-pretty text-muted-foreground">
            <Smartphone className="mt-0.5 size-3 shrink-0" />
            WhatsApp dikirim ke {kontak}. Bila gagal terkirim, notifikasinya
            tetap muncul di lonceng — kanal itu cadangannya, bukan sebaliknya.
          </p>
        )}
      </div>
    </Card>
  );
}
