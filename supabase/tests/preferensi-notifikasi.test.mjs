/** Preferensi notifikasi: bawaan, pagar peran, dan kanal (0115). */
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
const { uji, jalankan } = buatSuite("Preferensi notifikasi");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const berlaku = async (uid) =>
  (
    await sebagaiAdmin(
      db,
      "select kategori, in_app, whatsapp from preferensi_notifikasi_berlaku($1)",
      [uid],
    )
  ).rows;

uji("Tanpa baris tersimpan, semua kategori ikut bawaan", async () => {
  const rian = await id("Rian Hidayat");
  const rows = await berlaku(rian);

  const { rows: jumlahKategori } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from unnest(enum_range(null::kategori_notifikasi))",
  );
  harusSama(rows.length, jumlahKategori[0].n);
  harus(
    rows.every((r) => r.in_app === true && r.whatsapp === false),
    "bawaan: in-app menyala, WhatsApp mati",
  );
});

uji("Kategori baru tetap ikut bawaan walau yang lain sudah diatur", async () => {
  const ceo = await id("Hafidz Alkahfi");
  await sebagaiAdmin(
    db,
    `insert into notification_preferences (user_id, kategori, in_app, whatsapp)
     values ($1, 'tugas', false, false)`,
    [ceo],
  );

  const rows = await berlaku(ceo);
  harusSama(rows.find((r) => r.kategori === "tugas").in_app, false);
  harusSama(rows.find((r) => r.kategori === "izin").in_app, true);
});

uji("WhatsApp tidak bisa menyala tanpa in-app", async () => {
  const ceo = await id("Hafidz Alkahfi");
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into notification_preferences (user_id, kategori, in_app, whatsapp)
         values ($1, 'izin', false, true)`,
        [ceo],
      ),
    "WhatsApp sendirian seharusnya ditolak",
  );
});

uji("CEO boleh mematikan notifikasinya", async () => {
  const ceo = await id("Hafidz Alkahfi");
  await sebagai(
    db,
    ceo,
    `insert into notification_preferences (user_id, kategori, in_app)
     values ($1, 'pengumuman', false)`,
    [ceo],
  );
  const rows = await berlaku(ceo);
  harusSama(rows.find((r) => r.kategori === "pengumuman").in_app, false);
});

uji("Staff tidak boleh mematikan notifikasinya", async () => {
  // Notifikasi seorang Staff berisi tugas yang ditujukan kepadanya;
  // mematikannya berarti pekerjaan itu hilang tanpa jejak.
  const rian = await id("Rian Hidayat");
  await harusDitolak(
    () =>
      sebagai(
        db,
        rian,
        `insert into notification_preferences (user_id, kategori, in_app)
         values ($1, 'tugas', false)`,
        [rian],
      ),
    "Staff seharusnya ditolak",
  );
});

uji("Staff tetap boleh mengatur kanal WhatsApp-nya", async () => {
  // Larangannya satu arah: yang dilarang mematikan, bukan mengatur.
  const rian = await id("Rian Hidayat");
  await sebagai(
    db,
    rian,
    `insert into notification_preferences (user_id, kategori, in_app, whatsapp)
     values ($1, 'tenggat', true, true)`,
    [rian],
  );
  const rows = await berlaku(rian);
  harusSama(rows.find((r) => r.kategori === "tenggat").whatsapp, true);
});

uji("Preferensi orang lain tidak terlihat maupun terubah", async () => {
  const rian = await id("Rian Hidayat");
  const nabila = await id("Nabila Putri");

  const { rows } = await sebagai(
    db,
    nabila,
    "select count(*)::int as n from notification_preferences where user_id = $1",
    [rian],
  );
  harusSama(rows[0].n, 0);

  await harusDitolak(
    () =>
      sebagai(
        db,
        nabila,
        `insert into notification_preferences (user_id, kategori, in_app)
         values ($1, 'izin', true)`,
        [rian],
      ),
    "menulis preferensi orang lain seharusnya ditolak",
  );
});

uji("Preferensi ikut terhapus saat penggunanya dihapus sistem", async () => {
  const { rows: baru } = await sebagaiAdmin(
    db,
    `insert into users (id, nama, email, role, jabatan, unit_id)
     values (gen_random_uuid(), 'Uji Pref', 'uji.pref@contoh.id', 'Staff', 'Staff',
             (select id from units where kode = 'tap'))
     returning id`,
  );
  const uid = baru[0].id;
  await sebagaiAdmin(
    db,
    `insert into notification_preferences (user_id, kategori, in_app)
     values ($1, 'tugas', true)`,
    [uid],
  );
  await sebagaiAdmin(db, "delete from notification_preferences where user_id = $1", [uid]);
  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from notification_preferences where user_id = $1",
    [uid],
  );
  harusSama(rows[0].n, 0);
});

uji("Kategori yang dimatikan tidak lagi menerbitkan notifikasi", async () => {
  // Pengaturan yang tidak berpengaruh apa-apa lebih buruk daripada
  // tidak ada pengaturan.
  const ceo = await id("Hafidz Alkahfi");
  const pembuat = await id("Farhan Pratama");

  await sebagaiAdmin(
    db,
    `insert into notification_preferences (user_id, kategori, in_app)
     values ($1, 'tugas', false)
     on conflict (user_id, kategori) do update set in_app = false`,
    [ceo],
  );

  const sebelum = (
    await sebagaiAdmin(
      db,
      "select count(*)::int as n from notifications where user_id = $1 and kategori = 'tugas'",
      [ceo],
    )
  ).rows[0].n;

  await sebagaiAdmin(
    db,
    `insert into tasks (tipe, judul, konteks, pembuat_id, penerima_id)
     values ('tiket', 'Tugas untuk CEO', '', $1, $2)`,
    [pembuat, ceo],
  );

  const sesudah = (
    await sebagaiAdmin(
      db,
      "select count(*)::int as n from notifications where user_id = $1 and kategori = 'tugas'",
      [ceo],
    )
  ).rows[0].n;
  harusSama(sesudah, sebelum);
});

uji("Kategori lain tetap sampai walau satu dimatikan", async () => {
  const ceo = await id("Hafidz Alkahfi");
  const pelapor = ceo;
  const sebelum = (
    await sebagaiAdmin(
      db,
      "select count(*)::int as n from notifications where user_id = $1 and kategori = 'masukan'",
      [ceo],
    )
  ).rows[0].n;

  const { rows } = await sebagaiAdmin(
    db,
    `insert into feedback (jenis, judul, isi, halaman, status, dilaporkan_oleh)
     values ('saran', 'Masukan CEO', 'isi', '/tugas', 'baru', $1) returning id`,
    [pelapor],
  );
  await sebagaiAdmin(
    db,
    "update feedback set status = 'dikerjakan', ditugaskan_ke = $1 where id = $2",
    [await id("Hendra Kusuma"), rows[0].id],
  );

  const sesudah = (
    await sebagaiAdmin(
      db,
      "select count(*)::int as n from notifications where user_id = $1 and kategori = 'masukan'",
      [ceo],
    )
  ).rows[0].n;
  harusSama(sesudah, sebelum + 1);
});

uji("Pengumuman melewati orang yang mematikan kategorinya", async () => {
  const ceo = await id("Hafidz Alkahfi");
  const pembuat = await id("Farhan Pratama");
  await sebagaiAdmin(
    db,
    `insert into notification_preferences (user_id, kategori, in_app)
     values ($1, 'pengumuman', false)
     on conflict (user_id, kategori) do update set in_app = false`,
    [ceo],
  );

  await sebagaiAdmin(
    db,
    `insert into announcements (slug, judul, ringkasan, isi, dibuat_oleh, published_at)
     values ('uji-preferensi', 'Uji preferensi', 'Ringkasan', array['isi'], $1, now())`,
    [pembuat],
  );

  const { rows } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from notifications where user_id = $1 and judul like '%Uji preferensi%'",
    [ceo],
  );
  harusSama(rows[0].n, 0);

  // Yang tidak mematikannya tetap menerima.
  const { rows: lain } = await sebagaiAdmin(
    db,
    "select count(*)::int as n from notifications where judul like '%Uji preferensi%'",
  );
  harus(lain[0].n > 0, "penerima lain seharusnya tetap dapat");
});

await jalankan();
