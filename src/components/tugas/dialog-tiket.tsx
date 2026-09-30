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
import { keJamWib, keTanggalWib, tanggalKalenderPendek } from "@/lib/format";
import { MIN_KRITERIA } from "@/lib/validasi-tugas";
import { buatTiket, hitungBebanPenerima, ubahTiket } from "@/app/actions/tugas";
import type { Pengguna, Prioritas, Tugas } from "@/lib/types";
import type { GoalRingkas } from "@/lib/data/goal";

const PRIORITAS: { nilai: Prioritas; label: string }[] = [
  { nilai: "tinggi", label: "Tinggi" },
  { nilai: "sedang", label: "Sedang" },
  { nilai: "rendah", label: "Rendah" },
];

/** Nilai pilihan "tanpa goal"; Select tidak menerima nilai kosong. */
const TANPA_GOAL = "__tanpa_goal__";

/**
 * Buat tiket untuk anggota tim — pengganti "tugas lewat grup WA" (PRD §1).
 * Daftar penerima hanya berisi orang yang memang boleh ditugasi.
 *
 * Isiannya disusun SMART (D5):
 *   S — judul (kata kerja + objek) dan hasil akhir yang diharapkan;
 *   M — kriteria selesai (wajib) dan target angka + satuan (opsional);
 *   A — info beban penerima di tanggal itu, sekadar info;
 *   R — goal terkait: wajib untuk komitmen, opsional untuk tiket (D6);
 *   T — tanggal dan jam tenggat, keduanya wajib (D3). Tiket biasa
 *       bawaannya hari ini; komitmen bawaannya akhir pekan (Sabtu).
 *
 * Dengan `ubah`, isian yang sama dipakai pemberi tiket untuk mengedit
 * tiketnya: terisi nilainya sekarang, jenisnya tetap, dan penerimanya
 * hanya bisa diganti selama tiket belum mulai dikerjakan (0184).
 */
export function DialogTiket({
  penerima,
  goal,
  hariIni,
  tanggalAwal,
  akhirPekan,
  ubah,
  onTutup,
}: {
  penerima: Pengguna[];
  /** Goal aktif untuk menautkan komitmen mingguan atau tiket. */
  goal: GoalRingkas[];
  /** Hari ini (WIB) — tanggal paling awal yang boleh dipilih. */
  hariIni: string;
  /** Tanggal bawaan tiket biasa; tidak pernah sebelum hari ini. */
  tanggalAwal: string;
  /** Tanggal akhir pekan berjalan — tenggat bawaan komitmen. */
  akhirPekan: string;
  /** Tiket yang diedit; tanpa ini dialognya membuat tiket baru. */
  ubah?: Tugas;
  /** Mode edit: dipanggil saat dialog ditutup. */
  onTutup?: () => void;
}) {
  const tanggalLama = ubah?.tenggat ? keTanggalWib(ubah.tenggat) : "";
  const [buka, setBuka] = useState(ubah !== undefined);
  const [tipe, setTipe] = useState<"tiket" | "komitmen_mingguan">(
    ubah?.tipe === "komitmen_mingguan" ? "komitmen_mingguan" : "tiket",
  );
  const [goalId, setGoalId] = useState(ubah?.goalId ?? "");
  const [judul, setJudul] = useState(ubah?.judul ?? "");
  const [deskripsi, setDeskripsi] = useState(ubah?.deskripsi ?? "");
  const [kriteria, setKriteria] = useState(ubah?.kriteriaSelesai ?? "");
  const [targetAngka, setTargetAngka] = useState(
    ubah?.targetAngka != null ? String(ubah.targetAngka) : "",
  );
  const [targetSatuan, setTargetSatuan] = useState(ubah?.targetSatuan ?? "");
  const [penerimaId, setPenerimaId] = useState(ubah?.penerimaId ?? "");
  const [tanggal, setTanggal] = useState(tanggalLama || tanggalAwal);
  // Tanggal yang sudah dipilih sendiri tidak ditimpa bawaan saat jenisnya
  // diganti.
  const [tanggalDipilih, setTanggalDipilih] = useState(ubah !== undefined);
  const [jam, setJam] = useState(
    ubah?.tenggat && !ubah.tanpaJam ? keJamWib(ubah.tenggat) : "17:00",
  );
  const [prioritas, setPrioritas] = useState<Prioritas>(
    ubah?.prioritas ?? "sedang",
  );
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);
  // Beban penerima per "penerima|tanggal": jawaban yang datang terlambat
  // untuk pilihan lama tidak menimpa jawaban pilihan yang sekarang.
  const [beban, setBeban] = useState<Record<string, number>>({});
  const [, mulaiBeban] = useTransition();

  const komitmen = tipe === "komitmen_mingguan";
  // Yang sudah mulai dikerjakan tidak dipindah tangan (0184).
  const penerimaTerkunci = ubah !== undefined && ubah.statusAsli !== "todo";
  // Tiket terlambat yang diedit: tanggal lamanya tetap boleh terpilih.
  const tanggalMin =
    tanggalLama && tanggalLama < hariIni ? tanggalLama : hariIni;

  // Penerima & goal tiket yang diedit selalu ada di pilihan, walau sudah
  // tidak lagi termasuk daftar bawaan (mis. goal-nya tidak aktif lagi).
  const opsiPenerima =
    ubah && !penerima.some((p) => p.id === ubah.penerimaId)
      ? [
          { id: ubah.penerimaId, nama: ubah.penerimaLengkap, jabatan: "" },
          ...penerima,
        ]
      : penerima;
  const opsiGoal =
    ubah?.goalId && !goal.some((g) => g.id === ubah.goalId)
      ? [
          {
            id: ubah.goalId,
            judul: ubah.goalJudul ?? "Goal saat ini",
            periode: ubah.goalPeriode ?? "",
          },
          ...goal,
        ]
      : goal;

  // Tiket lama yang belum berkriteria (sebelum 0183) tidak dipaksa saat
  // diedit — sama seperti basis data; yang diisi tetap harus layak.
  const kriteriaLamaKosong = ubah !== undefined && !ubah.kriteriaSelesai.trim();
  const kriteriaSah =
    kriteria.trim().length >= MIN_KRITERIA ||
    (kriteriaLamaKosong && kriteria.trim() === "");

  const siap =
    judul.trim().length >= 3 &&
    penerimaId !== "" &&
    kriteriaSah &&
    tanggal !== "" &&
    jam !== "" &&
    (!komitmen || goalId !== "");

  const namaPenerima = opsiPenerima.find((p) => p.id === penerimaId)?.nama;
  const bebanKini = beban[`${penerimaId}|${tanggal}`];

  const muatBeban = (pid: string, tgl: string) => {
    if (!pid || !tgl) return;
    const kunci = `${pid}|${tgl}`;
    mulaiBeban(async () => {
      const r = await hitungBebanPenerima(pid, tgl);
      if (r.ok) setBeban((b) => ({ ...b, [kunci]: r.data }));
    });
  };

  const bawaanTanggal = (t: typeof tipe) =>
    t === "komitmen_mingguan" ? akhirPekan : tanggalAwal;

  const gantiTanggal = (t: string) => {
    setTanggal(t);
    muatBeban(penerimaId, t);
  };

  const pilihTipe = (t: typeof tipe) => {
    setTipe(t);
    // Komitmen wajib bergoal; pilihan "tanpa goal" milik tiket biasa tidak
    // boleh terbawa.
    if (t === "komitmen_mingguan" && goalId === TANPA_GOAL) setGoalId("");
    if (!tanggalDipilih) gantiTanggal(bawaanTanggal(t));
  };

  const pilihPenerima = (id: string) => {
    setPenerimaId(id);
    muatBeban(id, tanggal);
  };

  const bukaTutup = (b: boolean) => {
    if (ubah) {
      setBuka(b);
      if (!b) onTutup?.();
      return;
    }
    if (b) {
      const t = bawaanTanggal(tipe);
      setTanggal(t);
      setTanggalDipilih(false);
      muatBeban(penerimaId, t);
    }
    setBuka(b);
  };

  const simpan = () => {
    if (!siap || menyimpan) return;
    setPesan(null);

    mulai(async () => {
      const isian = {
        judul,
        deskripsi,
        kriteriaSelesai: kriteria,
        targetAngka,
        targetSatuan,
        penerimaId,
        goalId: goalId && goalId !== TANPA_GOAL ? goalId : null,
        tanggal,
        jam,
        prioritas,
      };

      if (ubah) {
        const hasil = await ubahTiket(ubah.id, isian);
        if (hasil.ok) bukaTutup(false);
        else setPesan(hasil.pesan);
        return;
      }

      const hasil = await buatTiket({ ...isian, tipe });

      if (hasil.ok || hasil.kode === "demo") {
        setJudul("");
        setDeskripsi("");
        setKriteria("");
        setTargetAngka("");
        setTargetSatuan("");
        setPenerimaId("");
        setBuka(false);
        if (!hasil.ok) setPesan(hasil.pesan);
        return;
      }
      setPesan(hasil.pesan);
    });
  };

  if (!ubah && penerima.length === 0) return null;

  const labelIsian = "text-[13px] leading-[18px] font-semibold";
  const opsional = (
    <span className="font-normal text-muted-foreground">(opsional)</span>
  );

  return (
    <Dialog open={buka} onOpenChange={bukaTutup}>
      {ubah ? null : (
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
      )}

      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {ubah ? (komitmen ? "Edit komitmen" : "Edit tiket") : "Buat tiket"}
          </DialogTitle>
          <DialogDescription>
            {ubah
              ? "Penerima diberi tahu apa saja yang berubah."
              : "Tiket masuk ke daftar tugas penerima, lengkap dengan alur pemeriksaan (QC) saat ia menyelesaikannya."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Jenisnya tidak diubah lewat edit: komitmen menempel pada goal
              dan laporan mingguannya. */}
          {ubah ? null : (
            <fieldset className="space-y-1.5">
              <legend className={labelIsian}>Jenis</legend>
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
          )}

          <div className="space-y-1.5">
            <label htmlFor="penerima-tiket" className={labelIsian}>
              Penerima
            </label>
            <Select
              value={penerimaId}
              onValueChange={pilihPenerima}
              disabled={penerimaTerkunci}
            >
              <SelectTrigger
                id="penerima-tiket"
                className="h-12 w-full rounded-xl"
              >
                <SelectValue placeholder="Pilih anggota tim" />
              </SelectTrigger>
              <SelectContent>
                {opsiPenerima.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.jabatan ? `${p.nama} · ${p.jabatan}` : p.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {penerimaTerkunci ? (
              <p className="text-[11px] leading-[14px] text-muted-foreground">
                Penerima tidak bisa diganti karena tiket ini sudah mulai
                dikerjakan.
              </p>
            ) : null}
            {/* A — dapat dicapai: sekadar info, tidak memblokir. */}
            {namaPenerima && tanggal && bebanKini !== undefined ? (
              <p
                role="status"
                className="text-[11px] leading-[14px] text-muted-foreground"
              >
                <span className="font-semibold text-foreground">
                  {namaPenerima}
                </span>{" "}
                punya {bebanKini} tiket aktif bertenggat{" "}
                {tanggalKalenderPendek(tanggal, hariIni)}.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="judul-tiket" className={labelIsian}>
              Judul tiket
            </label>
            <input
              id="judul-tiket"
              value={judul}
              maxLength={200}
              autoComplete="off"
              onChange={(e) => setJudul(e.target.value)}
              placeholder="Kata kerja + objek, mis. Audit GMV 5 akun beauty"
              className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="deskripsi-tiket" className={labelIsian}>
              Hasil akhir yang diharapkan {opsional}
            </label>
            <textarea
              id="deskripsi-tiket"
              rows={2}
              maxLength={600}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Mis. laporan deviasi komisi per kreator, siap dipakai rekonsiliasi."
              className="w-full resize-none rounded-xl bg-muted px-4 py-3 text-[13px] leading-[18px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="kriteria-tiket" className={labelIsian}>
              Kriteria selesai
            </label>
            <textarea
              id="kriteria-tiket"
              rows={2}
              maxLength={600}
              required={!kriteriaLamaKosong}
              value={kriteria}
              onChange={(e) => setKriteria(e.target.value)}
              placeholder="Tiket dianggap selesai bila …"
              aria-describedby="kriteria-tiket-bantuan"
              className="w-full resize-none rounded-xl bg-muted px-4 py-3 text-[13px] leading-[18px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <p
              id="kriteria-tiket-bantuan"
              className="text-[11px] leading-[14px] text-muted-foreground"
            >
              {kriteriaLamaKosong
                ? "Tiket lama ini belum punya kriteria selesai. Sebaiknya diisi supaya pemeriksa punya ukuran saat QC."
                : "Pemeriksa menilai hasil kerja terhadap kriteria ini saat QC."}
            </p>
          </div>

          <fieldset className="space-y-1.5">
            <legend className={labelIsian}>Target {opsional}</legend>
            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={targetAngka}
                onChange={(e) => setTargetAngka(e.target.value)}
                placeholder="5"
                aria-label="Angka target"
                className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <input
                value={targetSatuan}
                maxLength={40}
                autoComplete="off"
                onChange={(e) => setTargetSatuan(e.target.value)}
                placeholder="Satuan, mis. akun"
                aria-label="Satuan target"
                className="h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor="goal-tiket" className={labelIsian}>
              {komitmen ? "Goal yang dituju" : "Goal terkait"}{" "}
              {komitmen ? null : opsional}
            </label>
            <Select value={goalId} onValueChange={setGoalId}>
              <SelectTrigger id="goal-tiket" className="h-12 w-full rounded-xl">
                <SelectValue
                  placeholder={komitmen ? "Pilih goal" : "Tanpa goal"}
                />
              </SelectTrigger>
              <SelectContent>
                {komitmen ? null : (
                  <SelectItem value={TANPA_GOAL}>Tanpa goal</SelectItem>
                )}
                {opsiGoal.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.periode ? `${g.judul} · ${g.periode}` : g.judul}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="tanggal-tiket" className={labelIsian}>
                Tanggal tenggat
              </label>
              <input
                id="tanggal-tiket"
                type="date"
                required
                min={tanggalMin}
                value={tanggal}
                onChange={(e) => {
                  gantiTanggal(e.target.value);
                  setTanggalDipilih(true);
                }}
                className="tabular h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="jam-tiket" className={labelIsian}>
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

          <fieldset className="space-y-1.5">
            <legend className={labelIsian}>Prioritas</legend>
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
              ? ubah
                ? "Menyimpan…"
                : "Mengirim…"
              : ubah
                ? "Simpan perubahan"
                : komitmen
                  ? "Kirim komitmen"
                  : "Kirim tiket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
