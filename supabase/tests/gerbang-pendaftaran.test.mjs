/**
 * Gerbang anggota aktif (0208) + pendaftaran akun Google (0209).
 *
 * Dokumen acuan: docs/DAFTAR-GOOGLE-PERSETUJUAN.md — nomor AC/BR/E di
 * judul tiap uji merujuk ke sana.
 *
 * `supabase/auth.sql` ikut dijalankan di atas tabel `auth.users` tiruan,
 * supaya trigger akun baru (jalur A & pendaftaran) dan foreign key
 * `on update cascade` (dipakai "sambungkan") teruji persis seperti di
 * Supabase.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buatDb,
  buatSuite,
  harus,
  harusDitolak,
  harusSama,
  idNama,
  idPeran,
  pesanDb,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);

await sebagaiAdmin(
  db,
  `create table if not exists auth.users (
     id uuid primary key,
     email text not null,
     raw_user_meta_data jsonb not null default '{}'
   );`,
);
await sebagaiAdmin(
  db,
  await readFile(path.join(process.cwd(), "supabase", "auth.sql"), "utf8"),
);

const { uji, jalankan } = buatSuite("Gerbang anggota aktif & pendaftaran Google");

const ACAK = () => crypto.randomUUID();

/** Akun Auth baru, persis seperti Supabase saat orang login Google. */
async function loginGoogle(email, nama = "Calon Anggota", id = ACAK()) {
  await sebagaiAdmin(
    db,
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`,
    [id, email, JSON.stringify({ full_name: nama, avatar_url: "https://lh3.googleusercontent.com/a/x" })],
  );
  return id;
}

const jumlah = async (sql, params = []) =>
  Number((await sebagaiAdmin(db, sql, params)).rows[0].n);

const pendaftaran = async (id) =>
  (await sebagaiAdmin(db, "select * from pendaftaran_akun where id = $1", [id]))
    .rows[0];

async function galat(fn) {
  try {
    await fn();
  } catch (e) {
    return pesanDb(e);
  }
  throw new Error("seharusnya ditolak, tapi berhasil");
}

const TABEL_SENSITIF = [
  "users",
  "units",
  "attendance",
  "kpi_definitions",
  "kpi_lembar",
  "courses",
  "daily_reports",
  "tasks",
  "announcements",
];

// ---------------------------------------------------------------------
// Fase 1 — gerbang keamanan
// ---------------------------------------------------------------------

uji("AC1/E8: akun login tanpa profil tidak membaca tabel apa pun", async () => {
  const asing = ACAK();
  for (const t of TABEL_SENSITIF) {
    const { rows } = await sebagai(db, asing, `select count(*)::int n from ${t}`);
    harusSama(rows[0].n, 0, `${t} terbaca orang asing`);
  }
});

uji("AC1: akun tanpa profil tidak bisa menulis", async () => {
  const asing = ACAK();
  await harusDitolak(
    () =>
      sebagai(
        db,
        asing,
        `insert into notes (judul, isi, dibuat_oleh, visibilitas)
         values ('x', 'x', $1, 'pribadi')`,
        [asing],
      ),
    "orang asing bisa menulis catatan",
  );
});

uji("AC2/BR-03: profil nonaktif tidak membaca apa pun, termasuk miliknya", async () => {
  const yusuf = await idNama(db, "Yusuf Ramadhan");
  await sebagaiAdmin(db, "update users set status = 'nonaktif' where id = $1", [yusuf]);
  for (const t of TABEL_SENSITIF) {
    const { rows } = await sebagai(db, yusuf, `select count(*)::int n from ${t}`);
    harusSama(rows[0].n, 0, `${t} terbaca profil nonaktif`);
  }
  const { rows } = await sebagai(
    db,
    yusuf,
    "select peran_saya() p, unit_saya() u, anggota_aktif() a, status_akses_saya() s",
  );
  harusSama(rows[0], { p: null, u: null, a: false, s: "nonaktif" });
});

uji("AC2: Leader yang dinonaktifkan kehilangan cakupan bawahannya", async () => {
  const dewi = await idNama(db, "Dewi Lestari");
  const sebelum = (
    await sebagai(db, dewi, "select count(*)::int n from bawahan_saya()")
  ).rows[0].n;
  harus(sebelum > 0, "data contoh: Dewi seharusnya punya bawahan");
  await sebagaiAdmin(db, "update users set status = 'nonaktif' where id = $1", [dewi]);
  const sesudah = (
    await sebagai(db, dewi, "select count(*)::int n from bawahan_saya()")
  ).rows[0].n;
  await sebagaiAdmin(db, "update users set status = 'aktif' where id = $1", [dewi]);
  harusSama(sesudah, 0);
});

uji("AC3: anggota aktif tiap peran tetap membaca seperti sebelumnya", async () => {
  const total = await jumlah("select count(*)::int n from users");
  for (const peran of ["CEO", "Manager", "Leader", "Co-Leader", "Staff"]) {
    const id = await idPeran(db, peran);
    const { rows } = await sebagai(
      db,
      id,
      `select (select count(*)::int from users) u,
              (select count(*)::int from units) un,
              anggota_aktif() a,
              status_akses_saya() s,
              peran_saya()::text p`,
    );
    harusSama(rows[0].u, total, `${peran}: direktori users`);
    harusSama(rows[0].un, 3, `${peran}: units`);
    harusSama(rows[0].a, true, `${peran}: anggota_aktif`);
    harusSama(rows[0].s, "aktif");
    harusSama(rows[0].p, peran);
  }
});

uji("AC3: Staff aktif tetap membaca absensinya sendiri", async () => {
  const nabila = await idNama(db, "Nabila Putri");
  const admin = await jumlah(
    "select count(*)::int n from attendance where user_id = $1",
    [nabila],
  );
  const { rows } = await sebagai(
    db,
    nabila,
    "select count(*)::int n from attendance where user_id = $1",
    [nabila],
  );
  harusSama(rows[0].n, admin);
});

uji("0208: setiap tabel kecuali pendaftaran_akun punya gerbang restrictive", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select c.relname
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and c.relname <> 'pendaftaran_akun'
       and not exists (
         select 1 from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname
           and p.policyname = 'gerbang_anggota_aktif' and p.permissive = 'RESTRICTIVE'
       )`,
  );
  harusSama(rows.map((r) => r.relname), []);
});

uji("0208: tidak ada lagi policy yang hanya menuntut 'sudah login'", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select tablename || '.' || policyname t from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') ilike '%auth.uid() IS NOT NULL%'
            or coalesce(with_check, '') ilike '%auth.uid() IS NOT NULL%')`,
  );
  harusSama(rows.map((r) => r.t), []);
});

uji("0208: papan peringkat KPI tidak terbaca akun tanpa profil", async () => {
  const asing = ACAK();
  const { rows } = await sebagai(
    db,
    asing,
    "select count(*)::int n from papan_kpi(date '2026-10-01')",
  );
  harusSama(rows[0].n, 0);
});

// ---------------------------------------------------------------------
// Fase 2 — pendaftaran
// ---------------------------------------------------------------------

uji("AC4: email Google tak dikenal → 1 pendaftaran menunggu, 0 profil", async () => {
  const profilSebelum = await jumlah("select count(*)::int n from users");
  const id = await loginGoogle("calon.satu@gmail.com", "Calon Satu");
  harusSama(await jumlah("select count(*)::int n from users"), profilSebelum);
  const p = await pendaftaran(id);
  harusSama(
    [p.status, p.email, p.nama_google],
    ["menunggu", "calon.satu@gmail.com", "Calon Satu"],
  );
  const { rows } = await sebagai(db, id, "select status_akses_saya() s");
  harusSama(rows[0].s, "menunggu");
});

uji("E2: login dua kali tetap satu baris pendaftaran", async () => {
  const id = ACAK();
  await loginGoogle("calon.dua@gmail.com", "Calon Dua", id);
  // Login kedua memakai akun Auth yang sama; kalaupun pencatatannya
  // terulang, kunci utama menahannya tetap satu baris.
  await sebagaiAdmin(
    db,
    `insert into pendaftaran_akun (id, email, nama_google)
     values ($1, 'calon.dua@gmail.com', 'Calon Dua') on conflict (id) do nothing`,
    [id],
  );
  harusSama(
    await jumlah("select count(*)::int n from pendaftaran_akun where id = $1", [id]),
    1,
  );
});

uji("AC5/jalur A: email sama dengan profil aktif → langsung tersambung", async () => {
  const nabila = await idNama(db, "Nabila Putri");
  const absen = await jumlah(
    "select count(*)::int n from attendance where user_id = $1",
    [nabila],
  );
  const id = await loginGoogle("Nabila@alkahfi.co.id", "Nabila");
  harusSama(await jumlah("select count(*)::int n from users where id = $1", [id]), 1);
  harusSama(await jumlah("select count(*)::int n from pendaftaran_akun where id = $1", [id]), 0);
  harusSama(
    await jumlah("select count(*)::int n from attendance where user_id = $1", [id]),
    absen,
    "riwayat absensi ikut pindah",
  );
  const { rows } = await sebagai(db, id, "select status_akses_saya() s");
  harusSama(rows[0].s, "aktif");
});

uji("BR-08/E6: jalur A ke profil nonaktif tetap tidak aktif", async () => {
  const id = await loginGoogle("yusuf@alkahfi.co.id", "Yusuf");
  const { rows } = await sebagai(
    db,
    id,
    "select status_akses_saya() s, (select count(*)::int from users) n",
  );
  harusSama(rows[0], { s: "nonaktif", n: 0 });
});

uji("auth.sql: profil yang sudah punya akun login tidak diambil alih", async () => {
  const idLama = await loginGoogle("bayu@alkahfi.co.id", "Bayu"); // jalur A
  // Email profilnya lalu dipakai akun lain (mis. dibuat ulang di Auth).
  const idBaru = ACAK();
  await sebagaiAdmin(db, "update auth.users set email = 'bayu.lama@x.id' where id = $1", [idLama]);
  await loginGoogle("bayu@alkahfi.co.id", "Bayu Palsu", idBaru);
  harusSama(await jumlah("select count(*)::int n from users where id = $1", [idLama]), 1);
  harusSama((await pendaftaran(idBaru)).status, "menunggu");
});

uji("RLS: calon hanya membaca & mengisi pendaftarannya sendiri", async () => {
  const a = await loginGoogle("calon.a@gmail.com", "Calon A");
  const b = await loginGoogle("calon.b@gmail.com", "Calon B");
  const { rows } = await sebagai(db, a, "select id from pendaftaran_akun");
  harusSama(rows.map((r) => r.id), [a]);

  await sebagai(
    db,
    a,
    `update pendaftaran_akun set no_wa = '6281234567890', unit_diajukan = 'mcn',
       catatan = 'Rekomendasi Bu Dewi' where id = $1`,
    [a],
  );
  harusSama((await pendaftaran(a)).no_wa, "6281234567890");

  // Baris orang lain tidak tersentuh.
  await sebagai(db, a, "update pendaftaran_akun set catatan = 'iseng' where id = $1", [b]);
  harusSama((await pendaftaran(b)).catatan, null);
});

uji("RLS: calon tidak bisa menyetujui dirinya sendiri", async () => {
  const a = await loginGoogle("calon.curang@gmail.com", "Calon Curang");
  await harusDitolak(
    () =>
      sebagai(db, a, "update pendaftaran_akun set status = 'disetujui' where id = $1", [a]),
    "kolom keputusan seharusnya tidak bisa ditulis klien",
  );
  await harusDitolak(
    () =>
      sebagai(
        db,
        a,
        `insert into pendaftaran_akun (id, email, nama_google) values ($1, 'x@y.id', 'X')`,
        [ACAK()],
      ),
    "insert seharusnya hanya dari trigger",
  );
  await harusDitolak(
    () => sebagai(db, a, "delete from pendaftaran_akun where id = $1", [a]),
    "delete seharusnya tidak ada",
  );
  harusSama((await pendaftaran(a)).status, "menunggu");
});

uji("BR-01: hanya CEO/Manager yang membaca daftar pendaftaran", async () => {
  const total = await jumlah("select count(*)::int n from pendaftaran_akun");
  const manager = await idPeran(db, "Manager");
  const leader = await idPeran(db, "Leader");
  const m = await sebagai(db, manager, "select count(*)::int n from pendaftaran_akun");
  const l = await sebagai(db, leader, "select count(*)::int n from pendaftaran_akun");
  harusSama([m.rows[0].n, l.rows[0].n], [total, 0]);
});

uji("Notifikasi in-app ke setiap CEO & Manager aktif, tanpa antrean WA", async () => {
  const sebelum = await jumlah(
    "select count(*)::int n from notifications where kategori = 'anggota'",
  );
  const penerima = await jumlah(
    "select count(*)::int n from users where status = 'aktif' and role in ('CEO','Manager')",
  );
  await loginGoogle("calon.notif@gmail.com", "Calon Notif");
  harusSama(
    await jumlah("select count(*)::int n from notifications where kategori = 'anggota'"),
    sebelum + penerima,
  );
  harusSama(
    await jumlah(
      `select count(*)::int n from notification_delivery d
       join notifications n on n.id = d.notification_id
       where n.kategori = 'anggota'`,
    ),
    0,
  );
});

// ---------------------------------------------------------------------
// Persetujuan
// ---------------------------------------------------------------------

const affiliator = async () =>
  (await sebagaiAdmin(db, "select id from units where kode = 'affiliator'")).rows[0].id;

async function setujuiBaru(approver, id, status = "menunggu") {
  const dewi = await idNama(db, "Dewi Lestari");
  return sebagai(
    db,
    approver,
    `select setujui_pendaftaran_baru($1, $2, 'Anggota Baru Google', 'Staff',
       'Staff Affiliator', $3, null, null, $4)`,
    [id, status, await affiliator(), dewi],
  );
}

uji("AC7: Manager menyetujui sebagai anggota baru", async () => {
  const id = await loginGoogle("baru.google@gmail.com", "Baru Google");
  const manager = await idPeran(db, "Manager");
  await setujuiBaru(manager, id);

  const u = (
    await sebagaiAdmin(db, "select status, role, email from users where id = $1", [id])
  ).rows[0];
  harusSama(u, { status: "aktif", role: "Staff", email: "baru.google@gmail.com" });
  const p = await pendaftaran(id);
  harusSama(
    [p.status, p.cara, p.profil_id, p.diputuskan_oleh, p.diputuskan_pada !== null],
    ["disetujui", "baru", id, manager, true],
  );
  const { rows } = await sebagai(
    db,
    id,
    "select status_akses_saya() s, (select count(*)::int from units) n",
  );
  harusSama(rows[0], { s: "aktif", n: 3 });
});

uji("E1/AC11: persetujuan kedua ditolak dengan nama pemutusnya", async () => {
  const id = await loginGoogle("dobel@gmail.com", "Dobel");
  const manager = await idPeran(db, "Manager");
  const ceo = await idPeran(db, "CEO");
  const namaManager = (
    await sebagaiAdmin(db, "select nama from users where id = $1", [manager])
  ).rows[0].nama;
  await setujuiBaru(manager, id);
  const pesan = await galat(() => setujuiBaru(ceo, id));
  harus(
    pesan.includes(`sudah diputuskan oleh ${namaManager}`),
    `pesan tidak menyebut pemutusnya: ${pesan}`,
  );
  harusSama((await pendaftaran(id)).diputuskan_oleh, manager);
});

uji("AC9: Leader dan Staff tidak bisa memutuskan", async () => {
  const id = await loginGoogle("leader.coba@gmail.com", "Leader Coba");
  for (const peran of ["Leader", "Staff"]) {
    const orang = await idPeran(db, peran);
    const pesan = await galat(() => setujuiBaru(orang, id));
    harus(pesan.includes("Hanya CEO atau Manager"), pesan);
    const tolak = await galat(() =>
      sebagai(db, orang, "select tolak_pendaftaran($1, 'bukan anggota')", [id]),
    );
    harus(tolak.includes("Hanya CEO atau Manager"), tolak);
  }
  harusSama((await pendaftaran(id)).status, "menunggu");
});

uji("BR-01: Manager yang dinonaktifkan tidak bisa memutuskan", async () => {
  const id = await loginGoogle("mgr.nonaktif@gmail.com", "X");
  const manager = await idPeran(db, "Manager");
  await sebagaiAdmin(db, "update users set status = 'nonaktif' where id = $1", [manager]);
  const pesan = await galat(() =>
    sebagai(db, manager, "select tolak_pendaftaran($1, 'tidak dikenal')", [id]),
  );
  await sebagaiAdmin(db, "update users set status = 'aktif' where id = $1", [manager]);
  harus(pesan.includes("Hanya CEO atau Manager"), pesan);
});

uji("AC10/BR-07: menolak wajib beralasan minimal 5 huruf", async () => {
  const id = await loginGoogle("tolak@gmail.com", "Tolak");
  const ceo = await idPeran(db, "CEO");
  for (const alasan of ["", "   ", "ab 12"]) {
    const pesan = await galat(() =>
      sebagai(db, ceo, "select tolak_pendaftaran($1, $2)", [id, alasan]),
    );
    harus(pesan.includes("Isi alasan penolakan"), pesan);
  }
  await sebagai(db, ceo, "select tolak_pendaftaran($1, 'Tidak dikenal tim')", [id]);
  const p = await pendaftaran(id);
  harusSama([p.status, p.alasan_tolak, p.diputuskan_oleh], ["ditolak", "Tidak dikenal tim", ceo]);
  const { rows } = await sebagai(db, id, "select status_akses_saya() s");
  harusSama(rows[0].s, "ditolak");
});

uji("BR-09: yang ditolak tidak bisa mengubah isiannya, tetapi approver bisa menyetujuinya kemudian", async () => {
  const id = await loginGoogle("tolak.lalu.setuju@gmail.com", "TLS");
  const ceo = await idPeran(db, "CEO");
  await sebagai(db, ceo, "select tolak_pendaftaran($1, 'Belum dikenal')", [id]);

  await sebagai(db, id, "update pendaftaran_akun set catatan = 'tolong' where id = $1", [id]);
  harusSama((await pendaftaran(id)).catatan, null);

  // Dari tab Menunggu (status awal 'menunggu') → sudah diputuskan.
  const pesan = await galat(() => setujuiBaru(ceo, id, "menunggu"));
  harus(pesan.includes("sudah diputuskan"), pesan);
  // Dari tab Ditolak.
  await setujuiBaru(ceo, id, "ditolak");
  const p = await pendaftaran(id);
  harusSama([p.status, p.alasan_tolak], ["disetujui", null]);
});

uji("E4: atasan yang nonaktif ditolak", async () => {
  const id = await loginGoogle("atasan.off@gmail.com", "Atasan Off");
  const ceo = await idPeran(db, "CEO");
  const dewi = await idNama(db, "Dewi Lestari");
  await sebagaiAdmin(db, "update users set status = 'nonaktif' where id = $1", [dewi]);
  const pesan = await galat(() => setujuiBaru(ceo, id));
  await sebagaiAdmin(db, "update users set status = 'aktif' where id = $1", [dewi]);
  harus(pesan.includes("nonaktif"), pesan);
  harusSama((await pendaftaran(id)).status, "menunggu");
  harusSama(await jumlah("select count(*)::int n from users where id = $1", [id]), 0);
});

uji("AC8: sambungkan ke profil lama — id & email pindah, riwayat ikut", async () => {
  const anisa = await idNama(db, "Anisa Larasati");
  const absen = await jumlah(
    "select count(*)::int n from attendance where user_id = $1",
    [anisa],
  );
  const tugas = await jumlah(
    "select count(*)::int n from tasks where penerima_id = $1",
    [anisa],
  );
  harus(absen + tugas > 0, "data contoh: Anisa seharusnya punya riwayat");

  const id = await loginGoogle("anisa.pribadi@gmail.com", "Anisa L");
  const manager = await idPeran(db, "Manager");
  await sebagai(db, manager, "select sambungkan_pendaftaran($1, 'menunggu', $2)", [
    id,
    anisa,
  ]);

  const u = (
    await sebagaiAdmin(db, "select nama, email from users where id = $1", [id])
  ).rows[0];
  harusSama(u, { nama: "Anisa Larasati", email: "anisa.pribadi@gmail.com" });
  harusSama(await jumlah("select count(*)::int n from users where id = $1", [anisa]), 0);
  harusSama(
    await jumlah("select count(*)::int n from attendance where user_id = $1", [id]),
    absen,
  );
  harusSama(
    await jumlah("select count(*)::int n from tasks where penerima_id = $1", [id]),
    tugas,
  );
  const p = await pendaftaran(id);
  harusSama([p.status, p.cara, p.profil_id], ["disetujui", "sambung", id]);
});

uji("E3: profil yang sudah punya akun login tidak bisa disambungkan", async () => {
  const intan = await idNama(db, "Intan Permata");
  // Intan sudah login (akun Auth dengan id profilnya).
  await sebagaiAdmin(
    db,
    "insert into auth.users (id, email) values ($1, 'intan.akun@x.id')",
    [intan],
  );
  const id = await loginGoogle("intan.lain@gmail.com", "Intan");
  const ceo = await idPeran(db, "CEO");
  const pesan = await galat(() =>
    sebagai(db, ceo, "select sambungkan_pendaftaran($1, 'menunggu', $2)", [id, intan]),
  );
  harus(pesan.includes("sudah punya akun login"), pesan);
  harusSama((await pendaftaran(id)).status, "menunggu");
});

uji("BR-05: profil nonaktif tidak bisa disambungkan", async () => {
  // Yusuf sudah tersambung lewat jalur A di uji sebelumnya; dipakai
  // profil nonaktif baru tanpa akun login.
  const lama = ACAK();
  await sebagaiAdmin(
    db,
    `insert into users (id, nama, email, role, jabatan, status)
     values ($1, 'Profil Nonaktif', 'nonaktif.lama@alkahfi.co.id', 'Staff', 'Staff', 'nonaktif')`,
    [lama],
  );
  const id = await loginGoogle("nonaktif.baru@gmail.com", "NB");
  const ceo = await idPeran(db, "CEO");
  const pesan = await galat(() =>
    sebagai(db, ceo, "select sambungkan_pendaftaran($1, 'menunggu', $2)", [id, lama]),
  );
  harus(pesan.includes("nonaktif"), pesan);
});

uji("E7: email Google yang sudah dipakai profil lain ditolak dengan nama pemakainya", async () => {
  const id = ACAK();
  // Pendaftaran dibuat langsung: lewat trigger, email yang sudah dipakai
  // profil justru tersambung otomatis (jalur A).
  await sebagaiAdmin(
    db,
    `insert into pendaftaran_akun (id, email, nama_google)
     values ($1, 'rizky@alkahfi.co.id', 'Rizky Kedua')`,
    [id],
  );
  const fajar = await idNama(db, "Fajar Ramadhan");
  const ceo = await idPeran(db, "CEO");
  const pesan = await galat(() =>
    sebagai(db, ceo, "select sambungkan_pendaftaran($1, 'menunggu', $2)", [id, fajar]),
  );
  harus(pesan.includes("Rizky Ananda"), pesan);
});

uji("Pindah id: Manager dengan bawahan & tugas pribadi pindah utuh, penjaga kembali", async () => {
  const farhan = await idNama(db, "Farhan Pratama");
  const bawahan = await jumlah(
    "select count(*)::int n from users where atasan_id = $1",
    [farhan],
  );
  const pribadi = await jumlah(
    "select count(*)::int n from tasks where tipe = 'pribadi' and pembuat_id = $1",
    [farhan],
  );
  const baru = await loginGoogle("farhan@alkahfi.co.id", "Farhan"); // jalur A
  harusSama(
    await jumlah("select count(*)::int n from users where atasan_id = $1", [baru]),
    bawahan,
  );
  harusSama(
    await jumlah(
      "select count(*)::int n from tasks where tipe = 'pribadi' and pembuat_id = $1 and penerima_id = $1",
      [baru],
    ),
    pribadi,
  );
  harusSama(
    await jumlah(
      `select count(*)::int n from pg_trigger t join pg_class c on c.oid = t.tgrelid
       join pg_namespace s on s.oid = c.relnamespace
       where s.nspname = 'public' and not t.tgisinternal and t.tgenabled = 'D'`,
    ),
    0,
    "ada trigger yang tertinggal mati",
  );
  harusSama(
    await jumlah(
      "select count(*)::int n from pg_constraint where conname = 'tasks_pribadi_milik_sendiri'",
    ),
    1,
    "CHECK tugas pribadi tidak terpasang lagi",
  );
});

uji("Klien tidak bisa memanggil penolong internal", async () => {
  const ceo = await idPeran(db, "CEO");
  await harusDitolak(
    () => sebagai(db, ceo, "select pindahkan_id_profil($1, $2)", [ceo, ACAK()]),
    "pindahkan_id_profil seharusnya tertutup",
  );
  await harusDitolak(
    () => sebagai(db, ceo, "select kunci_pendaftaran($1, 'menunggu')", [ACAK()]),
    "kunci_pendaftaran seharusnya tertutup",
  );
});

await jalankan();
await db.close();
