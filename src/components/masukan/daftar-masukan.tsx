import Link from "next/link";
import { Bug, MessageSquare, ThumbsUp, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tanggalRelatif } from "@/lib/format";
import {
  GAYA_JENIS,
  GAYA_KEPARAHAN,
  GAYA_STATUS_MASUKAN,
  LABEL_JENIS,
  LABEL_KEPARAHAN,
  LABEL_STATUS_MASUKAN,
  ringkasMasukan,
  urutkanMasukan,
  type Masukan,
} from "@/lib/masukan";

/** Angka yang menyoroti bug terbuka, bukan sekadar jumlah masukan. */
export function RingkasanMasukan({ daftar }: { daftar: Masukan[] }) {
  const r = ringkasMasukan(daftar);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <MessageSquare className="size-4 text-muted-foreground" />
          Masukan masuk
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {r.bugKritis > 0
            ? `${r.bugKritis} bug kritis masih terbuka.`
            : r.baru > 0
              ? `${r.baru} masukan belum dibaca.`
              : "Semua masukan sudah ditindaklanjuti."}
        </p>
      </div>

      <dl className="tabular grid grid-cols-3 gap-2 px-5">
        <div
          className={cn(
            "rounded-2xl p-3",
            r.baru > 0 ? "bg-warn-fill" : "bg-muted/50",
          )}
        >
          <dt
            className={cn(
              "text-[11px] leading-[14px]",
              r.baru > 0 ? "text-warn-text" : "text-muted-foreground",
            )}
          >
            Belum dibaca
          </dt>
          <dd
            className={cn(
              "text-lg leading-6 font-bold tracking-tight",
              r.baru > 0 && "text-warn-text",
            )}
          >
            {r.baru}
          </dd>
        </div>
        <div className="rounded-2xl bg-muted/50 p-3">
          <dt className="text-[11px] leading-[14px] text-muted-foreground">
            Bug terbuka
          </dt>
          <dd className="text-lg leading-6 font-bold tracking-tight">
            {r.bugTerbuka}
          </dd>
        </div>
        <div
          className={cn(
            "rounded-2xl p-3",
            r.bugKritis > 0 ? "bg-danger-fill" : "bg-muted/50",
          )}
        >
          <dt
            className={cn(
              "text-[11px] leading-[14px]",
              r.bugKritis > 0 ? "text-danger-text" : "text-muted-foreground",
            )}
          >
            Kritis
          </dt>
          <dd
            className={cn(
              "text-lg leading-6 font-bold tracking-tight",
              r.bugKritis > 0 && "text-danger-text",
            )}
          >
            {r.bugKritis}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

/** Daftar masukan, diurutkan berdasarkan prioritasnya. */
export function DaftarMasukan({
  daftar,
  acuan,
}: {
  daftar: Masukan[];
  acuan: string;
}) {
  const urut = urutkanMasukan(daftar);

  if (urut.length === 0) {
    return (
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada masukan yang masuk.
        </p>
      </Card>
    );
  }

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">Semua masukan</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Bug yang parah selalu di atas saran sepopuler apa pun; di antara yang
          setara, dukungan orang yang menentukan.
        </p>
      </div>

      <ul className="space-y-2 px-5">
        {urut.map((m) => {
          const gaya = GAYA_STATUS_MASUKAN[m.status];
          return (
            <li key={m.id} className="rounded-2xl bg-muted/50 p-3.5">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-2xl",
                    m.jenis === "bug"
                      ? "bg-danger-fill text-danger-text"
                      : "bg-card text-muted-foreground",
                  )}
                >
                  {m.jenis === "bug" ? (
                    <Bug className="size-4" />
                  ) : (
                    <MessageSquare className="size-4" />
                  )}
                </span>

                <div className="min-w-[10rem] flex-1">
                  <p className="text-sm leading-5 font-semibold text-pretty">
                    <Link href={`/masukan/${m.id}`} className="hover:underline">
                      {m.judul}
                    </Link>
                  </p>
                  <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
                    {m.pelaporNama ?? "Anonim"}
                    {m.halaman ? ` · ${m.halaman}` : ""} ·{" "}
                    {tanggalRelatif(m.dibuatPada, acuan)}
                  </p>
                </div>

                <span className="flex h-fit shrink-0 items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[11px] leading-[14px] font-semibold">
                  <ThumbsUp
                    className={cn(
                      "size-3",
                      m.sayaDukung ? "text-secondary" : "text-muted-foreground",
                    )}
                  />
                  {m.dukungan}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-semibold",
                    gaya.kelas,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", gaya.titik)} />
                  {LABEL_STATUS_MASUKAN[m.status]}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-semibold",
                    GAYA_JENIS[m.jenis],
                  )}
                >
                  {LABEL_JENIS[m.jenis]}
                </span>
                {m.keparahan ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-semibold",
                      GAYA_KEPARAHAN[m.keparahan],
                    )}
                  >
                    {m.keparahan === "kritis" ? (
                      <TriangleAlert className="size-3" />
                    ) : null}
                    {LABEL_KEPARAHAN[m.keparahan]}
                  </span>
                ) : null}
                {m.komentar.length > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-muted-foreground">
                    <MessageSquare className="size-3" />
                    {m.komentar.length}
                  </span>
                ) : null}
              </div>

              {m.status === "ditolak" && m.alasanTolak ? (
                <p className="mt-2 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  Ditolak: {m.alasanTolak}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
