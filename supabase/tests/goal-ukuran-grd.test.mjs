/**
 * Goal GRD (0188): ukuran GMV atas lingkup akun (semua / LIVE / di luar
 * LIVE), ukuran gabungan dengan faktor −1, ukuran isian, kurva per Sabtu,
 * tenggat, dan goal isian yang tidak ikut target rupiah. Matriks WRM
 * mengikuti DECISION-021 (0189).
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
import { keputusanWrm } from "../../src/lib/wrm.ts";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Goal GRD — ukuran & kurva");

const PERIODE = "2024-10-01";
const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu("select id from users where nama = $1", [nama])).id;
const akun = async (username) =>
  (await satu("select id from accounts where username = $1", [username])).id;
const unit = async (kode) =>
  (await satu("select id from units where kode = $1", [kode])).id;

/** GMV laporan sebuah akun dalam rentang, dihitung terpisah dari fungsinya. */
const gmvAkun = async (username, sampai, kolom = "gmv") =>
  Number(
    (
      await satu(
        `select coalesce(sum(${kolom}), 0) n from daily_reports r
           join accounts a on a.id = r.account_id
          where a.username = $1 and r.tanggal between $2 and $3`,
        [username, PERIODE, sampai],
      )
    ).n,
  );

const buatUkuran = async (kode, sumber = "gmv", tambahan = {}) =>
  (
    await satu(
      `insert into grd_ukuran (grd_periode, kode, judul, satuan, sumber, goal_id, pic_id)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [
        PERIODE,
        kode,
        `Ukuran ${kode}`,
        tambahan.satuan ?? (sumber === "gmv" ? "IDR" : "Seller"),
        sumber,
        tambahan.goal ?? null,
        tambahan.pic ?? null,
      ],
    )
  ).id;

const realisasi = async (ukuran, sampai) => {
  const r = await satu("select realisasi_ukuran($1, $2) n", [ukuran, sampai]);
  return r.n === null ? null : Number(r.n);
};

// ---------------------------------------------------------------------
// GMV LIVE di laporan harian
// ---------------------------------------------------------------------
uji("GMV LIVE tidak boleh melebihi GMV hari itu", async () => {
  await harusDitolak(
    async () =>
      sebagaiAdmin(
        db,
        `update daily_reports set gmv_live = gmv + 1
          where account_id = $1 and tanggal = '2024-10-01'`,
        [await akun("@skincare_official")],
      ),
    "GMV LIVE di atas GMV seharusnya ditolak",
  );
});

uji("GMV LIVE hanya untuk laporan Affiliator", async () => {
  await harusDitolak(
    async () =>
      sebagaiAdmin(
        db,
        `update daily_reports set gmv_live = 1
          where unit_id = $1 and tanggal = (
            select min(tanggal) from daily_reports where unit_id = $1)`,
        [await unit("mcn")],
      ),
    "laporan MCN seharusnya menolak GMV LIVE",
  );
});

uji("perubahan GMV LIVE berjejak di revisi", async () => {
  const a = await akun("@skincare_official");
  await sebagaiAdmin(
    db,
    `update daily_reports set gmv_live = 1000000
      where account_id = $1 and tanggal between '2024-10-01' and '2024-10-03'`,
    [a],
  );
  const r = await satu(
    `select count(*)::int n from daily_report_revisions v
       join daily_reports r on r.id = v.report_id
      where r.account_id = $1 and v.live_baru = 1000000 and v.live_lama is null`,
    [a],
  );
  harusSama(r.n, 3);
});

// ---------------------------------------------------------------------
// Ukuran GMV
// ---------------------------------------------------------------------
uji(
  "ukuran GMV menjumlah lingkup akunnya, dipisah LIVE dan di luar LIVE",
  async () => {
    const semua = await buatUkuran("U.SEMUA");
    const live = await buatUkuran("U.LIVE");
    const video = await buatUkuran("U.VIDEO");
    const a = await akun("@skincare_official");
    const b = await akun("@fashion_hijab");
    for (const [u, jenis] of [
      [semua, "semua"],
      [live, "live"],
      [video, "video"],
    ]) {
      await sebagaiAdmin(
        db,
        `insert into grd_ukuran_lingkup (ukuran_id, account_id, jenis_gmv)
       values ($1, $2, $3), ($1, $4, $3)`,
        [u, a, jenis, b],
      );
    }

    const sampai = "2024-10-20";
    const total =
      (await gmvAkun("@skincare_official", sampai)) +
      (await gmvAkun("@fashion_hijab", sampai));
    const totalLive = await gmvAkun(
      "@skincare_official",
      sampai,
      "coalesce(gmv_live, 0)",
    );
    harusSama(await realisasi(semua, sampai), total);
    harusSama(await realisasi(live, sampai), totalLive);
    harusSama(await realisasi(video, sampai), total - totalLive);
    harus(
      totalLive === 3_000_000,
      "tiga hari LIVE @skincare_official tercatat",
    );
  },
);

uji("ukuran gabungan: unit dikurangi ukuran isian (faktor −1)", async () => {
  const baru = await buatUkuran("U.BARU", "isian", { satuan: "IDR" });
  await sebagaiAdmin(
    db,
    "insert into grd_ukuran_isian (ukuran_id, tanggal, nilai) values ($1, '2024-10-10', 500000)",
    [baru],
  );
  const existing = await buatUkuran("U.EXISTING");
  await sebagaiAdmin(
    db,
    "insert into grd_ukuran_lingkup (ukuran_id, unit_id) values ($1, $2)",
    [existing, await unit("mcn")],
  );
  await sebagaiAdmin(
    db,
    "insert into grd_ukuran_lingkup (ukuran_id, sumber_ukuran_id, faktor) values ($1, $2, -1)",
    [existing, baru],
  );
  const gmvMcn = Number(
    (
      await satu(
        `select coalesce(sum(gmv), 0) n from daily_reports
          where unit_id = $1 and tanggal between $2 and '2024-10-20'`,
        [await unit("mcn"), PERIODE],
      )
    ).n,
  );
  harusSama(await realisasi(existing, "2024-10-20"), gmvMcn - 500000);
  // Sebelum isian dicatat, belum ada yang dikurangkan.
  const gmvAwal = Number(
    (
      await satu(
        `select coalesce(sum(gmv), 0) n from daily_reports
          where unit_id = $1 and tanggal between $2 and '2024-10-05'`,
        [await unit("mcn"), PERIODE],
      )
    ).n,
  );
  harusSama(await realisasi(existing, "2024-10-05"), gmvAwal);
});

uji("ukuran GMV berhenti di akhir bulan periodenya", async () => {
  const u = await buatUkuran("U.BATAS");
  await sebagaiAdmin(
    db,
    "insert into grd_ukuran_lingkup (ukuran_id, account_id) values ($1, $2)",
    [u, await akun("@gadget_daily")],
  );
  harusSama(
    await realisasi(u, "2024-12-31"),
    await gmvAkun("@gadget_daily", "2024-10-31"),
  );
  harusSama(await realisasi(u, "2024-09-30"), 0);
});

// ---------------------------------------------------------------------
// Ukuran isian, goal, tenggat
// ---------------------------------------------------------------------
uji(
  "isian: angka terakhir pada atau sebelum tanggal; kosong bila belum ada",
  async () => {
    const u = await buatUkuran("U.SELLER", "isian");
    harusSama(await realisasi(u, "2024-10-31"), null);
    await sebagaiAdmin(
      db,
      `insert into grd_ukuran_isian (ukuran_id, tanggal, nilai) values
       ($1, '2024-10-05', 11), ($1, '2024-10-12', 13)`,
      [u],
    );
    harusSama(await realisasi(u, "2024-10-04"), null);
    harusSama(await realisasi(u, "2024-10-10"), 11);
    harusSama(await realisasi(u, "2024-10-31"), 13);
  },
);

uji("ukuran GMV tidak bisa diisi tangan", async () => {
  const u = await satu("select id from grd_ukuran where kode = 'U.SEMUA'");
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        "insert into grd_ukuran_isian (ukuran_id, tanggal, nilai) values ($1, '2024-10-05', 1)",
        [u.id],
      ),
    "isian pada ukuran GMV seharusnya ditolak",
  );
});

uji(
  "goal isian: realisasi dibekukan pada tenggat dan tidak ikut target rupiah",
  async () => {
    const unitTap = await unit("tap");
    const sebelum = await satu(
      "select coalesce(sum(target), 0) n from target_harian_unit('2024-10-10') where unit_id = $1",
      [unitTap],
    );

    const goal = (
      await satu(
        `insert into goals (judul, level, pemilik_id, unit_id, satuan, target_base,
                          target_goal, target_stretch, periode, grd_periode, kode,
                          tenggat, jenis_realisasi)
       values ('Menambah seller mitra aktif', 'leader', $1, $2, 'Seller', 10, 15, 15,
               'Okt 2024', $3, '1.1.5', '2024-10-17', 'isian')
       returning id`,
        [await id("Dimas Maulana"), unitTap, PERIODE],
      )
    ).id;
    // Anak tangga sengaja dibuat, seperti yang mungkin terjadi lewat dialog
    // ubah goal: tetap tidak boleh tercampur ke target rupiah unit.
    await sebagaiAdmin(
      db,
      "insert into goal_months (goal_id, bulan, target) values ($1, $2, 15)",
      [goal, PERIODE],
    );
    const u = await buatUkuran("1.1.5", "isian", { goal });
    await sebagaiAdmin(
      db,
      `insert into grd_ukuran_isian (ukuran_id, tanggal, nilai) values
       ($1, '2024-10-10', 12), ($1, '2024-10-17', 14), ($1, '2024-10-24', 15)`,
      [u],
    );

    const sesudah = await satu(
      "select coalesce(sum(target), 0) n from target_harian_unit('2024-10-10') where unit_id = $1",
      [unitTap],
    );
    harusSama(Number(sesudah.n), Number(sebelum.n));

    harusSama(
      Number(
        (await satu("select realisasi_goal($1, '2024-10-31') n", [goal])).n,
      ),
      14,
    );
    const p = await satu(
      "select * from progres_goal($1, '2024-10-31') where goal_id = $2",
      [PERIODE, goal],
    );
    harusSama(
      [Number(p.target_bulan), Number(p.realisasi), Number(p.rasio)],
      [15, 14, 93.3],
    );

    const tangga = await satu(
      "select count(*)::int n from anak_tangga_target('2024-10-20') where goal_id = $1",
      [goal],
    );
    harusSama(tangga.n, 0);
  },
);

uji("base boleh belum diukur; draft ikut progres", async () => {
  const goal = (
    await satu(
      `insert into goals (judul, level, pemilik_id, satuan, target_base, target_goal,
                          target_stretch, periode, grd_periode, kode, jenis_realisasi, status)
       values ('Kelengkapan pencatatan sampel', 'staff', $1, '%', null, 100, 100,
               'Okt 2024', $2, 'S.1.2', 'isian', 'draft')
       returning id`,
      [await id("Laras Ayuningtyas"), PERIODE],
    )
  ).id;
  const u = await buatUkuran("S.1.2", "isian", { goal, satuan: "%" });
  await sebagaiAdmin(
    db,
    "insert into grd_ukuran_isian (ukuran_id, tanggal, nilai) values ($1, '2024-10-12', 80)",
    [u],
  );
  const p = await satu(
    "select * from progres_goal($1, '2024-10-31') where goal_id = $2",
    [PERIODE, goal],
  );
  harusSama([Number(p.realisasi), Number(p.rasio)], [80, 80]);
});

// ---------------------------------------------------------------------
// Kurva
// ---------------------------------------------------------------------
uji(
  "kurva: aktual per Sabtu, HIJAU bila ≥ target, titik depan kosong",
  async () => {
    const seller = await satu("select id from grd_ukuran where kode = '1.1.5'");
    await sebagaiAdmin(
      db,
      `insert into grd_ukuran_titik (ukuran_id, tanggal, target) values
       ($1, '2024-10-12', 11), ($1, '2024-10-17', 13), ($1, '2024-10-24', 15),
       ($1, '2024-10-26', 15)`,
      [seller.id],
    );
    const semua = await satu(
      "select id from grd_ukuran where kode = 'U.SEMUA'",
    );
    await sebagaiAdmin(
      db,
      `insert into grd_ukuran_titik (ukuran_id, tanggal, target) values
       ($1, '2024-10-05', 1), ($1, '2024-10-24', 999999999999)`,
      [semua.id],
    );

    const baris = (
      await sebagaiAdmin(db, "select * from kurva_grd($1, '2024-10-24')", [
        PERIODE,
      ])
    ).rows;
    const k = (kode) => baris.find((b) => b.kode === kode).titik;

    // Isian dibaca PADA tanggal titik: 12 Okt belum dicatat (10 Okt tidak
    // dipakai), 17 Okt = 14 dari 13, 24 Okt = 15 dari 15, 26 Okt belum tiba.
    harusSama(
      k("1.1.5").map((t) => [t.tanggal, t.aktual, t.status]),
      [
        ["2024-10-12", null, null],
        ["2024-10-17", 14, "hijau"],
        ["2024-10-24", 15, "hijau"],
        ["2024-10-26", null, null],
      ],
    );
    const gmv = k("U.SEMUA");
    harusSama(gmv[0].status, "hijau");
    harusSama(gmv[1].status, "merah");
    harusSama(
      gmv[0].aktual,
      (await gmvAkun("@skincare_official", "2024-10-05")) +
        (await gmvAkun("@fashion_hijab", "2024-10-05")),
    );
  },
);

// ---------------------------------------------------------------------
// Siapa yang boleh mencatat isian
// ---------------------------------------------------------------------
uji(
  "isian dicatat pemilik goal, atasannya, atau CEO/Manager — bukan orang lain",
  async () => {
    const seller = (
      await satu("select id from grd_ukuran where kode = '1.1.5'")
    ).id;
    const catat = async (nama, nilai) =>
      sebagai(
        db,
        await id(nama),
        `insert into grd_ukuran_isian (ukuran_id, tanggal, nilai) values ($1, '2024-10-12', $2)
       on conflict (ukuran_id, tanggal) do update set nilai = excluded.nilai`,
        [seller, nilai],
      );

    // Dimas (Leader TAP) pemilik goal 1.1.5.
    await catat("Dimas Maulana", 11);
    // Farhan (Manager) atasan Dimas.
    await catat("Farhan Pratama", 12);
    for (const orang of ["Yoga Saputra", "Dewi Lestari", "Rian Hidayat"]) {
      await harusDitolak(() => catat(orang, 99), `${orang} seharusnya ditolak`);
    }
    const r = await satu(
      "select nilai, diisi_oleh from grd_ukuran_isian where ukuran_id = $1 and tanggal = '2024-10-12'",
      [seller],
    );
    harusSama(
      [Number(r.nilai), r.diisi_oleh],
      [12, await id("Farhan Pratama")],
    );
  },
);

// ---------------------------------------------------------------------
// Matriks WRM DECISION-021
// ---------------------------------------------------------------------
uji("matriks WRM: hijau/merah = ALARM, merah/hijau = SABAR", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select h::text hasil, k::text kri, keputusan_wrm(h, k)::text keputusan
       from unnest(array['hijau','merah']::warna_wrm[]) h,
            unnest(array['hijau','merah']::warna_wrm[]) k`,
  );
  const peta = Object.fromEntries(
    rows.map((r) => [`${r.hasil}/${r.kri}`, r.keputusan]),
  );
  harusSama(peta, {
    "hijau/hijau": "LANJUT",
    "hijau/merah": "ALARM",
    "merah/hijau": "SABAR",
    "merah/merah": "UBAH CARA",
  });
  for (const r of rows) {
    harusSama(
      r.keputusan,
      keputusanWrm(r.hasil === "hijau", r.kri === "hijau"),
    );
  }
});

uji(
  "hasil merah dua pekan berturut-turut = UBAH CARA walau kegiatan hijau",
  async () => {
    const u = await unit("tap");
    await sebagaiAdmin(
      db,
      `insert into weekly_reports
       (unit_id, periode, status_hasil, status_kri, keputusan)
     values ($1, '2024-09-02', 'merah', 'hijau', 'LANJUT')`,
      [u],
    );
    await sebagaiAdmin(
      db,
      `insert into weekly_reports
       (unit_id, periode, status_hasil, status_kri, keputusan)
     values ($1, '2024-09-09', 'merah', 'hijau', 'LANJUT')`,
      [u],
    );
    const { rows } = await sebagaiAdmin(
      db,
      `select periode::text, keputusan, merah_beruntun from weekly_reports
      where unit_id = $1 and periode in ('2024-09-02', '2024-09-09') order by periode`,
      [u],
    );
    harusSama(
      rows.map((r) => [r.keputusan, r.merah_beruntun]),
      [
        ["SABAR", 1],
        ["UBAH CARA", 2],
      ],
    );
    harusSama(keputusanWrm(false, true, 2), "UBAH CARA");
  },
);

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
