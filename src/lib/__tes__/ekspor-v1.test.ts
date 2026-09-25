import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  BATAS_UNGGAH_BYTE,
  MEDAN_KREDENSIAL,
  bacaEksporV1,
  bacaMeta,
  buangKredensial,
  BATAS_UNGGAH_MB,
  KUNCI_DIKENAL,
  golonganKunci,
  ringkasanUnggahan,
  tolakBerkas,
  ukuranBerkas,
  type BarisUnggah,
} from "@/lib/ekspor-v1";

test("seluruh kunci ekspor yang dipetakan dikenali dan tidak ada yang kembar", () => {
  assert.equal(KUNCI_DIKENAL.length, 23);
  const kunci = KUNCI_DIKENAL.map((k) => k.kunci);
  assert.equal(new Set(kunci).size, 23);
  for (const k of kunci) assert.equal(golonganKunci(k), "dikenal");
});

test("kunci rujukan, kunci diabaikan, dan kunci asing dibedakan", () => {
  assert.equal(golonganKunci("gmv:targets"), "referensi");
  assert.equal(golonganKunci("affiliate:goal"), "referensi");
  assert.equal(golonganKunci("img:store"), "diabaikan");
  assert.equal(golonganKunci("app:settings"), "diabaikan");
  // Kunci yang belum pernah terlihat tidak boleh ikut terhitung diabaikan:
  // orang harus memutuskannya, bukan sistem yang diam-diam membuangnya.
  assert.equal(golonganKunci("sellers:all"), "asing");
});

test("berkas ditolak bila bukan .json, kosong, atau melewati batas", () => {
  assert.match(tolakBerkas({ nama: "ekspor.zip", ukuran: 10 }) ?? "", /\.json/);
  assert.match(tolakBerkas({ nama: "ekspor.json", ukuran: 0 }) ?? "", /kosong/);
  assert.match(
    tolakBerkas({ nama: "ekspor.json", ukuran: BATAS_UNGGAH_BYTE + 1 }) ?? "",
    new RegExp(`${BATAS_UNGGAH_MB} MB`),
  );
  assert.equal(tolakBerkas({ nama: "ekspor.json", ukuran: 1024 }), null);
  // Tepat di batas masih boleh — batas 30 MB berarti 30 MB ikut diterima.
  assert.equal(
    tolakBerkas({ nama: "EKSPOR.JSON", ukuran: BATAS_UNGGAH_BYTE }),
    null,
  );
});

test("ukuran berkas ditulis dalam satuan yang enak dibaca", () => {
  assert.equal(ukuranBerkas(512), "512 B");
  assert.equal(ukuranBerkas(2048), "2 KB");
  assert.equal(ukuranBerkas(1024 * 1024 * 21.5), "21,5 MB");
});

const baris = (
  kunci: string,
  jumlah: number,
  disimpan: boolean,
): BarisUnggah => ({
  kunci,
  golongan: golonganKunci(kunci),
  jumlah,
  disimpan,
});

test("ringkasan memisahkan yang tersimpan dari yang dilewatkan", () => {
  const r = ringkasanUnggahan([
    baris("users:list", 42, true),
    baris("daily-reports:all", 1200, true),
    baris("gmv:targets", 12, true),
    baris("img:store", 800, false),
    baris("app:settings", 1, false),
  ]);

  assert.equal(r.kunci, 5);
  assert.equal(r.entri, 2055);
  assert.equal(r.kunciDisimpan, 3);
  assert.equal(r.entriDisimpan, 1254);
  assert.equal(r.kunciDilewati, 2);
  assert.equal(r.entriDilewati, 801);
  assert.equal(r.kunciAsing, 0);
});

test("kunci asing dihitung tersendiri meski isinya tersimpan", () => {
  const r = ringkasanUnggahan([
    baris("users:list", 5, true),
    baris("sellers:all", 9, true),
    baris("notes:all", 3, true),
  ]);

  // Tersimpan supaya tidak hilang, tetapi tetap terhitung menunggu
  // keputusan — dua hal yang berbeda dan tidak boleh saling menutupi.
  assert.equal(r.kunciDisimpan, 3);
  assert.equal(r.kunciAsing, 2);
});

test("berkas tanpa kunci sama sekali menghasilkan ringkasan nol", () => {
  const r = ringkasanUnggahan([]);
  assert.equal(r.kunci, 0);
  assert.equal(r.entri, 0);
  assert.equal(r.kunciDisimpan, 0);
  assert.equal(r.kunciDilewati, 0);
});

test("kata sandi dibuang sedalam apa pun letaknya", () => {
  const bersih = buangKredensial({
    users: [
      { id: "u1", name: "Lama", passwordHash: "abc", salt: "xyz" },
      { id: "u2", profil: { password: "rahasia", telepon: "08" } },
    ],
    confirmPassword: "rahasia",
    PASSWORD: "rahasia",
  });

  assert.deepEqual(bersih, {
    users: [
      { id: "u1", name: "Lama" },
      { id: "u2", profil: { telepon: "08" } },
    ],
  });
});

test("nilai selain objek dibiarkan apa adanya", () => {
  assert.equal(buangKredensial("teks"), "teks");
  assert.equal(buangKredensial(12), 12);
  assert.equal(buangKredensial(null), null);
  assert.deepEqual(buangKredensial([1, 2]), [1, 2]);
});

test("membaca ekspor memisahkan _meta dari kunci datanya", () => {
  const hasil = bacaEksporV1({
    _meta: { version: "1.9.2", exportedAt: "2024-10-20" },
    "users:list": [{ id: "u1", password: "rahasia" }, { id: "u2" }],
    "attendance:config": { jamMasuk: "08:00" },
    "img:store": [{ url: "a" }, { url: "b" }],
    "sellers:all": [{ id: "s1" }],
  });

  assert.equal(hasil.ok, true);
  if (!hasil.ok) return;

  assert.equal(hasil.meta?.versi, "1.9.2");
  assert.equal(hasil.meta?.diekspor, "2024-10-20");

  const peta = Object.fromEntries(hasil.isi.map((i) => [i.kunci, i]));
  assert.equal(peta["users:list"].jumlah, 2);
  // Kata sandi tidak boleh sampai ke nilai yang akan dikirim.
  assert.deepEqual(peta["users:list"].nilai, [{ id: "u1" }, { id: "u2" }]);
  // Kunci berisi objek pengaturan tetap terhitung satu entri.
  assert.equal(peta["attendance:config"].jumlah, 1);
  assert.equal(peta["img:store"].disimpan, false);
  // Kunci asing tetap disimpan supaya keputusannya bisa diambil nanti.
  assert.equal(peta["sellers:all"].disimpan, true);
  assert.equal(peta["sellers:all"].golongan, "asing");

  // Yang dipetakan disebut lebih dulu, yang diabaikan paling akhir.
  assert.equal(hasil.isi[0].golongan, "dikenal");
  assert.equal(hasil.isi[hasil.isi.length - 1].kunci, "img:store");
});

test("ekspor yang bukan objek atau tanpa kunci data ditolak", () => {
  for (const mentah of [[1, 2], "teks", null, 12]) {
    const hasil = bacaEksporV1(mentah);
    assert.equal(hasil.ok, false);
  }

  const kosong = bacaEksporV1({ _meta: { version: "1.9.2" } });
  assert.equal(kosong.ok, false);
  if (kosong.ok) return;
  assert.match(kosong.sebab, /_meta/);
});

test("ekspor tanpa _meta tetap terbaca", () => {
  // Ekspor lama tidak selalu membawa _meta; menolaknya berarti menolak
  // data yang isinya baik-baik saja.
  const hasil = bacaEksporV1({ "users:list": [{ id: "u1" }] });
  assert.equal(hasil.ok, true);
  if (!hasil.ok) return;
  assert.equal(hasil.meta, null);
  assert.equal(hasil.isi.length, 1);
});

test("_meta dibaca dari beberapa ejaan yang pernah dipakai", () => {
  const a = bacaMeta({ version: "1.9.2", exportedAt: "2024-10-20" });
  assert.equal(a.versi, "1.9.2");
  assert.equal(a.diekspor, "2024-10-20");

  const b = bacaMeta({
    appVersion: "2.0",
    dibuatPada: "2024-11-01",
    by: "Hafidz",
  });
  assert.equal(b.versi, "2.0");
  assert.equal(b.diekspor, "2024-11-01");
  assert.equal(b.oleh, "Hafidz");
});

test("medan _meta yang tak dikenali tetap ditampilkan, tidak dibuang", () => {
  const m = bacaMeta({
    version: "1.9.2",
    totalRecords: 8123,
    lengkap: true,
    kosong: null,
    rincian: { users: 42 },
  });

  const peta = Object.fromEntries(m.lainnya.map((l) => [l.medan, l.nilai]));
  assert.equal(peta.totalRecords, "8123");
  assert.equal(peta.lengkap, "true");
  assert.equal(peta.rincian, '{"users":42}');
  // Medan kosong tidak perlu memenuhi layar.
  assert.equal("kosong" in peta, false);
  // Yang sudah terpakai sebagai versi tidak diulang di daftar sisa.
  assert.equal("version" in peta, false);
  // Isi mentahnya tetap utuh — itulah yang disimpan ke kv_unggahan.
  assert.equal((m.mentah as { totalRecords: number }).totalRecords, 8123);
});

test("ekspor yang membungkus datanya di dalam data tetap terbaca", () => {
  const hasil = bacaEksporV1({
    _meta: { version: "1.9.2" },
    data: { "users:list": [{ id: "u1" }], "tasks:all": [{ id: "t1" }] },
  });

  assert.equal(hasil.ok, true);
  if (!hasil.ok) return;
  assert.equal(hasil.isi.length, 2);
  assert.equal(hasil.isi[0].kunci, "tasks:all");
});

test("kunci bernama data di antara kunci lain tidak dikira pembungkus", () => {
  // Kalau salah dikira pembungkus, sepuluh kunci lainnya hilang diam-diam.
  const hasil = bacaEksporV1({
    "users:list": [{ id: "u1" }],
    data: { apa: "saja" },
  });

  assert.equal(hasil.ok, true);
  if (!hasil.ok) return;
  assert.equal(hasil.isi.length, 2);
  assert.equal(
    hasil.isi.some((i) => i.kunci === "users:list"),
    true,
  );
});

test("medan yang hanya mirip kata sandi tidak ikut dibuang", () => {
  // Terlalu longgar sama merusaknya dengan terlalu ketat: membuang
  // `passwordPolicy` berarti menghilangkan pengaturan yang sah.
  const bersih = buangKredensial({
    passwordPolicy: { minLength: 8 },
    salted: true,
    keterangan: "password diganti berkala",
  });

  assert.deepEqual(bersih, {
    passwordPolicy: { minLength: 8 },
    salted: true,
    keterangan: "password diganti berkala",
  });
});

test("kunci ekspor yang isinya kosong tetap dilaporkan", () => {
  // Kunci kosong bukan kunci yang hilang; keduanya berbeda dan hanya
  // salah satunya perlu ditindaklanjuti.
  const hasil = bacaEksporV1({
    "users:list": [],
    "tasks:all": [{ id: "t1" }],
  });

  assert.equal(hasil.ok, true);
  if (!hasil.ok) return;
  const kosong = hasil.isi.find((i) => i.kunci === "users:list");
  assert.equal(kosong?.jumlah, 0);
  assert.equal(kosong?.disimpan, true);
});

test("ringkasan unggahan cocok dengan apa yang dibaca dari ekspor", () => {
  // Dua fungsi yang dipakai berurutan di layar; kalau angkanya berbeda,
  // yang dilihat orang bukan isi berkasnya.
  const dibaca = bacaEksporV1({
    _meta: { version: "1.0" },
    "users:list": [{ id: "u1" }, { id: "u2" }],
    "img:store": [{ id: "i1" }],
    "sellers:all": [{ id: "s1" }],
  });
  assert.equal(dibaca.ok, true);
  if (!dibaca.ok) return;

  const r = ringkasanUnggahan(
    dibaca.isi.map(({ kunci, golongan, jumlah, disimpan }) => ({
      kunci,
      golongan,
      jumlah,
      disimpan,
    })),
  );

  assert.equal(r.kunci, 3);
  assert.equal(r.entri, 4);
  assert.equal(r.kunciDisimpan, 2);
  assert.equal(r.kunciDilewati, 1);
  assert.equal(r.entriDilewati, 1);
  assert.equal(r.kunciAsing, 1);
});

test("kunci ekspor dipisah apa adanya, bukan ditafsirkan", () => {
  // Kunci bertitik dua di tengah bukan dua kunci: `users:list` adalah
  // satu nama utuh. Memotongnya akan menggabungkan kunci yang berbeda.
  const hasil = bacaEksporV1({
    "users:list": [{ id: "u1" }],
    "users:archive": [{ id: "u2" }],
    "daily-reports:all": [{ id: "r1" }],
  });

  assert.equal(hasil.ok, true);
  if (!hasil.ok) return;

  const kunci = hasil.isi.map((i) => i.kunci).sort();
  assert.deepEqual(kunci, ["daily-reports:all", "users:archive", "users:list"]);
  // Yang mirip tetapi bukan kunci yang dipetakan tidak ikut terangkat.
  assert.equal(
    hasil.isi.find((i) => i.kunci === "users:archive")?.golongan,
    "asing",
  );
});

test("kunci dengan besar-kecil huruf berbeda bukan kunci yang sama", () => {
  // Sistem lama peka huruf; menyamakannya akan menyatukan dua kunci yang
  // isinya berbeda.
  assert.equal(golonganKunci("Users:List"), "asing");
  assert.equal(golonganKunci("users:list"), "dikenal");
});

test("kunci berspasi atau kosong tidak menjadi kunci data", () => {
  const hasil = bacaEksporV1({
    "users:list": [{ id: "u1" }],
    "": [{ id: "x" }],
    " ": [{ id: "y" }],
  });
  assert.equal(hasil.ok, true);
  if (!hasil.ok) return;

  // Keduanya tetap dilaporkan — tidak dibuang diam-diam — tetapi
  // digolongkan asing, jadi tidak akan pernah dipetakan.
  const asing = hasil.isi.filter((i) => i.golongan === "asing");
  assert.equal(asing.length, 2);
});

test("urutan kunci di berkas tidak memengaruhi hasil pembacaan", () => {
  // Ekspor tidak menjamin urutan kuncinya; hasil yang berubah karena
  // urutan berarti ada yang bergantung pada kebetulan.
  const isi = {
    "img:store": [{ id: "i1" }],
    "users:list": [{ id: "u1" }],
    "gmv:targets": [{ id: "g1" }],
  };
  const terbalik = {
    "gmv:targets": [{ id: "g1" }],
    "users:list": [{ id: "u1" }],
    "img:store": [{ id: "i1" }],
  };

  const a = bacaEksporV1(isi);
  const b = bacaEksporV1(terbalik);
  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) return;

  assert.deepEqual(
    a.isi.map((i) => `${i.kunci}:${i.golongan}:${i.disimpan}`),
    b.isi.map((i) => `${i.kunci}:${i.golongan}:${i.disimpan}`),
  );
});

test("kata sandi tidak pernah ikut ke nilai yang akan dikirim", () => {
  // Penjagaan ini yang menentukan apakah hash kata sandi seluruh
  // karyawan ikut mendarat di basis data baru.
  const hasil = bacaEksporV1({
    "users:list": [
      {
        id: "u1",
        name: "A",
        passwordHash: "$2a$10$abcdef",
        salt: "xyz",
        password: "rahasia",
        confirmPassword: "rahasia",
        password_hash: "lagi",
      },
    ],
  });

  assert.equal(hasil.ok, true);
  if (!hasil.ok) return;

  const teks = JSON.stringify(hasil.isi[0].nilai);
  for (const medan of MEDAN_KREDENSIAL) {
    assert.equal(
      teks.includes(medan),
      false,
      `medan ${medan} masih ada di nilai yang akan dikirim`,
    );
  }
  assert.match(teks, /"name":"A"/);
});

test("kata sandi di dalam _meta pun ikut dibuang", () => {
  // Ekspor lama sesekali menaruh kredensial pengekspor di _meta.
  const hasil = bacaEksporV1({
    _meta: { version: "1.9.2", password: "rahasia" },
    "users:list": [{ id: "u1" }],
  });
  assert.equal(hasil.ok, true);
  if (!hasil.ok) return;
  assert.equal("password" in (hasil.meta?.mentah ?? {}), false);
  assert.equal(hasil.meta?.versi, "1.9.2");
});
