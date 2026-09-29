import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  akhirPekan,
  geserTanggal,
  periksaTenggat,
  periksaTiketBaru,
  periksaToDoBaru,
  susunTenggat,
  tanggalSah,
} from "@/lib/validasi-tugas";

const HARI_INI = "2026-09-29";

const tiket = (
  p: Partial<Parameters<typeof periksaTiketBaru>[0]> = {},
): ReturnType<typeof periksaTiketBaru> =>
  periksaTiketBaru({
    judul: "Audit GMV 5 akun beauty",
    penerimaId: "penerima-1",
    tipe: "tiket",
    tanggal: "2026-10-02",
    jam: "15:00",
    hariIni: HARI_INI,
    ...p,
  });

test("tanggal sah harus tanggal sungguhan berbentuk YYYY-MM-DD", () => {
  assert.equal(tanggalSah("2026-09-29"), true);
  assert.equal(tanggalSah("2026-02-30"), false);
  assert.equal(tanggalSah("29-09-2026"), false);
  assert.equal(tanggalSah("abc"), false);
  assert.equal(tanggalSah(""), false);
});

test("geser tanggal melintasi bulan dan tahun", () => {
  assert.equal(geserTanggal("2026-09-30", 1), "2026-10-01");
  assert.equal(geserTanggal("2026-01-01", -1), "2025-12-31");
  assert.equal(geserTanggal("2028-02-28", 1), "2028-02-29");
});

test("akhir pekan jatuh pada Sabtu pekan itu", () => {
  // 29 Sep 2026 hari Selasa; Sabtunya 3 Okt.
  assert.equal(akhirPekan("2026-09-29"), "2026-10-03");
  // Sabtu tetap Sabtu itu sendiri.
  assert.equal(akhirPekan("2026-10-03"), "2026-10-03");
  // Minggu termasuk pekan baru.
  assert.equal(akhirPekan("2026-10-04"), "2026-10-10");
});

test("to-do tanpa jam disimpan 23:59 WIB dan ditandai tanpa jam", () => {
  assert.deepEqual(susunTenggat("2026-10-02", null), {
    tenggat: "2026-10-02T23:59:00+07:00",
    tanpaJam: true,
  });
  const hasil = periksaToDoBaru({
    judul: "Cek 14 sesi live",
    tanggal: "2026-10-02",
    jam: "",
    hariIni: HARI_INI,
  });
  assert.deepEqual(hasil, {
    ok: true,
    nilai: {
      judul: "Cek 14 sesi live",
      tenggat: "2026-10-02T23:59:00+07:00",
      tanpaJam: true,
    },
  });
});

test("to-do berjam menyimpan jam itu di WIB", () => {
  const hasil = periksaToDoBaru({
    judul: "Siapkan skrip live",
    tanggal: HARI_INI,
    jam: "08:30",
    hariIni: HARI_INI,
  });
  assert.equal(hasil.ok && hasil.nilai.tenggat, "2026-09-29T08:30:00+07:00");
  assert.equal(hasil.ok && hasil.nilai.tanpaJam, false);
});

test("tanggal tidak boleh sebelum hari ini", () => {
  const todo = periksaToDoBaru({
    judul: "Telat dibuat",
    tanggal: "2026-09-28",
    hariIni: HARI_INI,
  });
  assert.deepEqual(todo, {
    ok: false,
    pesan: "Tanggal tidak boleh sebelum hari ini.",
  });
  assert.equal(tiket({ tanggal: "2026-09-28" }).ok, false);
  // Hari ini sendiri boleh.
  assert.equal(tiket({ tanggal: HARI_INI }).ok, true);
});

test("tanggal wajib dan harus dikenali", () => {
  for (const tanggal of ["", null, undefined, "2026-13-01", "abc"]) {
    const hasil = periksaToDoBaru({
      judul: "Judul",
      tanggal,
      hariIni: HARI_INI,
    });
    assert.equal(hasil.ok, false, `tanggal ${String(tanggal)} harus ditolak`);
  }
});

test("tiket tanpa jam ditolak; jam rusak ditolak", () => {
  const tanpaJam = tiket({ jam: "" });
  assert.equal(tanpaJam.ok, false);
  assert.match(String(!tanpaJam.ok && tanpaJam.pesan), /jam/i);
  assert.equal(tiket({ jam: "25:00" }).ok, false);
  assert.equal(tiket({ jam: "7:5" }).ok, false);
});

test("tiket tiga hari ke depan pukul 15.00 tersimpan di tanggal dan jam itu", () => {
  const hasil = tiket({ tanggal: "2026-10-02", jam: "15:00" });
  assert.deepEqual(hasil, {
    ok: true,
    nilai: {
      judul: "Audit GMV 5 akun beauty",
      goalId: null,
      tenggat: "2026-10-02T15:00:00+07:00",
      tanpaJam: false,
    },
  });
});

test("komitmen mingguan wajib bergoal; tiket biasa boleh tanpa goal", () => {
  assert.equal(tiket({ tipe: "komitmen_mingguan" }).ok, false);
  const komitmen = tiket({ tipe: "komitmen_mingguan", goalId: "goal-1" });
  assert.equal(komitmen.ok && komitmen.nilai.goalId, "goal-1");
  const bergoal = tiket({ goalId: "goal-2" });
  assert.equal(bergoal.ok && bergoal.nilai.goalId, "goal-2");
});

test("judul dan penerima tetap diperiksa", () => {
  assert.equal(tiket({ judul: "  ab " }).ok, false);
  assert.equal(tiket({ penerimaId: "" }).ok, false);
  assert.equal(
    periksaTenggat({
      tanggal: "2026-10-01",
      jam: null,
      jamWajib: false,
      hariIni: HARI_INI,
    }).ok,
    true,
  );
});
