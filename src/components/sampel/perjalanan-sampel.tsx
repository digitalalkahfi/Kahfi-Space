import { MapPin, Repeat, TriangleAlert, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahPenuh, tanggalPendek } from "@/lib/format";
import {
  DI_LUAR,
  LABEL_STATUS_SAMPEL,
  ringkasPerjalanan,
  type KejadianSampel,
  type Sampel,
} from "@/lib/sampel";

function Angka({
  label,
  nilai,
  keterangan,
  Ikon,
  waspada = false,
}: {
  label: string;
  nilai: string;
  keterangan: string;
  Ikon: typeof Repeat;
  waspada?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-3",
        waspada ? "bg-danger-fill" : "bg-muted/50",
      )}
    >
      <dt
        className={cn(
          "flex items-center gap-1.5 text-[11px] leading-[14px]",
          waspada ? "text-danger-text" : "text-muted-foreground",
        )}
      >
        <Ikon className="size-3" />
        {label}
      </dt>
      <dd
        className={cn(
          "tabular text-lg leading-6 font-bold tracking-tight",
          waspada && "text-danger-text",
        )}
      >
        {nilai}
      </dd>
      <dd
        className={cn(
          "text-[11px] leading-[14px] text-pretty",
          waspada ? "text-danger-text" : "text-muted-foreground",
        )}
      >
        {keterangan}
      </dd>
    </div>
  );
}

/**
 * Perjalanan sampel: berapa kali berpindah, sudah berapa lama di
 * keadaannya sekarang, berapa lama ia di luar gudang, dan berapa nilai
 * yang sedang menempel padanya.
 *
 * Riwayat mentah di bawah menjawab "apa yang terjadi"; kartu ini
 * menjawab pertanyaan yang sebenarnya diajukan saat barang ditagih —
 * "sudah berapa lama di sana".
 */
export function PerjalananSampel({
  sampel,
  riwayat,
  acuan,
}: {
  sampel: Sampel;
  riwayat: KejadianSampel[];
  /** Waktu acuan aplikasi; di mode demo bukan hari ini. */
  acuan: string;
}) {
  const p = ringkasPerjalanan(riwayat, acuan);
  const diLuar = DI_LUAR.includes(sampel.status);
  const hilang = sampel.status === "hilang";

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">Perjalanan sampel</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          {p.perpindahan === 0
            ? "Belum pernah berpindah sejak dicatat."
            : `${p.perpindahan} perpindahan tercatat${
                p.pernahKeKreator ? ", termasuk sampai ke tangan kreator" : ""
              }.`}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2 px-5">
        <Angka
          label="Keadaan sekarang"
          nilai={p.lamaHari === 0 ? "Hari ini" : `${p.lamaHari} hari`}
          keterangan={
            p.sejak
              ? `${LABEL_STATUS_SAMPEL[sampel.status]} sejak ${tanggalPendek(p.sejak)}`
              : LABEL_STATUS_SAMPEL[sampel.status]
          }
          Ikon={MapPin}
          waspada={hilang}
        />

        <Angka
          label="Total di luar gudang"
          nilai={`${p.hariDiLuar} hari`}
          keterangan={
            diLuar
              ? "Masih berjalan — barangnya belum kembali."
              : "Sudah berhenti; barangnya tidak di luar."
          }
          Ikon={Repeat}
        />

        <Angka
          label="Nilai barang"
          nilai={rupiahPenuh(sampel.nilai)}
          keterangan={
            hilang
              ? "Hangus selama barangnya belum ditemukan."
              : diLuar
                ? "Sedang menempel pada barang yang di luar gudang."
                : "Aman di gudang."
          }
          Ikon={hilang ? TriangleAlert : Wallet}
          waspada={hilang}
        />

        {/* Nama kreator tetap tersimpan setelah barang kembali, jadi
            keadaannyalah yang menentukan — bukan sekadar ada-tidaknya
            nama. Tanpa itu barang di gudang tertulis "di tangan kreator". */}
        <Angka
          label="Dipegang"
          nilai={
            sampel.pemegangNama
              ? sampel.pemegangNama.split(" ")[0]
              : diLuar && sampel.kreator
                ? sampel.kreator
                : "Gudang"
          }
          keterangan={
            sampel.pemegangNama
              ? sampel.pemegangNama
              : diLuar && sampel.kreator
                ? "Ada di tangan kreator"
                : hilang
                  ? "Tidak diketahui sejak dinyatakan hilang"
                  : "Tidak sedang dibawa siapa pun"
          }
          Ikon={MapPin}
        />
      </dl>
    </Card>
  );
}
