"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { tanggalPanjang } from "@/lib/format";
import {
  KETERANGAN_UBAHAN,
  ringkasPemetaan,
  type PemetaanEntitas,
} from "@/lib/pemetaan";
import { setujuiPemetaan, tarikPersetujuan } from "@/app/actions/migrasi";
import type { Persetujuan } from "@/lib/data/migrasi";
import { bilangan } from "@/lib/format";
import type { BarisRekapKelompok } from "@/lib/rekap-pemetaan";

/**
 * Satu entitas beserta pemetaan medannya dan status persetujuannya.
 *
 * Seluruh baris ditampilkan apa adanya — termasuk yang diisi nilai
 * bawaan dan yang sengaja dibuang — supaya yang menyetujui benar-benar
 * melihat apa yang ia setujui, bukan sekadar ringkasannya.
 */
export function KartuPemetaan({
  pemetaan,
  versi,
  persetujuan,
  bolehSetujui,
  medanAsing,
  adaDiEkspor = true,
  rekap,
  cuplikan,
}: {
  pemetaan: PemetaanEntitas;
  versi: string;
  persetujuan: Persetujuan | null;
  bolehSetujui: boolean;
  medanAsing: string[];
  /** Apakah kuncinya benar-benar ada di ekspor yang sudah dibaca. */
  adaDiEkspor?: boolean;
  /** Tiga angka kelompok ini; ditaruh di sini supaya yang meninjau tidak
   * perlu naik ke tabel rekap untuk tahu berapa yang tersangkut. */
  rekap?: BarisRekapKelompok;
  /** Dua catatan pertama di kunci ini, apa adanya. */
  cuplikan?: string;
}) {
  const [buka, setBuka] = useState(false);
  const [catatan, setCatatan] = useState("");
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const r = ringkasPemetaan(pemetaan);
  const disetujui = persetujuan !== null;

  const jalankan = (aksi: () => Promise<{ ok: boolean; pesan?: string }>) =>
    mulai(async () => {
      setPesan(null);
      const hasil = await aksi();
      if (!hasil.ok) setPesan(hasil.pesan ?? null);
      else setCatatan("");
    });

  return (
    <Card
      className={cn(
        "kartu-interaktif rounded-3xl shadow-card",
        disetujui ? "ring-ok/30" : "ring-border-subtle",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-base leading-6 font-semibold">
            {pemetaan.label}
            {disetujui ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-ok-fill px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-ok-text">
                <ShieldCheck className="size-3" />
                disetujui
              </span>
            ) : null}
          </h2>
          <p className="font-mono text-[11px] leading-[14px] break-all text-muted-foreground">
            {pemetaan.kunci}
          </p>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            ke <span className="font-mono">{pemetaan.tabelBaru}</span> ·{" "}
            {r.dipindahkan} medan dipindahkan
            {r.bawaan > 0 ? `, ${r.bawaan} diisi bawaan` : ""}
            {r.dibuang > 0 ? `, ${r.dibuang} dibuang` : ""}
          </p>
          <p className="font-mono text-[10px] leading-[14px] text-muted-foreground">
            versi {versi}
          </p>
        </div>
      </div>

      {rekap ? (
        <dl className="mx-5 grid grid-cols-3 gap-2">
          {[
            { label: "Di ekspor", nilai: rekap.ekspor, gaya: "bg-muted" },
            {
              label: "Siap",
              nilai: rekap.terpetakan,
              gaya: rekap.ekspor > 0 ? "bg-ok-fill text-ok-text" : "bg-muted",
            },
            {
              label: "Menunggu",
              nilai: rekap.butuhKeputusan,
              gaya:
                rekap.butuhKeputusan > 0
                  ? "bg-warn-fill text-warn-text"
                  : "bg-muted",
            },
          ].map((a) => (
            <div
              key={a.label}
              className={cn("rounded-2xl px-4 py-2.5", a.gaya)}
            >
              <dt className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] uppercase opacity-80">
                {a.label}
              </dt>
              <dd className="tabular text-base leading-6 font-bold">
                {bilangan(a.nilai)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {rekap && rekap.butuhKeputusan > 0 ? (
        <p className="mx-5 rounded-2xl bg-warn-fill px-4 py-2.5 text-[13px] leading-[18px] text-pretty text-warn-text">
          {bilangan(rekap.butuhKeputusan)} catatan di kelompok ini menunjuk
          orang yang belum punya padanan di V2, jadi barisnya tidak akan
          diproses. Bukan karena rusak — karena laporan tanpa pelapor dan tugas
          tanpa penerima adalah data yang tampak utuh tetapi tidak bisa dipakai.{" "}
          <Link href="/migrasi/orang" className="font-semibold underline">
            Putuskan orangnya
          </Link>{" "}
          dulu, lalu jalankan lagi.
        </p>
      ) : null}

      {!adaDiEkspor ? (
        <p className="mx-5 rounded-2xl bg-muted px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
          Kunci ini belum ada di ekspor yang terbaca. Bisa jadi memang tidak
          dipakai di sistem lama — tetapi bisa juga ekspornya belum lengkap,
          jadi periksa dulu sebelum menyetujui.
        </p>
      ) : null}

      {medanAsing.length > 0 ? (
        <p className="mx-5 rounded-2xl bg-warn-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-warn-text">
          Data lama memuat medan yang belum ada di pemetaan:{" "}
          <span className="font-mono">{medanAsing.join(", ")}</span>. Medan ini
          akan hilang tanpa jejak bila pemetaannya tidak dilengkapi.
        </p>
      ) : null}

      {disetujui ? (
        <p className="mx-5 rounded-2xl bg-ok-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-ok-text">
          Disetujui {persetujuan.olehNama ?? "seseorang"} pada{" "}
          {tanggalPanjang(persetujuan.pada)}
          {persetujuan.rekap
            ? `, saat itu ${persetujuan.rekap.ekspor} entri di ekspor dan ${persetujuan.rekap.butuhKeputusan} menunggu keputusan`
            : ""}
          .{persetujuan.catatan ? ` “${persetujuan.catatan}”` : ""}
        </p>
      ) : null}

      {disetujui && persetujuan.rekap && rekap
        ? (() => {
            const beda =
              persetujuan.rekap.ekspor !== rekap.ekspor ||
              persetujuan.rekap.butuhKeputusan !== rekap.butuhKeputusan;
            // Pemetaannya memang tidak berubah — sidik versinya masih
            // cocok. Yang berubah datanya, dan itu tidak kalah penting:
            // yang menyetujui melihat angka yang lain.
            return beda ? (
              <p className="mx-5 rounded-2xl bg-warn-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-warn-text">
                Angkanya berubah sejak disetujui: sekarang {rekap.ekspor} entri
                dan {rekap.butuhKeputusan} menunggu keputusan. Pemetaannya sama,
                tetapi yang menyetujui melihat data yang lain.
              </p>
            ) : null;
          })()
        : null}

      <div className="px-5">
        <button
          type="button"
          onClick={() => setBuka((b) => !b)}
          aria-expanded={buka}
          className="baris-interaktif flex w-full items-center justify-between gap-2 rounded-xl px-1 py-2 text-left text-[13px] leading-[18px] font-semibold"
        >
          {buka ? "Sembunyikan" : "Lihat"} pemetaan medannya
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              buka && "rotate-180",
            )}
          />
        </button>

        {buka ? (
          <div className="space-y-2">
            <ul className="space-y-1">
              {pemetaan.baris.map((b) => (
                <li
                  key={b.kolomBaru}
                  className="rounded-xl bg-muted/50 px-3 py-2"
                >
                  <p className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] leading-[16px]">
                    <span
                      className={cn(
                        b.medanLama ? "" : "text-muted-foreground italic",
                      )}
                    >
                      {b.medanLama ?? "(tidak ada)"}
                    </span>
                    <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                    <span className="font-semibold">{b.kolomBaru}</span>
                    {b.wajib ? (
                      <span className="rounded-full bg-card px-1.5 py-0.5 font-sans text-[10px] leading-[14px] font-semibold text-muted-foreground">
                        wajib
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
                    {KETERANGAN_UBAHAN[b.ubahan]}
                    {b.catatan ? ` ${b.catatan}` : ""}
                  </p>
                </li>
              ))}
            </ul>

            {pemetaan.dibuang.length > 0 ? (
              <ul className="space-y-1">
                {pemetaan.dibuang.map((d) => (
                  <li
                    key={d.medanLama}
                    className="rounded-xl bg-muted px-3 py-2"
                  >
                    <p className="font-mono text-[11px] leading-[16px] line-through">
                      {d.medanLama}
                    </p>
                    <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
                      Sengaja tidak dipindahkan. {d.alasan}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}

            {cuplikan ? (
              <div>
                <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                  Cuplikan isinya
                </p>
                <p className="mt-0.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  Dua catatan pertama, apa adanya. Pemetaan hanya menyebut nama
                  medan; apakah isinya benar-benar seperti yang dikira baru
                  kelihatan dari sini.
                </p>
                <pre className="mt-1.5 max-h-64 overflow-auto rounded-2xl bg-muted p-3 font-mono text-[11px] leading-[16px]">
                  {cuplikan}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {bolehSetujui ? (
        <div className="space-y-2 px-5">
          {disetujui ? (
            <Button
              type="button"
              variant="outline"
              disabled={menyimpan}
              onClick={() => jalankan(() => tarikPersetujuan(pemetaan.kunci))}
              className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
            >
              {menyimpan ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Tarik persetujuan
            </Button>
          ) : (
            <>
              <input
                value={catatan}
                maxLength={200}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Catatan peninjauan (opsional)"
                aria-label={`Catatan peninjauan ${pemetaan.label}`}
                className="h-11 w-full rounded-xl bg-muted px-4 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <Button
                type="button"
                disabled={menyimpan}
                onClick={() =>
                  jalankan(() => setujuiPemetaan(pemetaan.kunci, catatan))
                }
                className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
              >
                {menyimpan ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                Setujui pemetaan ini
              </Button>
            </>
          )}

          {pesan ? (
            <p
              role="status"
              className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text"
            >
              {pesan}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
