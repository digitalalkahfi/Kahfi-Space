"use client";

import { Button } from "@/components/ui/button";
import { DialogKonfirmasi } from "@/components/shared/dialog-konfirmasi";

/**
 * Contoh pemakaian `DialogKonfirmasi`.
 *
 * Berdiri sebagai komponen klien sendiri karena `onSetuju` adalah
 * fungsi: server component tidak bisa mengoper fungsi ke komponen
 * klien, dan halaman contoh pun harus mematuhi aturan itu apa adanya.
 */
export function ContohKonfirmasi() {
  return (
    <DialogKonfirmasi
      pemicu={
        <Button
          type="button"
          variant="outline"
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          Hapus contoh
        </Button>
      }
      judul="Hapus sampel SMP-0011?"
      pesan="Sampel ini belum pernah berpindah tangan, jadi tidak ada riwayat yang ikut hilang. Setelah dihapus, kodenya tidak dipakai ulang."
      labelYa="Hapus"
      berbahaya
      onSetuju={async () => ({
        ok: true as const,
        data: undefined,
        pesan: "Ini halaman contoh — tidak ada yang benar-benar dihapus.",
      })}
    />
  );
}
