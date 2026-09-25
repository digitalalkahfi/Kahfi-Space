import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Reveal } from "@/components/motion/reveal";
import {
  DaftarPenjual,
  RingkasanPenjual,
} from "@/components/penjual/daftar-penjual";
import { DialogTambahPenjual } from "@/components/penjual/dialog-penjual";
import { SaringPenjual } from "@/components/penjual/saring-penjual";
import { TANGGAL_ACUAN } from "@/lib/data/contoh";
import { pilihanOrganisasi } from "@/lib/data/organisasi";
import { daftarPenjual } from "@/lib/data/penjual";
import { daftarAnggota, peranValid, sesiSaatIni } from "@/lib/data/sesi";
import { bacaSaringanPenjual, izinPenjual, saringPenjual } from "@/lib/penjual";
import { modeData } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Penjual — K-Space V2",
  description: "Mitra seller dan brand yang dijajaki dan digarap tiap unit.",
};

export default async function PenjualPage({
  searchParams,
}: PageProps<"/penjual">) {
  const params = await searchParams;
  const { persona } = params;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  const [semua, pilihan, anggota] = await Promise.all([
    daftarPenjual(pengguna),
    pilihanOrganisasi(),
    daftarAnggota(),
  ]);

  const saringan = bacaSaringanPenjual(params);
  const daftar = saringPenjual(semua, saringan);
  const izin = izinPenjual(pengguna);
  // Leader/Co-Leader hanya untuk unitnya; CEO/Manager bebas memilih.
  const unitTerkunci = izin.pengelola ? null : pengguna.unitId;

  const unit = [...new Set(semua.map((p) => p.unitNama))].sort();
  const kategori = [
    ...new Set(semua.map((p) => p.kategori).filter((k) => k !== "")),
  ].sort();
  const acuan =
    modeData() === "demo"
      ? `${TANGGAL_ACUAN}T12:00:00+07:00`
      : new Date().toISOString();
  const calonPic = anggota.map((a) => ({
    id: a.id,
    nama: a.nama,
    unitId: a.unitId,
  }));

  return (
    <AppShell pengguna={pengguna} halaman="Penjual">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
              Penjual
            </h1>
            <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
              Mitra seller dan brand yang dijajaki dan digarap tiap unit. Leader
              unit dan PIC-nya yang merawat datanya; seluruh anggota unit bisa
              melihatnya.
            </p>
          </div>

          {izin.tambah ? (
            <DialogTambahPenjual
              pilihan={pilihan}
              anggota={calonPic}
              unitTerkunci={unitTerkunci}
              unitBawaan={pengguna.unitId}
            />
          ) : null}
        </div>

        <RingkasanPenjual daftar={semua} />

        <SaringPenjual
          saringan={saringan}
          unit={unit}
          kategori={kategori}
          jumlah={daftar.length}
          total={semua.length}
        />

        <Reveal>
          <DaftarPenjual
            daftar={daftar}
            pengguna={{
              id: pengguna.id,
              role: pengguna.role,
              unitId: pengguna.unitId,
            }}
            pilihan={pilihan}
            anggota={calonPic}
            unitTerkunci={unitTerkunci}
            acuan={acuan}
          />
        </Reveal>
      </div>
    </AppShell>
  );
}
