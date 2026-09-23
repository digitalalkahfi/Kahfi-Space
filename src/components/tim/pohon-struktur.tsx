import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bilangan } from "@/lib/format";
import type { SimpulStruktur } from "@/lib/struktur";

/** Inisial dari nama, untuk avatar tanpa foto. */
function inisial(nama: string) {
  const bagian = nama.trim().split(/\s+/);
  return (bagian[0]?.[0] ?? "") + (bagian.at(-1)?.[0] ?? "");
}

function Simpul({ simpul }: { simpul: SimpulStruktur }) {
  return (
    <li>
      <div className="flex items-center gap-3 rounded-2xl bg-muted/50 px-3 py-2">
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="bg-card text-[11px] font-semibold text-muted-foreground uppercase">
            {inisial(simpul.nama)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] leading-[18px] font-semibold">
            {simpul.nama}
          </p>
          <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
            {simpul.jabatan}
            {simpul.departemen ? ` · ${simpul.departemen}` : ""}
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-muted-foreground ring-1 ring-border-subtle">
          {simpul.role}
        </span>

        {simpul.jumlahBawahan > 0 ? (
          <span className="tabular shrink-0 text-[11px] leading-[14px] text-muted-foreground">
            {bilangan(simpul.jumlahBawahan)} bawahan
          </span>
        ) : null}
      </div>

      {simpul.bawahan.length > 0 ? (
        // Garis kiri menggantikan garis penghubung sungguhan: pohon
        // dengan garis siku butuh ukuran pasti tiap kotak, dan nama
        // orang tidak pernah sama panjang.
        <ul className="mt-1.5 space-y-1.5 border-l border-border-subtle pl-3 sm:pl-4">
          {simpul.bawahan.map((b) => (
            <Simpul key={b.id} simpul={b} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Pohon pelaporan: siapa melapor kepada siapa.
 *
 * Diturunkan dari kolom atasan yang sama dengan garis pelaporan di
 * kartu anggota — bukan susunan kedua yang bisa melenceng darinya.
 * Yang nonaktif tidak ditampilkan: susunan organisasi menjawab keadaan
 * sekarang, dan riwayatnya sudah tersimpan di kartu masing-masing.
 */
export function PohonStruktur({
  pohon,
  tercecer = [],
}: {
  pohon: SimpulStruktur[];
  /** Anggota aktif yang tidak masuk pohon mana pun; tanda data berputar. */
  tercecer?: { id: string; nama: string; jabatan: string }[];
}) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">Garis pelaporan</h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Siapa melapor kepada siapa, diturunkan dari atasan yang tercatat
            pada tiap anggota.
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle">
          <Users className="size-4" />
        </span>
      </div>

      {pohon.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada anggota aktif yang bisa disusun.
        </p>
      ) : (
        <ul className="space-y-1.5 px-5">
          {pohon.map((s) => (
            <Simpul key={s.id} simpul={s} />
          ))}
        </ul>
      )}

      {tercecer.length > 0 ? (
        <div className="px-5">
          <p
            className={cn(
              "rounded-2xl bg-warn-fill px-3 py-2",
              "text-[11px] leading-[14px] text-pretty text-warn-text",
            )}
          >
            {tercecer.length} anggota tidak masuk susunan mana pun —{" "}
            {tercecer.map((t) => t.nama).join(", ")}. Biasanya karena garis
            atasannya berputar; betulkan lewat kartu anggotanya.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
