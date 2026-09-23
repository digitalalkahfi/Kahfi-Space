"use client";

import { useRef, useState, useTransition } from "react";
import { Download, FileUp, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Hasil } from "@/lib/data/hasil";
import {
  BATAS_UNGGAH_MB,
  TIPE_EKSPOR,
  bacaEksporV1,
  tolakBerkas,
  ukuranBerkas,
  type BarisUnggah,
  type RingkasUnggah,
} from "@/lib/ekspor-v1";
import { PanelKunciDikenal } from "@/components/migrasi/panel-kunci-dikenal";
import { PanelKunciDiabaikan } from "@/components/migrasi/panel-kunci-diabaikan";
import { RingkasanUnggahan } from "@/components/migrasi/ringkasan-unggahan";

/**
 * Seksi unggah ekspor K-Space lama.
 *
 * Sebelum ini satu-satunya jalan mengisi `kv_store_lama` adalah menempel
 * SQL langsung ke basis data — pekerjaan yang tidak mungkin diminta dari
 * orang yang justru berhak melakukannya. Seksi ini menggantikannya:
 * berkas ekspor dipilih dari perangkat, diperiksa ukurannya lebih dulu,
 * lalu dikirim lewat Server Action.
 *
 * Berkasnya diperiksa dua kali dengan aturan yang sama (`tolakBerkas`).
 * Pemeriksaan di sini hanya menghemat unggahan puluhan megabita yang
 * sudah pasti ditolak; yang mengikat tetap pemeriksaan di server.
 *
 * Isinya juga dibaca lebih dulu di perangkat ini, sebelum sebyte pun
 * dikirim. Ekspor lama berukuran puluhan megabita: mengetahui bahwa
 * berkasnya keliru setelah menunggu unggahan selesai adalah cara paling
 * cepat membuat orang berhenti memakai layar ini.
 */
export function PanelUnggahEkspor({
  kirim,
  tersimpan,
  sumberTersimpan,
}: {
  /** Server Action penerima berkas. */
  kirim: (data: FormData) => Promise<Hasil<RingkasUnggah>>;
  /** Kunci yang sudah ada di kv_store_lama sebelum halaman dibuka. */
  tersimpan: BarisUnggah[];
  /** Berkas ekspor yang terakhir diunggah, bila tercatat. */
  sumberTersimpan: string | null;
}) {
  const berkasRef = useRef<HTMLInputElement>(null);
  const [berkas, setBerkas] = useState<File | null>(null);
  const [tolakan, setTolakan] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [ringkas, setRingkas] = useState<RingkasUnggah | null>(null);
  const [pratinjau, setPratinjau] = useState<RingkasUnggah | null>(null);
  const [membaca, setMembaca] = useState(false);
  const [berhasil, setBerhasil] = useState(false);
  const [mengirim, mulai] = useTransition();

  const pilih = async (dipilih: File | undefined) => {
    setPesan(null);
    setRingkas(null);
    setPratinjau(null);
    if (!dipilih) return;

    const alasan = tolakBerkas({ nama: dipilih.name, ukuran: dipilih.size });
    setTolakan(alasan);
    setBerkas(alasan ? null : dipilih);
    if (alasan) return;

    setMembaca(true);
    try {
      const dibaca = bacaEksporV1(JSON.parse(await dipilih.text()));
      if (!dibaca.ok) {
        setTolakan(dibaca.sebab);
        setBerkas(null);
        return;
      }
      setPratinjau({
        berkas: dipilih.name,
        meta: dibaca.meta,
        baris: dibaca.isi.map(({ kunci, golongan, jumlah, disimpan }) => ({
          kunci,
          golongan,
          jumlah,
          disimpan,
        })),
      });
    } catch {
      setTolakan(
        "Berkasnya bukan JSON yang utuh. Pastikan yang dipilih berkas ekspor, bukan potongannya.",
      );
      setBerkas(null);
    } finally {
      setMembaca(false);
    }
  };

  const bersihkan = () => {
    setBerkas(null);
    setTolakan(null);
    setPesan(null);
    setRingkas(null);
    setPratinjau(null);
    if (berkasRef.current) berkasRef.current.value = "";
  };

  // Urutan kepercayaan: hasil unggahan barusan, lalu pratinjau berkas
  // yang sedang dipilih, baru isi tabel. Keduanya yang pertama juga
  // memuat kunci yang sengaja tidak disimpan — hal yang tidak mungkin
  // diketahui dari tabelnya sendiri.
  const terbaru = ringkas ?? pratinjau;
  const baris = terbaru?.baris ?? tersimpan;
  const sumber = terbaru
    ? ringkas
      ? terbaru.berkas
      : `${terbaru.berkas} (pratinjau)`
    : sumberTersimpan;

  const unggah = () => {
    if (!berkas || mengirim) return;
    mulai(async () => {
      const muatan = new FormData();
      muatan.set("berkas", berkas);
      const hasil = await kirim(muatan);
      setBerhasil(hasil.ok);
      setPesan(hasil.pesan ?? null);
      setRingkas(hasil.ok ? hasil.data : null);
      if (hasil.ok) {
        setBerkas(null);
        if (berkasRef.current) berkasRef.current.value = "";
      }
    });
  };

  return (
    <>
      <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
        <div className="px-5">
          <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
            <FileUp className="size-4 text-muted-foreground" />
            Unggah ekspor K-Space lama
          </h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Berkas JSON hasil ekspor sistem lama — satu objek berisi{" "}
            <span className="font-mono">_meta</span> dan kunci-kunci datanya.
            Isinya masuk apa adanya ke{" "}
            <span className="font-mono">kv_store_lama</span> sebagai bahan
            pemetaan; tidak ada satu pun tabel tujuan yang disentuh di langkah
            ini.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5">
          <Button
            type="button"
            variant="outline"
            disabled={mengirim}
            onClick={() => berkasRef.current?.click()}
            className="tekan-halus sentuh-nyaman h-10 rounded-full px-4 text-[11px] font-semibold"
          >
            <Upload className="size-3.5" />
            Pilih berkas
          </Button>
          <a
            href="/api/migrasi/contoh"
            download="ekspor-contoh.json"
            className="tekan-halus sentuh-nyaman inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[11px] font-semibold ring-1 ring-border-subtle"
          >
            <Download className="size-3.5" />
            Unduh contoh
          </a>
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            Berkas .json, maksimal {BATAS_UNGGAH_MB} MB. Contohnya bisa diunduh
            lalu diunggah kembali untuk mencoba alurnya.
          </p>
          <input
            ref={berkasRef}
            type="file"
            accept={TIPE_EKSPOR.join(",")}
            className="hidden"
            onChange={(e) => void pilih(e.target.files?.[0])}
          />
        </div>

        {tolakan ? (
          <p
            role="alert"
            className="mx-5 rounded-2xl bg-warn-fill px-4 py-2.5 text-[13px] leading-[18px] text-pretty text-warn-text"
          >
            {tolakan}
          </p>
        ) : null}

        {berkas ? (
          <div className="mx-5 flex flex-wrap items-center gap-3 rounded-2xl bg-muted px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[11px] leading-[14px]">
                {berkas.name}
              </span>
              <span className="tabular block text-[11px] leading-[14px] text-muted-foreground">
                {ukuranBerkas(berkas.size)}
              </span>
            </span>

            <Button
              type="button"
              variant="ghost"
              disabled={mengirim}
              onClick={bersihkan}
              aria-label="Lepas berkas"
              className="tekan-halus sentuh-nyaman size-9 shrink-0 rounded-full p-0"
            >
              <X className="size-4" />
            </Button>

            <Button
              type="button"
              disabled={mengirim || membaca || !pratinjau}
              onClick={unggah}
              className="tekan-halus sentuh-nyaman h-10 shrink-0 rounded-full px-4 text-[11px] font-semibold"
            >
              {mengirim || membaca ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileUp className="size-3.5" />
              )}
              {membaca ? "Membaca…" : "Unggah"}
            </Button>
          </div>
        ) : null}

        {terbaru ? <RingkasanUnggahan ringkas={terbaru} /> : null}

        {pratinjau && !ringkas ? (
          <p className="mx-5 rounded-2xl bg-info-fill px-4 py-2.5 text-[13px] leading-[18px] text-pretty text-info-text">
            Berkasnya sudah dibaca di perangkat ini dan belum dikirim ke mana
            pun. Yang di bawah adalah isinya — periksa dulu, baru tekan Unggah.
          </p>
        ) : null}

        {mengirim ? (
          <p className="mx-5 rounded-2xl bg-muted px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
            Sedang mengirim. Ekspor puluhan megabita bisa memakan waktu; jangan
            tutup halamannya.
          </p>
        ) : null}

        {pesan ? (
          <p
            role="status"
            className={cn(
              "mx-5 rounded-2xl px-4 py-2.5 text-[13px] leading-[18px] text-pretty",
              berhasil
                ? "bg-ok-fill text-ok-text"
                : "bg-warn-fill text-warn-text",
            )}
          >
            {pesan}
          </p>
        ) : null}
      </Card>

      <PanelKunciDikenal baris={baris} sumber={sumber} />

      <PanelKunciDiabaikan baris={baris} />
    </>
  );
}
