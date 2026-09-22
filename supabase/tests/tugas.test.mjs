/** Tugas: cakupan baca, wewenang menugasi, dan aturan QC. */
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
import dataSeed from "../seed/data.json" with { type: "json" };

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Tugas & QC");

const idUser = async (nama) =>
  (await sebagaiAdmin(db, `select id from users where nama = $1`, [nama]))
    .rows[0].id;

const U = {
  manager: await idUser("Farhan Pratama"),
  leaderAff: await idUser("Dewi Lestari"),
  staffRian: await idUser("Rian Hidayat"),
  staffBayu: await idUser("Bayu Nugraha"),
  staffYoga: await idUser("Yoga Saputra"),
};

uji("seed tugas idempoten", async () => {
  const hitung = async () => {
    const { rows } = await sebagaiAdmin(db, "select count(*)::int n from tasks");
    return Number(rows[0].n);
  };
  // Jumlahnya dibaca dari sumber seed, bukan angka tetap yang basi tiap
  // kali datanya bertambah. Yang diuji: menerapkan seed dua kali tidak
  // menggandakan apa pun.
  const dariSumber = dataSeed.tasks.length;
  harusSama(await hitung(), dariSumber);
  await terapkanSeed(db);
  harusSama(await hitung(), dariSumber);
});

uji("Staff melihat tugasnya sendiri", async () => {
  const { rows } = await sebagai(
    db,
    U.staffRian,
    "select judul from tasks order by judul",
  );
  harus(
    rows.some((r) => r.judul === "Audit GMV Akun Beauty"),
    "tiket untuk Rian harus terlihat",
  );
});

uji("Staff tidak melihat to-do pribadi orang lain", async () => {
  const { rows } = await sebagai(db, U.staffRian, "select judul from tasks");
  harus(
    !rows.some((r) => r.judul === "Cek 14 sesi live sore"),
    "to-do pribadi Manager bocor ke Staff",
  );
});

uji("Leader melihat tugas anggota unitnya", async () => {
  const { rows } = await sebagai(db, U.leaderAff, "select judul from tasks");
  harus(
    rows.some((r) => r.judul === "Audit GMV Akun Beauty"),
    "Leader Affiliator harus melihat tugas anggotanya",
  );
});

uji("Staff boleh membuat to-do untuk dirinya sendiri", async () => {
  await sebagai(
    db,
    U.staffRian,
    `insert into tasks (tipe, judul, pembuat_id, penerima_id)
     values ('pribadi', 'Siapkan skrip live besok', $1, $1)`,
    [U.staffRian],
  );
});

uji("Staff tidak boleh menugasi rekan sejawat", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.staffRian,
        `insert into tasks (tipe, judul, pembuat_id, penerima_id)
         values ('tiket', 'Tolong kerjakan ini', $1, $2)`,
        [U.staffRian, U.staffYoga],
      ),
    "Staff seharusnya tidak bisa menugasi rekan",
  );
});

uji("Leader boleh menugasi anggota unitnya", async () => {
  await sebagai(
    db,
    U.leaderAff,
    `insert into tasks (tipe, judul, pembuat_id, penerima_id)
     values ('tiket', 'Audit konten pekan ini', $1, $2)`,
    [U.leaderAff, U.staffBayu],
  );
});

uji("penerima tidak boleh meluluskan QC-nya sendiri", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select id from tasks where judul = 'QC Tiket Konten FYP'`,
  );
  await harusDitolak(
    () =>
      sebagai(db, U.staffBayu, `update tasks set qc_status='lolos' where id=$1`, [
        rows[0].id,
      ]),
    "penerima seharusnya tidak bisa QC sendiri",
  );
});

uji("pemberi tugas boleh meluluskan QC dan tugas jadi selesai", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select id from tasks where judul = 'QC Tiket Konten FYP'`,
  );
  await sebagai(
    db,
    U.leaderAff,
    `update tasks set qc_status='lolos' where id=$1`,
    [rows[0].id],
  );
  const { rows: sesudah } = await sebagaiAdmin(
    db,
    `select status, qc_at, selesai_at from tasks where id=$1`,
    [rows[0].id],
  );
  harusSama(sesudah[0].status, "selesai", "status setelah QC lolos");
  harus(sesudah[0].qc_at, "qc_at harus terisi");
  harus(sesudah[0].selesai_at, "selesai_at harus terisi");
});

uji("QC minta revisi mengembalikan tugas ke pengerjaan", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select id from tasks where judul = 'Otorisasi Akun MMC Baru'`,
  );
  await sebagai(
    db,
    U.manager,
    `update tasks set qc_status='revisi', qc_note='Lampiran kurang' where id=$1`,
    [rows[0].id],
  );
  const { rows: sesudah } = await sebagaiAdmin(
    db,
    `select status from tasks where id=$1`,
    [rows[0].id],
  );
  harusSama(sesudah[0].status, "revisi");
});

uji("to-do pribadi wajib milik pembuatnya", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into tasks (tipe, judul, pembuat_id, penerima_id)
         values ('pribadi', 'Salah sasaran', $1, $2)`,
        [U.manager, U.staffRian],
      ),
    "constraint tasks_pribadi_milik_sendiri tidak bekerja",
  );
});

uji("komitmen mingguan wajib terhubung goal", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into tasks (tipe, judul, pembuat_id, penerima_id)
         values ('komitmen_mingguan', 'Tanpa goal', $1, $1)`,
        [U.manager],
      ),
    "constraint tasks_komitmen_punya_goal tidak bekerja",
  );
});

uji("mengajukan QC tanpa keterangan hasil ditolak", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select id from tasks where judul = 'Audit GMV Akun Beauty'`,
  );
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.staffRian,
        `update tasks set status='menunggu_qc' where id=$1`,
        [rows[0].id],
      ),
    "trigger jaga_ajuan_qc tidak bekerja",
  );
});

uji("mengajukan QC dengan keterangan hasil diterima", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select id from tasks where judul = 'Audit GMV Akun Beauty'`,
  );
  await sebagai(
    db,
    U.staffRian,
    `update tasks set status='menunggu_qc',
       hasil_kerja='Deviasi komisi 5 kreator sudah dicocokkan ke Partner Center.'
     where id=$1`,
    [rows[0].id],
  );
  const { rows: sesudah } = await sebagaiAdmin(
    db,
    `select status, hasil_kerja from tasks where id=$1`,
    [rows[0].id],
  );
  harusSama(sesudah[0].status, "menunggu_qc");
  harus(
    sesudah[0].hasil_kerja.includes("Partner Center"),
    "keterangan hasil harus tersimpan",
  );
});

uji("to-do pribadi tidak wajib menulis hasil", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select id from tasks where judul = 'Siapkan skrip live besok'`,
  );
  if (rows.length === 0) return; // dibuat di test sebelumnya
  await sebagai(
    db,
    U.staffRian,
    `update tasks set status='selesai' where id=$1`,
    [rows[0].id],
  );
});

uji("kolom tabel tasks mencakup seluruh field PRD §6", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='tasks'`,
  );
  const ada = new Set(rows.map((r) => r.column_name));
  const wajib = [
    "id",
    "tipe",
    "goal_id",
    "judul",
    "deskripsi",
    "pembuat_id",
    "penerima_id",
    "tenggat",
    "prioritas",
    "status",
    "qc_status",
    "qc_by",
    "qc_note",
    "created_at",
  ];
  const kurang = wajib.filter((k) => !ada.has(k));
  harusSama(kurang, [], "kolom PRD yang belum ada");
});

uji("tugas yang dibatalkan tidak muncul di daftar aktif", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select id from tasks where judul = 'Sinkronisasi TAP Center'`,
  );
  await sebagai(
    db,
    U.manager,
    `update tasks set status='dibatalkan' where id=$1`,
    [rows[0].id],
  );
  const { rows: aktif } = await sebagai(
    db,
    U.manager,
    `select count(*)::int n from tasks where status <> 'dibatalkan' and id=$1`,
    [rows[0].id],
  );
  harusSama(Number(aktif[0].n), 0);
});

uji("hanya pembuat atau Manager yang bisa menghapus tugas", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select id from tasks where judul = 'Audit GMV Akun Beauty'`,
  );
  // Penerima (Rian) bukan pembuatnya.
  const r = await sebagai(db, U.staffRian, `delete from tasks where id=$1`, [
    rows[0].id,
  ]);
  harusSama(r.affectedRows ?? 0, 0, "penerima tidak boleh menghapus");

  const { rows: masih } = await sebagaiAdmin(
    db,
    `select count(*)::int n from tasks where id=$1`,
    [rows[0].id],
  );
  harusSama(Number(masih[0].n), 1, "tugas harus tetap ada");
});

uji("atasan langsung boleh menugasi walau beda unit", async () => {
  // Farhan (Manager) adalah atasan langsung Dewi (Leader Affiliator).
  await sebagai(
    db,
    U.manager,
    `insert into tasks (tipe, judul, pembuat_id, penerima_id)
     values ('tiket', 'Susun rencana pekan depan', $1, $2)`,
    [U.manager, U.leaderAff],
  );
});

uji("Leader tidak bisa menugasi Leader unit lain", async () => {
  const galih = await idUser("Galih Prakoso"); // Leader MCN
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.leaderAff,
        `insert into tasks (tipe, judul, pembuat_id, penerima_id)
         values ('tiket', 'Lintas unit tanpa wewenang', $1, $2)`,
        [U.leaderAff, galih],
      ),
    "Leader Affiliator bukan atasan Leader MCN",
  );
});

uji("pembuat tiket ikut melihat tugas yang ia kirim", async () => {
  const { rows } = await sebagai(
    db,
    U.leaderAff,
    `select count(*)::int n from tasks where pembuat_id = $1`,
    [U.leaderAff],
  );
  harus(Number(rows[0].n) > 0, "tiket yang dikirim harus terlihat pembuatnya");
});

uji("penerima tidak bisa memindahkan tiket ke orang lain", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select id from tasks where judul = 'Audit GMV Akun Beauty'`,
  );
  await harusDitolak(
    () =>
      sebagai(
        db,
        U.staffRian,
        `update tasks set penerima_id = $2 where id = $1`,
        [rows[0].id, U.staffBayu],
      ),
    "penerima seharusnya tidak bisa melempar tiket ke orang lain",
  );

  const { rows: sesudah } = await sebagaiAdmin(
    db,
    `select penerima_id from tasks where id=$1`,
    [rows[0].id],
  );
  harusSama(sesudah[0].penerima_id, U.staffRian, "penerima tidak berubah");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
