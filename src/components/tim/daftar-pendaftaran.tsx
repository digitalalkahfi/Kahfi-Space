"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Loader2, UserPlus, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Isian } from "@/components/tim/dialog-anggota";
import {
  sambungkanPendaftaran,
  setujuiPendaftaranBaru,
  tolakPendaftaran,
} from "@/app/actions/anggota";
import { ALASAN_TOLAK_MIN, namaUnitDaftar } from "@/lib/pendaftaran";
import { peringkatPeran } from "@/lib/peran";
import type { Pendaftaran } from "@/lib/data/pendaftaran";
import type { AnggotaTim, PilihanOrganisasi } from "@/lib/types";

const FORMAT_WAKTU = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function waktu(iso: string | null) {
  return iso ? FORMAT_WAKTU.format(new Date(iso)) : "—";
}

/**
 * Daftar pendaftaran Google untuk CEO/Manager — berbentuk kartu supaya
 * nyaman di HP (E11). Tombolnya hanya untuk tab Menunggu dan Ditolak;
 * tab Disetujui murni catatan.
 */
export function DaftarPendaftaran({
  daftar,
  status,
  pilihan,
  semua,
  bisaDisambung,
}: {
  daftar: Pendaftaran[];
  status: "menunggu" | "ditolak" | "disetujui";
  pilihan: PilihanOrganisasi;
  /** Anggota yang ada, sebagai calon atasan. */
  semua: AnggotaTim[];
  /** Profil aktif tanpa akun login (BR-05). */
  bisaDisambung: AnggotaTim[];
}) {
  if (daftar.length === 0) {
    return (
      <p className="rounded-3xl bg-card px-5 py-4 text-[13px] leading-[18px] text-muted-foreground ring-1 ring-border-subtle">
        {status === "menunggu"
          ? "Tidak ada yang menunggu."
          : status === "ditolak"
            ? "Belum ada pendaftaran yang ditolak."
            : "Belum ada pendaftaran yang disetujui."}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {daftar.map((p) => (
        <li key={p.id}>
          <KartuPendaftaran
            p={p}
            pilihan={pilihan}
            semua={semua}
            bisaDisambung={bisaDisambung}
          />
        </li>
      ))}
    </ul>
  );
}

function KartuPendaftaran({
  p,
  pilihan,
  semua,
  bisaDisambung,
}: {
  p: Pendaftaran;
  pilihan: PilihanOrganisasi;
  semua: AnggotaTim[];
  bisaDisambung: AnggotaTim[];
}) {
  const [dialog, setDialog] = useState<"setuju" | "tolak" | null>(null);
  const bisaPutuskan = p.status === "menunggu" || p.status === "ditolak";

  return (
    <div className="space-y-3 rounded-3xl bg-card p-4 ring-1 ring-border-subtle">
      <div className="flex items-start gap-3">
        {p.fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto dari Google, ukuran kecil
          <img
            src={p.fotoUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="size-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-semibold">
            {p.namaGoogle.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-5 font-semibold">{p.namaGoogle}</p>
          <p className="truncate text-[11px] leading-[14px] text-muted-foreground">
            {p.email}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-[12px] leading-[16px] sm:grid-cols-2">
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-muted-foreground">No. WhatsApp</dt>
          <dd className={cn("font-semibold", !p.noWa && "text-warn-text")}>
            {p.noWa ?? "belum diisi"}
          </dd>
        </div>
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-muted-foreground">Divisi diajukan</dt>
          <dd className="font-semibold">{namaUnitDaftar(p.unitDiajukan) ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-muted-foreground">Mendaftar</dt>
          <dd>{waktu(p.dibuatPada)}</dd>
        </div>
        {p.status !== "menunggu" ? (
          <div className="flex justify-between gap-2 sm:block">
            <dt className="text-muted-foreground">
              {p.status === "ditolak" ? "Ditolak" : "Disetujui"}
            </dt>
            <dd>
              {p.diputuskanOleh ?? "—"} · {waktu(p.diputuskanPada)}
              {p.cara ? ` · ${p.cara === "baru" ? "anggota baru" : "disambungkan"}` : ""}
            </dd>
          </div>
        ) : null}
      </dl>

      {p.catatan ? (
        <p className="rounded-xl bg-muted/60 px-3 py-2 text-[12px] leading-[16px] text-pretty">
          {p.catatan}
        </p>
      ) : null}
      {p.status === "ditolak" && p.alasanTolak ? (
        <p className="rounded-xl bg-danger-fill px-3 py-2 text-[12px] leading-[16px] text-danger-text">
          Alasan: {p.alasanTolak}
        </p>
      ) : null}

      {bisaPutuskan ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => setDialog("setuju")}
            className="tekan-halus h-9 rounded-full px-4 text-[12px] font-semibold"
          >
            <Check className="size-3.5" />
            Setujui
          </Button>
          {p.status === "menunggu" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog("tolak")}
              className="tekan-halus h-9 rounded-full px-4 text-[12px] font-semibold"
            >
              <X className="size-3.5" />
              Tolak
            </Button>
          ) : null}
        </div>
      ) : null}

      {dialog === "setuju" ? (
        <DialogSetujui
          p={p}
          pilihan={pilihan}
          semua={semua}
          bisaDisambung={bisaDisambung}
          onTutup={() => setDialog(null)}
        />
      ) : null}
      {dialog === "tolak" ? (
        <DialogTolak p={p} onTutup={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

function DialogSetujui({
  p,
  pilihan,
  semua,
  bisaDisambung,
  onTutup,
}: {
  p: Pendaftaran;
  pilihan: PilihanOrganisasi;
  semua: AnggotaTim[];
  bisaDisambung: AnggotaTim[];
  onTutup: () => void;
}) {
  const router = useRouter();
  const [cara, setCara] = useState<"baru" | "sambung">("baru");
  const [profilId, setProfilId] = useState("");
  const [pesan, setPesan] = useState<string | null>(null);
  const [menyimpan, mulai] = useTransition();
  const statusAwal = p.status === "ditolak" ? "ditolak" : "menunggu";

  const selesai = (hasil: { ok: boolean; pesan?: string; kode?: string }) => {
    if (hasil.ok || hasil.kode === "demo") {
      onTutup();
      router.refresh();
      return;
    }
    setPesan(hasil.pesan ?? null);
  };

  return (
    <Dialog open onOpenChange={(b) => (b ? null : onTutup())}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Setujui {p.namaGoogle}</DialogTitle>
          <DialogDescription>
            Pastikan dulu lewat WhatsApp bahwa ini memang orangnya.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
          {(
            [
              ["baru", "Anggota baru", UserPlus],
              ["sambung", "Sambungkan ke profil", Link2],
            ] as const
          ).map(([nilai, label, Ikon]) => (
            <button
              key={nilai}
              type="button"
              aria-pressed={cara === nilai}
              onClick={() => {
                setCara(nilai);
                setPesan(null);
              }}
              className={cn(
                "tekan-halus flex h-10 items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold",
                cara === nilai
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              <Ikon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {cara === "baru" ? (
          <Isian
            pilihan={pilihan}
            menyimpan={menyimpan}
            pesan={pesan}
            emailTetap={p.email}
            namaAwal={p.namaGoogle}
            labelSimpan="Setujui"
            calon={semua
              .filter((a) => a.status === "aktif")
              .sort(
                (a, b) =>
                  peringkatPeran(a.role) - peringkatPeran(b.role) ||
                  a.nama.localeCompare(b.nama),
              )}
            onSimpan={(data) =>
              mulai(async () => {
                setPesan(null);
                selesai(await setujuiPendaftaranBaru(p.id, statusAwal, data));
              })
            }
          />
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor={`profil-${p.id}`}
                className="text-[13px] leading-[18px] font-semibold"
              >
                Profil yang sudah ada
              </label>
              <select
                id={`profil-${p.id}`}
                value={profilId}
                onChange={(e) => setProfilId(e.target.value)}
                className="h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <option value="">Pilih profil…</option>
                {bisaDisambung.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nama} · {a.role} · {a.unitNama}
                  </option>
                ))}
              </select>
              <p className="text-[11px] leading-[14px] text-muted-foreground">
                Hanya profil aktif yang belum punya akun login. Email profilnya
                diganti menjadi {p.email}; riwayatnya (tiket, absensi, KPI)
                tetap utuh.
              </p>
            </div>

            {pesan ? (
              <p
                role="status"
                className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text"
              >
                {pesan}
              </p>
            ) : null}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" className="tekan-halus rounded-full">
                  Batal
                </Button>
              </DialogClose>
              <Button
                type="button"
                disabled={!profilId || menyimpan}
                onClick={() =>
                  mulai(async () => {
                    setPesan(null);
                    selesai(await sambungkanPendaftaran(p.id, statusAwal, profilId));
                  })
                }
                className="tekan-halus rounded-full"
              >
                {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
                {menyimpan ? "Menyimpan…" : "Sambungkan & setujui"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DialogTolak({ p, onTutup }: { p: Pendaftaran; onTutup: () => void }) {
  const router = useRouter();
  const [alasan, setAlasan] = useState("");
  const [pesan, setPesan] = useState<string | null>(null);
  const [menyimpan, mulai] = useTransition();

  return (
    <Dialog open onOpenChange={(b) => (b ? null : onTutup())}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tolak {p.namaGoogle}</DialogTitle>
          <DialogDescription>
            Alasannya ditampilkan kepada orang ini. Ia tidak bisa mengajukan
            ulang sendiri; kamu masih bisa menyetujuinya nanti dari tab Ditolak.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label htmlFor={`alasan-${p.id}`} className="text-[13px] leading-[18px] font-semibold">
            Alasan penolakan
          </label>
          <textarea
            id={`alasan-${p.id}`}
            value={alasan}
            rows={3}
            maxLength={300}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder={`Minimal ${ALASAN_TOLAK_MIN} huruf, mis. "Bukan anggota tim"`}
            className="w-full rounded-xl bg-muted px-4 py-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        {pesan ? (
          <p role="status" className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text">
            {pesan}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="tekan-halus rounded-full">
              Batal
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={menyimpan}
            onClick={() =>
              mulai(async () => {
                setPesan(null);
                const hasil = await tolakPendaftaran(p.id, alasan);
                if (hasil.ok || hasil.kode === "demo") {
                  onTutup();
                  router.refresh();
                  return;
                }
                setPesan(hasil.pesan);
              })
            }
            className="tekan-halus rounded-full"
          >
            {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
            Tolak
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
