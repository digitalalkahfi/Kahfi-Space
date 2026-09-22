import { Card } from "@/components/ui/card";

/**
 * Kerangka halaman Budget selagi datanya dimuat.
 *
 * Bentuknya mengikuti isi sebenarnya — kartu ringkasan, saringan, lalu
 * daftar pos — supaya halaman tidak melompat saat isinya datang.
 */
export default function MemuatBudget() {
  return (
    <div
      role="status"
      aria-label="Memuat anggaran"
      className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-4 lg:px-8 lg:pt-6"
    >
      <div className="h-8 w-48 animate-pulse rounded-full bg-muted" />

      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="space-y-3 px-5">
          <div className="h-4 w-40 animate-pulse rounded-full bg-muted" />
          <div className="h-20 animate-pulse rounded-2xl bg-muted" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-16 animate-pulse rounded-2xl bg-muted" />
            <div className="h-16 animate-pulse rounded-2xl bg-muted" />
          </div>
        </div>
      </Card>

      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="space-y-2 px-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </Card>
    </div>
  );
}
