/** Pagar akses modul Keuangan: siapa melihat angka, siapa menyunting apa. */
import {
  buatDb,
  buatSuite,
  harus,
  harusDitolak,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Akses modul Keuangan");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const finance = await id("Laras Ayuningtyas");
const manager = await id("Farhan Pratama");
const ceo = await id("Hafidz Alkahfi");
const staf = await id("Rian Hidayat");
const leader = await id("Dewi Lestari");

const ajukan = async (oleh, keterangan) => {
  const { rows } = await sebagai(
    db,
    oleh,
    `insert into transactions (tanggal, arah, jenis, keterangan, jumlah, diajukan_id)
     values ('2024-10-24', 'keluar', 'beban', $1, 1000000, $2)
     returning id`,
    [keterangan, oleh],
  );
  return rows[0].id;
};

const transaksi = async (transaksiId) =>
  (await sebagaiAdmin(db, "select * from transactions where id = $1", [
    transaksiId,
  ])).rows[0];

uji("posisi kas tidak bocor lewat fungsi yang security definer", async () => {
  for (const [nama, orang] of [
    ["Staff", staf],
    ["Leader", leader],
  ]) {
    const { rows } = await sebagai(db, orang, "select saldo_kas() as s");
    harusSama(rows[0].s, null, `${nama} tidak boleh tahu posisi kas`);
  }

  const { rows: boleh } = await sebagai(db, finance, "select saldo_kas() as s");
  harus(Number(boleh[0].s) > 0, "Finance memang melihatnya");
});

uji("ambang wewenang pun bukan kabar untuk semua orang", async () => {
  const { rows } = await sebagai(db, staf, "select penyetuju_wajib() as p");
  harusSama(rows[0].p, null, "Staff tidak perlu tahu kas sedang menipis");

  const { rows: boleh } = await sebagai(
    db,
    manager,
    "select penyetuju_wajib() as p",
  );
  harus(["CEO", "Manager"].includes(boleh[0].p), "Manager melihatnya");
});

uji("pengaju boleh membetulkan pengajuannya sendiri", async () => {
  const t = await ajukan(finance, "Punya Finance sendiri");

  await sebagai(
    db,
    finance,
    "update transactions set jumlah = 2500000 where id = $1",
    [t],
  );
  harusSama(Number((await transaksi(t)).jumlah), 2_500_000, "boleh dibetulkan");
});

uji("pengajuan orang lain tidak bisa disunting diam-diam", async () => {
  const t = await ajukan(manager, "Punya Manager");

  // RLS menolak dengan nol baris; yang diperiksa keadaan datanya.
  await sebagai(
    db,
    finance,
    "update transactions set jumlah = 9000000 where id = $1",
    [t],
  );
  harusSama(
    Number((await transaksi(t)).jumlah),
    1_000_000,
    "nominal orang lain tidak berubah",
  );
});

uji("CEO dan Manager tetap bisa membetulkan pengajuan siapa pun", async () => {
  const t = await ajukan(finance, "Dibetulkan atasan");

  await sebagai(
    db,
    ceo,
    "update transactions set keterangan = 'Dibetulkan CEO sendiri' where id = $1",
    [t],
  );
  harusSama(
    (await transaksi(t)).keterangan,
    "Dibetulkan CEO sendiri",
    "CEO membetulkan pengajuan Finance",
  );
});

uji("Finance bisa melunasi pengajuan milik orang lain", async () => {
  // Inilah yang patah kalau trigger persetujuan ikut tunduk RLS
  // pemanggilnya: Finance bukan pengaju dan bukan lintas unit.
  const t = await ajukan(manager, "Dibayar oleh Finance");
  await sebagai(
    db,
    ceo,
    `insert into transaction_approvals (transaction_id, ke, oleh_id)
     values ($1, 'disetujui', $2)`,
    [t, ceo],
  );
  await sebagai(
    db,
    finance,
    `insert into transaction_approvals (transaction_id, ke, oleh_id)
     values ($1, 'dibayar', $2)`,
    [t, finance],
  );

  harusSama((await transaksi(t)).status, "dibayar", "pembayaran berhasil");
});

uji("transaksi tidak bisa dihapus siapa pun", async () => {
  const t = await ajukan(finance, "Tidak boleh lenyap");

  for (const [nama, orang] of [
    ["Finance", finance],
    ["Manager", manager],
    ["CEO", ceo],
  ]) {
    await sebagai(db, orang, "delete from transactions where id = $1", [t]);
    harus(await transaksi(t), `${nama} tidak bisa menghapusnya`);
  }
});

uji("Staff dan Leader tidak bisa menyentuh transaksi sama sekali", async () => {
  const t = await ajukan(finance, "Bukan urusan mereka");

  for (const [nama, orang] of [
    ["Staff", staf],
    ["Leader", leader],
  ]) {
    await harusDitolak(
      () =>
        sebagai(
          db,
          orang,
          `insert into transactions (tanggal, arah, jenis, keterangan, jumlah, diajukan_id)
           values ('2024-10-24', 'keluar', 'beban', 'Percobaan masuk', 100000, $1)`,
          [orang],
        ),
      `${nama} mencatat transaksi`,
    );

    await sebagai(
      db,
      orang,
      "update transactions set jumlah = 1 where id = $1",
      [t],
    );
    harusSama(
      Number((await transaksi(t)).jumlah),
      1_000_000,
      `${nama} tidak mengubah apa pun`,
    );
  }
});

uji("kas awal hanya bisa diubah CEO atau Manager", async () => {
  const semula = Number(
    (await sebagaiAdmin(db, "select kas_awal from keuangan_pengaturan")).rows[0]
      .kas_awal,
  );

  await sebagai(db, finance, "update keuangan_pengaturan set kas_awal = 1");
  harusSama(
    Number(
      (await sebagaiAdmin(db, "select kas_awal from keuangan_pengaturan"))
        .rows[0].kas_awal,
    ),
    semula,
    "Finance membaca, tetapi tidak menetapkan saldo pembuka",
  );

  await sebagai(db, ceo, "update keuangan_pengaturan set kas_awal = $1", [
    semula + 1000,
  ]);
  harusSama(
    Number(
      (await sebagaiAdmin(db, "select kas_awal from keuangan_pengaturan"))
        .rows[0].kas_awal,
    ),
    semula + 1000,
    "CEO menetapkannya",
  );

  await sebagaiAdmin(db, "update keuangan_pengaturan set kas_awal = $1", [
    semula,
  ]);
});

await jalankan();
await db.close();
