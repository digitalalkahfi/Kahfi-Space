/**
 * Pagar peran `asisten_baca` (0218).
 *
 * Yang dijaga:
 *  - SEBELUM 0218, asisten_baca memang bisa memanggil fungsi SECURITY
 *    DEFINER di skema public (masalahnya nyata, bukan dugaan);
 *  - SESUDAH 0218, tidak satu pun — di skema mana pun selain `asisten`;
 *  - hak anon dan authenticated atas setiap fungsi public PERSIS sama
 *    sebelum dan sesudah (aplikasi tidak berubah);
 *  - fungsi baru yang dibuat kelak tidak otomatis terbuka ke asisten_baca;
 *  - asisten_baca tetap tidak bisa menulis walau membuka transaksi
 *    read-write sendiri.
 */
import {
  buatDb,
  buatSuite,
  daftarMigrasi,
  harus,
  harusDitolak,
  harusSama,
  terapkanMigrasi,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const PAGAR = "0218_pagar_asisten_baca.sql";
const semua = await daftarMigrasi();
const sesudahPagar = semua.filter((f) => f > PAGAR);

// Keadaan tepat sebelum 0218.
const db = await buatDb({ saring: (f) => f < PAGAR });
const { uji, jalankan } = buatSuite("Pagar asisten_baca (0218)");

const q = async (sql, params = []) => {
  await db.exec("reset role;");
  return (await db.query(sql, params)).rows;
};

/** Fungsi SECURITY DEFINER di luar skema asisten yang bisa dipanggil sebuah peran. */
const definerTerbuka = (peran) =>
  q(
    `select n.nspname || '.' || p.oid::regprocedure::text as f
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where p.prosecdef
       and n.nspname not in ('asisten', 'pg_catalog', 'information_schema')
       and has_schema_privilege($1, n.oid, 'usage')
       and has_function_privilege($1, p.oid, 'execute')
     order by 1`,
    [peran],
  );

/** Potret hak EXECUTE sebuah peran atas SEMUA fungsi public. */
const potretHak = async (peran) =>
  Object.fromEntries(
    (
      await q(
        `select p.oid::regprocedure::text as f, has_function_privilege($1, p.oid, 'execute') as boleh
         from pg_proc p where p.pronamespace = 'public'::regnamespace order by 1`,
        [peran],
      )
    ).map((r) => [r.f, r.boleh]),
  );

const sebelum = {
  asisten: await definerTerbuka("asisten_baca"),
  anon: await potretHak("anon"),
  authenticated: await potretHak("authenticated"),
};

await terapkanMigrasi(db, PAGAR);
for (const f of sesudahPagar) await terapkanMigrasi(db, f);
await terapkanSeed(db);

/** Jalankan sebagai asisten_baca; `tulis` = sesi sengaja membuka read-write. */
async function sebagaiAsisten(sql, { tulis = false } = {}) {
  await db.exec("reset role;");
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec(`begin; set transaction ${tulis ? "read write" : "read only"}; set local role asisten_baca;`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("rollback;");
    await db.exec("reset role;");
  }
}

uji("sebelum 0218 masalahnya nyata: fungsi definer public terbuka", async () => {
  harus(sebelum.asisten.length > 50, `hanya ${sebelum.asisten.length} — tes tidak bermakna`);
});

uji("sesudah 0218: tidak ada fungsi SECURITY DEFINER di luar skema asisten yang terbuka", async () => {
  const sisa = await definerTerbuka("asisten_baca");
  harusSama(sisa.map((r) => r.f), [], "fungsi definer yang masih terbuka");
});

uji("hak anon dan authenticated atas fungsi public tidak berubah sedikit pun", async () => {
  for (const peran of ["anon", "authenticated"]) {
    const kini = await potretHak(peran);
    const beda = Object.keys(sebelum[peran]).filter((f) => sebelum[peran][f] !== kini[f]);
    harusSama(beda, [], `hak ${peran} berubah`);
    harus(Object.values(kini).filter(Boolean).length > 100, `${peran} kehilangan hampir semua hak`);
  }
});

uji("asisten_baca tetap bisa memanggil semua fungsi asisten.*", async () => {
  const [{ total, boleh }] = await q(
    `select count(*)::int as total,
            count(*) filter (where has_function_privilege('asisten_baca', p.oid, 'execute'))::int as boleh
     from pg_proc p where p.pronamespace = 'asisten'::regnamespace`,
  );
  harus(total >= 9, "fungsi asisten.* hilang");
  harusSama(boleh, total, "fungsi asisten.* yang bisa dipanggil");
  const { rows } = await sebagaiAsisten("select * from asisten.gmv_unit('2024-10-24')");
  harus(rows.length > 0, "gmv_unit kosong");
  const lapor = await sebagaiAsisten("select * from asisten.status_lapor('2024-10-24')");
  harus(lapor.rows.length > 0, "status_lapor kosong");
  // Tool GRD (0222): bisa dipanggil; seed tidak punya GRD, jadi gmv_grd boleh kosong.
  await sebagaiAsisten("select * from asisten.gmv_grd('2024-10-24')");
  const lead = await sebagaiAsisten("select * from asisten.lead_measure_pekan('2024-10-24')");
  harus(lead.rows.length > 0, "lead_measure_pekan kosong");
});

uji("semua fungsi asisten.*: SECURITY DEFINER, tidak VOLATILE, search_path tetap", async () => {
  // VOLATILE adalah satu-satunya jenis fungsi yang boleh menulis; definer
  // + search_path tetap mencegah fungsi public dibajak lewat skema lain.
  const fungsi = await q(
    `select p.oid::regprocedure::text as f, p.prosecdef, p.provolatile, p.proconfig
     from pg_proc p where p.pronamespace = 'asisten'::regnamespace order by 1`,
  );
  harus(fungsi.length >= 9, "fungsi asisten.* hilang");
  for (const r of fungsi) {
    harus(r.prosecdef, `${r.f} bukan SECURITY DEFINER`);
    harus(r.provolatile !== "v", `${r.f} VOLATILE`);
    harus((r.proconfig ?? []).includes("search_path=public"), `${r.f} tanpa search_path tetap`);
  }
});

uji("fungsi di luar cakupan ditolak: kas, komisi, scorecard, akses", async () => {
  // Harus ditolak KARENA HAK, bukan karena salah nama/argumen — kalau
  // tidak, tes ini lulus dengan alasan yang salah.
  for (const sql of [
    "select saldo_kas()",
    "select * from scorecard_tim('2024-10-24')",
    "select peran_saya()",
    "select boleh_orang(null::uuid)",
    "select sudah_lapor_harian(null::uuid, '2024-10-24')",
  ]) {
    let pesan = "";
    try {
      await sebagaiAsisten(sql);
    } catch (e) {
      pesan = e.message;
    }
    harus(/permission denied for function/.test(pesan), `${sql} → ${pesan || "TIDAK ditolak"}`);
  }
});

uji("transaksi read-write buatan sendiri tetap tidak bisa menulis", async () => {
  for (const sql of [
    "insert into tasks (judul, pembuat_id, penerima_id) select 'x', id, id from users limit 1",
    "update units set nama = 'x'",
    "delete from daily_reports",
    "create table public.coba_asisten (a int)",
    "create table asisten.coba_asisten (a int)",
    "select atur_akses_komisi(null, null)",
  ]) {
    await harusDitolak(() => sebagaiAsisten(sql, { tulis: true }), `seharusnya ditolak: ${sql}`);
  }
});

uji("fungsi SECURITY DEFINER baru tidak otomatis terbuka ke asisten_baca", async () => {
  await q(
    `create function public.uji_pagar_baru() returns int
     language sql security definer set search_path = public as 'select 1'`,
  );
  const [h] = await q(
    `select has_function_privilege('asisten_baca', 'public.uji_pagar_baru()', 'execute') as asisten,
            has_function_privilege('authenticated', 'public.uji_pagar_baru()', 'execute') as pengguna`,
  );
  harusSama(h.asisten, false, "fungsi baru terbuka ke asisten_baca");
  harusSama(h.pengguna, true, "fungsi baru tertutup bagi authenticated");
  await q("drop function public.uji_pagar_baru()");
});

uji("0218 aman dijalankan ulang", async () => {
  await terapkanMigrasi(db, PAGAR);
  harusSama((await definerTerbuka("asisten_baca")).length, 0, "terbuka lagi setelah dijalankan ulang");
});

await jalankan();
