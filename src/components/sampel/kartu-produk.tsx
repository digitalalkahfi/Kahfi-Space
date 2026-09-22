import { Store, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { rupiahPenuh } from "@/lib/format";
import { KelolaLink } from "@/components/sampel/kelola-link";
import type { Sampel } from "@/lib/sampel";

function Baris({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-muted/50 p-3">
      <dt className="text-[11px] leading-[14px] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-[13px] leading-[18px] font-semibold text-pretty">
        {children}
      </dd>
    </div>
  );
}

/**
 * Identitas produk di balik sampel: brand/seller, harga, creator/PIC,
 * divisi, dan tautan etalasenya.
 *
 * Tautannya berdiri sendiri, tidak ikut dicetak di stiker QR — etalase
 * pindah jauh lebih sering daripada barangnya, dan mencetak ulang stiker
 * tiap kali linknya berubah adalah pekerjaan yang tidak perlu ada.
 */
export function KartuProduk({
  sampel,
  bolehKelola,
}: {
  sampel: Sampel;
  /** Mengganti tautan produk adalah wewenang CEO/Manager. */
  bolehKelola: boolean;
}) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <Store className="size-4 text-muted-foreground" />
          Produk
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Keterangan barang yang diwakili sampel ini.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-2 px-5 sm:grid-cols-2">
        <Baris label="Brand / seller">
          {sampel.brand || (
            <span className="font-normal text-muted-foreground">
              Belum diisi
            </span>
          )}
        </Baris>
        <Baris label="Harga">
          <span className="tabular">{rupiahPenuh(sampel.nilai)}</span>
        </Baris>
        <Baris label="Creator / PIC">
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="size-3.5 text-muted-foreground" />
            {sampel.pemegangNama || sampel.kreator || sampel.akunUsername || (
              <span className="font-normal text-muted-foreground">
                Belum ditentukan
              </span>
            )}
          </span>
        </Baris>
        <Baris label="Divisi">
          {sampel.unitNama}
          {sampel.kategori ? (
            <span className="font-normal text-muted-foreground">
              {" "}
              · {sampel.kategori}
            </span>
          ) : null}
        </Baris>
      </dl>

      <KelolaLink
        sampelId={sampel.id}
        tautanAwal={sampel.linkProduk}
        bolehUbah={bolehKelola}
      />
    </Card>
  );
}
