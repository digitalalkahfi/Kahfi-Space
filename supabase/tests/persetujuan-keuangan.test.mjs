/** Persetujuan pengeluaran: wewenang, jejak, dan ambang kas CEO (PRD §4). */
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
const { uji, jalankan } = buatSuite("Persetujuan pengeluaran");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const finance = await id("Laras Ayuningtyas");
const manager = await id("Farhan Pratama");
const ceo = await id("Hafidz Alkahfi");
const staf = await id("Rian Hidayat");

const ajukan = async (oleh, isi = {}) => {
  const { rows } = await sebagai(
    db,
    oleh,
    `insert into transactions (tanggal, arah, jenis, keterangan, jumlah, diajukan_id)
     values ('2024-10-24', 'keluar', 'beban', $1, $2, $3)
     returning id`,
    [isi.keterangan ?? "Pengajuan untuk diuji", isi.jumlah ?? 1_000_000, oleh],
  );
  return rows[0].id;
};

const putuskan = (oleh, transaksiId, ke, catatan = "") =>
  sebagai(
    db,
    oleh,
    `insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)
     values ($1, $2, $3, $4)`,
    [transaksiId, ke, oleh, catatan],
  );

/** Menggeser kas ke bawah/atas ambang lewat transaksi yang benar-benar dibayar. */
const geserKas = async (selisih) => {
  const arah = selisih > 0 ? "masuk" : "keluar";
  const unit = (await sebagaiAdmin(db, "select id from units limit 1")).rows[0].id;

  if (arah === "masuk") {
    await sebagai(
      db,
      finance,
      `insert into transactions (tanggal, arah, unit_id, keterangan, jumlah, diajukan_id)
       values ('2024-10-24', 'masuk', $1, 'Penyesuaian kas untuk uji', $2, $3)`,
      [unit, selisih, finance],
    );
    return;
  }

  const t = await ajukan(finance, {
    keterangan: "Penyesuaian kas untuk uji",
    jumlah: -selisih,
  });
  await putuskan(ceo, t, "disetujui");
  await putuskan(finance, t, "dibayar");
};

// Ditanyakan sebagai Finance: posisi kas hanya dijawab untuk pemegang
// angka perusahaan (migrasi 0101).
const saldo = async () =>
  Number((await sebagai(db, finance, "select saldo_kas() as s")).rows[0].s);

const wewenang = async () =>
  (await sebagai(db, finance, "select penyetuju_wajib() as p")).rows[0].p;

uji("seed meninggalkan jejak untuk setiap keputusan", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int as n from transaction_approvals`,
  );
  harus(rows[0].n >= 20, "keputusan data contoh ikut tercatat jejaknya");

  const { rows: nol } = await sebagaiAdmin(
    db,
    `select count(*)::int as n from transaction_approvals where saldo_kas = 0`,
  );
  harusSama(nol[0].n, 0, "posisi kas saat memutuskan ikut direkam");
});

uji("status tidak bisa diubah langsung, harus lewat persetujuan", async () => {
  const t = await ajukan(finance);

  await harusDitolak(
    () =>
      sebagai(db, manager, "update transactions set status = 'disetujui' where id = $1", [
        t,
      ]),
    "menyetel status tanpa jejak",
  );
});

uji("tidak seorang pun memutuskan pengajuannya sendiri", async () => {
  const t = await ajukan(manager, { keterangan: "Pengajuan milik Manager" });

  await harusDitolak(
    () => putuskan(manager, t, "disetujui"),
    "Manager menyetujui pengajuannya sendiri",
  );

  // Orang lain tetap boleh memutuskannya.
  await putuskan(ceo, t, "disetujui");
  harusSama(
    (await sebagaiAdmin(db, "select status from transactions where id = $1", [t]))
      .rows[0].status,
    "disetujui",
    "diputuskan orang lain",
  );
});

uji("Finance tetap boleh membayar pengajuan yang ia tulis sendiri", async () => {
  const t = await ajukan(finance, { keterangan: "Dibayar oleh pengajunya" });
  await putuskan(manager, t, "disetujui");
  await putuskan(finance, t, "dibayar");

  harusSama(
    (await sebagaiAdmin(db, "select status from transactions where id = $1", [t]))
      .rows[0].status,
    "dibayar",
    "membayar bukan menyetujui",
  );
});

uji("penolakan wajib menyebut alasannya", async () => {
  const t = await ajukan(finance, { keterangan: "Akan ditolak" });

  await harusDitolak(
    () => putuskan(manager, t, "ditolak", "tidak"),
    "penolakan tanpa alasan yang berarti",
  );

  await putuskan(manager, t, "ditolak", "Anggarannya sudah habis bulan ini");
  const { rows } = await sebagaiAdmin(
    db,
    "select status, catatan_keputusan from transactions where id = $1",
    [t],
  );
  harusSama(rows[0].status, "ditolak", "ditolak dengan alasan");
  harus(
    rows[0].catatan_keputusan.includes("Anggarannya"),
    "alasannya ikut tersimpan di transaksinya",
  );
});

uji("Staff tidak bisa memutuskan apa pun", async () => {
  const t = await ajukan(finance, { keterangan: "Bukan urusan Staff" });
  await harusDitolak(
    () => putuskan(staf, t, "disetujui"),
    "Staff bukan pemutus",
  );
});

uji("Finance menyetujui? tidak — ia mencatat, bukan memutuskan", async () => {
  const t = await ajukan(manager, { keterangan: "Diputuskan siapa" });
  await harusDitolak(
    () => putuskan(finance, t, "disetujui"),
    "Finance bukan pemberi persetujuan",
  );
});

uji("kas di bawah ambang memindahkan wewenang ke CEO", async () => {
  const awal = await saldo();
  const batas = Number(
    (await sebagaiAdmin(db, "select batas_kas_ceo() as b")).rows[0].b,
  );

  // Turunkan kas sampai sedikit di bawah ambang.
  await geserKas(-(awal - batas + 1_000_000));
  harus(await saldo() < batas, "kas berada di bawah ambang");
  harusSama(await wewenang(), "CEO", "wewenang naik ke CEO");

  const t = await ajukan(finance, { keterangan: "Saat kas menipis", jumlah: 50_000 });
  await harusDitolak(
    () => putuskan(manager, t, "disetujui"),
    "Manager memutuskan saat kas di bawah ambang",
  );

  await putuskan(ceo, t, "disetujui");
  const { rows } = await sebagaiAdmin(
    db,
    `select penyetuju_wajib, saldo_kas from transaction_approvals
     where transaction_id = $1 order by pada desc limit 1`,
    [t],
  );
  harusSama(rows[0].penyetuju_wajib, "CEO", "jejaknya menyebut siapa yang wajib");
  harus(Number(rows[0].saldo_kas) < batas, "kas saat itu ikut direkam");

  // Kembalikan kas supaya test berikutnya berangkat dari keadaan normal.
  await geserKas(awal - (await saldo()));
  harusSama(await saldo(), awal, "kas dikembalikan seperti semula");
});

uji("jejak persetujuan tidak bisa disunting atau dihapus", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select id from transaction_approvals limit 1",
  );

  await harusDitolak(
    () =>
      sebagaiAdmin(db, "update transaction_approvals set catatan = 'diubah' where id = $1", [
        rows[0].id,
      ]),
    "menyunting jejak keputusan",
  );
  await harusDitolak(
    () =>
      sebagaiAdmin(db, "delete from transaction_approvals where id = $1", [rows[0].id]),
    "menghapus jejak keputusan",
  );
});

uji("Staff tidak melihat jejak persetujuan sama sekali", async () => {
  const { rows } = await sebagai(db, staf, "select id from transaction_approvals");
  harusSama(rows.length, 0, "jejak mengikuti cakupan transaksinya");
});

uji("keputusan tidak bisa dicatat atas nama orang lain", async () => {
  const t = await ajukan(finance, { keterangan: "Atas nama siapa" });

  await harusDitolak(
    () =>
      sebagai(
        db,
        manager,
        `insert into transaction_approvals (transaction_id, ke, oleh_id)
         values ($1, 'disetujui', $2)`,
        [t, ceo],
      ),
    "mengatasnamakan CEO",
  );
});

await jalankan();
await db.close();
