/**
 * Tonggak GRD menjadi tiket (migrasi 0199–0202).
 *
 * Aturan bisnisnya dijaga database, jadi diuji di database — SQL-nya
 * benar-benar dijalankan (PGlite), sebagai pengguna sungguhan dengan RLS
 * aktif. Nomor aturan mengikuti brief fitur:
 *
 *   1  hanya rencana SEKALI & PEKANAN yang jadi tiket
 *   2  satu tonggak = satu tiket, penerima = PIC utama
 *   3  pemberi = atasan langsung; tanpa atasan = Manager
 *   4  isi tiket: tipe, goal, judul, tenggat 17.00 WIB, kriteria selesai
 *   5  tanpa tenggat / tanpa PIC tidak dibuatkan tiket
 *   6  status tiket → tonggak; tepat waktu dari saat DIAJUKAN
 *   7  tonggak yang punya tiket tidak bisa diubah manual
 *   8  tenggat tiket GRD hanya CEO/Manager; tenggat lampau tidak digeser
 *   9  tonggak selesai tidak dibuatkan tiket; progress → berjalan
 *   10 aman diulang; berjalan otomatis lewat impor_grd
 *   11 bulan KPI terkunci tidak disentuh
 *   12 tidak ada notifikasi massal
 *
 * Tanggal tonggak dibuat di tahun yang jauh (2090-an = belum jatuh tempo,
 * 2000-an = sudah lewat) supaya hasilnya tidak bergantung pada hari tes
 * dijalankan.
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
import { susunLaporanTiketGrd } from "../../src/lib/tiket-grd.ts";

const db = await buatDb();
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Tonggak GRD menjadi tiket (0199–0202)");

const satu = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows[0];
const semua = async (sql, params = []) =>
  (await sebagaiAdmin(db, sql, params)).rows;
const id = async (nama) =>
  (await satu("select id from users where nama = $1", [nama])).id;

const HAFIDZ = await id("Hafidz Alkahfi"); // CEO, tanpa atasan
const FARHAN = await id("Farhan Pratama"); // Manager, atasan: Hafidz
const DEWI = await id("Dewi Lestari"); // Leader, atasan: Farhan
const RIAN = await id("Rian Hidayat"); // Staff, atasan: Dewi
const NABILA = await id("Nabila Putri"); // Staff, atasan: Dewi
const BAYU = await id("Bayu Nugraha"); // Staff, atasan: Dewi
const ANISA = await id("Anisa Larasati");
const GOAL = await satu("select id, judul from goals limit 1");

// ---------------------------------------------------------------------
// Penolong
// ---------------------------------------------------------------------
let nomor = 0;
/** Bulan yang belum jatuh tempo (2090-an); tiap panggilan bulan baru. */
const periodeDepan = () => {
  nomor += 1;
  const tahun = 2090 + Math.floor((nomor - 1) / 12);
  return `${tahun}-${String(((nomor - 1) % 12) + 1).padStart(2, "0")}-01`;
};
/** Bulan yang sudah lewat (2000-an). */
const periodeLalu = () => {
  nomor += 1;
  const tahun = 2000 + Math.floor((nomor - 1) / 12);
  return `${tahun}-${String(((nomor - 1) % 12) + 1).padStart(2, "0")}-01`;
};
const hari = (periode, d) => `${periode.slice(0, 8)}${String(d).padStart(2, "0")}`;

async function rencana(
  periode,
  {
    kode,
    judul = `Rencana ${kode}`,
    jenis = "sekali",
    pic = [RIAN],
    picTeks = "Rian",
    jadwal = "",
    goalId = null,
    tonggak,
  },
) {
  const r = await satu(
    `insert into grd_rencana
       (grd_periode, kode, goal_id, induk_kode, judul, jenis, pic_ids,
        pic_teks, jadwal_teks, urutan)
     values ($1, $2, $3, '1', $4, $5, $6::uuid[], $7, $8, 1)
     returning id`,
    [periode, kode, goalId, judul, jenis, `{${pic.join(",")}}`, picTeks, jadwal],
  );
  const ids = [];
  for (const [i, t] of tonggak.entries()) {
    const x = await satu(
      `insert into grd_tonggak (rencana_id, kunci, judul, tenggat, status, urutan)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [
        r.id,
        t.kunci ?? String(i),
        t.judul ?? judul,
        t.tenggat ?? null,
        t.status ?? "belum",
        i + 1,
      ],
    );
    ids.push(x.id);
  }
  return { id: r.id, tonggak: ids };
}

const buat = async (periode, uji = false) =>
  (await satu("select buat_tiket_grd($1::date, $2) r", [periode, uji])).r;
const tiket = async (tonggakId) =>
  satu("select * from tasks where tonggak_id = $1", [tonggakId]);
const tonggak = async (tonggakId) =>
  satu(
    `select status, selesai_pada,
            to_char(tenggat, 'YYYY-MM-DD') as tenggat
     from grd_tonggak where id = $1`,
    [tonggakId],
  );
const jumlahTugas = async () =>
  Number((await satu("select count(*) n from tasks")).n);
const notifikasi = async (userId, pola) =>
  (
    await semua(
      `select judul, pesan from notifications
       where user_id = $1 and judul like $2 order by created_at`,
      [userId, pola],
    )
  );

/** Pesan galat dari pernyataan yang SEHARUSNYA ditolak. */
async function pesanTolak(fn, ket) {
  try {
    await fn();
  } catch (e) {
    return pesanDb(e);
  }
  throw new Error(`seharusnya ditolak: ${ket}`);
}

// ---------------------------------------------------------------------
// Aturan 1 · 2 · 4 · 9
// ---------------------------------------------------------------------
uji("aturan 1: hanya SEKALI & PEKANAN yang jadi tiket, HARIAN tidak", async () => {
  const p = periodeDepan();
  const a = await rencana(p, {
    kode: "A.1",
    jenis: "sekali",
    tonggak: [{ tenggat: hari(p, 5) }],
  });
  const b = await rencana(p, {
    kode: "A.2",
    jenis: "pekanan",
    pic: [NABILA],
    picTeks: "Nabila",
    tonggak: [
      { tenggat: hari(p, 6), kunci: hari(p, 6), judul: "Senin, 6" },
      { tenggat: hari(p, 13), kunci: hari(p, 13), judul: "Senin, 13" },
      { tenggat: hari(p, 20), kunci: hari(p, 20), judul: "Senin, 20" },
    ],
  });
  // Tonggak pada rencana harian (tidak lazim, tapi mungkin lewat data
  // manual): tetap tidak boleh jadi tiket.
  const h = await rencana(p, {
    kode: "A.3",
    jenis: "harian",
    tonggak: [{ tenggat: hari(p, 7) }],
  });

  const r = await buat(p);
  harusSama(r.dibuat, 4, "1 sekali + 3 pekanan");
  harusSama(r.rencana_harian, 1, "rencana harian dihitung terpisah");
  harus((await tiket(h.tonggak[0])) === undefined, "harian tidak punya tiket");
  for (const t of [...a.tonggak, ...b.tonggak]) {
    harus((await tiket(t)) !== undefined, "tonggak sekali/pekanan bertiket");
  }
});

uji("aturan 2: satu tonggak = satu tiket; penerima = PIC utama, PIC lain di deskripsi", async () => {
  const p = periodeDepan();
  const r = await rencana(p, {
    kode: "B.1",
    pic: [RIAN, NABILA, BAYU],
    picTeks: "Rian + Nabila + Bayu",
    jenis: "pekanan",
    tonggak: [
      { tenggat: hari(p, 6), judul: "Senin, 6" },
      { tenggat: hari(p, 13), judul: "Senin, 13" },
    ],
  });
  await buat(p);
  const dua = await semua(
    "select penerima_id, deskripsi, tonggak_id from tasks where tonggak_id = any ($1::uuid[])",
    [`{${r.tonggak.join(",")}}`],
  );
  harusSama(dua.length, 2, "dua tonggak, dua tiket");
  harusSama(new Set(dua.map((x) => x.tonggak_id)).size, 2, "tiap tonggak tiketnya sendiri");
  for (const t of dua) {
    harusSama(t.penerima_id, RIAN, "penerima = PIC utama");
    harus(
      t.deskripsi.includes("PIC lain: Nabila Putri, Bayu Nugraha"),
      `PIC lain tertulis di deskripsi: ${t.deskripsi}`,
    );
  }
});

uji("aturan 3: pemberi = atasan langsung; tanpa atasan = Manager; Manager sendiri = CEO", async () => {
  const p = periodeDepan();
  const kasus = [
    ["staf → atasannya (Leader)", RIAN, DEWI],
    ["Leader → atasannya (Manager)", DEWI, FARHAN],
    ["Manager → atasannya (CEO)", FARHAN, HAFIDZ],
    ["CEO tanpa atasan → Manager", HAFIDZ, FARHAN],
  ];
  const peta = [];
  for (const [i, [nama, penerima, pemberi]] of kasus.entries()) {
    const r = await rencana(p, {
      kode: `C.${i}`,
      pic: [penerima],
      tonggak: [{ tenggat: hari(p, 5 + i) }],
    });
    peta.push({ nama, tonggak: r.tonggak[0], pemberi, penerima });
  }

  // Staf tanpa atasan sama sekali → Manager.
  await sebagaiAdmin(db, "update users set atasan_id = null where id = $1", [ANISA]);
  const tanpa = await rencana(p, {
    kode: "C.9",
    pic: [ANISA],
    tonggak: [{ tenggat: hari(p, 20) }],
  });
  peta.push({
    nama: "staf tanpa atasan → Manager",
    tonggak: tanpa.tonggak[0],
    pemberi: FARHAN,
    penerima: ANISA,
  });

  await buat(p);
  for (const k of peta) {
    const t = await tiket(k.tonggak);
    harusSama(t.penerima_id, k.penerima, `penerima: ${k.nama}`);
    harusSama(t.pembuat_id, k.pemberi, `pemberi: ${k.nama}`);
  }
});

uji("aturan 3: atasan yang dinonaktifkan → bawahannya tak beratasan → pemberi Manager", async () => {
  // Sistem mengosongkan atasan bawahan saat atasannya dinonaktifkan; yang
  // dipakai tiket GRD adalah keadaan itu, bukan atasan yang sudah pergi.
  const galih = await id("Galih Prakoso"); // Leader MCN
  const fajar = await id("Fajar Ramadhan"); // staf di bawah Galih
  const p = periodeDepan();
  await sebagaiAdmin(db, "update users set status = 'nonaktif' where id = $1", [galih]);
  const r = await rencana(p, {
    kode: "C.7",
    pic: [fajar],
    tonggak: [{ tenggat: hari(p, 5) }],
  });
  await buat(p);
  await sebagaiAdmin(db, "update users set status = 'aktif' where id = $1", [galih]);
  harusSama((await tiket(r.tonggak[0])).pembuat_id, FARHAN, "pemberi Manager");
});

uji("aturan 4: isi tiket — tipe, goal, judul, tenggat 17.00 WIB, kriteria selesai", async () => {
  const p = periodeDepan();
  const tunggal = await rencana(p, {
    kode: "D.1",
    judul: "Host LIVE sudah didapat",
    goalId: GOAL.id,
    jadwal: "Sabtu 3 Okt",
    tonggak: [{ tenggat: hari(p, 3) }],
  });
  const pekanan = await rencana(p, {
    kode: "D.2",
    judul: "Membagikan Daftar Produk Laris ke semua akun",
    jenis: "pekanan",
    tonggak: [{ tenggat: hari(p, 5), judul: "Senin, 5 Okt" }],
  });
  const tahap = await rencana(p, {
    kode: "D.3",
    judul: "Dokumen SOP ditulis: SOP Komisi (1 Okt), SOP Studio (10 Okt)",
    tonggak: [
      { tenggat: hari(p, 1), kunci: "a", judul: "SOP Komisi" },
      { tenggat: hari(p, 10), kunci: "b", judul: "SOP Studio" },
    ],
  });
  await buat(p);

  const t1 = await tiket(tunggal.tonggak[0]);
  harusSama(t1.tipe, "tiket", "tipe");
  harusSama(t1.goal_id, GOAL.id, "goal dari rencananya");
  harusSama(t1.judul, "D.1 · Host LIVE sudah didapat", "judul tonggak = judul rencana");
  harusSama(t1.tanpa_jam, false, "tiket wajib berjam");
  harusSama(t1.prioritas, "sedang", "prioritas bawaan");
  harusSama(t1.status, "todo", "tonggak belum → todo");
  harus(t1.konteks.startsWith("GRD "), `konteks menandai GRD: ${t1.konteks}`);
  harus(t1.deskripsi.includes("Jadwal: Sabtu 3 Okt"), "jadwal di deskripsi");
  const jam = await satu(
    "select to_char(tenggat at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') j from tasks where id = $1",
    [t1.id],
  );
  harusSama(jam.j, `${hari(p, 3)} 17:00`, "tenggat = tenggat tonggak pukul 17.00 WIB");
  harus(
    /^"Host LIVE sudah didapat" selesai dan hasilnya bisa ditunjukkan ke pemeriksa\. Diajukan paling lambat \w+, 3 \w+ \d{4} pukul 17\.00 WIB\.$/.test(
      t1.kriteria_selesai,
    ),
    `kriteria selesai: ${t1.kriteria_selesai}`,
  );
  harus(t1.kriteria_selesai.length >= 5, "kriteria memenuhi syarat 0183");

  // Tonggak pekanan hanya bertanggal: judul rencana ikut ditulis.
  const t2 = await tiket(pekanan.tonggak[0]);
  harusSama(
    t2.judul,
    "D.2 · Membagikan Daftar Produk Laris ke semua akun — Senin, 5 Okt",
    "judul pekanan memuat judul rencana + tonggak",
  );

  // Tahap yang diambil dari rumusan rencana cukup berdiri sendiri.
  const t3 = await tiket(tahap.tonggak[0]);
  harusSama(t3.judul, "D.3 · SOP Komisi", "tahap berdiri sendiri");
});

uji("tanggal_indonesia & judul tiket memenuhi batas 200 huruf", async () => {
  const tgl = await satu(
    "select tanggal_indonesia('2026-10-03') a, bulan_indonesia('2026-10-01', true) b, bulan_indonesia('2026-10-01') c",
  );
  harusSama(tgl.a, "Sabtu, 3 Okt 2026", "hari & bulan Indonesia");
  harusSama(tgl.b, "Oktober 2026", "bulan panjang");
  harusSama(tgl.c, "Okt 2026", "bulan pendek");

  const panjang = "Rencana yang sangat panjang ".repeat(20);
  const j = await satu("select judul_tiket_grd('S.2.3.3', $1, 'Senin, 5 Okt') j", [panjang]);
  harus(j.j.length <= 200, `judul ≤ 200: ${j.j.length}`);
  harus(j.j.endsWith("— Senin, 5 Okt"), "judul tonggak tidak terpotong");
  harus(j.j.startsWith("S.2.3.3 · "), "kode rencana di depan");

  // Dan benar-benar bisa disimpan sebagai tugas.
  const p = periodeDepan();
  const r = await rencana(p, {
    kode: "E.1",
    judul: panjang,
    jenis: "pekanan",
    tonggak: [{ tenggat: hari(p, 5), judul: "Senin, 5 Okt" }],
  });
  await buat(p);
  harus((await tiket(r.tonggak[0])) !== undefined, "judul panjang tetap jadi tiket");
});

uji("aturan 9: yang selesai dilewati; progress → berjalan; belum → todo", async () => {
  const p = periodeDepan();
  const r = await rencana(p, {
    kode: "F.1",
    jenis: "pekanan",
    tonggak: [
      { tenggat: hari(p, 5), status: "selesai", judul: "sudah" },
      { tenggat: hari(p, 6), status: "progress", judul: "jalan" },
      { tenggat: hari(p, 7), status: "belum", judul: "belum" },
    ],
  });
  const lap = await buat(p);
  harusSama(lap.dibuat, 2, "dua tiket");
  harusSama(lap.alasan_dilewati.sudah_selesai, 1, "satu dilewati karena sudah selesai");
  harus((await tiket(r.tonggak[0])) === undefined, "tonggak selesai tanpa tiket");
  harusSama((await tiket(r.tonggak[1])).status, "berjalan", "progress → berjalan");
  harusSama((await tiket(r.tonggak[2])).status, "todo", "belum → todo");
});

// ---------------------------------------------------------------------
// Aturan 5
// ---------------------------------------------------------------------
uji("aturan 5: tanpa tenggat, tanpa PIC, atau PIC nonaktif tidak dibuatkan tiket", async () => {
  const p = periodeDepan();
  const tanpaTenggat = await rencana(p, {
    kode: "G.1",
    tonggak: [{ tenggat: null }],
  });
  const tanpaPic = await rencana(p, {
    kode: "G.2",
    pic: [],
    picTeks: "Seluruh tim",
    tonggak: [{ tenggat: hari(p, 5) }],
  });
  await sebagaiAdmin(db, "update users set status = 'nonaktif' where id = $1", [BAYU]);
  const nonaktif = await rencana(p, {
    kode: "G.3",
    pic: [BAYU],
    picTeks: "Bayu",
    tonggak: [{ tenggat: hari(p, 6) }],
  });
  const normal = await rencana(p, {
    kode: "G.4",
    tonggak: [{ tenggat: hari(p, 7) }],
  });

  const sebelum = await jumlahTugas();
  const lap = await buat(p, true);
  harusSama(await jumlahTugas(), sebelum, "uji tidak menulis apa pun");
  harusSama(lap.dibuat, 1, "hanya satu yang layak");

  const alasan = Object.fromEntries(lap.dilewati.map((d) => [d.kode, d.alasan]));
  harusSama(alasan["G.1"], "tanpa_tenggat", "alasan G.1");
  harusSama(alasan["G.2"], "tanpa_pic", "alasan G.2");
  harusSama(alasan["G.3"], "penerima_nonaktif", "alasan G.3");

  await buat(p);
  await sebagaiAdmin(db, "update users set status = 'aktif' where id = $1", [BAYU]);
  for (const t of [tanpaTenggat, tanpaPic, nonaktif]) {
    harus((await tiket(t.tonggak[0])) === undefined, "tidak dibuatkan tiket");
  }
  harus((await tiket(normal.tonggak[0])) !== undefined, "yang layak dibuatkan");
});

uji("aturan 8: tenggat tonggak yang sudah lewat TIDAK digeser", async () => {
  const p = periodeLalu();
  const r = await rencana(p, {
    kode: "H.1",
    tonggak: [{ tenggat: hari(p, 4) }],
  });
  const lap = await buat(p);
  harusSama(lap.sudah_lewat_tenggat, 1, "dilaporkan: langsung lewat tenggat");
  const t = await satu(
    "select to_char(tenggat at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') j, status from tasks where tonggak_id = $1",
    [r.tonggak[0]],
  );
  harusSama(t.j, `${hari(p, 4)} 17:00`, "tenggat apa adanya, walau sudah lewat");
  harusSama(t.status, "todo", "tetap tiket baru");
});

// ---------------------------------------------------------------------
// Aturan 10
// ---------------------------------------------------------------------
uji("aturan 10: pembuatan diulang tidak pernah dobel", async () => {
  const p = periodeDepan();
  const r = await rencana(p, {
    kode: "I.1",
    jenis: "pekanan",
    tonggak: [
      { tenggat: hari(p, 6), judul: "tahap a" },
      { tenggat: hari(p, 13), judul: "tahap b" },
    ],
  });
  const pertama = await buat(p);
  harusSama(pertama.dibuat, 2, "pertama membuat dua");
  const sebelum = await jumlahTugas();
  const kedua = await buat(p);
  harusSama(kedua.dibuat, 0, "kedua tidak membuat apa-apa");
  harusSama(kedua.sudah_ada, 2, "dua sudah bertiket");
  harusSama(await jumlahTugas(), sebelum, "jumlah tugas tidak bertambah");

  // Lewat jalan pintas pun tidak bisa: kuncinya di database.
  await harusDitolak(
    () =>
      sebagaiAdmin(
        db,
        `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat, kriteria_selesai, tonggak_id)
         values ('tiket', 'kembar', $1, $2, now(), 'selesai', $3)`,
        [DEWI, RIAN, r.tonggak[0]],
      ),
    "tiket kembar untuk satu tonggak harus ditolak",
  );
});

/** Rencana impor minimal: hanya bagian `rencana`. */
const berkasImpor = (periode, daftar) => ({
  periode,
  rencana: daftar.map((r, i) => ({
    kode: r.kode,
    goal: null,
    induk_kode: "1",
    judul: r.judul ?? `Rencana ${r.kode}`,
    jenis: r.jenis ?? "sekali",
    pic_ids: r.pic ?? [RIAN],
    pic_teks: r.picTeks ?? "Rian",
    jadwal_teks: "",
    urutan: i + 1,
    asal: "uji",
    tonggak: r.tonggak,
  })),
});
const impor = async (berkas, ujiCoba = false) =>
  (
    await satu("select impor_grd($1::jsonb, $2) r", [
      JSON.stringify(berkas),
      ujiCoba,
    ])
  ).r;

uji("aturan 10: impor_grd membuat tiketnya otomatis, dan diulang tidak dobel", async () => {
  const p = periodeDepan();
  const berkas = berkasImpor(p, [
    { kode: "J.1", tonggak: [{ kunci: "", judul: "Satu", tenggat: hari(p, 5), urutan: 1 }] },
    {
      kode: "J.2",
      jenis: "pekanan",
      pic: [NABILA],
      tonggak: [
        { kunci: hari(p, 6), judul: "Senin, 6", tenggat: hari(p, 6), urutan: 1 },
        { kunci: hari(p, 13), judul: "Senin, 13", tenggat: hari(p, 13), urutan: 2 },
      ],
    },
    { kode: "J.3", jenis: "harian", tonggak: [] },
  ]);

  const r1 = await impor(berkas);
  harusSama(r1.tiket_grd.dibuat, 3, "impor membuat tiket untuk 3 tonggak");
  const jumlah = Number(
    (
      await satu(
        `select count(*) n from tasks t join grd_tonggak g on g.id = t.tonggak_id
         join grd_rencana r on r.id = g.rencana_id where r.grd_periode = $1`,
        [p],
      )
    ).n,
  );
  harusSama(jumlah, 3, "tiga tiket tersimpan");

  const r2 = await impor(berkas);
  harusSama(r2.tiket_grd.dibuat, 0, "impor ulang tidak membuat lagi");
  const sesudah = Number(
    (
      await satu(
        `select count(*) n from tasks t join grd_tonggak g on g.id = t.tonggak_id
         join grd_rencana r on r.id = g.rencana_id where r.grd_periode = $1`,
        [p],
      )
    ).n,
  );
  harusSama(sesudah, 3, "tetap tiga tiket");
});

uji("impor_grd uji coba melaporkan tiketnya lalu membatalkan semuanya", async () => {
  const p = periodeDepan();
  const berkas = berkasImpor(p, [
    { kode: "K.1", tonggak: [{ kunci: "", judul: "Satu", tenggat: hari(p, 5), urutan: 1 }] },
    { kode: "K.2", pic: [], picTeks: "Seluruh tim", tonggak: [{ kunci: "", judul: "Dua", tenggat: hari(p, 6), urutan: 1 }] },
  ]);
  const sebelum = await jumlahTugas();
  const pesan = await pesanTolak(() => impor(berkas, true), "uji coba selalu membatalkan");
  const m = /UJI_COBA:(.*)$/s.exec(pesan);
  harus(m, `pesan uji coba: ${pesan}`);
  const ringkas = JSON.parse(m[1]);
  harusSama(ringkas.tiket_grd.dibuat, 1, "laporan: satu tiket akan dibuat");
  harusSama(ringkas.tiket_grd.alasan_dilewati.tanpa_pic, 1, "laporan: satu tanpa PIC");
  harusSama(await jumlahTugas(), sebelum, "tidak ada tiket yang tersimpan");
  harusSama(
    Number((await satu("select count(*) n from grd_rencana where grd_periode = $1", [p])).n),
    0,
    "rencananya pun dibatalkan",
  );
});

uji("impor: judul tonggak berganti → judul tiket ikut, status tiket dipertahankan", async () => {
  const p = periodeDepan();
  const awal = berkasImpor(p, [
    { kode: "L.1", tonggak: [{ kunci: "", judul: "Judul lama", tenggat: hari(p, 5), urutan: 1 }] },
  ]);
  await impor(awal);
  const t0 = await satu(
    `select t.id, g.id as tonggak_id from tasks t join grd_tonggak g on g.id = t.tonggak_id
     join grd_rencana r on r.id = g.rencana_id where r.grd_periode = $1`,
    [p],
  );
  await sebagai(db, RIAN, "update tasks set status = 'berjalan' where id = $1", [t0.id]);

  const baru = berkasImpor(p, [
    { kode: "L.1", tonggak: [{ kunci: "", judul: "Judul baru", tenggat: hari(p, 8), urutan: 1 }] },
  ]);
  await impor(baru);

  const t = await satu(
    `select t.judul, t.status, to_char(t.tenggat at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') j
     from tasks t where t.id = $1`,
    [t0.id],
  );
  harusSama(t.judul, "L.1 · Rencana L.1 — Judul baru", "judul tiket ikut");
  harusSama(t.status, "berjalan", "status tiket dipertahankan");
  harusSama(t.j, `${hari(p, 8)} 17:00`, "tenggat tiket ikut tonggak, jam tetap 17.00");
  harusSama((await tonggak(t0.tonggak_id)).status, "progress", "status tonggak tidak direset");
  const n = await notifikasi(RIAN, "Tenggat tiket berubah:%");
  harus(n.length >= 1, "penerima dikabari tenggatnya berpindah");
});

// ---------------------------------------------------------------------
// Aturan 6
// ---------------------------------------------------------------------
uji("aturan 6: status tiket mengalir ke tonggak sampai selesai (QC lolos)", async () => {
  const p = periodeDepan();
  const r = await rencana(p, { kode: "M.1", tonggak: [{ tenggat: hari(p, 9) }] });
  await buat(p);
  const t = await tiket(r.tonggak[0]);
  harusSama(t.pembuat_id, DEWI, `pemberi = atasan staf (Dewi), bukan ${t.pembuat_id}`);
  harusSama((await tonggak(r.tonggak[0])).status, "belum", "awal: belum");

  await sebagai(db, RIAN, "update tasks set status = 'berjalan' where id = $1", [t.id]);
  harusSama((await tonggak(r.tonggak[0])).status, "progress", "berjalan → progress");

  await sebagai(
    db,
    RIAN,
    "update tasks set status = 'menunggu_qc', hasil_kerja = 'sudah beres semua' where id = $1",
    [t.id],
  );
  harusSama((await tonggak(r.tonggak[0])).status, "progress", "menunggu_qc → progress");

  await sebagai(
    db,
    DEWI,
    "update tasks set qc_status = 'revisi', qc_note = 'perbaiki lagi' where id = $1",
    [t.id],
  );
  harusSama((await satu("select status from tasks where id = $1", [t.id])).status, "revisi", "QC minta revisi");
  harusSama((await tonggak(r.tonggak[0])).status, "progress", "revisi → progress");

  await sebagai(
    db,
    RIAN,
    "update tasks set status = 'menunggu_qc', hasil_kerja = 'sudah diperbaiki' where id = $1",
    [t.id],
  );
  const diajukan = (await satu("select diajukan_pada from tasks where id = $1", [t.id])).diajukan_pada;
  harus(diajukan, "diajukan_pada terisi");

  await sebagai(db, DEWI, "update tasks set qc_status = 'lolos' where id = $1", [t.id]);
  const akhir = await satu(
    "select status, selesai_at, diajukan_pada from tasks where id = $1",
    [t.id],
  );
  harusSama(akhir.status, "selesai", "tiket selesai setelah QC lolos");
  const tg = await tonggak(r.tonggak[0]);
  harusSama(tg.status, "selesai", "QC lolos → tonggak selesai");
  harusSama(
    new Date(tg.selesai_pada).getTime(),
    new Date(akhir.diajukan_pada).getTime(),
    "waktu selesai tonggak = saat DIAJUKAN, bukan saat QC meluluskan",
  );
  harus(
    new Date(akhir.diajukan_pada).getTime() <= new Date(akhir.selesai_at).getTime(),
    "pengajuan tidak lebih lambat dari QC",
  );

  // Jalan balik hanya lewat tiket: dibuka lagi → tonggak ikut kembali.
  await sebagaiAdmin(db, "update tasks set status = 'berjalan' where id = $1", [t.id]);
  const buka = await tonggak(r.tonggak[0]);
  harusSama(buka.status, "progress", "tiket dibuka lagi → tonggak progress");
  harusSama(buka.selesai_pada, null, "waktu selesai dikosongkan");
});

uji("aturan 6: tonggak kembali ke belum bila tiket kembali ke todo", async () => {
  const p = periodeDepan();
  const r = await rencana(p, { kode: "M.2", tonggak: [{ tenggat: hari(p, 9) }] });
  await buat(p);
  const t = await tiket(r.tonggak[0]);
  await sebagai(db, RIAN, "update tasks set status = 'berjalan' where id = $1", [t.id]);
  await sebagai(db, RIAN, "update tasks set status = 'todo' where id = $1", [t.id]);
  harusSama((await tonggak(r.tonggak[0])).status, "belum", "todo → belum");
});

uji("aturan 6: tepat waktu dihitung dari saat DIAJUKAN, bukan saat QC meluluskan", async () => {
  const p = periodeLalu();
  const r = await rencana(p, {
    kode: "N.1",
    jenis: "pekanan",
    tonggak: [
      { tenggat: hari(p, 10), judul: "tepat" },
      { tenggat: hari(p, 10), judul: "terlambat", kunci: "x" },
    ],
  });
  await buat(p);
  const [tepat, terlambat] = [await tiket(r.tonggak[0]), await tiket(r.tonggak[1])];

  for (const t of [tepat, terlambat]) {
    await sebagai(
      db,
      RIAN,
      "update tasks set status = 'menunggu_qc', hasil_kerja = 'hasil kerja siap' where id = $1",
      [t.id],
    );
  }
  // Yang pertama DIAJUKAN sebelum tenggat (QC-nya baru sekarang, jauh
  // sesudah tenggat). Waktu pengajuan hanya bisa ditulis trigger, jadi
  // untuk tes dimundurkan lewat jalan admin dengan trigger dimatikan.
  await sebagaiAdmin(db, "alter table tasks disable trigger tasks_b_catat_pengajuan");
  await sebagaiAdmin(
    db,
    "update tasks set diajukan_pada = $2::timestamptz where id = $1",
    [tepat.id, `${hari(p, 10)}T10:00:00+07:00`],
  );
  await sebagaiAdmin(db, "alter table tasks enable trigger tasks_b_catat_pengajuan");

  for (const t of [tepat, terlambat]) {
    await sebagai(db, DEWI, "update tasks set qc_status = 'lolos' where id = $1", [t.id]);
  }

  const hasil = async (kode) =>
    (
      await satu(
        "select tonggak_tepat_waktu($1::date, array[$2]::text[], $3::date) n",
        [p, kode, hari(p, 28)],
      )
    ).n;
  // Kedua tonggak serencana → 1 dari 2 tepat.
  harusSama(Number(await hasil("N.1")), 50, "satu tepat (diajukan sebelum tenggat), satu terlambat");
  const tg = await tonggak(r.tonggak[0]);
  harusSama(
    new Date(tg.selesai_pada).toISOString(),
    new Date(`${hari(p, 10)}T10:00:00+07:00`).toISOString(),
    "waktu selesai = waktu pengajuan, walau QC-nya jauh sesudah tenggat",
  );
});

uji("diajukan_pada tidak bisa dimundurkan pengguna", async () => {
  const p = periodeDepan();
  const r = await rencana(p, { kode: "O.1", tonggak: [{ tenggat: hari(p, 9) }] });
  await buat(p);
  const t = await tiket(r.tonggak[0]);
  await sebagai(
    db,
    RIAN,
    `update tasks set status = 'menunggu_qc', hasil_kerja = 'hasil kerja siap',
                      diajukan_pada = '2000-01-01T00:00:00Z'
     where id = $1`,
    [t.id],
  );
  const d = (await satu("select diajukan_pada from tasks where id = $1", [t.id])).diajukan_pada;
  harus(new Date(d).getFullYear() >= 2024, `isian pengguna diabaikan: ${d}`);

  await sebagai(db, RIAN, "update tasks set diajukan_pada = '2000-01-01T00:00:00Z' where id = $1", [t.id]);
  const lagi = (await satu("select diajukan_pada from tasks where id = $1", [t.id])).diajukan_pada;
  harusSama(new Date(lagi).getTime(), new Date(d).getTime(), "tidak berubah");
});

// ---------------------------------------------------------------------
// Aturan 7
// ---------------------------------------------------------------------
uji("aturan 7: tonggak yang punya tiket tidak bisa diubah manual; tanpa tiket tetap bisa", async () => {
  const p = periodeDepan();
  const r = await rencana(p, {
    kode: "P.1",
    tonggak: [{ tenggat: hari(p, 9) }],
  });
  const tanpa = await rencana(p, {
    kode: "P.2",
    tonggak: [{ tenggat: null }],
  });
  await buat(p);

  for (const [nama, siapa] of [["PIC", RIAN], ["Manager", FARHAN], ["CEO", HAFIDZ]]) {
    const pesan = await pesanTolak(
      () => sebagai(db, siapa, "select ubah_status_tonggak($1, 'selesai')", [r.tonggak[0]]),
      `${nama} mencentang tonggak ber-tiket`,
    );
    harus(pesan.includes("mengikuti tiketnya"), `pesan jelas untuk ${nama}: ${pesan}`);
  }
  await pesanTolak(
    () => sebagai(db, FARHAN, "update grd_tonggak set status = 'progress' where id = $1", [r.tonggak[0]]),
    "update langsung",
  );
  harusSama((await tonggak(r.tonggak[0])).status, "belum", "status tidak berubah");

  // Tonggak tanpa tiket: perilaku lama.
  await sebagai(db, RIAN, "select ubah_status_tonggak($1, 'selesai')", [tanpa.tonggak[0]]);
  harusSama((await tonggak(tanpa.tonggak[0])).status, "selesai", "tanpa tiket tetap bisa dicentang PIC");

  // Tiket dibatalkan → tonggak kembali ke pengelolaan manual.
  await sebagaiAdmin(db, "update tasks set status = 'dibatalkan' where tonggak_id = $1", [r.tonggak[0]]);
  harusSama((await tonggak(r.tonggak[0])).status, "belum", "tiket dibatalkan tidak mengubah tonggak");
  await sebagai(db, RIAN, "select ubah_status_tonggak($1, 'progress')", [r.tonggak[0]]);
  harusSama((await tonggak(r.tonggak[0])).status, "progress", "tiket dibatalkan → tonggak boleh diubah manual");
  const ulang = await buat(p);
  harusSama(ulang.dibuat, 0, "tidak dibuatkan tiket baru untuk tonggak yang tiketnya dibatalkan");
});

uji("rencana_grd membawa punya_tiket & tiket_id sesuai hak lihat", async () => {
  const p = periodeDepan();
  const r = await rencana(p, { kode: "Q.1", tonggak: [{ tenggat: hari(p, 9) }] });
  await rencana(p, { kode: "Q.2", tonggak: [{ tenggat: null }] });
  await buat(p);
  const t = await tiket(r.tonggak[0]);

  const baca = async (siapa) =>
    (
      await sebagai(db, siapa, "select tonggak from rencana_grd($1::date) where kode = 'Q.1'", [p])
    ).rows[0].tonggak[0];
  const pic = await baca(RIAN);
  harusSama(pic.punya_tiket, true, "PIC tahu tonggaknya bertiket");
  harusSama(pic.tiket_id, t.id, "PIC bisa membuka tiketnya");
  const manager = await baca(FARHAN);
  harusSama(manager.tiket_id, t.id, "Manager bisa membuka tiketnya");

  const tanpa = (
    await sebagai(db, RIAN, "select tonggak from rencana_grd($1::date) where kode = 'Q.2'", [p])
  ).rows[0].tonggak[0];
  harusSama(tanpa.punya_tiket, false, "tonggak tanpa tiket");
  harusSama(tanpa.tiket_id, null, "tanpa tautan");
});

// ---------------------------------------------------------------------
// Aturan 8
// ---------------------------------------------------------------------
uji("aturan 8: tenggat tiket GRD hanya CEO/Manager, dan ikut mengubah tonggaknya", async () => {
  const p = periodeDepan();
  const r = await rencana(p, { kode: "R.1", tonggak: [{ tenggat: hari(p, 9) }] });
  await buat(p);
  const t = await tiket(r.tonggak[0]);
  const geser = `update tasks set tenggat = $2::timestamptz where id = $1`;
  const baru = `${hari(p, 12)}T15:00:00+07:00`;

  // Pemberi tiket (Leader) dan penerima: tidak boleh.
  for (const [nama, siapa] of [["pemberi (Leader)", DEWI], ["penerima", RIAN]]) {
    const pesan = await pesanTolak(
      () => sebagai(db, siapa, geser, [t.id, baru]),
      `${nama} menggeser tenggat`,
    );
    harus(pesan.includes("CEO atau Manager"), `pesan jelas untuk ${nama}: ${pesan}`);
  }
  // Manager yang BUKAN pemberi tiket: boleh, tapi hanya tenggatnya.
  await sebagai(db, FARHAN, geser, [t.id, baru]);
  const sesudah = await satu(
    "select to_char(tenggat at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') j from tasks where id = $1",
    [t.id],
  );
  harusSama(sesudah.j, `${hari(p, 12)} 15:00`, "tenggat tiket berubah");
  harusSama((await tonggak(r.tonggak[0])).tenggat, hari(p, 12), "tenggat tonggak ikut berubah");
  await pesanTolak(
    () => sebagai(db, FARHAN, "update tasks set judul = 'diganti Manager' where id = $1", [t.id]),
    "Manager mengubah judul tiket orang lain",
  );
  // CEO juga boleh.
  await sebagai(db, HAFIDZ, geser, [t.id, `${hari(p, 14)}T17:00:00+07:00`]);
  harusSama((await tonggak(r.tonggak[0])).tenggat, hari(p, 14), "CEO pun boleh");

  // Pemberi tiket yang kebetulan Manager (tanpa atasan lain) juga boleh.
  // Tiket yang sudah selesai tidak digeser siapa pun.
  await sebagaiAdmin(db, "update tasks set status = 'selesai' where id = $1", [t.id]);
  await pesanTolak(
    () => sebagai(db, FARHAN, geser, [t.id, baru]),
    "tiket selesai tidak digeser",
  );
});

uji("aturan 8: tenggat tonggak diubah CEO/Manager membawa tiketnya dan mengabari penerima", async () => {
  const p = periodeDepan();
  const r = await rencana(p, { kode: "S.1", tonggak: [{ tenggat: hari(p, 9) }] });
  await buat(p);
  const t = await tiket(r.tonggak[0]);
  await sebagai(db, FARHAN, "update grd_tonggak set tenggat = $2 where id = $1", [
    r.tonggak[0],
    hari(p, 18),
  ]);
  const sesudah = await satu(
    "select to_char(tenggat at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI') j from tasks where id = $1",
    [t.id],
  );
  harusSama(sesudah.j, `${hari(p, 18)} 17:00`, "tiket ikut, jam tetap 17.00");
  const n = await notifikasi(RIAN, "Tenggat tiket berubah:%");
  harus(n.length >= 1, "penerima dikabari");

  // Staf tidak bisa menggeser tenggat tonggaknya sendiri (aturan 0192).
  await pesanTolak(
    () => sebagai(db, RIAN, "update grd_tonggak set tenggat = $2 where id = $1", [r.tonggak[0], hari(p, 28)]),
    "PIC menggeser tenggat tonggak",
  );
});

uji("tiket biasa tidak berubah: pemberi boleh menggeser tenggat, Manager lain tidak (D1)", async () => {
  const buatTiket = async () =>
    (
      await satu(
        `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat, kriteria_selesai)
         values ('tiket', 'Tiket biasa', $1, $2, '2099-01-10T17:00:00+07:00', 'beres semua') returning id`,
        [DEWI, RIAN],
      )
    ).id;
  const tid = await buatTiket();
  await sebagai(db, DEWI, "update tasks set tenggat = '2099-01-12T17:00:00+07:00' where id = $1", [tid]);
  await pesanTolak(
    () => sebagai(db, FARHAN, "update tasks set tenggat = '2099-01-13T17:00:00+07:00' where id = $1", [tid]),
    "Manager bukan pemberi pada tiket biasa",
  );
  await pesanTolak(
    () => sebagai(db, RIAN, "update tasks set tenggat = '2099-01-13T17:00:00+07:00' where id = $1", [tid]),
    "penerima tiket biasa",
  );
  // Tiket biasa masih bisa dihapus pemberinya.
  await sebagai(db, DEWI, "delete from tasks where id = $1", [tid]);
});

// ---------------------------------------------------------------------
// Penjagaan tautan & penghapusan
// ---------------------------------------------------------------------
uji("tautan ke tonggak tidak bisa dipalsukan atau diubah pengguna", async () => {
  const p = periodeDepan();
  const r = await rencana(p, { kode: "T.1", tonggak: [{ tenggat: hari(p, 9) }] });
  const bebas = await rencana(p, { kode: "T.2", tonggak: [{ tenggat: hari(p, 10) }] });
  await buat(p);
  await sebagaiAdmin(db, "update tasks set status = 'dibatalkan' where tonggak_id = $1", [bebas.tonggak[0]]);
  await sebagaiAdmin(db, "update tasks set tonggak_id = null where tonggak_id = $1", [bebas.tonggak[0]]);
  const t = await tiket(r.tonggak[0]);

  // Leader membuat tiket sendiri dengan tautan ke tonggak → ditolak.
  const pesan = await pesanTolak(
    () =>
      sebagai(
        db,
        DEWI,
        `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat, kriteria_selesai, tonggak_id)
         values ('tiket', 'palsu', $1, $2, now() + interval '1 day', 'beres semua', $3)`,
        [DEWI, RIAN, bebas.tonggak[0]],
      ),
    "atasan biasa menautkan tiket ke tonggak",
  );
  harus(pesan.includes("CEO atau Manager"), `pesan: ${pesan}`);

  // Melepas atau memindahkan tautan.
  for (const [nama, siapa] of [["penerima", RIAN], ["pemberi", DEWI]]) {
    await pesanTolak(
      () => sebagai(db, siapa, "update tasks set tonggak_id = null where id = $1", [t.id]),
      `${nama} melepas tautan`,
    );
    await pesanTolak(
      () => sebagai(db, siapa, "update tasks set tonggak_id = $2 where id = $1", [t.id, bebas.tonggak[0]]),
      `${nama} memindahkan tautan`,
    );
  }
  harusSama((await satu("select tonggak_id from tasks where id = $1", [t.id])).tonggak_id, r.tonggak[0], "tautan utuh");
});

uji("tiket GRD tidak bisa dihapus dari aplikasi", async () => {
  const p = periodeDepan();
  const r = await rencana(p, { kode: "U.1", tonggak: [{ tenggat: hari(p, 9) }] });
  await buat(p);
  const t = await tiket(r.tonggak[0]);
  for (const [nama, siapa] of [["pemberi", DEWI], ["Manager", FARHAN]]) {
    const pesan = await pesanTolak(
      () => sebagai(db, siapa, "delete from tasks where id = $1", [t.id]),
      `${nama} menghapus tiket GRD`,
    );
    harus(pesan.includes("tidak bisa dihapus"), `pesan jelas: ${pesan}`);
  }
  harus((await tiket(r.tonggak[0])) !== undefined, "tiket masih ada");
});

uji("tonggak dihapus: tiket belum selesai dibatalkan, yang selesai dibiarkan", async () => {
  const p = periodeDepan();
  const r = await rencana(p, {
    kode: "V.1",
    jenis: "pekanan",
    tonggak: [
      { tenggat: hari(p, 6), judul: "belum" },
      { tenggat: hari(p, 13), judul: "selesai" },
    ],
  });
  await buat(p);
  const [t0, t1] = [await tiket(r.tonggak[0]), await tiket(r.tonggak[1])];
  await sebagaiAdmin(db, "update tasks set status = 'selesai' where id = $1", [t1.id]);

  // Dihapus Manager lewat aplikasi (bukan proses sistem).
  await sebagai(db, FARHAN, "delete from grd_tonggak where rencana_id = $1", [r.id]);

  const a = await satu("select status, tonggak_id from tasks where id = $1", [t0.id]);
  harusSama(a.status, "dibatalkan", "tiket belum selesai dibatalkan");
  harusSama(a.tonggak_id, null, "dan dilepas");
  const b = await satu("select status, tonggak_id from tasks where id = $1", [t1.id]);
  harusSama(b.status, "selesai", "tiket selesai dibiarkan");
  harusSama(b.tonggak_id, null, "sebagai arsip tanpa tonggak");
  const n = await notifikasi(RIAN, "Tiket dibatalkan:%");
  harusSama(n.length, 1, "penerima dikabari satu kali (yang selesai tidak)");
});

uji("rencana dihapus (kascade): tiketnya ikut dilepas tanpa menggagalkan penghapusan", async () => {
  const p = periodeDepan();
  const r = await rencana(p, { kode: "W.1", tonggak: [{ tenggat: hari(p, 9) }] });
  await buat(p);
  const t = await tiket(r.tonggak[0]);
  await sebagaiAdmin(db, "delete from grd_rencana where id = $1", [r.id]);
  const a = await satu("select status, tonggak_id from tasks where id = $1", [t.id]);
  harusSama(a.status, "dibatalkan", "tiket dibatalkan");
  harusSama(a.tonggak_id, null, "tautan lepas");
});

// ---------------------------------------------------------------------
// Aturan 11
// ---------------------------------------------------------------------
uji("aturan 11: bulan yang KPI-nya terkunci tidak disentuh", async () => {
  const p = periodeLalu();
  const r = await rencana(p, {
    kode: "X.1",
    jenis: "pekanan",
    tonggak: [{ tenggat: hari(p, 4), judul: "ada" }],
  });
  await buat(p);
  const t = await tiket(r.tonggak[0]);

  await sebagaiAdmin(
    db,
    `insert into kpi_snapshots (user_id, periode_bulan, skor_total, predikat, dikunci_pada)
     values ($1, $2, 0, predikat_dari_skor(0), now())`,
    [RIAN, p],
  );

  // Tonggak baru di bulan terkunci tidak dibuatkan tiket.
  const baru = await rencana(p, {
    kode: "X.2",
    tonggak: [{ tenggat: hari(p, 5) }],
  });
  const lap = await buat(p);
  harusSama(lap.terkunci, true, "laporan: bulan terkunci");
  harusSama(lap.dibuat, 0, "tidak ada tiket baru");
  harus((await tiket(baru.tonggak[0])) === undefined, "tonggak baru tanpa tiket");

  // PIC tetap bisa bekerja, tetapi tonggaknya tidak ikut berubah.
  await sebagai(db, RIAN, "update tasks set status = 'berjalan' where id = $1", [t.id]);
  harusSama((await satu("select status from tasks where id = $1", [t.id])).status, "berjalan", "tiket bergerak");
  harusSama((await tonggak(r.tonggak[0])).status, "belum", "tonggak di bulan terkunci tidak disentuh");

  // Tenggat tidak bisa digeser.
  const pesan = await pesanTolak(
    () => sebagai(db, FARHAN, "update tasks set tenggat = $2::timestamptz where id = $1", [t.id, `${hari(p, 20)}T17:00:00+07:00`]),
    "geser tenggat di bulan terkunci",
  );
  harus(pesan.includes("sudah dikunci"), `pesan jelas: ${pesan}`);
});

// ---------------------------------------------------------------------
// Aturan 12
// ---------------------------------------------------------------------
uji("aturan 12: satu ringkasan per penerima, bukan satu notifikasi per tiket", async () => {
  const p = periodeLalu();
  const r = await rencana(p, {
    kode: "Y.1",
    jenis: "pekanan",
    tonggak: [4, 5, 6, 7, 8].map((d) => ({ tenggat: hari(p, d), judul: `hari ${d}`, kunci: `${d}` })),
  });
  const sebelum = await notifikasi(RIAN, "%");
  await buat(p);
  const penanda = await satu(
    `select count(*) n from notifikasi_tenggat_terkirim
      where tahap = 'lewat'
        and task_id in (select id from tasks where tonggak_id = any ($1::uuid[]))`,
    [`{${r.tonggak.join(",")}}`],
  );
  harusSama(Number(penanda.n), 5, "kelima tiket yang lahir lewat tenggat sudah ditandai");
  const sesudah = await notifikasi(RIAN, "%");
  const baru = sesudah.slice(sebelum.length);
  harusSama(baru.length, 1, `satu notifikasi, bukan lima: ${JSON.stringify(baru)}`);
  harus(baru[0].judul.startsWith("Tiket dari rencana GRD"), "ringkasan GRD");
  harus(baru[0].pesan.includes("5 tiket"), `menyebut jumlahnya: ${baru[0].pesan}`);
  harusSama(
    (await notifikasi(RIAN, "Tugas baru:%")).filter((x) => x.judul.includes("Y.1")).length,
    0,
    "tidak ada 'Tugas baru' per tiket",
  );

  // Tiket yang lahir sudah lewat tenggat: "Tenggat lewat" tidak diterbitkan
  // untuknya, sedangkan tiket biasa yang lewat tetap diingatkan.
  const biasa = (
    await satu(
      `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat, kriteria_selesai)
       values ('tiket', 'Tiket biasa lewat', $1, $2, now() - interval '2 days', 'beres semua') returning id`,
      [DEWI, RIAN],
    )
  ).id;
  await sebagaiAdmin(db, "select terbitkan_notifikasi_tenggat()");
  const lewat = await notifikasi(RIAN, "Tenggat lewat:%");
  harus(lewat.some((x) => x.judul.includes("Tiket biasa lewat")), "tiket biasa tetap diingatkan");
  harus(!lewat.some((x) => x.judul.includes("Y.1")), "tiket GRD yang lahir lewat tidak diingatkan massal");
  harus(biasa, "kontrol ada");

  // Pengingat 0113 tetap berlaku untuk tiket GRD yang menjelang tenggat.
  const mendekat = await rencana(periodeDepan(), {
    kode: "Y.2",
    tonggak: [{ tenggat: "2099-06-01" }],
  });
  await buat((await satu("select to_char(g.grd_periode, 'YYYY-MM-DD') p from grd_tonggak t join grd_rencana g on g.id = t.rencana_id where t.id = $1", [mendekat.tonggak[0]])).p);
  await sebagaiAdmin(
    db,
    "update tasks set tenggat = now() + interval '3 hours' where tonggak_id = $1",
    [mendekat.tonggak[0]],
  );
  await sebagaiAdmin(db, "select terbitkan_notifikasi_tenggat()");
  const dekat = await notifikasi(RIAN, "Tenggat mendekat:%");
  harus(dekat.some((x) => x.judul.includes("Y.2")), "pengingat tenggat mendekat tetap berlaku untuk tiket GRD");
});

uji("notifikasi ringkasan menghormati preferensi, dan tidak untuk pemberi = penerima", async () => {
  const p = periodeDepan();
  // Hafidz (CEO tanpa atasan) → pemberinya Manager, jadi ia mendapat ringkasan.
  await rencana(p, { kode: "Z.1", pic: [HAFIDZ], picTeks: "Hafidz", tonggak: [{ tenggat: hari(p, 5) }] });
  const sebelum = (await notifikasi(HAFIDZ, "Tiket dari rencana GRD%")).length;
  await buat(p);
  harusSama((await notifikasi(HAFIDZ, "Tiket dari rencana GRD%")).length, sebelum + 1, "ringkasan terbit");

  // Penerima = pemberi (tidak ada orang lain): tidak ada notifikasi untuk diri sendiri.
  const p2 = periodeDepan();
  await rencana(p2, { kode: "Z.2", pic: [HAFIDZ], picTeks: "Hafidz", tonggak: [{ tenggat: hari(p2, 5) }] });
  await sebagaiAdmin(db, "update users set status = 'nonaktif' where id = $1", [FARHAN]);
  const n0 = (await notifikasi(HAFIDZ, "Tiket dari rencana GRD%")).length;
  const lap = await buat(p2);
  await sebagaiAdmin(db, "update users set status = 'aktif' where id = $1", [FARHAN]);
  harusSama(lap.perlu_diperiksa.length >= 1, true, "ditandai: pemberi sama dengan penerima");
  harus(
    lap.perlu_diperiksa.some((x) => x.catatan.includes("Pemberi sama dengan penerima")),
    "alasannya jelas",
  );
  harusSama((await notifikasi(HAFIDZ, "Tiket dari rencana GRD%")).length, n0, "tidak mengabari diri sendiri");
});

// ---------------------------------------------------------------------
// KPI: tidak dobel
// ---------------------------------------------------------------------
uji("KPI: komponen tiket rumus jabatan tidak menghitung tiket GRD", async () => {
  const p = periodeDepan();
  const r = await rencana(p, { kode: "KP.1", tonggak: [{ tenggat: hari(p, 9) }] });
  await buat(p);
  // Satu tiket biasa selesai di bulan yang sama.
  await sebagaiAdmin(
    db,
    `insert into tasks (tipe, judul, pembuat_id, penerima_id, tenggat, kriteria_selesai, status)
     values ('tiket', 'Tiket biasa selesai', $1, $2, $3::timestamptz, 'beres semua', 'selesai')`,
    [DEWI, RIAN, `${hari(p, 8)}T17:00:00+07:00`],
  );
  const akhir = `${p.slice(0, 8)}28`;
  const { rows } = await sebagai(
    db,
    RIAN,
    "select realisasi_kpi($1, 'tiket', $2::date, $3::date)::text n",
    [RIAN, p, akhir],
  );
  // Tanpa pengecualian GRD: 1 selesai dari 2 = 50. Dengan: 1 dari 1 = 100.
  harusSama(Number(rows[0].n), 100, "tiket GRD (belum selesai) tidak menurunkan komponen tiket");
  harus((await tiket(r.tonggak[0])) !== undefined, "tiket GRD memang ada di bulan itu");
});

// ---------------------------------------------------------------------
// Mode uji (dry run) & hak akses
// ---------------------------------------------------------------------
uji("mode uji melaporkan jumlah, penerima, pemberi, dan yang dilewati — lalu hasil sungguhan sama", async () => {
  const p = periodeDepan();
  await rencana(p, { kode: "U.1", tonggak: [{ tenggat: hari(p, 5) }] });
  await rencana(p, {
    kode: "U.2",
    jenis: "pekanan",
    pic: [NABILA],
    picTeks: "Nabila",
    tonggak: [
      { tenggat: hari(p, 6), judul: "tahap a" },
      { tenggat: hari(p, 13), judul: "tahap b" },
    ],
  });
  await rencana(p, { kode: "U.3", tonggak: [{ tenggat: null }] });
  await rencana(p, { kode: "U.4", tonggak: [{ tenggat: hari(p, 9), status: "selesai" }] });

  const sebelum = await jumlahTugas();
  const lap = await buat(p, true);
  harusSama(lap.sudah_lewat_tenggat, 0, "tidak ada yang langsung lewat tenggat");
  harusSama(await jumlahTugas(), sebelum, "mode uji tidak menulis");
  harusSama(lap.uji, true, "ditandai uji");
  harusSama(lap.dibuat, 3, "tiga tiket akan dibuat");
  harusSama(lap.tonggak_diperiksa, 5, "lima tonggak diperiksa");
  harusSama(
    lap.per_penerima.map((x) => [x.penerima, x.pemberi, x.jumlah]),
    [
      ["Nabila Putri", "Dewi Lestari", 2],
      ["Rian Hidayat", "Dewi Lestari", 1],
    ],
    "per penerima & pemberi",
  );
  harusSama(
    lap.dilewati.map((x) => [x.kode, x.alasan]),
    [
      ["U.3", "tanpa_tenggat"],
      ["U.4", "sudah_selesai"],
    ],
    "yang dilewati beserta alasan",
  );
  harusSama(lap.tiket.length, 3, "daftar tiket lengkap");

  // Laporan database terbaca oleh penyusun teks skrip, apa adanya.
  const teks = susunLaporanTiketGrd(lap).join("\n");
  harus(teks.includes("3 tiket akan dibuat"), `teks laporan: ${teks}`);
  harus(teks.includes("Nabila Putri ← dari Dewi Lestari: 2 tiket"), "untuk siapa, dari siapa");
  harus(teks.includes('U.3 "Rencana U.3" — tenggatnya belum ditetapkan'), "alasan dilewati");
  harus(teks.includes('U.4 "Rencana U.4" — tonggak sudah selesai'), "alasan dilewati");
  harus(lap.tiket.every((x) => x.judul && x.tenggat.endsWith("T17:00")), "tiap tiket berjudul & 17.00");

  const nyata = await buat(p, false);
  harusSama(nyata.dibuat, 3, "sungguhan = uji");
  harusSama(await jumlahTugas(), sebelum + 3, "tiga tiket tersimpan");
});

uji("penanda PIC cadangan: nama akun yang diawali nama di kolom SIAPA tidak ditandai (0203)", async () => {
  // Nama pengguna asli sering berupa nama akun ("almailminafiatin") atau
  // nama panjang ("Muhammad Ardiansyah"); kolom SIAPA hanya menulis
  // "Alma" atau "Ardi". Yang ditandai hanya PIC yang tak berhubungan sama
  // sekali dengan tulisan di kolom SIAPA — PIC cadangan.
  const p = periodeDepan();
  const akun = (
    await satu(
      `insert into users (id, nama, role, jabatan, atasan_id)
       values (gen_random_uuid(), 'almailminafiatin', 'Staff', '', $1) returning id`,
      [FARHAN],
    )
  ).id;
  const panjang = (
    await satu(
      `insert into users (id, nama, role, jabatan, atasan_id)
       values (gen_random_uuid(), 'Muhammad Ardiansyah', 'Staff', '', $1) returning id`,
      [FARHAN],
    )
  ).id;
  await rencana(p, { kode: "PC.1", pic: [akun], picTeks: "Alma", tonggak: [{ tenggat: hari(p, 5) }] });
  await rencana(p, { kode: "PC.2", pic: [panjang], picTeks: "Kholid → Ardi", tonggak: [{ tenggat: hari(p, 6) }] });
  await rencana(p, { kode: "PC.3", pic: [RIAN], picTeks: "Santri", tonggak: [{ tenggat: hari(p, 7) }] });
  await rencana(p, { kode: "PC.4", pic: [NABILA], picTeks: "Naima + host LIVE", tonggak: [{ tenggat: hari(p, 8) }] });

  const lap = await buat(p, true);
  const ditandai = lap.perlu_diperiksa.map((x) => x.kode);
  harusSama(ditandai, ["PC.3", "PC.4"], "hanya yang tak berhubungan dengan kolom SIAPA");
  harus(
    lap.perlu_diperiksa[0].catatan.includes("kemungkinan PIC cadangan"),
    "alasannya jelas",
  );
});

uji("hanya CEO/Manager/sistem yang boleh membuat tiket dari rencana", async () => {
  const p = periodeDepan();
  await rencana(p, { kode: "H.9", tonggak: [{ tenggat: hari(p, 5) }] });
  for (const [nama, siapa] of [["staf", RIAN], ["Leader", DEWI]]) {
    await pesanTolak(
      () => sebagai(db, siapa, "select buat_tiket_grd($1::date, true)", [p]),
      `${nama} memanggil pembuat tiket`,
    );
  }
  const lap = (await sebagai(db, FARHAN, "select buat_tiket_grd($1::date, true) r", [p])).rows[0].r;
  harusSama(lap.dibuat, 1, "Manager boleh (uji)");
  await pesanTolak(
    () => sebagaiAdmin(db, "select buat_tiket_grd('2099-01-15', true)"),
    "periode harus tanggal 1",
  );
  // Fungsi dalamnya tertutup untuk klien.
  await pesanTolak(
    () => sebagai(db, FARHAN, "select * from calon_tiket_grd($1::date)", [p]),
    "calon_tiket_grd tidak dibuka",
  );
});

uji("migrasi 0199–0202 aman dijalankan ulang", async () => {
  for (const berkas of [
    "0199_tautan_tonggak_tiket.sql",
    "0200_sinkron_tonggak_tiket.sql",
    "0201_buat_tiket_grd.sql",
    "0202_tampilan_tiket_grd.sql",
    "0203_penanda_pic_cadangan.sql",
  ]) {
    const sql = await readFile(
      path.join(process.cwd(), "supabase", "migrations", berkas),
      "utf8",
    );
    await sebagaiAdmin(db, sql);
  }
  const p = periodeDepan();
  await rencana(p, { kode: "AA.1", tonggak: [{ tenggat: hari(p, 5) }] });
  harusSama((await buat(p)).dibuat, 1, "masih berfungsi setelah dijalankan ulang");
});

await jalankan();
