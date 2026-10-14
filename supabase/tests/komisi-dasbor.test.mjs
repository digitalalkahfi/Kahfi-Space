/**
 * Kartu "Komisi Affiliator" di dasbor GMV (§4.3, AC6).
 *
 * Angka kartu = jumlah komisi seluruh laporan Affiliator di periode itu,
 * dan keterangan "x dari y laporan berisi komisi" dihitung dari laporan
 * yang sama.
 */
import {
  buatDb,
  buatSuite,
  harusSama,
  idPeran,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Kartu Komisi Affiliator");

const DARI = "2024-10-01";
const SAMPAI = "2024-10-31";

const langsung = async () =>
  (
    await sebagaiAdmin(
      db,
      `select coalesce(sum(r.komisi), 0)::bigint komisi, count(*)::int laporan,
              count(r.komisi)::int berkomisi
       from daily_reports r left join accounts a on a.id = r.account_id
       join units u on u.id = coalesce(r.unit_id, a.unit_id)
       where u.kode = 'affiliator' and r.tanggal between $1 and $2`,
      [DARI, SAMPAI],
    )
  ).rows[0];

uji("AC6: deret harian dijumlahkan = komisi seluruh laporan Affiliator", async () => {
  const manager = await idPeran(db, "Manager");
  const { rows } = await sebagai(
    db,
    manager,
    `select sum(komisi)::bigint komisi, sum(laporan)::int laporan, sum(berkomisi)::int berkomisi
     from komisi_affiliator_harian($1, $2)`,
    [DARI, SAMPAI],
  );
  harusSama(rows[0], await langsung());
});

uji("AC6: keterangan kelengkapan menghitung laporan lama yang kosong (E2)", async () => {
  // Dua laporan lama dibuat kosong komisinya (sebelum aturan wajib).
  await sebagaiAdmin(
    db,
    `update daily_reports set komisi = null where id in (
       select r.id from daily_reports r join accounts a on a.id = r.account_id
       join units u on u.id = a.unit_id
       where u.kode = 'affiliator' and r.tanggal between '${DARI}' and '${SAMPAI}'
       order by r.tanggal limit 2)`,
  );
  const ceo = await idPeran(db, "CEO");
  const { rows } = await sebagai(
    db,
    ceo,
    `select sum(laporan)::int laporan, sum(berkomisi)::int berkomisi
     from komisi_affiliator_harian($1, $2)`,
    [DARI, SAMPAI],
  );
  const h = await langsung();
  harusSama(rows[0], { laporan: h.laporan, berkomisi: h.berkomisi });
  harusSama(h.laporan - h.berkomisi, 2);
});

uji("Kartu per hari sama dengan rincian per akun", async () => {
  const ceo = await idPeran(db, "CEO");
  const harian = await sebagai(
    db,
    ceo,
    "select sum(komisi)::bigint t from komisi_affiliator_harian($1, $2)",
    [DARI, SAMPAI],
  );
  const akun = await sebagai(
    db,
    ceo,
    "select sum(komisi)::bigint t from komisi_affiliator($1, $2)",
    [DARI, SAMPAI],
  );
  harusSama(harian.rows[0].t, akun.rows[0].t);
});

await jalankan();
await db.close();
