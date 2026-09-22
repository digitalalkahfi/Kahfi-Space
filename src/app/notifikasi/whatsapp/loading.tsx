import { KeadaanMemuat } from "@/components/shared/keadaan";

/** Kerangka riwayat pengiriman WhatsApp selagi dimuat. */
export default function MemuatKirimWa() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-4 lg:px-8 lg:pt-6">
      <div className="h-7 w-56 animate-pulse rounded-full bg-muted" />
      <div className="h-8 w-72 animate-pulse rounded-full bg-muted" />
      <KeadaanMemuat label="Memuat riwayat pengiriman" baris={4} />
    </div>
  );
}
