/** Lead measure: batas per goal, entri harian, dan capaian mingguannya. */
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
const { uji, jalankan } = buatSuite("Lead measure");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const leadId = async (judul) =>
  (await sebagaiAdmin(db, "select id from lead_measures where judul = $1", [judul]))
    .rows[0].id;

uji("awal_pekan selalu jatuh pada Senin", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select
       awal_pekan('2024-10-24'::date) kamis,
       awal_pekan('2024-10-21'::date) senin,
       awal_pekan('2024-10-27'::date) minggu`,
  );
  // 21 Oktober 2024 adalah Senin; Kamis dan Minggu pada pekan yang sama
  // harus menunjuk Senin yang sama.
  // PGlite mengembalikan Date; disamakan lewat ISO agar tidak bergantung
  // pada format bawaan runtime.
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  harusSama(iso(rows[0].kamis), iso(rows[0].senin));
  harusSama(iso(rows[0].minggu), iso(rows[0].senin));
  harusSama(iso(rows[0].senin), "2024-10-21");
});

uji("maksimal tiga lead measure aktif per goal", async () => {
  // PRD §3: 1–3 lead measure per goal; lebih dari itu bukan lagi fokus.
  const goal = (
    await sebagaiAdmin(
      db,
      "select goal_id from lead_measures group by goal_id having count(*) = 1 limit 1",
    )
  ).rows[0].goal_id;

  for (let i = 2; i <= 3; i++) {
    await sebagaiAdmin(
      db,
      "insert into lead_measures (goal_id, judul, target_mingguan) values ($1, $2, 10)",
      [goal, `Lead uji ${i}`],
    );
  }

  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "insert into lead_measures (goal_id, judul, target_mingguan) values ($1, 'Lead uji keempat', 10)",
        [goal],
      ),
    "lead measure keempat seharusnya ditolak",
  );

  await sebagaiAdmin(db, "delete from lead_measures where judul like 'Lead uji%'");
});

uji("lead measure nonaktif tidak ikut menghitung batas", async () => {
  const goal = (
    await sebagaiAdmin(
      db,
      "select goal_id from lead_measures group by goal_id having count(*) = 1 limit 1",
    )
  ).rows[0].goal_id;

  for (let i = 1; i <= 3; i++) {
    await sebagaiAdmin(
      db,
      "insert into lead_measures (goal_id, judul, target_mingguan, aktif) values ($1, $2, 10, false)",
      [goal, `Lead lama ${i}`],
    );
  }

  await sebagaiAdmin(
    db,
    "insert into lead_measures (goal_id, judul, target_mingguan) values ($1, 'Lead pengganti', 10)",
    [goal],
  );

  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int n from lead_measures where judul = 'Lead pengganti'",
  );
  harusSama(rows[0].n, 1);
  await sebagaiAdmin(db, "delete from lead_measures where judul like 'Lead lama%' or judul = 'Lead pengganti'");
});

uji("target mingguan harus lebih dari nol", async () => {
  const goal = (await sebagaiAdmin(db, "select id from goals limit 1")).rows[0].id;
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "insert into lead_measures (goal_id, judul, target_mingguan) values ($1, 'Target nol', 0)",
        [goal],
      ),
    "target nol seharusnya ditolak",
  );
});

uji("satu entri per lead measure per tanggal", async () => {
  // Dua entri pada tanggal yang sama akan menggandakan capaiannya.
  const lead = await leadId("Live Stream TikTok");
  const { rows } = await sebagaiAdmin(
    db,
    "select tanggal from lead_measure_entries where lead_measure_id = $1 limit 1",
    [lead],
  );
  const tanggal = new Date(rows[0].tanggal).toISOString().slice(0, 10);

  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "insert into lead_measure_entries (lead_measure_id, tanggal, nilai) values ($1, $2, 5)",
        [lead, tanggal],
      ),
    "entri ganda pada tanggal yang sama seharusnya ditolak",
  );
});

uji("nilai realisasi tidak boleh negatif", async () => {
  const lead = await leadId("Live Stream TikTok");
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "insert into lead_measure_entries (lead_measure_id, tanggal, nilai) values ($1, '2024-12-01', -1)",
        [lead],
      ),
    "nilai negatif seharusnya ditolak",
  );
});

uji("capaian mingguan menjumlahkan entri pekan itu saja", async () => {
  const lead = await leadId("Live Stream TikTok");

  const { rows } = await sebagaiAdmin(
    db,
    "select realisasi, target, rasio from capaian_lead_measure($1, '2024-10-24'::date)",
    [lead],
  );
  harus(Number(rows[0].realisasi) > 0, "realisasi pekan itu harus terhitung");
  harusSama(Number(rows[0].target), 40);

  // Entri di luar pekan tidak boleh ikut terhitung.
  await sebagaiAdmin(
    db,
    "insert into lead_measure_entries (lead_measure_id, tanggal, nilai) values ($1, '2024-11-20', 999)",
    [lead],
  );
  const { rows: sesudah } = await sebagaiAdmin(
    db,
    "select realisasi from capaian_lead_measure($1, '2024-10-24'::date)",
    [lead],
  );
  harusSama(Number(sesudah[0].realisasi), Number(rows[0].realisasi));
  await sebagaiAdmin(db, "delete from lead_measure_entries where tanggal = '2024-11-20'");
});

uji("nilai pendukung ikut tersimpan", async () => {
  // Mis. peserta hadir MMC pada tanggal acara.
  const lead = await leadId("Creator Binding MMC");
  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int n from lead_measure_entries where lead_measure_id = $1 and nilai_pendukung is not null",
    [lead],
  );
  harus(rows[0].n > 0, "seed harus memuat nilai pendukung");
});

uji("Staff melihat papan lead measure", async () => {
  const { rows } = await sebagai(
    db,
    await id("Rian Hidayat"),
    "select count(*)::int n from lead_measures",
  );
  harus(rows[0].n > 0, "papan skor harus terbuka bagi anggota");
});

uji("lead measure MMC ada di unit MCN beserta label pendukungnya", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select lm.judul, lm.satuan, lm.target_mingguan, lm.label_pendukung, u.kode
       from lead_measures lm
       join goals g on g.id = lm.goal_id
       join units u on u.id = g.unit_id
      where u.kode = 'mcn' and lm.aktif`,
  );
  harusSama(rows.length, 1);
  harusSama(rows[0].judul, "Creator Binding MMC");
  harusSama(rows[0].satuan, "akun");
  harusSama(rows[0].label_pendukung, "Peserta hadir MMC");
});

uji("ringkasan MMC menampilkan realisasi dan peserta hadir", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select * from papan_lead_measure('2024-10-21') where unit_kode = 'mcn'",
  );
  harusSama(rows.length, 1);
  harus(Number(rows[0].realisasi) > 0, "realisasi MMC pekan itu harus terhitung");
  harus(Number(rows[0].pendukung) > 0, "peserta hadir MMC harus ikut terjumlah");
  harusSama(rows[0].label_pendukung, "Peserta hadir MMC");
});

uji("angka pendukung ditolak bila lead measure tak punya label", async () => {
  // Kalau lolos, angkanya tersimpan tapi tak pernah punya sebutan di layar.
  const lm = (
    await sebagaiAdmin(db, "select id from lead_measures where label_pendukung is null limit 1")
  ).rows[0].id;
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into lead_measure_entries (lead_measure_id, tanggal, nilai, nilai_pendukung)
         values ($1, '2024-11-04', 5, 20)`,
        [lm],
      ),
    "angka pendukung tanpa label seharusnya ditolak",
  );
});

uji("lead measure nonaktif hilang dari papan tapi entrinya utuh", async () => {
  // Menutup langkah kunci tidak boleh menghapus catatan pekan-pekan lalu.
  const lm = (
    await sebagaiAdmin(db, "select id from lead_measures where judul = 'Creator Binding MMC'")
  ).rows[0].id;
  const entri = (
    await sebagaiAdmin(
      db,
      "select count(*)::int n from lead_measure_entries where lead_measure_id = $1",
      [lm],
    )
  ).rows[0].n;
  harus(entri > 0, "entri MMC harus ada sebelum diuji");

  await sebagaiAdmin(db, "update lead_measures set aktif = false where id = $1", [lm]);

  harusSama(
    (await sebagaiAdmin(db, "select count(*)::int n from papan_lead_measure('2024-10-21') where lead_id = $1", [lm]))
      .rows[0].n,
    0,
    "lead measure nonaktif tidak boleh tampil di papan",
  );
  harusSama(
    (await sebagaiAdmin(
      db,
      "select count(*)::int n from lead_measure_entries where lead_measure_id = $1",
      [lm],
    )).rows[0].n,
    entri,
    "entri harian harus tetap tersimpan",
  );
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
