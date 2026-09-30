"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, UserRoundPlus } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { keJamWib, keTanggalWib } from "@/lib/format";
import { delegasikanToDo, tambahToDo, ubahToDo } from "@/app/actions/tugas";
import type { Prioritas, Tugas } from "@/lib/types";

const PRIORITAS: { nilai: Prioritas; label: string }[] = [
  { nilai: "tinggi", label: "Tinggi" },
  { nilai: "sedang", label: "Sedang" },
  { nilai: "rendah", label: "Rendah" },
];

/** Jam bawaan saat to-do tanpa jam didelegasikan: tiket wajib berjam. */
const JAM_BAWAAN_TIKET = "17:00";

type CalonPenerima = { id: string; nama: string; jabatan: string };

/**
 * Tambah to-do pribadi. Sengaja ringkas: judul dan deadline sudah cukup
 * untuk mencatat cepat di tengah kerja; deskripsi boleh sepanjang yang
 * perlu, dan prioritasnya bisa langsung dipilih.
 *
 * Tanggal & jam adalah DEADLINE — batas to-do harus selesai, bukan hari
 * mengerjakannya. Tanpa jam, deadline-nya akhir hari itu (23.59 WIB).
 *
 * Dengan `ubah`, isian yang sama dipakai untuk mengedit to-do itu: terisi
 * nilainya sekarang, dibuka-tutup dari luar (tombol Edit di kartu), dan
 * deadline lampau yang tidak disentuh tetap sah. Bila ada bawahan
 * (`penerima`), to-do itu juga bisa didelegasikan: ia berubah menjadi
 * tiket dari pemiliknya untuk orang yang dipilih.
 */
export function DialogToDo({
  hariIni,
  tanggalAwal,
  ubah,
  onTutup,
  penerima = [],
}: {
  /** Hari ini (WIB) — tanggal paling awal yang boleh dipilih. */
  hariIni: string;
  /** Tanggal bawaan isian; tidak pernah sebelum hari ini. */
  tanggalAwal: string;
  /** To-do yang diedit; tanpa ini dialognya menambah to-do baru. */
  ubah?: Tugas;
  /** Mode edit: dipanggil saat dialog ditutup. */
  onTutup?: () => void;
  /** Anggota yang boleh ditugasi — tujuan delegasi (mode edit). */
  penerima?: CalonPenerima[];
}) {
  const tanggalLama = ubah?.tenggat ? keTanggalWib(ubah.tenggat) : "";
  // To-do lama mencatat keterangannya di "konteks" (satu baris). Kini
  // keterangan ada di deskripsi; saat diedit, konteks lama pindah ke sana.
  const konteksPindah = Boolean(ubah && !ubah.deskripsi && ubah.konteks);
  const [buka, setBuka] = useState(ubah !== undefined);
  const [judul, setJudul] = useState(ubah?.judul ?? "");
  const [deskripsi, setDeskripsi] = useState(
    ubah ? ubah.deskripsi || ubah.konteks : "",
  );
  const [tanggal, setTanggal] = useState(tanggalLama || tanggalAwal);
  const [jam, setJam] = useState(
    ubah?.tenggat && !ubah.tanpaJam ? keJamWib(ubah.tenggat) : "",
  );
  const [prioritas, setPrioritas] = useState<Prioritas>(
    ubah?.prioritas ?? "sedang",
  );
  const [delegasi, setDelegasi] = useState(false);
  const [penerimaId, setPenerimaId] = useState("");
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const bisaDelegasi =
    ubah !== undefined && ubah.status !== "selesai" && penerima.length > 0;
  const siap =
    judul.trim().length >= 3 &&
    tanggal !== "" &&
    (!delegasi || (penerimaId !== "" && jam !== "" && tanggal >= hariIni));
  // To-do terlambat yang diedit: tanggal lamanya tetap boleh terpilih.
  const tanggalMin =
    tanggalLama && tanggalLama < hariIni ? tanggalLama : hariIni;
  const namaPenerima = penerima.find((p) => p.id === penerimaId)?.nama;

  const bukaTutup = (b: boolean) => {
    if (ubah) {
      setBuka(b);
      if (!b) onTutup?.();
      return;
    }
    // Setiap kali dibuka, tanggal kembali ke bawaan halaman — bisa saja
    // tanggal papan sudah berganti sejak isian terakhir.
    if (b) setTanggal(tanggalAwal);
    setBuka(b);
  };

  const mulaiDelegasi = () => {
    setDelegasi(true);
    setPesan(null);
    // Tiket selalu berjam; to-do tanpa jam diberi jam kerja bawaan yang
    // tetap bisa diganti.
    if (!jam) setJam(JAM_BAWAAN_TIKET);
    // Bawahan tidak menerima tiket yang sudah terlambat: deadline lampau
    // dimulai lagi dari hari ini.
    if (tanggal < hariIni) setTanggal(hariIni);
  };

  const simpan = () => {
    if (!siap || menyimpan) return;
    setPesan(null);

    mulai(async () => {
      const isian = {
        judul,
        deskripsi,
        tanggal,
        jam: jam || null,
        prioritas,
      };

      if (ubah) {
        const lengkap = {
          ...isian,
          // Kosongkan konteks lama yang sudah pindah ke deskripsi, supaya
          // keterangannya tidak tampil dua kali.
          konteks: konteksPindah ? "" : undefined,
        };
        const hasil = delegasi
          ? await delegasikanToDo(ubah.id, {
              ...lengkap,
              jam: jam || JAM_BAWAAN_TIKET,
              penerimaId,
            })
          : await ubahToDo(ubah.id, lengkap);
        if (hasil.ok) bukaTutup(false);
        else setPesan(hasil.pesan);
        return;
      }

      const hasil = await tambahToDo(isian);

      if (hasil.ok || hasil.kode === "demo") {
        setJudul("");
        setDeskripsi("");
        setJam("");
        setBuka(false);
        if (!hasil.ok) setPesan(hasil.pesan);
        return;
      }
      setPesan(hasil.pesan);
    });
  };

  const label = "text-[13px] leading-[18px] font-semibold";
  const opsional = (
    <span className="font-normal text-muted-foreground">(opsional)</span>
  );

  return (
    <Dialog open={buka} onOpenChange={bukaTutup}>
      {ubah ? null : (
        <DialogTrigger asChild>
          <Button
            type="button"
            className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
          >
            <Plus className="size-3.5" />
            Tambah to-do
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {ubah ? "Edit to-do" : "Tambah to-do pribadi"}
          </DialogTitle>
          <DialogDescription>
            {ubah
              ? "Hanya kamu yang melihat to-do ini, jadi perubahannya tidak dikabarkan ke siapa pun."
              : "Hanya kamu yang melihatnya. Untuk menugasi orang lain, buat tiket."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="judul-todo" className={label}>
              Yang mau dikerjakan
            </label>
            <input
              id="judul-todo"
              value={judul}
              maxLength={200}
              autoComplete="off"
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Mis. cek 14 sesi live sore"
              className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="deskripsi-todo" className={label}>
              Deskripsi {opsional}
            </label>
            <textarea
              id="deskripsi-todo"
              rows={5}
              maxLength={5000}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Jelaskan detailnya bila perlu: langkah, tautan, catatan penting."
              className="min-h-28 w-full resize-y rounded-xl bg-muted px-4 py-3 text-[13px] leading-[18px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className={label}>Deadline</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label
                  htmlFor="tanggal-todo"
                  className="text-[11px] leading-[14px] text-muted-foreground"
                >
                  Tanggal
                </label>
                <input
                  id="tanggal-todo"
                  type="date"
                  required
                  min={delegasi ? hariIni : tanggalMin}
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="jam-todo"
                  className="text-[11px] leading-[14px] text-muted-foreground"
                >
                  {delegasi ? "Jam" : "Jam (opsional)"}
                </label>
                <input
                  id="jam-todo"
                  type="time"
                  required={delegasi}
                  value={jam}
                  onChange={(e) => setJam(e.target.value)}
                  className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              </div>
            </div>
            <p className="text-[11px] leading-[14px] text-muted-foreground">
              Batas waktu to-do ini harus selesai. Tanpa jam, deadline-nya akhir
              hari itu (23.59 WIB).
            </p>
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className={label}>Prioritas</legend>
            <div className="flex gap-1">
              {PRIORITAS.map((p) => (
                <button
                  key={p.nilai}
                  type="button"
                  onClick={() => setPrioritas(p.nilai)}
                  aria-pressed={p.nilai === prioritas}
                  className={cn(
                    "tekan-halus h-11 flex-1 rounded-xl text-[11px] font-semibold",
                    p.nilai === prioritas
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>

          {bisaDelegasi ? (
            delegasi ? (
              <div className="space-y-2 rounded-2xl bg-info-fill p-3">
                <label
                  htmlFor="delegasi-todo"
                  className="text-[13px] leading-[18px] font-semibold text-info-text"
                >
                  Delegasikan ke
                </label>
                <Select value={penerimaId} onValueChange={setPenerimaId}>
                  <SelectTrigger
                    id="delegasi-todo"
                    className="h-12 w-full rounded-xl bg-card"
                  >
                    <SelectValue placeholder="Pilih anggota tim" />
                  </SelectTrigger>
                  <SelectContent>
                    {penerima.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.jabatan ? `${p.nama} · ${p.jabatan}` : p.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tanggalLama && tanggalLama < hariIni ? (
                  <p className="text-[11px] leading-[14px] text-pretty text-info-text">
                    Deadline lamanya sudah lewat, jadi diganti ke hari ini —
                    ubah di bagian Deadline bila perlu.
                  </p>
                ) : null}
                <p className="text-[11px] leading-[14px] text-pretty text-info-text">
                  To-do ini akan menjadi tiket dari kamu
                  {namaPenerima ? ` untuk ${namaPenerima}` : ""}. Deadline dan
                  deskripsinya ikut; ia mendapat notifikasi, dan hasilnya kamu
                  periksa (QC) seperti tiket biasa.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDelegasi(false);
                    setPenerimaId("");
                  }}
                  className="tekan-halus text-[11px] leading-[14px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
                >
                  Batal delegasi
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={mulaiDelegasi}
                className="tekan-halus h-11 w-full rounded-xl text-[13px] font-semibold"
              >
                <UserRoundPlus className="size-4" />
                Delegasikan ke bawahan
              </Button>
            )
          ) : null}

          {pesan ? (
            <p
              role="status"
              className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text"
            >
              {pesan}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              className="tekan-halus rounded-full"
            >
              Batal
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={!siap || menyimpan}
            onClick={simpan}
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            {menyimpan
              ? "Menyimpan…"
              : delegasi
                ? "Delegasikan"
                : ubah
                  ? "Simpan perubahan"
                  : "Simpan to-do"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
