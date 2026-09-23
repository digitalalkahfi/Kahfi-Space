// Modul khusus server.
import "server-only";

import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { dataContoh } from "@/lib/data/contoh";
import {
  angkaEksporV1,
  kasBulanV1,
  kehadiranBulanV1,
  targetRujukanV1,
  type AngkaV1,
  type GmvUnitBulan,
  type KasBulan,
  type KehadiranBulan,
  type TargetRujukan,
} from "@/lib/banding-v1";
import type { BarisBanding, KelompokBanding } from "@/lib/banding";
import { KUNCI_DIKENAL } from "@/lib/ekspor-v1";
import { isiEksporLama } from "@/lib/data/migrasi";

/**
 * Pembanding V1 vs V2 untuk layar verifikasi.
 *
 * Kedua sisi dihitung dari sumbernya masing-masing dan tidak pernah
 * saling mengisi: angka V1 dari ekspor lama, angka V2 dari basis data
 * yang berjalan. Begitu salah satunya dipinjam untuk menambal yang lain,
 * pembandingnya berhenti membuktikan apa pun.
 */

/**
 * Target lama, dicatat sebagai rujukan dan tidak pernah ditulis.
 *
 * `gmv:targets` dan `affiliate:goal` tidak dipetakan ke mana pun: target
 * di V2 hidup sebagai goal berjenjang dengan anak tangga bulanan, dan
 * menimpanya dengan angka lama akan mengubah dasar penilaian KPI yang
 * sedang berjalan. Tetapi angkanya tidak boleh hilang — ketika capaian
 * V1 dan V2 berselisih, pertanyaan pertama selalu "targetnya waktu itu
 * berapa".
 */
async function rujukanV1(): Promise<TargetRujukan[]> {
  return targetRujukanV1(await isiEksporLama());
}

/** Target unit per bulan yang berlaku sekarang di V2. */
async function targetV2(): Promise<TargetRujukan[] | null> {
  if (modeData() === "demo") {
    return dataContoh.goals
      .filter((g) => g.unit)
      .flatMap((g) =>
        (g.bulan_list ?? []).map((b) => ({
          unit: g.unit as string,
          bulan: b.bulan.slice(0, 7),
          target: b.target,
        })),
      );
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("goal_months")
    .select("bulan, target, goals!inner(units!inner(kode))");

  if (error || !data) return null;

  return data.flatMap((b) => {
    const goal = b.goals as unknown as { units?: { kode?: string } } | null;
    const kode = goal?.units?.kode;
    return kode
      ? [
          {
            unit: kode,
            bulan: String(b.bulan).slice(0, 7),
            target: Number(b.target),
          },
        ]
      : [];
  });
}

/** Kehadiran per bulan di kedua sisi. */
async function kehadiranBulan(): Promise<{
  v1: KehadiranBulan[];
  v2: KehadiranBulan[] | null;
}> {
  const isi = await isiEksporLama();
  const v1 = kehadiranBulanV1(isi);

  if (modeData() === "demo") {
    const peta = new Map<string, KehadiranBulan>();
    for (const a of dataContoh.attendance) {
      const bulan = a.tanggal.slice(0, 7);
      const baris = peta.get(bulan) ?? { bulan, hadir: 0, izin: 0 };
      if (a.status === "izin" || a.status === "sakit") baris.izin += 1;
      else baris.hadir += 1;
      peta.set(bulan, baris);
    }
    return {
      v1,
      v2: [...peta.values()].sort((a, b) => a.bulan.localeCompare(b.bulan)),
    };
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("kehadiran_per_bulan");
  if (error || !data) return { v1, v2: null };

  return {
    v1,
    v2: data.map((r) => ({
      bulan: r.bulan,
      hadir: Number(r.hadir),
      izin: Number(r.izin),
    })),
  };
}

/** Angka sisi V1, dibaca dari ekspor yang tersimpan. */
async function angkaV1(): Promise<AngkaV1 | null> {
  if (modeData() === "demo") {
    const { default: berkas } =
      await import("../../../supabase/migrasi/ekspor-contoh.json");
    return angkaEksporV1(berkas as Record<string, unknown>);
  }

  const sb = await klienServer();
  // Hanya kunci yang benar-benar dipakai menghitung; ekspor lama terlalu
  // besar untuk ditarik seluruhnya setiap kali halaman dibuka.
  const { data, error } = await sb
    .from("kv_store_lama")
    .select("key, value")
    .in(
      "key",
      KUNCI_DIKENAL.map((k) => k.kunci),
    );

  if (error || !data || data.length === 0) return null;
  return angkaEksporV1(
    Object.fromEntries(data.map((b) => [b.key, b.value])) as Record<
      string,
      unknown
    >,
  );
}

type AngkaV2 = {
  anggota: number;
  anggotaAktif: number;
  akun: number;
  laporan: number;
  /** Seluruh baris kehadiran, termasuk yang berstatus izin/sakit. */
  kehadiran: number;
  /** Baris kehadiran yang orangnya benar-benar masuk. */
  absensi: number;
  izin: number;
  tugas: number;
  todo: number;
  transaksi: number;
  kasMasuk: number;
  kasKeluar: number;
  kasBulan: KasBulan[];
  gmv: GmvUnitBulan[] | null;
};

/**
 * Angka sisi V2.
 *
 * Mode demo menghitungnya dari data seed — sumber yang sama dengan isi
 * seluruh layar demo lainnya, sehingga pembandingnya tetap masuk akal
 * meski tidak ada database.
 */
async function angkaV2(): Promise<AngkaV2 | null> {
  if (modeData() === "demo") {
    const unitAkun = new Map(
      dataContoh.accounts.map((a) => [a.username, a.unit]),
    );

    const gmv = new Map<string, GmvUnitBulan>();
    for (const l of dataContoh.daily_reports) {
      const bulan = l.tanggal.slice(0, 7);
      const unit = l.akun ? (unitAkun.get(l.akun) ?? "affiliator") : l.unit;
      if (!unit) continue;
      const kunci = `${unit}|${bulan}`;
      const baris = gmv.get(kunci) ?? { unit, bulan, gmv: 0, laporan: 0 };
      baris.gmv += l.gmv ?? 0;
      baris.laporan += 1;
      gmv.set(kunci, baris);
    }

    // Hanya yang sudah dibayar: arus kas lama seluruhnya sudah terjadi,
    // jadi yang sebanding hanya yang sudah terjadi juga di V2.
    const dibayar = dataContoh.transaksi.filter((t) => t.status === "dibayar");
    const masuk = dibayar
      .filter((t) => t.arah === "masuk")
      .reduce((a, t) => a + t.jumlah, 0);
    const keluar = dibayar
      .filter((t) => t.arah !== "masuk")
      .reduce((a, t) => a + t.jumlah, 0);

    const izin = dataContoh.attendance.filter(
      (a) => a.status === "izin" || a.status === "sakit",
    ).length;
    const todo = dataContoh.tasks.filter((t) => t.tipe === "pribadi").length;

    const kasPerBulan = new Map<string, KasBulan>();
    for (const t of dibayar) {
      const bulan = t.tanggal.slice(0, 7);
      const baris = kasPerBulan.get(bulan) ?? { bulan, masuk: 0, keluar: 0 };
      if (t.arah === "masuk") baris.masuk += t.jumlah;
      else baris.keluar += t.jumlah;
      kasPerBulan.set(bulan, baris);
    }

    return {
      anggota: dataContoh.users.length,
      // Seluruh orang di seed memang aktif; yang nonaktif tidak diseed.
      anggotaAktif: dataContoh.users.length,
      akun: dataContoh.accounts.length,
      laporan: dataContoh.daily_reports.length,
      kehadiran: dataContoh.attendance.length,
      absensi: dataContoh.attendance.length - izin,
      izin,
      tugas: dataContoh.tasks.length - todo,
      todo,
      transaksi: dibayar.length,
      kasMasuk: masuk,
      kasKeluar: keluar,
      kasBulan: [...kasPerBulan.values()].sort((a, b) =>
        a.bulan.localeCompare(b.bulan),
      ),
      gmv: [...gmv.values()].sort(
        (a, b) =>
          a.bulan.localeCompare(b.bulan) || a.unit.localeCompare(b.unit),
      ),
    };
  }

  const sb = await klienServer();
  const hitung = async (
    tabel:
      | "users"
      | "accounts"
      | "daily_reports"
      | "attendance"
      | "transactions"
      | "tasks",
  ) => {
    const { count } = await sb.from(tabel).select("id", {
      count: "exact",
      head: true,
    });
    return count ?? 0;
  };

  /** Hitungan dengan penyaring; dipakai memisahkan izin dari kehadiran. */
  const hitungIzin = async () => {
    const { count } = await sb
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .in("status", ["izin", "sakit"]);
    return count ?? 0;
  };
  const hitungTodo = async () => {
    const { count } = await sb
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("tipe", "pribadi");
    return count ?? 0;
  };

  const hitungAktif = async () => {
    const { count } = await sb
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("status", "aktif");
    return count ?? 0;
  };

  const [
    anggota,
    anggotaAktif,
    akun,
    laporan,
    kehadiran,
    tugasSemua,
    izin,
    todo,
  ] = await Promise.all([
    hitung("users"),
    hitungAktif(),
    hitung("accounts"),
    hitung("daily_reports"),
    hitung("attendance"),
    hitung("tasks"),
    hitungIzin(),
    hitungTodo(),
  ]);

  // Penyaringnya harus sama dengan yang dipakai menjumlahkan: kalau
  // hitungannya mencakup transaksi yang belum dibayar sementara
  // jumlahnya tidak, pembandingnya membandingkan dua hal berbeda dan
  // selisihnya tidak bisa dijelaskan siapa pun.
  const { data: kas } = await sb
    .from("transactions")
    .select("arah, jumlah, tanggal")
    .eq("status", "dibayar");

  const masuk = (kas ?? [])
    .filter((t) => t.arah === "masuk")
    .reduce((a, t) => a + Number(t.jumlah), 0);
  const keluar = (kas ?? [])
    .filter((t) => t.arah !== "masuk")
    .reduce((a, t) => a + Number(t.jumlah), 0);

  const { data: gmvDb } = await sb.rpc("gmv_unit_bulan");

  return {
    anggota,
    anggotaAktif,
    akun,
    laporan,
    kehadiran,
    absensi: kehadiran - izin,
    izin,
    tugas: tugasSemua - todo,
    todo,
    // Hanya yang sudah dibayar: arus kas lama seluruhnya sudah terjadi,
    // jadi yang sebanding hanya yang sudah terjadi juga di V2.
    transaksi: (kas ?? []).length,
    kasMasuk: masuk,
    kasKeluar: keluar,
    kasBulan: [
      ...(kas ?? [])
        .reduce((peta, t) => {
          const bulan = String(t.tanggal).slice(0, 7);
          const baris = peta.get(bulan) ?? { bulan, masuk: 0, keluar: 0 };
          if (t.arah === "masuk") baris.masuk += Number(t.jumlah);
          else baris.keluar += Number(t.jumlah);
          peta.set(bulan, baris);
          return peta;
        }, new Map<string, KasBulan>())
        .values(),
    ].sort((a, b) => a.bulan.localeCompare(b.bulan)),
    // Dihitung database (0156); menariknya ke sini berarti memindahkan
    // seluruh laporan harian hanya untuk menjumlahkannya.
    gmv: (gmvDb ?? []).map((g) => ({
      unit: g.unit,
      bulan: g.bulan,
      gmv: Number(g.gmv),
      laporan: Number(g.laporan),
    })),
  };
}

/** Menyusun seluruh kelompok pembanding untuk layar verifikasi. */
export async function bandingV1V2(): Promise<KelompokBanding[]> {
  const v1: AngkaV1 | null = await angkaV1();
  const v2: AngkaV2 | null = await angkaV2();
  const rujukan: TargetRujukan[] = await rujukanV1();
  const target: TargetRujukan[] | null = await targetV2();
  const hadir = await kehadiranBulan();
  const kasV1 = kasBulanV1(await isiEksporLama());

  const baris = (
    ukuran: string,
    kiri: number | null,
    kanan: number | null,
    satuan: BarisBanding["satuan"] = "angka",
    catatan?: string,
  ): BarisBanding => ({ ukuran, v1: kiri, v2: kanan, satuan, catatan });

  // GMV disandingkan per (unit, bulan) — gabungan dari kedua sisi supaya
  // unit-bulan yang hanya muncul di salah satunya tetap kelihatan.
  const kunciGmv = new Set([
    ...(v1?.gmv ?? []).map((g) => `${g.unit}|${g.bulan}`),
    ...(v2?.gmv ?? []).map((g) => `${g.unit}|${g.bulan}`),
  ]);
  const petaV1 = new Map(
    (v1?.gmv ?? []).map((g) => [`${g.unit}|${g.bulan}`, g]),
  );
  const petaV2 = new Map(
    (v2?.gmv ?? []).map((g) => [`${g.unit}|${g.bulan}`, g]),
  );

  const barisGmv = [...kunciGmv].sort().flatMap((k) => {
    const [unit, bulan] = k.split("|");
    return [
      baris(
        `GMV ${unit} · ${bulan}`,
        petaV1.get(k)?.gmv ?? (v1 ? 0 : null),
        v2?.gmv ? (petaV2.get(k)?.gmv ?? 0) : null,
        "rupiah",
      ),
      // Jumlah laporannya ikut dibandingkan, bukan hanya GMV-nya:
      // laporan unit masuk dengan GMV nol, jadi laporan unit yang hilang
      // tidak akan pernah terlihat dari angka GMV.
      baris(
        `Laporan ${unit} · ${bulan}`,
        petaV1.get(k)?.laporan ?? (v1 ? 0 : null),
        v2?.gmv ? (petaV2.get(k)?.laporan ?? 0) : null,
      ),
    ];
  });

  return [
    {
      kunci: "anggota",
      judul: "Anggota & absensi",
      keterangan:
        "Orang yang terbawa dan kehadiran yang tercatat. Anggota yang tidak pindah membuat seluruh data yang menunjuknya ikut menggantung.",
      baris: [
        baris("Jumlah anggota", v1?.anggota ?? null, v2?.anggota ?? null),
        baris(
          "Anggota aktif",
          v1?.anggotaAktif ?? null,
          v2?.anggotaAktif ?? null,
          "angka",
          "Selisih di sini wajar: orang bisa berhenti atau masuk setelah ekspor diambil.",
        ),
        baris("Akun affiliator", v1?.akun ?? null, v2?.akun ?? null),
        baris(
          "Seluruh baris kehadiran",
          v1 ? v1.absensi + v1.izin : null,
          v2?.kehadiran ?? null,
          "angka",
          "V1 memisahkan absensi dan izin ke dua kunci; V2 menyimpan keduanya di attendance, jadi yang dibandingkan jumlah keduanya.",
        ),
        baris("Kehadiran (masuk)", v1?.absensi ?? null, v2?.absensi ?? null),
        baris("Izin & sakit", v1?.izin ?? null, v2?.izin ?? null),
        // Total yang cocok belum berarti utuh: seribu baris di kedua
        // sisi bisa jatuh di bulan yang berbeda-beda.
        ...[
          ...new Set([
            ...hadir.v1.map((h) => h.bulan),
            ...(hadir.v2 ?? []).map((h) => h.bulan),
          ]),
        ]
          .sort()
          .map((bulan) =>
            baris(
              `Kehadiran ${bulan}`,
              hadir.v1.find((h) => h.bulan === bulan)?.hadir ?? 0,
              hadir.v2
                ? (hadir.v2.find((h) => h.bulan === bulan)?.hadir ?? 0)
                : null,
            ),
          ),
      ],
    },
    {
      kunci: "tugas",
      judul: "Tugas & todo",
      keterangan:
        "Tugas delegasi dan todo pribadi. Keduanya menempati tabel yang sama di V2 dan hanya dibedakan tipenya, jadi selisihnya paling mudah terlihat dari sini.",
      baris: [
        baris("Tugas & tiket", v1?.tugas ?? null, v2?.tugas ?? null),
        baris("Todo pribadi", v1?.todo ?? null, v2?.todo ?? null),
        baris(
          "Seluruh baris tugas",
          v1 ? v1.tugas + v1.todo : null,
          v2 ? v2.tugas + v2.todo : null,
        ),
      ],
    },
    {
      kunci: "laporan",
      judul: "Laporan & GMV",
      keterangan:
        "Jumlah laporan dan GMV per unit per bulan. Inilah angka yang dipakai seluruh KPI, jadi selisih sekecil apa pun di sini perlu dijelaskan.",
      baris: [
        baris("Jumlah laporan", v1?.laporan ?? null, v2?.laporan ?? null),
        ...barisGmv,
      ],
    },
    {
      kunci: "rujukan",
      judul: "Target lama (rujukan saja)",
      keterangan:
        "gmv:targets dan affiliate:goal tidak dipetakan ke mana pun — target V2 hidup sebagai goal berjenjang, dan menimpanya akan mengubah dasar penilaian KPI yang sedang berjalan. Angkanya dicatat di sini supaya selisih capaian bisa dijelaskan.",
      baris:
        rujukan.length === 0
          ? [
              baris(
                "Target di ekspor lama",
                0,
                null,
                "angka",
                "Ekspornya tidak memuat kunci gmv:targets.",
              ),
            ]
          : [...new Set(rujukan.map((r) => `${r.unit}|${r.bulan}`))]
              .sort()
              .map((k) => {
                const [unit, bulan] = k.split("|");
                return baris(
                  `Target ${unit} · ${bulan}`,
                  rujukan.find((r) => `${r.unit}|${r.bulan}` === k)?.target ??
                    null,
                  target
                    ? (target.find((t) => `${t.unit}|${t.bulan}` === k)
                        ?.target ?? 0)
                    : null,
                  "rupiah",
                  "Selisih target bukan kesalahan migrasi: target V2 ditetapkan ulang lewat GRD.",
                );
              }),
    },
    {
      kunci: "keuangan",
      judul: "Keuangan & saldo",
      keterangan:
        "Transaksi kas dan saldo akhirnya. Saldo yang tidak bertemu berarti ada transaksi yang hilang atau masuk dua kali.",
      baris: [
        baris(
          "Jumlah transaksi",
          v1?.transaksi ?? null,
          v2?.transaksi ?? null,
          "angka",
          "Hanya yang berstatus dibayar di kedua sisi: arus kas lama seluruhnya sudah terjadi.",
        ),
        baris(
          "Kas masuk",
          v1?.kasMasuk ?? null,
          v2?.kasMasuk ?? null,
          "rupiah",
        ),
        baris(
          "Kas keluar",
          v1?.kasKeluar ?? null,
          v2?.kasKeluar ?? null,
          "rupiah",
        ),
        baris(
          "Saldo akhir",
          v1?.saldo ?? null,
          v2 ? v2.kasMasuk - v2.kasKeluar : null,
          "rupiah",
        ),
        // Saldo yang cocok belum berarti arus kasnya utuh: satu masuk
        // dan satu keluar yang sama-sama hilang akan saling meniadakan.
        ...[
          ...new Set([
            ...kasV1.map((k) => k.bulan),
            ...(v2?.kasBulan ?? []).map((k) => k.bulan),
          ]),
        ]
          .sort()
          .flatMap((bulan) => [
            baris(
              `Kas masuk ${bulan}`,
              kasV1.find((k) => k.bulan === bulan)?.masuk ?? 0,
              v2
                ? (v2.kasBulan.find((k) => k.bulan === bulan)?.masuk ?? 0)
                : null,
              "rupiah",
            ),
            baris(
              `Kas keluar ${bulan}`,
              kasV1.find((k) => k.bulan === bulan)?.keluar ?? 0,
              v2
                ? (v2.kasBulan.find((k) => k.bulan === bulan)?.keluar ?? 0)
                : null,
              "rupiah",
            ),
          ]),
      ],
    },
  ];
}
