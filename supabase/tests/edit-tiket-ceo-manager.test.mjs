/**
 * CEO dan Manager boleh mengedit semua tiket yang belum selesai (0205).
 *
 * Sebelumnya (D1, 0181) hanya pemberi tiket. Diuji sebagai pengguna
 * sungguhan dengan RLS aktif:
 *   · CEO/Manager yang bukan pemberi: sunting judul, rincian, kriteria,
 *     target, tenggat, prioritas, penerima (selagi To Do) → boleh;
 *   · yang tetap ditolak: penerima, Leader atasan yang bukan pemberi,
 *     tiket yang sudah selesai, to-do orang lain, mengambil alih pemberi
 *     atau mengubah jenis tiket;
 *   · pemberi dikabari bila orang lain yang mengubah isi tiketnya.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  pesanDb,
  sebagai,
  sebagaiAdmin,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("CEO/Manager mengedit semua tiket (0205)");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const id = async (nama) =>
  (await satu("select id from users where nama = $1", [nama])).id;

const CEO = await id("Hafidz Alkahfi");
const MANAGER = await id("Farhan Pratama");
const DEWI = await id("Dewi Lestari"); // Leader Affiliator, atasan Rian & Bayu
const RIAN = await id("Rian Hidayat");
const BAYU = await id("Bayu Nugraha");
const GALIH = await id("Galih Prakoso"); // Leader MCN: bukan atasan Rian/Bayu
const NABILA = await id("Nabila Putri");

const buatTiket = async ({
  judul,
  pembuat = DEWI,
  penerima = RIAN,
  status = "todo",
  tipe = "tiket",
}) =>
  (
    await satu(
      `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat,
                          kriteria_selesai, status)
       values ($4::tipe_tugas, $1, $2, $3, '2099-03-10T17:00:00+07:00',
               'Laporan terkirim lengkap', $5::status_tugas)
       returning id`,
      [judul, pembuat, penerima, tipe, status],
    )
  ).id;

const galatDari = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
};
const harusDitolak = (e, ket, kode = "42501") => {
  harus(e, `seharusnya ditolak: ${ket}`);
  harusSama(e.code, kode, `${ket}: ${pesanDb(e)}`);
};
const notifikasi = async (userId, pola) =>
  (
    await sebagaiAdmin(
      db,
      `select judul, pesan from notifications
        where user_id = $1 and judul like $2 order by created_at`,
      [userId, pola],
    )
  ).rows;

uji("Manager yang bukan pemberi boleh menyunting isi tiket", async () => {
  const tid = await buatTiket({ judul: "Tiket dari Dewi untuk Rian" });
  const { rows } = await sebagai(
    db,
    MANAGER,
    `update tasks
        set judul = 'Judul disunting Manager',
            deskripsi = 'Rincian baru',
            kriteria_selesai = 'Kriteria yang lebih tajam',
            target_angka = 12, target_satuan = 'video',
            prioritas = 'tinggi',
            tenggat = '2099-03-12T15:00:00+07:00'
      where id = $1 returning judul, kriteria_selesai, prioritas`,
    [tid],
  );
  harusSama(rows.length, 1, "Manager boleh");
  harusSama(rows[0].judul, "Judul disunting Manager", "judul berubah");
  harusSama(rows[0].kriteria_selesai, "Kriteria yang lebih tajam", "kriteria berubah");
});

uji("CEO juga boleh", async () => {
  const tid = await buatTiket({ judul: "Tiket untuk disunting CEO" });
  const { rows } = await sebagai(
    db,
    CEO,
    `update tasks set deskripsi = 'Disunting CEO' where id = $1 returning id`,
    [tid],
  );
  harusSama(rows.length, 1, "CEO boleh");
});

uji("penerima tetap tidak bisa menyunting isi tiketnya", async () => {
  const tid = await buatTiket({ judul: "Tiket penerima tidak boleh sunting" });
  const e = await galatDari(() =>
    sebagai(db, RIAN, `update tasks set judul = 'dibajak penerima' where id = $1`, [tid]),
  );
  harusDitolak(e, "penerima menyunting judul");
  harus(pesanDb(e).includes("Isi tiket hanya bisa diubah oleh pemberi tiket"), pesanDb(e));
});

uji("Leader atasan penerima yang bukan pemberi tetap ditolak", async () => {
  // Tiket Manager untuk Rian: Dewi atasan Rian (melihatnya) tetapi bukan pemberi.
  const tid = await buatTiket({
    judul: "Tiket Manager untuk Rian",
    pembuat: MANAGER,
  });
  const e = await galatDari(() =>
    sebagai(db, DEWI, `update tasks set judul = 'disunting Leader' where id = $1`, [tid]),
  );
  harusDitolak(e, "Leader bukan pemberi menyunting");
  // Leader lain yang bahkan tidak melihat tiketnya: tidak ada baris tersentuh.
  const { rows } = await sebagai(
    db,
    GALIH,
    `update tasks set judul = 'disunting Galih' where id = $1 returning id`,
    [tid],
  );
  harusSama(rows.length, 0, "Leader di luar garis atasan tidak menyentuh apa pun");
});

uji("tiket yang sudah selesai tetap terkunci, bahkan untuk Manager", async () => {
  const tid = await buatTiket({ judul: "Tiket sudah selesai", status: "selesai" });
  const e = await galatDari(() =>
    sebagai(db, MANAGER, `update tasks set judul = 'dibuka lagi' where id = $1`, [tid]),
  );
  harusDitolak(e, "menyunting tiket selesai");
  harus(pesanDb(e).includes("sudah selesai"), pesanDb(e));
});

uji("Manager tidak bisa mengambil alih pemberi atau mengubah jenis tiket", async () => {
  const tid = await buatTiket({ judul: "Tiket tidak boleh diambil alih" });
  const alih = await galatDari(() =>
    sebagai(db, MANAGER, `update tasks set pembuat_id = $2 where id = $1`, [tid, MANAGER]),
  );
  harusDitolak(alih, "mengambil alih pemberi");
  harus(pesanDb(alih).includes("tidak bisa diubah oleh orang lain"), pesanDb(alih));

  const jenis = await galatDari(() =>
    sebagai(db, MANAGER, `update tasks set tipe = 'komitmen_mingguan' where id = $1`, [tid]),
  );
  harus(jenis, "mengubah jenis seharusnya ditolak");
});

uji("penerima hanya diganti selagi To Do; penerima baru harus boleh ditugasi", async () => {
  const todo = await buatTiket({ judul: "Alihkan selagi To Do" });
  const { rows } = await sebagai(
    db,
    MANAGER,
    `update tasks set penerima_id = $2 where id = $1 returning penerima_id`,
    [todo, NABILA],
  );
  harusSama(rows[0]?.penerima_id, NABILA, "Manager boleh mengalihkan");

  const jalan = await buatTiket({ judul: "Sudah dikerjakan", status: "berjalan" });
  const e = await galatDari(() =>
    sebagai(db, MANAGER, `update tasks set penerima_id = $2 where id = $1`, [jalan, NABILA]),
  );
  harus(e, "tiket yang sudah berjalan tidak dipindah tangan");
  harus(pesanDb(e).includes("belum mulai dikerjakan"), pesanDb(e));
});

uji("to-do pribadi orang lain tetap tidak bisa disunting Manager", async () => {
  const todo = await buatTiket({
    judul: "To-do pribadi Rian",
    pembuat: RIAN,
    penerima: RIAN,
    tipe: "pribadi",
  });
  const e = await galatDari(() =>
    sebagai(db, MANAGER, `update tasks set judul = 'disunting Manager' where id = $1`, [todo]),
  );
  harusDitolak(e, "menyunting to-do orang lain");
  harus(pesanDb(e).includes("hanya bisa diubah pemiliknya"), pesanDb(e));
});

uji("pemberi dikabari bila orang lain yang mengubah isi tiketnya", async () => {
  const tid = await buatTiket({ judul: "Tiket untuk kabar pemberi", penerima: BAYU });
  const dewi0 = (await notifikasi(DEWI, "Tiket diubah oleh%")).length;
  const bayu0 = (await notifikasi(BAYU, "Tiket diubah:%")).length;

  await sebagai(
    db,
    MANAGER,
    `update tasks set kriteria_selesai = 'Kriteria baru dari Manager' where id = $1`,
    [tid],
  );

  const kabarDewi = await notifikasi(DEWI, "Tiket diubah oleh%");
  harusSama(kabarDewi.length, dewi0 + 1, "pemberi (Dewi) dikabari");
  harus(
    kabarDewi.at(-1).judul.includes("Farhan Pratama") &&
      kabarDewi.at(-1).judul.includes("Tiket untuk kabar pemberi"),
    `judul kabar: ${kabarDewi.at(-1).judul}`,
  );
  harus(kabarDewi.at(-1).pesan.includes("kriteria selesai"), kabarDewi.at(-1).pesan);
  harusSama(
    (await notifikasi(BAYU, "Tiket diubah:%")).length,
    bayu0 + 1,
    "penerima tetap dikabari seperti sebelumnya",
  );

  // Pemberi yang mengubah sendiri tidak mengabari dirinya.
  const dewi1 = (await notifikasi(DEWI, "Tiket diubah oleh%")).length;
  await sebagai(db, DEWI, `update tasks set deskripsi = 'Disunting pemberi' where id = $1`, [tid]);
  harusSama(
    (await notifikasi(DEWI, "Tiket diubah oleh%")).length,
    dewi1,
    "pemberi tidak dikabari atas suntingannya sendiri",
  );
});

uji("pemberi Manager sendiri: tidak mengabari dirinya, penerima tetap dikabari", async () => {
  const tid = await buatTiket({ judul: "Tiket Manager sendiri", pembuat: MANAGER });
  const m0 = (await notifikasi(MANAGER, "Tiket diubah oleh%")).length;
  const r0 = (await notifikasi(RIAN, "Tiket diubah:%")).length;
  await sebagai(db, MANAGER, `update tasks set judul = 'Judul baru Manager' where id = $1`, [tid]);
  harusSama((await notifikasi(MANAGER, "Tiket diubah oleh%")).length, m0, "Manager tidak dikabari");
  harusSama((await notifikasi(RIAN, "Tiket diubah:%")).length, r0 + 1, "Rian dikabari");
});

uji("proses sistem tidak mengabari siapa pun", async () => {
  const tid = await buatTiket({ judul: "Tiket perapian sistem" });
  const d0 = (await notifikasi(DEWI, "Tiket diubah oleh%")).length;
  await sebagaiAdmin(db, `update tasks set deskripsi = 'Dirapikan sistem' where id = $1`, [tid]);
  harusSama((await notifikasi(DEWI, "Tiket diubah oleh%")).length, d0, "tanpa kabar");
});

uji("migrasi 0205 aman dijalankan ulang", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "supabase", "migrations", "0205_edit_tiket_ceo_manager.sql"),
    "utf8",
  );
  await sebagaiAdmin(db, sql);
  await sebagaiAdmin(db, sql);
  const tid = await buatTiket({ judul: "Setelah migrasi diulang" });
  const { rows } = await sebagai(
    db,
    MANAGER,
    `update tasks set judul = 'Masih berfungsi' where id = $1 returning id`,
    [tid],
  );
  harusSama(rows.length, 1, "masih berfungsi");
});

await jalankan();
