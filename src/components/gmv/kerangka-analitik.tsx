import { Card } from "@/components/ui/card";

/**
 * Kerangka isi dasbor GMV selagi periode barunya dimuat.
 *
 * Bentuknya mengikuti isi aslinya — kartu ringkasan, grafik, lalu tabel
 * rincian — supaya mengganti periode tidak membuat halaman melompat.
 *
 * Terpisah dari `loading.tsx`: berkas itu hanya muncul saat rute ini
 * dibuka pertama kali, sedangkan mengganti periode adalah perubahan
 * searchParams yang tidak memicunya. Tanpa kerangka ini, menekan
 * "Tahunan" pada rentang yang besar terasa seperti aplikasi membeku.
 */
export function KerangkaAnalitik() {
  return (
    <div role="status" aria-label="Memuat periode" className="space-y-4">
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="space-y-3 px-5">
          <div className="h-4 w-36 animate-pulse rounded-full bg-muted" />
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-2xl bg-muted"
              />
            ))}
          </div>
          <div className="h-2 animate-pulse rounded-full bg-muted" />
        </div>
      </Card>

      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="space-y-2 px-5">
          <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
          <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        </div>
      </Card>

      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="space-y-2 px-5">
          <div className="h-4 w-28 animate-pulse rounded-full bg-muted" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </Card>

      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="space-y-2 px-5">
          <div className="h-4 w-40 animate-pulse rounded-full bg-muted" />
          <div className="h-12 animate-pulse rounded-2xl bg-muted" />
        </div>
      </Card>
    </div>
  );
}
