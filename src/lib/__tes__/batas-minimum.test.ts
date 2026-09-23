import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  BATAS_MINIMUM_LEVEL,
  batasMinimum,
  labelBatasMinimum,
  LEVEL_MAKS,
  LEVEL_MIN,
  hitungKepatuhanMinimum,
  kurangnya,
  levelSah,
  minimumSasaran,
  rataKepatuhan,
  statusMinimum,
  statusTerkirim,
  type HariKepatuhan,
} from "@/lib/batas-minimum";
import type { SasaranLaporan } from "@/lib/types";

test("deret batas minimum sesuai ketetapan level 0-8", () => {
  assert.deepEqual([...BATAS_MINIMUM_LEVEL], [3, 5, 7, 10, 10, 12, 15, 20, 20]);
  assert.equal(BATAS_MINIMUM_LEVEL.length, LEVEL_MAKS - LEVEL_MIN + 1);
});

test("batas minimum dibaca per level, termasuk level nol", () => {
  assert.equal(batasMinimum(0), 3);
  assert.equal(batasMinimum(3), 10);
  assert.equal(batasMinimum(4), 10, "level 3 dan 4 memang sama");
  assert.equal(batasMinimum(8), 20);
});

test("level di luar rentang atau belum ditetapkan bernilai null", () => {
  // null, bukan 0: "belum punya level" berbeda dari "minimumnya nol".
  assert.equal(batasMinimum(null), null);
  assert.equal(batasMinimum(undefined), null);
  assert.equal(batasMinimum(-1), null);
  assert.equal(batasMinimum(9), null);
  assert.equal(batasMinimum(2.5), null, "level bukan bilangan bulat");
  assert.equal(batasMinimum("3"), null, "teks bukan level");
});

test("levelSah menerima bilangan bulat 0-8 saja", () => {
  assert.equal(levelSah(0), true);
  assert.equal(levelSah(8), true);
  assert.equal(levelSah(9), false);
  assert.equal(levelSah(-1), false);
  assert.equal(levelSah(1.5), false);
  assert.equal(levelSah(null), false);
});

test("label badge menyebut level dan angkanya", () => {
  assert.equal(labelBatasMinimum(3), "batas minimum level 3: 10 video");
  assert.equal(labelBatasMinimum(0), "batas minimum level 0: 3 video");
  assert.equal(labelBatasMinimum(null), null);
});

test("nol dianggap belum diisi, bukan langsung kurang", () => {
  // Form yang baru dibuka belum mengatakan apa pun tentang hari itu;
  // memerahkannya sejak awal membuat peringatan sungguhan diabaikan.
  assert.equal(statusMinimum(0, 10), "belum-diisi");
  assert.equal(statusMinimum(null, 10), "belum-diisi");
});

test("angka di bawah minimum ditandai kurang, tepat minimum terpenuhi", () => {
  assert.equal(statusMinimum(9, 10), "kurang");
  assert.equal(statusMinimum(10, 10), "terpenuhi", "tepat batas sudah cukup");
  assert.equal(statusMinimum(12, 10), "terpenuhi");
});

test("tanpa batas minimum tidak ada status sama sekali", () => {
  // Sasaran tingkat unit tidak punya level, jadi tidak dinilai.
  assert.equal(statusMinimum(5, null), null);
  assert.equal(statusMinimum(0, null), null);
});

test("kurangnya menghitung sisa yang perlu diunggah", () => {
  assert.equal(kurangnya(4, 10), 6);
  assert.equal(kurangnya(10, 10), 0);
  assert.equal(kurangnya(12, 10), 0, "lebih dari cukup tidak bernilai negatif");
  assert.equal(kurangnya(0, 10), 10);
  assert.equal(kurangnya(null, 10), 10);
  assert.equal(kurangnya(3, null), 0, "tanpa minimum tidak ada yang kurang");
});

const akun = (level: number | null): SasaranLaporan => ({
  jenis: "akun",
  akun: {
    id: "a1",
    platform: "TikTok Shop",
    username: "@toko",
    picNama: "Rian",
    unitId: "affiliator",
    program: null,
    targetHarian: 1000,
    level,
    status: "aktif",
  },
});

test("minimum mengikuti akun yang sedang dipilih", () => {
  assert.deepEqual(minimumSasaran(akun(3)), { level: 3, minimum: 10 });
  assert.deepEqual(minimumSasaran(akun(8)), { level: 8, minimum: 20 });
});

test("sasaran tingkat unit tidak punya batas minimum", () => {
  // MCN & TAP melapor per unit; unit tidak punya level.
  const unit: SasaranLaporan = {
    jenis: "unit",
    unitId: "mcn",
    nama: "MCN",
    targetHarian: 5000,
  };
  assert.deepEqual(minimumSasaran(unit), { level: null, minimum: null });
});

test("belum memilih sasaran juga tidak menampilkan batas minimum", () => {
  assert.deepEqual(minimumSasaran(undefined), { level: null, minimum: null });
  assert.deepEqual(minimumSasaran(akun(null)), { level: null, minimum: null });
});

const hari = (
  tanggal: string,
  hariKerja: boolean,
  unggahan: number | null,
): HariKepatuhan => ({ tanggal, hariKerja, unggahan });

test("hanya hari dengan absensi masuk yang masuk pembagi", () => {
  // Izin yang disetujui dan libur tidak dihitung sama sekali.
  const hasil = hitungKepatuhanMinimum(
    [
      hari("2024-10-21", true, 10),
      hari("2024-10-22", false, null), // izin disetujui
      hari("2024-10-23", false, null), // libur
      hari("2024-10-24", true, 10),
    ],
    10,
  );
  assert.equal(hasil.hariKerja, 2);
  assert.equal(hasil.terpenuhi, 2);
  assert.equal(hasil.rasio, 100);
});

test("hari kerja tanpa laporan dinilai tidak terpenuhi", () => {
  // Diam bukan alasan: kalau null dianggap netral, yang tidak melapor
  // sama sekali justru terlihat paling patuh.
  const hasil = hitungKepatuhanMinimum(
    [hari("2024-10-21", true, 10), hari("2024-10-22", true, null)],
    10,
  );
  assert.equal(hasil.hariKerja, 2);
  assert.equal(hasil.terpenuhi, 1);
  assert.equal(hasil.rasio, 50);
});

test("tepat di batas sudah terpenuhi, kurang satu tidak", () => {
  assert.equal(
    hitungKepatuhanMinimum([hari("2024-10-21", true, 10)], 10).terpenuhi,
    1,
  );
  assert.equal(
    hitungKepatuhanMinimum([hari("2024-10-21", true, 9)], 10).terpenuhi,
    0,
  );
});

test("tanpa level tidak ada penilaian sama sekali", () => {
  const hasil = hitungKepatuhanMinimum([hari("2024-10-21", true, 99)], null);
  assert.equal(hasil.rasio, null);
  assert.equal(hasil.hariKerja, 0);
});

test("tanpa satu pun hari kerja, rasionya null bukan nol", () => {
  // Orang yang cuti sebulan penuh tidak berkepatuhan 0%; ia tidak dinilai.
  const hasil = hitungKepatuhanMinimum(
    [hari("2024-10-21", false, null), hari("2024-10-22", false, null)],
    10,
  );
  assert.equal(hasil.hariKerja, 0);
  assert.equal(hasil.rasio, null);
});

test("kepatuhan orang adalah rata-rata per akun, bukan per hari", () => {
  // Akun ramai 20 hari (100%) dan akun sepi 2 hari (0%) menghasilkan
  // 50%, bukan 91% yang akan muncul kalau harinya digabung.
  const ramai = hitungKepatuhanMinimum(
    Array.from({ length: 20 }, (_, i) => hari(`2024-10-${i + 1}`, true, 10)),
    10,
  );
  const sepi = hitungKepatuhanMinimum(
    [hari("2024-10-21", true, 0), hari("2024-10-22", true, 1)],
    10,
  );
  const rata = rataKepatuhan([ramai, sepi]);
  assert.equal(rata.rasio, 50);
  assert.equal(rata.hariKerja, 22);
  assert.equal(rata.terpenuhi, 20);
});

test("akun yang tidak dinilai tidak ikut menarik rata-rata", () => {
  const dinilai = hitungKepatuhanMinimum([hari("2024-10-21", true, 10)], 10);
  const tanpaLevel = hitungKepatuhanMinimum(
    [hari("2024-10-21", true, 0)],
    null,
  );
  assert.equal(rataKepatuhan([dinilai, tanpaLevel]).rasio, 100);
  assert.deepEqual(rataKepatuhan([tanpaLevel]).rasio, null);
  assert.deepEqual(rataKepatuhan([]).rasio, null);
});

test("angka yang sudah dikirim dinilai apa adanya, nol termasuk", () => {
  // Di form nol berarti "belum diisi"; di riwayat nol adalah pernyataan.
  assert.equal(statusMinimum(0, 10), "belum-diisi");
  assert.equal(statusTerkirim(0, 10), "kurang");

  assert.equal(statusTerkirim(10, 10), "terpenuhi", "tepat di batas lulus");
  assert.equal(statusTerkirim(11, 10), "terpenuhi");
  assert.equal(statusTerkirim(9, 10), "kurang");
});

test("tanpa level atau tanpa kolom unggahan, tidak ada yang dinilai", () => {
  assert.equal(statusTerkirim(3, null), null, "akun tanpa level");
  assert.equal(statusTerkirim(null, 10), null, "laporan tanpa kolom unggahan");
  assert.equal(statusTerkirim(null, null), null);
});

test("level yang bukan bilangan bulat 0-8 tidak punya batas", () => {
  // Nilai-nilai ini datang dari luar: kolom lama, query mentah, dan
  // JSON yang tidak diketik. Yang penting bukan melempar galat,
  // melainkan tidak mengarang batas.
  for (const salah of [
    -1,
    9,
    1.5,
    NaN,
    Infinity,
    "3",
    null,
    undefined,
    true,
    {},
  ]) {
    assert.equal(levelSah(salah), false, `level ${String(salah)} tidak sah`);
    assert.equal(batasMinimum(salah), null);
    assert.equal(labelBatasMinimum(salah), null);
  }
});

test("batas nol atau negatif berarti tidak ada standar, bukan standar longgar", () => {
  // Kalau nol diperlakukan sebagai batas, tiap hari akan terhitung
  // "terpenuhi" dan kepatuhan seluruh perusahaan naik tanpa satu pun
  // unggahan bertambah.
  for (const batas of [0, -5, NaN, Infinity]) {
    assert.equal(statusMinimum(3, batas), null, `batas ${batas}`);
    assert.equal(statusTerkirim(3, batas), null, `batas ${batas}`);
    assert.equal(kurangnya(0, batas), 0, `batas ${batas}`);
    assert.equal(
      hitungKepatuhanMinimum([hari("2024-10-21", true, 0)], batas).rasio,
      null,
      `batas ${batas}`,
    );
  }
});

test("unggahan negatif tidak pernah dianggap memenuhi", () => {
  // Angka negatif seharusnya tidak ada, tapi kalau muncul ia harus
  // terbaca sebagai kurang — bukan lolos lewat perbandingan yang salah.
  assert.equal(statusTerkirim(-3, 10), "kurang");
  assert.equal(kurangnya(-3, 10), 10, "kekurangannya tidak melebihi batasnya");
  assert.equal(
    hitungKepatuhanMinimum([hari("2024-10-21", true, -3)], 10).terpenuhi,
    0,
  );
});

test("hari yang sama dua kali dihitung dua kali", () => {
  // Bukan cacat yang ditutup diam-diam: pemanggilnya yang bertanggung
  // jawab mengirim satu baris per hari, dan menyatukannya di sini akan
  // menyembunyikan data ganda yang justru perlu ketahuan.
  const hasil = hitungKepatuhanMinimum(
    [hari("2024-10-21", true, 10), hari("2024-10-21", true, 2)],
    10,
  );
  assert.equal(hasil.hariKerja, 2);
  assert.equal(hasil.terpenuhi, 1);
});

test("rata-rata kepatuhan tidak dibulatkan diam-diam", () => {
  // Pembulatan dilakukan saat menampilkan, bukan saat menghitung:
  // membulatkan di sini membuat rata-rata dari rata-rata melenceng.
  const a = hitungKepatuhanMinimum(
    [
      hari("2024-10-21", true, 10),
      hari("2024-10-22", true, 0),
      hari("2024-10-23", true, 0),
    ],
    10,
  );
  assert.equal(a.rasio, (1 / 3) * 100);
  assert.equal(rataKepatuhan([a]).rasio, (1 / 3) * 100);
});

test("daftar hari kosong tidak dinilai meski batasnya ada", () => {
  const hasil = hitungKepatuhanMinimum([], 10);
  assert.equal(hasil.hariKerja, 0);
  assert.equal(hasil.terpenuhi, 0);
  assert.equal(hasil.rasio, null, "bukan nol persen; memang tidak dinilai");
  assert.equal(hasil.minimum, 10, "batasnya tetap disebut");
});

test("minimumSasaran tahan terhadap sasaran yang tidak ada", () => {
  assert.deepEqual(minimumSasaran(undefined), { level: null, minimum: null });
});
