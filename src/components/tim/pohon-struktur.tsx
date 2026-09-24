import { AlertTriangle, ArrowDown, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TombolRapikanStruktur } from "@/components/tim/tombol-rapikan-struktur";
import { cn } from "@/lib/utils";
import { bilangan } from "@/lib/format";
import { GAYA_PERAN } from "@/lib/gaya-peran";
import type { PeriksaStruktur } from "@/lib/atasan";
import type { SimpulStruktur } from "@/lib/struktur";

/** Urutan hierarki yang digambar; dipakai keterangan di atas bagan. */
const JENJANG = ["CEO", "Manager", "Leader", "Co-Leader", "Staff"] as const;

function Simpul({ simpul, anak }: { simpul: SimpulStruktur; anak: boolean }) {
  return (
    <li className="relative">
      {anak ? (
        // Siku dari garis tegak atasan ke tepi kiri kartu ini.
        <span
          aria-hidden
          className="absolute top-7 -left-5 h-px w-5 bg-border"
        />
      ) : null}

      <div
        className={cn(
          "rounded-2xl px-3 py-2.5 ring-1",
          simpul.role === "CEO"
            ? "bg-primary/5 ring-primary/30"
            : "bg-card ring-border-subtle",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-semibold",
              GAYA_PERAN[simpul.role],
            )}
          >
            {simpul.role}
          </span>
          <p className="min-w-0 flex-1 truncate text-[13px] leading-[18px] font-semibold">
            {simpul.nama}
          </p>
          {simpul.jumlahBawahan > 0 ? (
            <span className="tabular shrink-0 text-[11px] leading-[14px] text-muted-foreground">
              {bilangan(simpul.jumlahBawahan)} bawahan
            </span>
          ) : null}
        </div>
        <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
          {simpul.jabatan} · {simpul.unitNama}
          {simpul.departemen && simpul.departemen !== simpul.unitNama
            ? ` · ${simpul.departemen}`
            : ""}
        </p>
        {/* Atasan disebut di tiap kartu, bukan hanya tersirat dari
            indentasi: satu kartu yang disalin ke percakapan pun tetap
            menjawab "melapor ke siapa". */}
        <p className="text-[11px] leading-[14px] text-muted-foreground">
          {simpul.tingkat === 0 ? (
            simpul.role === "CEO" ? (
              "Puncak organisasi"
            ) : (
              <span className="text-warn-text">Belum tersambung ke atasan</span>
            )
          ) : (
            <>Melapor ke {simpul.atasanNama ?? "—"}</>
          )}
        </p>
      </div>

      {simpul.bawahan.length > 0 ? (
        <ul className="relative mt-2 ml-4 space-y-2 border-l border-border pl-5">
          {simpul.bawahan.map((b) => (
            <Simpul key={b.id} simpul={b} anak />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Bagan garis pelaporan: siapa melapor kepada siapa, dari atas ke bawah.
 *
 * Diturunkan dari kolom atasan yang sama dengan kartu anggota — bukan
 * susunan kedua yang bisa melenceng darinya. CEO digambar sebagai
 * puncak; siapa pun yang garisnya tidak sampai ke CEO ditaruh di bagian
 * tersendiri supaya terlihat, bukan ikut berjajar seolah setara CEO.
 * Yang nonaktif tidak ditampilkan: bagan ini menjawab keadaan sekarang.
 */
export function PohonStruktur({
  pohon,
  tercecer = [],
  periksa,
  bolehKelola = false,
}: {
  pohon: SimpulStruktur[];
  /** Anggota aktif yang tidak masuk pohon mana pun; tanda data berputar. */
  tercecer?: { id: string; nama: string; jabatan: string }[];
  /** Hasil pemeriksaan aturan; ada hanya untuk pengelola. */
  periksa?: PeriksaStruktur;
  bolehKelola?: boolean;
}) {
  const puncak = pohon.filter((s) => s.role === "CEO");
  const terputus = pohon.filter((s) => s.role !== "CEO");
  const perluDirapikan =
    periksa !== undefined &&
    (periksa.ubah.length > 0 || periksa.butuhKeputusan.length > 0);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">Garis pelaporan</h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Dibaca dari atas ke bawah: tiap kartu melapor ke kartu di atasnya.
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle">
          <Users className="size-4" />
        </span>
      </div>

      <ol
        aria-label="Jenjang hierarki"
        className="flex flex-wrap items-center gap-1 px-5 text-[11px] leading-[14px]"
      >
        {JENJANG.map((j, i) => (
          <li key={j} className="flex items-center gap-1">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-semibold",
                GAYA_PERAN[j],
              )}
            >
              {j}
            </span>
            {i < JENJANG.length - 1 ? (
              <ArrowDown
                className="size-3 -rotate-90 text-muted-foreground"
                aria-hidden
              />
            ) : null}
          </li>
        ))}
        <li className="text-muted-foreground">
          · Finance dan Staff tim manajemen melapor ke CEO atau Manager
        </li>
      </ol>

      {bolehKelola && periksa ? (
        <div className="px-5">
          {perluDirapikan ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-warn-fill px-3 py-2.5">
              <p className="text-[11px] leading-[14px] text-pretty text-warn-text">
                <AlertTriangle className="mr-1 inline size-3.5 align-text-bottom" />
                {periksa.ubah.length > 0
                  ? `${bilangan(periksa.ubah.length)} orang bisa disambungkan otomatis ke atasan yang sesuai aturan`
                  : "Tidak ada yang bisa disambungkan otomatis"}
                {periksa.butuhKeputusan.length > 0
                  ? `; ${bilangan(periksa.butuhKeputusan.length)} orang perlu dipilihkan atasannya lewat kartu anggota.`
                  : "."}
              </p>
              <TombolRapikanStruktur periksa={periksa} />
            </div>
          ) : (
            <p className="rounded-2xl bg-ok-fill px-3 py-2 text-[11px] leading-[14px] text-ok-text">
              Semua anggota aktif sudah punya atasan yang sesuai aturan.
            </p>
          )}
        </div>
      ) : null}

      {pohon.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada anggota aktif yang bisa disusun.
        </p>
      ) : (
        <div className="space-y-4 px-5">
          {puncak.length > 0 ? (
            <ul className="space-y-2">
              {puncak.map((s) => (
                <Simpul key={s.id} simpul={s} anak={false} />
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text">
              Belum ada CEO aktif; bagan tidak punya puncak.
            </p>
          )}

          {terputus.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-warn-text uppercase">
                Belum tersambung ke CEO ({bilangan(terputus.length)})
              </p>
              <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
                Garis pelaporan orang-orang ini terputus di atasnya — atasannya
                kosong atau sudah nonaktif. Bawahannya tetap digambar di bawah
                mereka.
              </p>
              <ul className="space-y-2">
                {terputus.map((s) => (
                  <Simpul key={s.id} simpul={s} anak={false} />
                ))}
              </ul>
            </div>
          ) : null}
        </div>
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
