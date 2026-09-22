import Link from "next/link";
import { MessageCircle, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LABEL_KATEGORI } from "@/lib/notifikasi";
import {
  dikirimLewat,
  type PreferensiNotifikasi,
} from "@/lib/preferensi-notifikasi";

/**
 * Kategori mana saja yang benar-benar dikirim ke WhatsApp.
 *
 * Ditampilkan di halaman riwayat pengiriman, bukan hanya di halaman
 * preferensi. Pertanyaan "kenapa notifikasi ini tidak sampai ke
 * WhatsApp" hampir selalu dijawab di sini — kategorinya memang tidak
 * dinyalakan — dan orang yang sedang bertanya itu sedang membuka
 * halaman riwayat, bukan halaman pengaturan.
 *
 * Memakai `dikirimLewat`, bukan membaca `whatsapp` langsung: kategori
 * yang in-app-nya mati tidak dikirim ke mana pun, dan menampilkannya
 * sebagai "aktif" akan menyesatkan.
 */
export function KanalAktif({
  preferensi,
}: {
  preferensi: PreferensiNotifikasi;
}) {
  const aktif = preferensi.filter((p) =>
    dikirimLewat(preferensi, p.kategori, "whatsapp"),
  );
  const mati = preferensi.filter(
    (p) => !dikirimLewat(preferensi, p.kategori, "whatsapp"),
  );

  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-2 px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <MessageCircle className="size-4 text-muted-foreground" />
          Kategori yang dikirim ke WhatsApp
        </h2>

        {aktif.length === 0 ? (
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Belum ada satu pun kategori yang dikirim ke WhatsApp. Itu sebabnya
            riwayat di bawah kosong atau berhenti bertambah.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {aktif.map((p) => (
              <li
                key={p.kategori}
                className="rounded-full bg-ok-fill px-2.5 py-1 text-[11px] leading-[14px] font-semibold text-ok-text"
              >
                {LABEL_KATEGORI[p.kategori]}
              </li>
            ))}
          </ul>
        )}

        {mati.length > 0 ? (
          <div className="space-y-1">
            <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              Hanya di aplikasi
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {mati.map((p) => (
                <li
                  key={p.kategori}
                  className="rounded-full bg-muted px-2.5 py-1 text-[11px] leading-[14px] font-medium text-muted-foreground"
                >
                  {LABEL_KATEGORI[p.kategori]}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Link
          href="/notifikasi/preferensi"
          className="tekan-halus sentuh-nyaman inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-4 text-[11px] leading-[14px] font-semibold ring-1 ring-border-subtle"
        >
          <SlidersHorizontal className="size-3.5" />
          Ubah preferensi
        </Link>
      </div>
    </Card>
  );
}
