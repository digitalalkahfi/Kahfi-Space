/**
 * Agregat GMV vs target per unit — dihitung oleh PostgreSQL, bukan aplikasi.
 * Angka acuan diambil dari referensi desain (24 Oktober 2024).
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

const { uji, jalankan } = buatSuite("Agregat GMV vs target");

const HARI_INI = "2024-10-24";
const rp = (n) => Number(n);

const ringkasan = async (userId = null) => {
  const sql = `select * from ringkasan_gmv_unit($1::date)`;
  const { rows } = userId
    ? await sebagai(db, userId, sql, [HARI_INI])
    : await sebagaiAdmin(db, sql, [HARI_INI]);
  return Object.fromEntries(rows.map((r) => [r.kode, r]));
};

const idUser = async (nama) =>
  (await sebagaiAdmin(db, `select id from users where nama = $1`, [nama]))
    .rows[0].id;

uji("GMV hari ini per unit sesuai referensi desain", async () => {
  const r = await ringkasan();
  harusSama(rp(r.affiliator.gmv_hari_ini), 18_400_000, "Affiliator");
  harusSama(rp(r.mcn.gmv_hari_ini), 11_200_000, "MCN");
  harusSama(rp(r.tap.gmv_hari_ini), 4_600_000, "TAP");
});

uji("GMV kemarin per unit sesuai referensi desain", async () => {
  const r = await ringkasan();
  harusSama(rp(r.affiliator.gmv_kemarin), 15_600_000, "Affiliator");
  harusSama(rp(r.mcn.gmv_kemarin), 9_400_000, "MCN");
  harusSama(rp(r.tap.gmv_kemarin), 3_900_000, "TAP");
});

uji("total GMV hari ini 34,20 Jt", async () => {
  const r = await ringkasan();
  const total = Object.values(r).reduce((a, x) => a + rp(x.gmv_hari_ini), 0);
  harusSama(total, 34_200_000);
});

uji("target harian = target bulanan dibagi jumlah hari", async () => {
  const r = await ringkasan();
  harusSama(rp(r.affiliator.target_harian), 20_000_000, "Affiliator");
  harusSama(rp(r.mcn.target_harian), 12_500_000, "MCN");
  harusSama(rp(r.tap.target_harian), 5_000_000, "TAP");
});

uji("GMV unit menjumlahkan laporan akun di dalamnya", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select coalesce(sum(r.gmv),0) total
     from daily_reports r join accounts a on a.id = r.account_id
     where r.tanggal = $1 and a.unit_id = (select id from units where kode='affiliator')`,
    [HARI_INI],
  );
  harusSama(rp(rows[0].total), 18_400_000);
});

uji("akumulasi bulan berjalan tidak melebihi target bulanan", async () => {
  const r = await ringkasan();
  for (const [kode, x] of Object.entries(r)) {
    harus(
      rp(x.gmv_bulan_ini) > 0 && rp(x.gmv_bulan_ini) < rp(x.target_bulanan),
      `${kode}: akumulasi ${x.gmv_bulan_ini} vs target ${x.target_bulanan}`,
    );
  }
});

uji("Staff hanya ikut menghitung GMV akun yang ia pegang", async () => {
  const rian = await idUser("Rian Hidayat"); // PIC 2 akun affiliator
  const r = await ringkasan(rian);
  const affiliator = rp(r.affiliator.gmv_hari_ini);
  harus(
    affiliator > 0 && affiliator < 18_400_000,
    `Staff seharusnya melihat sebagian saja, dapat ${affiliator}`,
  );
  harusSama(rp(r.mcn.gmv_hari_ini), 0, "Staff tidak boleh melihat GMV MCN");
});

uji("target Staff mengikuti akun yang ia pegang, bukan seluruh unit", async () => {
  const rian = await idUser("Rian Hidayat"); // @skincare 4,5 Jt + @beauty 3 Jt
  const r = await ringkasan(rian);
  harusSama(
    rp(r.affiliator.target_harian),
    7_500_000,
    "target Staff harus 7,5 Jt, bukan target unit",
  );
});

uji("target Manager tetap penuh dan tidak dobel", async () => {
  const farhan = await idUser("Farhan Pratama");
  const r = await ringkasan(farhan);
  harusSama(rp(r.affiliator.target_harian), 20_000_000, "Affiliator");
  harusSama(rp(r.mcn.target_harian), 12_500_000, "MCN pakai goal unit");
});

uji("Manager melihat angka penuh", async () => {
  const farhan = await idUser("Farhan Pratama");
  const r = await ringkasan(farhan);
  harusSama(rp(r.affiliator.gmv_hari_ini), 18_400_000);
  harusSama(rp(r.mcn.gmv_hari_ini), 11_200_000);
});

uji("Leader MCN melihat unitnya, bukan unit lain", async () => {
  const galih = await idUser("Galih Prakoso");
  const r = await ringkasan(galih);
  harusSama(rp(r.mcn.gmv_hari_ini), 11_200_000, "unit sendiri");
  harusSama(rp(r.tap.gmv_hari_ini), 0, "unit lain harus tertutup");
});

uji("laporan dobel untuk akun+tanggal yang sama ditolak", async () => {
  const rian = await idUser("Rian Hidayat");
  const akun = (
    await sebagaiAdmin(
      db,
      `select id from accounts where username = '@skincare_official'`,
    )
  ).rows[0].id;
  let ditolak = false;
  try {
    await sebagaiAdmin(
      db,
      `insert into daily_reports (user_id, tanggal, account_id, gmv)
       values ($1, $2, $3, 1000000)`,
      [rian, HARI_INI, akun],
    );
  } catch {
    ditolak = true;
  }
  harus(ditolak, "unik per (akun, tanggal) tidak bekerja");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
