import { AlertTriangle, CheckCircle2, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ringkasProgresTim,
  urutkanProgres,
  type ProgresOrang,
} from "@/lib/lms";

/** Progres belajar tim, yang paling tertinggal lebih dulu. */
export function TabelProgres({
  daftar,
  ringkasDari,
}: {
  daftar: ProgresOrang[];
  /**
   * Angka ringkasan dihitung dari daftar penuh, bukan hasil saringan:
   * "3 orang tertinggal" harus tetap berarti tiga orang di seluruh tim,
   * bukan tiga dari yang kebetulan sedang tampil.
   */
  ringkasDari?: ProgresOrang[];
}) {
  const urut = urutkanProgres(daftar);
  const r = ringkasProgresTim(ringkasDari ?? daftar);

  return (
    <div className="space-y-4">
      <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
        <div className="px-5">
          <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
            <Users className="size-4 text-muted-foreground" />
            Pelatihan wajib
          </h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {r.belumMulai > 0
              ? `${r.belumMulai} orang belum menyentuh pelatihan wajibnya sama sekali — kemungkinan besar mereka belum tahu ada kewajibannya.`
              : r.tertinggal > 0
                ? `${r.tertinggal} orang masih punya pelatihan wajib yang belum tuntas.`
                : "Seluruh pelatihan wajib sudah tuntas."}
          </p>
        </div>

        <dl className="tabular grid grid-cols-3 gap-2 px-5">
          <div className="rounded-2xl bg-ok-fill p-3">
            <dt className="text-[11px] leading-[14px] text-ok-text">Tuntas</dt>
            <dd className="text-lg leading-6 font-bold tracking-tight text-ok-text">
              {r.tuntasSemua}
            </dd>
          </div>
          <div
            className={cn(
              "rounded-2xl p-3",
              r.tertinggal > 0 ? "bg-warn-fill" : "bg-muted/50",
            )}
          >
            <dt
              className={cn(
                "text-[11px] leading-[14px]",
                r.tertinggal > 0 ? "text-warn-text" : "text-muted-foreground",
              )}
            >
              Tertinggal
            </dt>
            <dd
              className={cn(
                "text-lg leading-6 font-bold tracking-tight",
                r.tertinggal > 0 && "text-warn-text",
              )}
            >
              {r.tertinggal}
            </dd>
          </div>
          <div
            className={cn(
              "rounded-2xl p-3",
              r.belumMulai > 0 ? "bg-danger-fill" : "bg-muted/50",
            )}
          >
            <dt
              className={cn(
                "text-[11px] leading-[14px]",
                r.belumMulai > 0 ? "text-danger-text" : "text-muted-foreground",
              )}
            >
              Belum mulai
            </dt>
            <dd
              className={cn(
                "text-lg leading-6 font-bold tracking-tight",
                r.belumMulai > 0 && "text-danger-text",
              )}
            >
              {r.belumMulai}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
        <h2 className="px-5 text-base leading-6 font-semibold">
          Progres tiap orang
        </h2>

        {urut.length === 0 ? (
          <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
            Belum ada orang dalam cakupanmu.
          </p>
        ) : (
          <ul className="space-y-2 px-5">
            {urut.map((o) => {
              const tertinggal = o.wajibTertunda.length;
              return (
                <li
                  key={o.userId}
                  className={cn(
                    "rounded-2xl p-3",
                    tertinggal > 0 && o.wajibSelesai === 0 && o.berjalan === 0
                      ? "bg-danger-fill/40"
                      : "bg-muted/50",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback className="bg-card text-[11px] font-semibold text-muted-foreground">
                        {o.inisial}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm leading-5 font-semibold">
                        {o.nama}
                      </p>
                      <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
                        {o.jabatan}
                      </p>
                    </div>

                    <span className="shrink-0 text-right">
                      <span className="tabular block text-[13px] leading-[18px] font-semibold">
                        {o.wajibSelesai}/{o.wajib}
                      </span>
                      <span className="block text-[10px] leading-[14px] text-muted-foreground">
                        wajib
                      </span>
                    </span>
                  </div>

                  {o.wajib > 0 ? (
                    <p
                      className={cn(
                        "mt-2 flex items-start gap-1.5 text-[11px] leading-[14px] text-pretty",
                        tertinggal > 0
                          ? "text-warn-text"
                          : "text-muted-foreground",
                      )}
                    >
                      {tertinggal > 0 ? (
                        <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                      ) : (
                        <CheckCircle2 className="mt-0.5 size-3 shrink-0" />
                      )}
                      {tertinggal > 0
                        ? `Belum tuntas: ${o.wajibTertunda.join(", ")}`
                        : "Seluruh pelatihan wajibnya tuntas."}
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] leading-[14px] text-muted-foreground">
                      Tidak ada pelatihan wajib untuk perannya.
                      {o.selesai > 0
                        ? ` Sudah menyelesaikan ${o.selesai} kursus atas inisiatif sendiri.`
                        : ""}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
