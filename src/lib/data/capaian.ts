// Modul khusus server. Impor dari komponen klien akan gagal saat build,
// bukan diam-diam bocor ke browser.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import { targetHarianGrd } from "@/lib/goal";
import { kolomLaporan, LABEL_KOLOM } from "@/lib/laporan";
import {
  hariJendela,
  lingkupCapaian,
  rentangDiagram,
  type AngkaCapaian,
  type CapaianPribadi,
} from "@/lib/capaian";
import { sasaranUntuk } from "@/lib/data/laporan";
import { minimumSasaran } from "@/lib/batas-minimum";
import { trenTigaHari } from "@/lib/data/kepatuhan";
import type { KodeUnit, Pengguna, SasaranLaporan } from "@/lib/types";

/** Satu hari apa adanya dari sumbernya, sebelum dibentuk untuk layar. */
type BarisCapaian = {
  tanggal: string;
  target: number;
  gmv: number;
  komisi: number | null;
  jumlahUpload: number | null;
  coSampel: number;
};

/** Hasil satu panggilan: deret hariannya sekaligus keterangan sasarannya. */
type DeretCapaian = {
  baris: BarisCapaian[];
  lingkup: string | null;
  departemen: KodeUnit | null;
};

/**
 * Capaian pribadi pada jendela 28 hari yang berakhir di `tanggal`.
 *
 * Sasarannya yang benar-benar dipegang sendiri — akun tempat ia PIC,
 * atau unit yang ia pimpin. CEO & Manager tidak melihat seluruh
 * perusahaan di sini; untuk itu sudah ada kartu GMV lintas unit.
 * Mengembalikan null bila orang itu memang tidak melapor apa pun.
 */
export async function capaianPribadi(
  pengguna: Pengguna,
  tanggal: string,
): Promise<CapaianPribadi | null> {
  const { dari, sampai } = rentangDiagram(tanggal);
  const deret =
    modeData() === "demo"
      ? await deretDemo(pengguna, tanggal)
      : await deretSupabase(dari, sampai);

  // Tanpa sasaran, tidak ada capaian pribadi yang bisa diceritakan.
  if (deret.lingkup === null) return null;

  const baris = deret.baris;
  const jumlah = (ambil: (b: BarisCapaian) => number) =>
    baris.reduce((a, b) => a + ambil(b), 0);

  // Sekali baca untuk tiga keperluan: batas harian, akun mana yang
  // benar-benar miliknya, dan tren tiga harinya. `trenTigaHari` sendiri
  // tunduk pada RLS, jadi Leader akan menerima akun unitnya juga —
  // disaring di sini supaya kartu ini tetap kartu PRIBADI.
  const sasaranSendiri = await sasaranMilikSendiri(pengguna, tanggal);
  const akunSendiri = new Set(
    sasaranSendiri.filter((s) => s.jenis === "akun").map((s) => s.akun.id),
  );
  // Batas harian orang ini = JUMLAH batas seluruh akunnya, karena angka
  // harian di diagramnya juga jumlah seluruh akun itu. Memakai batas
  // satu akun saja membuat orang yang memegang tiga akun terlihat
  // selalu jauh di atas minimum.
  const batas = sasaranSendiri
    .map((s) => minimumSasaran(s).minimum)
    .filter((m) => m !== null);
  const minimum = batas.length === 0 ? null : batas.reduce((a, b) => a + b, 0);
  const tren = akunSendiri.size === 0 ? [] : await trenTigaHari();

  const kolom = kolomLaporan(deret.departemen);
  const angka: AngkaCapaian[] = [
    {
      kunci: "gmv",
      label: LABEL_KOLOM.gmv,
      realisasi: jumlah((b) => b.gmv),
      target: jumlah((b) => b.target),
      satuan: "rupiah",
    },
  ];

  // Komisi, upload, dan CO sampel belum punya anak tangga di GRD, jadi
  // ditampilkan tanpa target — bukan dengan target nol, yang akan
  // terbaca sebagai "sudah tercapai".
  if (kolom.includes("komisi")) {
    angka.push({
      kunci: "komisi",
      label: LABEL_KOLOM.komisi,
      realisasi: jumlah((b) => b.komisi ?? 0),
      target: null,
      satuan: "rupiah",
    });
  }
  if (kolom.includes("jumlahUpload")) {
    angka.push({
      kunci: "jumlahUpload",
      label: LABEL_KOLOM.jumlahUpload,
      realisasi: jumlah((b) => b.jumlahUpload ?? 0),
      target: null,
      satuan: "cacah",
    });
  }
  if (kolom.includes("coSampel")) {
    angka.push({
      kunci: "coSampel",
      label: LABEL_KOLOM.coSampel,
      realisasi: jumlah((b) => b.coSampel),
      target: null,
      satuan: "cacah",
    });
  }

  return {
    lingkup: deret.lingkup,
    dari,
    sampai,
    angka,
    harian: baris.map((b) => ({
      tanggal: b.tanggal,
      target: b.target,
      realisasi: b.gmv,
    })),
    // Hanya departemen yang memang melaporkan unggahan yang punya
    // diagram ini; MCN & TAP tidak, dan kartu kosong bukan informasi.
    unggahan: kolom.includes("jumlahUpload")
      ? baris.map((b) => ({ tanggal: b.tanggal, unggahan: b.jumlahUpload }))
      : [],
    minimumHarian: minimum,
    tren: tren.filter((t) => akunSendiri.has(t.akunId)),
  };
}

/** Sasaran yang dipegang sendiri, bukan yang boleh dilihat karena jabatan. */
async function sasaranMilikSendiri(pengguna: Pengguna, tanggal: string) {
  const sasaran = await sasaranUntuk(pengguna, tanggal);
  return sasaran.filter((s) =>
    s.jenis === "akun"
      ? s.akun.picNama === pengguna.nama
      : pengguna.role === "Leader" && s.unitId === pengguna.unitId,
  );
}

/** Departemen bersama seluruh sasaran; null bila bercampur. */
function departemenBersama(sasaran: SasaranLaporan[]): KodeUnit | null {
  const unit = new Set(
    sasaran.map((s) => (s.jenis === "akun" ? s.akun.unitId : s.unitId)),
  );
  return unit.size === 1 ? [...unit][0] : null;
}

/**
 * Satu panggilan untuk seluruh kartu — deret harian, keterangan sasaran,
 * dan departemennya sekaligus. Beranda tidak boleh menambah round-trip
 * hanya untuk mengetahui judul kartunya.
 */
async function deretSupabase(
  dari: string,
  sampai: string,
): Promise<DeretCapaian> {
  const sb = await klienServer();
  const { data, error } = await sb.rpc("capaian_pribadi_saya", {
    p_dari: dari,
    p_sampai: sampai,
  });
  if (error) throw new Error(`Gagal memuat capaian: ${error.message}`);

  const rows = data ?? [];
  return {
    lingkup: rows[0]?.lingkup ?? null,
    departemen: (rows[0]?.departemen as KodeUnit | null) ?? null,
    baris: rows.map((b) => ({
      tanggal: b.tanggal,
      target: Number(b.target),
      gmv: Number(b.gmv),
      komisi: b.komisi === null ? null : Number(b.komisi),
      jumlahUpload: b.jumlah_upload,
      coSampel: Number(b.co_sampel),
    })),
  };
}

/**
 * Padanan `capaian_pribadi_saya` untuk mode demo — rumus yang sama,
 * sumber data seed. Hari tanpa laporan tetap muncul dengan realisasi nol:
 * justru lubang itu yang ingin terlihat di grafik.
 */
async function deretDemo(
  pengguna: Pengguna,
  tanggal: string,
): Promise<DeretCapaian> {
  const sasaran = await sasaranMilikSendiri(pengguna, tanggal);
  const {
    daily_reports,
    accounts,
    goals,
    samples,
    sample_scans = [],
  } = dataContoh;

  const akunId = new Set(
    sasaran.filter((s) => s.jenis === "akun").map((s) => s.akun.id),
  );
  const username = new Set(
    accounts.filter((a) => akunId.has(a.id)).map((a) => a.username),
  );
  const unitKode = new Set(
    sasaran.filter((s) => s.jenis === "unit").map((s) => s.unitId),
  );

  const perHari = new Map<string, BarisCapaian>();
  for (const hari of hariJendela(tanggal)) {
    perHari.set(hari, {
      tanggal: hari,
      target: targetHarianSasaran(sasaran, hari),
      gmv: 0,
      komisi: null,
      jumlahUpload: null,
      coSampel: 0,
    });
  }

  for (const l of daily_reports) {
    const baris = perHari.get(l.tanggal);
    if (!baris) continue;
    const punya =
      (l.akun && username.has(l.akun)) ||
      (l.unit && unitKode.has(l.unit as KodeUnit));
    if (!punya) continue;

    baris.gmv += l.gmv;
    const komisi = (l as { komisi?: number }).komisi;
    if (komisi !== undefined) baris.komisi = (baris.komisi ?? 0) + komisi;
    const upload = (l as { jumlah_upload?: number }).jumlah_upload;
    if (upload !== undefined) {
      baris.jumlahUpload = (baris.jumlahUpload ?? 0) + upload;
    }
  }

  for (const scan of sample_scans) {
    if (!scan.dikenali) continue;
    const sampel = samples.find((s) => s.kode === scan.kode);
    if (!sampel?.akun || !username.has(sampel.akun)) continue;
    const baris = perHari.get(tanggalScan(tanggal, scan.lalu_hari));
    if (baris) baris.coSampel += 1;
  }

  // `goals` ikut dipakai lewat targetHarianSasaran; disebut di sini agar
  // ketergantungannya terlihat saat membaca fungsi ini.
  void goals;

  return {
    baris: [...perHari.values()],
    lingkup:
      sasaran.length === 0
        ? null
        : lingkupCapaian(
            sasaran.map((s) => (s.jenis === "akun" ? s.akun.username : s.nama)),
          ),
    departemen: departemenBersama(sasaran),
  };
}

/** Tanggal pemindaian contoh: seed menyimpan jarak hari dari tanggal acuan. */
function tanggalScan(acuan: string, laluHari: number) {
  const d = new Date(`${acuan}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - laluHari);
  return d.toISOString().slice(0, 10);
}

/**
 * Target harian seluruh sasaran pada satu tanggal.
 *
 * Dihitung per hari, bukan memakai target yang dibawa `sasaranUntuk`:
 * jendela 28 hari bisa menyeberang bulan, dan anak tangga GRD tiap bulan
 * berbeda.
 */
function targetHarianSasaran(sasaran: SasaranLaporan[], hari: string): number {
  const { goals, accounts } = dataContoh;

  return sasaran.reduce((total, s) => {
    const username =
      s.jenis === "akun"
        ? accounts.find((a) => a.id === s.akun.id)?.username
        : null;
    const cocok = (g: (typeof goals)[number]) =>
      s.jenis === "akun"
        ? g.level === "account" && g.account === username
        : g.account === null && g.unit === s.unitId;

    return (
      total +
      Math.round(
        targetHarianGrd(
          goals.filter(cocok).flatMap((g) => g.bulan_list ?? []),
          hari,
        ),
      )
    );
  }, 0);
}
