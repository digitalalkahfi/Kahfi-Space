/**
 * Audit menyeluruh Row Level Security.
 *
 * Bukan menguji satu fitur, tapi memeriksa bentuk pertahanannya: setiap tabel
 * wajib punya RLS + policy, pengunjung tanpa sesi tidak boleh membaca apa pun,
 * dan tidak ada policy yang terbuka lebar tanpa syarat.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Audit RLS");

const TABEL = (
  await sebagaiAdmin(
    db,
    `select c.relname, c.relrowsecurity rls,
            (select count(*) from pg_policies p
              where p.schemaname='public' and p.tablename=c.relname) jml_policy
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' order by c.relname`,
  )
).rows;

uji("semua tabel mengaktifkan RLS", () => {
  const tanpa = TABEL.filter((t) => !t.rls).map((t) => t.relname);
  harusSama(tanpa, [], "tabel tanpa RLS");
});

uji("tidak ada tabel ber-RLS tanpa policy sama sekali", () => {
  // RLS aktif tanpa policy = tidak ada yang bisa membaca; biasanya tidak disengaja.
  const buntu = TABEL.filter((t) => Number(t.jml_policy) === 0).map(
    (t) => t.relname,
  );
  harusSama(buntu, [], "tabel ber-RLS tapi tanpa policy");
});

uji("tidak ada policy SELECT yang terbuka tanpa syarat", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select tablename, policyname, qual
     from pg_policies
     where schemaname='public' and cmd in ('SELECT','ALL')
       and (qual is null or btrim(qual) in ('true','(true)'))`,
  );
  harusSama(
    rows.map((r) => `${r.tablename}.${r.policyname}`),
    [],
    "policy baca tanpa syarat",
  );
});

uji("tidak ada policy tulis yang terbuka tanpa syarat", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select tablename, policyname
     from pg_policies
     where schemaname='public' and cmd in ('INSERT','UPDATE','ALL')
       and (with_check is not null and btrim(with_check) in ('true','(true)'))`,
  );
  harusSama(
    rows.map((r) => `${r.tablename}.${r.policyname}`),
    [],
    "policy tulis tanpa syarat",
  );
});

uji("pengunjung tanpa sesi tidak bisa membaca data apa pun", async () => {
  await db.exec("reset role;");
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec("set role anon;");

  const bocor = [];
  for (const t of TABEL) {
    try {
      const { rows } = await db.query(`select count(*)::int n from ${t.relname}`);
      if (Number(rows[0].n) > 0) bocor.push(`${t.relname} (${rows[0].n} baris)`);
    } catch {
      // ditolak = aman
    }
  }
  await db.exec("reset role;");
  harusSama(bocor, [], "data terbaca tanpa login");
});

uji("anon tidak punya hak tulis", async () => {
  await db.exec("reset role;");
  await db.exec("set role anon;");
  let ditolak = false;
  try {
    await db.query(
      `insert into announcements (slug, judul, isi, published_at)
       values ('bocor','Bocor',array['x'],now())`,
    );
  } catch {
    ditolak = true;
  }
  await db.exec("reset role;");
  harus(ditolak, "anon seharusnya tidak bisa menulis");
});

// --- cakupan data Beranda per peran -------------------------------------
const idUser = async (n) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [n])).rows[0].id;

const U = {
  ceo: await idUser("Hafidz Alkahfi"),
  manager: await idUser("Farhan Pratama"),
  leaderTap: await idUser("Dimas Maulana"),
  staffAff: await idUser("Rian Hidayat"),
  staffTap: await idUser("Yoga Saputra"),
  finance: await idUser("Laras Ayuningtyas"),
};

const hitung = async (id, sql) =>
  Number((await sebagai(db, id, sql)).rows[0].n);

uji("Staff tidak melihat laporan GMV rekan lintas unit", async () => {
  const n = await hitung(
    U.staffAff,
    `select count(*)::int n from daily_reports r
     join units u on u.id = r.unit_id where u.kode <> 'affiliator'`,
  );
  harusSama(n, 0);
});

uji("Leader TAP tidak melihat laporan akun unit Affiliator", async () => {
  const n = await hitung(
    U.leaderTap,
    `select count(*)::int n from daily_reports r
     join accounts a on a.id = r.account_id`,
  );
  harusSama(n, 0, "akun affiliator tidak boleh terbaca Leader TAP");
});

uji("Finance melihat angka lintas unit", async () => {
  const n = await hitung(
    U.finance,
    `select count(*)::int n from daily_reports`,
  );
  harus(n > 100, `Finance harus melihat angka penuh, dapat ${n}`);
});

uji("Finance tidak melihat absensi operasional orang lain", async () => {
  const n = await hitung(U.finance, `select count(*)::int n from attendance`);
  harusSama(n, 1, "Finance hanya boleh melihat absensinya sendiri");
});

uji("CEO melihat seluruh absensi", async () => {
  const n = await hitung(U.ceo, `select count(*)::int n from attendance`);
  harus(n >= 24, `CEO harus melihat semua absensi, dapat ${n}`);
});

uji("Staff hanya melihat absensi dirinya dan rekan seunit", async () => {
  const { rows } = await sebagai(
    U.staffTap ? db : db,
    U.staffTap,
    `select count(*)::int n from attendance`,
  );
  harus(
    Number(rows[0].n) >= 1 && Number(rows[0].n) < 24,
    `Staff tidak boleh melihat semua absensi, dapat ${rows[0].n}`,
  );
});

uji("Staff tidak bisa mengubah goal", async () => {
  let ditolak = false;
  try {
    const r = await sebagai(
      db,
      U.staffAff,
      `update goals set target_goal = 1 where level = 'leader'`,
    );
    ditolak = (r.affectedRows ?? 0) === 0;
  } catch {
    ditolak = true;
  }
  harus(ditolak, "Staff seharusnya tidak bisa mengubah goal");
});

uji("Staff tidak bisa mengubah profil orang lain", async () => {
  await sebagai(
    db,
    U.staffAff,
    `update users set jabatan = 'Diretas' where id = '${U.manager}'`,
  );
  const { rows } = await sebagaiAdmin(
    db,
    `select jabatan from users where id = $1`,
    [U.manager],
  );
  harus(rows[0].jabatan !== "Diretas", "profil Manager berhasil diubah Staff");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
