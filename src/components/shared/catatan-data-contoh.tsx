import { modeData } from "@/lib/supabase/config";

/**
 * Penanda bahwa angka di layar berasal dari data contoh.
 *
 * Sejak migrasi 0097 (transaksi) dan 0102 (aset) keduanya punya tabelnya
 * sendiri, jadi di mode Supabase angkanya sungguhan dan catatan ini tidak
 * muncul. Di mode demo ia tetap perlu dikatakan di layar: angka uang
 * adalah hal yang paling mudah disalahartikan sebagai kebenaran.
 */
export function CatatanDataContoh({
  pesan = "Angka di halaman ini berasal dari data contoh. Mode demo tidak menyimpan apa pun — transaksi yang diajukan diperiksa, tetapi tidak tersimpan.",
}: {
  pesan?: string;
}) {
  if (modeData() !== "demo") return null;

  return (
    <p className="rounded-2xl bg-warn-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-warn-text">
      {pesan}
    </p>
  );
}
