"use client";

import { useState, useTransition } from "react";
import { Loader2, TicketPlus } from "lucide-react";
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
import { buatTiket } from "@/app/actions/tugas";
import type { Pengguna, Prioritas } from "@/lib/types";
import type { GoalRingkas } from "@/lib/data/goal";

const PRIORITAS: { nilai: Prioritas; label: string }[] = [
  { nilai: "tinggi", label: "Tinggi" },
  { nilai: "sedang", label: "Sedang" },
  { nilai: "rendah", label: "Rendah" },
];

/**
 * Buat tiket untuk anggota tim — pengganti "tugas lewat grup WA" (PRD §1).
 * Daftar penerima hanya berisi orang yang memang boleh ditugasi.
 *
 * Tanggal dan jam tenggat wajib (D3). Tiket biasa bawaannya hari ini;
 * komitmen mingguan bawaannya akhir pekan (Sabtu) — keduanya boleh diganti.
 */
export function DialogTiket({
  penerima,
  goal,
  hariIni,
  tanggalAwal,
  akhirPekan,
}: {
  penerima: Pengguna[];
  /** Goal aktif untuk menautkan komitmen mingguan. */
  goal: GoalRingkas[];
  /** Hari ini (WIB) — tanggal paling awal yang boleh dipilih. */
  hariIni: string;
  /** Tanggal bawaan tiket biasa; tidak pernah sebelum hari ini. */
  tanggalAwal: string;
  /** Tanggal akhir pekan berjalan — tenggat bawaan komitmen. */
  akhirPekan: string;
}) {
  const [buka, setBuka] = useState(false);
  const [tipe, setTipe] = useState<"tiket" | "komitmen_mingguan">("tiket");
  const [goalId, setGoalId] = useState("");
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [penerimaId, setPenerimaId] = useState("");
  const [tanggal, setTanggal] = useState(tanggalAwal);
  // Tanggal yang sudah dipilih sendiri tidak ditimpa bawaan saat jenisnya
  // diganti.
  const [tanggalDipilih, setTanggalDipilih] = useState(false);
  const [jam, setJam] = useState("17:00");
  const [prioritas, setPrioritas] = useState<Prioritas>("sedang");
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const komitmen = tipe === "komitmen_mingguan";
  const siap =
    judul.trim().length >= 3 &&
    penerimaId !== "" &&
    tanggal !== "" &&
    jam !== "" &&
    (!komitmen || goalId !== "");

  const bawaanTanggal = (t: typeof tipe) =>
    t === "komitmen_mingguan" ? akhirPekan : tanggalAwal;

  const pilihTipe = (t: typeof tipe) => {
    setTipe(t);
    if (!tanggalDipilih) setTanggal(bawaanTanggal(t));
  };

  const bukaTutup = (b: boolean) => {
    if (b) {
      setTanggal(bawaanTanggal(tipe));
      setTanggalDipilih(false);
    }
    setBuka(b);
  };

  const simpan = () => {
    if (!siap || menyimpan) return;
    setPesan(null);

    mulai(async () => {
      const hasil = await buatTiket({
        judul,
        deskripsi,
        penerimaId,
        tipe,
        goalId: komitmen ? goalId : null,
        tanggal,
        jam,
        prioritas,
      });

      if (hasil.ok || hasil.kode === "demo") {
        setJudul("");
        setDeskripsi("");
        setPenerimaId("");
        setBuka(false);
        if (!hasil.ok) setPesan(hasil.pesan);
        return;
      }
      setPesan(hasil.pesan);
    });
  };

  if (penerima.length === 0) return null;

  return (
    <Dialog open={buka} onOpenChange={bukaTutup}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          <TicketPlus className="size-3.5" />
          Buat tiket
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buat tiket</DialogTitle>
          <DialogDescription>
            Tiket masuk ke daftar tugas penerima, lengkap dengan alur
            pemeriksaan (QC) saat ia menyelesaikannya.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Jenis
            </legend>
            <div className="flex gap-2">
              {(
                [
                  { nilai: "tiket", label: "Tiket biasa" },
                  { nilai: "komitmen_mingguan", label: "Komitmen mingguan" },
                ] as const
              ).map((o) => (
                <button
                  key={o.nilai}
                  type="button"
                  onClick={() => pilihTipe(o.nilai)}
                  aria-pressed={tipe === o.nilai}
                  disabled={
                    o.nilai === "komitmen_mingguan" && goal.length === 0
                  }
                  className={cn(
                    "tekan-halus h-11 flex-1 rounded-xl text-[11px] font-semibold disabled:opacity-50",
                    tipe === o.nilai
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {komitmen ? (
              <p className="text-[11px] leading-[14px] text-muted-foreground">
                Komitmen mingguan menempel pada sebuah goal dan dinilai di
                laporan mingguan GRD.
              </p>
            ) : null}
          </fieldset>

          {komitmen ? (
            <div className="space-y-1.5">
              <label
                htmlFor="goal-tiket"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Goal yang dituju
              </label>
              <Select value={goalId} onValueChange={setGoalId}>
                <SelectTrigger
                  id="goal-tiket"
                  className="h-12 w-full rounded-xl"
                >
                  <SelectValue placeholder="Pilih goal" />
                </SelectTrigger>
                <SelectContent>
                  {goal.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.judul} · {g.periode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label
              htmlFor="penerima-tiket"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Penerima
            </label>
            <Select value={penerimaId} onValueChange={setPenerimaId}>
              <SelectTrigger
                id="penerima-tiket"
                className="h-12 w-full rounded-xl"
              >
                <SelectValue placeholder="Pilih anggota tim" />
              </SelectTrigger>
              <SelectContent>
                {penerima.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nama} · {p.jabatan}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="judul-tiket"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Judul tiket
            </label>
            <input
              id="judul-tiket"
              value={judul}
              maxLength={200}
              autoComplete="off"
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Mis. audit GMV akun beauty"
              className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="deskripsi-tiket"
              className="text-[13px] leading-[18px] font-semibold"
            >
              Rincian{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </label>
            <textarea
              id="deskripsi-tiket"
              rows={3}
              maxLength={600}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Jelaskan hasil yang diharapkan agar QC-nya jelas."
              className="w-full resize-none rounded-xl bg-muted px-4 py-3 text-[13px] leading-[18px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="tanggal-tiket"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Tanggal tenggat
              </label>
              <input
                id="tanggal-tiket"
                type="date"
                required
                min={hariIni}
                value={tanggal}
                onChange={(e) => {
                  setTanggal(e.target.value);
                  setTanggalDipilih(true);
                }}
                className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="jam-tiket"
                className="text-[13px] leading-[18px] font-semibold"
              >
                Jam
              </label>
              <input
                id="jam-tiket"
                type="time"
                required
                value={jam}
                onChange={(e) => setJam(e.target.value)}
                className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          </div>
          {komitmen && !tanggalDipilih ? (
            <p className="-mt-1.5 text-[11px] leading-[14px] text-muted-foreground">
              Bawaannya akhir pekan ini (Sabtu); boleh diganti.
            </p>
          ) : null}

          <div>
            <fieldset className="space-y-1.5">
              <legend className="text-[13px] leading-[18px] font-semibold">
                Prioritas
              </legend>
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
          </div>

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
              ? "Mengirim…"
              : komitmen
                ? "Kirim komitmen"
                : "Kirim tiket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
