import { LineChart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DialogCatatCapaian } from "@/components/grd/dialog-catat-capaian";
import { cn } from "@/lib/utils";
import { tanggalKalenderPendek } from "@/lib/format";
import { kelompokKurva, tampilNilaiGoal, type KelompokKurva } from "@/lib/goal";
import type { BarisKurva, TitikKurva } from "@/lib/data/kurva";

const JUDUL_KELOMPOK: Record<KelompokKurva, string> = {
  internal: "Blok Internal — SP 1.1",
  eksternal: "Blok Eksternal — SP 1.2",
  perusahaan: "Total Al-Kahfi Corp",
  lain: "Lainnya",
};

const URUTAN_KELOMPOK: KelompokKurva[] = [
  "internal",
  "eksternal",
  "perusahaan",
  "lain",
];

function Sel({
  baris,
  titik,
  acuan,
}: {
  baris: BarisKurva;
  titik: TitikKurva;
  acuan: string;
}) {
  const lewat = titik.tanggal <= acuan;
  // Baris GMV terisi otomatis dari laporan harian; bila laporannya belum
  // memuat akun/unit baris itu, AKTUAL diisi manual seperti baris jumlah.
  const bolehIsi = titik.manual && baris.bolehIsi && lewat;
  const gmvManual = baris.sumber === "gmv" && titik.manual;

  return (
    <td className="px-2 py-2 align-top">
      <span className="tabular block text-[11px] leading-[14px] text-muted-foreground">
        {tampilNilaiGoal(titik.target, baris.satuan)}
      </span>
      <span
        className={cn(
          "tabular block text-[13px] leading-[18px] font-semibold",
          titik.status === "hijau" && "text-ok-text",
          titik.status === "merah" && "text-danger-text",
          titik.aktual === null && "text-muted-foreground",
        )}
      >
        {titik.aktual === null
          ? lewat
            ? "belum diisi"
            : "—"
          : tampilNilaiGoal(titik.aktual, baris.satuan)}
      </span>
      {titik.status ? (
        <span
          className={cn(
            "mt-0.5 inline-block rounded-full px-1.5 py-px text-[9px] leading-[12px] font-bold tracking-wide",
            titik.status === "hijau"
              ? "bg-ok-fill text-ok-text"
              : "bg-danger-fill text-danger-text",
          )}
        >
          {titik.status === "hijau" ? "HIJAU" : "MERAH"}
        </span>
      ) : null}
      {gmvManual && lewat ? (
        <span
          className="mt-0.5 block text-[9px] leading-[12px] text-muted-foreground"
          title="Laporan harian belum memuat baris ini; AKTUAL diisi manual"
        >
          manual
        </span>
      ) : null}
      {bolehIsi ? (
        <div className="mt-1">
          <DialogCatatCapaian
            ukuranId={baris.ukuranId}
            judul={`${baris.kode} ${baris.judul}`}
            satuan={baris.satuan}
            acuan={acuan}
            tanggalTetap={titik.tanggal}
            nilaiAwal={titik.aktual}
            label={titik.aktual === null ? "Isi" : "Ubah"}
            kecil
          />
        </div>
      ) : null}
    </td>
  );
}

/**
 * Kurva WRM: target kumulatif yang harus sudah tercapai tiap Sabtu,
 * aktualnya, dan statusnya — padanan bagian B sheet "Target & Kurva WRM".
 * Baris GMV terisi sendiri dari laporan harian — bila laporannya belum ada,
 * AKTUAL diisi manual; baris jumlah diisi tiap Sabtu oleh Manager atau
 * Leader divisinya.
 */
export function TabelKurva({
  daftar: semua,
  acuan,
}: {
  daftar: BarisKurva[];
  acuan: string;
}) {
  // Ukuran tanpa titik (mis. goal per akun) bukan baris kurva.
  const daftar = semua.filter((b) => b.titik.length > 0);
  const tanggal = [
    ...new Set(daftar.flatMap((b) => b.titik.map((t) => t.tanggal))),
  ].sort();

  const kelompok = URUTAN_KELOMPOK.map((k) => ({
    k,
    baris: daftar.filter((b) => kelompokKurva(b.kode) === k),
  })).filter((g) => g.baris.length > 0);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">Kurva mingguan</h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Angka kecil = target kumulatif; angka tebal = aktual. HIJAU bila
            aktual ≥ target.
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle">
          <LineChart className="size-4" />
        </span>
      </div>

      {daftar.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Kurva GRD bulan ini belum dimuat.
        </p>
      ) : (
        <div className="overflow-x-auto px-5">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card py-2 pr-3 text-[11px] leading-[14px] font-semibold text-muted-foreground">
                  Ukuran
                </th>
                {tanggal.map((t) => (
                  <th
                    key={t}
                    className="px-2 py-2 text-[11px] leading-[14px] font-semibold whitespace-nowrap text-muted-foreground"
                  >
                    Sab {tanggalKalenderPendek(t, acuan)}
                  </th>
                ))}
              </tr>
            </thead>
            {kelompok.map(({ k, baris }) => (
              <tbody key={k}>
                <tr>
                  <th
                    colSpan={tanggal.length + 1}
                    className="bg-muted/60 px-2 py-1.5 text-[11px] leading-[14px] font-semibold"
                  >
                    {JUDUL_KELOMPOK[k]}
                  </th>
                </tr>
                {baris.map((b) => (
                  <tr
                    key={b.ukuranId}
                    className="border-b border-border-subtle"
                  >
                    <th
                      scope="row"
                      className="sticky left-0 z-10 max-w-[220px] bg-card py-2 pr-3 align-top"
                    >
                      <span className="block text-[13px] leading-[18px] font-semibold">
                        {b.kode.startsWith("T.") ? "" : `${b.kode} `}
                        {b.judul}
                      </span>
                      <span className="block text-[11px] leading-[14px] font-normal text-muted-foreground">
                        {b.pic || "—"}
                        {b.sumber === "isian"
                          ? " · diisi tiap Sabtu"
                          : " · dari laporan harian"}
                      </span>
                    </th>
                    {tanggal.map((t) => {
                      const titik = b.titik.find((x) => x.tanggal === t);
                      return titik ? (
                        <Sel key={t} baris={b} titik={titik} acuan={acuan} />
                      ) : (
                        <td key={t} className="px-2 py-2 text-muted-foreground">
                          —
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </Card>
  );
}
