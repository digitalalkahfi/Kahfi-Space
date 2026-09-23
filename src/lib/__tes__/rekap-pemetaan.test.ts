import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  idOrangEkspor,
  orangDitunggu,
  orangTakDikenal,
  rekapPemetaan,
  totalRekap,
} from "@/lib/rekap-pemetaan";
import { PEMETAAN_V1 } from "@/lib/pemetaan-v1";

const contoh = JSON.parse(
  readFileSync("supabase/migrasi/ekspor-contoh.json", "utf8"),
) as Record<string, unknown>;

test("id orang dikumpulkan dari users:list", () => {
  const id = idOrangEkspor(contoh);
  assert.ok(id.size > 0);
  assert.equal(id.has("usr_001"), true);
});

test("rujukan orang yang tidak ada dilaporkan, yang kosong tidak", () => {
  const dikenal = new Set(["usr_001"]);
  assert.deepEqual(orangTakDikenal({ userId: "usr_001" }, dikenal), []);
  assert.deepEqual(orangTakDikenal({ userId: "usr_999" }, dikenal), [
    "usr_999",
  ]);
  // Banyak entri lama memang tidak punya atasan; itu bukan rujukan hilang.
  assert.deepEqual(orangTakDikenal({ leaderId: null }, dikenal), []);
  assert.deepEqual(orangTakDikenal({ leaderId: "" }, dikenal), []);
  // Satu entri bisa menunggu lebih dari satu orang sekaligus.
  assert.deepEqual(
    orangTakDikenal({ assigneeId: "usr_900", createdById: "usr_901" }, dikenal),
    ["usr_900", "usr_901"],
  );
});

test("contoh ekspor tidak menyisakan orang yang menggantung", () => {
  // Seluruh rujukan orang di contoh menunjuk orang yang ada — kalau
  // tidak, layar demo memamerkan kegagalan yang bukan milik penggunanya.
  const rekap = rekapPemetaan(contoh, PEMETAAN_V1);
  const total = totalRekap(rekap);
  assert.equal(total.butuhKeputusan, 0);
  assert.deepEqual(total.orangHilang, []);
  assert.equal(total.ekspor, total.terpetakan);
});

test("entri yang menunjuk orang asing masuk hitungan butuh keputusan", () => {
  const rekap = rekapPemetaan(
    {
      "users:list": [{ id: "usr_001" }],
      "tasks:all": [
        { id: "t1", assigneeId: "usr_001", createdById: "usr_001" },
        { id: "t2", assigneeId: "usr_404", createdById: "usr_001" },
        { id: "t3", assigneeId: "usr_404", createdById: "usr_405" },
      ],
    },
    PEMETAAN_V1,
  );

  const tugas = rekap.find((r) => r.kunci === "tasks:all");
  assert.ok(tugas);
  assert.equal(tugas.ekspor, 3);
  assert.equal(tugas.butuhKeputusan, 2);
  assert.equal(tugas.terpetakan, 1);
  // Orangnya disebut sekali saja meski muncul di beberapa entri.
  assert.deepEqual(tugas.orangHilang, ["usr_404", "usr_405"]);
});

test("kunci berisi satu objek pengaturan terhitung satu entri", () => {
  const rekap = rekapPemetaan(
    { "attendance:config": { jamMasuk: "08:00" } },
    PEMETAAN_V1,
  );
  const config = rekap.find((r) => r.kunci === "attendance:config");
  assert.equal(config?.ekspor, 1);
  assert.equal(config?.butuhKeputusan, 0);
});

test("kunci yang tidak ada di ekspor terhitung nol, bukan hilang dari rekap", () => {
  // Kelompok yang menghilang dari layar terbaca seolah sudah beres.
  const rekap = rekapPemetaan({}, PEMETAAN_V1);
  assert.equal(rekap.length, PEMETAAN_V1.length);
  assert.ok(rekap.every((r) => r.ekspor === 0));
});

test("hitungan yang sudah pindah dibaca terpisah dari kesiapannya", () => {
  // Siap dipetakan dan sudah pindah adalah dua hal berbeda; menyatukan
  // keduanya membuat migrasi yang belum dijalankan tampak sudah selesai.
  const rekap = rekapPemetaan(
    {
      "users:list": [{ id: "usr_001" }, { id: "usr_002" }],
      "tasks:all": [{ id: "t1", assigneeId: "usr_001" }],
    },
    PEMETAAN_V1,
    { "users:list": 2 },
  );

  const orang = rekap.find((r) => r.kunci === "users:list");
  const tugas = rekap.find((r) => r.kunci === "tasks:all");
  assert.equal(orang?.dipindahkan, 2);
  assert.equal(tugas?.dipindahkan, 0);
  assert.equal(totalRekap(rekap).dipindahkan, 2);
});

test("orang yang ditunggu dikumpulkan dari seluruh kunci, bukan hanya users:list", () => {
  // Seseorang bisa tidak ada di daftar orang sama sekali dan tetap
  // menjadi pelapor ratusan laporan.
  const ditunggu = orangDitunggu(
    {
      "users:list": [{ id: "usr_001" }],
      "daily-reports:all": [
        { id: "r1", userId: "usr_404" },
        { id: "r2", userId: "usr_404" },
      ],
      "tasks:all": [
        { id: "t1", assigneeId: "usr_404", createdById: "usr_001" },
      ],
    },
    PEMETAAN_V1,
  );

  assert.equal(ditunggu.length, 1);
  assert.equal(ditunggu[0].idLama, "usr_404");
  assert.equal(ditunggu[0].jumlah, 3);
  assert.deepEqual(ditunggu[0].kemunculan, ["daily-reports:all", "tasks:all"]);
});

test("yang paling banyak menggantung disebut lebih dulu", () => {
  const ditunggu = orangDitunggu(
    {
      "users:list": [],
      "tasks:all": [
        { id: "t1", assigneeId: "usr_a" },
        { id: "t2", assigneeId: "usr_b" },
        { id: "t3", assigneeId: "usr_b" },
      ],
    },
    PEMETAAN_V1,
  );
  assert.equal(ditunggu[0].idLama, "usr_b");
});

test("ekspor yang rujukannya utuh tidak menunggu siapa pun", () => {
  assert.deepEqual(orangDitunggu(contoh, PEMETAAN_V1), []);
});
