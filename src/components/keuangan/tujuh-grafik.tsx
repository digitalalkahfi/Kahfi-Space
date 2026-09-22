import { Card } from "@/components/ui/card";
import {
  GrafikGaris,
  GrafikKomposisi,
} from "@/components/shared/grafik-dasar";
import { KontribusiUnitKartu } from "@/components/keuangan/kontribusi-unit";
import type { SeriGrafik } from "@/lib/grafik-finance";
import type { KontribusiUnit } from "@/lib/keuangan";

/**
 * Tujuh grafik utama dasbor Finance (PRD Fase 4).
 *
 * Enam pertama membaca arah antar periode; yang ketujuh membaca
 * komposisi di dalam satu periode — dari unit mana pendapatannya
 * datang. Semuanya memakai angka yang sama dengan kartu KPI.
 */
export function TujuhGrafik({
  seri,
  kontribusi,
  satuan,
  labelPeriode,
}: {
  seri: SeriGrafik;
  kontribusi: KontribusiUnit[];
  /** "bulan", "pekan", … — mengikuti filter periode yang aktif. */
  satuan: string;
  labelPeriode: string;
}) {
  return (
    <div className="space-y-4">
      <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
        <div className="px-5">
          <h2 className="text-base leading-6 font-semibold">
            Tren keuangan enam {satuan} terakhir
          </h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Titik terakhir adalah{" "}
            <span className="font-semibold text-foreground">
              {labelPeriode}
            </span>{" "}
            — periode yang sedang dibuka. Satu angka tidak menunjukkan arah;
            enam titik cukup untuk membedakan perubahan sesaat dari
            kecenderungan.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 px-5 lg:grid-cols-2">
          <GrafikGaris
            judul="Revenue"
            keterangan="Uang masuk yang sudah diterima."
            titik={seri.revenue}
          />
          <GrafikGaris
            judul="Gross profit"
            keterangan="Setelah direct cost dan creator share."
            titik={seri.grossProfit}
          />
          <GrafikGaris
            judul="Operating profit"
            keterangan="Sebelum penyusutan diperhitungkan."
            titik={seri.labaOperasi}
          />
          <GrafikGaris
            judul="Net profit"
            keterangan="Setelah penyusutan — dasar pembagian laba."
            titik={seri.labaBersih}
          />
          <GrafikGaris
            judul="NPM"
            keterangan="Laba bersih terhadap net revenue."
            titik={seri.npm}
            satuan="persen"
          />
          <GrafikGaris
            judul="Operating cash flow"
            keterangan="Kas dari operasi, sebelum aset dan dividen."
            titik={seri.arusKas}
          />

          <div className="lg:col-span-2">
            <GrafikKomposisi
              judul="Komposisi biaya"
              keterangan="Direct cost, creator share, beban, dan penyusutan — empat hal yang dulu tercampur."
              kolom={seri.komposisi}
            />
          </div>
        </div>
      </Card>

      <KontribusiUnitKartu daftar={kontribusi} />
    </div>
  );
}
