import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bilangan, rupiahRingkas, tanggalKalenderPendek } from "@/lib/format";
import {
  LABEL_STATUS_HARI,
  type BarisHarian,
  type StatusHari,
} from "@/lib/detail-akun";

const GAYA_STATUS: Record<StatusHari, string> = {
  memenuhi: "bg-ok-fill text-ok-text",
  kurang: "bg-warn-fill text-warn-text",
  terlapor: "bg-info-fill text-info-text",
  "tidak-lapor": "bg-danger-fill text-danger-text",
  libur: "bg-muted text-muted-foreground",
};

function Status({ s }: { s: StatusHari }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap",
        GAYA_STATUS[s],
      )}
    >
      {LABEL_STATUS_HARI[s]}
    </span>
  );
}

/**
 * Tabel harian (§5.2 no. 6): terbaru di atas; kartu di HP.
 *
 * Kolom Komisi hanya ada bila `lihatKomisi` — dan halaman hanya memuat
 * komisinya bila boleh, jadi tanpa itu nilainya memang tidak ada.
 * Hari tanpa laporan menampilkan "—", bukan nol.
 */
export function TabelHarianAkun({
  baris,
  minimum,
  lihatKomisi,
  acuan,
}: {
  baris: BarisHarian[];
  minimum: number | null;
  lihatKomisi: boolean;
  acuan: string;
}) {
  const teksMinimum = minimum === null ? "—" : bilangan(minimum);
  const gmv = (b: BarisHarian) => (b.lapor ? rupiahRingkas(b.gmv) : "—");
  const komisi = (b: BarisHarian) =>
    b.komisi === null ? "—" : rupiahRingkas(b.komisi);
  const upload = (b: BarisHarian) =>
    b.upload === null ? "—" : bilangan(b.upload);

  return (
    <section className="space-y-2" aria-labelledby="judul-tabel-harian">
      <h2
        id="judul-tabel-harian"
        className="px-1 text-[15px] leading-5 font-semibold"
      >
        Hari demi hari
      </h2>

      {baris.length === 0 ? (
        <p className="rounded-2xl bg-muted/50 p-4 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada hari yang bisa ditampilkan di periode ini.
        </p>
      ) : (
        <>
          <Card className="hidden rounded-3xl shadow-card ring-border-subtle md:block">
            <div className="max-h-[480px] overflow-auto px-5">
              <table className="w-full text-[13px] leading-[18px]">
                <thead className="sticky top-0 bg-card">
                  <tr className="text-left text-[11px] leading-[14px] text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">Tanggal</th>
                    <th className="py-2 pr-3 text-right font-semibold">GMV</th>
                    {lihatKomisi ? (
                      <th className="py-2 pr-3 text-right font-semibold">
                        Komisi
                      </th>
                    ) : null}
                    <th className="py-2 pr-3 text-right font-semibold">
                      Upload
                    </th>
                    <th className="py-2 pr-3 text-right font-semibold">
                      Minimum
                    </th>
                    <th className="py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {baris.map((b) => (
                    <tr
                      key={b.tanggal}
                      className="border-t border-border-subtle"
                    >
                      <td className="tabular py-2 pr-3">
                        {tanggalKalenderPendek(b.tanggal, acuan)}
                      </td>
                      <td className="tabular py-2 pr-3 text-right font-semibold">
                        {gmv(b)}
                      </td>
                      {lihatKomisi ? (
                        <td className="tabular py-2 pr-3 text-right">
                          {komisi(b)}
                        </td>
                      ) : null}
                      <td className="tabular py-2 pr-3 text-right">
                        {upload(b)}
                      </td>
                      <td className="tabular py-2 pr-3 text-right text-muted-foreground">
                        {teksMinimum}
                      </td>
                      <td className="py-2">
                        <Status s={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <ul className="space-y-2 md:hidden">
            {baris.map((b) => (
              <li
                key={b.tanggal}
                className="space-y-2 rounded-3xl bg-card p-4 ring-1 ring-border-subtle"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="tabular text-sm leading-5 font-semibold">
                    {tanggalKalenderPendek(b.tanggal, acuan)}
                  </p>
                  <Status s={b.status} />
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] leading-4">
                  <dt className="text-muted-foreground">GMV</dt>
                  <dd className="tabular text-right font-semibold">{gmv(b)}</dd>
                  {lihatKomisi ? (
                    <>
                      <dt className="text-muted-foreground">Komisi</dt>
                      <dd className="tabular text-right">{komisi(b)}</dd>
                    </>
                  ) : null}
                  <dt className="text-muted-foreground">Upload / minimum</dt>
                  <dd className="tabular text-right">
                    {upload(b)} / {teksMinimum}
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
          {baris.some((b) => b.status === "terlapor") ? (
            <p className="px-1 text-[11px] leading-[14px] text-muted-foreground">
              Terlapor = ada laporan, tetapi hari itu tidak dinilai terhadap
              minimum (akun belum punya level, atau PIC tidak absen masuk).
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
