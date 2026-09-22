import { KeadaanMemuat } from "@/components/shared/keadaan";

/** Kerangka halaman Keamanan Akun selagi sesinya dibaca. */
export default function MemuatKeamanan() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-4 lg:px-8 lg:pt-6">
      <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
      <div className="h-7 w-56 animate-pulse rounded-full bg-muted" />
      <KeadaanMemuat label="Memuat keamanan akun" baris={2} />
      <KeadaanMemuat label="Memuat aturan sandi" baris={2} />
    </div>
  );
}
