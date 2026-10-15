/**
 * Komisi rahasia (0210) — docs/KOMISI-DETAIL-AKUN-AFFILIATOR.md §4.1, §5.
 *
 * Yang dibuktikan: kolom komisi tidak terbaca klien sama sekali, dan
 * pintu resminya (`komisi_laporan`, `komisi_laporan_saya`,
 * `komisi_revisi`, `komisi_affiliator`) hanya terbuka bagi CEO/Manager,
 * serta bagi Staff untuk laporannya sendiri. GMV dan upload tetap
 * terbaca Leader seperti sebelumnya.
 */
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
const { uji, jalankan } = buatSuite("Komisi rahasia");

const id = (nama) => idNama(db, nama);
const angka = async (sql, params = []) =>
  Number((await sebagaiAdmin(db, sql, params)).rows[0].n);

const laporanMilik = async (nama) =>
  (
    await sebagaiAdmin(
      db,
      `select r.id from daily_reports r join users u on u.id = r.user_id
       where u.nama = $1 and r.komisi is not null order by r.tanggal limit 1`,
      [nama],
    )
  ).rows[0].id;

async function galat(fn) {
  try {
    await fn();
  } catch (e) {
    return pesanDb(e);
  }
  throw new Error("seharusnya ditolak, tapi berhasil");
}

/** Akun Affiliator yang PIC-nya Leader Affiliator, plus satu laporannya. */
async function laporanLeader() {
  const dewi = await id("Dewi Lestari");
  const akun = (
    await sebagaiAdmin(
      db,
      `insert into accounts (platform, username, unit_id, pic_user_id, status, created_at)
       values ('tiktok', '@akun_dewi_uji', (select id from units where kode = 'affiliator'),
               $1, 'aktif', now() - interval '30 days')
       on conflict do nothing
       returning id`,
      [dewi],
    )
  ).rows[0]?.id ??
    (await sebagaiAdmin(db, "select id from accounts where username = '@akun_dewi_uji'"))
      .rows[0].id;
  const ada = (
    await sebagaiAdmin(
      db,
      "select id from daily_reports where account_id = $1 limit 1",
      [akun],
    )
  ).rows[0];
  if (ada) return { dewi, akun, laporan: ada.id };
  const { rows } = await sebagai(
    db,
    dewi,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, komisi, jumlah_upload)
     values ($1, (now() at time zone 'Asia/Jakarta')::date - 3, $2, 2000000, 150000, 3)
     returning id`,
    [dewi, akun],
  );
  return { dewi, akun, laporan: rows[0].id };
}

// ---------------------------------------------------------------------
// Kolom terkunci (E3, AC3)
// ---------------------------------------------------------------------

uji("E3/AC3: Leader meminta kolom komisi lewat API → permission denied", async () => {
  const dewi = await id("Dewi Lestari");
  const pesan = await galat(() =>
    sebagai(db, dewi, "select komisi from daily_reports limit 1"),
  );
  harus(/permission denied/i.test(pesan), pesan);
  const bintang = await galat(() =>
    sebagai(db, dewi, "select * from daily_reports limit 1"),
  );
  harus(/permission denied/i.test(bintang), bintang);
});

uji("Kolom komisi tertutup untuk semua peran klien, termasuk CEO", async () => {
  for (const peran of ["CEO", "Manager", "Finance", "Staff", "Co-Leader"]) {
    const orang = await idPeran(db, peran);
    await harusDitolak(
      () => sebagai(db, orang, "select sum(komisi) from daily_reports"),
      `${peran} membaca kolom komisi langsung`,
    );
  }
});

uji("Jejak revisi: komisi_lama/komisi_baru juga terkunci", async () => {
  const ceo = await idPeran(db, "CEO");
  await harusDitolak(
    () => sebagai(db, ceo, "select komisi_lama from daily_report_revisions"),
    "komisi_lama terbaca",
  );
  // Kolom lain tetap terbaca.
  await sebagai(db, ceo, "select id, gmv_lama, gmv_baru from daily_report_revisions");
});

uji("Leader tetap membaca GMV dan upload bawahannya (§5)", async () => {
  const dewi = await id("Dewi Lestari");
  const rian = await id("Rian Hidayat");
  const total = await angka(
    "select count(*)::int n from daily_reports where user_id = $1",
    [rian],
  );
  const { rows } = await sebagai(
    db,
    dewi,
    `select count(*)::int n, sum(gmv) > 0 g, sum(jumlah_upload) > 0 u
     from daily_reports where user_id = $1`,
    [rian],
  );
  harusSama(rows[0], { n: total, g: true, u: true });
  const view = await sebagai(
    db,
    dewi,
    "select count(*)::int n from riwayat_laporan_minimum where pelapor_nama = 'Rian Hidayat'",
  );
  harusSama(view.rows[0].n, total);
});

// ---------------------------------------------------------------------
// Pintu resmi (AC5, permission matrix)
// ---------------------------------------------------------------------

uji("komisi_laporan: CEO & Manager membaca semua", async () => {
  const lap = await laporanMilik("Rian Hidayat");
  for (const peran of ["CEO", "Manager"]) {
    const orang = await idPeran(db, peran);
    const { rows } = await sebagai(db, orang, "select * from komisi_laporan($1)", [[lap]]);
    harusSama(rows.length, 1, peran);
    harus(Number(rows[0].komisi) >= 0, "komisi terbaca");
  }
});

uji("AC5/K5: pelapor tanpa akses lihat tidak membaca komisi laporannya sendiri", async () => {
  // Sejak 0212 tidak ada jalur khusus "laporan sendiri": mengisi ≠ melihat.
  const rian = await id("Rian Hidayat");
  const milikRian = await laporanMilik("Rian Hidayat");
  const { rows } = await sebagai(db, rian, "select report_id from komisi_laporan($1)", [
    [milikRian],
  ]);
  harusSama(rows.length, 0);
});

uji("Leader, Co-Leader, Finance: komisi_laporan selalu kosong", async () => {
  const lap = await laporanMilik("Rian Hidayat");
  for (const nama of ["Dewi Lestari", "Maya Safitri", "Laras Ayuningtyas"]) {
    const orang = await id(nama);
    const { rows } = await sebagai(db, orang, "select * from komisi_laporan($1)", [[lap]]);
    harusSama(rows.length, 0, nama);
  }
});

uji("AC5: Leader yang mengisi komisi akunnya sendiri tidak melihat angkanya lagi", async () => {
  const { dewi, laporan } = await laporanLeader();
  const a = await sebagai(db, dewi, "select * from komisi_laporan($1)", [[laporan]]);
  const b = await sebagai(
    db,
    dewi,
    "select * from komisi_laporan_saya(current_date - 60, current_date)",
  );
  harusSama([a.rows.length, b.rows.length], [0, 0]);
  const capaian = await sebagai(
    db,
    dewi,
    "select count(*) filter (where komisi is not null)::int n from capaian_pribadi_saya(current_date - 10, current_date)",
  );
  harusSama(capaian.rows[0].n, 0);
  // Tetapi angkanya memang tersimpan.
  harusSama(
    await angka("select komisi::int n from daily_reports where id = $1", [laporan]),
    150000,
  );
});

uji("K5: Staff tanpa akses lihat — capaian pribadinya tanpa komisi", async () => {
  const rian = await id("Rian Hidayat");
  const { rows } = await sebagai(
    db,
    rian,
    `select count(*) filter (where komisi is not null)::int n,
            count(*) filter (where gmv > 0)::int g
     from capaian_pribadi_saya(date '2024-10-01', date '2024-10-24')`,
  );
  harusSama(rows[0].n, 0, "komisi terlihat tanpa akses");
  harus(rows[0].g > 0, "GMV capaian seharusnya tetap ada");
});

uji("komisi_affiliator: hanya CEO/Manager; total = jumlah komisi laporan Affiliator", async () => {
  const ceo = await idPeran(db, "CEO");
  const { rows } = await sebagai(
    db,
    ceo,
    "select sum(komisi)::bigint t, sum(laporan)::int l, sum(berkomisi)::int b from komisi_affiliator(date '2024-10-01', date '2024-10-31')",
  );
  const harapan = (
    await sebagaiAdmin(
      db,
      `select coalesce(sum(r.komisi), 0)::bigint t, count(*)::int l, count(r.komisi)::int b
       from daily_reports r left join accounts a on a.id = r.account_id
       join units u on u.id = coalesce(r.unit_id, a.unit_id)
       where u.kode = 'affiliator' and r.tanggal between '2024-10-01' and '2024-10-31'`,
    )
  ).rows[0];
  harusSama(rows[0], harapan);

  for (const nama of ["Dewi Lestari", "Maya Safitri", "Rian Hidayat", "Laras Ayuningtyas"]) {
    const orang = await id(nama);
    const pesan = await galat(() =>
      sebagai(db, orang, "select * from komisi_affiliator(date '2024-10-01', date '2024-10-31')"),
    );
    harus(pesan.includes("Hanya CEO atau Manager"), `${nama}: ${pesan}`);
    await harusDitolak(
      () => sebagai(db, orang, "select * from komisi_affiliator_harian(date '2024-10-01', date '2024-10-31')"),
      `${nama} membaca komisi harian`,
    );
  }
});

// ---------------------------------------------------------------------
// Perbaikan & jejak revisi (E5, BR-K5)
// ---------------------------------------------------------------------

uji("Perbaikan GMV oleh Leader tidak mengosongkan komisi yang tak ia lihat", async () => {
  const { dewi, laporan } = await laporanLeader();
  await sebagai(
    db,
    dewi,
    "select perbaiki_laporan_harian($1, 2500000, 'Salah ketik GMV kemarin', null, null, 3)",
    [laporan],
  );
  harusSama(
    await angka("select komisi::int n from daily_reports where id = $1", [laporan]),
    150000,
  );
  harusSama(
    await angka("select gmv::int n from daily_reports where id = $1", [laporan]),
    2500000,
  );
});

uji("E5: Leader memperbaiki komisi → jejak tercatat, tetapi ia tak melihat angka lama/baru", async () => {
  const { dewi, laporan } = await laporanLeader();
  await sebagai(
    db,
    dewi,
    "select perbaiki_laporan_harian($1, 2500000, 'Komisi keliru dilaporkan', null, 175000, 3)",
    [laporan],
  );
  harusSama(
    await angka(
      "select count(*)::int n from daily_report_revisions where report_id = $1 and komisi_baru = 175000",
      [laporan],
    ),
    1,
  );
  const leader = await sebagai(db, dewi, "select * from komisi_revisi($1)", [[laporan]]);
  harusSama(leader.rows.length, 0);
  const manager = await idPeran(db, "Manager");
  const m = await sebagai(db, manager, "select * from komisi_revisi($1)", [[laporan]]);
  harus(m.rows.some((r) => Number(r.komisi_baru) === 175000), "Manager tidak melihat komisi revisi");
});

uji("BR-K5: pelapor tanpa akses tidak membaca angka revisi komisinya; Manager membaca", async () => {
  const rian = await id("Rian Hidayat");
  const lap = await laporanMilik("Rian Hidayat");
  const gmv = await angka("select gmv::bigint n from daily_reports where id = $1", [lap]);
  await sebagai(
    db,
    rian,
    "select perbaiki_laporan_harian($1, $2, 'Komisi masuk terlambat', null, 12345, null)",
    [lap, gmv],
  );
  const { rows } = await sebagai(db, rian, "select komisi_baru from komisi_revisi($1)", [[lap]]);
  harusSama(rows.length, 0);
  const manager = await idPeran(db, "Manager");
  const m = await sebagai(db, manager, "select komisi_baru from komisi_revisi($1)", [[lap]]);
  harus(m.rows.some((r) => Number(r.komisi_baru) === 12345), "Manager tidak melihat revisi");
});

// ---------------------------------------------------------------------
// GRD (E9)
// ---------------------------------------------------------------------

uji("E9: entri lead measure bersumber komisi hanya terbaca CEO/Manager", async () => {
  const goal = (
    await sebagaiAdmin(
      db,
      `select g.id from goals g join units u on u.id = g.unit_id
       where u.kode = 'affiliator' limit 1`,
    )
  ).rows[0]?.id;
  harus(goal, "data contoh: goal Affiliator seharusnya ada");
  const lm = (
    await sebagaiAdmin(
      db,
      `insert into lead_measures (goal_id, judul, satuan, target_mingguan, sumber_laporan)
       values ($1, 'Komisi pekanan uji', 'rupiah', 1000000, 'komisi') returning id`,
      [goal],
    )
  ).rows[0].id;
  // Seperti `sinkron_lead_measure_laporan`: entri bersumber laporan hanya
  // boleh ditulis jalur sinkron.
  await sebagaiAdmin(db, "select set_config('app.sinkron_lead', '1', false)");
  await sebagaiAdmin(
    db,
    `insert into lead_measure_entries (lead_measure_id, tanggal, nilai, catatan, dari_laporan)
     values ($1, current_date - 1, 500000, '', true)`,
    [lm],
  );
  await sebagaiAdmin(db, "select set_config('app.sinkron_lead', '', false)");
  const lihat = async (nama) =>
    Number(
      (
        await sebagai(
          db,
          await id(nama),
          "select count(*)::int n from lead_measure_entries where lead_measure_id = $1",
          [lm],
        )
      ).rows[0].n,
    );
  harusSama(
    [await lihat("Farhan Pratama"), await lihat("Dewi Lestari"), await lihat("Rian Hidayat")],
    [1, 0, 0],
  );
});

uji("Jumlah lead measure bersumber komisi di data contoh (dilaporkan di PR)", async () => {
  // Data contoh tidak memuat satu pun; uji sebelumnya menambah satu.
  harusSama(
    await angka("select count(*)::int n from lead_measures where sumber_laporan = 'komisi'"),
    1,
  );
});

await jalankan();
await db.close();
