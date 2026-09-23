/** Preferensi tampilan: milik sendiri, bentuknya dijaga, bawaan = tanpa baris. */
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
const { uji, jalankan } = buatSuite("Preferensi tampilan");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

uji("tanpa baris berarti ikut bawaan", async () => {
  // Bawaan tidak disalin ke tabel saat pengguna dibuat: kalau disalin,
  // menu yang lahir nanti tidak akan pernah sampai ke orang lama.
  const staf = await id("Nabila Putri");
  const { rows } = await sebagai(
    db,
    staf,
    "select count(*)::int n from preferensi_tampilan",
  );
  harusSama(Number(rows[0].n), 0);
});

uji("pengguna menyimpan susunannya sendiri", async () => {
  const staf = await id("Nabila Putri");
  await sebagai(
    db,
    staf,
    `insert into preferensi_tampilan (pengguna_id, permukaan, kunci_item, tampil, urutan)
     values ($1, 'sidebar', '/beranda', true, 0),
            ($1, 'sidebar', '/absensi', false, 1)`,
    [staf],
  );
  const { rows } = await sebagai(
    db,
    staf,
    "select kunci_item, tampil from preferensi_tampilan where permukaan = 'sidebar' order by urutan",
    [],
  );
  harusSama(rows.length, 2);
  harusSama(rows[1].tampil, false);
});

uji("menyimpan atas nama orang lain ditolak", async () => {
  const staf = await id("Nabila Putri");
  const lain = await id("Yoga Saputra");
  await harusDitolak(
    () =>
      sebagai(
        db,
        staf,
        `insert into preferensi_tampilan (pengguna_id, permukaan, kunci_item, urutan)
         values ($1, 'dock', '/absensi', 0)`,
        [lain],
      ),
    "menulis preferensi orang lain seharusnya ditolak",
  );
});

uji("susunan orang lain tidak terbaca, bahkan oleh CEO", async () => {
  // Menu orang lain bukan informasi yang perlu dibaca siapa pun.
  const ceo = await id("Farhan Pratama");
  const { rows } = await sebagai(
    db,
    ceo,
    "select count(*)::int n from preferensi_tampilan",
  );
  harusSama(Number(rows[0].n), 0);
});

uji("permukaan di luar empat yang dikenal ditolak", async () => {
  const staf = await id("Nabila Putri");
  await harusDitolak(
    () =>
      sebagai(
        db,
        staf,
        `insert into preferensi_tampilan (pengguna_id, permukaan, kunci_item, urutan)
         values ($1, 'footer', '/absensi', 0)`,
        [staf],
      ),
    "permukaan karangan seharusnya ditolak",
  );
});

uji("kunci kosong dan urutan di luar akal ditolak", async () => {
  const staf = await id("Nabila Putri");
  for (const [kunci, urutan, kenapa] of [
    ["   ", 0, "kunci kosong"],
    ["/absensi", 5000, "urutan raksasa"],
    ["/absensi", -1, "urutan negatif"],
  ]) {
    await harusDitolak(
      () =>
        sebagai(
          db,
          staf,
          `insert into preferensi_tampilan (pengguna_id, permukaan, kunci_item, urutan)
           values ($1, 'beranda', $2, $3)`,
          [staf, kunci, urutan],
        ),
      `${kenapa} seharusnya ditolak`,
    );
  }
});

uji("satu item tidak bisa tercatat dua kali di permukaan yang sama", async () => {
  const staf = await id("Nabila Putri");
  await harusDitolak(
    () =>
      sebagai(
        db,
        staf,
        `insert into preferensi_tampilan (pengguna_id, permukaan, kunci_item, urutan)
         values ($1, 'sidebar', '/absensi', 7)`,
        [staf],
      ),
    "kunci ganda di satu permukaan seharusnya ditolak",
  );
});

uji("item yang sama boleh ada di permukaan berbeda", async () => {
  // /kalender hidup di dock DAN di pintasan atas; keduanya sah.
  const staf = await id("Nabila Putri");
  await sebagai(
    db,
    staf,
    `insert into preferensi_tampilan (pengguna_id, permukaan, kunci_item, urutan)
     values ($1, 'dock', '/kalender', 3), ($1, 'pintasan', '/kalender', 0)`,
    [staf],
  );
  const { rows } = await sebagai(
    db,
    staf,
    "select count(*)::int n from preferensi_tampilan where kunci_item = '/kalender'",
  );
  harusSama(Number(rows[0].n), 2);
});

uji("menghapus barisnya mengembalikan ke bawaan", async () => {
  const staf = await id("Nabila Putri");
  await sebagai(
    db,
    staf,
    "delete from preferensi_tampilan where pengguna_id = $1",
    [staf],
  );
  const { rows } = await sebagai(
    db,
    staf,
    "select count(*)::int n from preferensi_tampilan",
  );
  harusSama(Number(rows[0].n), 0);
});

uji("waktu ubah dicatat sendiri, bukan dititipkan pengirimnya", async () => {
  const staf = await id("Nabila Putri");
  await sebagai(
    db,
    staf,
    `insert into preferensi_tampilan (pengguna_id, permukaan, kunci_item, urutan, updated_at)
     values ($1, 'beranda', 'wrm', 0, '2001-01-01T00:00:00Z')`,
    [staf],
  );
  const { rows } = await sebagaiAdmin(
    db,
    "select updated_at from preferensi_tampilan where kunci_item = 'wrm'",
  );
  harus(
    new Date(rows[0].updated_at).getUTCFullYear() > 2001,
    "waktu titipan seharusnya ditimpa",
  );
  await terapkanSeed(db);
});

uji("mengembalikan ke bawaan tidak menyentuh susunan orang lain", async () => {
  // "Kembalikan ke bawaan" adalah penghapusan; tanpa pagar ini, satu
  // klik bisa menghapus tata letak seisi kantor.
  const staf = await id("Nabila Putri");
  const lain = await id("Yoga Saputra");

  for (const orang of [staf, lain]) {
    await sebagaiAdmin(
      db,
      `insert into preferensi_tampilan (pengguna_id, permukaan, kunci_item, urutan)
       values ($1, 'sidebar', '/absensi', 0)`,
      [orang],
    );
  }

  // Penghapusan tanpa penyaring pun hanya mengenai barisnya sendiri:
  // policy-nya yang membatasi, bukan klausa WHERE pemanggilnya.
  await sebagai(db, staf, "delete from preferensi_tampilan");

  const { rows } = await sebagaiAdmin(
    db,
    "select pengguna_id from preferensi_tampilan",
  );
  harusSama(rows.length, 1);
  harusSama(rows[0].pengguna_id, lain);
  await terapkanSeed(db);
});

uji("urutan tersimpan dan terbaca kembali apa adanya", async () => {
  // Urutan tidak punya tabel sendiri: ia kolom pada baris yang sama
  // dengan centangnya. Memisahkannya berarti dua tabel yang harus
  // selalu sepakat soal item apa saja yang ada — dan yang harus
  // sepakat pasti suatu hari tidak sepakat.
  const staf = await id("Nabila Putri");
  const urut = ["/grd", "/beranda", "/absensi"];

  await sebagai(
    db,
    staf,
    `insert into preferensi_tampilan (pengguna_id, permukaan, kunci_item, tampil, urutan)
     select $1, 'dock', kunci, true, urutan
       from unnest($2::text[]) with ordinality as t(kunci, urutan)`,
    [staf, urut],
  );

  const { rows } = await sebagai(
    db,
    staf,
    "select kunci_item from preferensi_tampilan where permukaan = 'dock' order by urutan",
  );
  harusSama(
    rows.map((r) => r.kunci_item).join(","),
    urut.join(","),
    "urutan simpan harus sama dengan urutan baca",
  );
});

uji("mengganti susunan berarti mengganti seluruh daftarnya", async () => {
  // Inilah kenapa `urutan` tidak diberi kunci unik: penyimpanan
  // dilakukan hapus-lalu-sisip, dan kunci unik membuat keadaan antara
  // melanggar batasannya sendiri.
  const staf = await id("Nabila Putri");
  await sebagai(
    db,
    staf,
    "delete from preferensi_tampilan where permukaan = 'dock'",
  );
  await sebagai(
    db,
    staf,
    `insert into preferensi_tampilan (pengguna_id, permukaan, kunci_item, tampil, urutan)
     values ($1, 'dock', '/absensi', true, 0), ($1, 'dock', '/grd', false, 1)`,
    [staf],
  );

  const { rows } = await sebagai(
    db,
    staf,
    "select kunci_item, tampil from preferensi_tampilan where permukaan = 'dock' order by urutan",
  );
  harusSama(rows.length, 2);
  harusSama(rows[0].kunci_item, "/absensi");
  harusSama(rows[1].tampil, false);
  await terapkanSeed(db);
});

uji("RPC mengganti seluruh susunan dalam satu langkah", async () => {
  const staf = await id("Nabila Putri");
  await sebagai(
    db,
    staf,
    `select simpan_susunan_tampilan('dock'::permukaan_tampilan,
       '[{"kunci":"/grd","tampil":true},{"kunci":"/absensi","tampil":false}]'::jsonb)`,
  );
  const awal = await sebagai(
    db,
    staf,
    "select kunci_item, tampil, urutan from preferensi_tampilan where permukaan = 'dock' order by urutan",
  );
  harusSama(awal.rows.map((r) => r.kunci_item).join(","), "/grd,/absensi");
  harusSama(awal.rows[0].urutan, 0, "urutan mulai dari nol");
  harusSama(awal.rows[1].tampil, false);

  // Panggilan kedua mengganti, bukan menumpuk.
  await sebagai(
    db,
    staf,
    `select simpan_susunan_tampilan('dock'::permukaan_tampilan,
       '[{"kunci":"/tugas","tampil":true}]'::jsonb)`,
  );
  const { rows } = await sebagai(
    db,
    staf,
    "select kunci_item from preferensi_tampilan where permukaan = 'dock'",
  );
  harusSama(rows.length, 1);
  harusSama(rows[0].kunci_item, "/tugas");
});

uji("RPC tidak bisa menulis untuk orang lain", async () => {
  // Pemiliknya diambil dari auth.uid(), bukan dari parameter — jadi
  // tidak ada kolom yang bisa dipalsukan pemanggil.
  const staf = await id("Nabila Putri");
  const lain = await id("Yoga Saputra");
  const hitung = async (orang) =>
    Number(
      (
        await sebagaiAdmin(
          db,
          "select count(*)::int n from preferensi_tampilan where pengguna_id = $1",
          [orang],
        )
      ).rows[0].n,
    );

  const sebelum = await hitung(lain);
  await sebagai(
    db,
    staf,
    `select simpan_susunan_tampilan('pintasan'::permukaan_tampilan,
       '[{"kunci":"/kalender","tampil":true}]'::jsonb)`,
  );

  harusSama(await hitung(lain), sebelum, "baris orang lain tidak tersentuh");
  harus(
    (await hitung(staf)) > 0,
    "baris pemanggil sendiri yang bertambah",
  );
});

uji("RPC menolak daftar yang bukan array", async () => {
  const staf = await id("Nabila Putri");
  await harusDitolak(
    () =>
      sebagai(
        db,
        staf,
        `select simpan_susunan_tampilan('dock'::permukaan_tampilan, '{"bukan":"array"}'::jsonb)`,
      ),
    "isi selain array seharusnya ditolak",
  );
});

uji("RPC menolak penyimpanan tanpa sesi", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `select simpan_susunan_tampilan('dock'::permukaan_tampilan, '[]'::jsonb)`,
      ),
    "tanpa auth.uid() seharusnya ditolak",
  );
  await terapkanSeed(db);
});

// Cascade `on delete cascade` pada `pengguna_id` sengaja tidak diuji:
// migrasi 0071 melarang penghapusan anggota sama sekali (mereka
// dinonaktifkan, bukan dihapus), jadi jalur itu tidak pernah terpicu.
// FK-nya tetap ada sebagai pengaman kalau aturan itu berubah.

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
