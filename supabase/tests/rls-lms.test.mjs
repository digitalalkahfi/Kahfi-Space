/**
 * Otorisasi LMS: materi terbuka, kunci jawaban tidak.
 *
 * Kursus dan modulnya sengaja terbaca semua orang yang sudah masuk —
 * pelatihan yang harus dicari izinnya dulu tidak akan pernah diikuti.
 * Yang dijaga adalah kunci jawaban, catatan belajar orang lain, dan hak
 * menyusun materinya.
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
const { uji, jalankan } = buatSuite("Otorisasi LMS");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

uji("materi kursus terbuka untuk semua yang sudah masuk", async () => {
  const staf = await id("Nabila Putri");
  const kursus = await sebagai(db, staf, "select count(*)::int n from courses");
  const modul = await sebagai(db, staf, "select count(*)::int n from course_modules");
  harus(Number(kursus.rows[0].n) > 0, "katalog kursus harus terbaca");
  harus(Number(modul.rows[0].n) > 0, "modulnya harus ikut terbaca");
});

uji("kunci jawaban tidak terbaca siapa pun selain pengelola", async () => {
  // Inilah sebab kuncinya ditaruh di tabel sendiri: RLS bekerja per
  // baris, bukan per kolom.
  for (const nama of ["Nabila Putri", "Dewi Lestari", "Laras Ayuningtyas"]) {
    const { rows } = await sebagai(
      db,
      await id(nama),
      "select count(*)::int n from quiz_keys",
    );
    harusSama(Number(rows[0].n), 0, `kunci jawaban tidak boleh terbaca ${nama}`);
  }

  const manajer = await sebagai(
    db,
    await id("Farhan Pratama"),
    "select count(*)::int n from quiz_keys",
  );
  harus(Number(manajer.rows[0].n) > 0, "pengelola tetap bisa menyusunnya");
});

uji("Staff tidak bisa menyusun kursus atau modul", async () => {
  const staf = await id("Nabila Putri");
  await harusDitolak(
    () =>
      sebagai(
        db,
        staf,
        "insert into courses (judul, ringkasan) values ('Kursus karangan', '')",
      ),
    "penyusunan kursus oleh Staff seharusnya ditolak",
  );

  const kursus = (await sebagaiAdmin(db, "select id from courses limit 1")).rows[0].id;
  await harusDitolak(
    () =>
      sebagai(
        db,
        staf,
        "insert into course_modules (course_id, urutan, judul) values ($1, 99, 'Modul karangan')",
        [kursus],
      ),
    "penyusunan modul oleh Staff seharusnya ditolak",
  );
});

uji("Staff mendaftar untuk dirinya sendiri, bukan orang lain", async () => {
  const staf = await id("Nabila Putri");
  const lain = await id("Anisa Larasati");
  const kursus = (
    await sebagaiAdmin(
      db,
      `select c.id from courses c
        where not exists (select 1 from course_enrollments e
                           where e.course_id = c.id and e.user_id = $1)
        limit 1`,
      [staf],
    )
  ).rows[0].id;

  await sebagai(
    db,
    staf,
    "insert into course_enrollments (course_id, user_id) values ($1, $2)",
    [kursus, staf],
  );

  await harusDitolak(
    () =>
      sebagai(
        db,
        staf,
        "insert into course_enrollments (course_id, user_id) values ($1, $2)",
        [kursus, lain],
      ),
    "mendaftarkan orang lain seharusnya ditolak",
  );
});

uji("kemajuan orang lain tidak terbaca sesama staf", async () => {
  const staf = await id("Yoga Saputra"); // Staff TAP
  const { rows } = await sebagai(
    db,
    staf,
    `select count(*)::int n from course_enrollments e
       join users u on u.id = e.user_id
      where e.user_id <> $1 and u.unit_id is distinct from
            (select unit_id from users where id = $1)`,
    [staf],
  );
  harusSama(Number(rows[0].n), 0);
});

uji("atasan dan pengelola melihat kemajuan timnya", async () => {
  const leader = await id("Dewi Lestari");
  const { rows } = await sebagai(
    db,
    leader,
    `select count(*)::int n from course_enrollments e
       join users u on u.id = e.user_id
      where u.unit_id = (select unit_id from users where id = $1)`,
    [leader],
  );
  harus(Number(rows[0].n) > 0, "Leader harus melihat kemajuan unitnya");
});

uji("Staff tidak bisa menandai modul atas nama pendaftaran orang lain", async () => {
  const staf = await id("Nabila Putri");
  const orangLain = (
    await sebagaiAdmin(
      db,
      "select id, course_id from course_enrollments where user_id <> $1 limit 1",
      [staf],
    )
  ).rows[0];
  const modul = (
    await sebagaiAdmin(
      db,
      "select id from course_modules where course_id = $1 limit 1",
      [orangLain.course_id],
    )
  ).rows[0].id;

  await harusDitolak(
    () =>
      sebagai(
        db,
        staf,
        "insert into module_progress (enrollment_id, module_id) values ($1, $2)",
        [orangLain.id, modul],
      ),
    "menandai kemajuan orang lain seharusnya ditolak",
  );
});

uji("hasil kuis orang lain tidak terbaca sesama staf", async () => {
  const staf = await id("Yoga Saputra");
  const { rows } = await sebagai(
    db,
    staf,
    `select count(*)::int n from quiz_attempts qa
       join course_enrollments e on e.id = qa.enrollment_id
      where e.user_id <> $1`,
    [staf],
  );
  harusSama(Number(rows[0].n), 0);
  await terapkanSeed(db);
});

uji("hasil kuis tidak bisa dikarang sendiri", async () => {
  // Nilai hanya lahir dari `nilai_kuis`, yang membaca kunci jawaban.
  // Tanpa penjagaan ini, siapa pun bisa menuliskan kelulusannya sendiri.
  const staf = await id("Nabila Putri");
  const ikut = (
    await sebagaiAdmin(
      db,
      "select id, course_id from course_enrollments where user_id = $1 limit 1",
      [staf],
    )
  ).rows[0];
  const modul = (
    await sebagaiAdmin(
      db,
      "select id from course_modules where course_id = $1 limit 1",
      [ikut.course_id],
    )
  ).rows[0].id;

  await harusDitolak(
    () =>
      sebagai(
        db,
        staf,
        `insert into quiz_attempts (enrollment_id, module_id, skor, lulus)
         values ($1, $2, 100, true)`,
        [ikut.id, modul],
      ),
    "penulisan hasil kuis langsung seharusnya ditolak",
  );
});

uji("nilai kuis tetap bisa ditulis lewat penilaian resmi", async () => {
  const staf = await id("Nabila Putri");
  const soal = (
    await sebagaiAdmin(
      db,
      `select q.module_id, count(*)::int n from quiz_questions q
        group by q.module_id limit 1`,
    )
  ).rows[0];

  if (soal) {
    const ikut = (
      await sebagaiAdmin(
        db,
        `select e.id from course_enrollments e
           join course_modules m on m.course_id = e.course_id
          where e.user_id = $1 and m.id = $2 limit 1`,
        [staf, soal.module_id],
      )
    ).rows[0];

    if (ikut) {
      const jawaban = Array.from({ length: soal.n }, () => 0);
      // Pendaftarannya dicari sendiri oleh fungsi dari pemanggilnya.
      await sebagai(db, staf, "select * from nilai_kuis($1, $2::int[])", [
        soal.module_id,
        jawaban,
      ]);
      harus(
        Number(
          (await sebagaiAdmin(
            db,
            "select count(*)::int n from quiz_attempts where enrollment_id = $1",
            [ikut.id],
          )).rows[0].n,
        ) > 0,
        "penilaian resmi harus menuliskan hasilnya",
      );
    }
  }
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
