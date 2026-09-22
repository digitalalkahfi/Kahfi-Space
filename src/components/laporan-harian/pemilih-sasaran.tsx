"use client";

import { CheckCircle2, Store, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { rupiahRingkas } from "@/lib/format";
import type { SasaranLaporan } from "@/lib/types";

export function kunciSasaran(s: SasaranLaporan) {
  return s.jenis === "akun" ? `akun:${s.akun.id}` : `unit:${s.unitId}`;
}

export function labelSasaran(s: SasaranLaporan) {
  return s.jenis === "akun" ? s.akun.username : s.nama;
}

export function targetSasaran(s: SasaranLaporan) {
  return s.jenis === "akun" ? s.akun.targetHarian : s.targetHarian;
}

/**
 * Pemilih sasaran laporan: akun affiliator yang dipegang PIC, atau unit
 * yang dipimpin Leader. Sasaran yang sudah dilapor hari ini dikunci supaya
 * tidak dobel — laporan unik per (akun/unit, tanggal) (PRD §6).
 */
export function PemilihSasaran({
  sasaran,
  nilai,
  onUbah,
  sudahDilaporkan,
}: {
  sasaran: SasaranLaporan[];
  nilai: string;
  onUbah: (kunci: string) => void;
  sudahDilaporkan: string[];
}) {
  const akun = sasaran.filter((s) => s.jenis === "akun");
  const unit = sasaran.filter((s) => s.jenis === "unit");
  const aktif = sasaran.find((s) => kunciSasaran(s) === nilai);

  const baris = (s: SasaranLaporan) => {
    const kunci = kunciSasaran(s);
    const terkunci = sudahDilaporkan.includes(kunci);
    return (
      <SelectItem key={kunci} value={kunci} disabled={terkunci}>
        <span className="flex w-full items-center gap-2">
          <span className="min-w-0 flex-1 truncate">{labelSasaran(s)}</span>
          {s.jenis === "akun" && s.akun.program ? (
            <span className="shrink-0 rounded-full bg-accentmuted-fill px-1.5 py-0.5 text-[10px] leading-[13px] font-semibold text-accentmuted-text">
              {s.akun.program}
            </span>
          ) : null}
          {terkunci ? (
            <span className="flex shrink-0 items-center gap-1 text-[10px] leading-[13px] font-semibold text-ok-text">
              <CheckCircle2 className="size-3" />
              Sudah dilapor
            </span>
          ) : (
            <span className="tabular shrink-0 text-[10px] leading-[13px] text-muted-foreground">
              {rupiahRingkas(targetSasaran(s))}
            </span>
          )}
        </span>
      </SelectItem>
    );
  };

  if (sasaran.length === 0) {
    return (
      <p className="rounded-xl bg-warn-fill px-4 py-3 text-[13px] leading-[18px] text-warn-text">
        Belum ada akun atau unit yang bisa kamu laporkan. Hubungi atasanmu untuk
        penetapan PIC akun.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <Select value={nilai} onValueChange={onUbah}>
        <SelectTrigger id="sasaran" className="h-12 w-full rounded-xl">
          <SelectValue placeholder="Pilih akun atau unit" />
        </SelectTrigger>
        <SelectContent>
          {akun.length > 0 ? (
            <SelectGroup>
              <SelectLabel className="flex items-center gap-1.5">
                <Store className="size-3" />
                Akun yang kamu pegang
              </SelectLabel>
              {akun.map(baris)}
            </SelectGroup>
          ) : null}

          {unit.length > 0 ? (
            <SelectGroup>
              <SelectLabel className="flex items-center gap-1.5">
                <Users className="size-3" />
                Unit yang kamu pimpin
              </SelectLabel>
              {unit.map(baris)}
            </SelectGroup>
          ) : null}
        </SelectContent>
      </Select>

      {aktif ? (
        <p
          className={cn("text-[11px] leading-[14px]", "text-muted-foreground")}
        >
          {aktif.jenis === "akun"
            ? `PIC ${aktif.akun.picNama} · ${aktif.akun.platform}${
                aktif.akun.program ? ` · program ${aktif.akun.program}` : ""
              }`
            : "Laporan tingkat unit — diisi oleh Leader"}
        </p>
      ) : null}
    </div>
  );
}
