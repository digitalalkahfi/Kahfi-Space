import { cn } from "@/lib/utils";
import type { AnggotaTim } from "@/lib/types";

/**
 * Lencana status keaktifan.
 *
 * Hanya muncul saat seseorang nonaktif: menandai setiap orang dengan
 * "aktif" akan membuat layar penuh lencana yang tidak berarti apa-apa.
 * Yang perlu terlihat justru pengecualiannya.
 */
export function LencanaStatus({
  status,
  className,
}: {
  status: AnggotaTim["status"];
  className?: string;
}) {
  if (status === "aktif") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-muted-foreground",
        className,
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
      nonaktif
    </span>
  );
}
