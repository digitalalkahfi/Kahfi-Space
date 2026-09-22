import Link from "next/link";
import { Boxes, MapPin, TriangleAlert, UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { rupiahRingkas, tanggalPendek } from "@/lib/format";
import {
  GAYA_STATUS_ASET,
  LABEL_STATUS_ASET,
  akumulasiPenyusutan,
  nilaiBuku,
  sisaMasaManfaat,
  sudahLepas,
  type Aset,
} from "@/lib/aset";
import { KeadaanKosong } from "@/components/shared/keadaan";

function BarisAset({
  aset: a,
  sampai,
  bolehLihatNilai,
}: {
  aset: Aset;
  sampai: string;
  bolehLihatNilai: boolean;
}) {
  const gaya = GAYA_STATUS_ASET[a.status];
  const buku = nilaiBuku(a, sampai);
  const susut = akumulasiPenyusutan(a, sampai);
  const sisa = sisaMasaManfaat(a, sampai);
  const terpakai =
    a.nilaiPerolehan > 0 ? Math.min(100, (susut / a.nilaiPerolehan) * 100) : 0;

  return (
    <li className="rounded-2xl bg-muted/50 p-3.5">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-2xl",
            a.status === "hilang"
              ? "bg-danger-fill text-danger-text"
              : "bg-card text-muted-foreground",
          )}
        >
          {a.status === "hilang" ? (
            <TriangleAlert className="size-4" />
          ) : (
            <Boxes className="size-4" />
          )}
        </span>

        <div className="min-w-[10rem] flex-1">
          <p className="truncate text-sm leading-5 font-semibold">
            <Link href={`/aset/${a.kode}`} className="hover:underline">
              {a.nama}
            </Link>
          </p>
          <p className="truncate font-mono text-[11px] leading-[14px] text-muted-foreground">
            {a.kode}
          </p>
          <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
            {a.kategori} · {a.unitNama} · diperoleh {tanggalPendek(a.tanggal)}
          </p>
        </div>

        {bolehLihatNilai ? (
          <div className="tabular shrink-0 text-right">
            <p className="text-sm leading-5 font-semibold">
              {sudahLepas(a.status) ? "—" : rupiahRingkas(buku)}
            </p>
            <p className="text-[11px] leading-[14px] text-muted-foreground">
              dari {rupiahRingkas(a.nilaiPerolehan)}
            </p>
          </div>
        ) : null}

        <span
          className={cn(
            "inline-flex h-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] leading-[14px] font-semibold",
            gaya.kelas,
          )}
        >
          <span className={cn("size-1.5 rounded-full", gaya.titik)} />
          {LABEL_STATUS_ASET[a.status]}
        </span>
      </div>

      {bolehLihatNilai && !sudahLepas(a.status) && a.masaManfaat > 0 ? (
        <div
          className="mt-2.5 h-1 overflow-hidden rounded-full bg-border-subtle"
          role="img"
          aria-label={`${Math.round(terpakai)} persen nilai sudah disusutkan`}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
              sisa === 0 ? "bg-muted-foreground/40" : "bg-secondary",
            )}
            style={{ width: `${terpakai}%` }}
          />
        </div>
      ) : null}

      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-[14px] text-pretty text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <UserRound className="size-3" />
          {a.pemegangNama ?? "Belum ada pemegang"}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3" />
          {a.lokasi || "—"}
        </span>
        {bolehLihatNilai && !sudahLepas(a.status) ? (
          <span>
            {a.masaManfaat === 0
              ? "tidak disusutkan"
              : sisa === 0
                ? "masa manfaat habis"
                : `sisa masa manfaat ${sisa} bulan`}
          </span>
        ) : null}
        {a.berakhir ? <span>sejak {tanggalPendek(a.berakhir)}</span> : null}
      </p>

      {a.catatan ? (
        <p className="mt-1.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
          {a.catatan}
        </p>
      ) : null}
    </li>
  );
}

/** Daftar aset beserta nilai buku, pemegang, dan keadaannya. */
export function DaftarAset({
  daftar,
  sampai,
  bolehLihatNilai,
  judul,
}: {
  daftar: Aset[];
  sampai: string;
  bolehLihatNilai: boolean;
  judul: string;
}) {
  if (daftar.length === 0) {
    return (
      <KeadaanKosong
        ikon={<Boxes className="size-4" />}
        judul="Tidak ada aset yang cocok dengan saringan ini"
        pesan="Longgarkan saringan, atau catat aset baru lewat transaksi berjenis aset yang sudah dibayar."
      />
    );
  }

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <h2 className="px-5 text-base leading-6 font-semibold">{judul}</h2>

      <ul className="space-y-2 px-5">
        {daftar.map((a) => (
          <BarisAset
            key={a.id}
            aset={a}
            sampai={sampai}
            bolehLihatNilai={bolehLihatNilai}
          />
        ))}
      </ul>
    </Card>
  );
}
