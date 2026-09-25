import Link from "next/link";
import { NotebookPen, Paperclip, Pin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tanggalRelatif } from "@/lib/format";
import {
  GAYA_KATEGORI_CATATAN,
  GAYA_VISIBILITAS,
  LABEL_KATEGORI_CATATAN,
  LABEL_VISIBILITAS,
  cuplikanCatatan,
  type Catatan,
} from "@/lib/catatan";

export function DaftarCatatan({
  daftar,
  penggunaId,
  acuan,
}: {
  daftar: Catatan[];
  penggunaId: string;
  acuan: string;
}) {
  if (daftar.length === 0) {
    return (
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada catatan di sini. Catatan yang kamu tulis hanya terlihat
          olehmu, kecuali kamu membagikannya.
        </p>
      </Card>
    );
  }

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <h2 className="px-5 text-base leading-6 font-semibold">Catatan</h2>
      <ul className="space-y-2 px-5">
        {daftar.map((c) => {
          const milik = c.pemilikId === penggunaId;
          return (
            <li key={c.id} className="rounded-2xl bg-muted/50 p-3.5">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-card text-muted-foreground">
                  {milik && c.disematkan ? (
                    <Pin className="size-4" />
                  ) : (
                    <NotebookPen className="size-4" />
                  )}
                </span>

                <div className="min-w-[10rem] flex-1">
                  <p className="text-sm leading-5 font-semibold text-pretty">
                    <Link href={`/catatan/${c.id}`} className="hover:underline">
                      {c.judul}
                    </Link>
                  </p>
                  <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
                    {milik ? "Kamu" : c.pemilikNama}
                    {c.visibilitas === "unit" && c.unitNama
                      ? ` · ${c.unitNama}`
                      : ""}{" "}
                    · {tanggalRelatif(c.diperbaruiPada, acuan)}
                    {c.lampiran.length > 0 ? (
                      <span className="ml-1.5 inline-flex items-center gap-0.5">
                        <Paperclip className="size-3" />
                        {c.lampiran.length}
                      </span>
                    ) : null}
                  </p>
                </div>

                <span className="flex h-fit shrink-0 flex-wrap gap-1">
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-[10px] leading-[14px] font-semibold",
                      GAYA_KATEGORI_CATATAN[c.kategori],
                    )}
                  >
                    {LABEL_KATEGORI_CATATAN[c.kategori]}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-[10px] leading-[14px] font-semibold",
                      GAYA_VISIBILITAS[c.visibilitas],
                    )}
                  >
                    {LABEL_VISIBILITAS[c.visibilitas]}
                  </span>
                </span>
              </div>

              {c.isi ? (
                <p className="mt-2 text-[12px] leading-[16px] text-pretty text-muted-foreground">
                  {cuplikanCatatan(c.isi)}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
