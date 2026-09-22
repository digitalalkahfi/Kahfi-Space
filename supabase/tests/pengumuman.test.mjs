/**
 * Pengumuman ber-targeting — dijalankan di PostgreSQL sungguhan (PGlite)
 * sebagai role `authenticated`, jadi RLS benar-benar diuji.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusDitolak,
  harusSama,
  sebagai,
  sebagaiAdmin,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
const { uji, jalankan } = buatSuite("Pengumuman ber-targeting");

// --- data uji ------------------------------------------------------------
const ID = {
  manager: "11111111-1111-1111-1111-111111111111",
  leaderTap: "22222222-2222-2222-2222-222222222222",
  staffAff: "33333333-3333-3333-3333-333333333333",
  staffMcn: "44444444-4444-4444-4444-444444444444",
};

// Departemen dan unit datang dari migrasi data referensi (0069), bukan
// dari data contoh — jadi tidak perlu dibuat ulang di sini.

const unit = Object.fromEntries(
  (await sebagaiAdmin(db, `select kode, id from units`)).rows.map((r) => [
    r.kode,
    r.id,
  ]),
);

await sebagaiAdmin(
  db,
  `insert into users (id, nama, email, role, unit_id) values
     ($1, 'Farhan Pratama', 'farhan@alkahfi.co.id', 'Manager', null),
     ($2, 'Dimas Maulana',  'dimas@alkahfi.co.id',  'Leader',  $5),
     ($3, 'Rian Hidayat',   'rian@alkahfi.co.id',   'Staff',   $6),
     ($4, 'Rizky Ananda',   'rizky@alkahfi.co.id',  'Staff',   $7)`,
  [ID.manager, ID.leaderTap, ID.staffAff, ID.staffMcn, unit.tap, unit.affiliator, unit.mcn],
);

await sebagaiAdmin(
  db,
  `insert into announcements
     (slug, judul, ringkasan, isi, target_role, target_unit_id, disematkan, dibuat_oleh, published_at)
   values
     ('cutoff-partner-center', 'Cutoff Partner Center', 'Sinkronisasi dipercepat.', array['Isi lengkap.'],
      null, null, true, $1, now()),
     ('revisi-alur-qc', 'Revisi alur QC tiket', 'Perlu konfirmasi balik.', array['Isi lengkap.'],
      'Leader', null, false, $1, now()),
     ('jadwal-standup', 'Jadwal standup Affiliator', 'Bergeser ke 09.00.', array['Isi lengkap.'],
      null, $2, false, $1, now()),
     ('draf-belum-tayang', 'Draf belum tayang', 'Belum dipublikasikan.', array['Isi lengkap.'],
      null, null, false, $1, null)`,
  [ID.manager, unit.affiliator],
);

const judulUntuk = async (id) =>
  (
    await sebagai(db, id, `select judul from announcements order by judul`)
  ).rows.map((r) => r.judul);

// --- kasus ---------------------------------------------------------------
uji("Manager melihat semua, termasuk draf", async () => {
  const j = await judulUntuk(ID.manager);
  harus(j.includes("Draf belum tayang"), "draf harus terlihat oleh Manager");
  harusSama(j.length, 4, "Manager harus melihat 4 pengumuman");
});

uji("Staff tidak melihat draf yang belum tayang", async () => {
  const j = await judulUntuk(ID.staffAff);
  harus(!j.includes("Draf belum tayang"), "draf bocor ke Staff");
});

uji("Pengumuman khusus Leader tidak terlihat Staff", async () => {
  const j = await judulUntuk(ID.staffAff);
  harus(
    !j.includes("Revisi alur QC tiket"),
    "pengumuman target_role=Leader bocor ke Staff",
  );
});

uji("Leader melihat pengumuman khusus Leader", async () => {
  const j = await judulUntuk(ID.leaderTap);
  harus(j.includes("Revisi alur QC tiket"), "Leader harus melihatnya");
});

uji("Pengumuman unit Affiliator hanya untuk unit itu", async () => {
  const aff = await judulUntuk(ID.staffAff);
  const mcn = await judulUntuk(ID.staffMcn);
  harus(
    aff.includes("Jadwal standup Affiliator"),
    "staf Affiliator harus melihatnya",
  );
  harus(
    !mcn.includes("Jadwal standup Affiliator"),
    "pengumuman unit bocor ke unit lain",
  );
});

uji("Pengumuman tanpa target terlihat semua peran", async () => {
  for (const id of Object.values(ID)) {
    const j = await judulUntuk(id);
    harus(j.includes("Cutoff Partner Center"), `tidak terlihat oleh ${id}`);
  }
});

uji("Staff tidak bisa membuat pengumuman", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        ID.staffAff,
        `insert into announcements (slug, judul, isi, dibuat_oleh, published_at)
         values ('dari-staff', 'Dari staff', array['x'], $1, now())`,
        [ID.staffAff],
      ),
    "Staff seharusnya tidak boleh menulis pengumuman",
  );
});

uji("Leader tidak bisa membuat pengumuman", async () => {
  await harusDitolak(
    () =>
      sebagai(
        db,
        ID.leaderTap,
        `insert into announcements (slug, judul, isi, dibuat_oleh, published_at)
         values ('dari-leader', 'Dari leader', array['x'], $1, now())`,
        [ID.leaderTap],
      ),
    "Leader seharusnya tidak boleh menulis pengumuman",
  );
});

uji("Manager bisa membuat pengumuman", async () => {
  await sebagai(
    db,
    ID.manager,
    `insert into announcements (slug, judul, isi, dibuat_oleh, published_at)
     values ('dari-manager', 'Dari manager', array['x'], $1, now())`,
    [ID.manager],
  );
  const j = await judulUntuk(ID.manager);
  harus(j.includes("Dari manager"), "pengumuman Manager tidak tersimpan");
});

uji("Isi pengumuman tidak boleh kosong", async () => {
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into announcements (slug, judul, isi, published_at)
         values ('kosong', 'Kosong', array[]::text[], now())`,
      ),
    "constraint isi kosong tidak bekerja",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
