import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircleOff } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { KeadaanKosong } from "@/components/shared/keadaan";
import { SubMenuNotifikasi } from "@/components/notifikasi/sub-menu-notifikasi";
import { RiwayatKirim } from "@/components/notifikasi/riwayat-kirim";
import { KanalAktif } from "@/components/notifikasi/kanal-aktif";
import { riwayatKirimSaya } from "@/lib/data/kirim-wa";
import { preferensiSaya } from "@/lib/data/preferensi-notifikasi";
import { ringkasKirim } from "@/lib/kirim-wa";
import { persen } from "@/lib/format";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Pengiriman WhatsApp — K-Space V2",
  description: "Riwayat pesan WhatsApp yang dikirim dari notifikasimu.",
};

/**
 * Riwayat pengiriman WhatsApp (PRD Fase 4).
 *
 * Ada supaya pertanyaan "kenapa saya tidak dapat WhatsApp-nya" punya
 * jawaban yang bisa dibaca sendiri, tanpa bertanya ke pengelola. Yang
 * paling sering: nomornya belum diverifikasi, atau kategorinya memang
 * tidak dikirim ke WhatsApp.
 */
export default async function PengirimanWhatsappPage({
  searchParams,
}: PageProps<"/notifikasi/whatsapp">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const hariIni =
    modeData() === "demo"
      ? TANGGAL_ACUAN
      : new Date().toISOString().slice(0, 10);

  const [daftar, preferensi] = await Promise.all([
    riwayatKirimSaya(pengguna),
    preferensiSaya(pengguna),
  ]);
  const ringkas = ringkasKirim(daftar);

  return (
    <AppShell pengguna={pengguna} halaman="Pengiriman WhatsApp">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="space-y-2">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Pengiriman WhatsApp
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Riwayat pesan yang dikirim dari notifikasimu. WhatsApp adalah
              pelengkap — yang gagal terkirim tetap ada di lonceng dan di
              halaman notifikasi.
            </p>
          </div>

          <SubMenuNotifikasi />
        </div>

        <Reveal>
          <KanalAktif preferensi={preferensi} />
        </Reveal>

        {daftar.length === 0 ? (
          <KeadaanKosong
            ikon={<MessageCircleOff className="size-4" />}
            judul="Belum ada pesan WhatsApp yang dikirim"
            pesan="Pesan baru dikirim setelah nomormu diverifikasi, kamu setuju dihubungi, dan sebuah kategori dinyalakan untuk kanal WhatsApp."
            aksi={
              <Link
                href="/notifikasi/preferensi"
                className="tekan-halus sentuh-nyaman inline-flex h-9 items-center rounded-full bg-primary px-4 text-[11px] leading-[14px] font-semibold text-primary-foreground"
              >
                Atur preferensi
              </Link>
            }
          />
        ) : (
          <>
            <Reveal>
              <Card className="rounded-3xl shadow-card ring-border-subtle">
                <div className="grid grid-cols-2 gap-2 px-5 lg:grid-cols-4">
                  {[
                    ["Terkirim", ringkas.terkirim],
                    ["Gagal", ringkas.gagal],
                    ["Menunggu", ringkas.antre],
                  ].map(([label, nilai]) => (
                    <div key={label} className="rounded-2xl bg-muted/50 p-3">
                      <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                        {label}
                      </p>
                      <p className="tabular text-[19px] leading-[26px] font-bold">
                        {nilai}
                      </p>
                    </div>
                  ))}
                  <div className="rounded-2xl bg-muted/50 p-3">
                    <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                      Keberhasilan
                    </p>
                    <p className="tabular text-[19px] leading-[26px] font-bold">
                      {persen(ringkas.keberhasilan, 0)}
                    </p>
                    <p className="text-[11px] leading-[14px] text-muted-foreground">
                      Dari yang selesai dicoba
                    </p>
                  </div>
                </div>
              </Card>
            </Reveal>

            <Reveal>
              <RiwayatKirim daftar={daftar} hariIni={hariIni} />
            </Reveal>
          </>
        )}
      </div>
    </AppShell>
  );
}
