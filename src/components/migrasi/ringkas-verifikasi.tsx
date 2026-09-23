import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bilangan } from "@/lib/format";
import {
  jumlahSelisih,
  jumlahTerhitung,
  nilaiBanding,
  type KelompokBanding,
} from "@/lib/banding";

/**
 * Keadaan verifikasi dalam satu tatapan.
 *
 * Yang ditonjolkan bukan berapa yang cocok melainkan berapa yang
 * berselisih dan berapa yang belum terhitung sama sekali. Angka yang
 * belum terhitung adalah yang paling mudah disalahartikan sebagai
 * "aman" — padahal ia berarti tidak ada yang pernah memeriksanya.
 */
export function RingkasVerifikasi({
  kelompok,
}: {
  kelompok: KelompokBanding[];
}) {
  const terhitung = jumlahTerhitung(kelompok);
  const berselisih = jumlahSelisih(kelompok);
  const semua = kelompok.reduce((a, k) => a + k.baris.length, 0);
  const belum = semua - terhitung;

  const angka = [
    {
      label: "Cocok",
      nilai: terhitung - berselisih,
      gaya: "bg-ok-fill text-ok-text",
    },
    {
      label: "Berselisih",
      nilai: berselisih,
      gaya: berselisih > 0 ? "bg-danger-fill text-danger-text" : "bg-muted",
    },
    {
      label: "Belum terhitung",
      nilai: belum,
      gaya: belum > 0 ? "bg-warn-fill text-warn-text" : "bg-muted",
    },
  ];

  // Kelompok mana yang bermasalah — supaya tidak perlu membuka semuanya.
  const bermasalah = kelompok
    .filter((k) => k.baris.some((b) => nilaiBanding(b).status === "selisih"))
    .map((k) => k.judul);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <dl className="grid grid-cols-3 gap-2 px-5">
        {angka.map((a) => (
          <div key={a.label} className={cn("rounded-2xl px-4 py-3", a.gaya)}>
            <dt className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] uppercase opacity-80">
              {a.label}
            </dt>
            <dd className="tabular text-[22px] leading-7 font-bold tracking-tight">
              {bilangan(a.nilai)}
            </dd>
          </div>
        ))}
      </dl>

      <p className="px-5 text-[13px] leading-[18px] text-pretty text-muted-foreground">
        {berselisih > 0
          ? `Selisih ada di: ${bermasalah.join(", ")}. Selisih boleh ada — asalkan ada yang bisa menjelaskan sebabnya, bukan sekadar menganggapnya wajar.`
          : belum > 0
            ? "Tidak ada selisih pada yang sudah terhitung. Yang belum terhitung bukan berarti cocok — belum ada yang memeriksanya."
            : "Seluruh ukuran terhitung dan bertemu di kedua sisi."}
      </p>
    </Card>
  );
}
