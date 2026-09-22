/**
 * Akses data migrasi per peran.
 *
 * Isinya memuat data pribadi seluruh karyawan lama beserta jejak
 * keputusan yang tidak bisa dibatalkan, jadi hanya CEO/Manager yang boleh
 * menyentuhnya — termasuk Finance, yang di tempat lain boleh melihat
 * angka lintas unit.
 */
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
const { uji, jalankan } = buatSuite("Akses data migrasi");

const id = async (nama) =>
  (await sebagaiAdmin(db, "select id from users where nama = $1", [nama]))
    .rows[0].id;

const TABEL = [
  "migrasi_jalan",
  "migrasi_catatan",
  "migrasi_persetujuan",
  "kv_store_lama",
];

uji("menyiapkan isi untuk diuji", async () => {
  const manajer = await id("Farhan Pratama");
  const { rows } = await sebagai(
    db,
    manajer,
    "select (mulai_migrasi_jalan('uji_coba'::tahap_migrasi)).id",
  );
  await sebagaiAdmin(
    db,
    `insert into migrasi_catatan (jalan_id, entitas, kunci_lama, status)
     values ($1, 'user', 'user:1', 'berhasil')`,
    [rows[0].id],
  );
  await sebagai(
    db,
    manajer,
    `insert into migrasi_persetujuan (entitas, versi, disetujui_oleh)
     values ('user', 'v1', $1)`,
    [manajer],
  );
  await sebagaiAdmin(
    db,
    "insert into kv_store_lama (key, value) values ('user:1', '{}'::jsonb)",
  );

  for (const tabel of TABEL) {
    harus(
      Number(
        (await sebagaiAdmin(db, `select count(*)::int n from ${tabel}`)).rows[0].n,
      ) > 0,
      `${tabel} harus berisi untuk diuji`,
    );
  }
});

for (const peran of ["Nabila Putri", "Dewi Lestari", "Laras Ayuningtyas"]) {
  uji(`${peran} tidak melihat isi data migrasi`, async () => {
    const orang = await id(peran);
    for (const tabel of TABEL) {
      const { rows } = await sebagai(
        db,
        orang,
        `select count(*)::int n from ${tabel}`,
      );
      harusSama(Number(rows[0].n), 0, `${tabel} tidak boleh terbaca ${peran}`);
    }
  });
}

uji("CEO dan Manager melihat seluruhnya", async () => {
  for (const nama of ["Hafidz Alkahfi", "Farhan Pratama"]) {
    const orang = await id(nama);
    for (const tabel of TABEL) {
      const { rows } = await sebagai(
        db,
        orang,
        `select count(*)::int n from ${tabel}`,
      );
      harus(Number(rows[0].n) > 0, `${tabel} harus terbaca ${nama}`);
    }
  }
});

uji("Leader tidak bisa menyetujui pemetaan", async () => {
  const leader = await id("Dewi Lestari");
  await harusDitolak(
    () =>
      sebagai(
        db,
        leader,
        `insert into migrasi_persetujuan (entitas, versi, disetujui_oleh)
         values ('account', 'v1', $1)`,
        [leader],
      ),
    "persetujuan oleh Leader seharusnya ditolak",
  );
});

uji("Manager tidak bisa menyetujui atas nama orang lain", async () => {
  // Persetujuan yang bisa diatasnamakan kehilangan seluruh maknanya.
  const manajer = await id("Farhan Pratama");
  const ceo = await id("Hafidz Alkahfi");
  await harusDitolak(
    () =>
      sebagai(
        db,
        manajer,
        `insert into migrasi_persetujuan (entitas, versi, disetujui_oleh)
         values ('goal', 'v1', $1)`,
        [ceo],
      ),
    "persetujuan atas nama orang lain seharusnya ditolak",
  );
});

uji("Staff tidak bisa memalsukan catatan migrasi", async () => {
  const staf = await id("Nabila Putri");
  const jalan = (
    await sebagaiAdmin(db, "select id from migrasi_jalan limit 1")
  ).rows[0].id;
  await harusDitolak(
    () =>
      sebagai(
        db,
        staf,
        `insert into migrasi_catatan (jalan_id, entitas, kunci_lama, status)
         values ($1, 'user', 'user:palsu', 'berhasil')`,
        [jalan],
      ),
    "catatan palsu oleh Staff seharusnya ditolak",
  );
});

uji("status K-Space lama tetap terlihat semua orang", async () => {
  // Berbeda dari isinya: semua orang perlu tahu sistem mana yang berlaku.
  const staf = await id("Nabila Putri");
  const { rows } = await sebagai(
    db,
    staf,
    "select lama_readonly from pengaturan",
  );
  harusSama(rows.length, 1);
  await terapkanSeed(db);
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
