/** Kunci absen pulang: kapan terkunci, kapan terbuka, dan batas wajarnya. */
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
const { uji, jalankan } = buatSuite("Absen pulang & kuncinya");

const idUser = async (n) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [n])).rows[0].id;
const idAkun = async (u) =>
  (await sebagaiAdmin(db, `select id from accounts where username=$1`, [u]))
    .rows[0].id;

const NABILA = await idUser("Nabila Putri"); // PIC, wajib lapor
const ANISA = await idUser("Anisa Larasati"); // tidak wajib lapor
const AKUN = await idAkun("@fashion_hijab");
const HARI = "2024-11-25";
// GMV dihitung satu hari penuh (0207): laporan yang jatuh tempo pada hari
// absen memuat GMV hari sebelumnya, jadi bertanggal H-1.
const HARI_DATA = "2024-11-24";

uji("absen pulang tanpa absen masuk tidak mengubah apa pun", async () => {
  const r = await sebagai(
    db,
    ANISA,
    `update attendance set jam_pulang = now()
     where user_id=$1 and tanggal=$2`,
    [ANISA, HARI],
  );
  harusSama(r.affectedRows ?? 0, 0, "tidak ada baris yang cocok");
});

uji("yang wajib lapor: pulang terkunci sebelum laporan", async () => {
  await sebagai(
    db,
    NABILA,
    `insert into attendance (user_id, tanggal, jam_masuk, lat_masuk, lng_masuk)
     values ($1, $2, ($2::date + time '07:50') at time zone 'Asia/Jakarta',
             -6.260700, 106.810600)`,
    [NABILA, HARI],
  );

  await harusDitolak(
    () =>
      sebagai(
        db,
        NABILA,
        `update attendance set jam_pulang = now()
         where user_id=$1 and tanggal=$2`,
        [NABILA, HARI],
      ),
    "kunci absen pulang tidak bekerja",
  );
});

uji("pulang terbuka setelah laporan yang jatuh tempo hari itu masuk (GMV H-1)", async () => {
  await sebagai(
    db,
    NABILA,
    // Komisi wajib untuk laporan akun Affiliator sejak 0211.
    `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi)
     values ($1, $2, $3, 3250000, 0)`,
    [NABILA, HARI_DATA, AKUN],
  );

  await sebagai(
    db,
    NABILA,
    `update attendance set jam_pulang = ($2::date + time '17:40')
       at time zone 'Asia/Jakarta'
     where user_id=$1 and tanggal=$2`,
    [NABILA, HARI],
  );

  const { rows } = await sebagaiAdmin(
    db,
    `select jam_pulang from attendance where user_id=$1 and tanggal=$2`,
    [NABILA, HARI],
  );
  harus(rows[0].jam_pulang, "jam pulang harus tersimpan");
});

uji("laporan hari LAIN tidak membuka kunci", async () => {
  const besok = "2024-11-26";
  await sebagai(
    db,
    NABILA,
    `insert into attendance (user_id, tanggal, jam_masuk, lat_masuk, lng_masuk)
     values ($1, $2, ($2::date + time '07:55') at time zone 'Asia/Jakarta',
             -6.260700, 106.810600)`,
    [NABILA, besok],
  );

  // Pada 26, yang ditagih adalah laporan bertanggal 25; laporan 24 (yang
  // membuka pulang tanggal 25) tidak cukup.
  await harusDitolak(
    () =>
      sebagai(
        db,
        NABILA,
        `update attendance set jam_pulang = now()
         where user_id=$1 and tanggal=$2`,
        [NABILA, besok],
      ),
    "laporan hari sebelumnya seharusnya tidak membuka kunci hari ini",
  );
});

uji("laporan bertanggal SAMA dengan hari absen tidak membuka kunci", async () => {
  const besok = "2024-11-26";
  // Laporan bertanggal 26 memuat GMV tanggal 26 — hari yang baru
  // selesai besok, jadi bukan yang ditagih pada 26.
  await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, account_id, gmv)
     values ($1, $2, $3, 1000000)`,
    [NABILA, besok, AKUN],
  );

  await harusDitolak(
    () =>
      sebagai(
        db,
        NABILA,
        `update attendance set jam_pulang = now()
         where user_id=$1 and tanggal=$2`,
        [NABILA, besok],
      ),
    "laporan bertanggal sama dengan hari absen seharusnya tidak membuka kunci",
  );
});

uji("laporan bertanggal kemarin membuka kunci", async () => {
  const besok = "2024-11-26";
  await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, account_id, gmv)
     values ($1, $2, $3, 2000000)`,
    [NABILA, HARI, AKUN],
  );

  await sebagai(
    db,
    NABILA,
    `update attendance set jam_pulang = ($2::date + time '17:30')
       at time zone 'Asia/Jakarta'
     where user_id=$1 and tanggal=$2`,
    [NABILA, besok],
  );
  const { rows } = await sebagaiAdmin(
    db,
    `select jam_pulang from attendance where user_id=$1 and tanggal=$2`,
    [NABILA, besok],
  );
  harus(rows[0].jam_pulang, "jam pulang tersimpan setelah laporan 25 masuk");
});

// ---------------------------------------------------------------------
// Laporan dikirim orang lain (0214). Satu akun hanya punya satu laporan per
// tanggal, jadi PIC tidak bisa melapor lagi dan kuncinya harus tetap terbuka.
// ---------------------------------------------------------------------
const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
// Seed membuat akun dengan now(), sedangkan tanggal tes ini 2024; akun yang
// belum terdaftar pada suatu hari tidak ikut dinilai pada hari itu.
await sebagaiAdmin(db, `update accounts set created_at = '2024-01-01'`);
const MANAGER = (await satu(`select id from users where role='Manager' limit 1`))
  .id;
const absenMasuk = (id, tgl) =>
  sebagaiAdmin(
    db,
    `insert into attendance (user_id, tanggal, jam_masuk, lat_masuk, lng_masuk)
     values ($1, $2, ($2::date + time '07:50') at time zone 'Asia/Jakarta',
             -6.260700, 106.810600)`,
    [id, tgl],
  );
const pulang = (id, tgl) =>
  sebagai(
    db,
    id,
    `update attendance set jam_pulang = ($2::date + time '17:30')
       at time zone 'Asia/Jakarta'
     where user_id=$1 and tanggal=$2`,
    [id, tgl],
  );

uji("laporan akun PIC yang dikirim Manager membuka kunci PIC-nya", async () => {
  const hari = "2024-12-03";
  await absenMasuk(NABILA, hari);
  await sebagai(
    db,
    MANAGER,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi)
     values ($1, '2024-12-02', $2, 1500000, 0)`,
    [MANAGER, AKUN],
  );

  // Inilah jalan buntunya: PIC tidak bisa melapor sendiri lagi.
  await harusDitolak(
    () =>
      sebagai(
        db,
        NABILA,
        `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi)
         values ($1, '2024-12-02', $2, 1500000, 0)`,
        [NABILA, AKUN],
      ),
    "satu akun hanya boleh punya satu laporan per tanggal",
  );

  await pulang(NABILA, hari);
  const b = await satu(
    `select jam_pulang from attendance where user_id=$1 and tanggal=$2`,
    [NABILA, hari],
  );
  harus(b.jam_pulang, "jam pulang tersimpan");

  const rekap = await sebagai(
    db,
    NABILA,
    `select sudah_lapor from rekap_absensi($1::date, $1::date, $2)`,
    [hari, NABILA],
  );
  harusSama(rekap.rows[0].sudah_lapor, true, "rekap sepakat dengan kuncinya");
});

uji("laporan akun PIC yang dikirim co-leader membuka kunci PIC-nya", async () => {
  const akun = await satu(
    `select id, pic_user_id, co_leader_id from accounts
      where status='aktif' and co_leader_id is not null
        and pic_user_id is not null and co_leader_id <> pic_user_id
      limit 1`,
  );
  harus(akun, "prasyarat: seed punya akun dengan co-leader");
  const hari = "2024-12-05";
  await absenMasuk(akun.pic_user_id, hari);
  await sebagai(
    db,
    akun.co_leader_id,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi)
     values ($1, '2024-12-04', $2, 900000, 0)`,
    [akun.co_leader_id, akun.id],
  );
  // Akun PIC yang lain, bila ada, dilaporkan Manager: laporan orang lain baru
  // membuka kunci setelah tidak ada lagi yang bisa ia kirim sendiri.
  await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi)
     select $1, '2024-12-04', a.id, 900000, 0 from accounts a
      where a.status='aktif' and a.pic_user_id=$2 and a.id<>$3`,
    [MANAGER, akun.pic_user_id, akun.id],
  );
  await pulang(akun.pic_user_id, hari);
  const b = await satu(
    `select jam_pulang from attendance where user_id=$1 and tanggal=$2`,
    [akun.pic_user_id, hari],
  );
  harus(b.jam_pulang, "jam pulang PIC tersimpan");
});

uji("laporan akun orang lain tidak membuka kunci", async () => {
  const lain = await satu(
    `select id from accounts
      where status='aktif' and pic_user_id is not null and pic_user_id <> $1
      limit 1`,
    [NABILA],
  );
  const hari = "2024-12-07";
  await absenMasuk(NABILA, hari);
  await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi)
     values ($1, '2024-12-06', $2, 800000, 0)`,
    [MANAGER, lain.id],
  );
  await harusDitolak(
    () => pulang(NABILA, hari),
    "laporan akun PIC lain seharusnya tidak membuka kunci",
  );
});

uji("PIC dua akun: laporan Manager untuk satu akun belum membuka kunci", async () => {
  const pic = await satu(
    `select pic_user_id as id from accounts
      where status='aktif' and pic_user_id is not null
      group by pic_user_id having count(*) = 2 limit 1`,
  );
  harus(pic, "prasyarat: seed punya PIC dua akun");
  const akun = (
    await sebagaiAdmin(
      db,
      `select id from accounts
        where status='aktif' and pic_user_id=$1 order by username`,
      [pic.id],
    )
  ).rows;
  const hari = "2024-12-11";
  await absenMasuk(pic.id, hari);
  const lapor = (id, oleh) =>
    sebagaiAdmin(
      db,
      `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi)
       values ($1, '2024-12-10', $2, 600000, 0)`,
      [oleh, id],
    );

  await lapor(akun[0].id, MANAGER);
  await harusDitolak(
    () => pulang(pic.id, hari),
    "akun kedua masih bisa ia laporkan, jadi kuncinya belum terbuka",
  );

  await lapor(akun[1].id, MANAGER);
  await pulang(pic.id, hari);
  const b = await satu(
    `select jam_pulang from attendance where user_id=$1 and tanggal=$2`,
    [pic.id, hari],
  );
  harus(b.jam_pulang, "semua akun terlapor: tidak ada lagi yang bisa ia kirim");
});

uji("PIC dua akun: satu laporan kirimannya sendiri tetap cukup", async () => {
  const pic = await satu(
    `select pic_user_id as id from accounts
      where status='aktif' and pic_user_id is not null
      group by pic_user_id having count(*) = 2 limit 1`,
  );
  const akun = await satu(
    `select id from accounts
      where status='aktif' and pic_user_id=$1 order by username limit 1`,
    [pic.id],
  );
  const hari = "2024-12-13";
  await absenMasuk(pic.id, hari);
  await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi)
     values ($1, '2024-12-12', $2, 500000, 0)`,
    [pic.id, akun.id],
  );
  await pulang(pic.id, hari);
});

uji("akun yang baru terdaftar pada hari absen tidak ditagih", async () => {
  const pic = await satu(
    `select pic_user_id as id from accounts
      where status='aktif' and pic_user_id is not null
      group by pic_user_id having count(*) = 2 limit 1`,
  );
  const akun = (
    await sebagaiAdmin(
      db,
      `select id, created_at from accounts
        where status='aktif' and pic_user_id=$1 order by username`,
      [pic.id],
    )
  ).rows;
  const hari = "2024-12-15";
  await absenMasuk(pic.id, hari);
  const terdaftar = (id) =>
    sebagaiAdmin(
      db,
      `update accounts
          set created_at = ($2::date + time '09:00') at time zone 'Asia/Jakarta'
        where id=$1`,
      [id, hari],
    );

  try {
    // Satu akun baru hari ini, satu akun lama belum terlapor: masih ditagih.
    await terdaftar(akun[1].id);
    await harusDitolak(
      () => pulang(pic.id, hari),
      "akun lama yang belum terlapor tetap mengunci",
    );

    // Dua-duanya baru hari ini: tidak ada laporan H-1 yang bisa dikirim.
    await terdaftar(akun[0].id);
    await pulang(pic.id, hari);
    const b = await satu(
      `select jam_pulang from attendance where user_id=$1 and tanggal=$2`,
      [pic.id, hari],
    );
    harus(b.jam_pulang, "PIC akun baru tidak terkunci di hari pertamanya");
  } finally {
    for (const a of akun) {
      await sebagaiAdmin(db, `update accounts set created_at=$2 where id=$1`, [
        a.id,
        a.created_at,
      ]);
    }
  }
});

uji("akun yang terdaftar belakangan tidak mengubah rekap hari lampau", async () => {
  const pic = await satu(
    `select pic_user_id as id from accounts
      where status='aktif' and pic_user_id is not null
      group by pic_user_id having count(*) = 2 limit 1`,
  );
  const akun = (
    await sebagaiAdmin(
      db,
      `select id, created_at from accounts
        where status='aktif' and pic_user_id=$1 order by username`,
      [pic.id],
    )
  ).rows;
  const hari = "2024-12-17";
  await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi)
     values ($1, '2024-12-16', $2, 400000, 0)`,
    [MANAGER, akun[0].id],
  );
  const sudah = async () =>
    (await satu(`select sudah_lapor_harian($1, $2::date) s`, [pic.id, hari])).s;
  harusSama(await sudah(), false, "akun kedua masih tertagih pada hari itu");

  try {
    await sebagaiAdmin(
      db,
      `update accounts set created_at = '2024-12-20' where id=$1`,
      [akun[1].id],
    );
    harusSama(
      await sudah(),
      true,
      "akun yang belum terdaftar pada hari itu tidak ikut dinilai",
    );
  } finally {
    await sebagaiAdmin(db, `update accounts set created_at=$2 where id=$1`, [
      akun[1].id,
      akun[1].created_at,
    ]);
  }
});

uji("laporan unit tidak membuka kunci Leader yang unitnya masih berakun", async () => {
  const leader = await satu(
    `select u.id, u.unit_id from users u
      where u.role='Leader' and u.status='aktif' and u.unit_id is not null
        and exists (
          select 1 from accounts a
           where a.unit_id=u.unit_id and a.status='aktif'
        )
      limit 1`,
  );
  harus(leader, "prasyarat: seed punya Leader unit berakun");
  await sebagaiAdmin(
    db,
    `update accounts set pic_user_id=$1 where id=(
       select id from accounts
        where unit_id=$2 and status='aktif' and pic_user_id is null limit 1
     )`,
    [leader.id, leader.unit_id],
  );
  await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, unit_id, gmv)
     values ($1, '2024-12-18', $2, 300000)`,
    [MANAGER, leader.unit_id],
  );
  const r = await satu(`select sudah_lapor_harian($1, '2024-12-19'::date) s`, [
    leader.id,
  ]);
  harusSama(r.s, false, "laporan unit bukan tagihan unit yang berakun");
});

uji("bukan PIC dan bukan Leader tidak pernah dianggap sudah melapor", async () => {
  const r = await satu(`select sudah_lapor_harian($1, '2024-12-15'::date) s`, [
    ANISA,
  ]);
  harusSama(r.s, false, "tidak punya akun bukan berarti sudah melapor");
});

uji("laporan unit yang dikirim Manager membuka kunci Leader unit itu", async () => {
  const leader = await satu(
    `select u.id, u.unit_id from users u
      where u.role='Leader' and u.status='aktif' and u.unit_id is not null
        and not exists (
          select 1 from accounts a
           where a.unit_id=u.unit_id and a.status='aktif'
        )
      limit 1`,
  );
  harus(leader, "prasyarat: seed punya Leader unit tanpa akun");
  const hari = "2024-12-09";
  const wajib = await satu(`select wajib_lapor_harian($1) w`, [leader.id]);
  harusSama(wajib.w, true, "prasyarat: Leader unit tanpa akun wajib lapor");

  await absenMasuk(leader.id, hari);
  await harusDitolak(
    () => pulang(leader.id, hari),
    "sebelum laporan unit masuk, Leader masih terkunci",
  );
  await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, unit_id, gmv)
     values ($1, '2024-12-08', $2, 700000)`,
    [MANAGER, leader.unit_id],
  );
  await pulang(leader.id, hari);
  const b = await satu(
    `select jam_pulang from attendance where user_id=$1 and tanggal=$2`,
    [leader.id, hari],
  );
  harus(b.jam_pulang, "jam pulang Leader tersimpan");

  // Laporan unit hanya tagihan Leader-nya, bukan seluruh anggota unit.
  const anggota = await satu(
    `select id from users
      where unit_id=$1 and role<>'Leader' and status='aktif' limit 1`,
    [leader.unit_id],
  );
  if (anggota) {
    const r = await satu(`select sudah_lapor_harian($1, $2::date) s`, [
      anggota.id,
      hari,
    ]);
    harusSama(r.s, false, "anggota biasa tidak ikut terhitung melapor");
  }
});

uji("jam pulang tidak boleh mendahului jam masuk", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `update attendance
           set jam_pulang = ($2::date + time '05:00') at time zone 'Asia/Jakarta'
         where user_id=$1 and tanggal=$2`,
        [NABILA, HARI],
      ),
    "constraint attendance_pulang_setelah_masuk tidak bekerja",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
