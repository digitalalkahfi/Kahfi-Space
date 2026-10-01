/**
 * Impor GRD (0190): satu transaksi, bisa diulang, uji coba tidak
 * meninggalkan apa pun, dan isian orang (capaian, pencapaian KPI,
 * pengesahan) tidak tersentuh impor berikutnya.
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
const { uji, jalankan } = buatSuite("Impor GRD");

const PERIODE = "2024-11-01";
const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu("select id from users where nama = $1", [nama])).id;
const akun = async (u) =>
  (await satu("select id from accounts where username = $1", [u])).id;
const unit = async (k) =>
  (await satu("select id from units where kode = $1", [k])).id;

const GMV = [70, 75, 80, 85, 90, 95, 98, 100, 105, 110];

async function rencana({
  namaIndikator = "GMV akun vs target — % realisasi",
} = {}) {
  const bulan = [{ bulan: PERIODE, dari: PERIODE, sampai: "2024-11-30" }];
  return {
    periode: PERIODE,
    // Setelah impor pertama goal lama sudah tidak ada: daftarnya kosong.
    hapus_goal: (
      await sebagaiAdmin(
        db,
        "select id from goals where judul = 'Goal coba-coba'",
      )
    ).rows.map((g) => g.id),
    struktur: [
      { user_id: await id("Bayu Nugraha"), jabatan: "Staff Affiliator GRD" },
    ],
    goals: [
      {
        kode: "1",
        judul: "Menaikkan GMV perusahaan",
        level: "company",
        induk: null,
        pemilik_id: await id("Hafidz Alkahfi"),
        unit_id: null,
        account_id: null,
        satuan: "IDR",
        base: 1000,
        target: 2000,
        periode_label: "November 2024",
        tenggat: "2024-11-30",
        jenis_realisasi: "gmv",
        keterangan: "",
        status: "aktif",
        bulan: bulan.map((b) => ({ ...b, target: 2000 })),
      },
      {
        kode: "1.1",
        judul: "Menaikkan GMV internal",
        level: "manager",
        induk: "1",
        pemilik_id: await id("Farhan Pratama"),
        unit_id: null,
        account_id: null,
        satuan: "IDR",
        base: 500,
        target: 1000,
        periode_label: "November 2024",
        tenggat: "2024-11-30",
        jenis_realisasi: "gmv",
        keterangan: "",
        status: "aktif",
        bulan: bulan.map((b) => ({ ...b, target: 1000 })),
      },
      {
        kode: "1.1.3",
        judul: "Menaikkan GMV akun utama",
        level: "leader",
        induk: "1.1",
        pemilik_id: await id("Dewi Lestari"),
        unit_id: await unit("affiliator"),
        account_id: null,
        satuan: "IDR",
        base: 300,
        target: 900,
        periode_label: "November 2024",
        tenggat: "2024-11-30",
        jenis_realisasi: "gmv",
        keterangan: "PIC: Dewi",
        status: "aktif",
        bulan: bulan.map((b) => ({ ...b, target: 900 })),
      },
      {
        kode: "1.1.5",
        judul: "Menambah seller mitra aktif",
        level: "leader",
        induk: "1.1",
        pemilik_id: await id("Dimas Maulana"),
        unit_id: await unit("tap"),
        account_id: null,
        satuan: "Seller",
        base: 10,
        target: 15,
        periode_label: "November 2024",
        tenggat: "2024-11-17",
        jenis_realisasi: "isian",
        keterangan: "",
        status: "aktif",
        bulan: [],
      },
      {
        kode: "1.1.3:@skincare_official",
        judul: "Target GMV @skincare_official",
        level: "account",
        induk: "1.1.3",
        pemilik_id: null,
        unit_id: await unit("affiliator"),
        account_id: await akun("@skincare_official"),
        satuan: "IDR",
        base: 100,
        target: 400,
        periode_label: "November 2024",
        tenggat: "2024-11-30",
        jenis_realisasi: "gmv",
        keterangan: "Pemegang: Rian",
        status: "draft",
        bulan: bulan.map((b) => ({ ...b, target: 400 })),
      },
    ],
    ukuran: [
      {
        kode: "1.1.3",
        judul: "GMV akun utama",
        satuan: "IDR",
        sumber: "gmv",
        goal: "1.1.3",
        pic_id: await id("Dewi Lestari"),
        pic_teks: "Dewi",
        urutan: 1,
        lingkup: [
          {
            account_id: await akun("@skincare_official"),
            jenis_gmv: "video",
            faktor: 1,
          },
        ],
        titik: [
          { tanggal: "2024-11-02", target: 100 },
          { tanggal: "2024-11-09", target: 300 },
        ],
      },
      {
        kode: "1.1.5",
        judul: "Seller mitra aktif",
        satuan: "Seller",
        sumber: "isian",
        goal: "1.1.5",
        pic_id: await id("Dimas Maulana"),
        pic_teks: "Dimas",
        urutan: 2,
        lingkup: [],
        titik: [{ tanggal: "2024-11-09", target: 12 }],
      },
      {
        kode: "1.1",
        judul: "TOTAL GMV INTERNAL (1.1.3)",
        satuan: "IDR",
        sumber: "gmv",
        goal: "1.1",
        pic_id: null,
        pic_teks: "",
        urutan: 3,
        lingkup: [{ sumber_kode: "1.1.3", faktor: 1 }],
        titik: [],
      },
    ],
    lembar: [
      {
        user_id: await id("Dewi Lestari"),
        judul: "KPI LEADER — DEWI",
        status: "aktif",
        asal: "uji",
        indikator: [
          {
            urutan: 1,
            nama: namaIndikator,
            satuan: "%",
            bobot: 60,
            arah: "naik",
            tangga: GMV,
            asal: "uji!B5",
          },
          {
            urutan: 2,
            nama: "Tonggak tepat waktu — %",
            satuan: "%",
            bobot: 40,
            arah: "naik",
            tangga: [40, 50, 60, 80, 85, 90, 95, 100, 100, 100],
            asal: "uji!B6",
          },
        ],
      },
      {
        user_id: await id("Farhan Pratama"),
        judul: "KPI MANAGER — FARHAN",
        status: "draft",
        asal: "uji",
        indikator: [
          {
            urutan: 1,
            nama: "GMV internal vs target — % realisasi",
            satuan: "%",
            bobot: 100,
            arah: "naik",
            tangga: GMV,
            asal: "uji!B5",
          },
        ],
      },
    ],
  };
}

const impor = (r, uji = false) =>
  satu("select impor_grd($1::jsonb, $2) r", [JSON.stringify(r), uji]);

const hitung = async () =>
  satu(
    `select
    (select count(*)::int from goals where grd_periode = $1) goal,
    (select count(*)::int from grd_ukuran where grd_periode = $1) ukuran,
    (select count(*)::int from grd_ukuran_lingkup l join grd_ukuran u on u.id = l.ukuran_id
       where u.grd_periode = $1) lingkup,
    (select count(*)::int from kpi_lembar where periode_bulan = $1) lembar,
    (select count(*)::int from kpi_indikator i join kpi_lembar l on l.id = i.lembar_id
       where l.periode_bulan = $1) indikator`,
    [PERIODE],
  );

await sebagaiAdmin(
  db,
  `insert into goals (judul, level, satuan, target_base, target_goal, target_stretch, periode)
   values ('Goal coba-coba', 'company', 'IDR', 1, 2, 2, '26 Sep – 25 Okt 2026')`,
);

uji("hanya CEO/Manager atau proses sistem yang boleh mengimpor", async () => {
  const r = await rencana();
  await harusDitolak(
    async () =>
      sebagai(
        db,
        await id("Dewi Lestari"),
        "select impor_grd($1::jsonb, false)",
        [JSON.stringify(r)],
      ),
    "Leader seharusnya ditolak",
  );
});

uji("uji coba memeriksa seluruh rencana lalu membatalkannya", async () => {
  try {
    await impor(await rencana(), true);
    throw new Error("uji coba seharusnya berakhir dengan UJI_COBA");
  } catch (e) {
    harus(/^UJI_COBA:/.test(e.message), `pesan tak terduga: ${e.message}`);
    const ringkas = JSON.parse(e.message.slice("UJI_COBA:".length));
    harusSama(
      [ringkas.goal, ringkas.ukuran, ringkas.lembar, ringkas.goal_lama_dihapus],
      [5, 3, 2, 1],
    );
  }
  harusSama(await hitung(), {
    goal: 0,
    ukuran: 0,
    lingkup: 0,
    lembar: 0,
    indikator: 0,
  });
  harus(
    await satu("select 1 x from goals where judul = 'Goal coba-coba'"),
    "goal lama masih ada",
  );
});

uji(
  "impor menyimpan goal berjenjang, ukuran, lingkup, dan lembar",
  async () => {
    const r = (await impor(await rencana())).r;
    harusSama(r.goal_lama_dihapus, 1);
    harusSama(await hitung(), {
      goal: 5,
      ukuran: 3,
      lingkup: 2,
      lembar: 2,
      indikator: 3,
    });

    const g = await satu(
      `select c.kode, p.kode induk, c.status, c.tenggat::text, c.jenis_realisasi,
            (select count(*)::int from goal_months m where m.goal_id = c.id) bulan
       from goals c join goals p on p.id = c.parent_goal_id
      where c.grd_periode = $1 and c.kode = '1.1.5'`,
      [PERIODE],
    );
    harusSama(
      [g.induk, g.status, g.tenggat, g.jenis_realisasi, g.bulan],
      ["1.1", "aktif", "2024-11-17", "isian", 0],
    );
    harusSama(
      (
        await satu(
          "select status from goals where grd_periode = $1 and kode = '1.1.3:@skincare_official'",
          [PERIODE],
        )
      ).status,
      "draft",
    );
    const total = await satu(
      `select s.kode from grd_ukuran_lingkup l
       join grd_ukuran u on u.id = l.ukuran_id
       join grd_ukuran s on s.id = l.sumber_ukuran_id
      where u.kode = '1.1' and u.grd_periode = $1`,
      [PERIODE],
    );
    harusSama(total.kode, "1.1.3");
    harusSama(
      (await satu("select jabatan from users where nama = 'Bayu Nugraha'"))
        .jabatan,
      "Staff Affiliator GRD",
    );
  },
);

uji("impor ulang tidak menggandakan apa pun", async () => {
  const sebelum = await hitung();
  await impor(await rencana());
  harusSama(await hitung(), sebelum);
});

uji(
  "pengesahan, isian, dan pencapaian KPI bertahan saat impor ulang",
  async () => {
    await sebagai(
      db,
      await id("Farhan Pratama"),
      "update goals set status = 'aktif' where grd_periode = $1 and kode = '1.1.3:@skincare_official'",
      [PERIODE],
    );
    const ukuranSeller = (
      await satu(
        "select id from grd_ukuran where grd_periode = $1 and kode = '1.1.5'",
        [PERIODE],
      )
    ).id;
    await sebagai(
      db,
      await id("Dimas Maulana"),
      "insert into grd_ukuran_isian (ukuran_id, tanggal, nilai) values ($1, '2024-11-09', 12)",
      [ukuranSeller],
    );
    const indikator = (
      await satu(
        `select i.id from kpi_indikator i join kpi_lembar l on l.id = i.lembar_id
        where l.user_id = $1 and l.periode_bulan = $2 and i.urutan = 1`,
        [await id("Dewi Lestari"), PERIODE],
      )
    ).id;
    await sebagai(
      db,
      await id("Farhan Pratama"),
      "select isi_pencapaian_kpi($1, $2, $3::jsonb)",
      [
        await id("Dewi Lestari"),
        PERIODE,
        JSON.stringify([{ indikator_id: indikator, nilai: 98 }]),
      ],
    );

    await impor(
      await rencana({
        namaIndikator: "GMV akun utama vs target — % realisasi",
      }),
    );

    harusSama(
      (
        await satu(
          "select status from goals where grd_periode = $1 and kode = '1.1.3:@skincare_official'",
          [PERIODE],
        )
      ).status,
      "aktif",
    );
    harusSama(
      Number(
        (
          await satu(
            "select nilai from grd_ukuran_isian where ukuran_id = $1",
            [ukuranSeller],
          )
        ).nilai,
      ),
      12,
    );
    const i = await satu(
      `select i.id, i.nama, p.nilai from kpi_indikator i
       left join kpi_pencapaian p on p.indikator_id = i.id where i.id = $1`,
      [indikator],
    );
    harusSama(
      [i.nama, Number(i.nilai)],
      ["GMV akun utama vs target — % realisasi", 98],
    );
    harusSama(
      (
        await satu(
          "select status from kpi_lembar where user_id = $1 and periode_bulan = $2",
          [await id("Dewi Lestari"), PERIODE],
        )
      ).status,
      "aktif",
    );
  },
);

uji(
  "lembar bulan yang sudah terkunci dilewati, angkanya tidak berubah",
  async () => {
    await sebagai(
      db,
      await id("Hafidz Alkahfi"),
      "select kunci_kpi_bulan($1)",
      [PERIODE],
    );
    const r = (
      await impor(await rencana({ namaIndikator: "Nama baru setelah dikunci" }))
    ).r;
    harusSama(r.lembar_terkunci_dilewati, [await id("Dewi Lestari")]);
    harusSama(
      (
        await satu(
          `select i.nama from kpi_indikator i join kpi_lembar l on l.id = i.lembar_id
        where l.user_id = $1 and l.periode_bulan = $2 and i.urutan = 1`,
          [await id("Dewi Lestari"), PERIODE],
        )
      ).nama,
      "GMV akun utama vs target — % realisasi",
    );
  },
);

uji("satu pelanggaran membatalkan seluruh impor", async () => {
  const r = await rencana();
  r.periode = "2024-12-01";
  r.hapus_goal = [];
  for (const g of r.goals) {
    g.periode_label = "Desember 2024";
    g.bulan = g.bulan.map((b) => ({
      ...b,
      bulan: "2024-12-01",
      dari: "2024-12-01",
      sampai: "2024-12-31",
    }));
  }
  // Bobot 90: lembar tidak boleh aktif.
  r.lembar[0].indikator[1].bobot = 30;
  await harusDitolak(() => impor(r), "rencana berbobot 90 seharusnya ditolak");
  harusSama(
    (
      await satu(
        "select count(*)::int n from goals where grd_periode = '2024-12-01'",
      )
    ).n,
    0,
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
