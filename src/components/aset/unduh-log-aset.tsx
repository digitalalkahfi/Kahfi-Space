"use client";

import { TombolUnduhExcel } from "@/components/shared/tombol-unduh-excel";
import { namaBerkasTanggal } from "@/lib/ekspor-excel";
import { LABEL_STATUS_ASET, type BarisLogAset } from "@/lib/aset";

/** Mengunduh log yang sedang tampil — mengikuti saringan, bukan seluruhnya. */
export function UnduhLogAset({ daftar }: { daftar: BarisLogAset[] }) {
  return (
    <div className="flex justify-end">
      <TombolUnduhExcel
        baris={daftar}
        namaBerkas={namaBerkasTanggal("k-space-log-aset")}
        namaSheet="Log aset"
        label="Unduh log"
        kolom={[
          { judul: "Tanggal", ambil: (k) => k.pada, lebar: 12 },
          { judul: "Kode", ambil: (k) => k.kode, lebar: 12 },
          { judul: "Aset", ambil: (k) => k.namaAset, lebar: 32 },
          { judul: "Unit", ambil: (k) => k.unitNama, lebar: 20 },
          {
            judul: "Dari",
            ambil: (k) => (k.dari ? LABEL_STATUS_ASET[k.dari] : "Perolehan"),
            lebar: 14,
          },
          {
            judul: "Menjadi",
            ambil: (k) => LABEL_STATUS_ASET[k.ke],
            lebar: 14,
          },
          {
            judul: "Pemegang",
            ambil: (k) => k.pemegangNama ?? "",
            lebar: 22,
          },
          { judul: "Lokasi", ambil: (k) => k.lokasi, lebar: 24 },
          { judul: "Dicatat", ambil: (k) => k.olehNama ?? "", lebar: 22 },
          { judul: "Keterangan", ambil: (k) => k.catatan, lebar: 44 },
        ]}
      />
    </div>
  );
}
