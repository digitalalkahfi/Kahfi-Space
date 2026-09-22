import { Card } from "@/components/ui/card";

/**
 * Kerangka dasbor Finance selagi datanya dimuat.
 *
 * Bentuknya mengikuti isi sebenarnya — sub-menu, filter periode, grid
 * KPI, lalu grafik — supaya halaman tidak melompat saat isinya datang.
 */
export default function MemuatKeuangan() {
  return (
    <div
      role="status"
      aria-label="Memuat dasbor keuangan"
      className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-4 lg:px-8 lg:pt-6"
    >
      <div className="h-8 w-40 animate-pulse rounded-full bg-muted" />
      <div className="h-8 w-full animate-pulse rounded-full bg-muted" />

      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="space-y-3 px-5">
          <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-muted"
              />
            ))}
          </div>
        </div>
      </Card>

      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="grid grid-cols-1 gap-2 px-5 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </Card>
    </div>
  );
}
