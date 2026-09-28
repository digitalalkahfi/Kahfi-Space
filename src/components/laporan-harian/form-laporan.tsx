"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Coins,
  Loader2,
  PackageCheck,
  Send,
  Store,
  Upload,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputGmv } from "@/components/laporan-harian/input-gmv";
import { KolomCatatan } from "@/components/laporan-harian/kolom-catatan";
import {
  PemilihSasaran,
  kunciSasaran,
  labelSasaran,
  targetSasaran,
} from "@/components/laporan-harian/pemilih-sasaran";
import { cn } from "@/lib/utils";
import {
  GAYA_MINIMUM,
  kurangnya,
  minimumSasaran,
  statusMinimum,
  statusTerkirim,
} from "@/lib/batas-minimum";
import {
  bersihkanIsi,
  MAKS_KOMISI,
  MAKS_UPLOAD,
  periksaIsiLaporan,
  punyaKolom,
  sasaranBelumDilapor,
  unitSasaran,
  type IsiLaporan,
} from "@/lib/laporan";
import {
  bilangan,
  persen,
  rasioCapaian,
  rupiahPenuh,
  rupiahRingkas,
} from "@/lib/format";
import { kirimLaporanHarian } from "@/app/actions/laporan";
import type { SasaranLaporan } from "@/lib/types";

/** Ringkasan laporan yang baru saja terkirim dari layar ini. */
type LaporanTerkirim = {
  label: string;
  gmv: number;
  komisi: number | null;
  jumlahUpload: number | null;
  /** Upload di bawah batas minimum levelnya; null bila tidak dinilai. */
  kurangUpload: number | null;
  minimum: number | null;
};

/**
 * Satu-satunya tempat input GMV (PRD §2). Angka diketik manual sambil
 * melihat Partner Center — tidak ada integrasi API.
 *
 * Isian menyesuaikan departemen sasaran yang dipilih (PRD Fase 1):
 * Affiliator menambah komisi, jumlah upload, dan CO sampel; MCN & TAP
 * cukup GMV dan catatan.
 *
 * "Sudah terkirim" dihitung PER SASARAN, bukan per orang: PIC yang
 * memegang dua akun tetap mendapat form untuk akun keduanya setelah akun
 * pertama dilapor. Form baru berganti menjadi kartu selesai ketika
 * seluruh sasarannya hari ini sudah masuk.
 */
export function FormLaporan({
  sasaran,
  sudahDilaporkan,
  tanggal,
  absenTerbuka,
  onTerkirim,
  coSampel = {},
}: {
  sasaran: SasaranLaporan[];
  tanggal: string;
  /** Kunci sasaran yang laporannya sudah masuk hari ini. */
  sudahDilaporkan: string[];
  /** Absen Pulang sudah terbuka — laporan pertama hari ini sudah masuk. */
  absenTerbuka: boolean;
  /** Dipakai induk untuk membuka kunci Absen Pulang. */
  onTerkirim: () => void;
  /**
   * CO sampel hari ini per kunci sasaran, dihitung dari log pemindaian
   * sampel. Read-only: pelapor tidak pernah mengetiknya sendiri.
   */
  coSampel?: Record<string, number>;
}) {
  // Yang terkirim dari layar ini ikut dihitung walau halaman belum
  // dimuat ulang, supaya pemilih langsung berpindah ke sasaran berikutnya.
  const [terkirimLokal, setTerkirimLokal] = useState<string[]>([]);
  const terlapor = useMemo(
    () => [...new Set([...sudahDilaporkan, ...terkirimLokal])],
    [sudahDilaporkan, terkirimLokal],
  );
  const sisa = sasaranBelumDilapor(sasaran, terlapor);

  const [dipilih, setDipilih] = useState(sisa[0] ? kunciSasaran(sisa[0]) : "");
  const [nilai, setNilai] = useState(0);
  const [komisi, setKomisi] = useState(0);
  const [upload, setUpload] = useState(0);
  const [catatan, setCatatan] = useState("");
  const [mengirim, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  const [terakhir, setTerakhir] = useState<LaporanTerkirim | null>(null);

  const aktif = useMemo(
    () => sasaran.find((s) => kunciSasaran(s) === dipilih),
    [sasaran, dipilih],
  );

  const unit = aktif ? unitSasaran(aktif) : null;
  const target = aktif ? targetSasaran(aktif) : 0;
  // Ikut pemilih sasaran: begitu akunnya berganti, level dan batas
  // minimumnya ikut berganti — termasuk menjadi kosong saat yang dipilih
  // adalah sasaran tingkat unit.
  const { level, minimum } = minimumSasaran(aktif);
  const statusUpload = statusMinimum(upload, minimum);
  const rasio = rasioCapaian(nilai, target);
  const selisih = nilai - target;
  const co = coSampel[dipilih] ?? 0;

  const isi: IsiLaporan = {
    gmv: nilai,
    komisi,
    jumlahUpload: upload,
    catatan,
  };
  // `bersihkanIsi` yang memutuskan kolom mana ikut terkirim: angka komisi
  // yang sempat diketik untuk akun Affiliator tidak boleh ikut saat pelapor
  // berpindah ke sasaran MCN.
  const bersih = bersihkanIsi(unit, isi);
  const salah = periksaIsiLaporan(unit, bersih);
  const siap = Boolean(aktif) && !terlapor.includes(dipilih) && !salah;

  /**
   * Sesudah terkirim: sasaran ini dikunci, isian dikosongkan, dan pemilih
   * langsung pindah ke sasaran berikutnya yang belum dilapor.
   */
  const catatTerkirim = () => {
    const baru = [...terlapor, dipilih];
    setTerkirimLokal((l) => [...l, dipilih]);
    setTerakhir({
      label: aktif ? labelSasaran(aktif) : "",
      gmv: bersih.gmv,
      komisi: bersih.komisi,
      jumlahUpload: bersih.jumlahUpload,
      kurangUpload:
        statusTerkirim(bersih.jumlahUpload, minimum) === "kurang"
          ? kurangnya(bersih.jumlahUpload, minimum)
          : null,
      minimum,
    });
    setNilai(0);
    setKomisi(0);
    setUpload(0);
    setCatatan("");
    const berikut = sasaranBelumDilapor(sasaran, baru)[0];
    if (berikut) setDipilih(kunciSasaran(berikut));
    onTerkirim();
  };

  // Seluruh sasaran hari ini sudah masuk: formnya tidak berguna lagi.
  if (sasaran.length > 0 && sisa.length === 0) {
    return (
      <Card className="rounded-3xl shadow-card ring-border-subtle">
        <div className="space-y-3 px-5 py-2 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ok-fill text-ok-text">
            <CheckCircle2 className="size-6" />
          </span>
          <div>
            <h2 className="text-base leading-6 font-semibold">
              {sasaran.length > 1
                ? "Semua laporan hari ini terkirim"
                : "Laporan harian terkirim"}
            </h2>
            <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
              {/* Angka hanya ditampilkan kalau laporannya memang dikirim dari
                  layar ini; saat halaman dibuka dan laporan hari itu sudah
                  ada, form masih kosong dan "Rp 0" hanya menyesatkan. */}
              {terakhir ? <RingkasTerkirim laporan={terakhir} /> : null}
              {sasaran.length > 1
                ? `${sasaran.map(labelSasaran).join(", ")} sudah dilapor. `
                : terakhir
                  ? ""
                  : "Laporan hari ini sudah masuk. "}
              Tombol Absen Pulang sekarang terbuka.
            </p>
            {terakhir ? <PeringatanMinimum laporan={terakhir} /> : null}
          </div>
          <Button
            asChild
            variant="outline"
            className="tekan-halus h-10 rounded-full px-5 text-[13px] font-semibold"
          >
            <Link href="/laporan-harian/riwayat">
              Perbaiki di riwayat laporan
            </Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">
            Input GMV Hari Ini
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Sumber angka: TikTok Shop Partner Center
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-info-fill text-info-text">
          <Store className="size-4" />
        </span>
      </div>

      {terakhir ? (
        <div className="mx-5 space-y-1.5 rounded-2xl bg-ok-fill px-4 py-3 text-ok-text">
          <p className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold">
            <CheckCircle2 className="size-4 shrink-0" />
            Laporan {terakhir.label} terkirim
          </p>
          <p className="text-[11px] leading-[14px] text-pretty">
            <RingkasTerkirim laporan={terakhir} />
            Masih ada {sisa.length} sasaran yang belum dilapor hari ini:{" "}
            {sisa.map(labelSasaran).join(", ")}.
          </p>
          <PeringatanMinimum laporan={terakhir} />
        </div>
      ) : sasaran.length > 1 && terlapor.length > 0 ? (
        <p className="mx-5 rounded-2xl bg-info-fill px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-info-text">
          {sasaran.length - sisa.length} dari {sasaran.length} sasaran sudah
          dilapor hari ini. Tinggal {sisa.map(labelSasaran).join(", ")}.
        </p>
      ) : null}

      <form
        className="space-y-4 px-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!siap || mengirim) return;
          setPesan(null);
          mulai(async () => {
            const hasil = await kirimLaporanHarian({
              sasaran: dipilih,
              gmv: bersih.gmv,
              komisi: bersih.komisi,
              jumlahUpload: bersih.jumlahUpload,
              catatan: bersih.catatan,
              tanggal,
            });
            if (hasil.ok || hasil.kode === "demo") {
              // Mode demo: alurnya tetap diperlihatkan, datanya tidak disimpan.
              if (!hasil.ok) setPesan(hasil.pesan);
              catatTerkirim();
            } else {
              setPesan(hasil.pesan);
            }
          });
        }}
      >
        <div className="space-y-1.5">
          <label
            htmlFor="sasaran"
            className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold"
          >
            <Store className="size-3.5 text-muted-foreground" />
            Pilih akun atau unit
          </label>
          <PemilihSasaran
            sasaran={sasaran}
            nilai={dipilih}
            onUbah={setDipilih}
            sudahDilaporkan={terlapor}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="gmv"
              className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold"
            >
              <Wallet className="size-3.5 text-muted-foreground" />
              Nilai realisasi GMV
            </label>
            {target > 0 ? (
              <span className="flex shrink-0 items-center gap-1">
                <span className="tabular text-[11px] leading-[14px] font-semibold text-ok-text">
                  Target {rupiahRingkas(target)}
                </span>
                <Link
                  href="/grd"
                  title="Target harian diturunkan dari GRD"
                  className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-[13px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  GRD
                </Link>
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-warn-fill px-2 py-0.5 text-[10px] leading-[13px] font-semibold text-warn-text">
                Target belum ada di GRD
              </span>
            )}
          </div>

          <InputGmv
            nilai={nilai}
            onUbah={setNilai}
            suffix={
              nilai > 0 && target > 0 ? (
                <span
                  className={cn(
                    "tabular shrink-0 rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-semibold",
                    selisih >= 0
                      ? "bg-ok-fill text-ok-text"
                      : "bg-danger-fill text-danger-text",
                  )}
                >
                  {selisih >= 0 ? "+" : "-"}
                  {rupiahRingkas(Math.abs(selisih), { prefix: false })}
                </span>
              ) : null
            }
          />

          {nilai > 0 && target > 0 ? (
            <p
              id="gmv-bantuan"
              className="tabular text-[11px] leading-[14px] text-muted-foreground"
            >
              {persen(rasio)} dari target harian · {rupiahPenuh(nilai)}
            </p>
          ) : nilai > 0 ? (
            <p
              id="gmv-bantuan"
              className="tabular text-[11px] leading-[14px] text-muted-foreground"
            >
              {rupiahPenuh(nilai)} · persentase muncul setelah targetnya
              ditetapkan di GRD.
            </p>
          ) : (
            <p
              id="gmv-bantuan"
              className="text-[11px] leading-[14px] text-muted-foreground"
            >
              Buka Partner Center, salin angka GMV hari ini apa adanya.
            </p>
          )}
        </div>

        {punyaKolom(unit, "komisi") || punyaKolom(unit, "jumlahUpload") ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {punyaKolom(unit, "komisi") ? (
              <div className="space-y-1.5">
                <label
                  htmlFor="komisi"
                  className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold"
                >
                  <Coins className="size-3.5 text-muted-foreground" />
                  Komisi diterima
                </label>
                <InputGmv
                  id="komisi"
                  ringkas
                  maks={MAKS_KOMISI}
                  label="komisi"
                  nilai={komisi}
                  onUbah={setKomisi}
                />
                <p
                  id="komisi-bantuan"
                  className="text-[11px] leading-[14px] text-muted-foreground"
                >
                  {komisi > 0 && nilai > 0
                    ? `${persen(rasioCapaian(komisi, nilai))} dari GMV`
                    : "Kosongkan kalau hari ini belum ada komisi."}
                </p>
              </div>
            ) : null}

            {punyaKolom(unit, "jumlahUpload") ? (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <label
                    htmlFor="upload"
                    className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold"
                  >
                    <Upload className="size-3.5 text-muted-foreground" />
                    Jumlah upload
                  </label>
                  {/* Badge batas minimum level (PRD Fase 1). Hanya muncul
                      bila level akunnya memang diketahui — badge tanpa
                      angka lebih membingungkan daripada tidak ada. */}
                  {minimum !== null ? (
                    <span
                      className={cn(
                        "tabular rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-semibold",
                        statusUpload === "terpenuhi" ||
                          statusUpload === "kurang"
                          ? GAYA_MINIMUM[statusUpload].pil
                          : "bg-accentmuted-fill text-accentmuted-text",
                      )}
                    >
                      Batas minimum level {level}: {bilangan(minimum)} video
                    </span>
                  ) : null}
                </div>
                <InputGmv
                  id="upload"
                  ringkas
                  maks={MAKS_UPLOAD}
                  label="jumlah upload"
                  prefix={<Upload className="size-3.5" />}
                  nilai={upload}
                  onUbah={setUpload}
                />
                {/* Indikator kepatuhan (PRD Fase 1). Baru berbicara
                    setelah angkanya diisi; sebelum itu ia hanya
                    menyebutkan standarnya. */}
                <p
                  id="upload-bantuan"
                  // Diumumkan pembaca layar saat angkanya berubah; "polite"
                  // supaya tidak memotong apa pun yang sedang dibacakan.
                  role="status"
                  className={cn(
                    "text-[11px] leading-[14px]",
                    statusUpload === "terpenuhi" || statusUpload === "kurang"
                      ? `font-semibold ${GAYA_MINIMUM[statusUpload].teks}`
                      : "text-muted-foreground",
                  )}
                >
                  {statusUpload === "terpenuhi"
                    ? `Terpenuhi — ${bilangan(upload)} dari ${bilangan(minimum ?? 0)} video.`
                    : statusUpload === "kurang"
                      ? `Di bawah minimum — kurang ${bilangan(kurangnya(upload, minimum))} video lagi.`
                      : minimum !== null
                        ? `Konten yang tayang hari ini. Standar level ${level} adalah ${bilangan(minimum)} video per hari kerja.`
                        : `Konten yang tayang hari ini, maksimal ${MAKS_UPLOAD}.`}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {punyaKolom(unit, "coSampel") ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3">
            <span className="flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold">
              <PackageCheck className="size-3.5 text-muted-foreground" />
              CO sampel
            </span>
            <span className="flex items-center gap-2">
              <span className="tabular text-[15px] leading-5 font-bold">
                {bilangan(co)}
              </span>
              <span className="rounded-full bg-card px-2 py-0.5 text-[10px] leading-[13px] font-semibold text-muted-foreground">
                Otomatis
              </span>
            </span>
          </div>
        ) : null}

        {punyaKolom(unit, "coSampel") ? (
          <p className="-mt-2 text-[11px] leading-[14px] text-muted-foreground">
            {co > 0
              ? "Dihitung dari pemindaian sampel hari ini; tidak bisa diketik."
              : "Belum ada sampel yang dipindai hari ini, jadi masih 0."}
          </p>
        ) : null}

        <KolomCatatan nilai={catatan} onUbah={setCatatan} />

        <p
          className={cn(
            "text-[11px] leading-[14px]",
            siap ? "font-semibold text-ok-text" : "text-muted-foreground",
          )}
        >
          {siap
            ? statusUpload === "kurang"
              ? "Siap dikirim — di bawah minimum tetap dicatat apa adanya"
              : "Siap dikirim"
            : nilai === 0
              ? "Isi nilai GMV dulu untuk mengirim laporan"
              : (salah ?? "Periksa lagi isiannya")}
        </p>

        {pesan ? (
          <p
            role="status"
            className="rounded-xl bg-warn-fill px-4 py-2.5 text-[13px] leading-[18px] text-warn-text"
          >
            {pesan}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={!siap || mengirim}
          className="tekan-halus h-14 w-full rounded-full text-[13px] font-semibold"
        >
          {mengirim ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {mengirim
            ? "Mengirim…"
            : absenTerbuka
              ? "Kirim laporan harian"
              : "Kirim laporan harian & buka Absen Pulang"}
        </Button>
      </form>
    </Card>
  );
}

/** "taokspill_ · Rp 12.500.000 · komisi … · 5 upload." */
function RingkasTerkirim({ laporan }: { laporan: LaporanTerkirim }) {
  return (
    <>
      {laporan.label} · {rupiahPenuh(laporan.gmv)}
      {laporan.komisi !== null
        ? ` · komisi ${rupiahRingkas(laporan.komisi)}`
        : ""}
      {laporan.jumlahUpload !== null
        ? ` · ${bilangan(laporan.jumlahUpload)} upload`
        : ""}
      {". "}
    </>
  );
}

/**
 * Kalau unggahannya di bawah minimum, konfirmasi inilah kesempatan
 * terakhir menyebutkannya — angka itu baru muncul lagi besok di rekap
 * Leader. Laporannya tetap tersimpan apa adanya.
 */
function PeringatanMinimum({ laporan }: { laporan: LaporanTerkirim }) {
  if (laporan.kurangUpload === null) return null;
  return (
    <p
      className={cn(
        "mx-auto mt-2 w-fit rounded-full px-3 py-1",
        "text-[11px] leading-[14px] font-semibold",
        GAYA_MINIMUM.kurang.pil,
      )}
    >
      Di bawah minimum — kurang {bilangan(laporan.kurangUpload)} video dari{" "}
      {bilangan(laporan.minimum ?? 0)} per hari kerja.
    </p>
  );
}
