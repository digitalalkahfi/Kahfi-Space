/** Pemicu peristiwa notifikasi (0112). */
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
const { uji, jalankan } = buatSuite("Pemicu notifikasi");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const notif = async (untuk, kategori) =>
  (
    await sebagaiAdmin(
      db,
      "select judul, pesan, tautan from notifications where user_id = $1 and kategori = $2 order by created_at desc",
      [untuk, kategori],
    )
  ).rows;

uji("Tugas baru memberi tahu penerimanya", async () => {
  const pembuat = await id("Dewi Lestari");
  const penerima = await id("Rian Hidayat");
  const sebelum = (await notif(penerima, "tugas")).length;

  await sebagaiAdmin(
    db,
    `insert into tasks (tipe, judul, konteks, pembuat_id, penerima_id)
     values ('tiket', 'Naikkan konten beauty', 'Affiliator · pekan ini', $1, $2)`,
    [pembuat, penerima],
  );

  const sesudah = await notif(penerima, "tugas");
  harusSama(sesudah.length, sebelum + 1);
  harus(
    sesudah[0].judul.includes("Naikkan konten beauty"),
    "judul tugas seharusnya ikut disebut",
  );
  harusSama(sesudah[0].tautan, "/tugas");
});

uji("Tugas untuk diri sendiri tidak memberi tahu siapa-siapa", async () => {
  // Memberi tahu orang tentang hal yang baru saja ia lakukan adalah
  // cara tercepat membuat lonceng berhenti dipercaya.
  const diri = await id("Farhan Pratama");
  const sebelum = (await notif(diri, "tugas")).length;

  await sebagaiAdmin(
    db,
    `insert into tasks (tipe, judul, konteks, pembuat_id, penerima_id)
     values ('pribadi', 'Catatan sendiri', '', $1, $1)`,
    [diri],
  );

  harusSama((await notif(diri, "tugas")).length, sebelum);
});

uji("Tugas yang dialihkan memberi tahu penerima barunya", async () => {
  const pembuat = await id("Dewi Lestari");
  const lama = await id("Rian Hidayat");
  const baru = await id("Nabila Putri");

  const { rows } = await sebagaiAdmin(
    db,
    `insert into tasks (tipe, judul, konteks, pembuat_id, penerima_id)
     values ('tiket', 'Tugas pindah tangan', '', $1, $2) returning id`,
    [pembuat, lama],
  );
  const sebelum = (await notif(baru, "tugas")).length;

  await sebagaiAdmin(db, "update tasks set penerima_id = $1 where id = $2", [
    baru,
    rows[0].id,
  ]);

  const sesudah = await notif(baru, "tugas");
  harusSama(sesudah.length, sebelum + 1);
  harus(sesudah[0].judul.includes("dialihkan"), "harus menyebut pengalihan");
});

uji("Keputusan transaksi memberi tahu pengajunya", async () => {
  const pengaju = await id("Laras Ayuningtyas");
  const penyetuju = await id("Farhan Pratama");
  const sebelum = (await notif(pengaju, "transaksi")).length;

  const { rows } = await sebagaiAdmin(
    db,
    `insert into transactions (tanggal, arah, jenis, keterangan, jumlah, status, diajukan_id)
     values (current_date, 'keluar', 'beban', 'Uji keputusan', 1500000, 'diajukan', $1)
     returning id`,
    [pengaju],
  );

  // Status transaksi hanya boleh berubah lewat pencatatan persetujuan
  // (0098); penanda sesi itu dituruti supaya yang diuji di sini
  // benar-benar pemicunya, bukan pagar yang lain.
  // Penanda sesi (bukan transaksi) — tiap kueri di harness berjalan di
  // transaksinya sendiri, jadi `is_local = true` sudah hilang saat
  // UPDATE-nya jalan.
  await sebagaiAdmin(
    db,
    "select set_config('app.transaksi_via_persetujuan', 'ya', false)",
  );
  await sebagaiAdmin(
    db,
    "update transactions set status = 'disetujui', disetujui_id = $1 where id = $2",
    [penyetuju, rows[0].id],
  );
  await sebagaiAdmin(
    db,
    "select set_config('app.transaksi_via_persetujuan', '', false)",
  );

  const sesudah = await notif(pengaju, "transaksi");
  harusSama(sesudah.length, sebelum + 1);
  harus(sesudah[0].judul.includes("disetujui"), "harus menyebut keputusannya");
  harus(
    sesudah[0].pesan.includes("Uji keputusan"),
    "keterangan transaksinya harus ikut",
  );
});

uji("Perubahan transaksi tanpa ganti status tidak memberi tahu apa-apa", async () => {
  const pengaju = await id("Laras Ayuningtyas");
  const { rows } = await sebagaiAdmin(
    db,
    `insert into transactions (tanggal, arah, jenis, keterangan, jumlah, status, diajukan_id)
     values (current_date, 'keluar', 'beban', 'Uji diam', 100000, 'diajukan', $1)
     returning id`,
    [pengaju],
  );
  const sebelum = (await notif(pengaju, "transaksi")).length;

  await sebagaiAdmin(
    db,
    "update transactions set keterangan = 'Uji diam (diperbaiki)' where id = $1",
    [rows[0].id],
  );

  harusSama((await notif(pengaju, "transaksi")).length, sebelum);
});

uji("Pengumuman baru menjangkau setiap penerimanya", async () => {
  // Satu pengumuman = satu baris per orang, karena "sudah dibaca" milik
  // masing-masing orang.
  const pembuat = await id("Hafidz Alkahfi");
  const { rows: sebelum } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from notifications where kategori = 'pengumuman'",
  );

  await sebagaiAdmin(
    db,
    `insert into announcements (slug, judul, ringkasan, isi, dibuat_oleh, published_at)
     values ('uji-pemicu', 'Uji pemicu', 'Ringkasan uji', array['isi'], $1, now())`,
    [pembuat],
  );

  const { rows: sesudah } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from notifications where kategori = 'pengumuman'",
  );
  const { rows: aktif } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from users where status = 'aktif' and id <> $1",
    [pembuat],
  );
  harusSama(sesudah[0].n - sebelum[0].n, aktif[0].n);

  // Pembuatnya sendiri tidak ikut diberi tahu.
  const { rows: milikPembuat } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from notifications where user_id = $1 and judul like '%Uji pemicu%'",
    [pembuat],
  );
  harusSama(milikPembuat[0].n, 0);
});

uji("Pengumuman bertarget hanya menjangkau perannya", async () => {
  const pembuat = await id("Hafidz Alkahfi");
  await sebagaiAdmin(
    db,
    `insert into announcements (slug, judul, ringkasan, isi, target_role, dibuat_oleh, published_at)
     values ('uji-target', 'Khusus Finance', 'Hanya Finance', array['isi'], 'Finance', $1, now())`,
    [pembuat],
  );

  const { rows } = await sebagaiAdmin(
    db,
    `select u.role, count(*)::int as n
     from notifications n join users u on u.id = n.user_id
     where n.judul like '%Khusus Finance%'
     group by u.role`,
  );
  harus(rows.length > 0, "seharusnya ada penerima");
  harus(
    rows.every((r) => r.role === "Finance"),
    `hanya Finance yang boleh menerima, dapat: ${rows.map((r) => r.role).join(", ")}`,
  );
});

uji("Perubahan status masukan memberi tahu pelapornya", async () => {
  const pelapor = await id("Rian Hidayat");
  const sebelum = (await notif(pelapor, "masukan")).length;

  const { rows } = await sebagaiAdmin(
    db,
    `insert into feedback (jenis, judul, isi, halaman, status, dilaporkan_oleh)
     values ('saran', 'Uji masukan', 'isi', '/tugas', 'baru', $1) returning id`,
    [pelapor],
  );
  // Penanggung jawab wajib ditentukan sebelum status 'dikerjakan' (0094).
  await sebagaiAdmin(
    db,
    "update feedback set status = 'dikerjakan', ditugaskan_ke = $1 where id = $2",
    [await id("Hendra Kusuma"), rows[0].id],
  );

  const sesudah = await notif(pelapor, "masukan");
  harusSama(sesudah.length, sebelum + 1);
  harus(sesudah[0].pesan.includes("dikerjakan"), "status barunya harus disebut");
});

uji("Notifikasi yang terbit selalu punya tautan internal", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from notifications where tautan !~ '^/(?!/)[^\\s]*$'",
  );
  harusSama(rows[0].n, 0);
});

await jalankan();
