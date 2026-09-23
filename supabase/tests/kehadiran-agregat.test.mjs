/**
 * Agregat kehadiran untuk verifikasi migrasi.
 *
 * Total menjawab "berapa yang hilang"; per bulan menjawab "kapan"; per
 * orang menjawab "milik siapa". Tanpa ketiganya, selisih hanya bisa
 * dilihat, tidak bisa ditelusuri.
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
const { uji, jalankan } = buatSuite("Agregat kehadiran");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  ceo: (await satu(`select id from users where role='CEO' limit 1`)).id,
  staff: (await satu(`select id from users where nama='Nabila Putri'`)).id,
};

uji("hitungan per bulan berjumlah sama dengan seluruh barisnya", async () => {
  const semua = await satu(`select count(*)::int n from attendance`);
  const { rows } = await sebagaiAdmin(
    db,
    `select sum(semua)::int n from kehadiran_per_bulan()`,
  );
  harusSama(rows[0].n, semua.n);
});

uji("hadir dan izin dipisah, bukan dijumlah jadi satu", async () => {
  const { rows } = await sebagaiAdmin(db, `select * from kehadiran_per_bulan()`);
  for (const r of rows) {
    harusSama(r.hadir + r.izin, r.semua, `bulan ${r.bulan} tidak genap`);
  }
  harus(
    rows.some((r) => r.izin > 0),
    "seed harus punya izin supaya pemisahannya teruji",
  );
});

uji("hitungan per orang menyebut semua orang, termasuk yang nol", async () => {
  // Orang yang tidak punya satu pun kehadiran justru yang paling perlu
  // terlihat: bisa jadi datanya yang tidak sampai.
  const orang = await satu(`select count(*)::int n from users`);
  const { rows } = await sebagaiAdmin(db, `select * from kehadiran_per_orang()`);
  harusSama(rows.length, orang.n);
  harus(
    rows.some((r) => r.hadir === 0 && r.izin === 0),
    "orang tanpa kehadiran harus tetap disebut",
  );
});

uji("jumlah per orang sama dengan jumlah seluruh barisnya", async () => {
  const semua = await satu(`select count(*)::int n from attendance`);
  const { rows } = await sebagaiAdmin(
    db,
    `select sum(hadir + izin)::int n from kehadiran_per_orang()`,
  );
  harusSama(rows[0].n, semua.n);
});

uji("keduanya mengikuti hak akses pemanggilnya", async () => {
  const ceo = await sebagai(db, U.ceo, `select sum(semua)::int n from kehadiran_per_bulan()`);
  const staf = await sebagai(db, U.staff, `select sum(semua)::int n from kehadiran_per_bulan()`);
  harus(Number(ceo.rows[0].n) > 0, "CEO harus melihat angkanya");
  harus(
    staf.rows[0].n === null || Number(staf.rows[0].n) < Number(ceo.rows[0].n),
    "Staff tidak boleh melihat kehadiran seluruh perusahaan",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
