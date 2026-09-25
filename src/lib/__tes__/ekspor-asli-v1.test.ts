import { strict as assert } from "node:assert";
import { test } from "node:test";
import { hariDariKejadian, tanggalWib } from "@/lib/izin-v1";
import {
  akunDiLaporan,
  akunV1,
  bakuAkun,
  catatanLaporan,
  medanLaporan,
  ratakanLaporan,
} from "@/lib/laporan-v1";
import { jejakQcDatar, jejakQcV1, statusTugasV1 } from "@/lib/tugas-v1";
import { jenisKeluarV1, keteranganKas } from "@/lib/keuangan-v1";
import { kontakV1, peranV1, programV1, unitV1 } from "@/lib/peran-v1";

// Bentuk ekspor K-Space lama yang SEBENARNYA berbeda dari contoh di
// repositori. Tes di sini menjaga pembacaan bentuk aslinya.

test("tanggal WIB: kejadian jam 22.00 WIB tetap hari yang sama", () => {
  // 2026-06-03T15:00Z = 22.00 WIB tanggal 3.
  assert.equal(tanggalWib("2026-06-03T15:00:00.000Z"), "2026-06-03");
  // 2026-06-03T18:30Z = 01.30 WIB tanggal 4.
  assert.equal(tanggalWib("2026-06-03T18:30:00.000Z"), "2026-06-04");
  assert.equal(tanggalWib("bukan tanggal"), null);
  assert.equal(tanggalWib(null), null);
});

test("kejadian masuk/pulang disatukan menjadi satu hari per orang", () => {
  const hari = hariDariKejadian([
    {
      id: "e1",
      type: "in",
      userId: "u1",
      timestamp: "2026-06-03T00:28:16Z",
      latitude: -7.04,
      longitude: 107.54,
      late: false,
    },
    { id: "e2", type: "out", userId: "u1", timestamp: "2026-06-03T09:58:28Z" },
    // Masuk kedua di hari yang sama: yang terawal yang dipakai.
    {
      id: "e3",
      type: "in",
      userId: "u1",
      timestamp: "2026-06-03T01:00:00Z",
      late: true,
    },
    {
      id: "e4",
      type: "in",
      userId: "u2",
      timestamp: "2026-06-03T00:45:00Z",
      late: true,
    },
  ]) as Record<string, unknown>[];

  assert.equal(hari.length, 2);
  const u1 = hari.find((h) => h.userId === "u1");
  assert.ok(u1);
  // Ejaan penanda sama dengan ekspor transformed yang sudah ada di peta.
  assert.equal(u1.id, "attn_u1_2026-06-03");
  assert.equal(u1.date, "2026-06-03");
  assert.equal(u1.checkIn, "2026-06-03T00:28:16Z");
  assert.equal(u1.checkOut, "2026-06-03T09:58:28Z");
  assert.equal(u1.status, "hadir");
  assert.deepEqual(u1.checkInLocation, { lat: -7.04, lng: 107.54 });

  const u2 = hari.find((h) => h.userId === "u2");
  assert.equal(u2?.status, "terlambat");
  assert.equal(u2?.checkOut, null);
});

test("baris yang sudah harian dibiarkan; yang cacat tetap ikut tertahan", () => {
  const hari = hariDariKejadian([
    {
      id: "att_001",
      userId: "u1",
      date: "2024-10-22",
      checkIn: "2024-10-22T07:44:00+07:00",
    },
    { id: "e9", type: "in", timestamp: "2026-06-03T00:28:16Z" },
  ]) as Record<string, unknown>[];
  assert.equal(hari.length, 2);
  assert.equal(hari[0].id, "att_001");
  // Tanpa userId: diteruskan sebagai baris harian tanpa orang.
  assert.equal(hari[1].id, "e9");
  assert.equal(hari[1].userId, "");
});

test("laporan ber-fieldsSnapshot diratakan dan medan intinya ketemu", () => {
  const datar = ratakanLaporan({
    id: "r1",
    date: "2026-06-14",
    authorId: "u1",
    submittedAt: "2026-06-14T10:01:59Z",
    templateName: "Laporan Harian Divisi Affiliate",
    fieldsSnapshot: [
      { id: "a", type: "date", label: "Tanggal Laporan", value: "2026-06-13" },
      { id: "b", type: "radio", label: "Nama Akun", value: "naimanurr" },
      {
        id: "c",
        type: "number",
        label: "Tercapai GMV Berapa? (Kemarin)",
        value: 9500000,
      },
      {
        id: "d",
        type: "number",
        label: "Berapa Komisi Hari Kemarin?",
        value: "543.000",
      },
      {
        id: "e",
        type: "number",
        label: "Realisasi Jumlah Upload VT (Kemarin)",
        value: 3,
      },
      { id: "f", type: "number", label: "Target GMV Harian", value: 10000000 },
      { id: "g", type: "textarea", label: "Kendala", value: "Sinyal jelek" },
    ],
  });
  const medan = medanLaporan(datar);
  assert.equal(medan.tanggal, "2026-06-14");
  assert.equal(medan.user, "u1");
  assert.equal(bakuAkun(medan.akun), "naimanurr");
  assert.equal(medan.gmv, 9500000);
  assert.equal(medan.komisi, "543.000");
  assert.equal(medan.upload, 3);
  assert.equal(medan.dikirim, "2026-06-14T10:01:59Z");

  const catatan = catatanLaporan(datar, medan.dipakai);
  // Jawaban yang sudah jadi kolom tidak diulang; target dibuang; sisanya
  // tetap terbaca beserta tanggal yang ditulis orang.
  assert.ok(catatan.includes("Sinyal jelek"));
  assert.ok(catatan.includes("Tanggal Laporan: 2026-06-13"));
  assert.ok(!catatan.includes("9500000"));
  assert.ok(!catatan.includes("Target GMV"));
  assert.ok(!catatan.includes("templateName"));
});

test("bentuk contoh (medan rata) masih terbaca seperti semula", () => {
  const baris = {
    id: "rep_001",
    userId: "usr_003",
    "Tanggal Laporan": "2024-10-01",
    createdAt: "2024-10-01T18:18:00+07:00",
    Akun: "@skincare_official",
    GMV: "4.176.000",
    Komisi: "543.000",
    "Jumlah Upload": 3,
    "Target GMV": "4.500.000",
  };
  const medan = medanLaporan(ratakanLaporan(baris));
  assert.equal(medan.tanggal, "2024-10-01");
  assert.equal(medan.user, "usr_003");
  assert.equal(bakuAkun(medan.akun), "skincare_official");
  assert.equal(medan.gmv, "4.176.000");
  assert.equal(medan.upload, 3);
});

test("nama akun disamakan bentuknya", () => {
  assert.equal(bakuAkun("naimanurr_"), "naimanurr");
  assert.equal(bakuAkun("@Taokspill"), "taokspill");
  assert.equal(bakuAkun("serbaaada.store"), "serbaaada.store");
  assert.equal(bakuAkun(""), null);
  assert.equal(bakuAkun(null), null);
});

test("jejak QC rata di baris tugas terbaca", () => {
  const qc = jejakQcV1(
    jejakQcDatar({
      qcResult: "approved",
      qcNote: "",
      qcDecidedById: "u9",
      qcDecidedAt: "2026-06-18T07:20:49Z",
    }),
  );
  assert.equal(qc.status, "lolos");
  assert.equal(qc.olehLama, "u9");
  assert.equal(qc.pada, "2026-06-18T07:20:49Z");
  assert.equal(jejakQcDatar({ title: "tanpa qc" }), null);
  assert.equal(statusTugasV1("in_progress"), "berjalan");
});

test("divisi K-Space lama dipetakan ke unit dan program V2", () => {
  assert.equal(unitV1("internal"), "affiliator");
  assert.equal(unitV1("mabit"), "affiliator");
  assert.equal(unitV1("affiliate"), "affiliator");
  assert.equal(unitV1("manajemen"), null);
  assert.equal(unitV1("keuangan"), null);
  assert.equal(programV1("mabit"), "Mabit Scholar");
  assert.equal(programV1("internal"), null);
});

test("orang di divisi keuangan menjadi Finance, bukan Leader", () => {
  // V2 tidak punya unit keuangan; Leader tanpa unit tidak bisa aktif.
  assert.equal(peranV1("leader", "keuangan"), "Finance");
  assert.equal(peranV1("operasional", "keuangan"), "Finance");
  assert.equal(peranV1("manajer", "keuangan"), "Manager");
  // Tanpa divisi, perilaku lama tidak berubah.
  assert.equal(peranV1("leader"), "Leader");
  assert.equal(peranV1("operasional"), null);
  assert.equal(peranV1("wakil", "internal"), "Co-Leader");
});

test("nomor telepon lama dibakukan ke +62", () => {
  assert.equal(kontakV1("089505622884"), "+6289505622884");
  assert.equal(kontakV1("0812-3456-7890"), "+6281234567890");
  assert.equal(kontakV1("+62 895 0562 2884"), "+6289505622884");
  assert.equal(kontakV1("6289505622884"), "+6289505622884");
  assert.equal(kontakV1("89505622884"), "+6289505622884");
  // Yang tidak jelas tidak ditebak.
  assert.equal(kontakV1("12345"), null);
  assert.equal(kontakV1(""), null);
  assert.equal(kontakV1(null), null);
});

test("keterangan kas yang terlalu pendek tetap dibawa", () => {
  // V2 menolak keterangan di bawah lima huruf (0097).
  assert.equal(keteranganKas("TAP", null, true), "TAP (dari K-Space lama)");
  assert.equal(keteranganKas("TAP AGS", null, true), "TAP AGS");
});

test("kategori arus kas K-Space lama dipetakan", () => {
  assert.equal(jenisKeluarV1("Gaji & Bonus"), "beban");
  assert.equal(jenisKeluarV1("Aset & Peralatan"), "aset");
  assert.equal(jenisKeluarV1("Deviden"), "dividen");
  assert.equal(jenisKeluarV1("Komisi Affiliate"), "creator_share");
  // Yang maknanya belum pasti tetap tidak ditebak.
  assert.equal(jenisKeluarV1("Pengembalian Dana"), null);
});

test("salah ketik nama akun yang dikenal dibetulkan; sisanya apa adanya", () => {
  assert.equal(akunV1("dapaspilin"), "dafaspilin");
  assert.equal(akunV1("@Dapaspilin_"), "dafaspilin");
  assert.equal(akunV1("hersandaaffiliator"), "hawnahijab");
  assert.equal(akunV1("naimanurr_"), "naimanurr");
  assert.equal(akunV1(""), null);
});

test("akun yang disebut laporan dihitung beserta pelapornya dan ejaan terseringnya", () => {
  const laporan = (id: string, akun: string, user: string) => ({
    id,
    date: "2026-07-20",
    authorId: user,
    fieldsSnapshot: [{ label: "Nama Akun", value: akun }],
  });
  const peta = akunDiLaporan([
    laporan("r1", "hawnahijab_", "u_hersanda"),
    laporan("r2", "hawnahijab_", "u_hersanda"),
    laporan("r3", "hawnahijab", "u_agnes"),
    // Alias: ikut ke akun yang dimaksud, tetapi ejaannya tidak dipakai.
    laporan("r4", "hersandaaffiliator", "u_hersanda"),
    laporan("r5", "dapaspilin", "u_daffa"),
    { id: "r6", date: "2026-07-20", authorId: "u_x", fieldsSnapshot: [] },
  ]);

  const hawna = peta.get("hawnahijab");
  assert.ok(hawna);
  assert.equal(hawna.jumlah, 4);
  assert.equal(hawna.username, "hawnahijab_");
  assert.equal(hawna.pelapor.get("u_hersanda"), 3);
  assert.equal(hawna.pelapor.get("u_agnes"), 1);

  const daffa = peta.get("dafaspilin");
  assert.ok(daffa);
  // Satu-satunya ejaan adalah salah ketiknya: dipakai apa adanya daripada
  // dikarang, dan akun ini biasanya sudah ada di daftar akun lama.
  assert.equal(daffa.username, "dapaspilin");
  assert.equal(peta.size, 2);
});
