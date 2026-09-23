/**
 * Unggahan ekspor K-Space lama: satu kunci ekspor = satu baris, kata
 * sandi ditolak, dan golongan kunci sama persis dengan kode aplikasi.
 */
import {
  KUNCI_DIABAIKAN,
  KUNCI_DIKENAL,
  KUNCI_REFERENSI,
  golonganKunci,
} from "@/lib/ekspor-v1";
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
const { uji, jalankan } = buatSuite("Unggahan ekspor lama");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  farhan: (await satu(`select id from users where nama='Farhan Pratama'`)).id,
  nabila: (await satu(`select id from users where nama='Nabila Putri'`)).id,
};

let unggahan;

uji("satu berkas ekspor menjadi satu baris kv_unggahan", async () => {
  const { rows } = await sebagai(
    db,
    U.farhan,
    `insert into kv_unggahan (berkas, meta, jumlah_kunci, jumlah_entri, oleh)
     values ('kspace-lama.json', '{"version":"1.9.2","exportedAt":"2024-10-20"}'::jsonb, 3, 7, $1)
     returning id`,
    [U.farhan],
  );
  unggahan = rows[0].id;
  harus(Boolean(unggahan), "unggahan harus tercatat");

  const b = await satu(
    `select meta->>'version' v, jumlah_entri from kv_unggahan where id = $1`,
    [unggahan],
  );
  // _meta disimpan utuh: angka di layar verifikasi dibandingkan dengannya.
  harusSama(b.v, "1.9.2");
  harusSama(b.jumlah_entri, 7);
});

uji("tiap kunci ekspor menjadi satu baris yang menunjuk berkasnya", async () => {
  await sebagaiAdmin(
    db,
    `insert into kv_store_lama (key, value, unggahan_id) values
       ('users:list', $1::jsonb, $3),
       ('daily-reports:all', $2::jsonb, $3),
       ('attendance:config', '{"jamMasuk":"08:00"}'::jsonb, $3),
       ('img:store', '[{"url":"a"}]'::jsonb, $3)`,
    [
      JSON.stringify([{ id: "u1", name: "Lama Satu" }, { id: "u2" }]),
      JSON.stringify([{ id: "r1" }, { id: "r2" }, { id: "r3" }]),
      unggahan,
    ],
  );

  const { rows } = await sebagaiAdmin(
    db,
    `select kunci, golongan, jumlah from ringkas_kunci_lama()`,
  );
  const peta = Object.fromEntries(rows.map((r) => [r.kunci, r]));
  harusSama(peta["users:list"].jumlah, 2);
  harusSama(peta["daily-reports:all"].jumlah, 3);
  // Kunci yang isinya objek, bukan larik, tetap terhitung satu entri.
  harusSama(peta["attendance:config"].jumlah, 1);
  harusSama(peta["attendance:config"].golongan, "dikenal");
  harusSama(peta["img:store"].golongan, "diabaikan");

  // Yang dipetakan disebut lebih dulu; yang diabaikan paling akhir.
  harusSama(rows[rows.length - 1].kunci, "img:store");
});

uji("mengunggah ulang kunci yang sama memperbarui, bukan menggandakan", async () => {
  await sebagaiAdmin(
    db,
    `insert into kv_store_lama (key, value, unggahan_id) values ('users:list', $1::jsonb, $2)
     on conflict (key) do update set value = excluded.value, unggahan_id = excluded.unggahan_id`,
    [JSON.stringify([{ id: "u1" }, { id: "u2" }, { id: "u3" }]), unggahan],
  );
  const b = await satu(
    `select count(*)::int n, max(jsonb_array_length(value)) isi
     from kv_store_lama where key = 'users:list'`,
  );
  harusSama(b.n, 1);
  harusSama(b.isi, 3);
});

uji("kata sandi ditolak, sedalam apa pun letaknya", async () => {
  for (const nilai of [
    `[{"id":"u1","passwordHash":"abc"}]`,
    `[{"id":"u1","password":"rahasia"}]`,
    `[{"id":"u1","salt":"xyz"}]`,
    `[{"id":"u1","confirmPassword":"rahasia"}]`,
    `{"data":{"users":[{"password_hash":"abc"}]}}`,
  ]) {
    await harusDitolak(
      () =>
        sebagaiAdmin(
          db,
          `insert into kv_store_lama (key, value) values ('uji:kredensial', $1::jsonb)`,
          [nilai],
        ),
      `kredensial pada ${nilai.slice(0, 40)} seharusnya ditolak`,
    );
  }

  // Yang sudah bersih tetap boleh masuk.
  await sebagaiAdmin(
    db,
    `insert into kv_store_lama (key, value) values ('uji:bersih', '[{"id":"u1","name":"Lama"}]'::jsonb)`,
  );
  harusSama(
    (await satu(`select count(*)::int n from kv_store_lama where key='uji:bersih'`)).n,
    1,
  );
  await sebagaiAdmin(db, `delete from kv_store_lama where key='uji:bersih'`);
});

uji("kata sandi juga ditolak saat baris lama disunting", async () => {
  // Penjagaan yang hanya berlaku saat insert bisa dilewati dengan sekali
  // update; ekspor lama terlalu besar untuk diperiksa manual.
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `update kv_store_lama set value = '[{"password":"rahasia"}]'::jsonb where key = 'users:list'`,
      ),
    "menyunting baris menjadi berisi kata sandi seharusnya ditolak",
  );
});

uji("golongan kunci di database sama dengan di kode aplikasi", async () => {
  const daftar = [
    ...KUNCI_DIKENAL.map((k) => k.kunci),
    ...KUNCI_REFERENSI,
    ...KUNCI_DIABAIKAN,
    "sellers:all",
    "problems:all",
    "",
  ];

  const { rows } = await sebagaiAdmin(
    db,
    `select k, golongan_kunci(k) g from unnest($1::text[]) as t(k)`,
    [daftar],
  );

  for (const r of rows) {
    harusSama(
      r.g,
      golonganKunci(r.k),
      `golongan '${r.k}' berbeda antara SQL dan kode aplikasi`,
    );
  }
});

uji("hanya CEO/Manager yang boleh membaca dan menulis unggahan", async () => {
  // Isinya memuat data pribadi seluruh karyawan lama.
  const { rows } = await sebagai(
    db,
    U.nabila,
    "select count(*)::int n from kv_unggahan",
  );
  harusSama(Number(rows[0].n), 0);

  await harusDitolak(
    () =>
      sebagai(
        db,
        U.nabila,
        `insert into kv_unggahan (berkas) values ('curian.json')`,
      ),
    "unggahan oleh Staff seharusnya ditolak",
  );
});

uji("menghapus catatan unggahan tidak ikut membuang datanya", async () => {
  // Bahan mentahnya yang menentukan hasil pemetaan; kehilangan karena
  // catatan berkasnya dirapikan adalah kehilangan yang tidak disadari.
  await sebagaiAdmin(db, `delete from kv_unggahan where id = $1`, [unggahan]);
  const b = await satu(
    `select count(*)::int n, count(unggahan_id)::int tertaut from kv_store_lama`,
  );
  harus(b.n >= 4, "baris ekspor harus tetap ada");
  harusSama(b.tertaut, 0);
});

uji("medan yang hanya mirip kata sandi tetap boleh masuk", async () => {
  // Penjagaan yang terlalu longgar menolak data yang sah, dan orang
  // akhirnya menyunting ekspornya manual — persis yang mau dihindari.
  await sebagaiAdmin(
    db,
    `insert into kv_store_lama (key, value) values
       ('uji:mirip', '{"passwordPolicy":{"minLength":8},"salted":true}'::jsonb)`,
  );
  harusSama(
    (await satu(`select count(*)::int n from kv_store_lama where key='uji:mirip'`)).n,
    1,
  );
  await sebagaiAdmin(db, `delete from kv_store_lama where key='uji:mirip'`);
});

uji("punya_kredensial menjawab benar untuk nilai yang bukan objek", async () => {
  const b = await satu(`
    select punya_kredensial('[]'::jsonb) kosong,
           punya_kredensial('"teks"'::jsonb) teks,
           punya_kredensial('null'::jsonb) nol,
           punya_kredensial('[[{"salt":"x"}]]'::jsonb) bersarang
  `);
  harusSama(b.kosong, false);
  harusSama(b.teks, false);
  harusSama(b.nol, false);
  // Larik di dalam larik tetap tertelusuri.
  harusSama(b.bersarang, true);
});

uji("Finance pun tidak boleh membaca ekspor lama", async () => {
  // Finance melihat angka lintas unit, tetapi ekspor lama memuat data
  // pribadi seluruh karyawan — itu wewenang CEO/Manager saja.
  const finance = (
    await satu(`select id from users where role = 'Finance' limit 1`)
  ).id;
  const { rows } = await sebagai(
    db,
    finance,
    "select count(*)::int n from kv_store_lama",
  );
  harusSama(Number(rows[0].n), 0);
});

uji("golongan kunci tahan terhadap kunci kosong dan null", async () => {
  const b = await satu(`
    select golongan_kunci('') kosong, golongan_kunci(null) nol
  `);
  harusSama(b.kosong, "asing");
  // Kunci null tidak mungkin ada (primary key), tetapi fungsinya ikut
  // dipakai di kueri layar. Jawabannya 'asing', bukan null yang menular
  // ke mana-mana dan membuat baris menghilang dari penyaringan.
  harusSama(b.nol, "asing");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
