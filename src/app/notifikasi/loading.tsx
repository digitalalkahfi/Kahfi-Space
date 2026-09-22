import { Card } from "@/components/ui/card";

/**
 * Kerangka pusat notifikasi selagi daftarnya dimuat.
 *
 * Bentuknya mengikuti isi aslinya — kartu per kelompok waktu, tiap
 * baris beravatar bulat — supaya daftarnya tidak melompat saat datang.
 */
export default function MemuatNotifikasi() {
  return (
    <div
      role="status"
      aria-label="Memuat notifikasi"
      className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-4 lg:px-8 lg:pt-6"
    >
      <div className="space-y-1.5">
        <div className="h-7 w-40 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-56 animate-pulse rounded-full bg-muted" />
      </div>

      {[3, 2].map((baris, i) => (
        <Card key={i} className="rounded-3xl shadow-card ring-border-subtle">
          <div className="space-y-2 px-5">
            <div className="h-3 w-20 animate-pulse rounded-full bg-muted" />
            {Array.from({ length: baris }, (_, j) => (
              <div key={j} className="flex items-start gap-3">
                <div className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-3 w-3/5 animate-pulse rounded-full bg-muted" />
                  <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-muted" />
                  <div className="h-2.5 w-28 animate-pulse rounded-full bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
