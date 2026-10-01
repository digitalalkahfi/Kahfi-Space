import { CalendarRange, CornerDownRight, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BarCapaian } from "@/components/motion/bar-capaian";
import { DialogUbahGoal } from "@/components/grd/dialog-ubah-goal";
import { DialogCatatCapaian } from "@/components/grd/dialog-catat-capaian";
import { TombolAktifkanGoal } from "@/components/grd/tombol-aktifkan-goal";
import { TombolHapusGoal } from "@/components/grd/tombol-hapus-goal";
import { cn } from "@/lib/utils";
import { persen, tanggalKalenderPendek } from "@/lib/format";
import {
  jumlahHariPeriode,
  keteranganTenggat,
  statusPeriode,
  tampilNilaiGoal,
} from "@/lib/goal";
import type { PilihanGoal, SimpulGoal } from "@/lib/data/goal";

/** Goal itu sendiri beserta seluruh turunannya. */
function idCabang(goal: SimpulGoal): string[] {
  return [goal.id, ...goal.anak.flatMap(idCabang)];
}

const LABEL_LEVEL: Record<SimpulGoal["level"], string> = {
  company: "Perusahaan",
  manager: "Manager",
  leader: "Unit",
  account: "Akun",
  staff: "Staf",
};

const GAYA_LEVEL: Record<SimpulGoal["level"], string> = {
  company: "bg-primary text-primary-foreground",
  manager: "bg-info-fill text-info-text",
  leader: "bg-accentmuted-fill text-accentmuted-text",
  account: "bg-warn-fill text-warn-text",
  staff: "bg-muted text-muted-foreground",
};

function Simpul({
  goal,
  dalam,
  acuan,
  pilihan,
}: {
  goal: SimpulGoal;
  dalam: number;
  acuan: string;
  /** Ada bila pembaca boleh mengubah dan menghapus goal (CEO/Manager). */
  pilihan: PilihanGoal | null;
}) {
  const kuat = goal.rasio >= 90;
  const sedang = goal.rasio >= 75;
  // Capaian hanya berarti di dalam periodenya: goal yang baru mulai
  // 15 Oktober belum punya target pada 10 Oktober, bukan gagal 0%.
  const status =
    goal.mulai && goal.selesai
      ? statusPeriode(goal.mulai, goal.selesai, acuan)
      : "berjalan";
  const tenggat =
    goal.mulai && goal.selesai
      ? keteranganTenggat(goal.mulai, goal.selesai, acuan)
      : null;
  // Capaian goal isian dicatat orang yang berwenang (boleh_isi_ukuran).
  const bolehCatat = goal.ukuran?.sumber === "isian" && goal.ukuran.bolehIsi;
  const adaTombol = Boolean(pilihan) || bolehCatat;
  // Baris yang membentang selebar kartu: dua kolom, atau tiga bila ada
  // kolom tombol di layar lebar.
  const lebarPenuh = adaTombol ? "col-span-2 sm:col-span-3" : "col-span-2";

  return (
    <li>
      <div
        className={cn(
          // Grid supaya tombol Ubah dan Hapus bisa berpindah tempat tanpa
          // digandakan: di HP turun ke baris bawah agar judul tidak
          // terhimpit, di layar lebar tetap di kanan atas.
          "baris-interaktif grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 rounded-2xl p-3.5",
          adaTombol && "sm:grid-cols-[minmax(0,1fr)_auto_auto]",
          dalam === 0 ? "bg-muted/70" : "bg-muted/40",
        )}
        // Indentasi menandai kedalaman roll-down; dibatasi agar tetap terbaca di HP.
        style={{ marginInlineStart: `${Math.min(dalam, 3) * 12}px` }}
      >
        <div className="col-start-1 row-start-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {dalam > 0 ? (
              <CornerDownRight className="size-3 shrink-0 text-muted-foreground" />
            ) : null}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] leading-[13px] font-semibold",
                GAYA_LEVEL[goal.level],
              )}
            >
              {LABEL_LEVEL[goal.level]}
            </span>
            {goal.kode ? (
              <span className="tabular rounded-full bg-card px-2 py-0.5 text-[10px] leading-[13px] font-semibold text-muted-foreground ring-1 ring-border-subtle">
                {goal.kode}
              </span>
            ) : null}
            {goal.status === "draft" ? (
              <span className="rounded-full bg-warn-fill px-2 py-0.5 text-[10px] leading-[13px] font-semibold text-warn-text">
                Usulan
              </span>
            ) : null}
            <p
              className={cn(
                "text-sm leading-5 font-semibold",
                goal.kode ? "line-clamp-2" : "truncate",
              )}
            >
              {goal.judul}
            </p>
          </div>
          <p className="tabular mt-0.5 text-[11px] leading-[14px] text-muted-foreground">
            {goal.pemilik}
            {goal.unit ? ` · ${goal.unit}` : ""}
            {goal.akun ? ` · ${goal.akun}` : ""}
            {status === "berjalan"
              ? ` · capaian ${tampilNilaiGoal(goal.realisasi, goal.satuan)} dari ${tampilNilaiGoal(goal.targetBulan, goal.satuan)}`
              : ""}
          </p>
          {goal.bulan.length > 0 || goal.tenggat ? (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[11px] leading-[14px] font-medium text-info-text ring-1 ring-border-subtle">
              <CalendarRange className="size-3 shrink-0" />
              {goal.bulan.length > 0
                ? goal.periode
                : `s.d. ${tanggalKalenderPendek(goal.tenggat ?? "")}`}
              {goal.bulan.length > 0 &&
              goal.tenggat &&
              goal.tenggat !== goal.selesai
                ? ` · tenggat ${tanggalKalenderPendek(goal.tenggat)}`
                : status === "berjalan" && tenggat
                  ? ` · ${tenggat}`
                  : goal.mulai && goal.selesai
                    ? ` · ${jumlahHariPeriode(goal.mulai, goal.selesai)} hari`
                    : ""}
            </p>
          ) : null}
          {goal.keterangan ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-[14px] text-muted-foreground">
              {goal.keterangan}
            </p>
          ) : null}
        </div>

        <div className="col-start-2 row-start-1">
          {status === "berjalan" ? (
            <span
              className={cn(
                "tabular text-[13px] leading-[18px] font-bold",
                kuat
                  ? "text-ok-text"
                  : sedang
                    ? "text-warn-text"
                    : "text-danger-text",
              )}
            >
              {persen(goal.rasio)}
            </span>
          ) : (
            <span className="text-[11px] leading-[18px] font-semibold text-muted-foreground">
              {tenggat}
            </span>
          )}
        </div>

        {status === "berjalan" ? (
          <BarCapaian
            rasio={goal.rasio}
            label={`Capaian ${goal.judul}`}
            warna={kuat ? "bg-ok" : sedang ? "bg-warn" : "bg-danger"}
            tinggi="h-1.5"
            className={cn("row-start-2 mt-2.5 bg-card", lebarPenuh)}
          />
        ) : null}

        {/* Di HP: target dan tombol berbagi satu baris di bawah. Di layar
            lebar pembungkus ini lebur (display: contents), sehingga tombol
            naik ke kanan atas dan barisnya tidak ikut melebarkan kolom. */}
        <div className="col-span-2 row-start-3 mt-1.5 flex items-center justify-between gap-2 sm:contents">
          <p
            className={cn(
              "tabular min-w-0 text-[11px] leading-[14px] text-muted-foreground sm:row-start-3 sm:mt-1.5",
              adaTombol ? "sm:col-span-3" : "sm:col-span-2",
            )}
          >
            Base {tampilNilaiGoal(goal.targetBase, goal.satuan)} · Goal{" "}
            {tampilNilaiGoal(goal.targetGoal, goal.satuan)}
            {goal.targetStretch !== goal.targetGoal
              ? ` · Stretch ${tampilNilaiGoal(goal.targetStretch, goal.satuan)}`
              : ""}
          </p>
          {pilihan || bolehCatat ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:col-start-3 sm:row-start-1 sm:self-start">
              {bolehCatat && goal.ukuran ? (
                <DialogCatatCapaian
                  ukuranId={goal.ukuran.id}
                  judul={goal.judul}
                  satuan={goal.satuan}
                  acuan={acuan}
                />
              ) : null}
              {pilihan && goal.status === "draft" ? (
                <TombolAktifkanGoal goalId={goal.id} judul={goal.judul} />
              ) : null}
              {/* Goal isian atau ber-base kosong tidak cocok dengan isian
                  rupiah dialog ubah; angkanya mengikuti file GRD. */}
              {pilihan &&
              goal.jenisRealisasi === "gmv" &&
              goal.targetBase !== null ? (
                <DialogUbahGoal
                  goal={goal}
                  pilihan={pilihan}
                  acuan={acuan}
                  kecualiInduk={idCabang(goal)}
                />
              ) : null}
              {pilihan ? (
                <TombolHapusGoal goalId={goal.id} judul={goal.judul} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {goal.anak.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {goal.anak.map((a) => (
            <Simpul
              key={a.id}
              goal={a}
              dalam={dalam + 1}
              acuan={acuan}
              pilihan={pilihan}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** Pohon goal berjenjang: perusahaan → manager → unit → akun. */
export function PohonGoal({
  pohon,
  acuan,
  pilihan = null,
}: {
  pohon: SimpulGoal[];
  /** Tanggal hari ini, dasar status periode tiap goal. */
  acuan: string;
  /** Bahan dialog ubah; hanya diisi untuk CEO/Manager. */
  pilihan?: PilihanGoal | null;
}) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start justify-between gap-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">Roll-down goal</h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Satu goal perusahaan diturunkan bertahap sampai ke akun.
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border-subtle">
          <Target className="size-4" />
        </span>
      </div>

      {pohon.length === 0 ? (
        <p className="px-5 text-[13px] leading-[18px] text-muted-foreground">
          Belum ada goal aktif. CEO atau Manager bisa membuatnya.
        </p>
      ) : (
        <ul className="space-y-2 px-5">
          {pohon.map((g) => (
            <Simpul
              key={g.id}
              goal={g}
              dalam={0}
              acuan={acuan}
              pilihan={pilihan}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
