/**
 * KPI GRD (0187): tangga 10 kolom, lembar per orang per bulan, pencapaian
 * diisi penilai, dan bulan terkunci yang tidak berubah lagi.
 *
 * Data contoh menyimpan lembar aktif pada Agustus 2024 (lihat
 * `supabase/seed/data.json` → kpi_lembar). Angka harapan di sini dihitung
 * dengan aturan file GRD: VALUE = banyak kolom yang ≤ pencapaian, total =
 * Σ VALUE × bobot, yang kosong bernilai 0.
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
const { uji, jalankan } = buatSuite("KPI GRD — tangga 10 kolom");

const BULAN = "2024-08-01";
const GMV = "{70,75,80,85,90,95,98,100,105,110}";
const TONGGAK = "{40,50,60,80,85,90,95,100,100,100}";
const TURUN = "{9,8,7,6,5,4,3,2,1,0}";

const ids = new Map();
const id = async (nama) => {
  if (!ids.has(nama)) {
    const { rows } = await sebagaiAdmin(
      db,
      "select id from users where nama = $1",
      [nama],
    );
    ids.set(nama, rows[0].id);
  }
  return ids.get(nama);
};

/** Indikator lembar seseorang, urut. */
const indikator = async (nama, bulan = BULAN) =>
  (
    await sebagaiAdmin(
      db,
      `select i.id, i.urutan from kpi_indikator i
         join kpi_lembar l on l.id = i.lembar_id
        where l.user_id = $1 and l.periode_bulan = $2
        order by i.urutan`,
      [await id(nama), bulan],
    )
  ).rows;

const skor = async (nama, bulan = BULAN) =>
  (
    await sebagaiAdmin(db, "select * from hitung_kpi($1, $2, $2)", [
      await id(nama),
      bulan,
    ])
  ).rows[0];

const isi = async (penilai, orang, isian) =>
  sebagai(
    db,
    await id(penilai),
    "select isi_pencapaian_kpi($1, $2, $3::jsonb) n",
    [await id(orang), BULAN, JSON.stringify(isian)],
  );

// ---------------------------------------------------------------------
// Rumus
// ---------------------------------------------------------------------
uji('VALUE persis COUNTIF(C:L,"<="&M) pada tangga GMV', async () => {
  const kasus = [
    [null, 0],
    [0, 0],
    [69.99, 0],
    [70, 1],
    [84.9, 3],
    [85, 4],
    [90, 5],
    [97.99, 6],
    [98, 7],
    [99.9, 7],
    [100, 8],
    [104.99, 8],
    [105, 9],
    [110, 10],
    [250, 10],
  ];
  for (const [p, harapan] of kasus) {
    const { rows } = await sebagaiAdmin(
      db,
      "select nilai_tangga($1::numeric, $2::numeric[], 'naik') v",
      [p, GMV],
    );
    harusSama(rows[0].v, harapan, `pencapaian ${p}`);
  }
});

uji("tangga mendatar: 100% memberi 10, bukan 8", async () => {
  // File GRD: "Indikator kepatuhan: 100% = nilai 8 (atau 10 bila tanpa stretch)".
  for (const [p, harapan] of [
    [100, 10],
    [99.99, 7],
    [95, 7],
    [80, 4],
    [33.3, 0],
  ]) {
    const { rows } = await sebagaiAdmin(
      db,
      "select nilai_tangga($1::numeric, $2::numeric[]) v",
      [p, TONGGAK],
    );
    harusSama(rows[0].v, harapan, `pencapaian ${p}`);
  }
});

uji("makin kecil makin baik: kolom yang ≥ pencapaian", async () => {
  for (const [p, harapan] of [
    [4, 6],
    [9, 1],
    [10, 0],
    [2, 8],
    [0, 10],
  ]) {
    const { rows } = await sebagaiAdmin(
      db,
      "select nilai_tangga($1::numeric, $2::numeric[], 'turun') v",
      [p, TURUN],
    );
    harusSama(rows[0].v, harapan, `pencapaian ${p}`);
  }
});

uji("tangga yang tidak sah ditolak", async () => {
  const lembar = (
    await sebagaiAdmin(
      db,
      `select l.id from kpi_lembar l join users u on u.id = l.user_id
        where u.nama = 'Rian Hidayat' and l.periode_bulan = $1`,
      [BULAN],
    )
  ).rows[0].id;

  for (const [tangga, arah, pesan] of [
    ["{1,2,3,4,5,6,7,8,9}", "naik", "sembilan kolom"],
    ["{1,2,3,4,5,6,7,8,9,10,11}", "naik", "sebelas kolom"],
    ["{1,2,3,4,6,5,7,8,9,10}", "naik", "berbalik arah"],
    ["{1,2,3,4,5,6,7,8,9,10}", "turun", "arah turun tapi menaik"],
    ["{1,2,3,null,5,6,7,8,9,10}", "naik", "ada kolom kosong"],
    ["{1,2,3,4,5,6,7,8,9,10}", "miring", "arah tak dikenal"],
  ]) {
    await harusDitolak(
      () =>
        sebagaiAdmin(
          db,
          `insert into kpi_indikator (lembar_id, urutan, nama, bobot, arah, tangga)
           values ($1, 9, 'Indikator uji', 10, $2, $3::numeric[])`,
          [lembar, arah, tangga],
        ),
      `${pesan} seharusnya ditolak`,
    );
  }

  // Pembanding: tangga yang sah lewat jalur yang sama diterima.
  await sebagaiAdmin(
    db,
    `insert into kpi_indikator (lembar_id, urutan, nama, bobot, arah, tangga)
     values ($1, 9, 'Indikator uji', 10, 'turun', $2::numeric[])`,
    [lembar, TURUN],
  );
  await sebagaiAdmin(
    db,
    "delete from kpi_indikator where lembar_id = $1 and urutan = 9",
    [lembar],
  );
});

// ---------------------------------------------------------------------
// Penilaian lembar data contoh
// ---------------------------------------------------------------------
uji("NILAI = Σ VALUE × bobot pada tiap lembar contoh", async () => {
  // Farhan: 92% → 5, 96% → 6, 77,8% → 3          = 200 + 240 + 60
  // Dewi  : 98% → 7, 101% → 8, 111,25 → 7, 100% → 10 = 315 + 120 + 140 + 200
  // Nabila: 112% → 10, 100% → 10, 96% → 6        = 400 + 400 + 120
  // Intan : 80% → 3, 60% → 3, 70% → 2            = 120 + 120 + 40
  const harapan = {
    "Farhan Pratama": [500, "Cukup"],
    "Dewi Lestari": [775, "Baik"],
    "Nabila Putri": [920, "Istimewa"],
    "Intan Permata": [280, "Perlu Perbaikan"],
  };
  for (const [nama, [total, predikat]] of Object.entries(harapan)) {
    const h = await skor(nama);
    harusSama(h.metode, "grd", `${nama} metode`);
    harusSama(Number(h.skor_total), total, `${nama} total`);
    harusSama(h.predikat, predikat, `${nama} predikat`);
    harusSama(Number(h.cakupan), 100, `${nama} cakupan`);
  }
});

uji("indikator kosong bernilai 0, bobotnya tetap dihitung", async () => {
  // Maya: 105% → 9 × 50, (kosong) × 30, 2 temuan (turun) → 8 × 20.
  const h = await skor("Maya Safitri");
  harusSama(Number(h.skor_total), 450 + 0 + 160);
  harusSama(h.predikat, "Cukup");
  harusSama(Number(h.cakupan), 70);
  const kosong = h.detail.find((d) => d.pencapaian === null);
  harusSama([kosong.nilai, kosong.total], [0, 0]);
});

uji(
  "semua kosong = BELUM DIISI: predikat kosong, bukan Perlu Perbaikan",
  async () => {
    const h = await skor("Galih Prakoso");
    harusSama(
      [Number(h.skor_total), h.predikat, Number(h.cakupan)],
      [0, null, 0],
    );
    harusSama(h.detail.length, 3);

    const { rows } = await sebagaiAdmin(
      db,
      "select predikat, metode from scorecard_tim($1, $2) where nama = 'Galih Prakoso'",
      [BULAN, "2024-08-31"],
    );
    harusSama([rows[0].predikat, rows[0].metode], [null, "grd"]);
  },
);

uji(
  "bulan GRD: tanpa lembar aktif berarti belum dinilai, bukan rumus jabatan",
  async () => {
    // Rian hanya punya lembar draft (usulan); Bayu tidak punya lembar sama sekali.
    for (const nama of ["Rian Hidayat", "Bayu Nugraha"]) {
      const h = await skor(nama);
      harusSama(
        [h.metode, Number(h.skor_total), h.predikat, h.detail.length],
        ["grd", 0, null, 0],
        nama,
      );
    }
  },
);

uji(
  "bulan tanpa lembar aktif tetap memakai rumus jabatan apa adanya",
  async () => {
    const h = await skor("Nabila Putri", "2024-10-01");
    harusSama(h.metode, "jabatan");
    harus(
      h.detail.every((d) => "realisasi" in d),
      "rincian harus bentuk jabatan",
    );
  },
);

// ---------------------------------------------------------------------
// Penyusunan lembar
// ---------------------------------------------------------------------
uji("lembar tidak bisa langsung aktif: bobot harus genap 100", async () => {
  await harusDitolak(
    async () =>
      sebagaiAdmin(
        db,
        "insert into kpi_lembar (user_id, periode_bulan, status) values ($1, '2024-07-01', 'aktif')",
        [await id("Bayu Nugraha")],
      ),
    "lembar baru aktif tanpa indikator seharusnya ditolak",
  );

  // Rian: draft berbobot 60 + 40 = 100. Dikurangi jadi 90 → tidak bisa aktif.
  await sebagaiAdmin(
    db,
    `update kpi_indikator set bobot = 30
      where urutan = 2 and lembar_id = (
        select id from kpi_lembar where user_id = $1 and periode_bulan = $2)`,
    [await id("Rian Hidayat"), BULAN],
  );
  await harusDitolak(
    async () =>
      sebagaiAdmin(
        db,
        "update kpi_lembar set status = 'aktif' where user_id = $1 and periode_bulan = $2",
        [await id("Rian Hidayat"), BULAN],
      ),
    "bobot 90 seharusnya ditolak saat diaktifkan",
  );
});

uji("indikator lembar aktif membeku", async () => {
  const [pertama] = await indikator("Dewi Lestari");
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "update kpi_indikator set tangga = $2::numeric[] where id = $1",
        [pertama.id, "{1,2,3,4,5,6,7,8,9,10}"],
      ),
    "tangga lembar aktif seharusnya tidak bisa diubah",
  );
  await harusDitolak(
    () =>
      sebagaiAdmin(db, "delete from kpi_indikator where id = $1", [pertama.id]),
    "indikator lembar aktif seharusnya tidak bisa dihapus",
  );
});

uji("hanya CEO/Manager yang menyusun lembar", async () => {
  await harusDitolak(
    async () =>
      sebagai(
        db,
        await id("Dewi Lestari"),
        "insert into kpi_lembar (user_id, periode_bulan) values ($1, '2024-07-01')",
        [await id("Nabila Putri")],
      ),
    "Leader seharusnya tidak bisa membuat lembar",
  );
  await sebagai(
    db,
    await id("Farhan Pratama"),
    "insert into kpi_lembar (user_id, periode_bulan) values ($1, '2024-07-01')",
    [await id("Nabila Putri")],
  );
});

// ---------------------------------------------------------------------
// Pengisian pencapaian
// ---------------------------------------------------------------------
uji("atasan mengisi pencapaian bawahannya", async () => {
  // Nabila #3 dari 96% (VALUE 6) menjadi 100% (VALUE 10): 920 → 1.000.
  const [, , ketiga] = await indikator("Nabila Putri");
  const { rows } = await isi("Dewi Lestari", "Nabila Putri", [
    { indikator_id: ketiga.id, nilai: 100 },
  ]);
  harusSama(Number(rows[0].n), 1);
  harusSama(Number((await skor("Nabila Putri")).skor_total), 1000);
});

uji("orangnya sendiri tidak bisa mengisi pencapaiannya", async () => {
  const [pertama] = await indikator("Nabila Putri");
  await harusDitolak(
    () =>
      isi("Nabila Putri", "Nabila Putri", [
        { indikator_id: pertama.id, nilai: 110 },
      ]),
    "lewat fungsi seharusnya ditolak",
  );
  // Langsung ke tabel: RLS menyaring barisnya diam-diam (0 baris berubah).
  await sebagai(
    db,
    await id("Nabila Putri"),
    "update kpi_pencapaian set nilai = 110 where indikator_id = $1",
    [pertama.id],
  );
  const { rows } = await sebagaiAdmin(
    db,
    "select nilai from kpi_pencapaian where indikator_id = $1",
    [pertama.id],
  );
  harusSama(Number(rows[0].nilai), 112);
});

uji("rekan setingkat dan Leader unit lain bukan penilai", async () => {
  const [pertama] = await indikator("Nabila Putri");
  for (const penilai of ["Rian Hidayat", "Galih Prakoso", "Maya Safitri"]) {
    await harusDitolak(
      () =>
        isi(penilai, "Nabila Putri", [{ indikator_id: pertama.id, nilai: 50 }]),
      `${penilai} seharusnya ditolak`,
    );
  }
});

uji("bawahan tidak bisa menilai atasannya; CEO menilai Manager", async () => {
  const [pertama] = await indikator("Farhan Pratama");
  await harusDitolak(
    () =>
      isi("Dewi Lestari", "Farhan Pratama", [
        { indikator_id: pertama.id, nilai: 100 },
      ]),
    "Leader seharusnya tidak bisa menilai Manager",
  );
  await isi("Hafidz Alkahfi", "Farhan Pratama", [
    { indikator_id: pertama.id, nilai: 100 },
  ]);
  // 92% (5) → 100% (8): 500 + 120.
  harusSama(Number((await skor("Farhan Pratama")).skor_total), 620);
});

uji("nilai null mengosongkan; indikator lembar lain ditolak", async () => {
  const [pertama] = await indikator("Intan Permata");
  await isi("Dewi Lestari", "Intan Permata", [
    { indikator_id: pertama.id, nilai: null },
  ]);
  // 80% (3 × 40) hilang: 280 − 120.
  harusSama(Number((await skor("Intan Permata")).skor_total), 160);

  const [milikNabila] = await indikator("Nabila Putri");
  await harusDitolak(
    () =>
      isi("Dewi Lestari", "Intan Permata", [
        { indikator_id: milikNabila.id, nilai: 90 },
      ]),
    "indikator milik lembar lain seharusnya ditolak",
  );
});

uji("lembar draft tidak bisa diisi", async () => {
  const [pertama] = await indikator("Rian Hidayat");
  await harusDitolak(
    () =>
      isi("Dewi Lestari", "Rian Hidayat", [
        { indikator_id: pertama.id, nilai: 90 },
      ]),
    "lembar draft seharusnya ditolak",
  );
});

uji("pengisi tercatat dari sesi dan jejaknya masuk audit", async () => {
  const [pertama] = await indikator("Nabila Putri");
  await isi("Dewi Lestari", "Nabila Putri", [
    {
      indikator_id: pertama.id,
      nilai: 111,
      catatan: "Laporan Partner Center 31 Agu",
    },
  ]);
  const { rows } = await sebagaiAdmin(
    db,
    `select p.diisi_oleh, p.catatan,
            (select count(*)::int from audit_logs a
              where a.entitas = 'kpi_pencapaian' and a.entitas_id = p.id) jejak
       from kpi_pencapaian p where p.indikator_id = $1`,
    [pertama.id],
  );
  harusSama(rows[0].diisi_oleh, await id("Dewi Lestari"));
  harusSama(rows[0].catatan, "Laporan Partner Center 31 Agu");
  harus(
    rows[0].jejak >= 1,
    "perubahan pencapaian harus tercatat di audit_logs",
  );
});

uji(
  "scorecard: penilai melihat tombol isi, orangnya sendiri tidak",
  async () => {
    const lihat = async (penilai, nama) =>
      (
        await sebagai(
          db,
          await id(penilai),
          "select boleh_menilai from scorecard_tim($1, $2) where nama = $3",
          [BULAN, "2024-08-31", nama],
        )
      ).rows[0]?.boleh_menilai;

    harusSama(await lihat("Dewi Lestari", "Nabila Putri"), true);
    harusSama(await lihat("Dewi Lestari", "Dewi Lestari"), false);
    harusSama(await lihat("Nabila Putri", "Nabila Putri"), false);
    harusSama(await lihat("Farhan Pratama", "Galih Prakoso"), true);
    // Tanpa lembar aktif tidak ada yang bisa diisi.
    harusSama(await lihat("Dewi Lestari", "Rian Hidayat"), false);
  },
);

// ---------------------------------------------------------------------
// Penguncian: skor bulan terkunci tidak berubah
// ---------------------------------------------------------------------
uji(
  "mengunci bulan GRD menyimpan nilai lembar; yang BELUM DIISI dilewati",
  async () => {
    const sebelum = await skor("Dewi Lestari");
    await sebagai(
      db,
      await id("Farhan Pratama"),
      "select kunci_kpi_bulan($1)",
      [BULAN],
    );

    const { rows } = await sebagaiAdmin(
      db,
      `select u.nama, s.skor_total, s.predikat, s.metode, s.detail
       from kpi_snapshots s join users u on u.id = s.user_id
      where s.periode_bulan = $1`,
      [BULAN],
    );
    const snap = Object.fromEntries(rows.map((r) => [r.nama, r]));
    harus(snap["Dewi Lestari"], "Dewi harus terkunci");
    harusSama(
      Number(snap["Dewi Lestari"].skor_total),
      Number(sebelum.skor_total),
    );
    harusSama(snap["Dewi Lestari"].metode, "grd");
    harusSama(snap["Dewi Lestari"].detail[0].tangga.length, 10);
    harus(
      !snap["Galih Prakoso"],
      "lembar yang belum diisi tidak boleh dibekukan nol",
    );
    harus(!snap["Bayu Nugraha"], "orang tanpa lembar tidak boleh dibekukan");
  },
);

uji(
  "bulan terkunci: pencapaian, indikator, dan lembar tidak bisa diubah",
  async () => {
    const [pertama] = await indikator("Dewi Lestari");
    await harusDitolak(
      () =>
        isi("Farhan Pratama", "Dewi Lestari", [
          { indikator_id: pertama.id, nilai: 50 },
        ]),
      "isi pencapaian bulan terkunci seharusnya ditolak",
    );
    await harusDitolak(
      () =>
        sebagaiAdmin(
          db,
          "update kpi_pencapaian set nilai = 50 where indikator_id = $1",
          [pertama.id],
        ),
      "ubah pencapaian langsung seharusnya ditolak",
    );
    await harusDitolak(
      () =>
        sebagaiAdmin(db, "delete from kpi_pencapaian where indikator_id = $1", [
          pertama.id,
        ]),
      "hapus pencapaian seharusnya ditolak",
    );
    await harusDitolak(
      async () =>
        sebagaiAdmin(
          db,
          "update kpi_lembar set status = 'draft' where user_id = $1 and periode_bulan = $2",
          [await id("Dewi Lestari"), BULAN],
        ),
      "lembar terkunci seharusnya tidak bisa dijadikan draft",
    );
  },
);

uji("scorecard bulan terkunci membaca snapshot, tanpa tombol isi", async () => {
  const { rows } = await sebagai(
    db,
    await id("Farhan Pratama"),
    "select skor, predikat, terkunci, metode, boleh_menilai from scorecard_tim($1, $2) where nama = 'Dewi Lestari'",
    [BULAN, "2024-08-31"],
  );
  harusSama(
    [
      Number(rows[0].skor),
      rows[0].predikat,
      rows[0].terkunci,
      rows[0].metode,
      rows[0].boleh_menilai,
    ],
    [775, "Baik", true, "grd", false],
  );
});

uji("yang belum terkunci masih bisa diisi lalu dikunci menyusul", async () => {
  const [pertama, kedua, ketiga] = await indikator("Galih Prakoso");
  await isi("Farhan Pratama", "Galih Prakoso", [
    { indikator_id: pertama.id, nilai: 100 }, // 8 × 40
    { indikator_id: kedua.id, nilai: 7 }, // 8 × 30
    { indikator_id: ketiga.id, nilai: 98 }, // 7 × 30
  ]);
  const { rows } = await sebagai(
    db,
    await id("Farhan Pratama"),
    "select kunci_kpi_bulan($1) n",
    [BULAN],
  );
  harusSama(Number(rows[0].n), 1);
  const snap = await sebagaiAdmin(
    db,
    `select skor_total, predikat from kpi_snapshots
      where user_id = $1 and periode_bulan = $2`,
    [await id("Galih Prakoso"), BULAN],
  );
  harusSama(
    [Number(snap.rows[0].skor_total), snap.rows[0].predikat],
    [770, "Baik"],
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
