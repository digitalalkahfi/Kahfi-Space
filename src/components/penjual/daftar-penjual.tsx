import { Card } from "@/components/ui/card";
import { KartuPenjual } from "@/components/penjual/kartu-penjual";
import type { CalonPic } from "@/components/penjual/dialog-penjual";
import { ringkasPenjual, type Penjual } from "@/lib/penjual";
import type { KodeUnit, PilihanOrganisasi } from "@/lib/types";

/** Berapa mitra yang sedang dijajaki dan berapa yang sudah jalan. */
export function RingkasanPenjual({ daftar }: { daftar: Penjual[] }) {
  const r = ringkasPenjual(daftar);
  const kotak = [
    { label: "Aktif", nilai: r.aktif, kelas: "bg-ok-fill text-ok-text" },
    {
      label: "Prospek",
      nilai: r.prospek,
      kelas: "bg-warn-fill text-warn-text",
    },
    {
      label: "Nonaktif",
      nilai: r.nonaktif,
      kelas: "bg-muted/50 text-muted-foreground",
    },
  ];

  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <dl className="tabular grid grid-cols-3 gap-2 px-5">
        {kotak.map((k) => (
          <div key={k.label} className={`rounded-2xl p-3 ${k.kelas}`}>
            <dt className="text-[11px] leading-[14px] font-semibold">
              {k.label}
            </dt>
            <dd className="text-[22px] leading-7 font-bold">{k.nilai}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function DaftarPenjual({
  daftar,
  pengguna,
  pilihan,
  anggota,
  unitTerkunci,
  acuan,
}: {
  daftar: Penjual[];
  pengguna: { id: string; role: string; unitId: KodeUnit | null };
  pilihan: PilihanOrganisasi;
  anggota: CalonPic[];
  unitTerkunci: KodeUnit | null;
  acuan: string;
}) {
  if (daftar.length === 0) {
    return (
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada mitra yang tercatat untuk cakupanmu.
        </p>
      </Card>
    );
  }

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <h2 className="px-5 text-base leading-6 font-semibold">Daftar mitra</h2>
      <ul className="space-y-2 px-5">
        {daftar.map((p) => (
          <KartuPenjual
            key={p.id}
            penjual={p}
            pengguna={pengguna}
            pilihan={pilihan}
            anggota={anggota}
            unitTerkunci={unitTerkunci}
            acuan={acuan}
          />
        ))}
      </ul>
    </Card>
  );
}
