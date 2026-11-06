import { MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BarisMasukan } from "@/components/masukan/baris-masukan";
import { cn } from "@/lib/utils";
import {
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
  bolehKelola,
}: {
  daftar: Masukan[];
  acuan: string;
  bolehKelola: boolean;
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
          setara, dukungan orang yang menentukan. Ketuk untuk membaca
          deskripsinya.
        </p>
      </div>

      <ul className="space-y-2 px-5">
        {urut.map((m) => (
          <BarisMasukan
            key={m.id}
            masukan={m}
            acuan={acuan}
            bolehKelola={bolehKelola}
          />
        ))}
      </ul>
    </Card>
  );
}
