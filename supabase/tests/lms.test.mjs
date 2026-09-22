/** LMS: kelulusan dihitung dari modul, dan kunci kuis tertutup bagi peserta. */
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
const { uji, jalankan } = buatSuite("LMS & kuis");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const modulId = async (judul) =>
  (await sebagaiAdmin(db, "select id from course_modules where judul = $1", [judul]))
    .rows[0].id;

const lulusKursus = async (judul, nama) =>
  (
    await sebagaiAdmin(
      db,
      `select e.selesai_pada is not null lulus
         from course_enrollments e
         join courses c on c.id = e.course_id
         join users u on u.id = e.user_id
        where c.judul like $1 and u.nama = $2`,
      [`${judul}%`, nama],
    )
  ).rows[0].lulus;

uji("kelulusan dihitung dari modul yang tuntas", async () => {
  harusSama(await lulusKursus("Membaca Angka GMV", "Rian Hidayat"), true);
  harusSama(await lulusKursus("Membaca Angka GMV", "Maya Safitri"), false);
});

uji("menambah modul membatalkan kelulusan yang sudah ada", async () => {
  // Kalau tidak, ada orang yang "lulus" padahal ada materi yang belum
  // pernah ia buka sama sekali.
  const kursus = (
    await sebagaiAdmin(db, "select id from courses where judul like 'Membaca Angka GMV%'")
  ).rows[0].id;

  await sebagaiAdmin(
    db,
    "insert into course_modules (course_id, urutan, judul) values ($1, 99, 'Modul tambahan')",
    [kursus],
  );
  harusSama(await lulusKursus("Membaca Angka GMV", "Rian Hidayat"), false);

  await sebagaiAdmin(db, "delete from course_modules where urutan = 99 and course_id = $1", [kursus]);
  harusSama(await lulusKursus("Membaca Angka GMV", "Rian Hidayat"), true);
});

uji("menghapus modul merapatkan nomor sisanya", async () => {
  const kursus = (
    await sebagaiAdmin(db, "select id from courses where judul like 'Dasar Live%'")
  ).rows[0].id;
  await sebagaiAdmin(db, "delete from course_modules where course_id = $1 and urutan = 2", [kursus]);

  const { rows } = await sebagaiAdmin(
    db,
    "select urutan from course_modules where course_id = $1 order by urutan",
    [kursus],
  );
  harusSama(rows.map((r) => r.urutan).join(","), "1,2,3");
  await terapkanSeed(db);
});

uji("kemajuan modul kursus lain ditolak", async () => {
  const daftar = (
    await sebagaiAdmin(
      db,
      `select e.id from course_enrollments e
         join courses c on c.id = e.course_id
        where c.judul like 'Membaca Angka GMV%' limit 1`,
    )
  ).rows[0].id;

  await harusDitolak(
    async () =>
      sebagaiAdmin(
        db,
        "insert into module_progress (enrollment_id, module_id) values ($1, $2)",
        [daftar, await modulId("Menyiapkan alat & pencahayaan")],
      ),
    "modul kursus lain seharusnya ditolak",
  );
});

uji("peserta tidak bisa membaca kunci jawaban", async () => {
  // Inilah alasan kuncinya tinggal di tabel terpisah: RLS PostgreSQL
  // bekerja per baris, bukan per kolom.
  const { rows } = await sebagai(
    db,
    await id("Rian Hidayat"),
    "select count(*)::int n from quiz_keys",
  );
  harusSama(rows[0].n, 0);
});

uji("peserta tetap bisa membaca soalnya", async () => {
  const { rows } = await sebagai(
    db,
    await id("Rian Hidayat"),
    "select count(*)::int n from quiz_questions",
  );
  harus(rows[0].n > 0, "soal harus terbaca peserta");
});

uji("Manager bisa membaca kunci jawaban", async () => {
  const { rows } = await sebagai(
    db,
    await id("Farhan Pratama"),
    "select count(*)::int n from quiz_keys",
  );
  harus(rows[0].n > 0, "pengelola harus bisa membaca kunci");
});

uji("menilai kuis mengembalikan skor tanpa membocorkan kunci", async () => {
  const orang = await id("Rian Hidayat");
  const modul = await modulId("Base, Goal, Stretch");
  const { rows } = await sebagai(db, orang, "select * from nilai_kuis($1, $2)", [
    modul,
    [2, 1, 1],
  ]);
  harusSama(rows[0].skor, 100);
  harusSama(rows[0].lulus, true);
  harusSama(Object.keys(rows[0]).includes("jawaban_benar"), false);
});

uji("lulus kuis sekaligus menuntaskan modulnya", async () => {
  const orang = await id("Rian Hidayat");
  const modul = await modulId("Data mana yang rahasia");
  await sebagai(db, orang, "select * from nilai_kuis($1, $2)", [modul, [1, 1]]);

  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int n from module_progress p
       join course_enrollments e on e.id = p.enrollment_id
      where p.module_id = $1 and e.user_id = $2`,
    [modul, orang],
  );
  harusSama(rows[0].n, 1);
  await terapkanSeed(db);
});

uji("kuis tanpa mengikuti kursusnya ditolak", async () => {
  await harusDitolak(
    async () =>
      sebagai(db, await id("Vina Oktaviani"), "select * from nilai_kuis($1, $2)", [
        await modulId("Base, Goal, Stretch"),
        [2, 1, 1],
      ]),
    "mengerjakan kuis tanpa mendaftar seharusnya ditolak",
  );
});

uji("jumlah jawaban harus sama dengan jumlah soal", async () => {
  await harusDitolak(
    async () =>
      sebagai(db, await id("Rian Hidayat"), "select * from nilai_kuis($1, $2)", [
        await modulId("Base, Goal, Stretch"),
        [1],
      ]),
    "jumlah jawaban yang tidak cocok seharusnya ditolak",
  );
});

uji("kursus yang sudah diikuti tidak bisa dihapus", async () => {
  // Menghapusnya ikut melenyapkan catatan belajar seluruh pesertanya.
  const kursus = (
    await sebagaiAdmin(
      db,
      `select c.id, c.judul from courses c
        where exists (select 1 from course_enrollments e where e.course_id = c.id)
        limit 1`,
    )
  ).rows[0];
  harus(kursus !== undefined, "data contoh harus punya kursus berpeserta");

  await harusDitolak(
    () => sebagaiAdmin(db, "delete from courses where id = $1", [kursus.id]),
    "penghapusan kursus berpeserta seharusnya ditolak",
  );

  harusSama(
    Number(
      (await sebagaiAdmin(db, "select count(*)::int n from courses where id = $1", [kursus.id]))
        .rows[0].n,
    ),
    1,
  );
});

uji("kursus yang belum diikuti siapa pun boleh dihapus", async () => {
  const baru = (
    await sebagaiAdmin(
      db,
      "insert into courses (judul, ringkasan) values ('Salah buat', '') returning id",
    )
  ).rows[0].id;

  await sebagaiAdmin(db, "delete from courses where id = $1", [baru]);
  harusSama(
    Number(
      (await sebagaiAdmin(db, "select count(*)::int n from courses where id = $1", [baru]))
        .rows[0].n,
    ),
    0,
  );
});

uji("menonaktifkan kursus menyimpan riwayat pesertanya", async () => {
  const kursus = (
    await sebagaiAdmin(
      db,
      `select c.id from courses c
        where exists (select 1 from course_enrollments e where e.course_id = c.id)
        limit 1`,
    )
  ).rows[0].id;
  const sebelum = Number(
    (await sebagaiAdmin(
      db,
      "select count(*)::int n from course_enrollments where course_id = $1",
      [kursus],
    )).rows[0].n,
  );

  await sebagaiAdmin(db, "update courses set aktif = false where id = $1", [kursus]);

  harusSama(
    Number(
      (await sebagaiAdmin(
        db,
        "select count(*)::int n from course_enrollments where course_id = $1",
        [kursus],
      )).rows[0].n,
    ),
    sebelum,
  );
  await terapkanSeed(db);
});

uji("modul bisa ditukar urutannya", async () => {
  // Urutan modul adalah isi kurikulumnya; tanpa cara memindah, satu-satunya
  // jalan membetulkannya adalah menghapus lalu membuat ulang.
  const kursus = (
    await sebagaiAdmin(
      db,
      `select course_id from course_modules group by course_id having count(*) > 1 limit 1`,
    )
  ).rows[0].course_id;

  const sebelum = (
    await sebagaiAdmin(
      db,
      "select id, urutan, judul from course_modules where course_id = $1 order by urutan",
      [kursus],
    )
  ).rows;

  await sebagaiAdmin(db, "select pindah_urutan_modul($1, 1)", [sebelum[0].id]);

  const sesudah = (
    await sebagaiAdmin(
      db,
      "select id, urutan, judul from course_modules where course_id = $1 order by urutan",
      [kursus],
    )
  ).rows;
  harusSama(sesudah[0].judul, sebelum[1].judul);
  harusSama(sesudah[1].judul, sebelum[0].judul);
  harusSama(
    sesudah.map((m) => m.urutan).join(","),
    sebelum.map((m) => m.urutan).join(","),
    "nomornya tetap rapat 1..n",
  );
});

uji("modul teratas tidak bisa dinaikkan lagi", async () => {
  const modul = (
    await sebagaiAdmin(
      db,
      "select id, course_id, urutan from course_modules where urutan = 1 limit 1",
    )
  ).rows[0];

  await sebagaiAdmin(db, "select pindah_urutan_modul($1, -1)", [modul.id]);

  harusSama(
    (await sebagaiAdmin(db, "select urutan from course_modules where id = $1", [modul.id]))
      .rows[0].urutan,
    1,
    "yang sudah di ujung tetap di tempatnya, tanpa galat",
  );
});

uji("kemajuan peserta tidak berubah karena modul dipindah", async () => {
  // Yang berpindah nomornya, bukan modulnya; catatan tuntas menempel pada
  // modulnya sendiri.
  const { rows } = await sebagaiAdmin(
    db,
    `select e.id, count(mp.id)::int tuntas
       from course_enrollments e
       left join module_progress mp on mp.enrollment_id = e.id
      group by e.id having count(mp.id) > 0 limit 1`,
  );
  if (rows.length > 0) {
    const modul = (
      await sebagaiAdmin(
        db,
        `select cm.id from course_modules cm
           join course_enrollments e on e.course_id = cm.course_id
          where e.id = $1 and cm.urutan = 1`,
        [rows[0].id],
      )
    ).rows[0];

    await sebagaiAdmin(db, "select pindah_urutan_modul($1, 1)", [modul.id]);

    harusSama(
      Number(
        (await sebagaiAdmin(
          db,
          "select count(*)::int n from module_progress where enrollment_id = $1",
          [rows[0].id],
        )).rows[0].n,
      ),
      rows[0].tuntas,
    );
  }
  await terapkanSeed(db);
});

uji("kunci jawaban tidak boleh menunjuk pilihan yang tidak ada", async () => {
  // Soal seperti itu mustahil dijawab benar, dan pesertanya tidak pernah
  // tahu sebabnya.
  const modul = (
    await sebagaiAdmin(db, "select id from course_modules limit 1")
  ).rows[0].id;
  const soal = (
    await sebagaiAdmin(
      db,
      `insert into quiz_questions (module_id, urutan, pertanyaan, pilihan)
       values ($1, 99, 'Manakah yang benar?', array['A','B','C'])
       returning id`,
      [modul],
    )
  ).rows[0].id;

  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "insert into quiz_keys (question_id, jawaban_benar) values ($1, 5)",
        [soal],
      ),
    "kunci di luar jumlah pilihan seharusnya ditolak",
  );

  await sebagaiAdmin(
    db,
    "insert into quiz_keys (question_id, jawaban_benar) values ($1, 2)",
    [soal],
  );
  harusSama(
    (await sebagaiAdmin(db, "select jawaban_benar from quiz_keys where question_id = $1", [soal]))
      .rows[0].jawaban_benar,
    2,
  );
});

uji("mengurangi pilihan yang masih dipakai kunci ditolak", async () => {
  const soal = (
    await sebagaiAdmin(
      db,
      "select id from quiz_questions where pertanyaan = 'Manakah yang benar?'",
    )
  ).rows[0].id;

  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "update quiz_questions set pilihan = array['A','B'] where id = $1",
        [soal],
      ),
    "pengurangan pilihan di bawah kunci seharusnya ditolak",
  );

  // Menambah pilihan tetap boleh.
  await sebagaiAdmin(
    db,
    "update quiz_questions set pilihan = array['A','B','C','D'] where id = $1",
    [soal],
  );
  harusSama(
    (await sebagaiAdmin(db, "select array_length(pilihan, 1) n from quiz_questions where id = $1", [soal]))
      .rows[0].n,
    4,
  );
  await terapkanSeed(db);
});

uji("seluruh kunci di data contoh menunjuk pilihan yang ada", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int n from quiz_keys k
       join quiz_questions q on q.id = k.question_id
      where k.jawaban_benar > array_length(q.pilihan, 1) - 1`,
  );
  harusSama(rows[0].n, 0);
});

uji("nilai kuis membaca jawaban menurut urutan penyajian", async () => {
  // Setelah satu soal dihapus, nomor soal bisa tidak lagi rapat. Layar
  // tetap mengirim jawaban berurutan; penilaian harus mengikuti itu.
  const staf = (
    await sebagaiAdmin(db, "select id from users where nama = 'Nabila Putri'")
  ).rows[0].id;
  const kursus = (
    await sebagaiAdmin(
      db,
      "insert into courses (judul, ringkasan) values ('Kursus uji kuis','') returning id",
    )
  ).rows[0].id;
  const modul = (
    await sebagaiAdmin(
      db,
      "insert into course_modules (course_id, urutan, judul) values ($1, 1, 'Modul kuis') returning id",
      [kursus],
    )
  ).rows[0].id;

  const soal = [];
  for (const [urutan, benar] of [[1, 0], [2, 1], [3, 2]]) {
    const q = (
      await sebagaiAdmin(
        db,
        `insert into quiz_questions (module_id, urutan, pertanyaan, pilihan)
         values ($1, $2::int, 'Soal nomor ' || $2::text, array['A','B','C'])
         returning id`,
        [modul, urutan],
      )
    ).rows[0].id;
    await sebagaiAdmin(
      db,
      "insert into quiz_keys (question_id, jawaban_benar) values ($1, $2)",
      [q, benar],
    );
    soal.push(q);
  }

  // Soal pertama dihapus: sisa nomornya dirapatkan menjadi 1 dan 2.
  await sebagaiAdmin(db, "delete from quiz_questions where id = $1", [soal[0]]);
  harusSama(
    (await sebagaiAdmin(
      db,
      "select string_agg(urutan::text, ',' order by urutan) u from quiz_questions where module_id = $1",
      [modul],
    )).rows[0].u,
    "1,2",
  );

  await sebagaiAdmin(
    db,
    "insert into course_enrollments (course_id, user_id) values ($1, $2)",
    [kursus, staf],
  );

  // Jawaban benar untuk dua soal sisa: 1 lalu 2.
  const { rows } = await sebagai(db, staf, "select * from nilai_kuis($1, $2::int[])", [
    modul,
    [1, 2],
  ]);
  harusSama(rows[0].benar, 2, "keduanya harus terbaca benar");
  harusSama(rows[0].skor, 100);
});

uji("kuis tanpa kunci lengkap menolak dinilai", async () => {
  // Kalau tidak, soal tanpa kunci diam-diam dihitung salah dan nilainya
  // menyalahkan peserta atas kelalaian penyusun.
  const modul = (
    await sebagaiAdmin(
      db,
      "select id from course_modules where judul = 'Modul kuis'",
    )
  ).rows[0].id;
  await sebagaiAdmin(
    db,
    `insert into quiz_questions (module_id, urutan, pertanyaan, pilihan)
     values ($1, 3, 'Soal tanpa kunci', array['A','B'])`,
    [modul],
  );

  const staf = (
    await sebagaiAdmin(db, "select id from users where nama = 'Nabila Putri'")
  ).rows[0].id;
  await harusDitolak(
    () =>
      sebagai(db, staf, "select * from nilai_kuis($1, $2::int[])", [modul, [1, 2, 0]]),
    "kuis dengan soal tanpa kunci seharusnya ditolak",
  );
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
