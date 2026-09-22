import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarCheck2,
  Gauge,
  Store,
  Target,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";

const MENU = [
  {
    href: "/grd/goal" as const,
    judul: "Goal & roll-down",
    ringkas: "Perusahaan → Manager → unit → akun, beserta anak tangga bulanan.",
    Ikon: Target,
    gaya: "bg-info-fill text-info-text",
  },
  {
    href: "/grd/lead-measure" as const,
    judul: "Lead measure",
    ringkas: "Papan skor langkah kunci dan entri hariannya.",
    Ikon: Activity,
    gaya: "bg-accentmuted-fill text-accentmuted-text",
  },
  {
    href: "/grd/kpi" as const,
    judul: "Definisi KPI",
    ringkas: "Indikator tiap jabatan pada skala 1.000.",
    Ikon: Gauge,
    gaya: "bg-warn-fill text-warn-text",
  },
  {
    href: "/grd/scorecard" as const,
    judul: "Scorecard KPI tim",
    ringkas: "Skor dan predikat tiap orang bulan berjalan.",
    Ikon: Users,
    gaya: "bg-ok-fill text-ok-text",
  },
  {
    href: "/grd/akun" as const,
    judul: "Kelola akun",
    ringkas: "Akun affiliator dan PIC yang mengisi laporan hariannya.",
    Ikon: Store,
    gaya: "bg-info-fill text-info-text",
  },
  {
    href: "/grd/mingguan" as const,
    judul: "Laporan mingguan",
    ringkas: "Matriks WRM per pekan dan penandaan merah beruntun.",
    Ikon: CalendarCheck2,
    gaya: "bg-muted text-muted-foreground",
  },
];

/** Pintu masuk ke seluruh modul GRD. */
export function NavigasiGrd() {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <h2 className="px-5 text-base leading-6 font-semibold">Modul GRD</h2>
      <ul className="space-y-0.5 px-5">
        {MENU.map(({ href, judul, ringkas, Ikon, gaya }) => (
          <li key={href}>
            <Link
              href={href}
              className="baris-interaktif flex items-center gap-3 rounded-2xl px-1 py-2.5"
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-2xl ${gaya}`}
              >
                <Ikon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] leading-[18px] font-semibold">
                  {judul}
                </span>
                <span className="block truncate text-[11px] leading-[14px] text-muted-foreground">
                  {ringkas}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
