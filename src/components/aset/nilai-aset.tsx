import { Card } from "@/components/ui/card";
import { rupiahRingkas } from "@/lib/format";
import { nilaiAsetPer, ringkasAset, type Aset } from "@/lib/aset";

/**
 * Nilai perolehan dan nilai buku, dikelompokkan lalu ditotal.
 *
 * Dua angka ini hampir selalu dibaca berpasangan: perolehan menjawab
 * "berapa yang pernah dibelanjakan", nilai buku menjawab "berapa yang
 * masih tersisa di pembukuan". Selisihnya adalah penyusutan — biaya yang
 * sudah diakui tanpa uang keluar lagi.
 */
export function NilaiAset({
  daftar,
  sampai,
  kelompok = "kategori",
}: {
  daftar: Aset[];
  sampai: string;
  kelompok?: "kategori" | "unit";
}) {
  const baris = nilaiAsetPer(daftar, sampai, (a) =>
    kelompok === "unit" ? a.unitNama : a.kategori,
  );
  const r = ringkasAset(daftar, sampai);

  if (baris.length === 0) return null;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">
          Nilai perolehan & nilai buku
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Per {kelompok === "unit" ? "unit" : "kategori"}, hanya aset yang masih
          dimiliki.
        </p>
      </div>

      <div className="px-5">
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="tabular w-full min-w-[18rem] border-collapse text-[13px] leading-[18px]">
            <thead>
              <tr className="text-[11px] leading-[14px] text-muted-foreground">
                <th scope="col" className="py-2 text-left font-medium">
                  {kelompok === "unit" ? "Unit" : "Kategori"}
                </th>
                {/* Jumlah aset disembunyikan di layar sempit: yang dicari
                    di HP adalah angka rupiahnya. */}
                <th
                  scope="col"
                  className="hidden py-2 text-right font-medium sm:table-cell"
                >
                  Aset
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Perolehan
                </th>
                {/* Penyusutan ikut disembunyikan di HP: ia selisih dua kolom
                    lain, dan dua kolom itulah yang dicari. */}
                <th
                  scope="col"
                  className="hidden py-2 text-right font-medium sm:table-cell"
                >
                  Penyusutan
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Nilai buku
                </th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => (
                <tr key={b.label} className="border-t border-border-subtle">
                  <th
                    scope="row"
                    className="py-2.5 pr-3 text-left font-medium text-pretty"
                  >
                    {b.label}
                  </th>
                  <td className="hidden py-2.5 text-right text-muted-foreground sm:table-cell">
                    {b.jumlah}
                  </td>
                  <td className="py-2.5 text-right text-muted-foreground">
                    {rupiahRingkas(b.nilaiPerolehan)}
                  </td>
                  <td className="hidden py-2.5 text-right text-muted-foreground sm:table-cell">
                    −{rupiahRingkas(b.akumulasiPenyusutan)}
                  </td>
                  <td className="py-2.5 text-right font-semibold">
                    {rupiahRingkas(b.nilaiBuku)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <th scope="row" className="py-2.5 pr-3 text-left font-semibold">
                  Total
                </th>
                <td className="hidden py-2.5 text-right font-semibold sm:table-cell">
                  {r.dimiliki}
                </td>
                <td className="py-2.5 text-right font-semibold">
                  {rupiahRingkas(r.nilaiPerolehan)}
                </td>
                <td className="hidden py-2.5 text-right font-semibold sm:table-cell">
                  −{rupiahRingkas(r.akumulasiPenyusutan)}
                </td>
                <td className="py-2.5 text-right font-semibold">
                  {rupiahRingkas(r.nilaiBuku)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="mt-2 text-[11px] leading-[14px] text-pretty text-muted-foreground">
          Penyusutan garis lurus: nilai perolehan dikurangi nilai residu, dibagi
          masa manfaat, dihitung per bulan penuh. Aset yang dilepas atau hilang
          tidak lagi dihitung di sini.
        </p>
      </div>
    </Card>
  );
}
