/** Laporan keuangan basis data harus terbaca sebagai laporan yang sama dengan di layar. */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";
import { readFile } from "node:fs/promises";
import {
  laporanCashFlow,
  laporanLabaRugi,
  ringkasKeuangan,
  waterfallManajemen,
} from "../../src/lib/keuangan.ts";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Laporan keuangan");

const seed = JSON.parse(await readFile("supabase/seed/data.json", "utf8"));

const dariSeed = (saring = () => true) =>
  seed.transaksi.filter(saring).map((t) => ({
    id: t.id,
    tanggal: t.tanggal,
    arah: t.arah,
    jenis: t.jenis ?? null,
    unitKode: t.unit ?? null,
    unitNama: t.unit ?? "Perusahaan",
    akunUsername: t.akun ?? null,
    keterangan: t.keterangan,
    jumlah: t.jumlah,
    status: t.status,
    diajukanId: null,
    diajukanNama: t.diajukan ?? null,
    disetujuiNama: t.disetujui ?? null,
  }));

const ringkasLayar = ringkasKeuangan(dariSeed(), seed.kas_awal);

const baris = async (fungsi) =>
  (await sebagaiAdmin(db, `select * from ${fungsi}() order by urutan`)).rows;

/** Membandingkan label dan nilai baris demi baris. */
const bandingkan = (basis, layar, nama) => {
  harusSama(basis.length, layar.length, `${nama}: jumlah baris`);
  basis.forEach((b, i) => {
    harusSama(b.label, layar[i].label, `${nama} baris ${i + 1}: label`);
    harusSama(
      Number(b.nilai),
      layar[i].nilai,
      `${nama} baris "${b.label}": nilai`,
    );
    harusSama(
      b.total,
      Boolean(layar[i].total),
      `${nama} baris "${b.label}": penanda total`,
    );
  });
};

uji("arus kas sama dengan yang dihitung layar", async () => {
  bandingkan(
    await baris("laporan_cash_flow"),
    laporanCashFlow(ringkasLayar, seed.kas_awal),
    "arus kas",
  );
});

uji("laba rugi sama dengan yang dihitung layar", async () => {
  bandingkan(
    await baris("laporan_laba_rugi"),
    laporanLabaRugi(ringkasLayar),
    "laba rugi",
  );
});

uji("waterfall sama dengan yang dihitung layar", async () => {
  bandingkan(
    await baris("waterfall_manajemen"),
    waterfallManajemen(ringkasLayar),
    "waterfall",
  );
});

uji("arus kas berakhir tepat di saldo kas ringkasan", async () => {
  const rows = await baris("laporan_cash_flow");
  const akhir = rows.at(-1);
  const { rows: ringkas } = await sebagaiAdmin(
    db,
    "select saldo_kas from ringkas_keuangan()",
  );

  harusSama(akhir.label, "Saldo kas akhir", "baris terakhir arus kas");
  harusSama(
    Number(akhir.nilai),
    Number(ringkas[0].saldo_kas),
    "arus kas dan ringkasan tidak boleh berselisih",
  );
});

uji("saldo awal + seluruh mutasi = saldo akhir", async () => {
  const rows = await baris("laporan_cash_flow");
  const nilai = Object.fromEntries(rows.map((r) => [r.label, Number(r.nilai)]));

  // Baris total tidak ikut dijumlah: ia hasil, bukan mutasi.
  const mutasi = rows
    .filter((r) => !r.total)
    .reduce((n, r) => n + Number(r.nilai), 0);

  harusSama(
    nilai["Saldo kas awal"] + mutasi,
    nilai["Saldo kas akhir"],
    "arus kas harus menutup",
  );
});

uji("aset dan dividen tidak muncul di laba rugi", async () => {
  const rows = await baris("laporan_laba_rugi");
  const label = rows.map((r) => r.label.toLowerCase()).join(" ");

  harus(!label.includes("aset"), "aset bukan biaya");
  harus(!label.includes("dividen"), "dividen pemakaian laba, bukan beban");
});

uji("periode dipersempit: laporannya ikut menyempit", async () => {
  const dari = "2024-10-01";
  const sampai = "2024-10-31";

  const sebelumnya = ringkasKeuangan(
    dariSeed((t) => t.tanggal < dari),
    seed.kas_awal,
  ).saldoKas;
  const layar = laporanCashFlow(
    ringkasKeuangan(
      dariSeed((t) => t.tanggal >= dari && t.tanggal <= sampai),
      sebelumnya,
    ),
    sebelumnya,
  );

  const { rows } = await sebagaiAdmin(
    db,
    "select * from laporan_cash_flow($1, $2) order by urutan",
    [dari, sampai],
  );
  bandingkan(rows, layar, "arus kas Oktober");
});

uji("tanpa hak baca angka perusahaan, laporannya kosong", async () => {
  const staf = (
    await sebagaiAdmin(db, "select id from users where nama = 'Rian Hidayat'")
  ).rows[0].id;

  const { rows } = await sebagai(
    db,
    staf,
    "select * from laporan_laba_rugi() order by urutan",
  );
  harus(
    rows.every((r) => Number(r.nilai) === 0),
    "RLS membuat seluruh angkanya nol, bukan bocor",
  );
});

await jalankan();
await db.close();
