import { Archive } from "lucide-react";
import { tanggalPanjang } from "@/lib/format";
import type { StatusLama } from "@/lib/data/migrasi";

/**
 * Pengingat bahwa K-Space lama sudah dibekukan.
 *
 * Ditampilkan kepada semua orang, bukan hanya pengurus migrasi: yang
 * berisiko salah tempat mencatat justru mereka yang tidak mengikuti
 * urusan migrasi sama sekali.
 */
export function SpandukLama({ status }: { status: StatusLama }) {
  if (!status.readonly) return null;

  return (
    <div className="border-b border-border-subtle bg-accentmuted-fill">
      <p className="mx-auto flex max-w-[1400px] items-start gap-2 px-4 py-2 text-[11px] leading-[14px] text-pretty text-accentmuted-text lg:px-8">
        <Archive className="mt-0.5 size-3.5 shrink-0" />
        <span>
          K-Space lama sudah hanya-baca
          {status.pada ? ` sejak ${tanggalPanjang(status.pada)}` : ""}. Seluruh
          absensi, laporan harian, dan tugas dicatat di sini.
          {status.url ? (
            <>
              {" "}
              <a
                href={status.url}
                rel="noreferrer noopener"
                target="_blank"
                className="font-semibold underline"
              >
                Buka arsipnya
              </a>{" "}
              bila perlu melihat data lama.
            </>
          ) : null}
        </span>
      </p>
    </div>
  );
}
