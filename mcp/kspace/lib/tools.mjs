/**
 * Enam tool K-Space versi 1.
 *
 * ATURAN BERKAS INI
 *  - Satu tool = satu fungsi `asisten.*` (0217). Tidak ada rumus GMV,
 *    target, hari kerja, atau wajib lapor di sini. Yang dikerjakan hanya
 *    menyaring, mengelompokkan, menghitung jumlah baris, dan merapikan.
 *  - Teks SQL di bawah seluruhnya TETAP. Nilai dari pemanggil hanya
 *    masuk lewat parameter ($1, $2).
 *  - Tiap hasil membawa: rentang tanggal (WIB), nama fungsi sumber, dan
 *    untuk GMV catatan bahwa angkanya input manual.
 *  - Kosong ditulis kosong ("tidak ada laporan"), bukan nol.
 *
 * `db.baca(fn)` menjalankan `fn(q)` dalam SATU transaksi hanya-baca
 * sebagai peran asisten_baca; `q(sql, params)` mengembalikan baris.
 * Lapisannya bisa diganti: Postgres sungguhan (lib/db-pg.mjs) atau
 * PGlite saat tes.
 */
import * as z from "zod/v4";
import { GalatPengguna } from "./galat.mjs";
import { MAKS_RENTANG_HARI, selisihHari, tanggal, waktu } from "./validasi.mjs";

export const CATATAN_GMV = "Catatan: input manual K-Space; acuan resmi Partner Center.";

const ATURAN_H1 =
  "Aturan H-1: laporan yang ditagih pada hari D berisi GMV tanggal D-1 dan tersimpan bertanggal D-1.";

// ---------------------------------------------------------------------
// Penolong tampilan (bukan rumus)
// ---------------------------------------------------------------------
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function namaHari(t) {
  const [y, m, d] = t.split("-").map(Number);
  return HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** 12500000 → "Rp12.500.000". null → teks kosong yang diminta. */
export function rupiah(n, kosong = "tidak ada data") {
  if (n === null || n === undefined) return kosong;
  return "Rp" + Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const persen = (n) => (n === null || n === undefined ? "tidak bisa dihitung" : `${String(n).replace(".", ",")}%`);

const potong = (s, maks = 120) => (s.length > maks ? s.slice(0, maks - 1) + "…" : s);

function kelompokkan(baris, kunci) {
  const peta = new Map();
  for (const b of baris) {
    const k = b[kunci];
    if (!peta.has(k)) peta.set(k, []);
    peta.get(k).push(b);
  }
  return [...peta.entries()].sort(([a], [b]) => String(a).localeCompare(String(b), "id"));
}

/** Semua tanggal dari `dari` s.d. `sampai` (inklusif). */
function deretTanggal(dari, sampai) {
  const hasil = [];
  const [y, m, d] = dari.split("-").map(Number);
  for (let i = 0; i <= selisihHari(dari, sampai); i += 1) {
    hasil.push(new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
  }
  return hasil;
}

// ---------------------------------------------------------------------
// SQL tetap
// ---------------------------------------------------------------------
const SQL = {
  hariIni: `select asisten.hari_ini()::text as hari_ini,
                   asisten.hari_kerja_terakhir(asisten.hari_ini())::text as hari_kerja_terakhir`,
  // Tanggal yang dipakai (default hari ini WIB) + apakah itu hari kerja.
  tanggalPakai: `select coalesce($1::date, asisten.hari_ini())::text as tanggal,
                        asisten.hari_kerja_terakhir(coalesce($1::date, asisten.hari_ini()))::text as hari_kerja`,
  statusLapor: `select to_jsonb(s) as j from asisten.status_lapor($1::date) s`,
  belumLapor: `select to_jsonb(s) as j from asisten.belum_lapor($1::date) s`,
  gmvUnit: `select to_jsonb(s) as j from asisten.gmv_unit($1::date) s`,
  gmvHarian: `select to_jsonb(s) as j from asisten.gmv_harian($1::date, $2::date) s`,
  waktuPakai: `select to_char(coalesce($1::timestamptz, now()) at time zone 'Asia/Jakarta',
                              'YYYY-MM-DD"T"HH24:MI:SS"+07:00"') as waktu`,
  tugasTelat: `select to_jsonb(s) as j from asisten.tugas_telat($1::timestamptz) s`,
};

async function tanggalPakai(q, t) {
  const [b] = await q(SQL.tanggalPakai, [t ?? null]);
  return { tanggal: b.tanggal, hariKerja: b.hari_kerja === b.tanggal, hariKerjaTerakhir: b.hari_kerja };
}

const catatanBukanHariKerja = (tp) =>
  tp.hariKerja
    ? []
    : [
        `Perhatian: ${tp.tanggal} (${namaHari(tp.tanggal)}) bukan hari kerja menurut asisten.hari_kerja_terakhir (hari kerja terakhir: ${tp.hariKerjaTerakhir}).`,
      ];

const orang = (b) => `${b.nama} (${b.role}, ${b.unit})`;

// ---------------------------------------------------------------------
// Daftar tool
// ---------------------------------------------------------------------
export const DAFTAR_TOOL = [
  {
    nama: "tanggal_hari_ini",
    judul: "Tanggal hari ini (WIB)",
    deskripsi: [
      "Tanggal hari ini menurut jam Indonesia Barat (WIB) dan hari kerja terakhir (Senin–Sabtu di luar libur perusahaan).",
      "Pakai ini lebih dulu bila pertanyaan menyebut 'hari ini', 'kemarin', 'minggu ini', atau 'bulan ini', supaya tanggalnya tidak ditebak.",
      ATURAN_H1,
      "Sumber: asisten.hari_ini() dan asisten.hari_kerja_terakhir().",
    ].join(" "),
    skema: z.strictObject({}),
    async jalankan(db) {
      const [b] = await db.baca((q) => q(SQL.hariIni));
      return {
        baris: 1,
        data: b,
        teks: [
          `Hari ini (WIB): ${b.hari_ini} (${namaHari(b.hari_ini)})`,
          `Hari kerja terakhir (≤ hari ini): ${b.hari_kerja_terakhir ?? "tidak ada data"}`,
          ATURAN_H1,
          `Sumber: asisten.hari_ini(), asisten.hari_kerja_terakhir('${b.hari_ini}')`,
        ].join("\n"),
      };
    },
  },

  {
    nama: "status_lapor",
    judul: "Status lapor harian",
    deskripsi: [
      "Siapa yang wajib lapor harian pada sebuah hari, siapa yang sudah dan belum, dikelompokkan per Leader. Sama dengan kartu Status Tim di Beranda.",
      "Pakai untuk 'berapa orang wajib lapor dan berapa yang sudah'. Untuk daftar yang belum saja, pakai belum_lapor.",
      "Parameter tanggal = HARI TAGIH (hari absen), default hari ini WIB.",
      ATURAN_H1,
      "Kolom: nama, role, unit, leader (Leader di garis atasannya; 'Tanpa Leader' bila tidak ada), wajib_lapor, sudah_lapor, tanggal_gmv (tanggal isi laporan = hari tagih - 1).",
      "Jumlah orang adalah hitungan baris. Orang yang tidak wajib lapor hanya dijumlah, tidak dirinci.",
      "Sumber: asisten.status_lapor(tanggal).",
    ].join(" "),
    skema: z.strictObject({
      tanggal: tanggal.optional().describe("Hari tagih, YYYY-MM-DD (WIB). Kosongkan untuk hari ini."),
    }),
    async jalankan(db, { tanggal: t }) {
      const { tp, baris } = await db.baca(async (q) => {
        const tp = await tanggalPakai(q, t);
        return { tp, baris: (await q(SQL.statusLapor, [tp.tanggal])).map((r) => r.j) };
      });
      const wajib = baris.filter((b) => b.wajib_lapor);
      const sudah = wajib.filter((b) => b.sudah_lapor);
      const belum = wajib.filter((b) => !b.sudah_lapor);
      const ringkas = { wajib: wajib.length, sudah: sudah.length, belum: belum.length, tidak_wajib: baris.length - wajib.length };

      const baris_teks = [
        `Status lapor harian — hari tagih ${tp.tanggal} (${namaHari(tp.tanggal)}, WIB)${
          baris[0] ? `, berisi GMV tanggal ${baris[0].tanggal_gmv} (H-1)` : ""
        }`,
        ...catatanBukanHariKerja(tp),
      ];
      if (baris.length === 0) {
        baris_teks.push("Tidak ada data: fungsi tidak mengembalikan satu orang pun.");
      } else {
        baris_teks.push(
          `Wajib lapor: ${ringkas.wajib} orang | sudah: ${ringkas.sudah} | belum: ${ringkas.belum} | tidak wajib lapor: ${ringkas.tidak_wajib} (hitungan baris)`,
        );
        for (const [leader, anggota] of kelompokkan(wajib, "leader")) {
          const s = anggota.filter((b) => b.sudah_lapor);
          const bl = anggota.filter((b) => !b.sudah_lapor);
          baris_teks.push(`Leader ${leader} — wajib ${anggota.length}, sudah ${s.length}, belum ${bl.length}`);
          if (s.length) baris_teks.push(`  sudah: ${s.map(orang).join("; ")}`);
          if (bl.length) baris_teks.push(`  BELUM: ${bl.map(orang).join("; ")}`);
        }
      }
      baris_teks.push(`Sumber: asisten.status_lapor('${tp.tanggal}')`);
      return { baris: baris.length, data: { tanggal: tp.tanggal, ringkas, baris }, teks: baris_teks.join("\n") };
    },
  },

  {
    nama: "belum_lapor",
    judul: "Yang belum lapor harian",
    deskripsi: [
      "Daftar orang yang WAJIB lapor harian tetapi BELUM lapor pada sebuah hari, dikelompokkan per Leader. Definisinya sama dengan Beranda.",
      "Pakai untuk 'siapa yang belum lapor hari ini'.",
      "Parameter tanggal = HARI TAGIH, default hari ini WIB.",
      ATURAN_H1,
      "Kolom: nama, role, unit, leader, tanggal_gmv (tanggal isi laporan yang ditunggu = hari tagih - 1).",
      "Daftar kosong berarti semua yang wajib sudah lapor.",
      "Sumber: asisten.belum_lapor(tanggal).",
    ].join(" "),
    skema: z.strictObject({
      tanggal: tanggal.optional().describe("Hari tagih, YYYY-MM-DD (WIB). Kosongkan untuk hari ini."),
    }),
    async jalankan(db, { tanggal: t }) {
      const { tp, baris } = await db.baca(async (q) => {
        const tp = await tanggalPakai(q, t);
        return { tp, baris: (await q(SQL.belumLapor, [tp.tanggal])).map((r) => r.j) };
      });
      const teks = [
        `Belum lapor harian — hari tagih ${tp.tanggal} (${namaHari(tp.tanggal)}, WIB)${
          baris[0] ? `, laporan yang ditunggu berisi GMV tanggal ${baris[0].tanggal_gmv} (H-1)` : ""
        }`,
        ...catatanBukanHariKerja(tp),
      ];
      if (baris.length === 0) {
        teks.push("Tidak ada yang belum lapor: semua orang yang wajib lapor sudah lapor.");
      } else {
        teks.push(`Belum lapor: ${baris.length} orang (hitungan baris)`);
        for (const [leader, anggota] of kelompokkan(baris, "leader")) {
          teks.push(`Leader ${leader} (${anggota.length}): ${anggota.map(orang).join("; ")}`);
        }
      }
      teks.push(`Sumber: asisten.belum_lapor('${tp.tanggal}')`);
      return { baris: baris.length, data: { tanggal: tp.tanggal, baris }, teks: teks.join("\n") };
    },
  },

  {
    nama: "gmv_unit",
    judul: "GMV per unit vs target",
    deskripsi: [
      "GMV per unit pada SATU tanggal dan GMV bulan berjalan (tanggal 1 s.d. tanggal itu) dibanding target prorata. Angkanya sama dengan Beranda.",
      "Pakai untuk 'GMV bulan ini per unit vs target', 'unit mana di bawah 90% target', atau 'GMV kemarin per unit'.",
      "Parameter tanggal = TANGGAL GMV, default hari ini WIB.",
      "PENTING (H-1): GMV hari ini biasanya baru dilaporkan besok. Untuk 'GMV kemarin', isi tanggal kemarin. Untuk 'bulan ini sampai sekarang', tanggal hari ini boleh dipakai.",
      "Kolom: kode & nama unit; gmv_tanggal (GMV pada tanggal itu); ada_laporan (false = belum/tidak ada laporan pada tanggal itu, BUKAN nol); target_harian; gmv_bulan (akumulasi bulan berjalan); target_bulanan; porsi_bulan (bagian bulan yang sudah berjalan, 0–1); target_prorata (target_bulanan x porsi_bulan); rasio_prorata (gmv_bulan dibanding target_prorata, dalam persen).",
      "Target kosong berarti target belum diisi di K-Space; rasio tidak dihitung.",
      CATATAN_GMV,
      "Sumber: asisten.gmv_unit(tanggal).",
    ].join(" "),
    skema: z.strictObject({
      tanggal: tanggal.optional().describe("Tanggal GMV, YYYY-MM-DD (WIB). Kosongkan untuk hari ini."),
    }),
    async jalankan(db, { tanggal: t }) {
      const { tp, baris } = await db.baca(async (q) => {
        const tp = await tanggalPakai(q, t);
        return { tp, baris: (await q(SQL.gmvUnit, [tp.tanggal])).map((r) => r.j) };
      });
      const awalBulan = `${tp.tanggal.slice(0, 8)}01`;
      const teks = [
        `GMV per unit — tanggal ${tp.tanggal} (${namaHari(tp.tanggal)}, WIB); bulan berjalan ${awalBulan} s.d. ${tp.tanggal}`,
      ];
      if (baris.length === 0) {
        teks.push("Tidak ada data: fungsi tidak mengembalikan unit.");
      } else {
        if (baris[0].porsi_bulan !== null) teks.push(`Porsi bulan yang sudah berjalan: ${baris[0].porsi_bulan}`);
        for (const b of baris) {
          const hari = b.ada_laporan ? rupiah(b.gmv_tanggal) : "tidak ada laporan";
          const bulan =
            Number(b.gmv_bulan) === 0 && !b.ada_laporan
              ? `${rupiah(b.gmv_bulan)} (nol atau belum ada laporan bulan ini; pastikan dengan gmv_harian)`
              : rupiah(b.gmv_bulan);
          teks.push(
            `${b.kode} ${b.nama}: GMV ${tp.tanggal} = ${hari} | target harian ${rupiah(b.target_harian, "belum diisi")}` +
              ` | GMV bulan = ${bulan} | target bulanan ${rupiah(b.target_bulanan, "belum diisi")}` +
              ` | target prorata ${rupiah(b.target_prorata, "belum diisi")} | capaian vs prorata ${persen(b.rasio_prorata)}`,
          );
        }
      }
      teks.push(`Sumber: asisten.gmv_unit('${tp.tanggal}')`, CATATAN_GMV);
      return { baris: baris.length, data: { tanggal: tp.tanggal, baris }, teks: teks.join("\n") };
    },
  },

  {
    nama: "gmv_harian",
    judul: "GMV harian per unit",
    deskripsi: [
      "GMV per hari per unit dalam sebuah rentang tanggal GMV (maksimal 92 hari).",
      "Pakai untuk tren, mis. 'GMV harian unit Affiliator 7 hari terakhir', atau memastikan sebuah tanggal ada laporannya.",
      "Parameter dari & sampai = TANGGAL GMV (WIB), keduanya wajib dan ikut dihitung. Parameter unit (opsional) menyaring satu unit menurut kode atau nama.",
      "Ingat H-1: GMV tanggal D dilaporkan pada hari D+1.",
      "Kolom: tanggal, kode & nama unit, gmv, jumlah_laporan (banyaknya laporan yang membentuk angka itu).",
      "Tanggal/unit TANPA laporan tidak muncul dan ditulis 'tidak ada laporan' — itu bukan GMV nol. Tool ini tidak menjumlahkan total.",
      CATATAN_GMV,
      "Sumber: asisten.gmv_harian(dari, sampai).",
    ].join(" "),
    skema: z.strictObject({
      dari: tanggal.describe("Tanggal GMV awal, YYYY-MM-DD (WIB)."),
      sampai: tanggal.describe("Tanggal GMV akhir, YYYY-MM-DD (WIB). Maksimal 92 hari dari 'dari'."),
      unit: z
        .string()
        .trim()
        .min(1)
        .max(60)
        .optional()
        .describe("Saring satu unit: kode atau sebagian nama unit, mis. 'Affiliator'."),
    }),
    async jalankan(db, { dari, sampai, unit }) {
      const jarak = selisihHari(dari, sampai);
      if (jarak < 0) throw new GalatPengguna("Rentang tanggal tidak valid: 'sampai' lebih awal dari 'dari'.");
      if (jarak > MAKS_RENTANG_HARI) throw new GalatPengguna(`Rentang maksimal ${MAKS_RENTANG_HARI} hari.`);

      const semua = (await db.baca((q) => q(SQL.gmvHarian, [dari, sampai]))).map((r) => r.j);
      let baris = semua;
      let ketUnit = "";
      if (unit) {
        const cari = unit.toLowerCase();
        baris = semua.filter((b) => b.kode.toLowerCase() === cari || b.nama.toLowerCase().includes(cari));
        ketUnit = `; disaring unit "${unit}"`;
      }

      const teks = [`GMV harian per unit — ${dari} s.d. ${sampai} (WIB, ${jarak + 1} hari)${ketUnit}`];
      if (unit && baris.length === 0) {
        const dikenal = [...new Set(semua.map((b) => `${b.kode} ${b.nama}`))];
        teks.push(
          `Tidak ada laporan untuk unit "${unit}" pada rentang ini.` +
            (dikenal.length
              ? ` Unit yang punya laporan pada rentang ini: ${dikenal.join(", ")}.`
              : " Tidak ada unit mana pun yang punya laporan pada rentang ini."),
        );
      }
      const perTanggal = new Map(kelompokkan(baris, "tanggal"));
      const kosong = [];
      for (const t of deretTanggal(dari, sampai)) {
        const isi = perTanggal.get(t);
        if (!isi) {
          kosong.push(t);
          continue;
        }
        teks.push(
          `${t} (${namaHari(t)}): ` +
            isi.map((b) => `${b.kode} ${b.nama} ${rupiah(b.gmv)} (${b.jumlah_laporan} laporan)`).join(" | "),
        );
      }
      if (kosong.length) {
        teks.push(`Tidak ada laporan (bukan nol) pada ${kosong.length} tanggal: ${kosong.join(", ")}`);
      }
      teks.push(`Sumber: asisten.gmv_harian('${dari}', '${sampai}')`, CATATAN_GMV);
      return {
        baris: baris.length,
        data: { dari, sampai, baris, tanggal_tanpa_laporan: kosong },
        teks: teks.join("\n"),
      };
    },
  },

  {
    nama: "tugas_telat",
    judul: "Tugas lewat tenggat",
    deskripsi: [
      "Tiket, to-do, dan komitmen yang sudah lewat tenggat dan belum selesai, milik anggota aktif.",
      "Pakai untuk 'tugas apa yang telat lebih dari N hari' atau 'tugas lewat tenggat yang menunggu QC'.",
      "Hasil dibagi DUA kelompok: TELAT (status todo/berjalan/revisi — masih di tangan penerima) dan MENUNGGU QC (sudah dikerjakan, menunggu pemeriksaan; tidak dihitung sebagai kelalaian penerima).",
      "Parameter waktu = patokan 'sekarang' (default saat ini). Parameter min_hari_telat menyaring hari_telat >= nilai itu; untuk 'telat lebih dari 3 hari' isi 4.",
      "Kolom: tipe (Tiket/To-do/Komitmen), judul, penerima, role, unit, leader, pembuat, tenggat_wib, hari_telat (selisih tanggal WIB; 0 = lewat tenggat hari ini), status.",
      "Tugas selesai/dibatalkan dan tugas tanpa tenggat tidak pernah muncul. Paling banyak 60 tugas per kelompok ditampilkan; sisanya disebut jumlahnya.",
      "Sumber: asisten.tugas_telat(waktu).",
    ].join(" "),
    skema: z.strictObject({
      waktu: waktu.optional().describe("Patokan waktu, mis. 2026-11-12T09:00+07:00. Kosongkan untuk saat ini."),
      min_hari_telat: z
        .number()
        .int()
        .min(0)
        .max(3650)
        .optional()
        .describe("Hanya tugas dengan hari_telat >= nilai ini. Default 0 (semua)."),
    }),
    async jalankan(db, { waktu: w, min_hari_telat: min = 0 }) {
      const { patokan, semua } = await db.baca(async (q) => {
        const [p] = await q(SQL.waktuPakai, [w ?? null]);
        return { patokan: p.waktu, semua: (await q(SQL.tugasTelat, [p.waktu])).map((r) => r.j) };
      });
      const baris = semua.filter((b) => b.hari_telat >= min);
      const telat = baris.filter((b) => b.kelompok === "telat");
      const qc = baris.filter((b) => b.kelompok === "menunggu_qc");
      const MAKS = 60;

      const satu = (b) =>
        `- [${b.tipe}] ${potong(b.judul)} — penerima ${b.penerima} (${b.role}, ${b.unit}; Leader ${b.leader}),` +
        ` dibuat ${b.pembuat}, tenggat ${b.tenggat_wib} WIB, telat ${b.hari_telat} hari, status ${b.status}`;
      const blok = (judul, isi) => {
        const keluar = [`${judul}: ${isi.length} tugas (hitungan baris)`];
        if (isi.length === 0) keluar.push("  tidak ada");
        keluar.push(...isi.slice(0, MAKS).map(satu));
        if (isi.length > MAKS) keluar.push(`  … dan ${isi.length - MAKS} tugas lagi tidak ditampilkan (naikkan min_hari_telat).`);
        return keluar;
      };

      const teks = [
        `Tugas lewat tenggat — patokan ${patokan.slice(0, 16).replace("T", " ")} WIB${
          min > 0 ? `; hanya yang telat >= ${min} hari` : ""
        }`,
        ...blok("TELAT (todo/berjalan/revisi)", telat),
        ...blok("MENUNGGU QC (dipisah, sudah dikerjakan)", qc),
        `Sumber: asisten.tugas_telat('${patokan}')`,
      ];
      return {
        baris: baris.length,
        data: { waktu: patokan, min_hari_telat: min, telat, menunggu_qc: qc },
        teks: teks.join("\n"),
      };
    },
  },
];
