/** Tempat mendarat ekspor kv_store lama beserta hitungan per entitasnya. */
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
const { uji, jalankan } = buatSuite("Ekspor kv_store lama");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const muat = async (baris) =>
  sebagaiAdmin(
    db,
    `insert into kv_store_lama (key, value)
     select k, v::jsonb from unnest($1::text[], $2::text[]) as t(k, v)
     on conflict (key) do update set value = excluded.value`,
    [baris.map((b) => b[0]), baris.map((b) => JSON.stringify(b[1]))],
  );

uji("entitas diturunkan dari awalan kuncinya", async () => {
  await muat([
    ["user:1", { nama: "Lama Satu" }],
    ["user:2", { nama: "Lama Dua" }],
    ["account:9", { username: "@lama" }],
  ]);

  const { rows } = await sebagaiAdmin(
    db,
    "select key, entitas from kv_store_lama order by key",
  );
  harusSama(rows.map((r) => r.entitas).join(","), "account,user,user");
});

uji("entitas tidak bisa dipalsukan dari aplikasi", async () => {
  // Kolomnya dihitung database; kalau bisa ditulis, hitungan verifikasi
  // jumlah baris bisa dibuat tampak cocok padahal tidak.
  await harusDitolak(
    () =>
      sebagaiAdmin(db, "update kv_store_lama set entitas = 'goal' where key = 'user:1'"),
    "menulis kolom turunan seharusnya ditolak",
  );
});

uji("ringkasan menghitung per entitas", async () => {
  const { rows } = await sebagaiAdmin(db, "select * from ringkas_kv_lama()");
  const peta = Object.fromEntries(rows.map((r) => [r.entitas, r.jumlah]));
  harusSama(peta.user, 2);
  harusSama(peta.account, 1);
});

uji("memuat ulang kunci yang sama memperbarui, bukan menggandakan", async () => {
  await muat([["user:1", { nama: "Lama Satu Diperbaiki" }]]);
  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int n, max(value->>'nama') nama from kv_store_lama where key = 'user:1'",
  );
  harusSama(rows[0].n, 1);
  harusSama(rows[0].nama, "Lama Satu Diperbaiki");
});

uji("hanya CEO/Manager yang boleh membaca isinya", async () => {
  // Isinya memuat data pribadi seluruh karyawan lama.
  const staf = await id("Nabila Putri");
  const { rows } = await sebagai(db, staf, "select count(*)::int n from kv_store_lama");
  harusSama(Number(rows[0].n), 0);

  const manajer = await id("Farhan Pratama");
  const pengelola = await sebagai(
    db,
    manajer,
    "select count(*)::int n from kv_store_lama",
  );
  harus(Number(pengelola.rows[0].n) > 0, "Manager harus bisa membacanya");
});

uji("Staff tidak bisa memuat data lama", async () => {
  const staf = await id("Nabila Putri");
  await harusDitolak(
    () =>
      sebagai(
        db,
        staf,
        "insert into kv_store_lama (key, value) values ('user:99', '{}'::jsonb)",
      ),
    "pemuatan oleh Staff seharusnya ditolak",
  );
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
