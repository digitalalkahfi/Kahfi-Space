/** Tabel referensi batas minimum per level dan fungsi pembacanya. */
import {
  BATAS_MINIMUM_LEVEL,
  batasMinimum,
  LEVEL_MAKS,
  LEVEL_MIN,
} from "@/lib/batas-minimum";
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
const { uji, jalankan } = buatSuite("Batas minimum level");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  rian: (await satu(`select id from users where nama='Rian Hidayat'`)).id,
  farhan: (await satu(`select id from users where nama='Farhan Pratama'`)).id,
};

uji("sembilan level terisi dengan deret yang ditetapkan", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select level, minimum_unggahan from batas_minimum_level order by level`,
  );
  harusSama(
    rows.map((r) => r.minimum_unggahan),
    [3, 5, 7, 10, 10, 12, 15, 20, 20],
  );
});

uji("deret di database sama dengan deret di kode aplikasi", async () => {
  // Dua tempat, satu deret angka. Kalau suatu saat berbeda, tes inilah
  // yang gagal — bukan rekap bulanan yang diam-diam salah.
  const { rows } = await sebagaiAdmin(
    db,
    `select minimum_unggahan from batas_minimum_level order by level`,
  );
  harusSama(
    rows.map((r) => r.minimum_unggahan),
    [...BATAS_MINIMUM_LEVEL],
  );
});

uji("batas_minimum() dan batasMinimum() menjawab sama persis", async () => {
  // Bukan hanya deretnya yang harus sama, tapi juga fungsinya: yang
  // dipakai layar adalah fungsi TS, yang dipakai rekap massal adalah
  // fungsi SQL, dan keduanya menjawab pertanyaan yang sama.
  for (let level = LEVEL_MIN; level <= LEVEL_MAKS; level += 1) {
    const dariSql = await satu(`select batas_minimum($1::smallint) as b`, [
      level,
    ]);
    harusSama(dariSql.b, batasMinimum(level), `level ${level}`);
  }
});

uji("keduanya juga sepakat soal level yang tidak dikenal", async () => {
  // null di SQL dan null di TS; bukan nol, dan bukan galat.
  const kosong = await satu(`select batas_minimum(null::smallint) as b`);
  harusSama(kosong.b, batasMinimum(null));

  for (const level of [-1, 9, 42]) {
    const dariSql = await satu(`select batas_minimum($1::smallint) as b`, [
      level,
    ]);
    harusSama(dariSql.b, null, `level ${level} di SQL`);
    harusSama(batasMinimum(level), null, `level ${level} di kode`);
  }
});

uji("level di luar 0-8 ditolak", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into batas_minimum_level (level, minimum_unggahan) values (9, 25)`,
      ),
    "level 9 seharusnya ditolak",
  );
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into batas_minimum_level (level, minimum_unggahan) values (-1, 2)`,
      ),
    "level negatif seharusnya ditolak",
  );
});

uji("minimum nol atau negatif ditolak", async () => {
  // Batas minimum nol berarti tidak ada standar sama sekali; itu bukan
  // keadaan yang pernah dimaksud.
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `update batas_minimum_level set minimum_unggahan = 0 where level = 3`,
      ),
    "minimum nol seharusnya ditolak",
  );
});

uji("fungsi batas_minimum membaca tabelnya", async () => {
  harusSama((await satu(`select batas_minimum(0::smallint) as n`)).n, 3);
  harusSama((await satu(`select batas_minimum(4::smallint) as n`)).n, 10);
  harusSama((await satu(`select batas_minimum(8::smallint) as n`)).n, 20);
});

uji("level yang tidak dikenal menghasilkan null, bukan nol", async () => {
  harusSama((await satu(`select batas_minimum(9::smallint) as n`)).n, null);
  harusSama((await satu(`select batas_minimum(null::smallint) as n`)).n, null);
});

uji("semua yang sudah masuk boleh membaca acuannya", async () => {
  const { rows } = await sebagai(
    db,
    U.rian,
    `select count(*)::int as n from batas_minimum_level`,
  );
  harusSama(rows[0].n, 9, "Staff pun perlu tahu standarnya sendiri");
});

uji("hanya manajemen yang boleh mengubah acuannya", async () => {
  const { rows } = await sebagai(
    db,
    U.rian,
    `update batas_minimum_level set minimum_unggahan = 99 where level = 0`,
  );
  harusSama(
    (
      await satu(
        `select minimum_unggahan as n from batas_minimum_level where level=0`,
      )
    ).n,
    3,
    "perubahan oleh Staff tidak boleh berlaku",
  );
  harus((rows ?? []).length === 0);

  await sebagai(
    db,
    U.farhan,
    `update batas_minimum_level set minimum_unggahan = 4 where level = 0`,
  );
  harusSama(
    (
      await satu(
        `select minimum_unggahan as n from batas_minimum_level where level=0`,
      )
    ).n,
    4,
    "Manager boleh menyesuaikan standar",
  );
  await sebagaiAdmin(
    db,
    `update batas_minimum_level set minimum_unggahan = 3 where level = 0`,
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
