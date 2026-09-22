/** Transaksi berjenis aset melahirkan asetnya sendiri saat benar-benar dibayar. */
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
const { uji, jalankan } = buatSuite("Aset dari transaksi");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const finance = await id("Laras Ayuningtyas");
const manager = await id("Farhan Pratama");

const ajukanAset = async (keterangan, jumlah = 15_000_000) => {
  const unit = (await sebagaiAdmin(db, "select id from units limit 1")).rows[0]
    .id;
  const { rows } = await sebagai(
    db,
    finance,
    `insert into transactions (tanggal, arah, jenis, unit_id, keterangan, jumlah, diajukan_id)
     values ('2024-10-24', 'keluar', 'aset', $1, $2, $3, $4)
     returning id`,
    [unit, keterangan, jumlah, finance],
  );
  return rows[0].id;
};

const putuskan = (oleh, transaksi, ke, catatan = "") =>
  sebagai(
    db,
    oleh,
    `insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
     values ($1, $2, $3, $4)`,
    [transaksi, ke, oleh, catatan],
  );

const asetDari = async (transaksi) =>
  (
    await sebagaiAdmin(db, "select * from assets where transaction_id = $1", [
      transaksi,
    ])
  ).rows[0];

uji("data contoh tidak menggandakan aset yang sudah tercatat", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from assets",
  );
  harusSama(rows[0].n, 12, "tepat sebanyak aset di data contoh");
});

uji("pengajuan yang belum dibayar belum melahirkan aset", async () => {
  const t = await ajukanAset("Kamera cadangan studio");
  harusSama(await asetDari(t), undefined, "belum ada barangnya");

  await putuskan(manager, t, "disetujui");
  harusSama(
    await asetDari(t),
    undefined,
    "disetujui saja belum memindahkan uang maupun barang",
  );
});

uji("begitu dibayar, asetnya muncul dengan nilai yang sama", async () => {
  const t = await ajukanAset("Laptop editor cadangan", 24_500_000);
  await putuskan(manager, t, "disetujui");
  await putuskan(finance, t, "dibayar");

  const a = await asetDari(t);
  harus(a, "asetnya dibuatkan");
  harusSama(a.nama, "Laptop editor cadangan", "namanya dari keterangannya");
  harusSama(Number(a.nilai_perolehan), 24_500_000, "nilainya dari nominalnya");
  harusSama(String(a.tanggal).slice(0, 15), "Thu Oct 24 2024".slice(0, 15));
  harusSama(a.status, "cadangan", "belum diserahkan ke siapa pun");
  harusSama(a.pemegang_id, null, "karena itu tanpa pemegang");
  harus(a.kode.startsWith("AST-"), "kodenya melanjutkan deretan yang ada");
});

uji("asetnya lahir lengkap dengan catatan perolehannya", async () => {
  const t = await ajukanAset("Mikrofon pengganti", 3_000_000);
  await putuskan(manager, t, "disetujui");
  await putuskan(finance, t, "dibayar");

  const a = await asetDari(t);
  const { rows } = await sebagaiAdmin(
    db,
    "select * from asset_events where asset_id = $1",
    [a.id],
  );

  harusSama(rows.length, 1, "satu kejadian: perolehannya");
  harusSama(rows[0].dari, null, "itulah titik berangkatnya");
  harusSama(rows[0].ke, "cadangan", "sesuai keadaan awalnya");
});

uji("satu transaksi hanya melahirkan satu aset", async () => {
  const t = await ajukanAset("Meja tambahan", 4_000_000);
  await putuskan(manager, t, "disetujui");
  await putuskan(finance, t, "dibayar");

  // Menyentuh transaksinya lagi tidak boleh menambah barang kedua.
  await sebagaiAdmin(
    db,
    "update transactions set catatan_keputusan = 'ditinjau ulang' where id = $1",
    [t],
  );

  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from assets where transaction_id = $1",
    [t],
  );
  harusSama(rows[0].n, 1, "tetap satu");
});

uji("pengeluaran berjenis lain tidak melahirkan aset", async () => {
  const unit = (await sebagaiAdmin(db, "select id from units limit 1")).rows[0]
    .id;
  const { rows } = await sebagai(
    db,
    finance,
    `insert into transactions (tanggal, arah, jenis, unit_id, keterangan, jumlah, diajukan_id)
     values ('2024-10-24', 'keluar', 'beban', $1, 'Konsumsi rapat bulanan', 800000, $2)
     returning id`,
    [unit, finance],
  );
  await putuskan(manager, rows[0].id, "disetujui");
  await putuskan(finance, rows[0].id, "dibayar");

  harusSama(await asetDari(rows[0].id), undefined, "beban habis, bukan barang");
});

uji("aset bawaan sistem masuk daftar yang perlu dilengkapi", async () => {
  const t = await ajukanAset("Tripod tambahan", 1_500_000);
  await putuskan(manager, t, "disetujui");
  await putuskan(finance, t, "dibayar");

  const a = await asetDari(t);
  const { rows } = await sebagai(
    db,
    finance,
    "select * from aset_perlu_dilengkapi()",
  );
  const baris = rows.find((r) => r.id === a.id);

  harus(baris, "ia menunggu dilengkapi");
  harus(
    baris.alasan.includes("kategori"),
    "alasannya disebutkan, bukan sekadar ditandai",
  );
});

uji("masa manfaat bawaan diambil dari pengaturan, bukan ditebak kode", async () => {
  await sebagaiAdmin(db, "update keuangan_pengaturan set masa_manfaat_bawaan = 60");

  const t = await ajukanAset("Rak penyimpanan", 2_000_000);
  await putuskan(manager, t, "disetujui");
  await putuskan(finance, t, "dibayar");

  harusSama((await asetDari(t)).masa_manfaat, 60, "mengikuti pengaturan");
  await sebagaiAdmin(db, "update keuangan_pengaturan set masa_manfaat_bawaan = 48");
});

await jalankan();
await db.close();
