"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Pencil } from "lucide-react";
import { FormPendaftaran } from "@/components/pendaftaran/form-pendaftaran";
import { namaUnitDaftar } from "@/lib/pendaftaran";

/**
 * Isi layar /menunggu untuk pendaftaran yang belum diputuskan.
 *
 * Pertama kali (No. WA belum ada) langsung menampilkan form. Sesudah
 * terkirim: ringkasan + "Menunggu persetujuan", dengan pilihan mengubah
 * datanya selama belum diputuskan (E5: menutup tab sebelum mengisi →
 * form muncul lagi saat login berikutnya).
 */
export function IsiMenunggu({
  noWa,
  unitDiajukan,
  catatan,
}: {
  noWa: string | null;
  unitDiajukan: string | null;
  catatan: string | null;
}) {
  const router = useRouter();
  const [ubah, setUbah] = useState(noWa === null);

  if (ubah) {
    return (
      <FormPendaftaran
        awal={{ noWa, unitDiajukan, catatan }}
        onSelesai={() => {
          setUbah(false);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-2xl bg-warn-fill p-3 text-warn-text">
        <Clock className="mt-0.5 size-4 shrink-0" />
        <p className="text-[13px] leading-[18px] text-pretty">
          Menunggu persetujuan Manager atau CEO. Setelah disetujui, buka ulang
          halaman ini dan kamu langsung masuk ke Beranda.
        </p>
      </div>

      <dl className="space-y-1.5 rounded-2xl bg-muted/60 p-3 text-[13px] leading-[18px]">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">No. WhatsApp</dt>
          <dd className="font-semibold">{noWa}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Divisi diajukan</dt>
          <dd className="font-semibold">{namaUnitDaftar(unitDiajukan) ?? "—"}</dd>
        </div>
        {catatan ? (
          <div className="space-y-0.5">
            <dt className="text-muted-foreground">Catatan</dt>
            <dd className="text-pretty">{catatan}</dd>
          </div>
        ) : null}
      </dl>

      <button
        type="button"
        onClick={() => setUbah(true)}
        className="tekan-halus inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary"
      >
        <Pencil className="size-3.5" />
        Ubah data pendaftaran
      </button>
    </div>
  );
}
