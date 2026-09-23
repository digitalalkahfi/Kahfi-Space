/** Lead measure yang angkanya lahir dari laporan harian, bukan diketik. */
import {
  buatDb,
  buatSuite,
  harus,
  harusDitolak,
  harusSama,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Lead measure dari laporan");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const LM = (
  await satu(
    `select id from lead_measures where sumber_laporan = 'jumlah_upload'`,
  )
).id;
const U = {
  rian: (await satu(`select id from users where nama='Rian Hidayat'`)).id,
  dewi: (await satu(`select id from users where nama='Dewi Lestari'`)).id,
};
const A = {
  skincare: (
    await satu(`select id from accounts where username='@skincare_official'`)
  ).id,
  beauty: (
    await satu(`select id from accounts where username='@beauty_daily.id'`)
  ).id,
};

const nilaiLead = async (tanggal) => {
  const b = await satu(
    `select nilai, dari_laporan, user_id from lead_measure_entries
      where lead_measure_id = $1 and tanggal = $2`,
    [LM, tanggal],
  );
  return b ? { ...b, nilai: Number(b.nilai) } : null;
};

uji("laporan yang masuk langsung mengisi lead measure", async () => {
  await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, jumlah_upload)
     values ($1,'2024-11-05',$2,1000000,4)`,
    [U.rian, A.skincare],
  );
  const e = await nilaiLead("2024-11-05");
  harusSama(e.nilai, 4);
  harus(e.dari_laporan, "baris otomatis harus bertanda dari_laporan");
  harus(e.user_id === null, "baris agregat bukan milik satu orang");
});

uji("laporan akun kedua dijumlahkan, bukan menimpa", async () => {
  await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, jumlah_upload)
     values ($1,'2024-11-05',$2,900000,3)`,
    [U.rian, A.beauty],
  );
  harusSama((await nilaiLead("2024-11-05")).nilai, 7);
});

uji("perbaikan laporan menurunkan kembali angkanya", async () => {
  // Hitung ulang dari nol: revisi turun harus benar-benar turun.
  await sebagaiAdmin(
    db,
    `update daily_reports set jumlah_upload = 1
      where tanggal='2024-11-05' and account_id=$1`,
    [A.skincare],
  );
  harusSama((await nilaiLead("2024-11-05")).nilai, 4);
});

uji("laporan unit lain tidak mengubah lead measure Affiliator", async () => {
  const mcn = (await satu(`select id from units where kode='mcn'`)).id;
  await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, unit_id, gmv)
     values ($1,'2024-11-05',$2,5000000)`,
    [(await satu(`select id from users where nama='Galih Prakoso'`)).id, mcn],
  );
  harusSama((await nilaiLead("2024-11-05")).nilai, 4);
});

uji("tanggal tanpa laporan tidak dibuatkan baris", async () => {
  harus(
    (await nilaiLead("2024-11-09")) === null,
    "tanggal kosong tidak boleh punya entri",
  );
});

uji("lead measure bersumber laporan tidak bisa diketik manual", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into lead_measure_entries (lead_measure_id, user_id, tanggal, nilai)
         values ($1,$2,'2024-11-20',9)`,
        [LM, U.dewi],
      ),
    "ketikan manual pada lead measure bersumber laporan seharusnya ditolak",
  );
});

uji("lead measure biasa tetap boleh diisi manual", async () => {
  const biasa = (
    await satu(
      `select id from lead_measures where sumber_laporan is null limit 1`,
    )
  ).id;
  const { rows } = await sebagaiAdmin(
    db,
    `insert into lead_measure_entries (lead_measure_id, user_id, tanggal, nilai)
     values ($1,$2,'2024-11-21',5) returning id`,
    [biasa, U.dewi],
  );
  harus(rows.length === 1, "lead measure manual seharusnya tetap bisa diisi");
});

uji("sinkron ulang dua kali tidak menggandakan angka", async () => {
  const unit = (await satu(`select id from units where kode='affiliator'`)).id;
  await sebagaiAdmin(
    db,
    `select sinkron_lead_measure_laporan($1,'2024-11-05')`,
    [unit],
  );
  await sebagaiAdmin(
    db,
    `select sinkron_lead_measure_laporan($1,'2024-11-05')`,
    [unit],
  );
  harusSama((await nilaiLead("2024-11-05")).nilai, 4);
  const n = await satu(
    `select count(*)::int as n from lead_measure_entries
      where lead_measure_id=$1 and tanggal='2024-11-05'`,
    [LM],
  );
  harusSama(n.n, 1);
});

uji("upsert pada lead measure bersumber laporan juga ditolak", async () => {
  // Jalur yang dipakai aplikasi adalah upsert, bukan insert polos: kolom
  // `dari_laporan` yang tidak ikut dikirim mempertahankan nilai lamanya.
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into lead_measure_entries (lead_measure_id, user_id, tanggal, nilai)
         values ($1,$2,'2024-11-05',99)
         on conflict (lead_measure_id, tanggal)
         do update set nilai = excluded.nilai`,
        [LM, U.dewi],
      ),
    "upsert seharusnya tetap ditolak",
  );
  harusSama(
    (await nilaiLead("2024-11-05")).nilai,
    4,
    "angkanya tidak boleh berubah",
  );
});

uji("laporan lama tanpa kolom upload tidak membuat entri nol", async () => {
  // Skenario migrasi kv_store: baris lama tidak punya jumlah_upload.
  await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, account_id, gmv)
     values ($1,'2024-08-14',$2,1500000)`,
    [U.rian, A.skincare],
  );
  harus(
    (await nilaiLead("2024-08-14")) === null,
    "tanggal lampau tanpa angka upload tidak boleh muncul di papan",
  );
});

uji("angka yang sudah tercatat tetap bisa turun ke nol", async () => {
  await sebagaiAdmin(
    db,
    `insert into daily_reports (user_id, tanggal, account_id, gmv, jumlah_upload)
     values ($1,'2024-08-15',$2,1500000,3)`,
    [U.rian, A.skincare],
  );
  harusSama((await nilaiLead("2024-08-15")).nilai, 3);

  await sebagaiAdmin(
    db,
    `update daily_reports set jumlah_upload = 0
      where tanggal='2024-08-15' and account_id=$1`,
    [A.skincare],
  );
  harusSama(
    (await nilaiLead("2024-08-15")).nilai,
    0,
    "koreksi ke nol harus terlihat, bukan diabaikan",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
