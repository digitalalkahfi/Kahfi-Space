/**
 * Rentang periode untuk modul Finance (PRD Fase 4).
 *
 * Filter periode tinggal di dalam modulnya, bukan di navigasi atas:
 * "bulan ini" berarti lain di Finance, di absensi, dan di laporan
 * harian. Modul ini murni — tidak tahu apa-apa soal transaksi, hanya
 * menghitung rentang tanggalnya.
 */
export type JenisPeriode =
  "harian" | "mingguan" | "bulanan" | "tahunan" | "custom";

export const LABEL_PERIODE: Record<JenisPeriode, string> = {
  harian: "Harian",
  mingguan: "Mingguan",
  bulanan: "Bulanan",
  tahunan: "Tahunan",
  custom: "Custom",
};

export const JENIS_PERIODE: JenisPeriode[] = [
  "harian",
  "mingguan",
  "bulanan",
  "tahunan",
  "custom",
];

export type RentangPeriode = {
  jenis: JenisPeriode;
  dari: string;
  sampai: string;
  /** Label siap tampil, mis. "Oktober 2024". */
  label: string;
};

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

const iso = (d: Date) => d.toISOString().slice(0, 10);

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function labelTanggal(t: string) {
  const [tahun, bulan, hari] = t.split("-").map(Number);
  return `${hari} ${NAMA_BULAN[bulan - 1]} ${tahun}`;
}

/**
 * Rentang tanggal untuk satu jenis periode, relatif terhadap `acuan`.
 *
 * Pekan dimulai Senin — itu cara tim ini membaca ritmenya (WRM), dan
 * pekan yang dimulai Minggu membuat capaian Senin terlihat seperti sisa
 * pekan lalu.
 */
export function rentangPeriode(
  jenis: JenisPeriode,
  acuan: string,
  custom?: { dari?: string; sampai?: string },
): RentangPeriode {
  const [tahun, bulan, hari] = acuan.split("-").map(Number);

  if (jenis === "harian") {
    return {
      jenis,
      dari: acuan,
      sampai: acuan,
      label: labelTanggal(acuan),
    };
  }

  if (jenis === "mingguan") {
    const d = new Date(Date.UTC(tahun, bulan - 1, hari));
    // getUTCDay(): 0 Minggu … 6 Sabtu. Senin sebagai awal pekan.
    const geser = (d.getUTCDay() + 6) % 7;
    const senin = new Date(d);
    senin.setUTCDate(senin.getUTCDate() - geser);
    const minggu = new Date(senin);
    minggu.setUTCDate(minggu.getUTCDate() + 6);

    return {
      jenis,
      dari: iso(senin),
      sampai: iso(minggu),
      label: `${labelTanggal(iso(senin))} – ${labelTanggal(iso(minggu))}`,
    };
  }

  if (jenis === "tahunan") {
    return {
      jenis,
      dari: `${tahun}-01-01`,
      sampai: `${tahun}-12-31`,
      label: String(tahun),
    };
  }

  if (jenis === "custom") {
    const dari = POLA_TANGGAL.test(custom?.dari ?? "")
      ? custom!.dari!
      : `${acuan.slice(0, 7)}-01`;
    const sampaiDiminta = POLA_TANGGAL.test(custom?.sampai ?? "")
      ? custom!.sampai!
      : acuan;
    // Rentang terbalik adalah salah ketik, bukan alasan menampilkan
    // halaman kosong: tanggalnya ditukar supaya tetap terbaca.
    const [a, b] =
      dari <= sampaiDiminta ? [dari, sampaiDiminta] : [sampaiDiminta, dari];

    return {
      jenis,
      dari: a,
      sampai: b,
      label: `${labelTanggal(a)} – ${labelTanggal(b)}`,
    };
  }

  const akhir = new Date(Date.UTC(tahun, bulan, 0));
  return {
    jenis: "bulanan",
    dari: `${acuan.slice(0, 7)}-01`,
    sampai: iso(akhir),
    label: `${NAMA_BULAN[bulan - 1]} ${tahun}`,
  };
}

/** Membaca jenis periode dari URL; nilai asing jatuh ke bulanan. */
export function bacaJenisPeriode(
  nilai: string | string[] | undefined,
): JenisPeriode {
  const satu = Array.isArray(nilai) ? nilai[0] : nilai;
  return JENIS_PERIODE.includes(satu as JenisPeriode)
    ? (satu as JenisPeriode)
    : "bulanan";
}

/**
 * Satuan periode untuk kalimat seperti "enam bulan terakhir".
 *
 * Grafik yang menyebut "bulan" padahal sedang menampilkan pekan membuat
 * orang salah membaca kemiringan garisnya.
 */
export function satuanPeriode(jenis: JenisPeriode): string {
  switch (jenis) {
    case "harian":
      return "hari";
    case "mingguan":
      return "pekan";
    case "tahunan":
      return "tahun";
    case "custom":
      return "rentang";
    default:
      return "bulan";
  }
}

/** Jumlah hari dalam sebuah rentang, inklusif. */
export function hariDalamRentang(r: { dari: string; sampai: string }): number {
  const mulai = new Date(`${r.dari}T00:00:00Z`).getTime();
  const akhir = new Date(`${r.sampai}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((akhir - mulai) / 86_400_000) + 1);
}

/** Jumlah hari pada bulan sebuah tanggal. */
export function hariDalamBulan(tanggal: string): number {
  const [tahun, bulan] = tanggal.split("-").map(Number);
  return new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
}

/**
 * Membagi angka bulanan menurut panjang rentangnya.
 *
 * Dipakai untuk dua hal yang memang dicatat per bulan — pagu anggaran
 * dan beban penyusutan — supaya bisa disandingkan dengan belanja satu
 * pekan. Tanpa prorata, belanja tujuh hari selalu terlihat hijau
 * dibanding pagu sebulan, dan itu kabar baik yang palsu.
 *
 * Rentang bulanan dan yang lebih panjang tidak diprorata: keduanya
 * memang sudah satuan bulan atau lebih.
 */
export function prorata(nilaiBulanan: number, r: RentangPeriode): number {
  if (r.jenis === "bulanan") return nilaiBulanan;

  const hari = hariDalamRentang(r);
  if (r.jenis === "tahunan") return nilaiBulanan * 12;

  const sebulan = hariDalamBulan(r.dari);
  if (hari >= sebulan) {
    // Rentang custom yang lebih panjang dari sebulan dihitung
    // proporsional juga, bukan dipotong di satu bulan.
    return Math.round((nilaiBulanan * hari) / sebulan);
  }

  return Math.round((nilaiBulanan * hari) / sebulan);
}

/**
 * Tanggal acuan untuk menggeser periode.
 *
 * Diambil dari awal rentangnya, bukan dari akhir: menggeser "Oktober"
 * satu langkah mundur harus mendarat di September, dan itu hanya pasti
 * bila titik tolaknya hari pertama.
 */
export function acuanRentang(r: RentangPeriode): string {
  return r.dari;
}

/**
 * Menggeser rentang satu langkah maju atau mundur, tetap pada jenis
 * yang sama.
 *
 * Rentang custom digeser sepanjang dirinya sendiri — dua pekan digeser
 * dua pekan, bukan sebulan.
 */
export function geserRentang(r: RentangPeriode, arah: -1 | 1): RentangPeriode {
  const [tahun, bulan, hari] = r.dari.split("-").map(Number);

  if (r.jenis === "bulanan") {
    return rentangPeriode(
      "bulanan",
      iso(new Date(Date.UTC(tahun, bulan - 1 + arah, 1))),
    );
  }

  if (r.jenis === "tahunan") {
    return rentangPeriode("tahunan", `${tahun + arah}-01-01`);
  }

  if (r.jenis === "harian") {
    const d = new Date(Date.UTC(tahun, bulan - 1, hari + arah));
    return rentangPeriode("harian", iso(d));
  }

  const mulai = new Date(`${r.dari}T00:00:00Z`);
  const akhir = new Date(`${r.sampai}T00:00:00Z`);
  const panjang =
    Math.round((akhir.getTime() - mulai.getTime()) / 86_400_000) + 1;

  const dariBaru = new Date(mulai);
  dariBaru.setUTCDate(dariBaru.getUTCDate() + arah * panjang);

  if (r.jenis === "mingguan") return rentangPeriode("mingguan", iso(dariBaru));

  const sampaiBaru = new Date(dariBaru);
  sampaiBaru.setUTCDate(sampaiBaru.getUTCDate() + panjang - 1);
  return rentangPeriode("custom", r.dari, {
    dari: iso(dariBaru),
    sampai: iso(sampaiBaru),
  });
}

/**
 * Rentang pembanding: periode sepanjang ini, tepat sebelum periode ini.
 *
 * Untuk periode bulanan dan tahunan dipakai bulan/tahun kalender
 * sebelumnya — bukan "31 hari sebelumnya" — supaya perbandingannya
 * setara dengan cara orang membaca laporan.
 */
export function rentangSebelumnya(r: RentangPeriode): RentangPeriode {
  const [tahun, bulan] = r.dari.split("-").map(Number);

  if (r.jenis === "bulanan") {
    return rentangPeriode(
      "bulanan",
      iso(new Date(Date.UTC(tahun, bulan - 2, 1))),
    );
  }

  if (r.jenis === "tahunan") {
    return rentangPeriode("tahunan", `${tahun - 1}-01-01`);
  }

  const mulai = new Date(`${r.dari}T00:00:00Z`);
  const akhir = new Date(`${r.sampai}T00:00:00Z`);
  const hari = Math.round((akhir.getTime() - mulai.getTime()) / 86_400_000) + 1;

  const sampaiLalu = new Date(mulai);
  sampaiLalu.setUTCDate(sampaiLalu.getUTCDate() - 1);
  const dariLalu = new Date(sampaiLalu);
  dariLalu.setUTCDate(dariLalu.getUTCDate() - (hari - 1));

  return {
    jenis: r.jenis,
    dari: iso(dariLalu),
    sampai: iso(sampaiLalu),
    label:
      r.jenis === "harian"
        ? labelTanggal(iso(dariLalu))
        : `${labelTanggal(iso(dariLalu))} – ${labelTanggal(iso(sampaiLalu))}`,
  };
}
