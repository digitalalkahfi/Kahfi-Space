import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tanggalPendek } from "@/lib/format";
import type { IzinSaya } from "@/lib/data/absensi";

const LABEL_JENIS: Record<IzinSaya["jenis"], string> = {
  sakit: "Sakit",
  izin: "Izin terencana",
  jam: "Izin berjam",
};

const GAYA_STATUS: Record<
  IzinSaya["persetujuan"],
  { label: string; kelas: string }
> = {
  diajukan: {
    label: "Menunggu keputusan",
    kelas: "bg-warn-fill text-warn-text",
  },
  disetujui: { label: "Disetujui", kelas: "bg-ok-fill text-ok-text" },
  ditolak: { label: "Ditolak", kelas: "bg-danger-fill text-danger-text" },
};

function rentang(p: IzinSaya) {
  if (p.jenis === "jam") {
    return `${tanggalPendek(p.tanggal)} · ${p.jamMulai?.slice(0, 5)}–${p.jamSelesai?.slice(0, 5)}`;
  }
  return p.sampai !== p.tanggal
    ? `${tanggalPendek(p.tanggal)} – ${tanggalPendek(p.sampai)}`
    : tanggalPendek(p.tanggal);
}

/**
 * Pengajuan izin milik sendiri beserta keputusannya.
 *
 * Alasan penolakan ditampilkan apa adanya: tanpa itu, pengaju hanya tahu
 * bahwa izinnya ditolak, dan akan mengajukan hal yang sama lagi.
 */
export function RiwayatIzin({ daftar }: { daftar: IzinSaya[] }) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">Pengajuanku</h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {daftar.length === 0
              ? "Belum ada pengajuan yang tercatat."
              : "Status terakhir tiap pengajuan yang kamu kirim."}
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle">
          <Clock3 className="size-4" />
        </span>
      </div>

      {daftar.length > 0 ? (
        <ul className="space-y-2 px-5">
          {daftar.map((p) => (
            <li key={p.id} className="rounded-2xl bg-muted/60 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] leading-[18px] font-semibold">
                    {LABEL_JENIS[p.jenis]}
                  </p>
                  <p className="tabular text-[11px] leading-[14px] text-muted-foreground">
                    {rentang(p)}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] leading-[13px] font-semibold",
                    GAYA_STATUS[p.persetujuan].kelas,
                  )}
                >
                  {p.persetujuan === "disetujui" ? (
                    <CheckCircle2 className="size-2.5" />
                  ) : p.persetujuan === "ditolak" ? (
                    <XCircle className="size-2.5" />
                  ) : (
                    <Clock3 className="size-2.5" />
                  )}
                  {GAYA_STATUS[p.persetujuan].label}
                </span>
              </div>

              {p.alasan ? (
                <p className="mt-1.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  {p.alasan}
                </p>
              ) : null}

              {p.persetujuan === "ditolak" && p.alasanKeputusan ? (
                <p className="mt-2 rounded-xl bg-danger-fill px-3 py-2 text-[11px] leading-[14px] text-pretty text-danger-text">
                  <span className="font-semibold">Alasan penolakan</span>
                  {p.diputusOleh ? ` · ${p.diputusOleh}` : ""}:{" "}
                  {p.alasanKeputusan}
                </p>
              ) : null}

              {p.persetujuan === "disetujui" && p.jenis === "jam" ? (
                <p className="mt-2 text-[11px] leading-[14px] text-muted-foreground">
                  Jam efektif masukmu hari itu bergeser ke{" "}
                  {p.jamSelesai?.slice(0, 5)}; telat sudah dihitung ulang.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
