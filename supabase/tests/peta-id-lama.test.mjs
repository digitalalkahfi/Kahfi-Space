/**
 * Peta id lama: penanda yang membuat migrasi aman diulang, dan daftar
 * orang yang belum bisa ditautkan.
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
const { uji, jalankan } = buatSuite("Peta id lama");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  farhan: (await satu(`select id from users where nama='Farhan Pratama'`)).id,
  rian: (await satu(`select id from users where nama='Rian Hidayat'`)).id,
  nabila: (await satu(`select id from users where nama='Nabila Putri'`)).id,
  // Beberapa orang lagi: satu orang V2 hanya boleh menjadi padanan satu
  // orang V1 (0160), jadi tiap pengujian butuh orangnya sendiri.
  dewi: (await satu(`select id from users where nama='Dewi Lestari'`)).id,
  intan: (await satu(`select id from users where nama='Intan Permata'`)).id,
};

uji("catatan lama yang sudah dipetakan bisa dicari kembali", async () => {
  await sebagaiAdmin(
    db,
    `insert into migrasi_peta (kelompok, id_lama, id_baru, tabel)
     values ('users:list', 'usr_003', $1, 'users')`,
    [U.rian],
  );

  harusSama((await satu(`select peta_id('users:list', 'usr_003') id`)).id, U.rian);
  harusSama((await satu(`select peta_id('users:list', 'usr_999') id`)).id, null);
  // Kelompok yang berbeda tidak saling meminjam id.
  harusSama((await satu(`select peta_id('tasks:all', 'usr_003') id`)).id, null);
});

uji("id lama yang sama tidak bisa menunjuk dua baris berbeda", async () => {
  // Inilah yang membuat unggahan berulang tidak menggandakan data.
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into migrasi_peta (kelompok, id_lama, id_baru, tabel)
         values ('users:list', 'usr_003', $1, 'users')`,
        [U.nabila],
      ),
    "id lama kembar seharusnya ditolak",
  );

  // Yang dibolehkan justru memperbarui tujuannya.
  await sebagaiAdmin(
    db,
    `insert into migrasi_peta (kelompok, id_lama, id_baru, tabel)
     values ('users:list', 'usr_003', $1, 'users')
     on conflict (kelompok, id_lama) do update set id_baru = excluded.id_baru`,
    [U.nabila],
  );
  harusSama(
    (await satu(`select peta_id('users:list', 'usr_003') id`)).id,
    U.nabila,
  );
  await sebagaiAdmin(
    db,
    `update migrasi_peta set id_baru = $1 where id_lama = 'usr_003'`,
    [U.rian],
  );
});

uji("orang yang tidak ketemu dikumpulkan, bukan dipaksa masuk", async () => {
  await sebagaiAdmin(
    db,
    `insert into migrasi_orang_pending (id_lama, nama, kemunculan)
     values ('usr_404', 'Entah Siapa', array['tasks:all', 'daily-reports:all'])`,
  );

  harusSama((await satu(`select orang_pending_terbuka() n`)).n, 1);
  // Belum ada keputusan berarti belum ada padanannya.
  harusSama((await satu(`select orang_v1('usr_404') id`)).id, null);
});

uji("keputusan penautan wajib mencatat siapa yang memutuskan", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `update migrasi_orang_pending set user_id = $1 where id_lama = 'usr_404'`,
        [U.dewi],
      ),
    "penautan tanpa pemutus seharusnya ditolak",
  );

  await sebagaiAdmin(
    db,
    `update migrasi_orang_pending
        set user_id = $1, diputuskan_oleh = $2
      where id_lama = 'usr_404'`,
    [U.dewi, U.farhan],
  );

  const b = await satu(
    `select user_id, diputuskan_pada is not null tercatat
       from migrasi_orang_pending where id_lama = 'usr_404'`,
  );
  harusSama(b.user_id, U.dewi);
  harus(b.tercatat, "waktu keputusan harus terisi sendiri");
  // Setelah ditautkan, data lama yang menunjuknya sudah punya jalan.
  harusSama((await satu(`select orang_v1('usr_404') id`)).id, U.dewi);
  harusSama((await satu(`select orang_pending_terbuka() n`)).n, 0);
});

uji("mencabut keputusan ikut melepas jejaknya", async () => {
  // Baris yang tampak sudah diputuskan padahal tidak adalah cara paling
  // rapi kehilangan jejak siapa yang bertanggung jawab.
  await sebagaiAdmin(
    db,
    `update migrasi_orang_pending set user_id = null where id_lama = 'usr_404'`,
  );
  const b = await satu(
    `select diputuskan_oleh, diputuskan_pada from migrasi_orang_pending where id_lama = 'usr_404'`,
  );
  harusSama(b.diputuskan_oleh, null);
  harusSama(b.diputuskan_pada, null);
  harusSama((await satu(`select orang_pending_terbuka() n`)).n, 1);
});

uji("ditautkan dan diabaikan tidak bisa keduanya", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `update migrasi_orang_pending
            set user_id = $1, diabaikan = true, diputuskan_oleh = $2
          where id_lama = 'usr_404'`,
        [U.dewi, U.farhan],
      ),
    "keputusan ganda seharusnya ditolak",
  );
});

uji("orang yang sengaja diabaikan tidak lagi menahan migrasi", async () => {
  await sebagaiAdmin(
    db,
    `update migrasi_orang_pending
        set diabaikan = true, diputuskan_oleh = $1
      where id_lama = 'usr_404'`,
    [U.farhan],
  );
  harusSama((await satu(`select orang_pending_terbuka() n`)).n, 0);
  // Diabaikan bukan ditautkan: penunjuknya tetap kosong, bukan asal isi.
  harusSama((await satu(`select orang_v1('usr_404') id`)).id, null);
});

uji("hanya CEO/Manager yang boleh melihat dan menyunting petanya", async () => {
  const { rows } = await sebagai(
    db,
    U.nabila,
    "select count(*)::int n from migrasi_peta",
  );
  harusSama(Number(rows[0].n), 0);

  await harusDitolak(
    () =>
      sebagai(
        db,
        U.nabila,
        `insert into migrasi_peta (kelompok, id_lama, id_baru, tabel)
         values ('users:list', 'usr_palsu', $1, 'users')`,
        [U.nabila],
      ),
    "penyuntingan peta oleh Staff seharusnya ditolak",
  );
});

uji("satu orang V2 tidak bisa diklaim dua orang V1", async () => {
  // Riwayat kerja dua orang yang menyatu tidak bisa dipisahkan lagi.
  await sebagaiAdmin(
    db,
    `insert into migrasi_orang_pending (id_lama, nama, user_id, diputuskan_oleh)
     values ('usr_a', 'A', $1, $2)`,
    [U.intan, U.farhan],
  );

  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into migrasi_orang_pending (id_lama, nama, user_id, diputuskan_oleh)
         values ('usr_b', 'B', $1, $2)`,
        [U.intan, U.farhan],
      ),
    "tautan ganda seharusnya ditolak",
  );

  await sebagaiAdmin(db, `delete from migrasi_orang_pending where id_lama = 'usr_a'`);
});

uji("orang yang sudah jadi padanan hasil pemetaan tidak bisa ditautkan lagi", async () => {
  // Padanannya bisa datang dari dua tempat; keduanya harus saling tahu.
  await sebagaiAdmin(
    db,
    `insert into migrasi_peta (kelompok, id_lama, id_baru, tabel)
     values ('users:list', 'usr_terpeta', $1, 'users')
     on conflict (kelompok, id_lama) do update set id_baru = excluded.id_baru`,
    [U.nabila],
  );

  await sebagaiAdmin(
    db,
    `insert into migrasi_orang_pending (id_lama, nama) values ('usr_c', 'C')`,
  );
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `update migrasi_orang_pending set user_id = $1, diputuskan_oleh = $2
          where id_lama = 'usr_c'`,
        [U.nabila, U.farhan],
      ),
    "penautan ke orang yang sudah terpetakan seharusnya ditolak",
  );

  // Menautkan id lama yang sama dengan petanya tetap boleh.
  await sebagaiAdmin(
    db,
    `insert into migrasi_orang_pending (id_lama, nama, user_id, diputuskan_oleh)
     values ('usr_terpeta', 'Sama', $1, $2)`,
    [U.nabila, U.farhan],
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
