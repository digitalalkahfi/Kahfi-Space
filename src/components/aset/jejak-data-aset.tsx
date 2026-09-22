import { FileClock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { rupiahPenuh, tanggalPendek } from "@/lib/format";
import type { JejakDataAset, PerubahanField } from "@/lib/aset";

const LABEL_AKSI: Record<string, string> = {
  insert: "Dicatat",
  update: "Disunting",
  delete: "Dihapus",
};

function nilai(v: PerubahanField["dari"], rupiah?: boolean) {
  if (v === null || v === "") return "—";
  return rupiah && typeof v === "number" ? rupiahPenuh(v) : String(v);
}

/**
 * Jejak perubahan data aset — nilai, masa manfaat, dan keadaannya.
 *
 * Perpindahan tangan punya kartunya sendiri; yang ini menjawab
 * pertanyaan yang lebih jarang tetapi lebih menentukan: kapan angkanya
 * pernah lain, dan siapa yang mengubahnya. Menaikkan nilai perolehan
 * atau memperpanjang masa manfaat menulis ulang nilai buku secara surut.
 */
export function JejakDataAsetKartu({ daftar }: { daftar: JejakDataAset[] }) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <FileClock className="size-4 text-muted-foreground" />
          Jejak perubahan data
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Perubahan nilai dan masa manfaat menghitung ulang nilai buku seluruh
          periode, jadi keduanya selalu meninggalkan jejak.
        </p>
      </div>

      {daftar.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Belum pernah disunting sejak dicatat.
        </p>
      ) : (
        <ol className="space-y-2 px-5">
          {daftar.map((j) => (
            <li key={j.id} className="rounded-2xl bg-muted/50 p-3">
              <p className="text-[13px] leading-[18px] font-semibold">
                {LABEL_AKSI[j.aksi] ?? j.aksi}
                {j.olehNama ? ` oleh ${j.olehNama}` : ""}
              </p>
              <p className="text-[11px] leading-[14px] text-muted-foreground">
                {tanggalPendek(j.pada)}
              </p>

              {j.perubahan.length > 0 ? (
                <ul className="tabular mt-1.5 space-y-0.5">
                  {j.perubahan.map((p) => (
                    <li
                      key={p.label}
                      className="text-[11px] leading-[14px] text-pretty text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">
                        {p.label}
                      </span>{" "}
                      {nilai(p.dari, p.rupiah)} → {nilai(p.ke, p.rupiah)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
