/** Kartu capaian pribadi Beranda: satu panggilan, angka milik sendiri. */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Capaian pribadi");

const DARI = "2024-09-27";
const SAMPAI = "2024-10-24";

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];

const U = {
  rian: (await satu(`select id from users where nama='Rian Hidayat'`)).id,
  dimas: (await satu(`select id from users where nama='Dimas Maulana'`)).id,
  farhan: (await satu(`select id from users where nama='Farhan Pratama'`)).id,
  anisa: (await satu(`select id from users where nama='Anisa Larasati'`)).id,
};

const capaian = async (id) =>
  (
    await sebagai(
      db,
      id,
      `select * from capaian_pribadi_saya($1::date,$2::date)`,
      [DARI, SAMPAI],
    )
  ).rows;

uji(
  "jendela mengembalikan satu baris per hari, termasuk hari kosong",
  async () => {
    const r = await capaian(U.rian);
    harusSama(r.length, 28, "28 hari, bukan hanya hari yang ada laporannya");
    harusSama(r[0].tanggal.toISOString().slice(0, 10), DARI);
    harusSama(r.at(-1).tanggal.toISOString().slice(0, 10), SAMPAI);
  },
);

uji(
  "PIC melihat gabungan akun yang ia pegang, bukan akun orang lain",
  async () => {
    const r = await capaian(U.rian);
    const total = r.reduce((a, b) => a + Number(b.gmv), 0);
    const { rows } = await sebagaiAdmin(
      db,
      `select coalesce(sum(r.gmv),0) as n from daily_reports r
      join accounts a on a.id = r.account_id
     where a.pic_user_id = $1 and r.tanggal between $2 and $3`,
      [U.rian, DARI, SAMPAI],
    );
    harusSama(total, Number(rows[0].n));
    harus(total > 0, "seharusnya ada realisasi pada rentang ini");
  },
);

uji("targetnya memakai anak tangga GRD, bukan angka tetap", async () => {
  const r = await capaian(U.rian);
  const hari = r.find((x) => x.tanggal.toISOString().slice(0, 10) === SAMPAI);
  const { rows } = await sebagaiAdmin(
    db,
    `select coalesce(sum(t.target),0) as n from target_harian_akun($1::date) t
      join accounts a on a.id = t.account_id
     where a.pic_user_id = $2`,
    [SAMPAI, U.rian],
  );
  harusSama(Number(hari.target), Number(rows[0].n));
});

uji("hari di luar periode goal bertarget nol, bukan galat", async () => {
  const r = await capaian(U.rian);
  const september = r.find(
    (x) => x.tanggal.toISOString().slice(0, 10) === "2024-09-28",
  );
  harusSama(Number(september.target), 0);
  harusSama(Number(september.gmv), 0);
});

uji(
  "Leader unit melihat unitnya; lingkup & departemen ikut terbawa",
  async () => {
    const r = await capaian(U.dimas);
    harusSama(r[0].departemen, "tap");
    harus(
      String(r[0].lingkup).includes("TAP"),
      `lingkup seharusnya menyebut TAP, dapat: ${r[0].lingkup}`,
    );
  },
);

uji("PIC dua akun diringkas sebagai '& 1 lainnya'", async () => {
  const r = await capaian(U.rian);
  harus(String(r[0].lingkup).includes("& 1 lainnya"), `dapat: ${r[0].lingkup}`);
  harusSama(r[0].departemen, "affiliator");
});

uji(
  "Manager tidak melihat capaian seluruh perusahaan di kartu ini",
  async () => {
    // Kartu ini soal sasaran yang dipegang sendiri; angka lintas unit punya
    // kartunya sendiri di Beranda.
    const r = await capaian(U.farhan);
    harus(r[0].lingkup === null, "Manager tanpa akun seharusnya tanpa lingkup");
    harusSama(
      r.reduce((a, b) => a + Number(b.gmv), 0),
      0,
    );
  },
);

uji("Staff tanpa akun mendapat deret kosong, bukan galat", async () => {
  const r = await capaian(U.anisa);
  harusSama(r.length, 28);
  harus(r[0].lingkup === null);
});

uji("CO sampel ikut dihitung per hari", async () => {
  const hariIni = (
    await satu(`select (now() at time zone 'Asia/Jakarta')::date as d`)
  ).d
    .toISOString()
    .slice(0, 10);
  const r = (
    await sebagai(
      db,
      U.rian,
      `select * from capaian_pribadi_saya($1::date,$1::date)`,
      [hariIni],
    )
  ).rows;
  harusSama(
    Number(r[0].co_sampel),
    2,
    "dua sampel akun Rian dipindai hari ini di seed",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
