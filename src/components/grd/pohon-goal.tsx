import { CalendarRange, CornerDownRight, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BarCapaian } from "@/components/motion/bar-capaian";
import { DialogUbahGoal } from "@/components/grd/dialog-ubah-goal";
import { cn } from "@/lib/utils";
import { bulanPendek, persen, rupiahRingkas } from "@/lib/format";
import { akhirPeriode, statusPeriode } from "@/lib/goal";
import type { PilihanGoal, SimpulGoal } from "@/lib/data/goal";

/** Goal itu sendiri beserta seluruh turunannya. */
function idCabang(goal: SimpulGoal): string[] {
  return [goal.id, ...goal.anak.flatMap(idCabang)];
}

const LABEL_LEVEL: Record<SimpulGoal["level"], string> = {
  company: "Perusahaan",
  manager: "Manager",
  leader: "Unit",
  account: "Akun",
  staff: "Staf",
};

const GAYA_LEVEL: Record<SimpulGoal["level"], string> = {
  company: "bg-primary text-primary-foreground",
  manager: "bg-info-fill text-info-text",
  leader: "bg-accentmuted-fill text-accentmuted-text",
  account: "bg-warn-fill text-warn-text",
  staff: "bg-muted text-muted-foreground",
};

function Simpul({
  goal,
  dalam,
  acuan,
  pilihan,
}: {
  goal: SimpulGoal;
  dalam: number;
  acuan: string;
  /** Ada bila pembaca boleh mengubah goal (CEO/Manager). */
  pilihan: PilihanGoal | null;
}) {
  const kuat = goal.rasio >= 90;
  const sedang = goal.rasio >= 75;
  // Capaian hanya berarti di dalam periodenya: goal Oktober yang dilihat
  // pada September belum punya target bulan ini, bukan gagal 0%.
  const status = goal.mulai
    ? statusPeriode(goal.mulai, goal.jumlahBulan, acuan)
    : "berjalan";

  return (
    <li>
      <div
        className={cn(
          "baris-interaktif rounded-2xl p-3.5",
          dalam === 0 ? "bg-muted/70" : "bg-muted/40",
        )}
        // Indentasi menandai kedalaman roll-down; dibatasi agar tetap terbaca di HP.
        style={{ marginInlineStart: `${Math.min(dalam, 3) * 12}px` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {dalam > 0 ? (
                <CornerDownRight className="size-3 shrink-0 text-muted-foreground" />
              ) : null}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] leading-[13px] font-semibold",
                  GAYA_LEVEL[goal.level],
                )}
              >
                {LABEL_LEVEL[goal.level]}
              </span>
              <p className="truncate text-sm leading-5 font-semibold">
                {goal.judul}
              </p>
            </div>
            <p className="tabular mt-0.5 text-[11px] leading-[14px] text-muted-foreground">
              {goal.pemilik}
              {goal.unit ? ` · ${goal.unit}` : ""}
              {goal.akun ? ` · ${goal.akun}` : ""}
              {status === "berjalan"
                ? ` · ${rupiahRingkas(goal.targetBulan)} bulan ini`
                : ""}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[11px] leading-[14px] font-medium text-info-text ring-1 ring-border-subtle">
              <CalendarRange className="size-3 shrink-0" />
              {goal.periode}
              {goal.jumlahBulan > 1 ? ` · ${goal.jumlahBulan} bulan` : ""}
            </p>
          </div>

          <div className="flex shrink-0 items-start gap-2">
            {status === "berjalan" ? (
              <span
                className={cn(
                  "tabular text-[13px] leading-[18px] font-bold",
                  kuat
                    ? "text-ok-text"
                    : sedang
                      ? "text-warn-text"
                      : "text-danger-text",
                )}
              >
                {persen(goal.rasio)}
              </span>
            ) : (
              <span className="text-[11px] leading-[18px] font-semibold text-muted-foreground">
                {status === "belum" && goal.mulai
                  ? `Mulai ${bulanPendek(goal.mulai)}`
                  : goal.mulai
                    ? `Berakhir ${bulanPendek(
                        akhirPeriode(goal.mulai, goal.jumlahBulan),
                      )}`
                    : null}
              </span>
            )}
            {pilihan ? (
              <DialogUbahGoal
                goal={goal}
                pilihan={pilihan}
                acuan={acuan}
                kecualiInduk={idCabang(goal)}
              />
            ) : null}
          </div>
        </div>

        {status === "berjalan" ? (
          <BarCapaian
            rasio={goal.rasio}
            label={`Capaian ${goal.judul}`}
            warna={kuat ? "bg-ok" : sedang ? "bg-warn" : "bg-danger"}
            tinggi="h-1.5"
            className="mt-2.5 bg-card"
          />
        ) : null}

        <p className="tabular mt-1.5 text-[11px] leading-[14px] text-muted-foreground">
          Base {rupiahRingkas(goal.targetBase)} · Goal{" "}
          {rupiahRingkas(goal.targetGoal)} · Stretch{" "}
          {rupiahRingkas(goal.targetStretch)}
        </p>
      </div>

      {goal.anak.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {goal.anak.map((a) => (
            <Simpul
              key={a.id}
              goal={a}
              dalam={dalam + 1}
              acuan={acuan}
              pilihan={pilihan}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Pohon goal berjenjang: perusahaan → manager → unit → akun. */
export function PohonGoal({
  pohon,
  acuan,
  pilihan = null,
}: {
  pohon: SimpulGoal[];
  /** Tanggal hari ini, dasar status periode tiap goal. */
  acuan: string;
  /** Bahan dialog ubah; hanya diisi untuk CEO/Manager. */
  pilihan?: PilihanGoal | null;
}) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">Roll-down goal</h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Satu goal perusahaan diturunkan bertahap sampai ke akun.
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle">
          <Target className="size-4" />
        </span>
      </div>

      {pohon.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada goal aktif. CEO atau Manager bisa membuatnya.
        </p>
      ) : (
        <ul className="space-y-2 px-5">
          {pohon.map((g) => (
            <Simpul
              key={g.id}
              goal={g}
              dalam={0}
              acuan={acuan}
              pilihan={pilihan}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
