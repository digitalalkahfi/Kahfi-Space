/** Ringkasan keuangan di basis data harus sama persis dengan yang di layar. */
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
import { ringkasKeuangan, kontribusiUnit } from "../../src/lib/keuangan.ts";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Ringkasan keuangan");

const seed = JSON.parse(await readFile("supabase/seed/data.json", "utf8"));
const unitNama = Object.fromEntries(
  seed.units.map((u) => [u.kode, u.nama.split(" (")[0]]),
);

/** Bentuk transaksi seperti yang dibaca aplikasi dari data contoh. */
const dariSeed = (saring = () => true) =>
  seed.transaksi.filter(saring).map((t) => ({
    id: t.id,
    tanggal: t.tanggal,
    arah: t.arah,
    jenis: t.jenis ?? null,
    unitKode: t.unit ?? null,
    unitNama: t.unit ? unitNama[t.unit] : "Perusahaan",
    akunUsername: t.akun ?? null,
    keterangan: t.keterangan,
    jumlah: t.jumlah,
    status: t.status,
    diajukanId: null,
    diajukanNama: t.diajukan ?? null,
    disetujuiNama: t.disetujui ?? null,
  }));

const ringkasDb = async (dari = null, sampai = null) =>
  (
    await sebagaiAdmin(db, "select * from ringkas_keuangan($1, $2)", [
      dari,
      sampai,
    ])
  ).rows[0];

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

uji("seluruh periode: angkanya sama dengan hitungan aplikasi", async () => {
  const layar = ringkasKeuangan(dariSeed(), seed.kas_awal);
  const basis = await ringkasDb();

  harusSama(Number(basis.pendapatan), layar.pendapatan, "pendapatan");
  harusSama(Number(basis.direct_cost), layar.directCost, "direct cost");
  harusSama(Number(basis.creator_share), layar.creatorShare, "creator share");
  harusSama(Number(basis.net_revenue), layar.netRevenue, "net revenue");
  harusSama(Number(basis.beban), layar.beban, "beban");
  harusSama(Number(basis.aset), layar.aset, "aset");
  harusSama(Number(basis.dividen), layar.dividen, "dividen");
  harusSama(Number(basis.laba_bersih), layar.labaBersih, "laba bersih");
  harusSama(Number(basis.npm), layar.npm, "NPM");
  harusSama(Number(basis.saldo_kas), layar.saldoKas, "saldo kas");
  harusSama(
    Number(basis.menunggu_persetujuan),
    layar.menungguPersetujuan,
    "menunggu persetujuan",
  );
});

uji("satu bulan: saldo awal periode ikut dihitung", async () => {
  const dari = "2024-10-01";
  const sampai = "2024-10-31";

  const sebelumnya = ringkasKeuangan(
    dariSeed((t) => t.tanggal < dari),
    seed.kas_awal,
  ).saldoKas;
  const layar = ringkasKeuangan(
    dariSeed((t) => t.tanggal >= dari && t.tanggal <= sampai),
    sebelumnya,
  );
  const basis = await ringkasDb(dari, sampai);

  harusSama(Number(basis.net_revenue), layar.netRevenue, "net revenue Oktober");
  harusSama(Number(basis.laba_bersih), layar.labaBersih, "laba bersih Oktober");
  harusSama(Number(basis.saldo_kas), layar.saldoKas, "saldo kas akhir Oktober");
});

uji("aset mengurangi kas tetapi tidak mengurangi laba", async () => {
  const basis = await ringkasDb();
  harus(Number(basis.aset) > 0, "data contoh memang punya pembelian aset");

  const tanpaAset =
    Number(basis.net_revenue) - Number(basis.beban);
  harusSama(Number(basis.laba_bersih), tanpaAset, "aset tidak masuk laba");
});

uji("NPM dihitung terhadap net revenue, bukan pendapatan kotor", async () => {
  const basis = await ringkasDb();
  const terhadapKotor =
    Math.round((Number(basis.laba_bersih) / Number(basis.pendapatan)) * 1000) /
    10;

  harus(
    Number(basis.npm) !== terhadapKotor,
    "keduanya memang berbeda — itulah sebab angka lama menyesatkan",
  );
  harusSama(
    Number(basis.npm),
    Math.round(
      (Number(basis.laba_bersih) / Number(basis.net_revenue)) * 1000,
    ) / 10,
    "NPM terhadap net revenue",
  );
});

uji("pengajuan yang disetujui belum ikut menggerakkan angka", async () => {
  const sebelum = await ringkasDb();

  const finance = await id("Laras Ayuningtyas");
  const manager = await id("Farhan Pratama");
  const { rows } = await sebagai(
    db,
    finance,
    `insert into transactions (tanggal, arah, jenis, keterangan, jumlah, diajukan_id)
     values ('2024-10-24', 'keluar', 'beban', 'Belum dibayar sama sekali', 5000000, $1)
     returning id`,
    [finance],
  );
  await sebagai(
    db,
    manager,
    `insert into transaction_approvals (transaction_id, ke, oleh_id)
     values ($1, 'disetujui', $2)`,
    [rows[0].id, manager],
  );

  const sesudah = await ringkasDb();
  harusSama(
    Number(sesudah.laba_bersih),
    Number(sebelum.laba_bersih),
    "laba tidak berubah sebelum dibayar",
  );
  harusSama(
    Number(sesudah.saldo_kas),
    Number(sebelum.saldo_kas),
    "kas tidak berubah sebelum dibayar",
  );

  await sebagai(
    db,
    finance,
    `insert into transaction_approvals (transaction_id, ke, oleh_id)
     values ($1, 'dibayar', $2)`,
    [rows[0].id, finance],
  );
  const dibayar = await ringkasDb();
  harusSama(
    Number(dibayar.saldo_kas),
    Number(sebelum.saldo_kas) - 5_000_000,
    "baru setelah dibayar kas berkurang",
  );
});

uji("kontribusi unit sama dengan hitungan aplikasi", async () => {
  const layar = kontribusiUnit(dariSeed());
  const { rows } = await sebagaiAdmin(db, "select * from kontribusi_unit()");

  harusSama(rows.length, layar.length, "jumlah unit yang berkontribusi");

  for (const baris of rows) {
    const bandingan = layar.find((u) => u.unitNama === baris.unit_nama.split(" (")[0]);
    harus(bandingan, `unit ${baris.unit_nama} ada di kedua hitungan`);
    harusSama(
      Number(baris.net_revenue),
      bandingan.netRevenue,
      `net revenue ${baris.unit_nama}`,
    );
  }
});

uji("angka ringkasan mengikuti RLS: Staff tidak melihat apa pun", async () => {
  const staf = await id("Rian Hidayat");
  const { rows } = await sebagai(db, staf, "select * from ringkas_keuangan()");

  harusSama(Number(rows[0].pendapatan), 0, "tanpa hak baca, tidak ada angka");
  harusSama(Number(rows[0].saldo_kas), 0, "kas pun tidak terlihat");
});

await jalankan();
await db.close();
