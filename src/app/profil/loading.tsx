import { Card } from "@/components/ui/card";

/**
 * Kerangka halaman Profil Saya selagi datanya dimuat.
 *
 * Bentuknya mengikuti isi sebenarnya — label, kartu kepala dengan avatar,
 * lalu daftar data kepegawaian — supaya tata letak tidak melompat saat
 * isinya datang.
 */
export default function MemuatProfil() {
  return (
    <div
      role="status"
      aria-label="Memuat profil"
      className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-4 lg:px-8 lg:pt-6"
    >
      <div className="h-4 w-24 animate-pulse rounded-full bg-muted" />

      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="flex items-start gap-4 px-5">
          <div className="size-14 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-6 w-48 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-56 animate-pulse rounded-full bg-muted" />
            <div className="space-y-1.5 pt-1">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className="h-3 w-40 animate-pulse rounded-full bg-muted"
                />
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="space-y-3 px-5">
          <div className="h-4 w-40 animate-pulse rounded-full bg-muted" />
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </Card>
    </div>
  );
}
