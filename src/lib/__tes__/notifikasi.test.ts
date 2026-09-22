import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  KATEGORI_NOTIFIKASI,
  KETERANGAN_KATEGORI,
  LABEL_KATEGORI,
  bacaSaringanNotifikasi,
  belumDibaca,
  hitungPerKategori,
  jumlahBelumDibaca,
  kelompokWaktu,
  kelompokkanNotifikasi,
  labelLencana,
  saringNotifikasi,
  tautanAman,
  type Notifikasi,
} from "@/lib/notifikasi";

const n = (
  id: string,
  dibuat: string,
  dibaca: string | null = null,
  kategori: Notifikasi["kategori"] = "tugas",
): Notifikasi => ({
  id,
  kategori,
  judul: `Judul ${id}`,
  pesan: "pesan",
  tautan: "/tugas",
  dibacaPada: dibaca,
  dibuatPada: dibuat,
});

test("yang belum dibaca dihitung terpisah dari totalnya", () => {
  const daftar = [
    n("a", "2024-10-24T08:00:00+07:00"),
    n("b", "2024-10-24T09:00:00+07:00", "2024-10-24T09:05:00+07:00"),
    n("c", "2024-10-23T10:00:00+07:00"),
  ];
  assert.equal(jumlahBelumDibaca(daftar), 2);
  assert.deepEqual(
    belumDibaca(daftar).map((x) => x.id),
    ["a", "c"],
  );
});

test("lencana kosong saat tidak ada yang belum dibaca", () => {
  assert.equal(labelLencana(0), null);
  assert.equal(labelLencana(-1), null);
});

test("lencana tidak tumbuh melewati tiga karakter", () => {
  assert.equal(labelLencana(1), "1");
  assert.equal(labelLencana(99), "99");
  assert.equal(labelLencana(100), "99+");
  assert.equal(labelLencana(4821), "99+");
});

test("kelompok waktu dihitung dari tanggalnya, bukan jamnya", () => {
  const hariIni = "2024-10-24";
  assert.equal(kelompokWaktu("2024-10-24T23:59:00+07:00", hariIni), "hari-ini");
  assert.equal(kelompokWaktu("2024-10-24T00:01:00+07:00", hariIni), "hari-ini");
  assert.equal(kelompokWaktu("2024-10-23T08:00:00+07:00", hariIni), "kemarin");
  assert.equal(
    kelompokWaktu("2024-10-19T08:00:00+07:00", hariIni),
    "pekan-ini",
  );
  assert.equal(
    kelompokWaktu("2024-10-01T08:00:00+07:00", hariIni),
    "lebih-lama",
  );
});

test("notifikasi dari masa depan tetap masuk 'hari ini', bukan kelompok asing", () => {
  assert.equal(
    kelompokWaktu("2024-10-25T08:00:00+07:00", "2024-10-24"),
    "hari-ini",
  );
});

test("kelompok kosong tidak ikut muncul", () => {
  const hasil = kelompokkanNotifikasi(
    [n("a", "2024-10-24T08:00:00+07:00"), n("b", "2024-10-01T08:00:00+07:00")],
    "2024-10-24",
  );
  assert.deepEqual(
    hasil.map((k) => k.kelompok),
    ["hari-ini", "lebih-lama"],
  );
});

test("dalam satu kelompok, yang terbaru di atas", () => {
  const hasil = kelompokkanNotifikasi(
    [
      n("pagi", "2024-10-24T08:00:00+07:00"),
      n("sore", "2024-10-24T17:00:00+07:00"),
      n("siang", "2024-10-24T12:00:00+07:00"),
    ],
    "2024-10-24",
  );
  assert.deepEqual(
    hasil[0].isi.map((x) => x.id),
    ["sore", "siang", "pagi"],
  );
});

test("saringan kategori dan 'belum dibaca' bisa dipakai bersamaan", () => {
  const daftar = [
    n("a", "2024-10-24T08:00:00+07:00", null, "tugas"),
    n("b", "2024-10-24T09:00:00+07:00", "2024-10-24T09:30:00+07:00", "tugas"),
    n("c", "2024-10-24T10:00:00+07:00", null, "transaksi"),
  ];
  assert.deepEqual(
    saringNotifikasi(daftar, {
      kategori: "tugas",
      hanyaBelumDibaca: true,
    }).map((x) => x.id),
    ["a"],
  );
  assert.equal(
    saringNotifikasi(daftar, { kategori: "semua", hanyaBelumDibaca: false })
      .length,
    3,
  );
});

test("saringan dari URL menolak kategori yang tidak dikenal", () => {
  assert.deepEqual(bacaSaringanNotifikasi({ kategori: "tugas", belum: "1" }), {
    kategori: "tugas",
    hanyaBelumDibaca: true,
  });
  assert.deepEqual(bacaSaringanNotifikasi({ kategori: "karangan" }), {
    kategori: "semua",
    hanyaBelumDibaca: false,
  });
  assert.deepEqual(bacaSaringanNotifikasi({}), {
    kategori: "semua",
    hanyaBelumDibaca: false,
  });
});

test("hitungan per kategori menjumlahkan tepat, termasuk yang nol", () => {
  const hasil = hitungPerKategori([
    n("a", "2024-10-24T08:00:00+07:00", null, "tugas"),
    n("b", "2024-10-24T09:00:00+07:00", null, "tugas"),
    n("c", "2024-10-24T10:00:00+07:00", null, "izin"),
  ]);
  assert.equal(hasil.semua, 3);
  assert.equal(hasil.tugas, 2);
  assert.equal(hasil.izin, 1);
  assert.equal(hasil.anggaran, 0);
});

test("setiap kategori punya label, keterangan, dan gaya", () => {
  for (const k of KATEGORI_NOTIFIKASI) {
    assert.ok(LABEL_KATEGORI[k]?.length > 0, `label ${k}`);
    assert.ok(KETERANGAN_KATEGORI[k]?.length > 0, `keterangan ${k}`);
  }
});

test("hanya tautan internal yang diterima", () => {
  for (const t of ["/tugas", "/keuangan/transaksi?periode=bulanan", "/"]) {
    assert.equal(tautanAman(t), true, t);
  }
  for (const t of [
    "//jahat.example.com",
    "https://jahat.example.com",
    "javascript:alert(1)",
    "tugas",
    "",
  ]) {
    assert.equal(tautanAman(t), false, t);
  }
});
