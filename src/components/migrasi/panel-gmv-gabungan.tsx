import { Card } from "@/components/ui/card";
import { bilangan } from "@/lib/format";
import { LABEL_SUMBER, type SebabDilewati, type SumberGmv } from "@/lib/gmv-v1";

/**
 * Dari mana angka GMV yang dipakai berasal, dan apa yang tidak dipakai.
 *
 * Angka GMV yang sama ada di tiga tempat di sistem lama. Yang paling
 * mudah terjadi tanpa disadari adalah membawanya bertiga — dan GMV
 * perusahaan langsung terhitung dua sampai tiga kali lipat tanpa satu
 * pun galat. Panel ini yang membuat keputusan itu terlihat.
 */
export function PanelGmvGabungan({
  dipakai,
  dilewati,
}: {
  dipakai: { sumber: SumberGmv; jumlah: number }[];
  dilewati: SebabDilewati[];
}) {
  const total = dipakai.reduce((a, d) => a + d.jumlah, 0);
  const jumlahDilewati = dilewati.reduce((a, d) => a + d.jumlah, 0);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">
          Angka GMV: yang dipakai dan yang dilewati
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {bilangan(total)} angka dipakai, {bilangan(jumlahDilewati)} dilewati.
          Angka yang sama ada di tiga tempat di sistem lama; membawanya bertiga
          akan menggandakan GMV perusahaan tanpa satu pun galat.
        </p>
      </div>

      <ul className="space-y-1 px-5">
        {dipakai.map((d) => (
          <li
            key={d.sumber}
            className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 px-3 py-2"
          >
            <span className="min-w-0 flex-1 text-[13px] leading-[18px]">
              {LABEL_SUMBER[d.sumber]}
            </span>
            <span className="tabular rounded-full bg-ok-fill px-2.5 py-1 text-[11px] leading-[14px] font-semibold text-ok-text">
              {bilangan(d.jumlah)} dipakai
            </span>
          </li>
        ))}
      </ul>

      {dilewati.length > 0 ? (
        <div className="px-5">
          <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Sebab dilewati
          </p>
          <ul className="mt-1.5 space-y-1">
            {dilewati.map((d) => (
              <li key={d.sebab} className="rounded-xl bg-muted/50 px-3 py-2">
                <p className="flex flex-wrap items-start gap-2">
                  <span className="min-w-0 flex-1 text-[13px] leading-[18px] text-pretty">
                    {d.sebab}
                  </span>
                  <span className="tabular rounded-full bg-muted px-2.5 py-1 text-[11px] leading-[14px] font-semibold text-muted-foreground">
                    {bilangan(d.jumlah)}
                  </span>
                </p>
                <p className="mt-0.5 font-mono text-[11px] leading-[14px] break-all text-muted-foreground">
                  {d.contoh.join(", ")}
                  {d.jumlah > d.contoh.length ? ", …" : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
