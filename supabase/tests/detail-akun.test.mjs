/**
 * Halaman Detail Akun (/akun/[id]) — docs/DETAIL-PER-AKUN-GRAFIK.md §5.
 *
 * Halaman ini tidak menambah fungsi database: ia membaca akun, laporan,
 * absensi PIC, dan komisi lewat klien biasa. Test ini menjalankan query
 * yang SAMA dengan `src/lib/data/detail-akun.ts` sebagai tiap peran,
 * supaya penjaganya (RLS `accounts_baca`, `daily_reports_baca`,
 * `komisi_akun`) terbukti untuk halaman ini — AC 4, 5, 6, 7.
 *
 * Data contoh: Rian Hidayat (Staff) memegang @skincare_official dan
 * @beauty_daily.id; Nabila Putri @fashion_hijab; atasan mereka Dewi
 * Lestari (Leader Affiliator).
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  idNama,
  idPeran,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Detail akun");

const DARI = "2024-10-01";
const SAMPAI = "2024-10-31";

const akun = async (username) =>
  (
    await sebagaiAdmin(
      db,
      "select id, pic_user_id from accounts where username = $1",
      [username],
    )
  ).rows[0];

/** `akunTerbuka`: akun terbaca lewat RLS `accounts_baca`. */
const terbaca = async (userId, accountId) =>
  (
    await sebagai(
      db,
      userId,
      "select count(*)::int n from accounts where id = $1",
      [accountId],
    )
  ).rows[0].n === 1;

/** `hariAkun`: laporan akun pada rentang. */
const laporan = async (userId, accountId) =>
  (
    await sebagai(
      db,
      userId,
      `select count(*)::int n, coalesce(sum(gmv), 0)::bigint gmv,
              coalesce(sum(jumlah_upload), 0)::int upload
       from daily_reports where account_id = $1 and tanggal between $2 and $3`,
      [accountId, DARI, SAMPAI],
    )
  ).rows[0];

/** `hariAkun`: komisi hanya lewat `komisi_akun`. */
const komisi = async (userId, accountId) =>
  (
    await sebagai(
      db,
      userId,
      "select count(*)::int n, coalesce(sum(komisi), 0)::bigint t from komisi_akun($1, $2, $3)",
      [DARI, SAMPAI, accountId],
    )
  ).rows[0];

uji("AC7/E5: Staff membuka akun orang lain → tidak terbaca (404)", async () => {
  const rian = await idNama(db, "Rian Hidayat");
  const hijab = await akun("@fashion_hijab");
  harusSama(await terbaca(rian, hijab.id), false);
  harusSama((await laporan(rian, hijab.id)).n, 0);
});

uji(
  "Staff PIC membuka akunnya sendiri: GMV & upload terbaca, komisi tidak (tanpa akses)",
  async () => {
    const rian = await idNama(db, "Rian Hidayat");
    const skin = await akun("@skincare_official");
    harusSama(await terbaca(rian, skin.id), true);
    harus(
      (await laporan(rian, skin.id)).n > 0,
      "laporan akun sendiri tidak terbaca",
    );
    harusSama((await komisi(rian, skin.id)).n, 0);
  },
);

uji(
  "AC5: Leader tanpa akses komisi — akun unitnya terbuka, GMV & upload sama dengan Manager, komisi kosong",
  async () => {
    const dewi = await idNama(db, "Dewi Lestari");
    const manager = await idPeran(db, "Manager");
    const skin = await akun("@skincare_official");
    harusSama(await terbaca(dewi, skin.id), true);
    const l = await laporan(dewi, skin.id);
    const m = await laporan(manager, skin.id);
    harusSama([l.n, l.gmv, l.upload], [m.n, m.gmv, m.upload]);
    harusSama((await komisi(dewi, skin.id)).n, 0);
    // Absensi PIC (hari kerja) terbaca oleh atasannya.
    const { rows } = await sebagai(
      db,
      dewi,
      `select count(*)::int n from attendance
     where user_id = $1 and jam_masuk is not null and tanggal between $2 and $3`,
      [skin.pic_user_id, DARI, SAMPAI],
    );
    harus(rows[0].n > 0, "absensi PIC tidak terbaca Leader");
  },
);

uji(
  "AC6: Staff dengan akses 'akun yang dia pegang' melihat komisi akunnya, akun orang lain tetap 404",
  async () => {
    const manager = await idPeran(db, "Manager");
    const rian = await idNama(db, "Rian Hidayat");
    await sebagai(db, manager, "select atur_akses_komisi($1, 'pegangan')", [
      rian,
    ]);
    const skin = await akun("@skincare_official");
    const hijab = await akun("@fashion_hijab");
    const k = await komisi(rian, skin.id);
    harus(
      k.n > 0 && Number(k.t) > 0,
      "komisi akun sendiri seharusnya terlihat",
    );
    harusSama(await terbaca(rian, hijab.id), false);
    harusSama((await komisi(rian, hijab.id)).n, 0);
    await sebagai(db, manager, "select atur_akses_komisi($1, null)", [rian]);
  },
);

uji(
  "AC4: total GMV halaman = GMV akun itu di tabel per akun (query daftarAkun), selisih 0",
  async () => {
    const manager = await idPeran(db, "Manager");
    for (const u of ["@skincare_official", "@fashion_hijab", "@gadget_daily"]) {
      const a = await akun(u);
      const halaman = await laporan(manager, a.id);
      // `daftarAkun` menjumlahkan `select account_id, gmv from daily_reports`
      // pada rentang yang sama, per akun.
      const { rows } = await sebagai(
        db,
        manager,
        `select account_id, gmv from daily_reports where tanggal between $1 and $2`,
        [DARI, SAMPAI],
      );
      const tabel = rows
        .filter((r) => r.account_id === a.id)
        .reduce((s, r) => s + Number(r.gmv), 0);
      harusSama(Number(halaman.gmv), tabel, u);
    }
  },
);

uji(
  "Komisi halaman = komisi tabel per akun (komisi_affiliator) bagi Manager",
  async () => {
    const manager = await idPeran(db, "Manager");
    const skin = await akun("@skincare_official");
    const halaman = await komisi(manager, skin.id);
    const { rows } = await sebagai(
      db,
      manager,
      "select komisi::bigint t from komisi_affiliator($1, $2) where account_id = $3",
      [DARI, SAMPAI, skin.id],
    );
    harusSama(Number(halaman.t), Number(rows[0].t));
  },
);

uji("E3: akun nonaktif tetap bisa dibuka (riwayat)", async () => {
  const manager = await idPeran(db, "Manager");
  const gadget = await akun("@gadget_daily");
  await sebagaiAdmin(
    db,
    "update accounts set status = 'nonaktif' where id = $1",
    [gadget.id],
  );
  harusSama(await terbaca(manager, gadget.id), true);
  harus(
    (await laporan(manager, gadget.id)).n > 0,
    "riwayat akun nonaktif hilang",
  );
  await sebagaiAdmin(db, "update accounts set status = 'aktif' where id = $1", [
    gadget.id,
  ]);
});

uji("Orang tanpa profil aktif tidak membuka akun apa pun", async () => {
  const skin = await akun("@skincare_official");
  harusSama(await terbaca(crypto.randomUUID(), skin.id), false);
});

await jalankan();
await db.close();
