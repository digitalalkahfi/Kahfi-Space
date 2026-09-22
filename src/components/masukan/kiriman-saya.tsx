import Link from "next/link";
import {
  Bug,
  CheckCircle2,
  Clock,
  MessageSquare,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tanggalPanjang, tanggalRelatif } from "@/lib/format";
import {
  GAYA_STATUS_MASUKAN,
  LABEL_JENIS,
  LABEL_STATUS_MASUKAN,
  ringkasKirimanSaya,
  type Masukan,
} from "@/lib/masukan";

/** Apa yang terjadi pada apa yang kamu laporkan. */
export function KirimanSaya({
  daftar,
  acuan,
}: {
  daftar: Masukan[];
  acuan: string;
}) {
  const r = ringkasKirimanSaya(daftar);

  return (
    <div className="space-y-4">
      <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
        <div className="px-5">
          <h2 className="text-base leading-6 font-semibold">Kirimanmu</h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {r.total === 0
              ? "Kamu belum pernah mengirim masukan."
              : r.menunggu > 0
                ? `${r.menunggu} masih menunggu keputusan.`
                : "Semua kirimanmu sudah ditindaklanjuti."}
            {r.dukunganDiterima > 0
              ? ` ${r.dukunganDiterima} dukungan dari rekan lain.`
              : ""}
          </p>
        </div>

        {r.total > 0 ? (
          <dl className="tabular grid grid-cols-4 gap-2 px-5">
            {[
              { label: "Menunggu", nilai: r.menunggu },
              { label: "Dikerjakan", nilai: r.ditindaklanjuti },
              { label: "Selesai", nilai: r.selesai },
              { label: "Ditolak", nilai: r.ditolak },
            ].map((k) => (
              <div key={k.label} className="rounded-2xl bg-muted/50 p-3">
                <dt className="text-[10px] leading-[14px] text-muted-foreground">
                  {k.label}
                </dt>
                <dd className="text-lg leading-6 font-bold tracking-tight">
                  {k.nilai}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </Card>

      {daftar.length === 0 ? (
        <Card className="rounded-3xl shadow-card ring-border-subtle">
          <p className="px-5 text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Kalau ada yang mengganggu pekerjaanmu atau bisa dibuat lebih baik,
            laporkan dari halaman Masukan &amp; bug. Setiap perubahan statusnya
            akan muncul di sini.
          </p>
        </Card>
      ) : (
        <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
          <h2 className="px-5 text-base leading-6 font-semibold">
            Riwayat kiriman
          </h2>

          <ul className="space-y-2 px-5">
            {daftar.map((m) => {
              const gaya = GAYA_STATUS_MASUKAN[m.status];
              const terakhir = m.jejak[0];

              return (
                <li key={m.id} className="rounded-2xl bg-muted/50 p-3.5">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-2xl",
                        m.status === "selesai"
                          ? "bg-ok-fill text-ok-text"
                          : m.status === "ditolak"
                            ? "bg-muted text-muted-foreground"
                            : "bg-card text-muted-foreground",
                      )}
                    >
                      {m.status === "selesai" ? (
                        <CheckCircle2 className="size-4" />
                      ) : m.status === "ditolak" ? (
                        <XCircle className="size-4" />
                      ) : m.jenis === "bug" ? (
                        <Bug className="size-4" />
                      ) : (
                        <Clock className="size-4" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-5 font-semibold text-pretty">
                        <Link
                          href={`/masukan/${m.id}`}
                          className="hover:underline"
                        >
                          {m.judul}
                        </Link>
                      </p>
                      <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
                        {LABEL_JENIS[m.jenis]} ·{" "}
                        {tanggalRelatif(m.dibuatPada, acuan)}
                      </p>
                    </div>

                    <span
                      className={cn(
                        "inline-flex h-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
                        gaya.kelas,
                      )}
                    >
                      <span
                        className={cn("size-1.5 rounded-full", gaya.titik)}
                      />
                      {LABEL_STATUS_MASUKAN[m.status]}
                    </span>
                  </div>

                  {/* Kabar terakhir: inilah yang membuat orang merasa
                      laporannya tidak hilang begitu saja. */}
                  {m.status === "ditolak" && m.alasanTolak ? (
                    <p className="mt-2 rounded-xl bg-card px-3 py-2 text-[11px] leading-[14px] text-pretty">
                      Ditolak: {m.alasanTolak}
                    </p>
                  ) : terakhir ? (
                    <p className="mt-2 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                      Kabar terakhir {tanggalPanjang(terakhir.pada)}:{" "}
                      {LABEL_STATUS_MASUKAN[terakhir.ke].toLowerCase()}
                      {terakhir.olehNama ? ` oleh ${terakhir.olehNama}` : ""}.
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] leading-[14px] text-muted-foreground">
                      Belum ada perubahan status sejak dikirim.
                    </p>
                  )}

                  <p className="mt-1 flex flex-wrap items-center gap-3 text-[11px] leading-[14px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp className="size-3" />
                      {m.dukungan} dukungan
                    </span>
                    {m.komentar.length > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="size-3" />
                        {m.komentar.length} balasan
                      </span>
                    ) : null}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
