/**
 * Membuat supabase/seed.sql dari supabase/seed/data.json.
 *
 * JSON adalah satu-satunya sumber kebenaran data contoh; berkas SQL ini
 * hasil turunan dan tidak boleh disunting tangan. Jalankan ulang dengan
 * `npm run db:seed:sql` setiap kali data.json berubah.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const akar = process.cwd();
const data = JSON.parse(
  await readFile(path.join(akar, "supabase/seed/data.json"), "utf8"),
);

/** Kutip nilai jadi literal SQL yang aman. */
const q = (v) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};

const arr = (v) => `array[${v.map(q).join(", ")}]`;

const idUser = Object.fromEntries(data.users.map((u) => [u.nama, u.id]));
const idUnit = Object.fromEntries(data.units.map((u) => [u.kode, u.id]));
const idProgram = Object.fromEntries(data.programs.map((p) => [p.nama, p.id]));

const bagian = [];

bagian.push(`-- =====================================================================
-- K-Space V2 — data contoh
--
-- DIBUAT OTOMATIS dari supabase/seed/data.json oleh scripts/buat-seed-sql.mjs.
-- Jangan disunting tangan; ubah JSON-nya lalu jalankan \`npm run db:seed:sql\`.
--
-- Idempoten: aman dijalankan ulang (on conflict do update).
-- =====================================================================

begin;`);

bagian.push(`
-- Departemen -----------------------------------------------------------
insert into departments (nama) values
${data.departments.map((d) => `  (${q(d.nama)})`).join(",\n")}
on conflict (nama) do nothing;`);

bagian.push(`
-- Unit pelaporan -------------------------------------------------------
insert into units (id, kode, nama, department_id, deskripsi) values
${data.units
  .map(
    (u) =>
      `  (${q(u.id)}, ${q(u.kode)}, ${q(u.nama)}, (select id from departments where nama = ${q(u.department)}), ${q(u.deskripsi)})`,
  )
  .join(",\n")}
on conflict (id) do update
  set nama = excluded.nama,
      department_id = excluded.department_id,
      deskripsi = excluded.deskripsi;`);

bagian.push(`
-- Program (atribut akun, bukan unit) -----------------------------------
insert into programs (id, nama, unit_id, aktif) values
${data.programs
  .map((p) => `  (${q(p.id)}, ${q(p.nama)}, ${q(idUnit[p.unit])}, ${q(p.aktif)})`)
  .join(",\n")}
on conflict (id) do update set nama = excluded.nama, aktif = excluded.aktif;`);

/**
 * Nomor Indonesia apa pun → bentuk baku +62…; null bila tidak masuk akal.
 * Cerminan `normalkanKontak()` di src/lib/profil.ts — dua tempat karena
 * skrip ini berjalan sebagai Node polos tanpa alias TypeScript.
 */
function kontakBaku(mentah) {
  if (!mentah) return null;
  const bersih = String(mentah).trim().replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(bersih)) return null;
  let angka = bersih.replace(/^\+/, "");
  if (angka.startsWith("0")) angka = `62${angka.slice(1)}`;
  else if (angka.startsWith("8")) angka = `62${angka}`;
  return /^628\d{8,12}$/.test(angka) ? `+${angka}` : null;
}

// Atasan diisi belakangan supaya urutan penyisipan tidak terikat hierarki.
bagian.push(`
-- Anggota tim ----------------------------------------------------------
insert into users
  (id, nama, email, role, jabatan, unit_id, program_id, department_id, kontak, status)
values
${data.users
  .map(
    (u) =>
      `  (${q(u.id)}, ${q(u.nama)}, ${q(u.email)}, ${q(u.role)}, ${q(u.jabatan)}, ` +
      `${q(u.unit ? idUnit[u.unit] : null)}, ${q(u.program ? idProgram[u.program] : null)}, ` +
      // Departemen peran unit diisi trigger dari unitnya (0068); yang
      // disebut di sini hanya departemen lintas unit seperti Mabit Scholar.
      `${u.departemen ? `(select id from departments where nama = ${q(u.departemen)})` : "null"}, ` +
      // Nomor ditulis apa adanya di data contoh (08…, +62 …) lalu
      // dinormalkan di sini, supaya yang masuk basis data hanya bentuk
      // baku yang diterima CHECK `users_kontak_baku` (0108).
      `${q(kontakBaku(u.kontak))}, ` +
      `${q(u.status ?? "aktif")})`,
  )
  .join(",\n")}
on conflict (id) do update
  set nama = excluded.nama,
      email = excluded.email,
      role = excluded.role,
      jabatan = excluded.jabatan,
      unit_id = excluded.unit_id,
      program_id = excluded.program_id,
      department_id = excluded.department_id,
      kontak = excluded.kontak,
      status = excluded.status;

-- Atasan langsung (dasar alur tiket, QC, dan persetujuan).
${data.users
  .filter((u) => u.atasan)
  .map(
    (u) =>
      `update users set atasan_id = ${q(idUser[u.atasan])} where id = ${q(u.id)};`,
  )
  .join("\n")}`);

bagian.push(`
-- Akun affiliator ------------------------------------------------------
insert into accounts (id, platform, username, pic_user_id, co_leader_id, unit_id, program_id, level) values
${data.accounts
  .map(
    (a) =>
      `  (${q(a.id)}, 'TikTok Shop', ${q(a.username)}, ${q(idUser[a.pic])}, ${q(idUser[a.co_leader])}, ${q(idUnit[a.unit])}, ${q(idProgram[a.program])}, ${a.level ?? "null"})`,
  )
  .join(",\n")}
on conflict (id) do update
  set pic_user_id = excluded.pic_user_id,
      co_leader_id = excluded.co_leader_id,
      program_id = excluded.program_id,
      level = excluded.level;`);

bagian.push(`
-- Riwayat level akun ---------------------------------------------------
-- Baris "ditetapkan" yang dibuat trigger saat akun disisipkan dibuang
-- dulu: stempel waktunya adalah waktu seed dijalankan, bukan waktu
-- levelnya benar-benar ditetapkan, dan riwayat dengan dua baris awal
-- yang saling bertentangan lebih membingungkan daripada tanpa riwayat.
delete from account_level_events;

insert into account_level_events
  (account_id, dari, ke, oleh_id, alasan, created_at) values
${data.level_events
  .map(
    (e) =>
      `  (${q(data.accounts.find((a) => a.username === e.akun).id)}, ` +
      `${e.dari ?? "null"}, ${e.ke}, ${q(idUser[e.oleh])}, ${q(e.alasan)}, ${q(e.pada)})`,
  )
  .join(",\n")};`);

bagian.push(`
-- Pengumuman -----------------------------------------------------------
insert into announcements
  (slug, judul, ringkasan, isi, target_role, target_unit_id, disematkan, dibuat_oleh, published_at) values
${data.announcements
  .map(
    (a) =>
      `  (${q(a.id)}, ${q(a.judul)}, ${q(a.ringkasan)}, ${arr(a.isi)}, ${q(a.target_role)}, ${q(a.target_unit ? idUnit[a.target_unit] : null)}, ${q(a.disematkan)}, ${q(idUser[a.dibuat_oleh])}, ${q(a.published_at)})`,
  )
  .join(",\n")}
on conflict (slug) do update
  set judul = excluded.judul,
      ringkasan = excluded.ringkasan,
      isi = excluded.isi,
      target_role = excluded.target_role,
      target_unit_id = excluded.target_unit_id,
      disematkan = excluded.disematkan,
      published_at = excluded.published_at;`);

// --- Goal & anak tangga bulanan ----------------------------------------
const idAkun = Object.fromEntries(data.accounts.map((a) => [a.username, a.id]));

bagian.push(`
-- Goal unit & akun -----------------------------------------------------
insert into goals
  (id, judul, level, pemilik_id, unit_id, account_id, satuan,
   target_base, target_goal, target_stretch, periode, dibuat_oleh) values
${data.goals
  .map(
    (g) =>
      `  (${q(g.id)}, ${q(g.judul)}, ${q(g.level)}, ${q(idUser[g.pemilik])}, ` +
      `${q(g.unit ? idUnit[g.unit] : null)}, ${q(g.account ? idAkun[g.account] : null)}, 'IDR', ` +
      `${g.target_base}, ${g.target_goal}, ${g.target_stretch}, ${q(g.periode)}, ` +
      `${q(idUser["Farhan Pratama"])})`,
  )
  .join(",\n")}
on conflict (id) do update
  set target_base = excluded.target_base,
      target_goal = excluded.target_goal,
      target_stretch = excluded.target_stretch,
      pemilik_id = excluded.pemilik_id;

-- Rantai roll-down diisi setelah seluruh goal ada.
${data.goals
  .filter((g) => g.parent)
  .map(
    (g) => `update goals set parent_goal_id = ${q(g.parent)} where id = ${q(g.id)};`,
  )
  .join("\n")}

-- Anak tangga bulanan --------------------------------------------------
insert into goal_months (goal_id, bulan, target) values
${data.goals
  .flatMap((g) =>
    (g.bulan_list ?? [{ bulan: g.bulan, target: g.target_bulan }]).map(
      (b) => `  (${q(g.id)}, ${q(b.bulan)}, ${b.target})`,
    ),
  )
  .join(",\n")}
on conflict (goal_id, bulan) do update set target = excluded.target;`);

// --- Laporan harian -----------------------------------------------------
const laporanAkun = data.daily_reports.filter((l) => l.akun);
const laporanUnit = data.daily_reports.filter((l) => l.unit);

bagian.push(`
-- Laporan harian per akun ----------------------------------------------
insert into daily_reports
  (user_id, tanggal, account_id, unit_id, gmv, komisi, jumlah_upload,
   catatan, submitted_at) values
${laporanAkun
  .map(
    (l) =>
      `  (${q(idUser[l.user])}, ${q(l.tanggal)}, ${q(idAkun[l.akun])}, null, ` +
      `${l.gmv}, ${l.komisi ?? "null"}, ${l.jumlah_upload ?? "null"}, ` +
      `${q(l.catatan)}, ${q(`${l.tanggal}T${l.jam}:00+07:00`)})`,
  )
  .join(",\n")}
on conflict (account_id, tanggal) where account_id is not null
do update set gmv = excluded.gmv, komisi = excluded.komisi,
              jumlah_upload = excluded.jumlah_upload,
              catatan = excluded.catatan;

-- Laporan harian per unit ----------------------------------------------
insert into daily_reports
  (user_id, tanggal, account_id, unit_id, gmv, catatan, submitted_at) values
${laporanUnit
  .map(
    (l) =>
      `  (${q(idUser[l.user])}, ${q(l.tanggal)}, null, ${q(idUnit[l.unit])}, ` +
      `${l.gmv}, ${q(l.catatan)}, ${q(`${l.tanggal}T${l.jam}:00+07:00`)})`,
  )
  .join(",\n")}
on conflict (unit_id, tanggal) where unit_id is not null
do update set gmv = excluded.gmv, catatan = excluded.catatan;`);

// --- Tugas --------------------------------------------------------------
const idGoalUnit = Object.fromEntries(
  data.goals.filter((g) => g.unit).map((g) => [g.unit, g.id]),
);

// Tugas tidak punya kunci alami, jadi seed hanya mengisi saat tabel masih
// kosong — menjalankan seed ulang tidak akan menggandakannya.
bagian.push(`
-- Tugas: to-do pribadi, tiket atasan, komitmen mingguan ----------------
insert into tasks
  (tipe, goal_id, judul, deskripsi, konteks, pembuat_id, penerima_id,
   tenggat, prioritas, status, qc_status)
select v.* from (values
${data.tasks
  .map(
    (t) =>
      `  (${q(t.tipe)}::tipe_tugas, ${q(t.goal_unit ? idGoalUnit[t.goal_unit] : null)}::uuid, ${q(t.judul)}, ` +
      `${q(t.deskripsi)}, ${q(t.konteks)}, ${q(idUser[t.pembuat])}::uuid, ${q(idUser[t.penerima])}::uuid, ` +
      `${q(t.tenggat)}::timestamptz, ${q(t.prioritas)}::prioritas_tugas, ${q(t.status)}::status_tugas, ${q(t.qc)}::status_qc)`,
  )
  .join(",\n")}
) as v
where not exists (select 1 from tasks);`);

// --- Absensi ------------------------------------------------------------
bagian.push(`
-- Absensi hari acuan ---------------------------------------------------
insert into attendance
  (user_id, tanggal, jam_masuk, lat_masuk, lng_masuk, status, alasan,
   persetujuan, disetujui_oleh, izin_jenis, izin_mulai, izin_selesai)
values
${data.attendance
  .map(
    (a) =>
      `  (${q(idUser[a.user])}, ${q(a.tanggal)}, ${q(a.jam_masuk ?? null)}, ` +
      `${a.lat ?? "null"}, ${a.lng ?? "null"}, ${q(a.status)}, ${q(a.alasan)}, ` +
      `${q(a.persetujuan)}, ${a.persetujuan === "disetujui" ? q(idUser["Farhan Pratama"]) : "null"}, ` +
      `${q(a.izin_jenis ?? null)}${a.izin_jenis ? "::jenis_izin" : ""}, ` +
      `${q(a.izin_mulai ?? null)}, ${q(a.izin_selesai ?? null)})`,
  )
  .join(",\n")}
on conflict (user_id, tanggal) do update
  set jam_masuk = excluded.jam_masuk,
      lat_masuk = excluded.lat_masuk,
      lng_masuk = excluded.lng_masuk,
      status = excluded.status,
      alasan = excluded.alasan,
      persetujuan = excluded.persetujuan,
      izin_jenis = excluded.izin_jenis,
      izin_mulai = excluded.izin_mulai,
      izin_selesai = excluded.izin_selesai;

-- Hari lanjutan izin terencana menunjuk hari pertamanya, supaya satu
-- keputusan atasan menutup seluruh pengajuan (migrasi 0132).
${data.attendance
  .filter((a) => a.izin_induk)
  .map(
    (a) =>
      `update attendance set izin_induk_id = (
  select id from attendance
   where user_id = ${q(idUser[a.user])} and tanggal = ${q(a.izin_induk)}
)
 where user_id = ${q(idUser[a.user])} and tanggal = ${q(a.tanggal)};`,
  )
  .join("\n")}`);

// --- Lead measure & entri harian ---------------------------------------
const idGoalUnitLead = Object.fromEntries(
  data.goals.filter((g) => g.unit && g.level === "leader").map((g) => [g.unit, g.id]),
);

bagian.push(`
-- Lead measure (papan skor langkah kunci) ------------------------------
insert into lead_measures
  (id, goal_id, judul, satuan, target_mingguan, label_pendukung, urutan,
   sumber_laporan) values
${data.lead_measures
  .map(
    (m) =>
      `  (${q(m.id)}, ${q(idGoalUnitLead[m.unit])}, ${q(m.judul)}, ${q(m.satuan)}, ` +
      `${m.target_mingguan}, ${q(m.label_pendukung)}, ${m.urutan}, ` +
      `${q(m.sumber_laporan ?? null)})`,
  )
  .join(",\n")}
on conflict (id) do update
  set target_mingguan = excluded.target_mingguan,
      label_pendukung = excluded.label_pendukung,
      sumber_laporan = excluded.sumber_laporan;

-- Realisasi harian pekan berjalan --------------------------------------
insert into lead_measure_entries
  (lead_measure_id, user_id, tanggal, nilai, nilai_pendukung, catatan) values
${data.lead_measure_entries
  .map(
    (e) =>
      `  (${q(e.lead)}, ${q(idUser[e.user])}, ${q(e.tanggal)}, ${e.nilai}, ` +
      `${e.nilai_pendukung ?? "null"}, ${q(e.catatan)})`,
  )
  .join(",\n")}
on conflict (lead_measure_id, tanggal) do update
  set nilai = excluded.nilai, nilai_pendukung = excluded.nilai_pendukung;`);

bagian.push(`
-- Definisi KPI per jabatan ---------------------------------------------
insert into kpi_definitions
  (jabatan, nama_kpi, bobot, satuan, target_base, target_goal, target_stretch, sumber_data)
values
${data.kpi_definitions
  .map(
    (k) =>
      `  (${q(k.jabatan)}, ${q(k.nama)}, ${k.bobot}, ${q(k.satuan)}, ` +
      `${k.base}, ${k.goal}, ${k.stretch}, ${q(k.sumber)})`,
  )
  .join(",\n")}
on conflict (jabatan, nama_kpi) do update
  set bobot = excluded.bobot,
      target_base = excluded.target_base,
      target_goal = excluded.target_goal,
      target_stretch = excluded.target_stretch;`);

bagian.push(`
commit;`);

// Sampel & jejak perpindahannya -----------------------------------------
// Statusnya tidak di-set langsung: setiap sampel dibuat 'tersedia' lalu
// digerakkan lewat sample_events, persis seperti pemakaian sungguhannya.
// Dengan begitu seed ikut menguji aturan perpindahannya.
const jalurSampel = {
  tersedia: [],
  dipegang: ["dipegang"],
  dikirim: ["dipegang", "dikirim"],
  diterima: ["dipegang", "dikirim", "diterima"],
  dikembalikan: ["dipegang", "dikirim", "diterima", "dikembalikan"],
  hilang: ["dipegang", "hilang"],
};

bagian.push(`
-- Sampel produk ---------------------------------------------------------
insert into samples (kode, nama, kategori, unit_id, account_id, nilai, brand, link_produk) values
${data.samples
  .map(
    (s) =>
      `  (${q(s.kode)}, ${q(s.nama)}, ${q(s.kategori)}, ${q(idUnit[s.unit])}, ` +
      `${s.akun ? `(select id from accounts where username = ${q(s.akun)})` : "null"}, ${s.nilai}, ` +
      `${q(s.brand ?? "")}, ${q(s.link || null)})`,
  )
  .join(",\n")}
on conflict (lower(kode)) do update
  set nama = excluded.nama,
      kategori = excluded.kategori,
      unit_id = excluded.unit_id,
      account_id = excluded.account_id,
      nilai = excluded.nilai,
      brand = excluded.brand,
      link_produk = excluded.link_produk;`);

// Sampel yang kini di tangan kreator dulu tetap pernah dibawa seseorang.
// Tanpa nama itu, langkah 'dipegang'-nya menjadi keadaan yang tidak bisa
// dipertanggungjawabkan — persis yang dilarang 0079.
const stafUnit = Object.fromEntries(
  data.units.map((u) => [
    u.kode,
    data.users.find((x) => x.role === "Staff" && x.unit === u.kode)?.nama ?? null,
  ]),
);

const kejadian = [];
for (const s of data.samples) {
  const langkah = jalurSampel[s.status] ?? [];
  langkah.forEach((ke, i) => {
    const namaPemegang = s.pemegang ?? stafUnit[s.unit];
    // Hanya langkah 'dipegang' yang menyebut pemegang; sesudah dikirim,
    // barangnya tidak lagi di tangan siapa pun di kantor.
    const pemegang = ke === "dipegang" && namaPemegang ? idUser[namaPemegang] : null;
    kejadian.push(
      `  ((select id from samples where lower(kode) = lower(${q(s.kode)})), ${q(ke)}, ` +
        `${q(idUser["Farhan Pratama"])}, ${q(pemegang)}, ` +
        // Kreator hanya berarti pada langkah pengiriman; sebelum itu
        // barangnya masih di kantor.
        `${q(["dikirim", "diterima"].includes(ke) ? (s.kreator ?? "") : "")}, ` +
        `now() - interval '${langkah.length - i} day')`,
    );
  });
}

if ((data.sample_scans ?? []).length > 0) {
  bagian.push(`
-- Riwayat pemindaian QR --------------------------------------------------
insert into sample_scans (kode, sample_id, oleh_id, dikenali, pada)
select kode, sample_id::uuid, oleh_id::uuid, dikenali, pada::timestamptz
from (values
${data.sample_scans
  .map(
    (s) =>
      `  (${q(s.kode)}, ` +
      `${s.dikenali ? `(select id from samples where lower(kode) = lower(${q(s.kode)}))` : "null"}, ` +
      `${q(idUser[s.oleh])}, ${s.dikenali}, now() - interval '${s.lalu_hari} day')`,
  )
  .join(",\n")}
) as v(kode, sample_id, oleh_id, dikenali, pada)
where not exists (select 1 from sample_scans);`);
}

if (kejadian.length > 0) {
  bagian.push(`
-- Jejak perpindahan sampel ---------------------------------------------
insert into sample_events (sample_id, ke, oleh_id, pemegang_id, kreator, pada)
select sample_id, ke::status_sampel, oleh_id::uuid, pemegang_id::uuid, kreator, pada::timestamptz
from (values
${kejadian.join(",\n")}
) as v(sample_id, ke, oleh_id, pemegang_id, kreator, pada)
where not exists (select 1 from sample_events);`);
}

// Masalah & analisis 5-Why -----------------------------------------------
// Rantai "mengapa" disisipkan berurutan; kalau aturan urutannya berubah,
// seed ikut gagal, bukan diam-diam menghasilkan rantai terputus.
bagian.push(`
-- Masalah ---------------------------------------------------------------
insert into problems (judul, konteks, unit_id, dilaporkan_oleh, dampak, status, solusi)
select * from (values
${data.problems
  .map(
    (m) =>
      `  (${q(m.judul)}, ${q(m.konteks)}, ${q(idUnit[m.unit])}::uuid, ${q(idUser[m.pelapor])}::uuid, ${q(m.dampak)}::dampak_masalah, ${q(m.status)}::status_masalah, ${q(m.solusi)})`,
  )
  .join(",\n")}
) as v(judul, konteks, unit_id, dilaporkan_oleh, dampak, status, solusi)
where not exists (select 1 from problems);`);

// Penjual & catatan (tahap 2 migrasi V1) ---------------------------------
bagian.push(`
-- Penjual ---------------------------------------------------------------
insert into sellers (nama_toko, nama_kontak, telepon, kategori, status, komisi_persen, catatan, unit_id, pic_user_id, dibuat_oleh)
select * from (values
${data.sellers
  .map(
    (s) =>
      `  (${q(s.nama_toko)}, ${q(s.nama_kontak)}, ${q(s.telepon)}, ${q(s.kategori)}, ${q(s.status)}::status_penjual, ${s.komisi_persen === null ? "null::numeric" : `${s.komisi_persen}::numeric`}, ${q(s.catatan)}, ${q(idUnit[s.unit])}::uuid, ${s.pic ? `${q(idUser[s.pic])}::uuid` : "null::uuid"}, ${q(idUser[s.dibuat_oleh])}::uuid)`,
  )
  .join(",\n")}
) as v(nama_toko, nama_kontak, telepon, kategori, status, komisi_persen, catatan, unit_id, pic_user_id, dibuat_oleh)
where not exists (select 1 from sellers);

-- Catatan ---------------------------------------------------------------
insert into notes (judul, isi, kategori, visibilitas, unit_id, disematkan, lampiran, dibuat_oleh)
select * from (values
${data.notes
  .map(
    (n) =>
      `  (${q(n.judul)}, ${q(n.isi)}, ${q(n.kategori)}::kategori_catatan, ${q(n.visibilitas)}::visibilitas_catatan, ${n.unit ? `${q(idUnit[n.unit])}::uuid` : "null::uuid"}, ${n.disematkan ? "true" : "false"}, array[${n.lampiran.map((l) => q(l)).join(", ")}]::text[], ${q(idUser[n.dibuat_oleh])}::uuid)`,
  )
  .join(",\n")}
) as v(judul, isi, kategori, visibilitas, unit_id, disematkan, lampiran, dibuat_oleh)
where not exists (select 1 from notes);`);

// LMS: kursus, modul, dan kemajuan --------------------------------------
// Kemajuan disisipkan sebagai baris module_progress, bukan dengan menyetel
// tanggal selesai: kelulusan selalu dihitung dari modul yang tuntas.
bagian.push(`
-- Kursus ----------------------------------------------------------------
insert into courses (judul, ringkasan, kategori, tingkat, unit_id, wajib_untuk, dibuat_oleh)
select * from (values
${data.courses
  .map(
    (c) =>
      `  (${q(c.judul)}, ${q(c.ringkasan)}, ${q(c.kategori)}, ${q(c.tingkat)}::tingkat_kursus, ` +
      `${q(c.unit ? idUnit[c.unit] : null)}::uuid, ` +
      `'{${c.wajib_untuk.map((p) => `"${p}"`).join(",")}}'::peran_pengguna[], ` +
      `${q(idUser["Farhan Pratama"])}::uuid)`,
  )
  .join(",\n")}
) as v(judul, ringkasan, kategori, tingkat, unit_id, wajib_untuk, dibuat_oleh)
where not exists (select 1 from courses);`);

const barisModul = [];
for (const c of data.courses) {
  c.modul.forEach((m, i) => {
    barisModul.push(
      `  ((select id from courses where judul = ${q(c.judul)}), ${i + 1}, ${q(m.judul)}, ${q((m.isi ?? []).join("\n\n"))}, ${m.durasi})`,
    );
  });
}

bagian.push(`
-- Modul kursus ----------------------------------------------------------
insert into course_modules (course_id, urutan, judul, isi, durasi_menit)
select * from (values
${barisModul.join(",\n")}
) as v(course_id, urutan, judul, isi, durasi_menit)
where not exists (select 1 from course_modules);`);

bagian.push(`
-- Pendaftaran kursus ----------------------------------------------------
insert into course_enrollments (course_id, user_id)
select * from (values
${data.enrollments
  .map(
    (e) =>
      `  ((select id from courses where judul = ${q(e.kursus)}), ${q(idUser[e.orang])}::uuid)`,
  )
  .join(",\n")}
) as v(course_id, user_id)
where not exists (select 1 from course_enrollments);`);

const barisKemajuan = [];
for (const e of data.enrollments) {
  for (let i = 1; i <= e.tuntas; i++) {
    barisKemajuan.push(
      `  ((select en.id from course_enrollments en ` +
        `join courses c on c.id = en.course_id ` +
        `where c.judul = ${q(e.kursus)} and en.user_id = ${q(idUser[e.orang])}::uuid), ` +
        `(select m.id from course_modules m join courses c on c.id = m.course_id ` +
        `where c.judul = ${q(e.kursus)} and m.urutan = ${i}))`,
    );
  }
}

if (barisKemajuan.length > 0) {
  bagian.push(`
-- Kemajuan per modul ----------------------------------------------------
insert into module_progress (enrollment_id, module_id)
select * from (values
${barisKemajuan.join(",\n")}
) as v(enrollment_id, module_id)
where not exists (select 1 from module_progress);`);
}

// Kuis modul -------------------------------------------------------------
// Soal dan kuncinya disimpan terpisah; kunci tidak pernah ikut terbaca
// aplikasi peserta.
const barisSoal = [];
const barisKunci = [];
for (const k of data.quiz ?? []) {
  k.soal.forEach((s, i) => {
    barisSoal.push(
      `  ((select m.id from course_modules m where m.judul = ${q(k.modul)}), ${i + 1}, ` +
        `${q(s.pertanyaan)}, array[${s.pilihan.map((p) => q(p)).join(", ")}]::text[])`,
    );
    barisKunci.push(
      `  ((select qq.id from quiz_questions qq ` +
        `join course_modules m on m.id = qq.module_id ` +
        `where m.judul = ${q(k.modul)} and qq.urutan = ${i + 1}), ${s.benar}, ${q(s.penjelasan)})`,
    );
  });
}

if (barisSoal.length > 0) {
  bagian.push(`
-- Soal kuis -------------------------------------------------------------
insert into quiz_questions (module_id, urutan, pertanyaan, pilihan)
select * from (values
${barisSoal.join(",\n")}
) as v(module_id, urutan, pertanyaan, pilihan)
where not exists (select 1 from quiz_questions);

-- Kunci jawaban ---------------------------------------------------------
insert into quiz_keys (question_id, jawaban_benar, penjelasan)
select * from (values
${barisKunci.join(",\n")}
) as v(question_id, jawaban_benar, penjelasan)
where not exists (select 1 from quiz_keys);`);
}

// Masukan & bug ----------------------------------------------------------
// Status disisipkan langsung: jejak perubahannya baru bermakna untuk
// perubahan yang benar-benar terjadi setelah aplikasi berjalan.
bagian.push(`
-- Masukan & bug ---------------------------------------------------------
insert into feedback
  (jenis, judul, isi, keparahan, halaman, status, alasan_tolak,
   dilaporkan_oleh, ditugaskan_ke)
select * from (values
${data.feedback
  .map(
    (f) =>
      `  (${q(f.jenis)}::jenis_masukan, ${q(f.judul)}, ${q(f.isi)}, ` +
      `${f.keparahan ? `${q(f.keparahan)}::keparahan_bug` : "null::keparahan_bug"}, ` +
      `${q(f.halaman)}, ${q(f.status)}::status_masukan, ${q(f.alasan_tolak ?? "")}, ` +
      `${q(idUser[f.pelapor])}::uuid, ` +
      // Laporan yang sedang dikerjakan wajib bertuan (0094).
      `${f.ditugaskan ? `${q(idUser[f.ditugaskan])}::uuid` : "null::uuid"})`,
  )
  .join(",\n")}
) as v(jenis, judul, isi, keparahan, halaman, status, alasan_tolak,
       dilaporkan_oleh, ditugaskan_ke)
where not exists (select 1 from feedback);`);

const barisDukungan = [];
const barisKomentar = [];
for (const f of data.feedback) {
  for (const orang of f.dukungan) {
    barisDukungan.push(
      `  ((select id from feedback where judul = ${q(f.judul)}), ${q(idUser[orang])}::uuid)`,
    );
  }
  for (const k of f.komentar) {
    barisKomentar.push(
      `  ((select id from feedback where judul = ${q(f.judul)}), ${q(idUser[k.oleh])}::uuid, ${q(k.isi)})`,
    );
  }
}

if (barisDukungan.length > 0) {
  bagian.push(`
-- Dukungan masukan ------------------------------------------------------
insert into feedback_votes (feedback_id, user_id)
select * from (values
${barisDukungan.join(",\n")}
) as v(feedback_id, user_id)
where not exists (select 1 from feedback_votes);`);
}

if (barisKomentar.length > 0) {
  bagian.push(`
-- Komentar masukan ------------------------------------------------------
insert into feedback_comments (feedback_id, oleh_id, isi)
select * from (values
${barisKomentar.join(",\n")}
) as v(feedback_id, oleh_id, isi)
where not exists (select 1 from feedback_comments);`);
}

// Agenda kalender --------------------------------------------------------
bagian.push(`
-- Agenda ----------------------------------------------------------------
insert into agenda (judul, keterangan, jenis, tanggal, jam_mulai, jam_selesai, unit_id, lokasi, dibuat_oleh)
select * from (values
${data.agenda
  .map(
    (a) =>
      `  (${q(a.judul)}, ${q(a.keterangan)}, ${q(a.jenis)}::jenis_agenda, ${q(a.tanggal)}::date, ` +
      `${a.jam_mulai ? `${q(a.jam_mulai)}::time` : "null::time"}, ` +
      `${a.jam_selesai ? `${q(a.jam_selesai)}::time` : "null::time"}, ` +
      `${q(a.unit ? idUnit[a.unit] : null)}::uuid, ${q(a.lokasi)}, ` +
      `${q(idUser["Farhan Pratama"])}::uuid)`,
  )
  .join(",\n")}
) as v(judul, keterangan, jenis, tanggal, jam_mulai, jam_selesai, unit_id, lokasi, dibuat_oleh)
where not exists (select 1 from agenda);`);

// ---------------------------------------------------------------------
// Transaksi keuangan.
//
// Status tidak bisa disetel langsung saat insert (migrasi 0097): trigger
// selalu memaksa status awal. Keputusan karena itu ditempuh lewat jalur
// yang sama dengan aplikasinya — diajukan → disetujui → dibayar — supaya
// data contoh tidak pernah berada di keadaan yang tak mungkin dicapai
// pengguna sungguhan.
// ---------------------------------------------------------------------
const perluDisetujui = data.transaksi.filter(
  (t) => t.arah === "keluar" && ["disetujui", "dibayar"].includes(t.status),
);
const perluDibayar = data.transaksi.filter(
  (t) => t.arah === "keluar" && t.status === "dibayar",
);
const perluDitolak = data.transaksi.filter((t) => t.status === "ditolak");

// Status tidak bisa diubah langsung (migrasi 0098): keputusan dicatat
// sebagai persetujuan, persis seperti yang dilakukan aplikasinya. Penanda
// sesi dipasang supaya trigger tahu siapa yang memutuskan; `where not
// exists` membuat tiap langkah idempoten.
const keputusan = (daftar, dari, ke) =>
  daftar
    .map(
      (t) =>
        `select set_config('request.jwt.claim.sub', ${q(idUser[t.disetujui])}, false);\n` +
        `insert into transaction_approvals (transaction_id, ke, oleh_id, catatan)\n` +
        `select ${q(t.id)}::uuid, '${ke}'::status_transaksi, ${q(idUser[t.disetujui])}::uuid, ${q(t.catatan ?? "")}\n` +
        `where exists (\n` +
        `  select 1 from transactions\n` +
        `  where id = ${q(t.id)}::uuid and status = '${dari}'\n` +
        `);`,
    )
    .join("\n");

bagian.push(`
-- Transaksi keuangan --------------------------------------------------
update keuangan_pengaturan set kas_awal = ${data.kas_awal} where id;

insert into transactions (id, tanggal, arah, jenis, unit_id, account_id, keterangan, jumlah, diajukan_id)
select * from (values
${data.transaksi
  .map(
    (t) =>
      `  (${q(t.id)}::uuid, ${q(t.tanggal)}::date, ${q(t.arah)}::arah_transaksi, ` +
      `${t.jenis ? `${q(t.jenis)}::jenis_keluar` : "null::jenis_keluar"}, ` +
      `${q(t.unit ? idUnit[t.unit] : null)}::uuid, ` +
      `${q(t.akun ? idAkun[t.akun] : null)}::uuid, ` +
      `${q(t.keterangan)}, ${t.jumlah}, ${q(idUser[t.diajukan])}::uuid)`,
  )
  .join(",\n")}
) as v(id, tanggal, arah, jenis, unit_id, account_id, keterangan, jumlah, diajukan_id)
where not exists (select 1 from transactions);

`);

// ---------------------------------------------------------------------
// Aset & inventaris.
//
// Perolehan dicatat trigger sebagai kejadian pertama (migrasi 0102),
// jadi yang disisipkan di sini hanya perpindahan sesudahnya — lewat
// jalur yang sama dengan aplikasinya, supaya keadaan akhirnya tidak
// pernah berada di titik yang tak mungkin dicapai pengguna.
// ---------------------------------------------------------------------
const idAset = Object.fromEntries(data.aset.map((a) => [a.kode, a.id]));
const perpindahanAset = (data.aset_riwayat ?? []).filter((k) => k.dari !== null);

bagian.push(`
-- Aset & inventaris ----------------------------------------------------
insert into assets (id, kode, nama, kategori, unit_id, tanggal, nilai_perolehan,
                    masa_manfaat, residu, status, pemegang_id, lokasi, berakhir,
                    transaction_id, catatan)
select * from (values
${data.aset
  .map((a) => {
    const transaksi = a.transaksi
      ? data.transaksi.find((t) => t.keterangan === a.transaksi)
      : null;
    // Keadaan awal diambil dari kejadian perolehannya, bukan dari status
    // hari ini: perpindahan sesudahnya menyusul sebagai kejadian, dan
    // menaruh status akhir di sini membuat langkah pertamanya mustahil.
    const perolehan = (data.aset_riwayat ?? []).find(
      (k) => k.kode === a.kode && k.dari === null,
    );
    const awal = perolehan?.ke ?? a.status;
    const pemegangAwal = perolehan?.pemegang ?? null;
    return (
      `  (${q(a.id)}::uuid, ${q(a.kode)}, ${q(a.nama)}, ${q(a.kategori)}, ` +
      `${q(a.unit ? idUnit[a.unit] : null)}::uuid, ${q(a.tanggal)}::date, ${a.nilai}, ` +
      `${a.masa_manfaat}, ${a.residu}, ${q(awal)}::status_aset, ` +
      `${q(pemegangAwal ? idUser[pemegangAwal] : null)}::uuid, ${q(a.lokasi)}, ` +
      `null::date, ${q(transaksi ? transaksi.id : null)}::uuid, ${q(a.catatan)})`
    );
  })
  .join(",\n")}
) as v(id, kode, nama, kategori, unit_id, tanggal, nilai_perolehan, masa_manfaat,
       residu, status, pemegang_id, lokasi, berakhir, transaction_id, catatan)
where not exists (select 1 from assets a where a.kode = v.kode);

${perpindahanAset
  .map(
    (k) =>
      `insert into asset_events (asset_id, ke, oleh_id, pemegang_id, lokasi, catatan, pada)\n` +
      `select ${q(idAset[k.kode])}::uuid, ${q(k.ke)}::status_aset, ` +
      `${q(idUser[k.oleh])}::uuid, ${q(k.pemegang ? idUser[k.pemegang] : null)}::uuid, ` +
      `${q(k.lokasi)}, ${q(k.catatan || "Perpindahan tercatat dari data contoh.")}, ` +
      `${q(k.pada)}::timestamptz\n` +
      `where not exists (\n` +
      `  select 1 from asset_events\n` +
      `  where asset_id = ${q(idAset[k.kode])}::uuid and pada = ${q(k.pada)}::timestamptz\n` +
      `);`,
  )
  .join("\n")}`);

// Keputusan transaksi dicatat paling akhir, sesudah aset.
//
// Begitu sebuah pengeluaran berjenis aset berstatus 'dibayar', trigger
// (migrasi 0105) membuatkan asetnya sendiri. Kalau itu terjadi sebelum
// aset contoh masuk, barang yang sama tercatat dua kali — sekali dari
// trigger, sekali dari data contoh.
bagian.push(`
-- Keputusan atas transaksi ---------------------------------------------
${keputusan(perluDisetujui, "diajukan", "disetujui")}
${keputusan(perluDibayar, "disetujui", "dibayar")}
${keputusan(perluDitolak, "diajukan", "ditolak")}

-- Penanda pengguna dikembalikan kosong supaya sesi berikutnya tidak
-- mewarisi identitas penyetuju terakhir.
select set_config('request.jwt.claim.sub', '', false);`);

const keluaran = path.join(akar, "supabase", "seed.sql");
await writeFile(keluaran, bagian.join("\n") + "\n");
console.log(`✓ supabase/seed.sql dibuat dari data.json`);
console.log(
  `  ${data.users.length} anggota · ${data.accounts.length} akun · ` +
    `${data.announcements.length} pengumuman · ${data.goals.length} goal · ` +
    `${data.tasks.length} tugas · ${data.attendance.length} absensi · ` +
    `${data.lead_measures.length} lead measure · ${data.kpi_definitions.length} KPI · ` +
    `${data.daily_reports.length} laporan harian · ` +
    `${data.transaksi.length} transaksi · ${data.aset.length} aset`,
);
