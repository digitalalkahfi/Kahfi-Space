import { KeadaanMemuat } from "@/components/shared/keadaan";

/** Kerangka dasbor Analitik GMV selagi laporannya dibaca. */
export default function MemuatGmv() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-4 lg:px-8 lg:pt-6">
      <div className="h-7 w-44 animate-pulse rounded-full bg-muted" />
      <KeadaanMemuat label="Memuat ringkasan" baris={2} />
      <KeadaanMemuat label="Memuat grafik tren" baris={2} />
      <KeadaanMemuat label="Memuat rincian harian" baris={4} />
    </div>
  );
}
