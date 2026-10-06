/**
 * Tahap 3 GRD: rencana operasional & tonggak (0192), lead measure per
 * daftar akun dan rentang tanggal (0193), sumber otomatis indikator KPI
 * (0194), dan impor yang membawa ketiganya (0195).
 *
 * Setiap angka otomatis dibandingkan dengan hitungan terpisah langsung
 * dari laporan harian, bukan dengan fungsi yang diuji.
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
import { nilaiTangga } from "../../src/lib/kpi.ts";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Rencana, tonggak & KPI otomatis GRD");

const PERIODE = "2024-10-01";
const AKHIR = "2024-10-31";
const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu("select id from users where nama = $1", [nama])).id;
const akun = async (u) =>
  (await satu("select id from accounts where username = $1", [u])).id;
const unit = async (k) =>
  (await satu("select id from units where kode = $1", [k])).id;
const angka = (v) => (v === null || v === undefined ? null : Number(v));
const dekat = (a, b, pesan) =>
  harus(
    (a === null && b === null) ||
      (a !== null && b !== null && Math.abs(a - b) < 1e-6),
    `${pesan}: ${a} ≠ ${b}`,
  );

const PERSEN = [40, 50, 60, 80, 85, 90, 95, 100, 100, 100];
const SATU_SAMPAI_10 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SELLER = [10, 11, 12, 12, 13, 13, 14, 15, 15, 15];

const RIAN = await id("Rian Hidayat");
const DEWI = await id("Dewi Lestari");
const NABILA = await id("Nabila Putri");
const FARHAN = await id("Farhan Pratama");
const DIMAS = await id("Dimas Maulana");
const SKINCARE = await akun("@skincare_official");
const BEAUTY = await akun("@beauty_daily.id");
const TARGET_AKUN = 50_000_000;

// Data contoh seed punya rencana Oktober 2024 sendiri; tes ini mulai bersih.
await sebagaiAdmin(db, "delete from grd_rencana where grd_periode = $1", [
  PERIODE,
]);

async function rencana({ tonggakPekanan = 4 } = {}) {
  const bulan = [{ bulan: PERIODE, dari: PERIODE, sampai: AKHIR }];
  const goal = (kode, tambahan) => ({
    kode,
    judul: `Goal ${kode}`,
    induk: null,
    pemilik_id: null,
    unit_id: null,
    account_id: null,
    satuan: "IDR",
    base: 1,
    target: 1000,
    periode_label: "Oktober 2024",
    tenggat: AKHIR,
    jenis_realisasi: "gmv",
    keterangan: "",
    status: "aktif",
    bulan: bulan.map((b) => ({ ...b, target: tambahan.target ?? 1000 })),
    ...tambahan,
  });
  const indikator = (urutan, bobot, sumber, sumber_ref, tangga = PERSEN) => ({
    urutan,
    nama: `Indikator ${urutan} (${sumber})`,
    satuan: tangga === PERSEN ? "%" : "angka",
    bobot,
    arah: "naik",
    tangga,
    asal: `uji!B${urutan}`,
    sumber,
    sumber_ref,
    keterangan_sumber: sumber === "manual" ? "" : `Otomatis: ${sumber}`,
  });
  return {
    periode: PERIODE,
    hapus_goal: [],
    struktur: [],
    goals: [
      goal("1", { level: "company", pemilik_id: await id("Hafidz Alkahfi") }),
      goal("1.1", { level: "manager", induk: "1", pemilik_id: FARHAN }),
      goal("1.1.3", {
        level: "leader",
        induk: "1.1",
        pemilik_id: DEWI,
        unit_id: await unit("affiliator"),
        target: 900,
      }),
      goal("1.1.5", {
        level: "leader",
        induk: "1.1",
        pemilik_id: DIMAS,
        unit_id: await unit("tap"),
        satuan: "Seller",
        target: 15,
        tenggat: "2024-10-17",
        jenis_realisasi: "isian",
        bulan: [],
      }),
      goal("1.1.3:@skincare_official", {
        level: "account",
        induk: "1.1.3",
        unit_id: await unit("affiliator"),
        account_id: SKINCARE,
        target: TARGET_AKUN,
        status: "draft",
      }),
    ],
    ukuran: [
      {
        kode: "1.1.3:@skincare_official",
        judul: "Target GMV @skincare_official",
        satuan: "IDR",
        sumber: "gmv",
        goal: "1.1.3:@skincare_official",
        lingkup: [{ account_id: SKINCARE, jenis_gmv: "semua", faktor: 1 }],
        titik: [],
      },
      {
        kode: "1.1.5",
        judul: "Seller mitra aktif",
        satuan: "Seller",
        sumber: "isian",
        goal: "1.1.5",
        pic_id: DIMAS,
        lingkup: [],
        titik: [],
      },
    ],
    rencana: [
      {
        kode: "1.1.3.1",
        goal: "1.1.3",
        induk_kode: "1.1.3",
        judul: "Riset mulai berjalan",
        jenis: "sekali",
        pic_ids: [RIAN],
        pic_teks: "Rian",
        jadwal_teks: "Sabtu 5 Okt",
        urutan: 1,
        tonggak: [
          {
            kunci: "",
            judul: "Riset mulai berjalan",
            tenggat: "2024-10-05",
            urutan: 1,
          },
        ],
      },
      {
        kode: "1.1.3.8",
        goal: "1.1.3",
        induk_kode: "1.1.3",
        judul: "Daftar produk laris dibagikan",
        jenis: "pekanan",
        pic_ids: [RIAN],
        pic_teks: "Rian",
        jadwal_teks: "Setiap Senin",
        urutan: 2,
        tonggak: ["2024-10-07", "2024-10-14", "2024-10-21", "2024-10-28"]
          .slice(0, tonggakPekanan)
          .map((t, i) => ({
            kunci: t,
            judul: `Senin ${t}`,
            tenggat: t,
            urutan: i + 1,
          })),
      },
      {
        kode: "M.1",
        goal: null,
        induk_kode: "M",
        judul: "Rancangan disetor",
        jenis: "sekali",
        pic_ids: [FARHAN],
        pic_teks: "Farhan",
        jadwal_teks: "MRM H-1",
        urutan: 3,
        tonggak: [
          { kunci: "", judul: "Rancangan disetor", tenggat: null, urutan: 1 },
        ],
      },
    ],
    lead: [
      {
        kode: "1.1.3.11",
        goal: "1.1.3",
        judul: "Upload minimal 10 video setiap hari di akun utama",
        satuan: "video",
        target_mingguan: 70,
        sumber_laporan: "jumlah_upload",
        mulai: "2024-10-05",
        selesai: "2024-10-10",
        akun: [SKINCARE],
      },
      {
        kode: "1.1.3.6",
        goal: "1.1.3",
        judul: "Meriset minimal 10 produk setiap hari",
        satuan: "produk",
        target_mingguan: 70,
        sumber_laporan: null,
        mulai: "2024-10-03",
        selesai: null,
        akun: [],
      },
    ],
    lembar: [
      {
        user_id: RIAN,
        judul: "KPI STAF — RIAN",
        status: "aktif",
        asal: "uji",
        indikator: [
          indikator(1, 20, "ukuran_persen", {
            ukuran: ["1.1.3:@skincare_official"],
          }),
          indikator(2, 10, "hari_standar", {
            akun: [{ id: SKINCARE, min: 3 }],
          }),
          indikator(
            3,
            10,
            "upload_rata",
            { akun: [SKINCARE, BEAUTY] },
            SATU_SAMPAI_10,
          ),
          indikator(4, 10, "laporan_tepat", { batas: "21:00" }),
          indikator(5, 20, "tonggak", { rencana: ["1.1.3.1", "1.1.3.8"] }),
          indikator(6, 10, "lead_rata", { lead: ["1.1.3.6"] }, SATU_SAMPAI_10),
          indikator(7, 10, "ukuran_nilai", { ukuran: "1.1.5" }, SELLER),
          indikator(8, 5, "hari_live", { akun: [SKINCARE], jam: 2 }),
          indikator(9, 5, "manual", {}),
        ],
      },
    ],
  };
}

// Impor kini membuat tiket dari tonggak (0201), dan tonggak yang punya tiket
// tidak bisa dicentang manual (aturan 7). Tes ini menguji tonggak sebagai
// tonggak — centang, waktu selesai, impor ulang — jadi tiket otomatisnya
// dilepas lagi di sini. Interaksi tonggak dengan tiketnya diuji di
// tiket-grd.test.mjs.
const impor = async (r) => {
  const hasil = (
    await satu("select impor_grd($1::jsonb, false) r", [JSON.stringify(r)])
  ).r;
  await satu("delete from tasks where tonggak_id is not null");
  return hasil;
};

const tonggak = async (kode, kunci = "") =>
  satu(
    `select t.* from grd_tonggak t join grd_rencana r on r.id = t.rencana_id
      where r.grd_periode = $1 and r.kode = $2 and t.kunci = $3`,
    [PERIODE, kode, kunci],
  );

/** Selesai pada waktu tertentu — hanya proses sistem yang bisa begini. */
const selesaiPada = async (kode, kunci, waktu) =>
  sebagaiAdmin(
    db,
    `update grd_tonggak t set status = 'selesai', selesai_pada = $3
       from grd_rencana r
      where r.id = t.rencana_id and r.grd_periode = $4 and r.kode = $1 and t.kunci = $2`,
    [kode, kunci, waktu, PERIODE],
  );

const tepatWaktu = async (kode, sampai) =>
  angka(
    (
      await satu("select tonggak_tepat_waktu($1, $2, $3) n", [
        PERIODE,
        kode,
        sampai,
      ])
    ).n,
  );

const rincian = async (sampai = AKHIR, user = RIAN) => {
  const r = await satu("select * from hitung_kpi_grd($1, $2, $3)", [
    user,
    PERIODE,
    sampai,
  ]);
  return { ...r, per: new Map(r.detail.map((d) => [d.urutan, d])) };
};

// ---------------------------------------------------------------------
// Impor
// ---------------------------------------------------------------------
uji(
  "impor membawa rencana, tonggak, lead measure, dan sumber indikator",
  async () => {
    const r = await impor(await rencana());
    harusSama([r.rencana, r.tonggak, r.lead_measure], [3, 6, 2]);
    const lead = await satu(
      `select l.mulai::text, l.selesai::text, l.sumber_laporan,
            (select array_agg(account_id) from lead_measure_akun x where x.lead_measure_id = l.id) akun
       from lead_measures l where l.kode = '1.1.3.11'`,
    );
    harusSama(
      [lead.mulai, lead.selesai, lead.sumber_laporan, lead.akun],
      ["2024-10-05", "2024-10-10", "jumlah_upload", [SKINCARE]],
    );
    const ind = await satu(
      `select i.sumber, i.sumber_ref from kpi_indikator i
       join kpi_lembar l on l.id = i.lembar_id
      where l.user_id = $1 and l.periode_bulan = $2 and i.urutan = 5`,
      [RIAN, PERIODE],
    );
    harusSama(
      [ind.sumber, ind.sumber_ref],
      ["tonggak", { rencana: ["1.1.3.1", "1.1.3.8"] }],
    );
  },
);

uji(
  "impor ulang tidak menimpa status tonggak dan membuang tonggak yang hilang",
  async () => {
    await sebagai(db, RIAN, "select ubah_status_tonggak($1, 'progress')", [
      (await tonggak("1.1.3.8", "2024-10-07")).id,
    ]);
    await impor(await rencana({ tonggakPekanan: 3 }));
    harusSama((await tonggak("1.1.3.8", "2024-10-07")).status, "progress");
    harus(
      !(await tonggak("1.1.3.8", "2024-10-28")),
      "tonggak 28 Okt seharusnya terhapus",
    );
    await impor(await rencana());
    harusSama((await tonggak("1.1.3.8", "2024-10-28")).status, "belum");
  },
);

// ---------------------------------------------------------------------
// Tonggak: siapa yang mencentang, tenggat terkunci, waktu selesai
// ---------------------------------------------------------------------
uji(
  "PIC mencentang selesai; waktu selesai diisi database, bukan pemanggil",
  async () => {
    const t = await tonggak("1.1.3.1");
    await sebagai(
      db,
      RIAN,
      "update grd_tonggak set status = 'selesai', selesai_pada = '2024-10-01T00:00:00Z' where id = $1",
      [t.id],
    );
    const s = await satu(
      "select status, selesai_pada > now() - interval '1 minute' baru, diubah_oleh from grd_tonggak where id = $1",
      [t.id],
    );
    harusSama([s.status, s.baru, s.diubah_oleh], ["selesai", true, RIAN]);

    // Kembali ke progress mengosongkan waktu selesai.
    await sebagai(db, RIAN, "select ubah_status_tonggak($1, 'progress')", [
      t.id,
    ]);
    harusSama((await tonggak("1.1.3.1")).selesai_pada, null);
  },
);

uji("atasan PIC dan Manager boleh mencentang; rekan setim tidak", async () => {
  const t = await tonggak("1.1.3.8", "2024-10-14");
  await sebagai(db, DEWI, "select ubah_status_tonggak($1, 'progress')", [t.id]);
  await sebagai(db, FARHAN, "select ubah_status_tonggak($1, 'belum')", [t.id]);
  await harusDitolak(
    async () =>
      sebagai(db, NABILA, "select ubah_status_tonggak($1, 'selesai')", [t.id]),
    "rekan setim seharusnya tidak bisa mencentang tonggak orang lain",
  );
  harusSama((await tonggak("1.1.3.8", "2024-10-14")).status, "belum");
});

uji("tenggat hanya diubah CEO/Manager, dan perubahannya berjejak", async () => {
  const t = await tonggak("1.1.3.1");
  await harusDitolak(
    async () =>
      sebagai(
        db,
        RIAN,
        "update grd_tonggak set tenggat = '2024-10-30' where id = $1",
        [t.id],
      ),
    "PIC seharusnya tidak bisa menggeser tenggat",
  );
  await harusDitolak(
    async () =>
      sebagai(
        db,
        DEWI,
        "update grd_tonggak set tenggat = '2024-10-30' where id = $1",
        [t.id],
      ),
    "Leader seharusnya tidak bisa menggeser tenggat",
  );
  await sebagai(
    db,
    FARHAN,
    "update grd_tonggak set tenggat = '2024-10-06' where id = $1",
    [t.id],
  );
  await sebagai(
    db,
    FARHAN,
    "update grd_tonggak set tenggat = '2024-10-05' where id = $1",
    [t.id],
  );
  const jejak = await satu(
    `select count(*)::int n from audit_logs
      where entitas = 'grd_tonggak' and entitas_id = $1 and user_id = $2`,
    [t.id, FARHAN],
  );
  harusSama(jejak.n, 2);
});

uji(
  "Leader membaca seluruh rencana, staf hanya miliknya (0198); menambah tonggak hanya CEO/Manager",
  async () => {
    const n = async (siapa) =>
      (await sebagai(db, siapa, "select count(*)::int n from grd_tonggak"))
        .rows[0].n;
    harusSama(await n(DEWI), 6);
    // Nabila bukan PIC rencana mana pun; Rian hanya tonggak rencananya.
    harusSama(await n(NABILA), 0);
    const milikRian = await sebagaiAdmin(
      db,
      `select count(*)::int n from grd_tonggak t
         join grd_rencana r on r.id = t.rencana_id
        where $1 = any (r.pic_ids)`,
      [RIAN],
    );
    harusSama(await n(RIAN), milikRian.rows[0].n);
    const r = await tonggak("1.1.3.1");
    await harusDitolak(
      async () =>
        sebagai(
          db,
          RIAN,
          "insert into grd_tonggak (rencana_id, kunci, judul, tenggat) values ($1, 'x', 'Tonggak liar', '2024-10-09')",
          [r.rencana_id],
        ),
      "PIC seharusnya tidak bisa menambah tonggak",
    );
  },
);

uji(
  "tepat waktu: tanggal selesai WIB ≤ tenggat; yang belum jatuh tempo tidak dihitung",
  async () => {
    // Batas hari WIB: 23.30 WIB tanggal 5 masih tepat; 00.30 WIB tanggal 6 tidak.
    await selesaiPada("1.1.3.1", "", "2024-10-05T23:30:00+07:00");
    await selesaiPada("1.1.3.8", "2024-10-07", "2024-10-08T00:30:00+07:00");
    await selesaiPada("1.1.3.8", "2024-10-14", "2024-10-13T09:00:00+07:00");

    dekat(
      await tepatWaktu(["1.1.3.1", "1.1.3.8"], "2024-10-04"),
      null,
      "belum ada yang jatuh tempo",
    );
    dekat(
      await tepatWaktu(["1.1.3.1", "1.1.3.8"], "2024-10-05"),
      100,
      "s.d. 5 Okt",
    );
    dekat(
      await tepatWaktu(["1.1.3.1", "1.1.3.8"], "2024-10-07"),
      50,
      "s.d. 7 Okt",
    );
    // 31 Okt: 1.1.3.1 tepat, 7 Okt terlambat, 14 Okt tepat, 21 & 28 Okt belum.
    dekat(
      await tepatWaktu(["1.1.3.1", "1.1.3.8"], AKHIR),
      40,
      "s.d. akhir bulan",
    );
    // Tonggak tanpa tenggat tidak ikut dihitung.
    dekat(await tepatWaktu(["M.1"], AKHIR), null, "tonggak tanpa tenggat");
  },
);

// ---------------------------------------------------------------------
// Lead measure GRD
// ---------------------------------------------------------------------
uji(
  "lead measure berdaftar akun hanya menjumlah akun itu, di dalam rentangnya",
  async () => {
    const lead = await satu(
      "select id from lead_measures where kode = '1.1.3.11'",
    );
    const entri = (
      await sebagaiAdmin(
        db,
        "select tanggal::text, nilai from lead_measure_entries where lead_measure_id = $1 order by tanggal",
        [lead.id],
      )
    ).rows;
    const harapan = (
      await sebagaiAdmin(
        db,
        `select tanggal::text, sum(jumlah_upload) nilai from daily_reports
        where account_id = $1 and tanggal between '2024-10-05' and '2024-10-10'
          and coalesce(jumlah_upload, 0) > 0
        group by tanggal order by tanggal`,
        [SKINCARE],
      )
    ).rows;
    harus(harapan.length > 0, "seed seharusnya punya upload di rentang itu");
    harusSama(
      entri.map((e) => [e.tanggal, Number(e.nilai)]),
      harapan.map((e) => [e.tanggal, Number(e.nilai)]),
    );

    // Laporan akun lain di unit yang sama tidak menggeser angkanya.
    await sebagaiAdmin(
      db,
      "update daily_reports set jumlah_upload = coalesce(jumlah_upload, 0) + 5 where account_id = $1 and tanggal = '2024-10-07'",
      [BEAUTY],
    );
    const setelah = await satu(
      "select nilai from lead_measure_entries where lead_measure_id = $1 and tanggal = '2024-10-07'",
      [lead.id],
    );
    harusSama(
      Number(setelah?.nilai ?? 0),
      Number(harapan.find((h) => h.tanggal === "2024-10-07")?.nilai ?? 0),
    );
  },
);

uji(
  "papan pekanan memotong target sesuai hari yang masuk rentang",
  async () => {
    // Pekan 7–13 Okt hanya beririsan 7–10 Okt dengan rentang 5–10 Okt.
    const p = await satu(
      "select target from papan_lead_measure('2024-10-09') where judul like 'Upload minimal%'",
    );
    dekat(
      Number(p.target),
      Math.round(((70 * 4) / 7) * 100) / 100,
      "target 4 hari",
    );
    const luar = await satu(
      "select count(*)::int n from papan_lead_measure('2024-10-16') where judul like 'Upload minimal%'",
    );
    harusSama(luar.n, 0);
  },
);

// ---------------------------------------------------------------------
// Sumber otomatis indikator KPI
// ---------------------------------------------------------------------
uji("isian ukuran dan lead measure dicatat orangnya", async () => {
  const ukuran = await satu(
    "select id from grd_ukuran where grd_periode = $1 and kode = '1.1.5'",
    [PERIODE],
  );
  await sebagai(
    db,
    DIMAS,
    "insert into grd_ukuran_isian (ukuran_id, tanggal, nilai) values ($1, '2024-10-09', 11), ($1, '2024-10-20', 14)",
    [ukuran.id],
  );
  const lead = await satu(
    "select id from lead_measures where kode = '1.1.3.6'",
  );
  await sebagai(
    db,
    RIAN,
    "insert into lead_measure_entries (lead_measure_id, user_id, tanggal, nilai) values ($1, $2, '2024-10-03', 12), ($1, $2, '2024-10-04', 8)",
    [lead.id, RIAN],
  );
  // Jam LIVE dua laporan @skincare_official.
  await sebagaiAdmin(
    db,
    `update daily_reports set jam_live = case tanggal when '2024-10-02' then 2.5 else 1 end
      where account_id = $1 and tanggal in ('2024-10-02', '2024-10-03')`,
    [SKINCARE],
  );
});

uji(
  "setiap sumber otomatis sama dengan hitungan langsung dari datanya",
  async () => {
    const { per } = await rincian();
    const n = 31;

    const gmv = Number(
      (
        await satu(
          "select sum(gmv) n from daily_reports where account_id = $1 and tanggal between $2 and $3",
          [SKINCARE, PERIODE, AKHIR],
        )
      ).n,
    );
    dekat(
      angka(per.get(1).otomatis),
      (gmv / TARGET_AKUN) * 100,
      "ukuran_persen",
    );

    const hariStandar = Number(
      (
        await satu(
          `select count(*) n from generate_series($2::date, $3::date, '1 day') d
          where (select coalesce(sum(jumlah_upload), 0) from daily_reports
                  where account_id = $1 and tanggal = d::date) >= 3`,
          [SKINCARE, PERIODE, AKHIR],
        )
      ).n,
    );
    dekat(angka(per.get(2).otomatis), (hariStandar / n) * 100, "hari_standar");

    const upload = Number(
      (
        await satu(
          "select coalesce(sum(jumlah_upload), 0) n from daily_reports where account_id in ($1, $2) and tanggal between $3 and $4",
          [SKINCARE, BEAUTY, PERIODE, AKHIR],
        )
      ).n,
    );
    dekat(angka(per.get(3).otomatis), upload / n, "upload_rata");

    const tepat = Number(
      (
        await satu(
          `select count(distinct tanggal) n from daily_reports
          where user_id = $1 and tanggal between $2 and $3
            and (submitted_at at time zone 'Asia/Jakarta') <= tanggal + time '21:00'`,
          [RIAN, PERIODE, AKHIR],
        )
      ).n,
    );
    harus(tepat > 0, "seed seharusnya punya laporan Rian");
    dekat(angka(per.get(4).otomatis), (tepat / n) * 100, "laporan_tepat");

    dekat(angka(per.get(5).otomatis), 40, "tonggak");
    // Lead 1.1.3.6 berlaku sejak 3 Okt: 29 hari.
    dekat(angka(per.get(6).otomatis), 20 / 29, "lead_rata");
    // Goal 1.1.5 bertenggat 17 Okt: angka pada tenggat, bukan isian 20 Okt.
    dekat(angka(per.get(7).otomatis), 11, "ukuran_nilai");
    dekat(angka(per.get(8).otomatis), (1 / n) * 100, "hari_live");
    harusSama(per.get(9).otomatis, null);
  },
);

uji(
  "NILAI dan total memakai tangga yang sama dengan mesin Tahap 1",
  async () => {
    const r = await rincian();
    let total = 0;
    for (const d of r.detail) {
      const nilai = nilaiTangga(
        angka(d.pencapaian),
        d.tangga.map(Number),
        d.arah,
      );
      harusSama(Number(d.nilai), nilai, `NILAI indikator ${d.urutan}`);
      total += nilai * d.bobot;
    }
    harusSama(Number(r.skor_total), total);
  },
);

uji(
  "bulan berjalan: target GMV diprorata, hari dihitung sampai tanggal acuan",
  async () => {
    const { per } = await rincian("2024-10-10");
    const gmv = Number(
      (
        await satu(
          "select sum(gmv) n from daily_reports where account_id = $1 and tanggal between $2 and '2024-10-10'",
          [SKINCARE, PERIODE],
        )
      ).n,
    );
    dekat(
      angka(per.get(1).otomatis),
      (gmv / ((TARGET_AKUN * 10) / 31)) * 100,
      "prorata",
    );
    const upload = Number(
      (
        await satu(
          "select coalesce(sum(jumlah_upload), 0) n from daily_reports where account_id in ($1, $2) and tanggal between $3 and '2024-10-10'",
          [SKINCARE, BEAUTY, PERIODE],
        )
      ).n,
    );
    dekat(angka(per.get(3).otomatis), upload / 10, "upload_rata 10 hari");
    dekat(angka(per.get(7).otomatis), 11, "isian sebelum tenggat");
  },
);

uji(
  "isian penilai menang atas angka otomatis, dan otomatisnya tetap terlihat",
  async () => {
    const sebelum = (await rincian()).per.get(1);
    await sebagai(
      db,
      DEWI,
      `select isi_pencapaian_kpi($1, $2, jsonb_build_array(jsonb_build_object('indikator_id', $3::text, 'nilai', 97)))`,
      [RIAN, PERIODE, sebelum.indikator_id],
    );
    const sesudah = (await rincian()).per.get(1);
    harusSama([Number(sesudah.manual), Number(sesudah.pencapaian)], [97, 97]);
    dekat(
      angka(sesudah.otomatis),
      angka(sebelum.otomatis),
      "otomatis tetap ada",
    );
  },
);

uji("hak lihat: orangnya, atasannya, Manager — bukan rekan setim", async () => {
  const dilihat = async (pemanggil) =>
    (
      await sebagai(db, pemanggil, "select * from hitung_kpi_grd($1, $2, $3)", [
        RIAN,
        PERIODE,
        AKHIR,
      ])
    ).rows;
  harusSama((await dilihat(NABILA)).length, 0);
  const [diri] = await dilihat(RIAN);
  const [atasan] = await dilihat(DEWI);
  harusSama(Number(diri.skor_total), Number(atasan.skor_total));
  // Angka sama siapa pun yang melihat, walau RLS laporannya berbeda.
  const sc = await sebagai(
    db,
    FARHAN,
    "select skor from scorecard_tim($1, $2) where user_id = $3",
    [PERIODE, AKHIR, RIAN],
  );
  harusSama(Number(sc.rows[0].skor), Number(diri.skor_total));
});

uji("rumus dan sumber otomatis tidak dibuka lewat RPC", async () => {
  const ind = (await rincian()).per.get(3).indikator_id;
  await harusDitolak(
    async () =>
      sebagai(db, RIAN, "select pencapaian_otomatis($1, $2)", [ind, AKHIR]),
    "pencapaian_otomatis seharusnya tertutup",
  );
  await harusDitolak(
    async () =>
      sebagai(db, NABILA, "select * from nilai_kpi_grd($1, $2, $3)", [
        RIAN,
        PERIODE,
        AKHIR,
      ]),
    "nilai_kpi_grd seharusnya tertutup",
  );
});

uji(
  "setelah KPI dikunci, tonggak bulan itu tidak bisa diubah lagi",
  async () => {
    const sebelum = (await rincian()).skor_total;
    await sebagai(db, FARHAN, "select kunci_kpi_bulan($1)", [PERIODE]);
    const snap = await satu(
      "select skor_total, metode from kpi_snapshots where user_id = $1 and periode_bulan = $2",
      [RIAN, PERIODE],
    );
    harusSama([Number(snap.skor_total), snap.metode], [Number(sebelum), "grd"]);
    const t = await tonggak("1.1.3.8", "2024-10-21");
    await harusDitolak(
      async () =>
        sebagai(db, RIAN, "select ubah_status_tonggak($1, 'selesai')", [t.id]),
      "tonggak bulan terkunci seharusnya beku",
    );
  },
);

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
