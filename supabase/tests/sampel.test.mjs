/** Sampel produk: cakupan baca, aturan perpindahan, dan keutuhan riwayat. */
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
const { uji, jalankan } = buatSuite("Sampel & perpindahannya");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const sampelId = async (kode) =>
  (await sebagaiAdmin(db, "select id from samples where kode = $1", [kode]))
    .rows[0].id;

/**
 * Memindahkan sampel ke gudang lewat jalur yang sah.
 * Status tidak bisa disetel langsung (migrasi 0049), jadi pemulihan
 * antar-test pun harus menempuh perpindahan yang benar.
 */
const kembalikanKeGudang = async (kode) => {
  const s = await sampelId(kode);
  const oleh = await id("Farhan Pratama");
  for (let i = 0; i < 6; i++) {
    const kini = (await status(kode)).status;
    if (kini === "tersedia") return;
    const berikut =
      kini === "dipegang" || kini === "dikembalikan" || kini === "hilang"
        ? "tersedia"
        : kini === "dikirim"
          ? "diterima"
          : "dikembalikan";
    await sebagaiAdmin(
      db,
      "insert into sample_events (sample_id, ke, oleh_id) values ($1, $2, $3)",
      [s, berikut, oleh],
    );
  }
};

const status = async (kode) =>
  (await sebagaiAdmin(db, "select status, pemegang_id, kreator from samples where kode = $1", [kode]))
    .rows[0];

uji("seed menggerakkan sampel lewat perpindahan sungguhan", async () => {
  // Statusnya tidak disetel langsung; kalau aturannya berubah, seed ikut gagal.
  harusSama((await status("SMP-0001")).status, "diterima");
  harusSama((await status("SMP-0004")).status, "tersedia");
  harusSama((await status("SMP-0006")).status, "hilang");
});

uji("perpindahan yang masuk akal diterima", async () => {
  const s = await sampelId("SMP-0004"); // tersedia
  const orang = await id("Farhan Pratama");
  await sebagaiAdmin(
    db,
    "insert into sample_events (sample_id, ke, oleh_id, pemegang_id) values ($1, 'dipegang', $2, $3)",
    [s, orang, await id("Rian Hidayat")],
  );
  const kini = await status("SMP-0004");
  harusSama(kini.status, "dipegang");
  harusSama(kini.pemegang_id, await id("Rian Hidayat"));
  await kembalikanKeGudang("SMP-0004");
});

uji("lompatan yang tidak masuk akal ditolak", async () => {
  // Barang tidak melompat dari gudang langsung ke tangan kreator.
  await kembalikanKeGudang("SMP-0004");
  const s = await sampelId("SMP-0004");
  await harusDitolak(
    async () =>
      sebagaiAdmin(
        db,
        "insert into sample_events (sample_id, ke, oleh_id) values ($1, 'diterima', $2)",
        [s, await id("Farhan Pratama")],
      ),
    "lompatan tersedia → diterima seharusnya ditolak",
  );
});

uji("status yang sama dua kali ditolak", async () => {
  await kembalikanKeGudang("SMP-0004");
  const s = await sampelId("SMP-0004");
  await harusDitolak(
    async () =>
      sebagaiAdmin(
        db,
        "insert into sample_events (sample_id, ke, oleh_id) values ($1, 'tersedia', $2)",
        [s, await id("Farhan Pratama")],
      ),
    "perpindahan ke status yang sama seharusnya ditolak",
  );
});

uji("sampel hilang bisa ditemukan kembali", async () => {
  const s = await sampelId("SMP-0006");
  await sebagaiAdmin(
    db,
    "insert into sample_events (sample_id, ke, oleh_id) values ($1, 'tersedia', $2)",
    [s, await id("Farhan Pratama")],
  );
  harusSama((await status("SMP-0006")).status, "tersedia");
});

uji("kembali ke gudang melepaskan pemegang dan kreatornya", async () => {
  const s = await sampelId("SMP-0001"); // diterima, ada kreatornya
  harus((await status("SMP-0001")).kreator !== "", "seharusnya punya kreator");

  await sebagaiAdmin(
    db,
    "insert into sample_events (sample_id, ke, oleh_id) values ($1, 'dikembalikan', $2)",
    [s, await id("Farhan Pratama")],
  );

  const kini = await status("SMP-0001");
  harusSama(kini.status, "dikembalikan");
  harusSama(kini.pemegang_id, null);
  harusSama(kini.kreator, "");
  await kembalikanKeGudang("SMP-0001");
});

uji("riwayat perpindahan tidak bisa diubah", async () => {
  await harusDitolak(
    () => sebagaiAdmin(db, "update sample_events set ke = 'hilang'"),
    "riwayat seharusnya kebal ubah",
  );
});

uji("riwayat perpindahan tidak bisa dihapus", async () => {
  await harusDitolak(
    () => sebagaiAdmin(db, "delete from sample_events"),
    "riwayat seharusnya kebal hapus",
  );
});

uji("kode sampel unik tanpa memandang huruf besar-kecil", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "insert into samples (kode, nama) values ('smp-0001', 'Kembar')",
      ),
    "kode yang sama beda huruf seharusnya ditolak",
  );
});

uji("Staff melihat sampel unitnya", async () => {
  const { rows } = await sebagai(
    db,
    await id("Rian Hidayat"),
    "select count(*)::int n from samples",
  );
  harus(rows[0].n > 0, "Staff affiliator harus melihat sampel unitnya");
});

uji("Staff tidak melihat sampel unit lain", async () => {
  const { rows } = await sebagai(
    db,
    await id("Rian Hidayat"),
    "select kode from samples order by kode",
  );
  const kode = rows.map((r) => r.kode);
  harusSama(kode.includes("SMP-0009"), false); // milik TAP
});

uji("Staff boleh mencatat perpindahan sampel unitnya", async () => {
  await kembalikanKeGudang("SMP-0004");
  const orang = await id("Rian Hidayat");
  const s = await sampelId("SMP-0004");
  await sebagai(
    db,
    orang,
    "insert into sample_events (sample_id, ke, oleh_id, pemegang_id) values ($1, 'dipegang', $2, $2)",
    [s, orang],
  );
  harusSama((await status("SMP-0004")).status, "dipegang");
  await kembalikanKeGudang("SMP-0004");
});

uji("perpindahan tidak bisa dicatat atas nama orang lain", async () => {
  // Mencatat atas nama orang lain membuat jejaknya kehilangan makna.
  const s = await sampelId("SMP-0004");
  await harusDitolak(
    async () =>
      sebagai(
        db,
        await id("Rian Hidayat"),
        "insert into sample_events (sample_id, ke, oleh_id) values ($1, 'dipegang', $2)",
        [s, await id("Farhan Pratama")],
      ),
    "mencatat atas nama orang lain seharusnya ditolak",
  );
});

uji("status sampel tidak bisa disunting langsung", async () => {
  // Kalau bisa, keadaan barang akan berbeda dari riwayatnya dan tidak ada
  // cara mengetahui mana yang benar.
  await harusDitolak(
    () =>
      sebagaiAdmin(db, "update samples set status = 'hilang' where kode = 'SMP-0004'"),
    "penyuntingan status langsung seharusnya ditolak",
  );
});

uji("sampel dipegang harus menyebut pemegangnya", async () => {
  // Tanpa nama, sampel yang hilang tidak bisa ditanyakan kepada siapa pun.
  const unit = (await sebagaiAdmin(db, "select id from units where kode = 'tap'")).rows[0].id;
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into samples (kode, nama, unit_id, status, pemegang_id)
         values ('SMP-UJI-1', 'Uji tanpa pemegang', $1, 'dipegang', null)`,
        [unit],
      ),
    "status dipegang tanpa pemegang seharusnya ditolak",
  );
});

uji("sampel dikirim harus menyebut kreator tujuannya", async () => {
  const unit = (await sebagaiAdmin(db, "select id from units where kode = 'tap'")).rows[0].id;
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into samples (kode, nama, unit_id, status, kreator)
         values ('SMP-UJI-2', 'Uji tanpa kreator', $1, 'dikirim', '')`,
        [unit],
      ),
    "status dikirim tanpa kreator seharusnya ditolak",
  );
});

uji("sampel yang kembali ke gudang dilepas dari pemegangnya", async () => {
  // Kalau tidak, barangnya muncul di gudang sekaligus di tangan orang.
  const sampel = (
    await sebagaiAdmin(db, "select id, pemegang_id from samples where kode = 'SMP-0003'")
  ).rows[0];
  harus(sampel.pemegang_id !== null, "SMP-0003 harus sedang dipegang");

  const admin = (
    await sebagaiAdmin(db, "select id from users where nama = 'Farhan Pratama'")
  ).rows[0].id;
  await sebagaiAdmin(
    db,
    `insert into sample_events (sample_id, ke, oleh_id) values ($1, 'tersedia', $2)`,
    [sampel.id, admin],
  );

  harusSama(
    (await sebagaiAdmin(db, "select pemegang_id from samples where id = $1", [sampel.id]))
      .rows[0].pemegang_id,
    null,
  );
  await terapkanSeed(db);
});

uji("setiap sampel menempel pada satu unit", async () => {
  // Sampel tanpa unit tidak terjaring lingkup unit mana pun: hanya
  // pengelola yang melihatnya, dan tim yang memegangnya tidak.
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into samples (kode, nama, unit_id) values ('SMP-UJI-3', 'Tanpa unit', null)`,
      ),
    "sampel tanpa unit seharusnya ditolak",
  );

  harusSama(
    Number(
      (await sebagaiAdmin(db, "select count(*)::int n from samples where unit_id is null"))
        .rows[0].n,
    ),
    0,
  );
});

uji("kode sampel dibangkitkan berurutan", async () => {
  const berikut = (
    await sebagaiAdmin(db, "select kode_sampel_berikutnya() k")
  ).rows[0].k;
  harusSama(berikut, "SMP-0011", "data contoh berisi sepuluh sampel");

  const unit = (await sebagaiAdmin(db, "select id from units where kode = 'tap'")).rows[0].id;
  const manajer = (
    await sebagaiAdmin(db, "select id from users where nama = 'Farhan Pratama'")
  ).rows[0].id;

  const pertama = await sebagai(db, manajer, "select (buat_sampel('Uji A', $1)).kode", [unit]);
  const kedua = await sebagai(db, manajer, "select (buat_sampel('Uji B', $1)).kode", [unit]);
  harusSama(pertama.rows[0].kode, "SMP-0011");
  harusSama(kedua.rows[0].kode, "SMP-0012");
});

uji("sampel yang dibangkitkan lahir tersedia di gudang", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select status, pemegang_id, kreator from samples where kode = 'SMP-0011'",
  );
  harusSama(rows[0].status, "tersedia");
  harusSama(rows[0].pemegang_id, null);
  harusSama(rows[0].kreator, "");
});

uji("kode buatan tangan tetap boleh dan tetap unik", async () => {
  const unit = (await sebagaiAdmin(db, "select id from units where kode = 'tap'")).rows[0].id;
  await sebagaiAdmin(
    db,
    "insert into samples (kode, nama, unit_id) values ('KHUSUS-01', 'Sampel khusus', $1)",
    [unit],
  );
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "insert into samples (kode, nama, unit_id) values ('khusus-01', 'Kembar', $1)",
        [unit],
      ),
    "kode kembar beda huruf seharusnya ditolak",
  );

  // Kode khusus tidak mengacaukan penomoran otomatis.
  harusSama(
    (await sebagaiAdmin(db, "select kode_sampel_berikutnya() k")).rows[0].k,
    "SMP-0013",
  );
  await terapkanSeed(db);
});

uji("awalan kode yang tidak masuk akal ditolak", async () => {
  const unit = (await sebagaiAdmin(db, "select id from units where kode = 'tap'")).rows[0].id;
  await harusDitolak(
    () =>
      sebagaiAdmin(db, "select buat_sampel('Uji', $1, '', 0, '', 'SMP-0001')", [unit]),
    "awalan bertanda hubung seharusnya ditolak",
  );
});

uji("sampel berjejak tidak bisa dihapus", async () => {
  // Menghapusnya ikut melenyapkan seluruh riwayat perpindahannya.
  const sampel = (
    await sebagaiAdmin(db, "select id, kode from samples where kode = 'SMP-0003'")
  ).rows[0];
  harus(
    Number(
      (await sebagaiAdmin(db, "select count(*)::int n from sample_events where sample_id = $1", [sampel.id]))
        .rows[0].n,
    ) > 0,
    "SMP-0003 harus sudah punya riwayat",
  );

  await harusDitolak(
    () => sebagaiAdmin(db, "delete from samples where id = $1", [sampel.id]),
    "penghapusan sampel berjejak seharusnya ditolak",
  );

  harusSama(
    Number(
      (await sebagaiAdmin(db, "select count(*)::int n from samples where id = $1", [sampel.id]))
        .rows[0].n,
    ),
    1,
    "sampelnya harus tetap ada",
  );
});

uji("sampel yang salah dibuat dan belum berjejak boleh dihapus", async () => {
  const unit = (await sebagaiAdmin(db, "select id from units where kode = 'tap'")).rows[0].id;
  const baru = (
    await sebagaiAdmin(
      db,
      "insert into samples (kode, nama, unit_id) values ('SMP-SALAH', 'Salah ketik', $1) returning id",
      [unit],
    )
  ).rows[0].id;

  await sebagaiAdmin(db, "delete from samples where id = $1", [baru]);
  harusSama(
    Number(
      (await sebagaiAdmin(db, "select count(*)::int n from samples where id = $1", [baru]))
        .rows[0].n,
    ),
    0,
  );
});

uji("sampel yang pernah dipindai pun tidak bisa dihapus", async () => {
  const unit = (await sebagaiAdmin(db, "select id from units where kode = 'tap'")).rows[0].id;
  const staf = (
    await sebagaiAdmin(db, "select id from users where nama = 'Yoga Saputra'")
  ).rows[0].id;
  const baru = (
    await sebagaiAdmin(
      db,
      "insert into samples (kode, nama, unit_id) values ('SMP-PINDAI', 'Pernah dipindai', $1) returning id",
      [unit],
    )
  ).rows[0].id;
  await sebagaiAdmin(
    db,
    "insert into sample_scans (kode, sample_id, oleh_id, dikenali) values ('SMP-PINDAI', $1, $2, true)",
    [baru, staf],
  );

  await harusDitolak(
    () => sebagaiAdmin(db, "delete from samples where id = $1", [baru]),
    "penghapusan sampel yang pernah dipindai seharusnya ditolak",
  );
  harusSama(
    Number(
      (await sebagaiAdmin(db, "select count(*)::int n from samples where id = $1", [baru]))
        .rows[0].n,
    ),
    1,
    "riwayat pemindaiannya menghalangi penghapusan",
  );
  await terapkanSeed(db);
});

uji("akun sampel harus milik unit sampel itu", async () => {
  // Kalau tidak, PIC unit lain ikut melihat sampel yang bukan urusannya.
  const sampel = (
    await sebagaiAdmin(db, "select id from samples where kode = 'SMP-0008'")
  ).rows[0].id; // unit MCN
  const akunAffiliator = (
    await sebagaiAdmin(db, "select id from accounts where username = '@skincare_official'")
  ).rows[0].id;

  await harusDitolak(
    () =>
      sebagaiAdmin(db, "update samples set account_id = $1 where id = $2", [
        akunAffiliator,
        sampel,
      ]),
    "akun lintas unit seharusnya ditolak",
  );
});

uji("PIC akun melihat sampel yang beredar untuk akunnya", async () => {
  // Orang yang paling berkepentingan justru yang selama ini tidak tahu.
  const pic = (
    await sebagaiAdmin(
      db,
      `select u.id from users u
         join accounts a on a.pic_user_id = u.id
        where a.username = '@skincare_official'`,
    )
  ).rows[0].id;

  const { rows } = await sebagai(
    db,
    pic,
    `select count(*)::int n from samples s
       join accounts a on a.id = s.account_id
      where a.username = '@skincare_official'`,
  );
  harus(Number(rows[0].n) > 0, "PIC harus melihat sampel akunnya");
});

uji("staf unit lain tetap tidak melihatnya", async () => {
  const luar = (
    await sebagaiAdmin(db, "select id from users where nama = 'Yoga Saputra'")
  ).rows[0].id; // Staff TAP
  const { rows } = await sebagai(
    db,
    luar,
    `select count(*)::int n from samples s
       join units un on un.id = s.unit_id
      where un.kode = 'affiliator'`,
  );
  harusSama(Number(rows[0].n), 0);
});

uji("memindahkan sampel ke unit lain melepas akunnya", async () => {
  const sampel = (
    await sebagaiAdmin(db, "select id from samples where kode = 'SMP-0001'")
  ).rows[0].id;
  const mcn = (await sebagaiAdmin(db, "select id from units where kode = 'mcn'")).rows[0].id;

  await harusDitolak(
    () => sebagaiAdmin(db, "update samples set unit_id = $1 where id = $2", [mcn, sampel]),
    "pindah unit tanpa melepas akunnya seharusnya ditolak",
  );

  await sebagaiAdmin(
    db,
    "update samples set unit_id = $1, account_id = null where id = $2",
    [mcn, sampel],
  );
  harusSama(
    (await sebagaiAdmin(db, "select account_id from samples where id = $1", [sampel]))
      .rows[0].account_id,
    null,
  );
  await terapkanSeed(db);
});

const gagal = uji("brand dan tautan produk ikut tersimpan dari data contoh", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    "select kode, brand, link_produk from samples where kode = 'SMP-0001'",
  );

  harusSama(rows[0].brand, "Glowrich Official", "brand terbaca");
  harus(
    rows[0].link_produk.startsWith("https://shopee.co.id/"),
    "tautan etalase ikut masuk",
  );
});

uji("tautan produk selain http(s) ditolak basis data", async () => {
  const id = (
    await sebagaiAdmin(db, "select id from samples where kode = 'SMP-0002'")
  ).rows[0].id;

  // Kolom ini berakhir di atribut href; `javascript:` di sana adalah
  // jalan masuk skrip asing, bukan sekadar tautan yang keliru.
  await harusDitolak(
    () =>
      sebagaiAdmin(db, "update samples set link_produk = $1 where id = $2", [
        "javascript:alert(1)",
        id,
      ]),
    "tautan berprotokol skrip",
  );

  await sebagaiAdmin(db, "update samples set link_produk = $1 where id = $2", [
    "https://www.tiktok.com/@akun/video/7301122334455667788",
    id,
  ]);
  harusSama(
    (
      await sebagaiAdmin(db, "select link_produk from samples where id = $1", [
        id,
      ])
    ).rows[0].link_produk.startsWith("https://"),
    true,
    "tautan yang sah diterima",
  );
});

uji("tautan boleh dikosongkan tanpa menyentuh kodenya", async () => {
  const sebelum = (
    await sebagaiAdmin(db, "select id, kode from samples where kode = 'SMP-0003'")
  ).rows[0];

  await sebagaiAdmin(db, "update samples set link_produk = null where id = $1", [
    sebelum.id,
  ]);

  const sesudah = (
    await sebagaiAdmin(db, "select kode, link_produk from samples where id = $1", [
      sebelum.id,
    ])
  ).rows[0];
  harusSama(sesudah.link_produk, null, "tautannya dilepas");
  harusSama(sesudah.kode, sebelum.kode, "kode QR-nya tidak ikut berubah");
});

await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
