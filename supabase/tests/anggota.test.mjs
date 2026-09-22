/** Kelola anggota: wewenang ubah dan penjaga pengelola terakhir. */
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
const { uji, jalankan } = buatSuite("Kelola anggota");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

uji("Manager boleh mengubah data anggota", async () => {
  const target = await id("Anisa Larasati");
  await sebagai(
    db,
    await id("Farhan Pratama"),
    "update users set jabatan = $1 where id = $2",
    ["Staff Affiliator · Senior", target],
  );
  const { rows } = await sebagaiAdmin(db, "select jabatan from users where id = $1", [target]);
  harusSama(rows[0].jabatan, "Staff Affiliator · Senior");
  await terapkanSeed(db);
});

uji("Leader tidak boleh mengubah data anggota", async () => {
  const target = await id("Anisa Larasati");
  await sebagai(
    db,
    await id("Dewi Lestari"),
    "update users set jabatan = $1 where id = $2",
    ["Jabatan Palsu", target],
  );
  const { rows } = await sebagaiAdmin(db, "select jabatan from users where id = $1", [target]);
  harus(rows[0].jabatan !== "Jabatan Palsu", "Leader seharusnya tidak bisa mengubah anggota");
});

uji("Staff tidak boleh mengangkat dirinya sendiri", async () => {
  // Lubang nyata sebelum 0041: `users_ubah_diri` mengizinkan UPDATE pada
  // baris sendiri tanpa membatasi kolom, jadi siapa pun bisa menjadikan
  // dirinya Manager.
  const diri = await id("Rian Hidayat");
  await harusDitolak(
    () => sebagai(db, diri, "update users set role = 'Manager' where id = $1", [diri]),
    "Staff seharusnya tidak bisa mengubah perannya sendiri",
  );
  const { rows } = await sebagaiAdmin(db, "select role from users where id = $1", [diri]);
  harusSama(rows[0].role, "Staff");
});

uji("Staff tidak boleh memindahkan dirinya ke unit lain", async () => {
  const diri = await id("Rian Hidayat");
  await harusDitolak(
    () =>
      sebagai(
        db,
        diri,
        "update users set unit_id = (select id from units where kode = 'tap') where id = $1",
        [diri],
      ),
    "Staff seharusnya tidak bisa berpindah unit sendiri",
  );
});

uji("Staff tidak boleh mengaktifkan kembali dirinya", async () => {
  const diri = await id("Rian Hidayat");
  await harusDitolak(
    () => sebagai(db, diri, "update users set status = 'nonaktif' where id = $1", [diri]),
    "Staff seharusnya tidak bisa mengubah status keaktifannya",
  );
});

uji("Staff tetap boleh merapikan nama dan fotonya", async () => {
  const diri = await id("Rian Hidayat");
  await sebagai(db, diri, "update users set foto_url = $1 where id = $2", [
    "https://contoh.test/rian.jpg",
    diri,
  ]);
  const { rows } = await sebagaiAdmin(db, "select foto_url from users where id = $1", [diri]);
  harusSama(rows[0].foto_url, "https://contoh.test/rian.jpg");
  await terapkanSeed(db);
});

uji("email unik tanpa memandang huruf besar-kecil", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into users (nama, email, role, jabatan)
         values ('Kembar Anisa', 'ANISA@alkahfi.co.id', 'Staff', 'Staff Affiliator')`,
      ),
    "email yang sama beda huruf seharusnya ditolak",
  );
});

uji("pengelola terakhir tidak bisa menurunkan dirinya", async () => {
  // Menyisakan satu pengelola aktif, lalu ia mencoba melepas perannya.
  await sebagaiAdmin(db, "update users set status = 'nonaktif' where nama = 'Hafidz Alkahfi'");
  await harusDitolak(
    () =>
      sebagaiAdmin(db, "update users set role = 'Staff' where nama = 'Farhan Pratama'"),
    "pengelola terakhir seharusnya tidak bisa menurunkan diri",
  );
  await harusDitolak(
    () =>
      sebagaiAdmin(db, "update users set status = 'nonaktif' where nama = 'Farhan Pratama'"),
    "pengelola terakhir seharusnya tidak bisa menonaktifkan diri",
  );
  await terapkanSeed(db);
});

uji("pengelola boleh mundur bila masih ada pengelola lain", async () => {
  // Seed tidak menyimpan kolom status, jadi dipulihkan eksplisit.
  await sebagaiAdmin(db, "update users set status = 'aktif' where status <> 'aktif'");

  const { rows: sebelum } = await sebagaiAdmin(
    db,
    "select count(*)::int n from users where role in ('CEO','Manager') and status = 'aktif'",
  );
  harus(sebelum[0].n >= 2, "seed harus punya lebih dari satu pengelola");

  // Turun jadi Staff berarti ikut ditempatkan di sebuah unit (0068):
  // peran unit tanpa unit tidak terjaring lingkup mana pun.
  await sebagaiAdmin(
    db,
    `update users set role = 'Staff',
            unit_id = (select id from units where kode = 'affiliator')
      where nama = 'Farhan Pratama'`,
  );
  const { rows } = await sebagaiAdmin(db, "select role from users where nama = 'Farhan Pratama'");
  harusSama(rows[0].role, "Staff");
  await sebagaiAdmin(
    db,
    "update users set role = 'Manager', unit_id = null where nama = 'Farhan Pratama'",
  );
});

uji("anggota nonaktif tetap menyimpan riwayatnya", async () => {
  const orang = await id("Rian Hidayat");
  const sebelum = (
    await sebagaiAdmin(db, "select count(*)::int n from daily_reports where user_id = $1", [orang])
  ).rows[0].n;
  harus(sebelum > 0, "Rian harus punya riwayat laporan");

  await sebagaiAdmin(db, "update users set status = 'nonaktif' where id = $1", [orang]);
  const sesudah = (
    await sebagaiAdmin(db, "select count(*)::int n from daily_reports where user_id = $1", [orang])
  ).rows[0].n;
  harusSama(sesudah, sebelum);
  await sebagaiAdmin(db, "update users set status = 'aktif' where id = $1", [orang]);
  await terapkanSeed(db);
});

uji("menonaktifkan PIC melepaskan akunnya", async () => {
  // Kalau tidak dilepas, akun itu terus menagih laporan harian kepada
  // orang yang sudah tidak aktif, tanpa tanda apa pun di layar.
  const orang = await id("Rian Hidayat");
  const sebelum = (
    await sebagaiAdmin(db, "select count(*)::int n from accounts where pic_user_id = $1", [orang])
  ).rows[0].n;
  harus(sebelum > 0, "Rian harus memegang akun di seed");

  await sebagaiAdmin(db, "update users set status = 'nonaktif' where id = $1", [orang]);

  const sesudah = (
    await sebagaiAdmin(db, "select count(*)::int n from accounts where pic_user_id = $1", [orang])
  ).rows[0].n;
  harusSama(sesudah, 0);
  harusSama(
    (await sebagaiAdmin(db, "select wajib_lapor_harian($1) w", [orang])).rows[0].w,
    false,
  );

  await sebagaiAdmin(db, "update users set status = 'aktif' where id = $1", [orang]);
  await terapkanSeed(db);
});

uji("program harus milik unit orangnya", async () => {
  const orang = await id("Rizky Ananda"); // Staff MCN
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `update users set program_id = (select id from programs where nama = 'Mabit Scholar')
         where id = $1`,
        [orang],
      ),
    "program unit lain seharusnya ditolak",
  );
});

uji("program milik unitnya sendiri diterima", async () => {
  const orang = await id("Rizky Ananda");
  await sebagaiAdmin(
    db,
    `update users set program_id = (select id from programs where nama = 'MMC') where id = $1`,
    [orang],
  );
  const { rows } = await sebagaiAdmin(
    db,
    `select p.nama from users u join programs p on p.id = u.program_id where u.id = $1`,
    [orang],
  );
  harusSama(rows[0].nama, "MMC");
  await terapkanSeed(db);
});

uji("program tanpa unit ditolak", async () => {
  const orang = await id("Farhan Pratama"); // Manager, lintas unit
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `update users set program_id = (select id from programs where nama = 'MMC') where id = $1`,
        [orang],
      ),
    "program tanpa unit seharusnya ditolak",
  );
});

uji("program akun harus milik unit akun", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `update accounts set program_id = (select id from programs where nama = 'MMC')
         where username = '@skincare_official'`,
      ),
    "program unit lain pada akun seharusnya ditolak",
  );
});

uji("rantai atasan yang berputar ditolak", async () => {
  // A→B→A membuat penelusuran atasan berputar tanpa henti, dan fungsi
  // `atasan_dari()` dipakai policy RLS.
  const dewi = await id("Dewi Lestari");
  const rian = await id("Rian Hidayat"); // bawahan Dewi
  await harusDitolak(
    () => sebagaiAdmin(db, "update users set atasan_id = $1 where id = $2", [rian, dewi]),
    "siklus atasan seharusnya ditolak",
  );
});

uji("siklus tidak langsung pun ditolak", async () => {
  const farhan = await id("Farhan Pratama");
  const rian = await id("Rian Hidayat"); // Rian → Dewi → Farhan
  await harusDitolak(
    () => sebagaiAdmin(db, "update users set atasan_id = $1 where id = $2", [rian, farhan]),
    "siklus tiga tingkat seharusnya ditolak",
  );
});

uji("atasan yang wajar tetap diterima", async () => {
  const galih = await id("Galih Prakoso");
  const anisa = await id("Anisa Larasati");
  await sebagaiAdmin(db, "update users set atasan_id = $1 where id = $2", [galih, anisa]);
  const { rows } = await sebagaiAdmin(db, "select atasan_id from users where id = $1", [anisa]);
  harusSama(rows[0].atasan_id, galih);
  await terapkanSeed(db);
});

uji("garis pelaporan tidak pernah terbalik", async () => {
  // Atasan harus berperan lebih luas daripada bawahannya; CEO puncaknya.
  // Data yang terbalik membuat wewenang menugasi dan menyetujui izin
  // jatuh ke orang yang salah.
  const urutan = {
    CEO: 0,
    Manager: 1,
    Leader: 2,
    "Co-Leader": 3,
    Staff: 4,
    Finance: 4,
  };

  const { rows } = await sebagaiAdmin(
    db,
    `select b.nama bawahan, b.role peran_bawahan, a.nama atasan, a.role peran_atasan
       from users b join users a on a.id = b.atasan_id`,
  );

  for (const r of rows) {
    harus(
      urutan[r.peran_atasan] < urutan[r.peran_bawahan],
      `${r.atasan} (${r.peran_atasan}) tidak boleh menjadi atasan ${r.bawahan} (${r.peran_bawahan})`,
    );
  }
});

uji("CEO berada di puncak, tanpa atasan", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select nama, atasan_id from users where role = 'CEO'",
  );
  for (const r of rows) {
    harusSama(r.atasan_id, null);
  }
});

uji("pendaftar baru boleh belum ditempatkan selama nonaktif", async () => {
  // supabase/auth.sql memasukkan pendaftar sebagai Staff nonaktif tanpa
  // unit; kalau itu ditolak, pendaftarannya gagal di tengah jalan.
  await sebagaiAdmin(
    db,
    `insert into users (id, nama, email, role, jabatan, status)
     values (gen_random_uuid(), 'Pendaftar Baru', 'pendaftar@alkahfi.co.id',
             'Staff', 'Belum ditetapkan', 'nonaktif')`,
  );

  // Tapi mengaktifkannya tanpa unit tetap ditolak.
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "update users set status = 'aktif' where nama = 'Pendaftar Baru'",
      ),
    "mengaktifkan anggota tanpa unit seharusnya ditolak",
  );

  await sebagaiAdmin(
    db,
    `update users set status = 'aktif',
            unit_id = (select id from units where kode = 'tap')
      where nama = 'Pendaftar Baru'`,
  );
  harusSama(
    (await sebagaiAdmin(db, "select status from users where nama = 'Pendaftar Baru'"))
      .rows[0].status,
    "aktif",
  );
  await terapkanSeed(db);
});

uji("peran unit wajib punya unit", async () => {
  // Staf tanpa unit tidak terjaring lingkup mana pun: tak tertagih laporan
  // harian, tak muncul di layar unit, dan KPI-nya dihitung setengah.
  const unit = (await sebagaiAdmin(db, "select id from units where kode = 'mcn'")).rows[0].id;
  for (const peran of ["Leader", "Co-Leader", "Staff"]) {
    await harusDitolak(
      () =>
        sebagaiAdmin(
          db,
          `insert into users (id, nama, email, role, jabatan, unit_id, status)
           values (gen_random_uuid(), 'Tanpa Unit', 'tanpaunit@alkahfi.co.id',
                   $1, 'Uji', null, 'aktif')`,
          [peran],
        ),
      `${peran} aktif tanpa unit seharusnya ditolak`,
    );
  }
  // Dengan unit, penempatannya sah.
  await sebagaiAdmin(
    db,
    `insert into users (id, nama, email, role, jabatan, unit_id)
     values (gen_random_uuid(), 'Dengan Unit', 'denganunit@alkahfi.co.id', 'Staff', 'Uji', $1)`,
    [unit],
  );
  await terapkanSeed(db);
});

uji("CEO, Manager, dan Finance boleh lintas unit", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int n from users
      where role in ('CEO','Manager','Finance') and unit_id is null`,
  );
  harus(rows[0].n > 0, "peran lintas unit tidak boleh dipaksa punya unit");
});

uji("departemen anggota terisi dari unitnya", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select count(*)::int n from users u
      where u.unit_id is not null and u.department_id is null`,
  );
  harusSama(rows[0].n, 0, "tidak boleh ada anggota berunit tanpa departemen");
});

uji("departemen lintas unit boleh dipilih manual", async () => {
  // Staf Mabit Scholar tetap melapor lewat unit Affiliator.
  const { rows } = await sebagaiAdmin(
    db,
    `select d.nama from users u
       join departments d on d.id = u.department_id
      where u.nama = 'Salsabila Rahma'`,
  );
  harusSama(rows[0].nama, "Mabit Scholar");
});

uji("departemen unit lain ditolak", async () => {
  const deptMcn = (
    await sebagaiAdmin(
      db,
      "select department_id from units where kode = 'mcn'",
    )
  ).rows[0].department_id;
  await harusDitolak(
    () =>
      sebagaiAdmin(db, "update users set department_id = $1 where nama = 'Nabila Putri'", [
        deptMcn,
      ]),
    "departemen unit lain seharusnya ditolak",
  );
});

uji("pindah unit membawa serta departemennya", async () => {
  const mcn = (await sebagaiAdmin(db, "select id from units where kode = 'mcn'")).rows[0].id;
  await sebagaiAdmin(db, "update users set unit_id = $1 where nama = 'Nabila Putri'", [mcn]);
  const { rows } = await sebagaiAdmin(
    db,
    `select d.nama from users u join departments d on d.id = u.department_id
      where u.nama = 'Nabila Putri'`,
  );
  harusSama(rows[0].nama, "MCN");
  await terapkanSeed(db);
});

uji("atasan berperan lebih sempit ditolak", async () => {
  // Wewenang menugasi dan menyetujui izin akan jatuh ke arah yang salah.
  const staf = await id("Nabila Putri");
  const manajer = await id("Farhan Pratama");
  await harusDitolak(
    () => sebagaiAdmin(db, "update users set atasan_id = $1 where id = $2", [staf, manajer]),
    "Staff sebagai atasan Manager seharusnya ditolak",
  );
});

uji("atasan seperingkat masih diizinkan", async () => {
  // Staf senior sebagai atasan langsung tetap masuk akal di tim kecil.
  const staf = await id("Nabila Putri");
  const senior = await id("Anisa Larasati");
  await sebagaiAdmin(db, "update users set atasan_id = $1 where id = $2", [senior, staf]);
  harusSama(
    (await sebagaiAdmin(db, "select atasan_id from users where id = $1", [staf]))
      .rows[0].atasan_id,
    senior,
  );
  await terapkanSeed(db);
});

uji("atasan nonaktif ditolak", async () => {
  const staf = await id("Nabila Putri");
  const leader = await id("Dewi Lestari");
  await sebagaiAdmin(db, "update users set status = 'nonaktif' where id = $1", [leader]);
  await harusDitolak(
    () => sebagaiAdmin(db, "update users set atasan_id = $1 where id = $2", [leader, staf]),
    "atasan nonaktif seharusnya ditolak",
  );
  await terapkanSeed(db);
});

uji("menonaktifkan atasan melepaskan bawahannya", async () => {
  const leader = await id("Dewi Lestari");
  harus(
    Number(
      (await sebagaiAdmin(db, "select count(*)::int n from users where atasan_id = $1", [leader]))
        .rows[0].n,
    ) > 0,
    "Dewi harus punya bawahan di data contoh",
  );

  await sebagaiAdmin(db, "update users set status = 'nonaktif' where id = $1", [leader]);

  harusSama(
    Number(
      (await sebagaiAdmin(db, "select count(*)::int n from users where atasan_id = $1", [leader]))
        .rows[0].n,
    ),
    0,
    "bawahan tidak boleh tetap melapor ke orang nonaktif",
  );
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
