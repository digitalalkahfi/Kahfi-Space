import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Ekspor K-Space lama berukuran puluhan megabita dan masuk lewat
      // Server Action, bukan route upload tersendiri. Batas bawaan 1 MB
      // akan menolaknya sebelum satu baris pun dibaca.
      //
      // Angkanya sengaja 31 MB, bukan 30: batas ini berlaku untuk seluruh
      // badan permintaan — termasuk pembatas dan tajuk multipart — jadi
      // berkas tepat 30 MB akan melewatinya kalau tidak diberi kelonggaran.
      // Batas 30 MB yang mengikat tetap `BATAS_UNGGAH_BYTE`.
      bodySizeLimit: "31mb",
    },
  },
};

export default nextConfig;
