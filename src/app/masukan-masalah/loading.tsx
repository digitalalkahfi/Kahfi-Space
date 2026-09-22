import { KeadaanMemuat } from "@/components/shared/keadaan";

/**
 * Kerangka modul Masukan & Masalah selagi datanya dimuat.
 *
 * Judul dan bar saringan digambar lebih dulu karena keduanya tidak
 * bergantung pada data; yang berkedip hanya bagian yang memang datang
 * belakangan, supaya tata letak tidak melompat.
 */
export default function MemuatMasukanMasalah() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-4 lg:px-8 lg:pt-6">
      <div className="h-8 w-48 animate-pulse rounded-full bg-muted" />
      <div className="h-8 w-full animate-pulse rounded-full bg-muted" />
      <KeadaanMemuat label="Memuat masukan & masalah" baris={4} />
    </div>
  );
}
