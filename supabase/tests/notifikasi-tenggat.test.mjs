/** Pengingat tenggat yang aman dipanggil berulang (0113). */
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
const { uji, jalankan } = buatSuite("Pengingat tenggat");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

/**
 * Tenggat ditulis sebagai ekspresi SQL (`now() + interval …`), bukan
 * parameter: nilai relatif terhadap waktu basis data jauh lebih stabil
 * daripada waktu yang dihitung di Node lalu dikirim.
 */
const buatTugas = async (judul, tenggatSql, status = "todo") => {
  const pembuat = await id("Dewi Lestari");
  const penerima = await id("Rian Hidayat");
  const { rows } = await sebagaiAdmin(
    db,
    `insert into tasks (tipe, judul, konteks, pembuat_id, penerima_id, tenggat, status)
     values ('tiket', $1, '', $2, $3, ${tenggatSql}, $4) returning id`,
    [judul, pembuat, penerima, status],
  );
  return rows[0].id;
};

const hitungTenggat = async (cocok) =>
  (
    await sebagaiAdmin(
      db,
      "select count(*)::int as n from notifications where kategori = 'tenggat' and judul like $1",
      [`%${cocok}%`],
    )
  ).rows[0].n;

const jalankanPengingat = async (jam = 24) =>
  (
    await sebagaiAdmin(db, "select terbitkan_notifikasi_tenggat($1) as n", [
      jam,
    ])
  ).rows[0].n;

uji("Tenggat dalam 24 jam menghasilkan pengingat", async () => {
  await buatTugas("Tugas besok", "now() + interval '6 hours'");
  await jalankanPengingat();
  harus((await hitungTenggat("Tugas besok")) === 1, "harus terbit sekali");
});

uji("Memanggil berulang tidak menerbitkan ganda", async () => {
  // Pekerjaan terjadwal yang gagal lalu diulang adalah hal biasa;
  // notifikasi ganda membuat orang berhenti membaca loncengnya.
  await jalankanPengingat();
  await jalankanPengingat();
  harusSama(await hitungTenggat("Tugas besok"), 1);
});

uji("Tenggat yang sudah lewat memakai kalimat berbeda", async () => {
  await buatTugas("Tugas telat", "now() - interval '2 days'");
  await jalankanPengingat();
  harusSama(await hitungTenggat("Tenggat lewat: Tugas telat"), 1);
  harusSama(await hitungTenggat("Tenggat mendekat: Tugas telat"), 0);
});

uji("Tugas selesai tidak diingatkan", async () => {
  await buatTugas("Tugas beres", "now() + interval '3 hours'", "selesai");
  await jalankanPengingat();
  harusSama(await hitungTenggat("Tugas beres"), 0);
});

uji("Tenggat yang digeser membuka pengingat baru", async () => {
  const tid = await buatTugas("Tugas digeser", "now() + interval '3 hours'");
  await jalankanPengingat();
  harusSama(await hitungTenggat("Tugas digeser"), 1);

  // Digeser maju: pengingatnya layak terbit lagi.
  await sebagaiAdmin(
    db,
    "update tasks set tenggat = now() + interval '5 hours' where id = $1",
    [tid],
  );
  await jalankanPengingat();
  harusSama(await hitungTenggat("Tugas digeser"), 2);
});

uji("Ambang jam bisa disempitkan", async () => {
  await buatTugas("Tugas lusa", "now() + interval '40 hours'");
  await jalankanPengingat(24);
  harusSama(await hitungTenggat("Tugas lusa"), 0);

  await jalankanPengingat(48);
  harusSama(await hitungTenggat("Tugas lusa"), 1);
});

uji("Pengguna biasa tidak bisa menjalankan pengingat", async () => {
  // Kalau bisa, siapa pun bisa membanjiri kotak masuk seluruh tim.
  // Yang diuji adalah PERILAKUNYA, bukan GRANT-nya: proyek Supabase
  // lazim menjalankan `grant execute on all functions` setelah
  // migrasi, dan pagar yang hanya bergantung pada REVOKE akan hilang
  // tanpa ada yang sadar.
  const rian = await id("Rian Hidayat");
  await harusDitolak(
    () => sebagai(db, rian, "select terbitkan_notifikasi_tenggat(24)"),
    "pengguna biasa seharusnya ditolak",
  );
});

await jalankan();
