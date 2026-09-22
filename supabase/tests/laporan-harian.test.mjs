/** Laporan harian: sasaran, kewenangan melapor, dan jejak revisi. */
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
const { uji, jalankan } = buatSuite("Laporan harian");

const BESOK = "2024-10-25";
const idUser = async (n) =>
  (await sebagaiAdmin(db, `select id from users where nama=$1`, [n])).rows[0].id;
const idAkun = async (u) =>
  (await sebagaiAdmin(db, `select id from accounts where username=$1`, [u]))
    .rows[0].id;
const idUnit = async (k) =>
  (await sebagaiAdmin(db, `select id from units where kode=$1`, [k])).rows[0].id;

const U = {
  manager: await idUser("Farhan Pratama"),
  leaderMcn: await idUser("Galih Prakoso"),
  leaderTap: await idUser("Dimas Maulana"),
  rian: await idUser("Rian Hidayat"),
  nabila: await idUser("Nabila Putri"),
  anisa: await idUser("Anisa Larasati"),
};
const A = {
  skincare: await idAkun("@skincare_official"),
  fashion: await idAkun("@fashion_hijab"),
};
const UN = { mcn: await idUnit("mcn"), tap: await idUnit("tap") };

uji("laporan wajib punya tepat satu sasaran", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into daily_reports (user_id, tanggal, gmv) values ($1,$2,1000)`,
        [U.rian, BESOK],
      ),
    "tanpa sasaran seharusnya ditolak",
  );
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into daily_reports (user_id, tanggal, account_id, unit_id, gmv)
         values ($1,$2,$3,$4,1000)`,
        [U.rian, BESOK, A.skincare, UN.mcn],
      ),
    "dua sasaran sekaligus seharusnya ditolak",
  );
});

uji("GMV negatif ditolak", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into daily_reports (user_id, tanggal, account_id, gmv)
         values ($1,$2,$3,-1)`,
        [U.rian, BESOK, A.skincare],
      ),
    "check gmv >= 0 tidak bekerja",
  );
});

uji("GMV di luar batas wajar ditolak", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into daily_reports (user_id, tanggal, account_id, gmv)
         values ($1,$2,$3,999999999999)`,
        [U.rian, BESOK, A.skincare],
      ),
    "pagar kewajaran GMV tidak bekerja",
  );
});

uji("PIC boleh melapor untuk akunnya", async () => {
  await sebagai(
    db,
    U.rian,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, catatan)
     values ($1,$2,$3,4600000,'Live sore stabil.')`,
    [U.rian, BESOK, A.skincare],
  );
});

uji("Staff tidak boleh melapor untuk akun orang lain", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.anisa,
        `insert into daily_reports (user_id, tanggal, account_id, gmv)
         values ($1,$2,$3,1000000)`,
        [U.anisa, BESOK, A.fashion],
      ),
    "Anisa bukan PIC @fashion_hijab",
  );
});

uji("Leader boleh melapor untuk unitnya", async () => {
  await sebagai(
    db,
    U.leaderMcn,
    `insert into daily_reports (user_id, tanggal, unit_id, gmv)
     values ($1,$2,$3,11000000)`,
    [U.leaderMcn, BESOK, UN.mcn],
  );
});

uji("Leader tidak boleh melapor untuk unit lain", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.leaderMcn,
        `insert into daily_reports (user_id, tanggal, unit_id, gmv)
         values ($1,$2,$3,5000000)`,
        [U.leaderMcn, BESOK, UN.tap],
      ),
    "Leader MCN seharusnya tidak bisa melapor untuk TAP",
  );
});

uji("Staff tidak bisa melapor atas nama orang lain", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.anisa,
        `insert into daily_reports (user_id, tanggal, account_id, gmv)
         values ($1,$2,$3,1000000)`,
        [U.rian, BESOK, A.skincare],
      ),
    "user_id harus dirinya sendiri",
  );
});

uji("mengubah GMV otomatis membuat jejak revisi", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select id, gmv from daily_reports
     where account_id=$1 and tanggal=$2`,
    [A.skincare, BESOK],
  );
  const id = rows[0].id;

  await sebagaiAdmin(db, `select set_config('app.alasan_revisi', $1, false)`, [
    "Ada 3 pesanan masuk setelah cutoff yang belum terhitung.",
  ]);
  await sebagai(db, U.rian, `update daily_reports set gmv = 5100000 where id=$1`, [
    id,
  ]);

  const { rows: jejak } = await sebagaiAdmin(
    db,
    `select gmv_lama, gmv_baru, alasan, diubah_oleh from daily_report_revisions
     where report_id=$1`,
    [id],
  );
  harusSama(jejak.length, 1, "harus ada tepat satu jejak");
  harusSama(Number(jejak[0].gmv_lama), 4600000);
  harusSama(Number(jejak[0].gmv_baru), 5100000);
  harus(jejak[0].alasan.includes("cutoff"), "alasan harus tercatat");
  harusSama(jejak[0].diubah_oleh, U.rian, "pengubah harus tercatat");
});

uji("status berubah jadi 'revisi' setelah angka diperbaiki", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select status from daily_reports where account_id=$1 and tanggal=$2`,
    [A.skincare, BESOK],
  );
  harusSama(rows[0].status, "revisi");
});

uji("mengubah catatan saja tidak membuat jejak revisi", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select id from daily_reports where account_id=$1 and tanggal=$2`,
    [A.skincare, BESOK],
  );
  await sebagai(
    db,
    U.rian,
    `update daily_reports set catatan='Catatan diperjelas.' where id=$1`,
    [rows[0].id],
  );
  const { rows: jejak } = await sebagaiAdmin(
    db,
    `select count(*)::int n from daily_report_revisions where report_id=$1`,
    [rows[0].id],
  );
  harusSama(Number(jejak[0].n), 1, "jejak tidak boleh bertambah");
});

uji("jejak revisi tidak bisa ditulis langsung oleh pengguna", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select id from daily_reports where account_id=$1 and tanggal=$2`,
    [A.skincare, BESOK],
  );
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.rian,
        `insert into daily_report_revisions (report_id, gmv_lama, gmv_baru, alasan)
         values ($1, 1, 2, 'Memalsukan jejak revisi')`,
        [rows[0].id],
      ),
    "jejak revisi hanya boleh lahir dari trigger",
  );
});

uji("jejak revisi tidak bisa dihapus", async () => {
  let ditolak = false;
  try {
    const r = await sebagai(
      db,
      U.rian,
      `delete from daily_report_revisions`,
    );
    ditolak = (r.affectedRows ?? 0) === 0;
  } catch {
    ditolak = true;
  }
  harus(ditolak, "jejak revisi seharusnya tidak bisa dihapus");
});

uji("alasan revisi terlalu pendek ditolak", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into daily_report_revisions (report_id, gmv_lama, gmv_baru, alasan)
         select id, 1, 2, 'x' from daily_reports limit 1`,
      ),
    "check panjang alasan tidak bekerja",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
