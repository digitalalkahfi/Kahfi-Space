/**
 * Unit Sosial Impact (0223): unit tanpa laporan GMV.
 *
 * Yang dijaga:
 *  - untuk semua orang dan unit yang sudah ada, tagihan laporan,
 *    sasaran form, GMV per unit, dan laporan mingguan PERSIS sama
 *    sebelum dan sesudah 0223 (dipotret dulu, lalu dibandingkan);
 *  - Leader dan Staff Sosial Impact tidak ditagih laporan GMV, dan
 *    Staff-nya boleh melapor kepada Leader seunit;
 *  - unit Sosial Impact tidak muncul di form laporan, GMV per unit,
 *    maupun laporan mingguan; laporan harian dan akun TikTok untuk unit
 *    itu ditolak database;
 *  - calon anggota boleh mengajukan divisi Sosial Impact.
 */
import {
  buatDb,
  buatSuite,
  harus,
  harusSama,
  sebagai,
  sebagaiAdmin,
  terapkanMigrasi,
  terapkanSeed,
} from "../../scripts/db-harness.mjs";

const MIGRASI = "0223_unit_sosial_impact.sql";
const db = await buatDb({ saring: (b) => b < MIGRASI.slice(0, 4) });
await terapkanSeed(db);
const { uji, jalankan } = buatSuite("Unit Sosial Impact (0223)");

const HARI = "2024-10-24"; // seed: laporan 1–24 Okt 2024
const PEKAN = "2024-10-21";
const baris = async (sql, p = []) => (await sebagaiAdmin(db, sql, p)).rows;
const satu = async (sql, p = []) => (await baris(sql, p))[0];

/** Pesan galat sebuah perintah yang seharusnya ditolak ("" bila lolos). */
async function pesanTolak(fn) {
  try {
    await fn();
    return "";
  } catch (e) {
    return e.message;
  }
}

const orangLama = (await baris("select id, nama, role from users where status = 'aktif' order by nama")).map((r) => r);
const leaderLama = orangLama.filter((o) => o.role === "Leader");
const manager = orangLama.find((o) => o.role === "Manager").id;

async function potret() {
  const tagihan = {};
  for (const o of orangLama) {
    const r = await satu(
      "select wajib_lapor_harian($1) w, sudah_lapor_harian($1, $2) s, sudah_lapor_harian($1, $3) s2",
      [o.id, HARI, "2024-10-30"],
    );
    tagihan[o.nama] = [r.w, r.s, r.s2];
  }
  const sasaran = {};
  for (const o of [{ id: manager, nama: "Manager" }, ...leaderLama]) {
    sasaran[o.nama] = (
      await sebagai(db, o.id, "select jenis, unit_kode, label, target_harian::text t, sudah_lapor from sasaran_laporan_saya($1) order by jenis, label", [HARI])
    ).rows;
  }
  return {
    tagihan,
    sasaran,
    status: await baris(
      "select user_id, wajib_lapor, sudah_lapor from status_tim_harian($1) order by user_id",
      [HARI],
    ),
    gmv: await baris(
      "select kode, gmv_hari_ini::text a, gmv_bulan_ini::text b, target_harian::text c, target_bulanan::text d from ringkasan_gmv_unit($1) order by kode",
      [HARI],
    ),
    mingguan: await baris(
      "select unit_kode, target::text t, gmv::text g, status_hasil, status_kri from hitung_laporan_mingguan($1, $2) order by unit_kode",
      [PEKAN, HARI],
    ),
  };
}

const sebelum = await potret();
await terapkanMigrasi(db, MIGRASI);
const sesudah = await potret();

const SOSIAL = await satu("select id, department_id from units where kode = 'sosial'");
const LEADER = crypto.randomUUID();
const STAFF = crypto.randomUUID();
await baris(
  `insert into users (id, nama, email, role, jabatan, unit_id, atasan_id)
   values ($1, 'Leader Sosial Uji', 'leader.sosial@contoh.test', 'Leader', 'Leader Sosial Impact', $2, $3)`,
  [LEADER, SOSIAL.id, manager],
);
await baris(
  `insert into users (id, nama, email, role, jabatan, unit_id, atasan_id)
   values ($1, 'Staf Sosial Uji', 'staf.sosial@contoh.test', 'Staff', 'Staf Sosial Impact', $2, $3)`,
  [STAFF, SOSIAL.id, LEADER],
);

uji("orang dan unit yang sudah ada: tagihan, sasaran, GMV, dan laporan mingguan tidak berubah", async () => {
  harusSama(sesudah.tagihan, sebelum.tagihan, "wajib/sudah lapor tiap orang");
  harusSama(sesudah.sasaran, sebelum.sasaran, "sasaran form Manager dan tiap Leader");
  harusSama(sesudah.status, sebelum.status, "status_tim_harian");
  harusSama(sesudah.gmv, sebelum.gmv, "ringkasan_gmv_unit");
  harusSama(sesudah.mingguan, sebelum.mingguan, "hitung_laporan_mingguan");
  // Pemeriksa silang: potretnya memang berisi tagihan sungguhan.
  harus(Object.values(sebelum.tagihan).some(([w]) => w), "tidak ada yang wajib lapor — tes tidak bermakna");
  harus(sebelum.gmv.length === 3 && sebelum.mingguan.length === 3, "unit seed bukan tiga");
});

uji("unit sosial: departemen Sosial Impact, tidak melapor GMV; unit lain tetap melapor", async () => {
  const unit = await baris(
    "select u.kode, u.lapor_harian, d.nama dep from units u left join departments d on d.id = u.department_id order by u.kode",
  );
  harusSama(
    unit.map((u) => [u.kode, u.lapor_harian]),
    [["affiliator", true], ["mcn", true], ["sosial", false], ["tap", true]],
    "unit",
  );
  harusSama(unit.find((u) => u.kode === "sosial").dep, "Sosial Impact", "departemen unit");
  const staf = await satu("select department_id from users where id = $1", [STAFF]);
  harusSama(staf.department_id, SOSIAL.department_id, "Staff mewarisi departemen unitnya");
});

uji("Leader dan Staff Sosial Impact tidak ditagih laporan GMV", async () => {
  for (const [id, siapa] of [[LEADER, "Leader"], [STAFF, "Staff"]]) {
    const r = await satu("select wajib_lapor_harian($1) w", [id]);
    harusSama(r.w, false, `${siapa} Sosial Impact`);
  }
  const st = await satu("select wajib_lapor from status_tim_harian($1) where user_id = $2", [HARI, LEADER]);
  harusSama(st?.wajib_lapor, false, "status tim: Leader Sosial Impact tidak wajib lapor");
  // Pembanding: Leader unit pelapor yang juga tanpa akun tetap ditagih —
  // yang dibedakan memang tanda unitnya, bukan "unit tanpa akun".
  const pembanding = await baris(
    `select u.nama, wajib_lapor_harian(u.id) w
       from users u join units un on un.id = u.unit_id
      where u.role = 'Leader' and u.status = 'aktif' and un.lapor_harian
        and not exists (select 1 from accounts a where a.unit_id = un.id and a.status = 'aktif')`,
  );
  harus(pembanding.length > 0, "seed tanpa Leader unit-tanpa-akun — pembanding tidak ada");
  harus(pembanding.every((p) => p.w === true), `Leader unit pelapor tanpa akun tidak ditagih: ${JSON.stringify(pembanding)}`);
});

uji("absen pulang Leader Sosial Impact tidak terkunci laporan", async () => {
  await baris(
    "insert into attendance (user_id, tanggal, jam_masuk) values ($1, $2, $2::date + time '08:00')",
    [LEADER, HARI],
  );
  const pesan = await pesanTolak(() =>
    baris("update attendance set jam_pulang = $2::date + time '17:00' where user_id = $1 and tanggal = $2", [LEADER, HARI]),
  );
  harusSama(pesan, "", "absen pulang ditolak");
});

uji("form laporan: unit Sosial Impact tidak pernah jadi sasaran", async () => {
  const m = (await sebagai(db, manager, "select unit_kode from sasaran_laporan_saya($1)", [HARI])).rows;
  harus(!m.some((r) => r.unit_kode === "sosial"), "Manager melihat sasaran Sosial Impact");
  const l = (await sebagai(db, LEADER, "select * from sasaran_laporan_saya($1)", [HARI])).rows;
  harusSama(l.length, 0, "Leader Sosial Impact punya sasaran laporan");
});

uji("GMV per unit dan laporan mingguan tanpa Sosial Impact", async () => {
  harusSama(
    (await baris("select kode from ringkasan_gmv_unit($1) order by kode", [HARI])).map((r) => r.kode),
    ["affiliator", "mcn", "tap"],
    "ringkasan_gmv_unit",
  );
  harusSama(
    (await baris("select unit_kode from hitung_laporan_mingguan($1, $2) order by unit_kode", [PEKAN, HARI])).map((r) => r.unit_kode),
    ["affiliator", "mcn", "tap"],
    "hitung_laporan_mingguan",
  );
});

uji("laporan harian untuk unit Sosial Impact ditolak database", async () => {
  const pesan = await pesanTolak(() =>
    baris(
      `insert into daily_reports (user_id, tanggal, unit_id, gmv, catatan, submitted_at)
       values ($1, $2, $3, 1000, '', $2::date + time '20:00')`,
      [LEADER, HARI, SOSIAL.id],
    ),
  );
  harus(/tidak melaporkan GMV harian/.test(pesan), `seharusnya ditolak: ${pesan || "lolos"}`);
});

uji("akun TikTok tidak bisa ditempatkan di unit Sosial Impact", async () => {
  const baru = await pesanTolak(() =>
    baris("insert into accounts (platform, username, unit_id) values ('TikTok Shop', '@uji_sosial', $1)", [SOSIAL.id]),
  );
  harus(/tidak bisa memegang akun TikTok/.test(baru), `akun baru: ${baru || "lolos"}`);
  const akun = await satu("select id from accounts where status = 'aktif' order by username limit 1");
  const pindah = await pesanTolak(() =>
    baris("update accounts set unit_id = $1 where id = $2", [SOSIAL.id, akun.id]),
  );
  harus(/tidak bisa memegang akun TikTok/.test(pindah), `pindah akun: ${pindah || "lolos"}`);
});

uji("calon anggota boleh mengajukan divisi Sosial Impact", async () => {
  const c = await satu(
    "select pg_get_constraintdef(oid) d from pg_constraint where conname = 'pendaftaran_akun_unit_diajukan_check'",
  );
  harus(/'sosial'/.test(c?.d ?? ""), `batasan divisi: ${c?.d}`);
});

uji("0223 aman dijalankan ulang", async () => {
  await terapkanMigrasi(db, MIGRASI);
  const r = await satu(
    `select (select count(*) from units where kode = 'sosial')::int u,
            (select count(*) from departments where nama = 'Sosial Impact')::int d,
            (select lapor_harian from units where kode = 'sosial') l`,
  );
  harusSama([r.u, r.d, r.l], [1, 1, false], "unit, departemen, tanda");
  const leader = await satu("select unit_id from users where id = $1", [LEADER]);
  harusSama(leader.unit_id, SOSIAL.id, "anggota tetap di unitnya");
});

await jalankan();
