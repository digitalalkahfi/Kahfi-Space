/** Kaizen: kejujuran status, solusi wajib, jejak, dan cakupan baca. */
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
const { uji, jalankan } = buatSuite("Kaizen");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const masalahId = async (judul) =>
  (
    await sebagaiAdmin(db, "select id from problems where judul like $1", [
      `${judul}%`,
    ])
  ).rows[0].id;

const statusMasalah = async (judul) =>
  (
    await sebagaiAdmin(db, "select status from problems where judul like $1", [
      `${judul}%`,
    ])
  ).rows[0].status;

uji("data contoh memakai status alur baru", async () => {
  harusSama(await statusMasalah("Absensi selfie"), "baru");
  harusSama(await statusMasalah("Laporan harian sering"), "diproses");
  harusSama(await statusMasalah("GMV akun beauty"), "selesai");
});

uji("selesai tanpa solusi ditolak", async () => {
  // Papan yang menghijau tanpa satu kalimat pun tidak menolong orang
  // berikutnya yang kena masalah sama — itulah satu-satunya gunanya.
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "update problems set status = 'selesai' where judul like 'Sampel sering%'",
      ),
    "selesai tanpa solusi seharusnya ditolak",
  );
  harusSama(await statusMasalah("Sampel sering"), "diproses");
});

uji("solusi sepatah kata belum dianggap solusi", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "update problems set solusi = 'beres', status = 'selesai' where judul like 'Sampel sering%'",
      ),
    "solusi terlalu pendek seharusnya ditolak",
  );
});

uji("menulis solusi dan menandai selesai sekaligus diterima", async () => {
  // Satu UPDATE, karena itulah yang dilakukan layar: trigger membaca
  // solusi yang baru, bukan yang tersimpan sebelumnya.
  await sebagaiAdmin(
    db,
    `update problems
        set solusi = 'Penagihan sampel jadi tugas admin unit, diingatkan H+3 setelah konten tayang.',
            status = 'selesai'
      where judul like 'Sampel sering%'`,
  );
  harusSama(await statusMasalah("Sampel sering"), "selesai");
  await terapkanSeed(db);
});

uji("menutup tanpa alasan ditolak", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "update problems set status = 'ditutup' where judul like 'Sampel sering%'",
      ),
    "penutupan tanpa alasan seharusnya ditolak",
  );
});

uji("pelapor tidak bisa menyelundupkan status dan solusi", async () => {
  // `problems_lapor` mengizinkan siapa pun menyisipkan barisnya sendiri
  // dan RLS tidak bisa membatasi kolom; penjaganya trigger (0121).
  const staf = await id("Nabila Putri");
  await sebagai(
    db,
    staf,
    `insert into problems (judul, konteks, unit_id, dilaporkan_oleh, status, solusi)
     values ('Laporan yang mengaku sudah selesai', 'konteks',
             (select id from units where kode = 'affiliator'), $1,
             'selesai', 'Sudah saya beresi sendiri kemarin sore.')`,
    [staf],
  );

  const { rows } = await sebagaiAdmin(
    db,
    "select status, solusi from problems where judul = 'Laporan yang mengaku sudah selesai'",
  );
  harusSama(rows[0].status, "baru");
  harusSama(rows[0].solusi, "");
});

uji("manajemen tetap boleh melapor sekaligus menjawab", async () => {
  const manajer = await id("Farhan Pratama");
  await sebagai(
    db,
    manajer,
    `insert into problems (judul, konteks, unit_id, dilaporkan_oleh, status, solusi)
     values ('Laporan manajer', 'konteks',
             (select id from units where kode = 'tap'), $1,
             'diproses', 'Vendor sudah dihubungi dan mengganti perangkatnya.')`,
    [manajer],
  );
  const { rows } = await sebagaiAdmin(
    db,
    "select status, solusi from problems where judul = 'Laporan manajer'",
  );
  harusSama(rows[0].status, "diproses");
  harus(rows[0].solusi.length > 0, "solusi dari manajer harus tersimpan");
});

uji("Staff melihat masalah unitnya", async () => {
  const { rows } = await sebagai(
    db,
    await id("Rian Hidayat"),
    "select count(*)::int n from problems",
  );
  harus(rows[0].n > 0, "Staff affiliator harus melihat masalah unitnya");
});

uji("Staff tidak melihat masalah unit lain", async () => {
  const { rows } = await sebagai(
    db,
    await id("Rian Hidayat"),
    "select judul from problems",
  );
  harusSama(
    rows.some((r) => r.judul.startsWith("Laporan harian sering")),
    false,
  );
});

uji("Staff boleh melaporkan masalah", async () => {
  // Menyaring pelapor membuat masalah paling dekat dengan pekerjaan
  // harian justru tidak pernah sampai ke permukaan.
  const orang = await id("Rian Hidayat");
  await sebagai(
    db,
    orang,
    `insert into problems (judul, dilaporkan_oleh, unit_id)
     values ('Stok ring light habis sejak pekan lalu', $1,
             (select id from units where kode = 'affiliator'))`,
    [orang],
  );
  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int n from problems where judul like 'Stok ring light%'",
  );
  harusSama(rows[0].n, 1);
});

uji("Staff tidak bisa melapor atas nama orang lain", async () => {
  await harusDitolak(
    async () =>
      sebagai(
        db,
        await id("Rian Hidayat"),
        "insert into problems (judul, dilaporkan_oleh) values ('Laporan palsu atas nama orang lain', $1)",
        [await id("Farhan Pratama")],
      ),
    "melapor atas nama orang lain seharusnya ditolak",
  );
  await terapkanSeed(db);
});

uji("setiap perubahan status meninggalkan jejak", async () => {
  const manajer = await id("Farhan Pratama");
  const masalah = (
    await sebagaiAdmin(
      db,
      `insert into problems (judul, konteks, unit_id, status)
       values ('Uji jejak status', 'konteks',
               (select id from units where kode = 'tap'), 'baru')
       returning id`,
    )
  ).rows[0].id;

  await sebagai(
    db,
    manajer,
    "update problems set status = 'diproses' where id = $1",
    [masalah],
  );
  await sebagai(
    db,
    manajer,
    `update problems set status = 'ditutup',
            ditutup_alasan = 'Ternyata bukan masalah kita, sudah ditangani vendor'
      where id = $1`,
    [masalah],
  );

  const { rows } = await sebagaiAdmin(
    db,
    "select dari, ke, oleh_id, catatan from problem_events where problem_id = $1 order by pada",
    [masalah],
  );
  harusSama(rows.length, 2);
  harusSama(rows[0].dari, "baru");
  harusSama(rows[0].ke, "diproses");
  harusSama(rows[0].oleh_id, manajer);
  harusSama(rows[1].ke, "ditutup");
  harus(rows[1].catatan.length > 0, "alasan penutupan ikut tersimpan");
});

uji("menulis solusi tanpa memindah status tidak menambah jejak", async () => {
  const masalah = await masalahId("Uji jejak status");
  const sebelum = Number(
    (
      await sebagaiAdmin(
        db,
        "select count(*)::int n from problem_events where problem_id = $1",
        [masalah],
      )
    ).rows[0].n,
  );

  await sebagaiAdmin(
    db,
    "update problems set solusi = 'Perangkatnya diganti vendor pekan ini.' where id = $1",
    [masalah],
  );

  harusSama(
    Number(
      (
        await sebagaiAdmin(
          db,
          "select count(*)::int n from problem_events where problem_id = $1",
          [masalah],
        )
      ).rows[0].n,
    ),
    sebelum,
  );
});

uji("jejak status tidak bisa disunting maupun dikarang", async () => {
  const masalah = await masalahId("Uji jejak status");

  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "update problem_events set ke = 'selesai' where problem_id = $1",
        [masalah],
      ),
    "penyuntingan jejak seharusnya ditolak",
  );

  const staf = await id("Nabila Putri");
  await harusDitolak(
    async () =>
      sebagai(
        db,
        staf,
        "insert into problem_events (problem_id, ke) values ($1, 'selesai')",
        [masalah],
      ),
    "penulisan jejak langsung seharusnya ditolak",
  );
});

uji("pelapor ikut membaca riwayat masalahnya", async () => {
  // Termasuk kalau masalahnya ditutup tanpa pernah dijawab.
  const staf = await id("Nabila Putri");
  const masalah = (
    await sebagai(
      db,
      staf,
      `insert into problems (judul, konteks, unit_id, dilaporkan_oleh)
       values ('Uji baca jejak', 'konteks',
               (select id from units where kode = 'affiliator'), $1)
       returning id`,
      [staf],
    )
  ).rows[0].id;

  const manajer = await id("Farhan Pratama");
  await sebagai(
    db,
    manajer,
    `update problems set status = 'ditutup',
            ditutup_alasan = 'Sudah tidak relevan setelah proses berubah'
      where id = $1`,
    [masalah],
  );

  const { rows } = await sebagai(
    db,
    staf,
    "select count(*)::int n from problem_events where problem_id = $1",
    [masalah],
  );
  harusSama(Number(rows[0].n), 1);
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
