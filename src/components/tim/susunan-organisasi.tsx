import { Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { bilangan } from "@/lib/format";
import type { BarisDepartemen } from "@/lib/organisasi";

/**
 * Susunan departemen: unit yang menaunginya, programnya, jumlah anggota
 * aktif, dan siapa yang memegang peran tertinggi di sana.
 *
 * Di layar lebar berupa tabel; di ponsel kartu bertumpuk, karena empat
 * kolom di layar 375px membuat setiap selnya jadi satu kata per baris.
 */
export function SusunanOrganisasi({
  daftar,
  tanpaDepartemen = 0,
}: {
  daftar: BarisDepartemen[];
  /** Anggota aktif yang tidak menempel departemen mana pun. */
  tanpaDepartemen?: number;
}) {
  if (daftar.length === 0) return null;

  const isi = (d: BarisDepartemen) => ({
    unit: d.unit.length > 0 ? d.unit.join(", ") : "—",
    program: d.program.length > 0 ? d.program.join(", ") : "—",
    pj: d.penanggungJawab ?? "Belum ada",
  });

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">
            Susunan organisasi
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {daftar.length} departemen, beserta unit pelaporan dan programnya.
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle">
          <Building2 className="size-4" />
        </span>
      </div>

      <div className="hidden px-5 lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Departemen</TableHead>
              <TableHead>Unit pelaporan</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Penanggung jawab</TableHead>
              <TableHead className="text-right">Anggota</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {daftar.map((d) => {
              const t = isi(d);
              return (
                <TableRow key={d.nama}>
                  <TableCell className="font-medium">{d.nama}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.unit}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.program}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.pj}
                  </TableCell>
                  <TableCell className="tabular text-right font-semibold">
                    {bilangan(d.jumlahAktif)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Tanpa catatan ini, jumlah orang di tabel tidak akan pernah sama
          dengan jumlah anggota aktif di judul halaman, dan pembacanya
          akan mengira ada yang hilang. */}
      {tanpaDepartemen > 0 ? (
        <p className="px-5 text-[11px] leading-[14px] text-muted-foreground">
          {bilangan(tanpaDepartemen)} anggota aktif tidak menempel departemen
          mana pun — jajaran manajemen dan Finance memang lintas departemen.
        </p>
      ) : null}

      <ul className="space-y-2 px-5 lg:hidden">
        {daftar.map((d) => {
          const t = isi(d);
          return (
            <li key={d.nama} className="rounded-2xl bg-muted/60 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] leading-[18px] font-semibold">
                  {d.nama}
                </p>
                <span className="tabular shrink-0 rounded-full bg-card px-2 py-0.5 text-[11px] leading-[14px] font-semibold text-muted-foreground">
                  {bilangan(d.jumlahAktif)} orang
                </span>
              </div>
              <dl className="mt-1.5 space-y-0.5 text-[11px] leading-[14px] text-muted-foreground">
                <div className="flex gap-1.5">
                  <dt className="shrink-0">Unit:</dt>
                  <dd className="min-w-0">{t.unit}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="shrink-0">Program:</dt>
                  <dd className="min-w-0">{t.program}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="shrink-0">Penanggung jawab:</dt>
                  <dd className="min-w-0">{t.pj}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
