/**
 * GMV per unit per bulan: sisi V2 pada layar verifikasi migrasi.
 *
 * Laporan per akun mengambil unitnya dari akun; laporan per unit dari
 * dirinya sendiri. Kalau kedua jalur itu tidak bertemu di satu angka,
 * pembanding V1 vs V2 akan selalu berselisih tanpa sebab yang bisa
 * dijelaskan.
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
const { uji, jalankan } = buatSuite("GMV per unit per bulan");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  ceo: (await satu(`select id from users where role = 'CEO' limit 1`)).id,
  staff: (await satu(`select id from users where nama = 'Nabila Putri'`)).id,
};

uji("laporan per akun terhitung di unit akunnya", async () => {
  const { rows } = await sebagaiAdmin(db, `select * from gmv_unit_bulan()`);
  harus(rows.length > 0, "harus ada angka dari seed");

  const aff = rows.filter((r) => r.unit === "affiliator");
  harus(aff.length > 0, "unit affiliator harus muncul");

  // Dibandingkan dengan hitungan langsung dari tabelnya.
  const banding = await satu(
    `select coalesce(sum(d.gmv), 0)::numeric total, count(*)::int n
       from daily_reports d
       join accounts a on a.id = d.account_id
       join units u on u.id = a.unit_id
      where u.kode = 'affiliator' and to_char(d.tanggal, 'YYYY-MM') = $1`,
    [aff[0].bulan],
  );
  harusSama(Number(aff[0].gmv), Number(banding.total));
  harusSama(aff[0].laporan, banding.n);
});

uji("laporan per unit ikut terhitung di unitnya sendiri", async () => {
  const b = await satu(
    `select count(*)::int n from daily_reports where unit_id is not null`,
  );
  harus(b.n > 0, "seed harus punya laporan bersasaran unit");

  const { rows } = await sebagaiAdmin(
    db,
    `select sum(laporan)::int n from gmv_unit_bulan()`,
  );
  const semua = await satu(`select count(*)::int n from daily_reports`);
  // Tidak ada laporan yang hilang dan tidak ada yang terhitung dua kali.
  harusSama(rows[0].n, semua.n);
});

uji("bulannya dipisah, bukan dijumlah jadi satu", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select distinct bulan from gmv_unit_bulan() order by bulan`,
  );
  harus(rows.length >= 1, "bulan harus terbaca");
  for (const r of rows) harus(/^\d{4}-\d{2}$/.test(r.bulan), `bulan ${r.bulan} salah bentuk`);
});

uji("hitungannya mengikuti hak akses pemanggilnya", async () => {
  // Fungsi ini hak pemanggil: Staff hanya melihat yang boleh ia lihat,
  // bukan seluruh GMV perusahaan.
  const ceo = await sebagai(db, U.ceo, `select sum(gmv)::numeric t from gmv_unit_bulan()`);
  const staf = await sebagai(db, U.staff, `select sum(gmv)::numeric t from gmv_unit_bulan()`);
  harus(Number(ceo.rows[0].t) > 0, "CEO harus melihat angkanya");
  harus(
    staf.rows[0].t === null || Number(staf.rows[0].t) < Number(ceo.rows[0].t),
    "Staff tidak boleh melihat seluruh GMV perusahaan",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
