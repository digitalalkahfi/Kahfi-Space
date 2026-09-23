import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  itemTerlihat,
  URUTAN_WIDGET,
  katalogTampilan,
  MAKS_DOCK,
  pecahDock,
  pindahkanItem,
  urutanBerubah,
  preferensiBawaan,
  selaraskanPreferensi,
  type KonteksTampilan,
  type SumberNavigasi,
} from "../tampilan.ts";

const sumber: SumberNavigasi = {
  utama: [
    { label: "Beranda", href: "/beranda" },
    { label: "Absensi", href: "/absensi" },
    { label: "Tugas", href: "/tugas" },
  ],
  pendamping: [
    {
      label: "Kalender",
      keterangan: "Agenda",
      href: "/kalender",
      pintuLainDiDesktop: true,
    },
    { label: "Aset", keterangan: "Inventaris", href: "/aset" },
    {
      label: "Keuangan",
      keterangan: "Kas",
      href: "/keuangan",
      izin: "keuangan",
    },
    {
      label: "Migrasi",
      keterangan: "Data lama",
      href: "/migrasi",
      izin: "migrasi",
    },
    {
      label: "Pengaturan tampilan",
      keterangan: "Halaman ini",
      href: "/tampilan",
      pintuLainDiDesktop: true,
    },
  ],
  pintasan: [{ label: "Scan Sampel", keterangan: "QR", href: "/sampel/scan" }],
};

const konteks = (b: Partial<KonteksTampilan> = {}): KonteksTampilan => ({
  peran: "Staff",
  izin: { keuangan: false, migrasi: false },
  ...b,
});

test("menu berizin tidak masuk katalog orang yang tak berhak", () => {
  // Kalau ia masuk katalog, ia bisa dicentang — dan centang yang
  // menampilkan menu terlarang adalah penambahan hak akses.
  const k = katalogTampilan(sumber, konteks());
  const kunci = k.sidebar.map((i) => i.kunci);
  assert.ok(!kunci.includes("/keuangan"));
  assert.ok(!kunci.includes("/migrasi"));
  assert.ok(kunci.includes("/aset"));
});

test("rail tidak menawarkan menu yang punya pintu masuk lain", () => {
  // Mencentang menu yang memang tidak pernah tergambar di rail hanya
  // membuat orang mengira pengaturannya rusak.
  const k = katalogTampilan(sumber, konteks());
  assert.ok(!k.sidebar.map((i) => i.kunci).includes("/kalender"));
  assert.ok(
    k.dock.map((i) => i.kunci).includes("/kalender"),
    "di ponsel ia satu-satunya jalan ke halaman itu",
  );
});

test("menu berizin muncul untuk yang berhak", () => {
  const k = katalogTampilan(
    sumber,
    konteks({ peran: "CEO", izin: { keuangan: true, migrasi: true } }),
  );
  const kunci = k.sidebar.map((i) => i.kunci);
  assert.ok(kunci.includes("/keuangan"));
  assert.ok(kunci.includes("/migrasi"));
});

test("widget Beranda disaring peran, bukan dipilih bebas", () => {
  const staf = katalogTampilan(sumber, konteks()).beranda.map((i) => i.kunci);
  const ceo = katalogTampilan(
    sumber,
    konteks({ peran: "CEO", izin: { keuangan: true, migrasi: true } }),
  ).beranda.map((i) => i.kunci);

  assert.ok(!staf.includes("posisiKas"), "Staff tidak melihat posisi kas");
  assert.ok(ceo.includes("posisiKas"));
});

test("menu inti terkunci di permukaan tempat ia tergambar", () => {
  const k = katalogTampilan(sumber, konteks());
  assert.deepEqual(
    k.dock.filter((i) => i.inti).map((i) => i.kunci),
    ["/beranda", "/tampilan"],
  );
  // Di rail ia memang tidak ada, jadi tidak ada yang perlu dikunci.
  assert.deepEqual(
    k.sidebar.filter((i) => i.inti).map((i) => i.kunci),
    ["/beranda"],
  );
});

test("bawaan menampilkan semuanya, urut katalog", () => {
  const k = katalogTampilan(sumber, konteks());
  const p = preferensiBawaan(k);
  assert.equal(p.sidebar.length, k.sidebar.length);
  assert.ok(p.sidebar.every((b) => b.tampil));
  assert.equal(p.sidebar[0].kunci, k.sidebar[0].kunci);
});

test("kunci asing dalam preferensi tersimpan diabaikan", () => {
  // Peran yang turun, atau baris yang ditulis langsung ke tabelnya:
  // keduanya tidak boleh menambah apa pun ke navigasi.
  const k = katalogTampilan(sumber, konteks());
  const hasil = selaraskanPreferensi(k, {
    sidebar: [
      { kunci: "/keuangan", tampil: true },
      { kunci: "/absensi", tampil: false },
    ],
  });
  const kunci = hasil.sidebar.map((b) => b.kunci);
  assert.ok(!kunci.includes("/keuangan"));
  assert.equal(
    hasil.sidebar.find((b) => b.kunci === "/absensi")?.tampil,
    false,
  );
});

test("menu inti tidak bisa dimatikan lewat preferensi tersimpan", () => {
  const k = katalogTampilan(sumber, konteks());
  const hasil = selaraskanPreferensi(k, {
    dock: [
      { kunci: "/tugas", tampil: true },
      { kunci: "/beranda", tampil: false },
      { kunci: "/tampilan", tampil: false },
    ],
  });
  assert.equal(hasil.dock.find((b) => b.kunci === "/beranda")?.tampil, true);
  assert.equal(hasil.dock.find((b) => b.kunci === "/tampilan")?.tampil, true);
});

test("Beranda ditambat di depan, halaman pengaturan di belakang", () => {
  // Kalau halaman pengaturan ikut ditambat di depan, ia memakan satu
  // dari lima slot dock demi halaman yang dibuka sekali sebulan.
  const k = katalogTampilan(sumber, konteks());
  const hasil = selaraskanPreferensi(k, {
    dock: [
      { kunci: "/tampilan", tampil: true },
      { kunci: "/tugas", tampil: true },
      { kunci: "/beranda", tampil: true },
    ],
  });
  assert.equal(hasil.dock[0].kunci, "/beranda");
  assert.equal(hasil.dock.at(-1)?.kunci, "/tampilan");
});

test("halaman pengaturan tidak pernah memakan slot dock", () => {
  const k = katalogTampilan(sumber, konteks());
  const p = selaraskanPreferensi(k, null);
  const { dock, laci } = pecahDock(itemTerlihat(k, p, "dock"));
  assert.ok(
    !dock.some((i) => i.kunci === "/tampilan"),
    `slot dock: ${dock.map((i) => i.kunci).join(", ")}`,
  );
  assert.ok(laci.some((i) => i.kunci === "/tampilan"));
});

test("menu baru ikut muncul, bukan hilang diam-diam", () => {
  // Preferensi yang tersimpan sebelum sebuah menu lahir tidak boleh
  // membuat menu itu tak pernah terlihat.
  const k = katalogTampilan(sumber, konteks());
  const hasil = selaraskanPreferensi(k, {
    sidebar: [{ kunci: "/absensi", tampil: true }],
  });
  const tugas = hasil.sidebar.find((b) => b.kunci === "/tugas");
  assert.ok(tugas, "menu baru harus ada");
  assert.equal(tugas.tampil, true);
});

test("kunci ganda tidak menggandakan barisnya", () => {
  const k = katalogTampilan(sumber, konteks());
  const hasil = selaraskanPreferensi(k, {
    sidebar: [
      { kunci: "/absensi", tampil: false },
      { kunci: "/absensi", tampil: true },
    ],
  });
  assert.equal(hasil.sidebar.filter((b) => b.kunci === "/absensi").length, 1);
});

test("urutan tersimpan dipertahankan untuk item biasa", () => {
  const k = katalogTampilan(sumber, konteks());
  const hasil = selaraskanPreferensi(k, {
    sidebar: [
      { kunci: "/aset", tampil: true },
      { kunci: "/tugas", tampil: true },
      { kunci: "/absensi", tampil: true },
    ],
  });
  assert.deepEqual(
    hasil.sidebar.filter((b) => b.kunci !== "/beranda").map((b) => b.kunci),
    ["/aset", "/tugas", "/absensi"],
  );
});

test("yang dicentang mati tidak ikut tergambar", () => {
  const k = katalogTampilan(sumber, konteks());
  const p = selaraskanPreferensi(k, {
    sidebar: [{ kunci: "/absensi", tampil: false }],
  });
  const terlihat = itemTerlihat(k, p, "sidebar").map((i) => i.kunci);
  assert.ok(!terlihat.includes("/absensi"));
  assert.ok(terlihat.includes("/beranda"));
});

test("dock dipecah lima teratas, sisanya laci", () => {
  const { dock, laci } = pecahDock([1, 2, 3, 4, 5, 6, 7]);
  assert.equal(dock.length, MAKS_DOCK);
  assert.deepEqual(laci, [6, 7]);
});

test("dock yang isinya kurang dari lima tidak meninggalkan laci", () => {
  const { dock, laci } = pecahDock(["a", "b"]);
  assert.deepEqual(dock, ["a", "b"]);
  assert.deepEqual(laci, []);
});

test("urutan widget mengikuti tata letak Beranda, bukan daftar izin", () => {
  // `widgetPerPeran` menaruh posisiKas di baris pertama; di layar ia
  // kartu ketujuh. Memakai urutan daftar izin membuat halaman ini
  // berbohong sejak dibuka.
  const beranda = katalogTampilan(
    sumber,
    konteks({ peran: "CEO", izin: { keuangan: true, migrasi: true } }),
  ).beranda.map((i) => i.kunci);

  assert.equal(beranda[0], "wrm");
  assert.ok(
    beranda.indexOf("posisiKas") > beranda.indexOf("tugas"),
    `posisiKas harus setelah tugas: ${beranda.join(", ")}`,
  );
  assert.deepEqual(
    beranda,
    URUTAN_WIDGET.filter((w) => beranda.includes(w)),
    "urutannya harus persis URUTAN_WIDGET",
  );
});

test("widget yang tak boleh dilihat tidak ikut walau ada di urutan", () => {
  const staf = katalogTampilan(sumber, konteks()).beranda.map((i) => i.kunci);
  assert.ok(!staf.includes("posisiKas"));
  assert.ok(!staf.includes("pantauKehadiran"));
  assert.ok(staf.includes("wrm"));
});

test("memindahkan item menyisipkannya di posisi tujuan", () => {
  const daftar = [
    { kunci: "a", tampil: true },
    { kunci: "b", tampil: true },
    { kunci: "c", tampil: true },
  ];
  assert.deepEqual(
    pindahkanItem(daftar, "a", "c").map((b) => b.kunci),
    ["b", "c", "a"],
  );
  assert.deepEqual(
    pindahkanItem(daftar, "c", "a").map((b) => b.kunci),
    ["c", "a", "b"],
  );
});

test("seretan yang berakhir di luar daftar tidak mengacak apa pun", () => {
  const daftar = [
    { kunci: "a", tampil: true },
    { kunci: "b", tampil: false },
  ];
  assert.deepEqual(pindahkanItem(daftar, "a", "entah"), daftar);
  assert.deepEqual(pindahkanItem(daftar, "entah", "a"), daftar);
  assert.deepEqual(pindahkanItem(daftar, "a", "a"), daftar);
});

test("centang ikut pindah bersama itemnya", () => {
  // Kalau yang dipindah cuma kuncinya, item yang disembunyikan bisa
  // menular statusnya ke tetangga setelah satu seretan.
  const daftar = [
    { kunci: "a", tampil: false },
    { kunci: "b", tampil: true },
  ];
  assert.deepEqual(pindahkanItem(daftar, "a", "b"), [
    { kunci: "b", tampil: true },
    { kunci: "a", tampil: false },
  ]);
});

test("menu inti kembali ke tempatnya walau urutannya diseret", () => {
  // Pustaka seret tidak tahu soal jangkar; yang menjaganya penyelaras.
  const k = katalogTampilan(sumber, konteks());
  const diseret = pindahkanItem(
    preferensiBawaan(k).dock,
    "/absensi",
    "/beranda",
  );
  const hasil = selaraskanPreferensi(k, { dock: diseret });
  assert.equal(hasil.dock[0].kunci, "/beranda");
  assert.equal(hasil.dock.at(-1)?.kunci, "/tampilan");
});

test("menaikkan item ke lima besar memindahkannya dari laci ke dock", () => {
  // Rantai lengkapnya: urutan → yang tampil → pecah lima. Inilah yang
  // dijanjikan PRD dengan "lima teratas jadi dock".
  const k = katalogTampilan(
    sumber,
    konteks({ peran: "CEO", izin: { keuangan: true, migrasi: true } }),
  );
  const awal = preferensiBawaan(k);
  const sebelum = pecahDock(itemTerlihat(k, awal, "dock"));
  // Yang berjangkar memang tidak boleh naik ke dock; ambil yang bebas.
  const buntut = sebelum.laci.find((i) => i.jangkar === null);
  assert.ok(buntut, "contohnya harus punya isi laci yang bisa digeser");

  const naik = selaraskanPreferensi(k, {
    dock: pindahkanItem(awal.dock, buntut.kunci, awal.dock[1].kunci),
  });
  const sesudah = pecahDock(itemTerlihat(k, naik, "dock"));

  assert.ok(
    sesudah.dock.some((i) => i.kunci === buntut.kunci),
    `${buntut.kunci} harusnya masuk dock: ${sesudah.dock.map((i) => i.kunci).join(", ")}`,
  );
  assert.equal(sesudah.dock.length, sebelum.dock.length);
});

test("menyembunyikan item dock menaikkan penggantinya dari laci", () => {
  const k = katalogTampilan(
    sumber,
    konteks({ peran: "CEO", izin: { keuangan: true, migrasi: true } }),
  );
  const awal = preferensiBawaan(k);
  const sebelum = pecahDock(itemTerlihat(k, awal, "dock"));
  const calon = sebelum.laci.find((i) => i.jangkar === null);
  assert.ok(calon, "contohnya harus punya calon pengganti di laci");

  const disembunyikan = selaraskanPreferensi(k, {
    dock: awal.dock.map((b) =>
      b.kunci === sebelum.dock[2].kunci ? { ...b, tampil: false } : b,
    ),
  });
  const sesudah = pecahDock(itemTerlihat(k, disembunyikan, "dock"));

  assert.equal(sesudah.dock.length, sebelum.dock.length);
  assert.ok(sesudah.dock.some((i) => i.kunci === calon.kunci));
});

test("kunci di luar wewenang tidak lolos jalur simpan", () => {
  // Jalur tulis memakai penyelaras yang sama dengan jalur baca. Ini
  // yang membuat "personalisasi tidak pernah menambah hak akses"
  // berlaku pada penyimpanan, bukan cuma pada tampilan: apa pun yang
  // dikirim browser disaring katalog peran sebelum menyentuh tabel.
  const staf = katalogTampilan(sumber, konteks());
  const diminta = {
    sidebar: [
      { kunci: "/keuangan", tampil: true },
      { kunci: "/migrasi", tampil: true },
      { kunci: "/aset", tampil: true },
    ],
  };

  const disimpan = selaraskanPreferensi(staf, diminta);
  const kunci = disimpan.sidebar.map((b) => b.kunci);

  assert.ok(!kunci.includes("/keuangan"), kunci.join(", "));
  assert.ok(!kunci.includes("/migrasi"));
  assert.ok(kunci.includes("/aset"));
});

test("peran yang turun kehilangan menu yang dulu ia simpan", () => {
  // Susunan disimpan saat masih CEO, dibaca setelah jadi Staff.
  const sebagaiCeo = katalogTampilan(
    sumber,
    konteks({ peran: "CEO", izin: { keuangan: true, migrasi: true } }),
  );
  const disimpan = preferensiBawaan(sebagaiCeo);
  assert.ok(disimpan.sidebar.some((b) => b.kunci === "/keuangan"));

  const sebagaiStaf = katalogTampilan(sumber, konteks());
  const dibaca = selaraskanPreferensi(sebagaiStaf, disimpan);
  assert.ok(!dibaca.sidebar.some((b) => b.kunci === "/keuangan"));
  assert.ok(!dibaca.beranda.some((b) => b.kunci === "posisiKas"));
});

test("urutanBerubah diam saat belum ada yang digeser", () => {
  const k = katalogTampilan(sumber, konteks());
  assert.equal(urutanBerubah(k, preferensiBawaan(k)), false);
});

test("urutanBerubah menyala begitu satu item berpindah", () => {
  const k = katalogTampilan(sumber, konteks());
  const digeser = {
    ...preferensiBawaan(k),
    sidebar: pindahkanItem(preferensiBawaan(k).sidebar, "/tugas", "/absensi"),
  };
  assert.equal(urutanBerubah(k, digeser), true);
});

test("mencentang-lepas saja bukan perubahan urutan", () => {
  // Dialog reset menyebut keduanya terpisah; menyamakannya membuat
  // peringatannya menyebut hal yang tidak terjadi.
  const k = katalogTampilan(sumber, konteks());
  const bawaan = preferensiBawaan(k);
  const disembunyikan = {
    ...bawaan,
    sidebar: bawaan.sidebar.map((b) =>
      b.kunci === "/aset" ? { ...b, tampil: false } : b,
    ),
  };
  assert.equal(urutanBerubah(k, disembunyikan), false);
});

test("bawaan sama persis dengan yang tergambar sebelum diatur", () => {
  // Katalog menaruh menu inti berjangkar di tengah; bawaan harus sudah
  // menerapkan jangkarnya. Kalau tidak, tiap perbandingan terhadap
  // bawaan akan selalu bilang "sudah berubah" sejak detik pertama.
  const k = katalogTampilan(sumber, konteks());
  const bawaan = preferensiBawaan(k);
  assert.deepEqual(bawaan, selaraskanPreferensi(k, bawaan));
  assert.equal(urutanBerubah(k, bawaan), false);
  assert.equal(bawaan.dock.at(-1)?.kunci, "/tampilan");
});
