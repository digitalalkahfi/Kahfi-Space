/**
 * Harness verifikasi skema.
 *
 * Menjalankan seluruh migrasi Supabase di atas PGlite (PostgreSQL WASM) supaya
 * SQL-nya benar-benar dieksekusi — bukan sekadar dibaca. Objek bawaan Supabase
 * (schema auth, role, auth.uid()) di-shim di sini karena tidak ada di Postgres
 * polos; di Supabase asli objek itu sudah tersedia.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DIR_MIGRASI = path.join(process.cwd(), "supabase", "migrations");

/** Shim minimal agar migrasi yang memanggil auth.uid() bisa jalan. */
const SHIM_AUTH = `
create schema if not exists auth;

-- Supabase mengeksekusi query klien sebagai role authenticated/anon,
-- bukan sebagai pemilik tabel. Tanpa ini RLS akan dilewati diam-diam dan
-- testnya jadi bohong.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

-- Pengguna aktif disimpan di setting sesi; test mengubahnya untuk berganti peran.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Di Supabase, role klien memang boleh memanggil auth.uid()/auth.role().
grant usage on schema auth to anon, authenticated;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
$$;

grant execute on all functions in schema auth to anon, authenticated;
`;

export async function daftarMigrasi() {
  const berkas = await readdir(DIR_MIGRASI);
  return berkas.filter((f) => f.endsWith(".sql")).sort();
}

/** Bikin database bersih berisi seluruh migrasi. */
export async function buatDb({ diam = true } = {}) {
  const db = new PGlite();
  await db.exec(SHIM_AUTH);

  for (const berkas of await daftarMigrasi()) {
    const sql = await readFile(path.join(DIR_MIGRASI, berkas), "utf8");
    try {
      await db.exec(sql);
      if (!diam) console.log(`  ✓ ${berkas}`);
    } catch (e) {
      // Pesan Postgres saja; stack PGlite tidak menolong.
      const detail = [e.message, e.hint && `hint: ${e.hint}`, e.where && `di: ${e.where}`]
        .filter(Boolean)
        .join("\n");
      throw new Error(`Migrasi gagal di ${berkas}:\n${detail}`);
    }
  }
  // Hak akses seperti di Supabase: role klien boleh DML, RLS yang membatasi.
  await db.exec(`
    grant usage on schema public to anon, authenticated;
    grant select, insert, update, delete on all tables in schema public
      to authenticated;
    grant select on all tables in schema public to anon;
    grant execute on all functions in schema public to anon, authenticated;
  `);

  return db;
}

/** Terapkan supabase/seed.sql ke database uji. */
export async function terapkanSeed(db) {
  const sql = await readFile(
    path.join(process.cwd(), "supabase", "seed.sql"),
    "utf8",
  );
  await db.exec("reset role;");
  await db.exec(sql);
}

/**
 * Jalankan SQL sebagai pemilik (melewati RLS) — untuk menyiapkan data uji.
 * Tanpa parameter dipakai `exec` supaya beberapa statement sekaligus boleh.
 */
export async function sebagaiAdmin(db, sql, params = []) {
  await db.exec("reset role;");
  // Klaim JWT bersifat sesi; tanpa dibersihkan, `auth.uid()` dari
  // pemanggilan `sebagai()` sebelumnya masih terbaca di sini dan membuat
  // test lulus atau gagal karena alasan yang salah.
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  if (params.length === 0) {
    // exec() mengembalikan satu hasil per statement; yang dipakai yang terakhir.
    const hasil = await db.exec(sql);
    return hasil.at(-1) ?? { rows: [] };
  }
  return db.query(sql, params);
}

/**
 * Jalankan query sebagai pengguna tertentu dengan RLS aktif.
 * Klaim JWT di-set dulu, baru role diturunkan ke `authenticated`.
 */
export async function sebagai(db, userId, sql, params = []) {
  await db.exec("reset role;");
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [
    userId ?? "",
  ]);
  await db.exec("set role authenticated;");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role;");
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

/** Mini test runner — cukup untuk memverifikasi skema tanpa menambah framework. */
/** Pesan Postgres saja — stack trace PGlite tidak menolong saat debugging SQL. */
export function pesanDb(e) {
  if (!e) return "galat tanpa pesan";
  const bagian = [e.message];
  if (e.detail) bagian.push(`detail: ${e.detail}`);
  if (e.hint) bagian.push(`hint: ${e.hint}`);
  return bagian.join(" | ");
}

export function buatSuite(nama) {
  const kasus = [];
  let lulus = 0;
  let gagal = 0;

  return {
    uji: (judul, fn) => kasus.push({ judul, fn }),
    jalankan: async () => {
      console.log(`\n${nama}`);
      for (const { judul, fn } of kasus) {
        try {
          await fn();
          lulus += 1;
          console.log(`  ✓ ${judul}`);
        } catch (e) {
          gagal += 1;
          console.log(`  ✗ ${judul}\n      ${pesanDb(e)}`);
        }
      }
      console.log(`  → ${lulus} lulus, ${gagal} gagal`);

      // Yang menentukan hasil adalah tally di atas, bukan cara PGlite
      // membongkar runtime WASM-nya: pada berkas test yang panjang ia
      // kadang menutup diri dengan kode keluar bukan-nol walau seluruh
      // test lulus. Tanpa penegasan ini, berkas yang hijau tetap
      // dilaporkan gagal oleh runner.
      const kode = gagal > 0 ? 1 : 0;
      process.exitCode = kode;
      process.once("exit", () => {
        process.exitCode = kode;
      });

      return gagal;
    },
  };
}

export function harus(syarat, pesan) {
  if (!syarat) throw new Error(pesan);
}

export function harusSama(aktual, harapan, pesan) {
  const a = JSON.stringify(aktual);
  const h = JSON.stringify(harapan);
  if (a !== h) throw new Error(`${pesan ?? "tidak sama"}: ${a} ≠ ${h}`);
}

/** Query yang SEHARUSNYA ditolak — dipakai untuk menguji RLS. */
export async function harusDitolak(fn, pesan) {
  try {
    await fn();
  } catch {
    return;
  }
  throw new Error(pesan ?? "seharusnya ditolak, tapi berhasil");
}
