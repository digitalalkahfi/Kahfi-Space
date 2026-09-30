/**
 * Papan tugas per tanggal (D4, migrasi 0182).
 *
 * Penyaringan tanggal dikerjakan basis data (`papan_tugas`), sebagai
 * SECURITY INVOKER: RLS tetap menentukan tiket siapa yang terlihat.
 * To-do pribadi selalu milik sendiri — dibandingkan lewat id, sehingga
 * dua orang bernama sama tidak pernah tertukar.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Papan tugas per tanggal (0182)");

const MIGRASI = await readFile(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "0182_papan_tugas_per_tanggal.sql",
  ),
  "utf8",
);

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu(`select id from users where nama = $1`, [nama])).id;

const MANAGER = await id("Farhan Pratama");
const DEWI = await id("Dewi Lestari"); // Leader Affiliator
const RIAN = await id("Rian Hidayat"); // Staff Affiliator, bawahan Dewi
const BAYU = await id("Bayu Nugraha");
const GALIH = await id("Galih Prakoso"); // Leader MCN

const HARI_INI = "2026-09-29";

const tambah = async (p) =>
  (
    await satu(
      `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat,
                          status, selesai_at, tanpa_jam)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [
        p.tipe ?? "tiket",
        p.judul,
        p.pembuat ?? DEWI,
        p.penerima ?? RIAN,
        p.tenggat ?? null,
        p.status ?? "todo",
        p.selesai_at ?? null,
        p.tanpa_jam ?? false,
      ],
    )
  ).id;

const papan = async (orang, tanggal, hariIni = HARI_INI, batas = 300) =>
  (
    await sebagai(
      db,
      orang,
      `select * from papan_tugas($1::date, $2::date, $3)`,
      [tanggal, hariIni, batas],
    )
  ).rows;

const judul = (baris) => baris.map((b) => b.judul).sort();

// Data uji, semua milik Rian (dari Dewi) kecuali disebut lain.
await tambah({ judul: "P 16 Sep pagi", tenggat: "2026-09-16T09:00:00+07:00" });
await tambah({
  judul: "P 16 Sep 23.59",
  tenggat: "2026-09-16T23:59:00+07:00",
  status: "berjalan",
});
await tambah({
  judul: "P 17 Sep 00.00 WIB",
  tenggat: "2026-09-16T17:00:00Z",
});
await tambah({
  judul: "P tenggat 16, selesai 15",
  tenggat: "2026-09-16T12:00:00+07:00",
  status: "selesai",
  selesai_at: "2026-09-15T20:00:00+07:00",
});
await tambah({
  judul: "P tenggat 10, selesai 16",
  tenggat: "2026-09-10T12:00:00+07:00",
  status: "selesai",
  selesai_at: "2026-09-16T08:00:00+07:00",
});
await tambah({
  judul: "P dibatalkan 16",
  tenggat: "2026-09-16T10:00:00+07:00",
  status: "dibatalkan",
});
await tambah({ judul: "P terlambat 27", tenggat: "2026-09-27T17:00:00+07:00" });
await tambah({ judul: "P hari ini", tenggat: `${HARI_INI}T15:00:00+07:00` });
await tambah({ judul: "P besok", tenggat: "2026-09-30T10:00:00+07:00" });
await tambah({ judul: "P lama tanpa tenggat" });

uji("tanggal biasa: aktif menurut tenggat WIB, Selesai menurut selesai_at", async () => {
  const r = (await papan(RIAN, "2026-09-16")).filter((b) =>
    b.judul.startsWith("P "),
  );
  harusSama(judul(r), [
    "P 16 Sep 23.59",
    "P 16 Sep pagi",
    "P tenggat 10, selesai 16",
  ]);
});

uji("tenggat 00.00 WIB masuk tanggal berikutnya", async () => {
  const r = (await papan(RIAN, "2026-09-17")).filter((b) =>
    b.judul.startsWith("P "),
  );
  harusSama(judul(r), ["P 17 Sep 00.00 WIB"]);
});

uji("hari ini: ikut yang terlambat dan tiket lama tanpa tenggat", async () => {
  const r = (await papan(RIAN, HARI_INI)).filter((b) =>
    b.judul.startsWith("P "),
  );
  harus(
    ["P hari ini", "P terlambat 27", "P lama tanpa tenggat"].every((j) =>
      r.some((b) => b.judul === j),
    ),
    `isi hari ini: ${judul(r).join(", ")}`,
  );
  harus(!r.some((b) => b.judul === "P besok"), "besok tidak ikut");
  const telat = r.find((b) => b.judul === "P terlambat 27");
  harusSama(telat.kelompok, "terlambat");
  harusSama(r[0].kelompok, "terlambat", "yang terlambat paling atas");
});

uji("tanggal besok: yang terlambat tidak ikut", async () => {
  const r = (await papan(RIAN, "2026-09-30")).filter((b) =>
    b.judul.startsWith("P "),
  );
  harusSama(judul(r), ["P besok"]);
});

uji("tanggal lampau: tanpa tambahan terlambat dan tanpa-tenggat", async () => {
  const r = (await papan(RIAN, "2026-09-27")).filter((b) =>
    b.judul.startsWith("P "),
  );
  harusSama(judul(r), ["P terlambat 27"]);
});

uji("tanggal tanpa tugas mengembalikan nol baris", async () => {
  harusSama((await papan(RIAN, "2031-01-01")).length, 0);
});

uji("RLS tetap berlaku: Leader unit lain tidak melihat tiket Rian", async () => {
  const r = await papan(GALIH, "2026-09-16");
  harus(!r.some((b) => b.judul.startsWith("P ")), "tiket unit lain bocor");
  const dewi = await papan(DEWI, "2026-09-16");
  harus(
    dewi.some((b) => b.judul === "P 16 Sep pagi"),
    "pemberi tiket melihat tiketnya",
  );
});

uji("to-do pribadi hanya milik sendiri, bahkan bagi Manager", async () => {
  await tambah({
    tipe: "pribadi",
    judul: "To-do Rian 16",
    pembuat: RIAN,
    penerima: RIAN,
    tenggat: "2026-09-16T23:59:00+07:00",
    tanpa_jam: true,
  });
  const manager = await papan(MANAGER, "2026-09-16");
  harus(
    !manager.some((b) => b.judul === "To-do Rian 16"),
    "to-do Rian bocor ke papan Manager",
  );
  harus(
    manager.some((b) => b.judul === "P 16 Sep pagi"),
    "tiket tetap terlihat Manager",
  );
  const rian = await papan(RIAN, "2026-09-16");
  const todo = rian.find((b) => b.judul === "To-do Rian 16");
  harus(todo, "pemilik melihat to-do-nya");
  harusSama(todo.tanpa_jam, true);
});

uji("dua orang bernama sama tidak tertukar to-do-nya", async () => {
  // Kembaran nama Rian: profil kedua dengan nama persis sama.
  const kembar = (
    await satu(
      `insert into users (id, nama, email, role, jabatan, unit_id, atasan_id, status)
       select gen_random_uuid(), nama, 'kembar.' || email, role, jabatan,
              unit_id, atasan_id, status
         from users where id = $1
       returning id`,
      [RIAN],
    )
  ).id;
  await tambah({
    tipe: "pribadi",
    judul: "To-do si kembar",
    pembuat: kembar,
    penerima: kembar,
    tenggat: "2026-09-16T10:00:00+07:00",
  });
  const rian = await papan(RIAN, "2026-09-16");
  harus(!rian.some((b) => b.judul === "To-do si kembar"), "to-do tertukar");
  const k = await papan(kembar, "2026-09-16");
  harus(k.some((b) => b.judul === "To-do si kembar"), "pemilik melihatnya");
  harus(!k.some((b) => b.judul === "To-do Rian 16"), "to-do Rian bocor");
});

uji("batas tercapai: total tetap menyebut jumlah sebenarnya", async () => {
  for (let i = 0; i < 6; i++) {
    await tambah({
      judul: `Banyak ${i}`,
      pembuat: DEWI,
      penerima: BAYU,
      tenggat: "2026-10-05T09:00:00+07:00",
    });
  }
  const r = await papan(MANAGER, "2026-10-05", HARI_INI, 4);
  harusSama(r.length, 4, "dibatasi 4");
  harusSama(Number(r[0].total), 6, "total sebelum dibatasi");
  const semua = await papan(MANAGER, "2026-10-05", HARI_INI, 300);
  harusSama(semua.length, 6);
  harusSama(Number(semua[0].total), 6);
});

uji("lebih dari 200 tugas: tidak ada tugas bertanggal itu yang hilang", async () => {
  await sebagaiAdmin(
    db,
    `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat)
     select 'tiket', 'Massal ' || g, $1, $2, '2026-08-01T09:00:00+07:00'
       from generate_series(1, 230) g`,
    [DEWI, BAYU],
  );
  await tambah({
    judul: "Satu-satunya 11 Okt",
    pembuat: DEWI,
    penerima: BAYU,
    tenggat: "2026-10-11T09:00:00+07:00",
  });
  const r = await papan(MANAGER, "2026-10-11");
  harusSama(judul(r), ["Satu-satunya 11 Okt"]);
});

uji("daftar_tugas: to-do milik sendiri saja dan tanpa yang selesai", async () => {
  const { rows } = await sebagai(
    db,
    MANAGER,
    `select * from daftar_tugas($1::date, 'semua', 500)`,
    [HARI_INI],
  );
  harus(!rows.some((b) => b.status === "selesai"), "yang selesai tidak dimuat");
  harus(
    rows
      .filter((b) => b.tipe === "pribadi")
      .every((b) => b.penerima_id === MANAGER),
    "to-do orang lain bocor ke daftar Manager",
  );
  harus(rows.length > 0 && Number(rows[0].total) >= rows.length, "total ada");
});

uji("hitung_tugas selaras dengan daftarnya", async () => {
  const { rows } = await sebagai(db, MANAGER, `select * from hitung_tugas($1::date)`, [
    HARI_INI,
  ]);
  const { rows: daftar } = await sebagai(
    db,
    MANAGER,
    `select * from daftar_tugas($1::date, 'semua', 500)`,
    [HARI_INI],
  );
  harusSama(Number(rows[0].semua), Number(daftar[0].total));
  harusSama(
    Number(rows[0].saya),
    daftar.filter((b) => b.tipe === "pribadi").length,
  );
});

uji("fungsi berjalan sebagai security invoker", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select proname, prosecdef from pg_proc
      where proname in ('papan_tugas', 'daftar_tugas', 'hitung_tugas')
      order by proname`,
  );
  harusSama(
    rows.map((r) => [r.proname, r.prosecdef]),
    [
      ["daftar_tugas", false],
      ["hitung_tugas", false],
      ["papan_tugas", false],
    ],
  );
});

uji("migrasi aman dijalankan ulang", async () => {
  await sebagaiAdmin(db, MIGRASI);
  await sebagaiAdmin(db, MIGRASI);
  harusSama((await papan(RIAN, "2026-09-17")).length, 1);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
