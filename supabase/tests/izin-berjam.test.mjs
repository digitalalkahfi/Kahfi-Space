/** Izin berjam & izin terencana: jam efektif, menit telat, satu keputusan. */
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
const { uji, jalankan } = buatSuite("Izin berjam & terencana");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  eko: (await satu(`select id from users where nama='Eko Prasetyo'`)).id,
  dimas: (await satu(`select id from users where nama='Dimas Maulana'`)).id,
};

const hariIni = (
  await satu(`select (now() at time zone 'Asia/Jakarta')::date as d`)
).d
  .toISOString()
  .slice(0, 10);

const geser = async (hari) =>
  (await satu(`select (($1::date) + $2::int)::date as d`, [hariIni, hari])).d
    .toISOString()
    .slice(0, 10);

uji("tanpa izin, telat dihitung dari jam kerja normal", async () => {
  const tgl = await geser(-40);
  const { rows } = await sebagaiAdmin(
    db,
    `insert into attendance (user_id, tanggal, jam_masuk)
     values ($1,$2, (($2::date + time '09:00') at time zone 'Asia/Jakarta'))
     returning id`,
    [U.eko, tgl],
  );
  const b = await satu(
    `select terlambat, menit_telat, status from attendance where id=$1`,
    [rows[0].id],
  );
  harus(b.terlambat, "09:00 lewat dari batas 08:15");
  harusSama(b.menit_telat, 45);
  harusSama(b.status, "terlambat");
});

uji("izin berjam yang belum disetujui tidak menghapus telat", async () => {
  const tgl = await geser(-39);
  const { rows } = await sebagaiAdmin(
    db,
    `insert into attendance
       (user_id, tanggal, jam_masuk, izin_jenis, izin_mulai, izin_selesai,
        alasan, persetujuan)
     values ($1,$2, (($2::date + time '10:20') at time zone 'Asia/Jakarta'),
             'jam','08:00','10:00','antar anak ke dokter','diajukan')
     returning id`,
    [U.eko, tgl],
  );
  const b = await satu(
    `select terlambat, menit_telat from attendance where id=$1`,
    [rows[0].id],
  );
  harus(b.terlambat, "izin menggantung tidak boleh menghapus telat");
  harusSama(b.menit_telat, 125, "10:20 dikurangi batas normal 08:15");
});

uji(
  "begitu disetujui, telat dihitung ulang dari jam selesai izin",
  async () => {
    const tgl = await geser(-39);
    const id = (
      await satu(`select id from attendance where user_id=$1 and tanggal=$2`, [
        U.eko,
        tgl,
      ])
    ).id;

    await sebagai(
      db,
      U.dimas,
      `update attendance set persetujuan='disetujui', disetujui_oleh=$2,
            disetujui_pada=now()
      where id=$1`,
      [id, U.dimas],
    );

    const b = await satu(
      `select terlambat, menit_telat, status from attendance where id=$1`,
      [id],
    );
    harusSama(b.menit_telat, 20, "10:20 dikurangi jam selesai izin 10:00");
    harus(b.terlambat, "masih telat 20 menit, hanya berkurang");
  },
);

uji("datang tepat saat izin berakhir tidak dihitung telat", async () => {
  const tgl = await geser(-38);
  const { rows } = await sebagaiAdmin(
    db,
    `insert into attendance
       (user_id, tanggal, jam_masuk, izin_jenis, izin_mulai, izin_selesai,
        alasan, persetujuan, disetujui_oleh, disetujui_pada)
     values ($1,$2, (($2::date + time '10:00') at time zone 'Asia/Jakarta'),
             'jam','08:00','10:00','urusan bank','disetujui',$3,now())
     returning id`,
    [U.eko, tgl, U.dimas],
  );
  const b = await satu(
    `select terlambat, menit_telat, status from attendance where id=$1`,
    [rows[0].id],
  );
  harusSama(b.menit_telat, 0);
  harus(!b.terlambat, "tepat batas belum telat");
  harusSama(b.status, "hadir");
});

uji(
  "izin berjam yang berakhir sebelum jam kerja tidak memajukan batas",
  async () => {
    const tgl = await geser(-37);
    const { rows } = await sebagaiAdmin(
      db,
      `insert into attendance
       (user_id, tanggal, jam_masuk, izin_jenis, izin_mulai, izin_selesai,
        alasan, persetujuan, disetujui_oleh, disetujui_pada)
     values ($1,$2, (($2::date + time '08:30') at time zone 'Asia/Jakarta'),
             'jam','06:00','07:00','urusan pagi','disetujui',$3,now())
     returning id`,
      [U.eko, tgl, U.dimas],
    );
    const b = await satu(`select menit_telat from attendance where id=$1`, [
      rows[0].id,
    ]);
    harusSama(b.menit_telat, 15, "08:30 dikurangi batas normal 08:15");
  },
);

uji("izin berjam wajib punya jam mulai & selesai yang urut", async () => {
  const tgl = await geser(-36);
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into attendance (user_id, tanggal, izin_jenis, alasan, persetujuan)
         values ($1,$2,'jam','lupa isi jam','diajukan')`,
        [U.eko, tgl],
      ),
    "izin berjam tanpa jam seharusnya ditolak",
  );
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into attendance
           (user_id, tanggal, izin_jenis, izin_mulai, izin_selesai, alasan, persetujuan)
         values ($1,$2,'jam','10:00','09:00','jam terbalik','diajukan')`,
        [U.eko, tgl],
      ),
    "jam selesai sebelum jam mulai seharusnya ditolak",
  );
});

uji("jam tidak boleh diisi pada kehadiran biasa", async () => {
  const tgl = await geser(-35);
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into attendance (user_id, tanggal, izin_mulai, izin_selesai)
         values ($1,$2,'08:00','10:00')`,
        [U.eko, tgl],
      ),
    "jam izin tanpa izin_jenis seharusnya ditolak",
  );
});

uji("izin terencana untuk hari ini ditolak bagi pengguna", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.eko,
        `insert into attendance
           (user_id, tanggal, status, izin_jenis, alasan, persetujuan)
         values ($1,$2,'izin','terencana','acara keluarga','diajukan')`,
        [U.eko, hariIni],
      ),
    "izin terencana hari ini seharusnya ditolak",
  );
});

uji("izin terencana mulai besok diterima", async () => {
  const besok = await geser(1);
  const { rows } = await sebagai(
    db,
    U.eko,
    `insert into attendance
       (user_id, tanggal, status, izin_jenis, alasan, persetujuan)
     values ($1,$2,'izin','terencana','acara keluarga','diajukan')
     returning id`,
    [U.eko, besok],
  );
  harus(rows.length === 1);
});

uji("satu keputusan menutup seluruh hari izin terencana", async () => {
  const mulai = await geser(5);
  const tengah = await geser(6);
  const akhir = await geser(7);

  const induk = (
    await satu(
      `insert into attendance
         (user_id, tanggal, status, izin_jenis, alasan, persetujuan)
       values ($1,$2,'izin','terencana','cuti keluarga tiga hari','diajukan')
       returning id`,
      [U.eko, mulai],
    )
  ).id;
  for (const t of [tengah, akhir]) {
    await sebagaiAdmin(
      db,
      `insert into attendance
         (user_id, tanggal, status, izin_jenis, izin_induk_id, alasan, persetujuan)
       values ($1,$2,'izin','terencana',$3,'cuti keluarga tiga hari','diajukan')`,
      [U.eko, t, induk],
    );
  }

  await sebagai(
    db,
    U.dimas,
    `update attendance set persetujuan='disetujui', disetujui_oleh=$2,
            disetujui_pada=now() where id=$1`,
    [induk, U.dimas],
  );

  const { rows } = await sebagaiAdmin(
    db,
    `select tanggal, persetujuan, disetujui_oleh from attendance
      where user_id=$1 and tanggal in ($2,$3,$4) order by tanggal`,
    [U.eko, mulai, tengah, akhir],
  );
  harusSama(rows.length, 3);
  harus(
    rows.every((r) => r.persetujuan === "disetujui"),
    "seluruh hari harus ikut disetujui",
  );
  harus(
    rows.every((r) => r.disetujui_oleh === U.dimas),
    "pemutusnya ikut tercatat di tiap hari",
  );
});

uji("penolakan juga menyebar ke hari lanjutannya", async () => {
  const mulai = await geser(10);
  const lanjut = await geser(11);
  const induk = (
    await satu(
      `insert into attendance
         (user_id, tanggal, status, izin_jenis, alasan, persetujuan)
       values ($1,$2,'izin','terencana','rencana yang dibatalkan','diajukan')
       returning id`,
      [U.eko, mulai],
    )
  ).id;
  await sebagaiAdmin(
    db,
    `insert into attendance
       (user_id, tanggal, status, izin_jenis, izin_induk_id, alasan, persetujuan)
     values ($1,$2,'izin','terencana',$3,'rencana yang dibatalkan','diajukan')`,
    [U.eko, lanjut, induk],
  );

  await sebagai(
    db,
    U.dimas,
    `update attendance set persetujuan='ditolak', disetujui_oleh=$2,
            disetujui_pada=now(),
            alasan_keputusan='pekan itu jadwal penutupan bulan'
      where id=$1`,
    [induk, U.dimas],
  );

  const b = await satu(
    `select persetujuan, alasan_keputusan from attendance
      where user_id=$1 and tanggal=$2`,
    [U.eko, lanjut],
  );
  harusSama(b.persetujuan, "ditolak");
  harusSama(
    b.alasan_keputusan,
    "pekan itu jadwal penutupan bulan",
    "alasan penolakan ikut menyebar ke hari lanjutannya",
  );
});

uji("menghapus hari pertama ikut menghapus hari lanjutannya", async () => {
  const mulai = await geser(15);
  const lanjut = await geser(16);
  const induk = (
    await satu(
      `insert into attendance
         (user_id, tanggal, status, izin_jenis, alasan, persetujuan)
       values ($1,$2,'izin','terencana','izin yang dibatalkan','diajukan')
       returning id`,
      [U.eko, mulai],
    )
  ).id;
  await sebagaiAdmin(
    db,
    `insert into attendance
       (user_id, tanggal, status, izin_jenis, izin_induk_id, alasan, persetujuan)
     values ($1,$2,'izin','terencana',$3,'izin yang dibatalkan','diajukan')`,
    [U.eko, lanjut, induk],
  );

  await sebagaiAdmin(db, `delete from attendance where id=$1`, [induk]);
  const sisa = await satu(
    `select count(*)::int as n from attendance where user_id=$1 and tanggal=$2`,
    [U.eko, lanjut],
  );
  harusSama(sisa.n, 0, "hari lanjutan tidak boleh tertinggal tanpa induk");
});

uji("status_tim_harian membawa menit telat dan jam izin", async () => {
  const tgl = await geser(-38);
  const { rows } = await sebagaiAdmin(
    db,
    `select menit_telat, izin_jenis, izin_selesai, wajib_lapor
       from status_tim_harian($1::date) where user_id = $2`,
    [tgl, U.eko],
  );
  harusSama(rows.length, 1);
  harusSama(rows[0].menit_telat, 0);
  harusSama(rows[0].izin_jenis, "jam");
});

uji("penolakan tanpa alasan ditolak database", async () => {
  const tgl = await geser(20);
  const id = (
    await satu(
      `insert into attendance
         (user_id, tanggal, status, izin_jenis, alasan, persetujuan)
       values ($1,$2,'izin','terencana','rencana lain','diajukan')
       returning id`,
      [U.eko, tgl],
    )
  ).id;

  await harusDitolak(
    () =>
      sebagai(
        db,
        U.dimas,
        `update attendance set persetujuan='ditolak', disetujui_oleh=$2,
                disetujui_pada=now() where id=$1`,
        [id, U.dimas],
      ),
    "penolakan tanpa alasan seharusnya ditolak",
  );

  const b = await satu(`select persetujuan from attendance where id=$1`, [id]);
  harusSama(b.persetujuan, "diajukan", "statusnya tidak boleh berubah");
});

uji("persetujuan tidak butuh alasan", async () => {
  const tgl = await geser(21);
  const id = (
    await satu(
      `insert into attendance
         (user_id, tanggal, status, izin_jenis, alasan, persetujuan)
       values ($1,$2,'izin','terencana','acara keluarga','diajukan')
       returning id`,
      [U.eko, tgl],
    )
  ).id;
  await sebagai(
    db,
    U.dimas,
    `update attendance set persetujuan='disetujui', disetujui_oleh=$2,
            disetujui_pada=now() where id=$1`,
    [id, U.dimas],
  );
  harusSama(
    (await satu(`select persetujuan from attendance where id=$1`, [id]))
      .persetujuan,
    "disetujui",
  );
});

uji("ajukan_izin_terencana membuat seluruh harinya sekaligus", async () => {
  const mulai = await geser(25);
  const akhir = await geser(27);
  const { rows } = await sebagai(
    db,
    U.eko,
    `select ajukan_izin_terencana($1::date,$2::date,$3) as id`,
    [mulai, akhir, "cuti keluarga tiga hari"],
  );
  const induk = rows[0].id;

  const { rows: baris } = await sebagaiAdmin(
    db,
    `select tanggal, izin_induk_id, status, persetujuan from attendance
      where user_id=$1 and tanggal between $2 and $3 order by tanggal`,
    [U.eko, mulai, akhir],
  );
  harusSama(baris.length, 3);
  harus(baris[0].izin_induk_id === null, "hari pertama adalah induknya");
  harus(
    baris.slice(1).every((b) => b.izin_induk_id === induk),
    "hari lanjutan menunjuk hari pertama",
  );
  harus(baris.every((b) => b.persetujuan === "diajukan"));
});

uji("satu hari yang gagal membatalkan seluruh pengajuan", async () => {
  // Hari tengah sudah terisi absensi yang tidak bisa dijadikan izin
  // terencana; pengajuannya harus gagal utuh, bukan separuh.
  const mulai = await geser(30);
  const tengah = await geser(31);
  const akhir = await geser(32);

  await sebagaiAdmin(
    db,
    `insert into attendance (user_id, tanggal, izin_jenis, izin_mulai,
       izin_selesai, alasan, persetujuan)
     values ($1,$2,'jam','08:00','09:00','sudah ada izin berjam','diajukan')`,
    [U.eko, tengah],
  );

  await harusDitolak(
    () =>
      sebagai(db, U.eko, `select ajukan_izin_terencana($1::date,$2::date,$3)`, [
        mulai,
        akhir,
        "rencana yang bentrok",
      ]),
    "pengajuan yang bentrok seharusnya gagal",
  );

  const sisa = await satu(
    `select count(*)::int as n from attendance
      where user_id=$1 and tanggal in ($2,$3) and izin_jenis='terencana'`,
    [U.eko, mulai, akhir],
  );
  harusSama(sisa.n, 0, "tidak boleh ada hari yang tertinggal tersimpan");
});

uji(
  "ajukan_izin_terencana menolak rentang terbalik & kelewat panjang",
  async () => {
    const mulai = await geser(40);
    const sebelum = await geser(38);
    const jauh = await geser(80);

    await harusDitolak(
      () =>
        sebagai(
          db,
          U.eko,
          `select ajukan_izin_terencana($1::date,$2::date,$3)`,
          [mulai, sebelum, "rentang terbalik"],
        ),
      "rentang terbalik seharusnya ditolak",
    );
    await harusDitolak(
      () =>
        sebagai(
          db,
          U.eko,
          `select ajukan_izin_terencana($1::date,$2::date,$3)`,
          [mulai, jauh, "rentang kelewat panjang"],
        ),
      "rentang 40 hari seharusnya ditolak",
    );
  },
);

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
