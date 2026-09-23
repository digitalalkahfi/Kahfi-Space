/**
 * Kata sandi tidak boleh mendarat di basis data baru.
 *
 * Ekspor K-Space lama memuat hash kata sandi seluruh karyawan. Aplikasi
 * membuangnya sebelum mengirim (`buangKredensial`), tetapi penjagaan
 * yang hanya ada di aplikasi bisa dilewati jalur lain — SQL Editor,
 * skrip, atau versi aplikasi yang lebih tua. Berkas ini menguji
 * penjagaan terakhirnya.
 */
import { MEDAN_KREDENSIAL, buangKredensial } from "@/lib/ekspor-v1";
import {
  buatDb,
  buatSuite,
  harus,
  harusDitolak,
  harusSama,
  muatEkspor,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Kredensial ekspor lama");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

uji("setiap medan kredensial yang dikenali aplikasi juga ditolak database", async () => {
  // Kedua daftar harus sama. Kalau aplikasi mengenali satu ejaan yang
  // tidak dikenali database, ejaan itu akan lolos lewat jalur lain.
  for (const medan of MEDAN_KREDENSIAL) {
    const nilai = JSON.stringify([{ id: "u1", [medan]: "rahasia" }]);
    await harusDitolak(
      () =>
        sebagaiAdmin(
          db,
          `insert into kv_store_lama (key, value) values ($1, $2::jsonb)`,
          [`uji:${medan}`, nilai],
        ),
      `medan ${medan} seharusnya ditolak database`,
    );
  }
});

uji("hasil buangKredensial selalu lolos penjagaan database", async () => {
  // Inilah yang membuat unggahan berkas nyata tetap bisa masuk: yang
  // sudah dibersihkan aplikasi tidak boleh ditolak lagi di sini.
  const kotor = {
    users: [
      { id: "u1", name: "A", passwordHash: "x", salt: "y" },
      { id: "u2", profil: { password: "z", telepon: "08" } },
    ],
    confirmPassword: "z",
  };

  const bersih = buangKredensial(kotor);
  await sebagaiAdmin(
    db,
    `insert into kv_store_lama (key, value) values ('uji:bersih', $1::jsonb)
     on conflict (key) do update set value = excluded.value`,
    [JSON.stringify(bersih)],
  );

  const b = await satu(
    `select punya_kredensial(value) ada, jsonb_array_length(value->'users') n
       from kv_store_lama where key = 'uji:bersih'`,
  );
  harusSama(b.ada, false);
  // Yang bukan kredensial tetap utuh: pembersihan tidak boleh ikut
  // membuang data yang justru harus pindah.
  harusSama(b.n, 2);
  harusSama(
    (await satu(
      `select value->'users'->1->'profil'->>'telepon' t from kv_store_lama where key='uji:bersih'`,
    )).t,
    "08",
  );

  await sebagaiAdmin(db, `delete from kv_store_lama where key = 'uji:bersih'`);
});

uji("penjagaannya juga berlaku pada nilai bersarang dalam-dalam", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into kv_store_lama (key, value) values
          ('uji:dalam', '{"a":{"b":{"c":[{"d":{"passwordHash":"x"}}]}}}'::jsonb)`,
      ),
    "kredensial bersarang seharusnya tetap tertangkap",
  );
});

uji("nilai mirip kredensial yang bukan kata sandi tetap boleh", async () => {
  await sebagaiAdmin(
    db,
    `insert into kv_store_lama (key, value) values
      ('uji:mirip2', '[{"passwordPolicy":{"minLength":8},"salted":true,"catatan":"password diganti berkala"}]'::jsonb)`,
  );
  harus(
    (await satu(`select count(*)::int n from kv_store_lama where key='uji:mirip2'`)).n === 1,
    "medan mirip seharusnya tetap masuk",
  );
  await sebagaiAdmin(db, `delete from kv_store_lama where key='uji:mirip2'`);
});

uji("kredensial ditolak lewat jalur muat massal, bukan hanya insert tunggal", async () => {
  // Ekspor sungguhan dimuat sekaligus; penjagaan yang hanya berlaku pada
  // insert satu-satu akan dilewati begitu saja.
  let ditolak = false;
  try {
    await muatEkspor(db, {
      "users:list": [{ id: "u1", passwordHash: "abc" }],
    });
  } catch {
    ditolak = true;
  }
  harus(ditolak, "muat massal berisi kredensial seharusnya ditolak");
});

uji("satu baris berkredensial menggagalkan seluruh muatannya", async () => {
  // Kalau hanya baris itu yang gagal, sisanya masuk dan orang mengira
  // ekspornya sudah lengkap.
  await sebagaiAdmin(db, `delete from kv_store_lama where key like 'uji:%'`);

  let ditolak = false;
  try {
    await muatEkspor(db, {
      "uji:bersih1": [{ id: "a" }],
      "uji:kotor": [{ id: "b", salt: "x" }],
      "uji:bersih2": [{ id: "c" }],
    });
  } catch {
    ditolak = true;
  }
  harus(ditolak, "muatan campuran seharusnya ditolak");
  harusSama(
    (await satu(`select count(*)::int n from kv_store_lama where key like 'uji:bersih%'`)).n,
    0,
  );
});

uji("kredensial di dalam larik bersarang tetap tertangkap", async () => {
  let ditolak = false;
  try {
    await muatEkspor(db, {
      "uji:bersarang": { tim: [{ anggota: [{ password: "rahasia" }] }] },
    });
  } catch {
    ditolak = true;
  }
  harus(ditolak, "kredensial dalam larik bersarang seharusnya tertangkap");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
