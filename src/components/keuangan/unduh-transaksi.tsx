"use client";

import { TombolUnduhExcel } from "@/components/shared/tombol-unduh-excel";
import { namaBerkasTanggal } from "@/lib/ekspor-excel";
import {
  LABEL_JENIS_KELUAR,
  LABEL_STATUS_TRANSAKSI,
  type Transaksi,
} from "@/lib/keuangan";

/**
 * Mengunduh transaksi yang sedang tampil — mengikuti saringan, bukan
 * seluruh isi tabel. Yang diunduh orang biasanya persis yang sedang ia
 * lihat.
 */
export function UnduhTransaksi({
  daftar,
  periode,
}: {
  daftar: Transaksi[];
  periode: string;
}) {
  return (
    <div className="flex justify-end">
      <TombolUnduhExcel
        baris={daftar}
        namaBerkas={namaBerkasTanggal(`k-space-transaksi-${periode}`)}
        namaSheet="Transaksi"
        label="Unduh transaksi"
        kolom={[
          { judul: "Tanggal", ambil: (t) => t.tanggal, lebar: 12 },
          { judul: "Arah", ambil: (t) => t.arah, lebar: 10 },
          {
            judul: "Jenis",
            ambil: (t) => (t.jenis ? LABEL_JENIS_KELUAR[t.jenis] : ""),
            lebar: 18,
          },
          { judul: "Unit", ambil: (t) => t.unitNama, lebar: 20 },
          { judul: "Akun", ambil: (t) => t.akunUsername ?? "", lebar: 20 },
          { judul: "Keterangan", ambil: (t) => t.keterangan, lebar: 44 },
          { judul: "Jumlah", ambil: (t) => t.jumlah, lebar: 16 },
          {
            judul: "Status",
            ambil: (t) => LABEL_STATUS_TRANSAKSI[t.status],
            lebar: 20,
          },
          { judul: "Diajukan", ambil: (t) => t.diajukanNama ?? "", lebar: 20 },
          {
            judul: "Disetujui",
            ambil: (t) => t.disetujuiNama ?? "",
            lebar: 20,
          },
        ]}
      />
    </div>
  );
}
