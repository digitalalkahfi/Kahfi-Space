/**
 * KPI "laporan tepat waktu" dinilai per sasaran, migrasi 0215.
 *
 * Satu akun hanya boleh punya satu laporan per tanggal, dan Manager, CEO,
 * serta co-leader boleh mengirimnya. Begitu mereka melapor, PIC tidak bisa
 * lagi mengirim apa pun, jadi laporan itu harus ikut menjadi miliknya.
 *
 * Laporan dikirim lewat RLS seperti di aplikasi, kecuali tanggal kirimnya
 * yang disetel supaya tenggatnya bisa diuji. Tiap uji memakai bulannya
 * sendiri supaya hitungannya tidak saling memengaruhi.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusDitolak,
  harusSama,
  idNama,
  idPeran,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("KPI laporan tepat waktu per sasaran");

const satu = async (sql, p = []) => (await sebagaiAdmin(db, sql, p)).rows[0];
const idAkun = async (u) =>
  (await satu(`select id from accounts where username=$1`, [u])).id;
const idUnit = async (nama) =>
  (await satu(`select unit_id as id from users where id=$1`, [nama])).id;

const NABILA = await idNama(db, "Nabila Putri"); // PIC satu akun
const RIAN = await idNama(db, "Rian Hidayat"); // PIC dua akun
const BAYU = await idNama(db, "Bayu Nugraha"); // PIC akun lain
const ANISA = await idNama(db, "Anisa Larasati"); // tanpa akun
const DEWI = await idNama(db, "Dewi Lestari"); // Leader, co-leader semua akun
const DIMAS = await idNama(db, "Dimas Maulana"); // Leader TAP (tanpa akun)
const GALIH = await idNama(db, "Galih Prakoso"); // Leader MCN (tanpa akun)
const MAYA = await idNama(db, "Maya Safitri"); // Co-Leader MCN
const RIZKY = await idNama(db, "Rizky Ananda"); // Staff MCN
const MANAGER = await idPeran(db, "Manager");
const CEO = await idPeran(db, "CEO");

const HIJAB = await idAkun("@fashion_hijab"); // PIC Nabila
const SKINCARE = await idAkun("@skincare_official"); // PIC Rian
const BEAUTY = await idAkun("@beauty_daily.id"); // PIC Rian
const GADGET = await idAkun("@gadget_daily"); // PIC Bayu
const TAP = await idUnit(DIMAS);
const MCN = await idUnit(GALIH);

const pad = (n) => String(n).padStart(2, "0");
let urutanBulan = 0;
const bulanBaru = () => {
  urutanBulan += 1;
  const d = new Date(Date.UTC(2023, urutanBulan - 1, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
};
const tanggal = (bulan, hari) => `${bulan.slice(0, 8)}${pad(hari)}`;
const jumlahHari = (bulan) =>
  new Date(
    Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0),
  ).getUTCDate();
const akhirBulan = (bulan) => tanggal(bulan, jumlahHari(bulan));

/** Waktu kirim: pukul `jam` WIB pada hari sesudah tanggal laporan. */
const besok = (bulan, hari, jam) => `${tanggal(bulan, hari + 1)} ${jam}`;

async function lembarLaporanTepat(user, bulan, ref = { batas: "18:00" }) {
  const lembar = await satu(
    `insert into kpi_lembar (user_id, periode_bulan, judul, status, asal)
     values ($1, $2, 'uji per sasaran', 'draft', 'uji-per-sasaran') returning id`,
    [user, bulan],
  );
  const ind = await satu(
    `insert into kpi_indikator
       (lembar_id, urutan, nama, bobot, tangga, sumber, sumber_ref)
     values ($1, 1, 'Laporan tepat waktu', 100,
             '{1,2,3,4,5,6,7,8,9,10}'::numeric[],
             'laporan_tepat', $2::jsonb) returning id`,
    [lembar.id, JSON.stringify(ref)],
  );
  await sebagaiAdmin(db, `update kpi_lembar set status='aktif' where id=$1`, [
    lembar.id,
  ]);
  return ind.id;
}

/** Berapa hari sebulan itu yang dihitung tepat oleh mesin KPI. */
async function hariTepat(indikator, bulan) {
  const { p } = await satu(`select pencapaian_otomatis($1, $2) as p`, [
    indikator,
    akhirBulan(bulan),
  ]);
  return Math.round((Number(p) / 100) * jumlahHari(bulan));
}

/** Kirim laporan akun lewat RLS; komisi wajib untuk akun sejak 0211. */
const laporAkun = (pengirim, tgl, akun, dikirim) =>
  sebagai(
    db,
    pengirim,
    `insert into daily_reports
       (user_id, tanggal, account_id, gmv, komisi, submitted_at)
     values ($1, $2, $3, 1000000, 0, ($4::timestamp at time zone 'Asia/Jakarta'))`,
    [pengirim, tgl, akun, dikirim],
  );

const laporUnit = (pengirim, tgl, unit, dikirim) =>
  sebagai(
    db,
    pengirim,
    `insert into daily_reports (user_id, tanggal, unit_id, gmv, submitted_at)
     values ($1, $2, $3, 1000000, ($4::timestamp at time zone 'Asia/Jakarta'))`,
    [pengirim, tgl, unit, dikirim],
  );

uji("laporan yang dikirim sendiri tetap dihitung", async () => {
  const b = bulanBaru();
  const ind = await lembarLaporanTepat(NABILA, b);
  await laporAkun(NABILA, tanggal(b, 1), HIJAB, besok(b, 1, "09:00"));
  await laporAkun(NABILA, tanggal(b, 2), HIJAB, besok(b, 2, "20:00")); // lewat tenggat
  harusSama(await hariTepat(ind, b), 1, "hanya yang sebelum tenggat");
});

uji("Manager melaporkan akun PIC: PIC tidak bisa melapor ulang, harinya tetap dihitung", async () => {
  const b = bulanBaru();
  const ind = await lembarLaporanTepat(NABILA, b);
  await laporAkun(MANAGER, tanggal(b, 1), HIJAB, besok(b, 1, "09:00"));
  await harusDitolak(
    () => laporAkun(NABILA, tanggal(b, 1), HIJAB, besok(b, 1, "10:00")),
    "laporan kedua untuk akun dan tanggal yang sama seharusnya ditolak",
  );
  harusSama(await hariTepat(ind, b), 1, "hari yang dilaporkan Manager");
});

uji("laporan akun kiriman CEO dan co-leader juga dihitung untuk PIC", async () => {
  const b = bulanBaru();
  const ind = await lembarLaporanTepat(NABILA, b);
  await laporAkun(CEO, tanggal(b, 1), HIJAB, besok(b, 1, "09:00"));
  await laporAkun(DEWI, tanggal(b, 2), HIJAB, besok(b, 2, "09:00"));
  harusSama(await hariTepat(ind, b), 2, "hari yang dilaporkan CEO dan co-leader");
});

uji("tenggat tetap berlaku pada laporan kiriman orang lain", async () => {
  const b = bulanBaru();
  const ind = await lembarLaporanTepat(NABILA, b);
  await laporAkun(MANAGER, tanggal(b, 1), HIJAB, besok(b, 1, "18:00")); // pas batas
  await laporAkun(MANAGER, tanggal(b, 2), HIJAB, besok(b, 2, "18:01"));
  harusSama(await hariTepat(ind, b), 1, "yang lewat semenit tidak dihitung");
});

uji("tanpa batas jam: laporan kapan pun dihitung, siapa pun pengirimnya", async () => {
  const b = bulanBaru();
  const ind = await lembarLaporanTepat(NABILA, b, {});
  await laporAkun(MANAGER, tanggal(b, 1), HIJAB, besok(b, 5, "23:00"));
  harusSama(await hariTepat(ind, b), 1, "laporan tanpa tenggat");
});

uji("PIC dua akun: satu laporan cukup, dan dua laporan sehari tetap satu hari", async () => {
  const b = bulanBaru();
  const ind = await lembarLaporanTepat(RIAN, b);
  // Hari 1: satu dari dua akun, kiriman Manager.
  await laporAkun(MANAGER, tanggal(b, 1), SKINCARE, besok(b, 1, "09:00"));
  // Hari 2: kedua akun.
  await laporAkun(MANAGER, tanggal(b, 2), SKINCARE, besok(b, 2, "09:00"));
  await laporAkun(RIAN, tanggal(b, 2), BEAUTY, besok(b, 2, "09:30"));
  // Hari 3: satu terlambat, satu tepat. Yang tepat menentukan.
  await laporAkun(MANAGER, tanggal(b, 3), SKINCARE, besok(b, 3, "20:00"));
  await laporAkun(RIAN, tanggal(b, 3), BEAUTY, besok(b, 3, "09:00"));
  harusSama(await hariTepat(ind, b), 3, "tiga hari, bukan empat atau lima");
});

uji("Leader unit tanpa akun: laporan unit kiriman Manager dihitung, tenggatnya sama", async () => {
  const b = bulanBaru();
  const ind = await lembarLaporanTepat(DIMAS, b);
  await laporUnit(MANAGER, tanggal(b, 1), TAP, besok(b, 1, "09:00"));
  await laporUnit(MANAGER, tanggal(b, 2), TAP, besok(b, 2, "20:00"));
  harusSama(await hariTepat(ind, b), 1, "laporan unit yang sebelum tenggat");
});

uji("unit yang kemudian mendapat akun: laporan unit lamanya tetap dihitung", async () => {
  const b = bulanBaru();
  const ind = await lembarLaporanTepat(DIMAS, b);
  await laporUnit(MANAGER, tanggal(b, 1), TAP, besok(b, 1, "09:00"));
  await sebagaiAdmin(
    db,
    `insert into accounts (platform, username, unit_id)
     values ('TikTok Shop', '@akun_baru_tap', $1)`,
    [TAP],
  );
  harusSama(await hariTepat(ind, b), 1, "nilai lampau tidak hilang");
});

uji("akun yang kemudian dinonaktifkan: laporan lamanya tetap dihitung", async () => {
  const b = bulanBaru();
  const ind = await lembarLaporanTepat(NABILA, b);
  await laporAkun(MANAGER, tanggal(b, 1), HIJAB, besok(b, 1, "09:00"));
  await sebagaiAdmin(db, `update accounts set status='nonaktif' where id=$1`, [
    HIJAB,
  ]);
  try {
    harusSama(await hariTepat(ind, b), 1, "nilai lampau tidak hilang");
  } finally {
    await sebagaiAdmin(db, `update accounts set status='aktif' where id=$1`, [
      HIJAB,
    ]);
  }
});

uji("laporan tidak dihitung untuk orang yang tidak memegang sasarannya", async () => {
  const b = bulanBaru();
  const bayu = await lembarLaporanTepat(BAYU, b); // PIC akun lain
  const anisa = await lembarLaporanTepat(ANISA, b); // tanpa akun
  const dewi = await lembarLaporanTepat(DEWI, b); // Leader & co-leader akun itu
  const galih = await lembarLaporanTepat(GALIH, b); // Leader unit itu
  const maya = await lembarLaporanTepat(MAYA, b); // Co-Leader unit itu
  const rizky = await lembarLaporanTepat(RIZKY, b); // Staff unit itu

  await laporAkun(MANAGER, tanggal(b, 1), HIJAB, besok(b, 1, "09:00"));
  await laporAkun(NABILA, tanggal(b, 2), HIJAB, besok(b, 2, "09:00"));
  await laporUnit(MANAGER, tanggal(b, 3), MCN, besok(b, 3, "09:00"));

  harusSama(await hariTepat(bayu, b), 0, "PIC akun lain");
  harusSama(await hariTepat(anisa, b), 0, "orang tanpa akun");
  harusSama(await hariTepat(dewi, b), 0, "Leader dan co-leader tidak mendapat laporan PIC");
  harusSama(await hariTepat(galih, b), 1, "Leader mendapat laporan unitnya");
  harusSama(await hariTepat(maya, b), 0, "Co-Leader tidak dituntut laporan unit");
  harusSama(await hariTepat(rizky, b), 0, "Staff unit");
});

uji("pengirim tetap dihitung untuk dirinya walau bukan pemegang sasaran", async () => {
  const b = bulanBaru();
  const manager = await lembarLaporanTepat(MANAGER, b);
  const nabila = await lembarLaporanTepat(NABILA, b);
  await laporAkun(MANAGER, tanggal(b, 1), HIJAB, besok(b, 1, "09:00"));
  harusSama(await hariTepat(manager, b), 1, "pengirim");
  harusSama(await hariTepat(nabila, b), 1, "PIC");
});

uji("akun pindah PIC: mengikuti PIC sekarang, pengirim lama tidak kehilangan nilai", async () => {
  // Riwayat PIC tidak tersimpan, jadi PIC baru ikut menerima hari sebelum
  // serah terima. Batasan ini sama dengan kunci pulang (0214) dan sengaja
  // dikunci di sini supaya perubahannya kelak tidak terjadi diam-diam.
  const b = bulanBaru();
  const lama = await lembarLaporanTepat(BAYU, b);
  const baru = await lembarLaporanTepat(ANISA, b);
  await laporAkun(BAYU, tanggal(b, 1), GADGET, besok(b, 1, "09:00"));
  await sebagaiAdmin(db, `update accounts set pic_user_id=$1 where id=$2`, [
    ANISA,
    GADGET,
  ]);
  await laporAkun(MANAGER, tanggal(b, 2), GADGET, besok(b, 2, "09:00"));
  try {
    harusSama(await hariTepat(lama, b), 1, "PIC lama: yang ia kirim sendiri");
    harusSama(await hariTepat(baru, b), 2, "PIC baru: kedua hari akun itu");
  } finally {
    await sebagaiAdmin(db, `update accounts set pic_user_id=$1 where id=$2`, [
      BAYU,
      GADGET,
    ]);
  }
});

uji("bulan belum dikunci ikut berubah; bulan terkunci tetap membaca snapshot", async () => {
  const b = bulanBaru();
  const ind = await lembarLaporanTepat(NABILA, b);
  const skor = async () =>
    (
      await sebagai(
        db,
        MANAGER,
        `select skor, terkunci from scorecard_tim($1, $2) where user_id = $3`,
        [b, akhirBulan(b), NABILA],
      )
    ).rows[0];

  harusSama(Number((await skor()).skor), 0, "belum ada laporan");

  await laporAkun(MANAGER, tanggal(b, 1), HIJAB, besok(b, 1, "09:00"));
  const sebelumKunci = await skor();
  harus(sebelumKunci.terkunci === false, "bulannya belum terkunci");
  harus(Number(sebelumKunci.skor) > 0, "skor bulan belum dikunci ikut naik");

  await sebagai(db, MANAGER, `select kunci_kpi_bulan($1)`, [b]);
  await laporAkun(MANAGER, tanggal(b, 2), HIJAB, besok(b, 2, "09:00"));

  const sesudahKunci = await skor();
  harus(sesudahKunci.terkunci === true, "bulannya sudah terkunci");
  harusSama(
    Number(sesudahKunci.skor),
    Number(sebelumKunci.skor),
    "skor terkunci tidak berubah",
  );
  harusSama(await hariTepat(ind, b), 2, "hitungan langsung tetap melihat laporan baru");
});

await jalankan();
