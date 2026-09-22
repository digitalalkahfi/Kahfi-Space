/**
 * Otorisasi modul Kaizen per peran.
 *
 * Melaporkan sengaja terbuka untuk semua orang — masalah yang paling
 * dekat dengan pekerjaan harian justru tidak akan pernah sampai ke
 * permukaan kalau pelapornya disaring. Yang dibatasi adalah keputusan:
 * status, solusi, dan penutupan.
 */
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
const { uji, jalankan } = buatSuite("Otorisasi Kaizen");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const unitId = async (kode) =>
  (await sebagaiAdmin(db, "select id from units where kode = $1", [kode]))
    .rows[0].id;

const laporanStaf = async () =>
  (
    await sebagaiAdmin(
      db,
      "select id, status, solusi from problems where judul = 'Laporan staf'",
    )
  ).rows[0];

uji("siapa pun yang masuk boleh melaporkan masalah", async () => {
  const staf = await id("Nabila Putri");
  await sebagai(
    db,
    staf,
    `insert into problems (judul, konteks, unit_id, dilaporkan_oleh)
     values ('Laporan staf', 'konteks', $1, $2)`,
    [await unitId("affiliator"), staf],
  );
  harusSama(
    Number(
      (
        await sebagaiAdmin(
          db,
          "select count(*)::int n from problems where judul = 'Laporan staf'",
        )
      ).rows[0].n,
    ),
    1,
  );
});

uji("melapor atas nama orang lain ditolak", async () => {
  const staf = await id("Nabila Putri");
  const lain = await id("Anisa Larasati");
  await harusDitolak(
    async () =>
      sebagai(
        db,
        staf,
        `insert into problems (judul, konteks, unit_id, dilaporkan_oleh)
         values ('Atas nama orang lain', 'konteks', $1, $2)`,
        [await unitId("affiliator"), lain],
      ),
    "laporan atas nama orang lain seharusnya ditolak",
  );
});

uji("pelapor tetap melihat masalahnya walau di luar unitnya", async () => {
  const staf = await id("Yoga Saputra"); // Staff TAP
  const masalah = (
    await sebagai(
      db,
      staf,
      `insert into problems (judul, konteks, unit_id, dilaporkan_oleh)
       values ('Lintas unit', 'konteks', $1, $2) returning id`,
      [await unitId("affiliator"), staf],
    )
  ).rows[0].id;

  const { rows } = await sebagai(
    db,
    staf,
    "select count(*)::int n from problems where id = $1",
    [masalah],
  );
  harusSama(Number(rows[0].n), 1);
});

uji("Staff unit lain tidak melihat masalah yang bukan urusannya", async () => {
  const luar = await id("Yoga Saputra");
  const { rows } = await sebagai(
    db,
    luar,
    `select count(*)::int n from problems p
       join units u on u.id = p.unit_id
      where u.kode = 'affiliator' and p.dilaporkan_oleh <> $1`,
    [luar],
  );
  harusSama(Number(rows[0].n), 0);
});

uji("Staff tidak bisa mengubah status masalah", async () => {
  const staf = await id("Nabila Putri");
  const sebelum = await laporanStaf();

  await sebagai(
    db,
    staf,
    "update problems set status = 'selesai' where id = $1",
    [sebelum.id],
  );

  harusSama(
    (await laporanStaf()).status,
    sebelum.status,
    "status tidak boleh tersentuh Staff",
  );
});

uji("Staff tidak bisa menulis solusi, bahkan untuk laporannya sendiri", async () => {
  // Solusi adalah keputusan, bukan keterangan; pelapor yang boleh
  // menuliskannya sendiri membuat papan ini tidak berarti apa-apa.
  const staf = await id("Nabila Putri");
  const sebelum = await laporanStaf();

  await sebagai(
    db,
    staf,
    "update problems set solusi = 'Sudah saya beresi sendiri' where id = $1",
    [sebelum.id],
  );

  harusSama((await laporanStaf()).solusi, sebelum.solusi);
});

uji("Leader pun tidak memutuskan status masalah unitnya", async () => {
  const leader = await id("Dewi Lestari");
  const sebelum = await laporanStaf();

  await sebagai(
    db,
    leader,
    "update problems set status = 'ditutup' where id = $1",
    [sebelum.id],
  );

  harusSama((await laporanStaf()).status, sebelum.status);
});

uji("Manager menulis solusi dan menandainya selesai", async () => {
  const manajer = await id("Farhan Pratama");
  const laporan = await laporanStaf();

  await sebagai(
    db,
    manajer,
    `update problems
        set solusi = 'Prosedur penerimaan barang ditulis ulang dan ditempel di gudang.',
            status = 'selesai'
      where id = $1`,
    [laporan.id],
  );

  const sesudah = await laporanStaf();
  harusSama(sesudah.status, "selesai");
  harus(sesudah.solusi.length > 10, "solusi dari manajer harus tersimpan");
});

uji("Manager tidak bisa menandai selesai tanpa menulis solusi", async () => {
  // Aturannya sama untuk semua peran: yang dijaga isinya, bukan orangnya.
  const manajer = await id("Farhan Pratama");
  const masalah = (
    await sebagaiAdmin(
      db,
      `insert into problems (judul, konteks, unit_id, status)
       values ('Tanpa solusi', 'konteks',
               (select id from units where kode = 'tap'), 'diproses')
       returning id`,
    )
  ).rows[0].id;

  await harusDitolak(
    () =>
      sebagai(db, manajer, "update problems set status = 'selesai' where id = $1", [
        masalah,
      ]),
    "selesai tanpa solusi seharusnya ditolak untuk siapa pun",
  );
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
