"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { peringkatPeran } from "@/lib/peran";
import { URUTAN_PERAN } from "@/lib/peran";
import { ATASAN_UNTUK, atasanDisarankan, calonAtasan } from "@/lib/atasan";
import { tambahAnggota, ubahAnggota } from "@/app/actions/anggota";
import type {
  AnggotaTim,
  KodeUnit,
  Peran,
  PilihanOrganisasi,
} from "@/lib/types";

/** Peran yang bertugas di satu unit; sisanya bekerja lintas unit. */
const PERAN_BERUNIT: Peran[] = ["Leader", "Co-Leader", "Staff"];

export type MasukanAnggota = {
  nama: string;
  email: string;
  role: Peran;
  jabatan: string;
  unitKode: KodeUnit | null;
  departemenId: string | null;
  programId: string | null;
  atasanId?: string | null;
};

function Isian({
  awal,
  pilihan,
  onSimpan,
  menyimpan,
  pesan,
  calon,
}: {
  awal?: AnggotaTim;
  pilihan: PilihanOrganisasi;
  onSimpan: (data: MasukanAnggota) => void;
  menyimpan: boolean;
  pesan: string | null;
  /**
   * Calon atasan; hanya diberikan saat menambah anggota. Perubahan
   * atasan anggota lama punya dialognya sendiri yang memeriksa siklus.
   */
  calon?: AnggotaTim[];
}) {
  const [nama, setNama] = useState(awal?.nama ?? "");
  const [email, setEmail] = useState(awal?.email ?? "");
  const [role, setRole] = useState<Peran>(awal?.role ?? "Staff");
  const [jabatan, setJabatan] = useState(awal?.jabatan ?? "");
  const [unitKode, setUnitKode] = useState<KodeUnit | null>(
    awal?.unitKode ?? null,
  );
  const [departemenId, setDepartemenId] = useState<string | null>(
    awal?.departemenId ?? null,
  );
  const [programId, setProgramId] = useState<string | null>(
    awal?.programId ?? null,
  );
  const [atasanId, setAtasanId] = useState<string | null>(
    awal?.atasanId ?? null,
  );

  const butuhUnit = PERAN_BERUNIT.includes(role);
  // CEO memang tidak punya atasan; sisanya wajib.
  const butuhAtasan = Boolean(calon) && role !== "CEO";

  // Calon atasan mengikuti peran dan unit yang sedang dipilih — bukan
  // seluruh anggota — supaya hierarki (CEO → Manager → Leader →
  // Co-Leader → Staff) tidak bisa dilanggar dari formulir ini. Nama unit
  // dibaca persis seperti kartu anggota membacanya.
  const unitNamaDipilih = unitKode
    ? (pilihan.unit.find((u) => u.kode === unitKode)?.nama.split(" (")[0] ??
      "Manajemen")
    : "Manajemen";
  const sintetis = {
    id: awal?.id ?? "baru",
    nama: nama.trim() || "Anggota baru",
    role,
    unitNama: unitNamaDipilih,
  };
  const calonSah = calon ? calonAtasan(calon, sintetis, new Set()) : [];
  const usulan = calon ? atasanDisarankan(calon, sintetis) : null;
  // Pilihan yang tidak lagi sah setelah peran/unit berganti diganti
  // usulan, bukan dibiarkan diam-diam menunjuk orang yang salah.
  const atasanEfektif = calon
    ? atasanId && calonSah.some((c) => c.id === atasanId)
      ? atasanId
      : (usulan?.id ?? null)
    : atasanId;

  // Program menempel pada satu unit, jadi pilihannya menyempit mengikuti
  // unit yang sedang dipilih.
  const programUnit = unitKode
    ? pilihan.program.filter((p) => p.unitKode === unitKode)
    : [];
  const siap =
    nama.trim().length >= 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    jabatan.trim().length >= 3 &&
    (butuhUnit ? unitKode !== null : true) &&
    (butuhAtasan ? atasanEfektif !== null : true);

  // Peran lintas unit tidak boleh membawa unit; dibersihkan saat berganti.
  const gantiPeran = (p: Peran) => {
    setRole(p);
    if (!PERAN_BERUNIT.includes(p)) {
      setUnitKode(null);
      setProgramId(null);
    }
  };

  // Berpindah unit membuat program lama tak lagi berlaku.
  const gantiUnit = (kode: KodeUnit) => {
    setUnitKode(kode);
    setProgramId(null);
  };

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label
            htmlFor="nama-anggota"
            className="text-[13px] leading-[18px] font-semibold"
          >
            Nama lengkap
          </label>
          <input
            id="nama-anggota"
            value={nama}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => setNama(e.target.value)}
            placeholder="Mis. Anisa Larasati"
            className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="email-anggota"
            className="text-[13px] leading-[18px] font-semibold"
          >
            Email kantor
          </label>
          <input
            id="email-anggota"
            type="email"
            value={email}
            maxLength={120}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@alkahfi.co.id"
            className="h-12 w-full rounded-xl bg-muted px-4 text-[15px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            Email ini yang dipakainya masuk. Akun dibuat sendiri olehnya —
            aplikasi tidak pernah menyimpan kata sandi siapa pun.
          </p>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-[13px] leading-[18px] font-semibold">
            Peran
          </legend>
          <div className="flex flex-wrap gap-1">
            {URUTAN_PERAN.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => gantiPeran(p)}
                aria-pressed={p === role}
                className={cn(
                  "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                  p === role
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <label
            htmlFor="jabatan-anggota"
            className="text-[13px] leading-[18px] font-semibold"
          >
            Jabatan
          </label>
          <input
            id="jabatan-anggota"
            value={jabatan}
            maxLength={120}
            autoComplete="off"
            onChange={(e) => setJabatan(e.target.value)}
            placeholder="Mis. Staff Affiliator · Mabit Scholar"
            className="h-11 w-full rounded-xl bg-muted px-4 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-[13px] leading-[18px] font-semibold">
            Unit{" "}
            {butuhUnit ? null : (
              <span className="font-normal text-muted-foreground">
                (tidak berlaku untuk {role})
              </span>
            )}
          </legend>
          {butuhUnit ? (
            <div className="flex flex-wrap gap-1">
              {pilihan.unit.map((u) => (
                <button
                  key={u.kode}
                  type="button"
                  onClick={() => gantiUnit(u.kode)}
                  aria-pressed={u.kode === unitKode}
                  className={cn(
                    "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                    u.kode === unitKode
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {u.nama}
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-muted px-3 py-2 text-[11px] leading-[14px] text-muted-foreground">
              {role} bekerja lintas unit, jadi tidak ditempatkan di salah satu.
            </p>
          )}
        </fieldset>

        {butuhUnit && unitKode && programUnit.length > 0 ? (
          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Program{" "}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </legend>
            <div className="flex flex-wrap gap-1">
              {programUnit.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProgramId(programId === p.id ? null : p.id)}
                  aria-pressed={p.id === programId}
                  className={cn(
                    "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                    p.id === programId
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.nama}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        <fieldset className="space-y-1.5">
          <legend className="text-[13px] leading-[18px] font-semibold">
            Departemen{" "}
            <span className="font-normal text-muted-foreground">
              (opsional)
            </span>
          </legend>
          <div className="flex flex-wrap gap-1">
            {pilihan.departemen.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() =>
                  setDepartemenId(departemenId === d.id ? null : d.id)
                }
                aria-pressed={d.id === departemenId}
                className={cn(
                  "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold",
                  d.id === departemenId
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {d.nama}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-[14px] text-muted-foreground">
            Departemen bersifat organisatoris; yang menentukan pelaporan adalah
            unit.
          </p>
        </fieldset>

        {calon && role !== "CEO" ? (
          <fieldset className="space-y-1.5">
            <legend className="text-[13px] leading-[18px] font-semibold">
              Atasan langsung
            </legend>
            <select
              value={atasanEfektif ?? ""}
              onChange={(e) => setAtasanId(e.target.value || null)}
              aria-label="Atasan langsung"
              className="h-11 w-full rounded-xl bg-muted px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <option value="">Pilih atasan…</option>
              {calonSah.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nama} · {a.role}
                  {usulan?.id === a.id ? " · disarankan" : ""}
                </option>
              ))}
            </select>
            {calonSah.length === 0 ? (
              <p className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-pretty text-warn-text">
                Belum ada {ATASAN_UNTUK[role].join(" atau ")} aktif
                {butuhUnit && unitKode ? ` di ${unitNamaDipilih}` : ""}.
                Tetapkan dulu orangnya, baru anggota ini bisa ditambahkan.
              </p>
            ) : (
              <p className="text-[11px] leading-[14px] text-muted-foreground">
                {role} melapor kepada {ATASAN_UNTUK[role].join(" atau ")}
                {butuhUnit ? " di unitnya sendiri" : ""}. Atasan inilah yang
                menyetujui izinnya.
              </p>
            )}
          </fieldset>
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
          onClick={() =>
            onSimpan({
              nama,
              email,
              role,
              jabatan,
              unitKode,
              departemenId,
              programId,
              ...(calon
                ? { atasanId: role === "CEO" ? null : atasanEfektif }
                : {}),
            })
          }
          className="tekan-halus rounded-full"
        >
          {menyimpan ? <Loader2 className="size-4 animate-spin" /> : null}
          {menyimpan ? "Menyimpan…" : "Simpan"}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Tambah anggota baru. */
export function DialogTambahAnggota({
  pilihan,
  semua,
}: {
  pilihan: PilihanOrganisasi;
  /** Anggota yang ada, sebagai calon atasan orang baru ini. */
  semua: AnggotaTim[];
}) {
  const [buka, setBuka] = useState(false);
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
        >
          <Plus className="size-3.5" />
          Tambah anggota
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah anggota</DialogTitle>
          <DialogDescription>
            Perannya menentukan apa yang ia lihat dan boleh lakukan.
          </DialogDescription>
        </DialogHeader>

        <Isian
          pilihan={pilihan}
          menyimpan={menyimpan}
          pesan={pesan}
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
              const hasil = await tambahAnggota(data);
              if (hasil.ok || hasil.kode === "demo") {
                setBuka(false);
                if (!hasil.ok) setPesan(hasil.pesan ?? null);
                return;
              }
              setPesan(hasil.pesan ?? null);
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}

/** Ubah data anggota yang sudah ada. */
export function DialogUbahAnggota({
  anggota,
  pilihan,
  buka,
  onBuka,
}: {
  anggota: AnggotaTim;
  pilihan: PilihanOrganisasi;
  buka: boolean;
  onBuka: (b: boolean) => void;
}) {
  const [menyimpan, mulai] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  return (
    <Dialog open={buka} onOpenChange={onBuka}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah {anggota.nama}</DialogTitle>
          <DialogDescription>
            Mengubah peran langsung mengubah cakupan datanya.
          </DialogDescription>
        </DialogHeader>

        <Isian
          awal={anggota}
          pilihan={pilihan}
          menyimpan={menyimpan}
          pesan={pesan}
          onSimpan={(data) =>
            mulai(async () => {
              setPesan(null);
              const hasil = await ubahAnggota(anggota.id, data);
              if (hasil.ok || hasil.kode === "demo") {
                onBuka(false);
                if (!hasil.ok) setPesan(hasil.pesan ?? null);
                return;
              }
              setPesan(hasil.pesan ?? null);
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
