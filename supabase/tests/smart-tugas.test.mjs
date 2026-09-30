/**
 * Tiket & to-do SMART (D5, migrasi 0183).
 *
 * Tiket/komitmen baru wajib berkriteria selesai; target angka + satuan
 * opsional tetapi harus lengkap. Tiket lama tanpa kriteria tetap berjalan
 * seperti biasa — termasuk alur QC penuh.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buatDb,
  buatSuite,
  harus,
  harusDitolak,
  harusSama,
  pesanDb,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Tiket & to-do SMART (0183)");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu(`select id from users where nama = $1`, [nama])).id;

const DEWI = await id("Dewi Lestari"); // Leader Affiliator
const BAYU = await id("Bayu Nugraha"); // Staff, bawahan Dewi
const RIAN = await id("Rian Hidayat"); // Staff, bawahan Dewi

/** Galat yang dilempar fn, atau null bila berhasil. */
const galatDari = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
};

const tiketDewi = (kolom, nilai) =>
  sebagai(
    db,
    DEWI,
    `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat${kolom})
     values ('tiket', 'Audit GMV 5 akun beauty', $1, $2,
             now() + interval '1 day'${nilai}) returning id`,
    [DEWI, BAYU],
  );

uji("kolom SMART ada dengan bawaan yang tidak memaksa baris lama", async () => {
  const { rows } = await sebagaiAdmin(
    db,
    `select column_name, is_nullable, column_default
       from information_schema.columns
      where table_name = 'tasks'
        and column_name in ('kriteria_selesai', 'target_angka', 'target_satuan')
      order by column_name`,
  );
  harusSama(
    rows.map((r) => [r.column_name, r.is_nullable]),
    [
      ["kriteria_selesai", "NO"],
      ["target_angka", "YES"],
      ["target_satuan", "NO"],
    ],
  );
  const lama = await satu(
    `select count(*)::int n from tasks
      where tipe <> 'pribadi' and kriteria_selesai = ''`,
  );
  harus(lama.n > 0, "tiket lama tetap ada tanpa kriteria");
});

uji("tiket baru tanpa kriteria selesai ditolak", async () => {
  const e = await galatDari(() => tiketDewi("", ""));
  harus(e, "seharusnya ditolak");
  harus(
    pesanDb(e).includes("kriteria selesai"),
    `pesan tidak jelas: ${pesanDb(e)}`,
  );
  await harusDitolak(
    () => tiketDewi(", kriteria_selesai", ", '  abcd  '"),
    "kriteria di bawah 5 karakter seharusnya ditolak",
  );
});

uji("tiket berkriteria dan bertarget diterima", async () => {
  const { rows } = await tiketDewi(
    ", kriteria_selesai, target_angka, target_satuan",
    ", 'Deviasi komisi 5 akun terkoreksi', 5, 'akun'",
  );
  const t = await satu(
    `select kriteria_selesai, target_angka::text angka, target_satuan
       from tasks where id = $1`,
    [rows[0].id],
  );
  harusSama(t, {
    kriteria_selesai: "Deviasi komisi 5 akun terkoreksi",
    angka: "5",
    target_satuan: "akun",
  });
});

uji("target angka tanpa satuan ditolak — juga untuk to-do", async () => {
  await harusDitolak(
    () =>
      tiketDewi(
        ", kriteria_selesai, target_angka",
        ", 'Deviasi komisi terkoreksi', 5",
      ),
    "constraint tasks_target_bersatuan tidak bekerja (tiket)",
  );
  await harusDitolak(
    () =>
      sebagai(
        db,
        RIAN,
        `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat,
                            target_angka, target_satuan)
         values ('pribadi', 'Cek sesi live', $1, $1, now(), 14, '  ')`,
        [RIAN],
      ),
    "constraint tasks_target_bersatuan tidak bekerja (to-do)",
  );
});

uji("target harus lebih dari nol", async () => {
  for (const angka of [0, -2]) {
    await harusDitolak(
      () =>
        tiketDewi(
          ", kriteria_selesai, target_angka, target_satuan",
          `, 'Deviasi komisi terkoreksi', ${angka}, 'akun'`,
        ),
      `target ${angka} seharusnya ditolak`,
    );
  }
});

uji("to-do tidak wajib berkriteria; target to-do boleh", async () => {
  const { rows } = await sebagai(
    db,
    RIAN,
    `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat,
                        target_angka, target_satuan)
     values ('pribadi', 'Cek 14 sesi live', $1, $1, now(), 14, 'sesi')
     returning target_satuan`,
    [RIAN],
  );
  harusSama(rows[0]?.target_satuan, "sesi");
});

uji("proses sistem boleh menulis tiket lama tanpa kriteria", async () => {
  const t = await satu(
    `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat)
     values ('tiket', 'Tiket hasil migrasi V1', $1, $2, now()) returning id`,
    [DEWI, BAYU],
  );
  harus(t.id, "insert sistem diterima");
});

uji("tiket lama tanpa kriteria: ajukan → revisi → ajukan ulang → lolos", async () => {
  const tid = (
    await satu(
      `select id, kriteria_selesai from tasks
        where judul = 'Tindak lanjut order pending — Rian'`,
    )
  ).id;

  const ajukan = (hasil) =>
    sebagai(
      db,
      RIAN,
      `update tasks set status = 'menunggu_qc', hasil_kerja = $2
        where id = $1 returning status`,
      [tid, hasil],
    );

  harusSama((await ajukan("Order pending 7 dari 9 sudah dikirim.")).rows[0]?.status, "menunggu_qc");

  const revisi = await sebagai(
    db,
    DEWI,
    `update tasks set qc_status = 'revisi', qc_note = 'Dua order sisanya?'
      where id = $1 returning status`,
    [tid],
  );
  harusSama(revisi.rows[0]?.status, "revisi");

  harusSama((await ajukan("Kesembilan order sudah dikirim.")).rows[0]?.status, "menunggu_qc");

  const lolos = await sebagai(
    db,
    DEWI,
    `update tasks set qc_status = 'lolos', qc_note = 'Lengkap.'
      where id = $1 returning status`,
    [tid],
  );
  harusSama(lolos.rows[0]?.status, "selesai");

  const jejak = await satu(
    `select count(*)::int n from task_qc_log where task_id = $1`,
    [tid],
  );
  harusSama(jejak.n, 2, "dua keputusan QC tercatat");
});

uji("penerima tidak bisa mengubah kriteria atau target; pemberi bisa", async () => {
  const tid = (
    await satu(`select id from tasks where judul = 'QC Tiket Konten FYP'`)
  ).id;
  for (const set of [
    `kriteria_selesai = 'Cukup 6 video saja'`,
    `target_angka = 6`,
    `target_satuan = 'konten'`,
  ]) {
    const e = await galatDari(() =>
      sebagai(db, BAYU, `update tasks set ${set} where id = $1`, [tid]),
    );
    harus(e && e.code === "42501", `"${set}" seharusnya dikunci`);
  }
  const { rows } = await sebagai(
    db,
    DEWI,
    `update tasks set kriteria_selesai = '12 video lolos SOP dan terjadwal',
       target_angka = 12, target_satuan = 'video'
      where id = $1 returning id`,
    [tid],
  );
  harusSama(rows.length, 1, "pemberi tiket boleh");
});

uji("papan & daftar membawa kriteria dan target", async () => {
  const { rows } = await sebagai(
    db,
    DEWI,
    `select judul, kriteria_selesai, target_angka::text angka, target_satuan
       from papan_tugas('2024-10-24', '2024-10-24')
      where judul = 'QC Tiket Konten FYP'`,
  );
  harusSama(rows[0], {
    judul: "QC Tiket Konten FYP",
    kriteria_selesai: "12 video lolos SOP dan terjadwal",
    angka: "12",
    target_satuan: "video",
  });
  const { rows: d } = await sebagai(
    db,
    DEWI,
    `select kriteria_selesai from daftar_tugas('2024-10-24', 'semua', 500)
      where judul = 'QC Tiket Konten FYP'`,
  );
  harusSama(d[0]?.kriteria_selesai, "12 video lolos SOP dan terjadwal");
});

uji("seluruh migrasi 0179–0186 aman dijalankan ulang dua kali", async () => {
  const dir = path.join(process.cwd(), "supabase", "migrations");
  const berkas = [
    "0179_todo_tanpa_review.sql",
    "0180_tanggal_wajib_tugas.sql",
    "0181_kunci_isi_tiket.sql",
    "0182_papan_tugas_per_tanggal.sql",
    "0183_smart_tugas.sql",
    "0184_edit_hapus_tugas.sql",
    "0185_kpi_tiket_tanggal_wib.sql",
    "0186_delegasi_todo.sql",
  ];
  for (let putaran = 0; putaran < 2; putaran++) {
    for (const f of berkas) {
      await sebagaiAdmin(db, await readFile(path.join(dir, f), "utf8"));
    }
  }

  // Keadaan akhirnya tetap versi terbaru: kunci mencakup kriteria.
  const tid = (
    await satu(`select id from tasks where judul = 'QC Tiket Konten FYP'`)
  ).id;
  const e = await galatDari(() =>
    sebagai(
      db,
      BAYU,
      `update tasks set kriteria_selesai = 'Diganti penerima' where id = $1`,
      [tid],
    ),
  );
  harus(e && e.code === "42501", "kunci kriteria hilang setelah diulang");
  await harusDitolak(
    () => tiketDewi("", ""),
    "kewajiban kriteria hilang setelah diulang",
  );
});

const gagal = await jalankan();
await db.close();
process.exit(gagal > 0 ? 1 : 0);
