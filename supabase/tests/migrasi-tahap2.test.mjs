/**
 * Jalur tulis yang dipakai migrasi tahap 2 tanpa sesi pengguna: pengumuman
 * masuk sebagai draf lalu diterbitkan tanpa notifikasi, status sampel
 * digerakkan lewat kejadian, masalah dan masukan masuk dengan status
 * akhirnya, dan LMS terisi kursus → modul → pendaftaran → kemajuan.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Migrasi tahap 2");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const KHOLID = (await satu(`select id from users where role = 'Manager' limit 1`)).id;
const RIAN = (await satu(`select id from users where nama = 'Rian Hidayat'`)).id;
const AFF = (await satu(`select id from units where kode = 'affiliator'`)).id;

uji("pengumuman lama: draf lalu terbit lewat UPDATE, tanpa satu notifikasi pun", async () => {
  const { n: sebelum } = await satu(
    `select count(*)::int n from notifications where kategori = 'pengumuman'`,
  );
  const { id } = await satu(
    `insert into announcements (slug, judul, ringkasan, isi, dibuat_oleh, published_at, created_at)
     values ('pengumuman-tim-6buv5i', 'PENGUMUMAN TIM', 'Info', array['Baris satu','Baris dua'], $1, null, '2026-09-07T10:08:36Z')
     returning id`,
    [KHOLID],
  );
  await sebagaiAdmin(
    db,
    `update announcements set published_at = '2026-09-07T10:08:36Z' where id = $1`,
    [id],
  );
  const { n: sesudah } = await satu(
    `select count(*)::int n from notifications where kategori = 'pengumuman'`,
  );
  harusSama(sesudah, sebelum, "tidak boleh ada notifikasi dari pengumuman lama");
  const baris = await satu(`select published_at, cardinality(isi) n from announcements where id = $1`, [id]);
  harus(baris.published_at !== null, "pengumuman harus terbit");
  harusSama(baris.n, 2);
});

uji("agenda lama masuk sebagai agenda seluruh perusahaan dengan jam dan lokasi", async () => {
  const { id } = await satu(
    `insert into agenda (judul, keterangan, jenis, tanggal, jam_mulai, jam_selesai, unit_id, lokasi, dibuat_oleh, created_at)
     values ('Meeting dengan Dosen', 'Peserta: A, B', 'rapat', '2026-06-15', '19:30', '21:00', null, 'https://zoom.us/launch/jc/1', $1, '2026-06-15T09:59:29Z')
     returning id`,
    [KHOLID],
  );
  // Pembaruan tanpa menyentuh unit_id tetap lolos tanpa sesi.
  await sebagaiAdmin(db, `update agenda set keterangan = 'Peserta: A, B, C' where id = $1`, [id]);
  const b = await satu(`select jenis, jam_mulai::text jam from agenda where id = $1`, [id]);
  harusSama(b.jenis, "rapat");
  harusSama(b.jam, "19:30:00");
});

uji("masalah lama masuk dengan status selesai dan jejak penyelesaiannya", async () => {
  const { id } = await satu(
    `insert into problems (judul, konteks, unit_id, dilaporkan_oleh, dampak, status, solusi, created_at, updated_at)
     values ('Akun Apis Kena Banned', 'Kena pelanggaran.', $1, $2, 'tinggi', 'selesai', 'diganti akun baru', '2026-09-10T01:54:55Z', '2026-09-11T01:50:06Z')
     returning id`,
    [AFF, RIAN],
  );
  await sebagaiAdmin(
    db,
    `insert into problem_events (problem_id, dari, ke, oleh_id, catatan, pada)
     values ($1, 'baru', 'selesai', $2, 'Diselesaikan di sistem lama.', '2026-09-11T01:50:06Z')`,
    [id, KHOLID],
  );
  const { n } = await satu(`select count(*)::int n from problem_events where problem_id = $1`, [id]);
  harusSama(n, 1);
  const b = await satu(`select status from problems where id = $1`, [id]);
  harusSama(b.status, "selesai");
});

uji("masukan lama masuk selesai beserta komentarnya; bug diberi keparahan sedang", async () => {
  const { id } = await satu(
    `insert into feedback (jenis, judul, isi, halaman, status, dilaporkan_oleh, created_at, updated_at)
     values ('bug', 'Fitur rekap absen 7 terakhir tidak sesuai', 'Isi masukan lama.', 'Absensi', 'selesai', $1, '2026-08-27T07:00:00Z', '2026-08-27T07:00:00Z')
     returning id`,
    [RIAN],
  );
  await sebagaiAdmin(
    db,
    `insert into feedback_comments (feedback_id, oleh_id, isi, created_at)
     values ($1, $2, 'Berlaku juga untuk fitur 28 hari terakhir', '2026-08-27T07:30:35Z')`,
    [id, KHOLID],
  );
  const b = await satu(`select status, keparahan from feedback where id = $1`, [id]);
  harusSama(b.status, "selesai");
  harusSama(b.keparahan, "sedang");
  const { n } = await satu(`select count(*)::int n from feedback_comments where feedback_id = $1`, [id]);
  harusSama(n, 1);
});

uji("sampel lama: tersedia, lalu kejadian dipegang menggerakkan statusnya; pindaian tercatat", async () => {
  const { id } = await satu(
    `insert into samples (kode, nama, kategori, unit_id, nilai, status, catatan, created_at)
     values ('SMP-260915-0001', 'Jas pria', 'Fashion', $1, 0, 'tersedia', 'Token lama: YH22NABS', '2026-09-15T01:46:39Z')
     returning id`,
    [AFF],
  );
  await sebagaiAdmin(
    db,
    `insert into sample_events (sample_id, ke, oleh_id, pemegang_id, catatan, pada)
     values ($1, 'dipegang', $2, $3, 'Penerima tercatat di sistem lama.', '2026-09-15T01:46:39Z')`,
    [id, KHOLID, RIAN],
  );
  const s = await satu(`select status, pemegang_id from samples where id = $1`, [id]);
  harusSama(s.status, "dipegang");
  harusSama(s.pemegang_id, RIAN);
  // Pindaian kode yang tidak dikenal tetap tercatat sebagai tak dikenali.
  await sebagaiAdmin(
    db,
    `insert into sample_scans (kode, sample_id, oleh_id, dikenali, pada)
     values ('SMP-260911-0001', null, $1, false, '2026-09-11T01:48:07Z')`,
    [KHOLID],
  );
  const { n } = await satu(`select count(*)::int n from sample_scans where kode = 'SMP-260911-0001'`);
  harusSama(n, 1);
});

uji("LMS lama: kursus → modul → pendaftaran → kemajuan; kelulusan dihitung V2", async () => {
  const { id: kursus } = await satu(
    `insert into courses (judul, ringkasan, kategori, tingkat, unit_id, wajib_untuk, aktif, dibuat_oleh, created_at)
     values ('PlayBook Affiliator', 'Jalur lama: On Boarding', 'On Boarding Affiliator', 'dasar', $1, '{}', true, $2, '2026-08-25T00:00:00Z')
     returning id`,
    [AFF, KHOLID],
  );
  const { id: modul } = await satu(
    `insert into course_modules (course_id, urutan, judul, isi, durasi_menit)
     values ($1, 1, 'Affiliator Playbook', 'PDF: https://x/p.pdf', 75) returning id`,
    [kursus],
  );
  const { id: daftar } = await satu(
    `insert into course_enrollments (course_id, user_id, dimulai_pada)
     values ($1, $2, '2026-08-25T08:00:00Z') returning id`,
    [kursus, RIAN],
  );
  await sebagaiAdmin(
    db,
    `insert into module_progress (enrollment_id, module_id, selesai_pada) values ($1, $2, '2026-08-26T07:36:54Z')`,
    [daftar, modul],
  );
  const e = await satu(`select selesai_pada from course_enrollments where id = $1`, [daftar]);
  harus(e.selesai_pada !== null, "satu-satunya modul tuntas → kursus selesai");
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
