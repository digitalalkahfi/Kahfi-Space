import { KeadaanMemuat } from "@/components/shared/keadaan";

/** Kerangka halaman preferensi selagi pengaturannya dibaca. */
export default function MemuatPreferensi() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-4 lg:px-8 lg:pt-6">
      <div className="h-7 w-56 animate-pulse rounded-full bg-muted" />
      <div className="h-8 w-64 animate-pulse rounded-full bg-muted" />
      <KeadaanMemuat label="Memuat preferensi" baris={5} />
    </div>
  );
}
