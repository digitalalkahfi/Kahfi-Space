import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  batasTerencana,
  jamEfektifMasuk,
  jumlahHari,
  MAKS_HARI_IZIN,
  menitTelat,
  periksaIzin,
  tanggalRentang,
  type IsiIzin,
} from "@/lib/izin";

const HARI_INI = "2024-10-24";

const isi = (p: Partial<IsiIzin> = {}): IsiIzin => ({
  bentuk: "terencana",
  mulai: "2024-10-25",
  selesai: "2024-10-25",
  jamMulai: "",
  jamSelesai: "",
  alasan: "mengurus dokumen keluarga",
  ...p,
});

test("batas terencana selalu H-1, termasuk lintas bulan", () => {
  assert.equal(batasTerencana("2024-10-24"), "2024-10-25");
  assert.equal(batasTerencana("2024-10-31"), "2024-11-01");
  assert.equal(batasTerencana("2024-12-31"), "2025-01-01");
});

test("izin terencana untuk hari ini atau kemarin ditolak", () => {
  assert.match(
    String(periksaIzin(isi({ mulai: HARI_INI, selesai: HARI_INI }), HARI_INI)),
    /paling lambat H-1/,
  );
  assert.match(
    String(
      periksaIzin(
        isi({ mulai: "2024-10-20", selesai: "2024-10-20" }),
        HARI_INI,
      ),
    ),
    /paling lambat H-1/,
  );
});

test("izin terencana besok atau lebih diterima", () => {
  assert.equal(periksaIzin(isi(), HARI_INI), null);
  assert.equal(
    periksaIzin(isi({ mulai: "2024-11-04", selesai: "2024-11-06" }), HARI_INI),
    null,
  );
});

test("rentang terbalik dan rentang kelewat panjang ditolak", () => {
  assert.match(
    String(
      periksaIzin(
        isi({ mulai: "2024-11-05", selesai: "2024-11-01" }),
        HARI_INI,
      ),
    ),
    /sebelum tanggal mulai/,
  );
  assert.match(
    String(
      periksaIzin(
        isi({ mulai: "2024-11-01", selesai: "2024-12-31" }),
        HARI_INI,
      ),
    ),
    new RegExp(`${MAKS_HARI_IZIN} hari`),
  );
});

test("sakit hanya untuk hari berjalan", () => {
  assert.equal(
    periksaIzin(isi({ bentuk: "sakit", mulai: HARI_INI }), HARI_INI),
    null,
  );
  assert.match(
    String(
      periksaIzin(isi({ bentuk: "sakit", mulai: "2024-10-28" }), HARI_INI),
    ),
    /hari berjalan/,
  );
});

test("izin berjam wajib punya jam mulai dan selesai yang urut", () => {
  const jam = (p: Partial<IsiIzin>) =>
    periksaIzin(isi({ bentuk: "jam", mulai: HARI_INI, ...p }), HARI_INI);

  assert.match(String(jam({})), /jam mulai dan jam selesai/);
  assert.match(
    String(jam({ jamMulai: "10:00", jamSelesai: "09:00" })),
    /setelah jam mulai/,
  );
  assert.match(
    String(jam({ jamMulai: "10:00", jamSelesai: "10:00" })),
    /setelah jam mulai/,
  );
  assert.match(String(jam({ jamMulai: "25:00", jamSelesai: "26:00" })), /jam/);
  assert.equal(jam({ jamMulai: "08:00", jamSelesai: "10:30" }), null);
});

test("izin berjam untuk hari lain ditolak", () => {
  assert.match(
    String(
      periksaIzin(
        isi({
          bentuk: "jam",
          mulai: "2024-10-28",
          jamMulai: "08:00",
          jamSelesai: "10:00",
        }),
        HARI_INI,
      ),
    ),
    /hari berjalan/,
  );
});

test("alasan terlalu pendek ditolak untuk semua bentuk", () => {
  for (const bentuk of ["sakit", "terencana", "jam"] as const) {
    assert.match(
      String(
        periksaIzin(
          isi({
            bentuk,
            mulai: bentuk === "terencana" ? "2024-10-25" : HARI_INI,
            jamMulai: "08:00",
            jamSelesai: "10:00",
            alasan: "abc",
          }),
          HARI_INI,
        ),
      ),
      /minimal 5 karakter/,
    );
  }
});

test("jumlahHari menghitung kedua ujungnya", () => {
  assert.equal(jumlahHari("2024-10-25", "2024-10-25"), 1);
  assert.equal(jumlahHari("2024-10-25", "2024-10-27"), 3);
  assert.equal(jumlahHari("2024-10-31", "2024-11-02"), 3);
  assert.equal(jumlahHari("2024-10-27", "2024-10-25"), 0, "rentang terbalik");
});

test("tanggalRentang memuat setiap hari, termasuk lintas bulan", () => {
  assert.deepEqual(tanggalRentang("2024-10-30", "2024-11-01"), [
    "2024-10-30",
    "2024-10-31",
    "2024-11-01",
  ]);
  assert.deepEqual(tanggalRentang("2024-10-25", "2024-10-25"), ["2024-10-25"]);
});

test("jam efektif hanya bergeser oleh izin yang sudah disetujui", () => {
  assert.equal(
    jamEfektifMasuk("08:15", { jamSelesai: "10:00", disetujui: false }),
    "08:15",
    "izin yang belum disetujui tidak boleh menghapus telat",
  );
  assert.equal(
    jamEfektifMasuk("08:15", { jamSelesai: "10:00", disetujui: true }),
    "10:00",
  );
  assert.equal(jamEfektifMasuk("08:15", null), "08:15");
});

test("izin yang berakhir sebelum jam kerja tidak memajukan batas", () => {
  // Izin 06:00–07:00 selesai sebelum jam masuk; batasnya tetap normal.
  assert.equal(
    jamEfektifMasuk("08:15", { jamSelesai: "07:00", disetujui: true }),
    "08:15",
  );
});

test("menit telat dihitung terhadap jam efektif, bukan jam kerja normal", () => {
  assert.equal(menitTelat("10:20", "10:00"), 20);
  assert.equal(
    menitTelat("09:50", "10:00"),
    0,
    "datang lebih awal bukan telat",
  );
  assert.equal(menitTelat("08:15", "08:15"), 0, "tepat batas belum telat");
});
