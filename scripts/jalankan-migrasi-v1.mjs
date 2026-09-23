#!/usr/bin/env node
/**
 * Migrasi data K-Space V1 → V2, dijalankan mandiri dari terminal.
 *
 * Kenapa ada: jalur web (/migrasi → `jalankanMigrasi`) berjalan sebagai
 * serverless function di Vercel dan kena batas waktu eksekusi (HTTP 503)
 * jauh sebelum ribuan catatan selesai. Skrip ini memakai fungsi migrasi
 * YANG SAMA dari `src/lib/data/terapkan-migrasi.ts` — idempotensi lewat
 * `migrasi_peta` tetap berlaku, jadi aman diulang berkali-kali — hanya
 * dijalankan di proses Node biasa tanpa batas waktu.
 *
 * Yang berbeda dari jalur web hanya klien basis datanya: impor
 * `@/lib/supabase/server` dialihkan ke `scripts/migrasi-v1-klien.ts`
 * (service-role dari env), dan `server-only` dikosongkan.
 *
 * Pemakaian (dari akar repo):
 *   node scripts/jalankan-migrasi-v1.mjs                  # sungguhan, semua kelompok
 *   node scripts/jalankan-migrasi-v1.mjs --uji-coba       # hitung saja, tidak menulis
 *   node scripts/jalankan-migrasi-v1.mjs --hanya=tasks:all,todos:all
 *   node scripts/jalankan-migrasi-v1.mjs --berkas-backup=/jalur/alkahfi-backup.json
 *   node scripts/jalankan-migrasi-v1.mjs --tanpa-baseline --setiap=50
 *
 * Kredensial dibaca dari env atau `.env.local` di akar repo:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   (NEXT_PUBLIC_SUPABASE_ANON_KEY tidak dipakai skrip ini; bila kosong
 *   diisi penanda supaya modul konfigurasi tidak jatuh ke mode demo.)
 * Tidak satu pun nilainya dicetak.
 *
 * Urutan kelompok mengikuti ketergantungan data. Satu-satunya yang
 * digeser dari urutan tampilan: `attendance:config` dijalankan SEBELUM
 * kehadiran, karena trigger `hitung_absensi` (0010) menghitung terlambat
 * dan keabsahan lokasi tiap baris dari `pengaturan` saat baris ditulis —
 * kehadiran lama harus dinilai dengan jam kerja dan pagar lokasi lama.
 */
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const AKAR = path.resolve(import.meta.dirname, "..");

// ---------------------------------------------------------------------
// Argumen
// ---------------------------------------------------------------------
const argumen = new Map();
for (const a of process.argv.slice(2)) {
  const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
  if (!m) {
    console.error(`Argumen tidak dikenali: ${a}`);
    process.exit(2);
  }
  argumen.set(m[1], m[2] ?? "true");
}

const TAHAP = argumen.has("uji-coba") ? "uji_coba" : "sungguhan";
const HANYA = argumen.has("hanya")
  ? new Set(
      argumen
        .get("hanya")
        .split(",")
        .map((k) => k.trim()),
    )
  : null;
const TANPA_BASELINE = argumen.has("tanpa-baseline");
const BERKAS_BACKUP = argumen.get("berkas-backup") ?? null;
const SETIAP = Number(argumen.get("setiap") ?? 20) || 20;
const DIR_LAPORAN = path.join(AKAR, ".tmp");

// ---------------------------------------------------------------------
// Env — tidak pernah dicetak
// ---------------------------------------------------------------------
for (const nama of [".env.local", ".env"]) {
  const jalur = path.join(AKAR, nama);
  if (fs.existsSync(jalur)) {
    process.loadEnvFile(jalur);
    break;
  }
}
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  console.error(
    "Butuh NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di env " +
      "atau .env.local (lihat .env.example). Tidak ada yang dijalankan.",
  );
  process.exit(2);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  // Hanya agar `modeData()` tidak membaca "demo"; klien di sini memakai
  // service-role, kunci anon tidak pernah dipakai.
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "tidak-dipakai-skrip-migrasi";
}

// ---------------------------------------------------------------------
// Hook pemuat: alias @/, server-only, klien admin, JSON
// ---------------------------------------------------------------------
const URL_SRC = pathToFileURL(`${path.join(AKAR, "src")}/`).href;
const URL_SHIM = pathToFileURL(
  path.join(AKAR, "scripts/migrasi-v1-klien.ts"),
).href;
const HOOKS = `
const SRC = ${JSON.stringify(URL_SRC)};
const SHIM = ${JSON.stringify(URL_SHIM)};
const KOSONG = "data:text/javascript,";
export async function resolve(spesifier, konteks, berikutnya) {
  if (spesifier === "server-only" || spesifier === "client-only") {
    return { url: KOSONG, shortCircuit: true };
  }
  if (spesifier === "@/lib/supabase/server") {
    return { url: SHIM, shortCircuit: true };
  }
  if (spesifier.startsWith("@/")) {
    const jalur = spesifier.slice(2);
    const punyaEkstensi = /\\.(ts|tsx|mjs|js|json)$/.test(jalur);
    spesifier = new URL(punyaEkstensi ? jalur : jalur + ".ts", SRC).href;
  }
  const hasil = await berikutnya(spesifier, konteks);
  if (hasil.url.endsWith(".json")) {
    return { ...hasil, importAttributes: { type: "json" } };
  }
  return hasil;
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`, import.meta.url);

const modul = (jalur) => import(pathToFileURL(path.join(AKAR, jalur)).href);
const terap = await modul("src/lib/data/terapkan-migrasi.ts");
const { klienServer, pantau } = await import(URL_SHIM);
const { isiEksporLama } = await modul("src/lib/data/migrasi.ts");
const { hariDariKejadian, hariIzin } = await modul("src/lib/izin-v1.ts");
const { keAngka, keTanggal } = await modul("src/lib/impor.ts");
const { bacaEksporV1 } = await modul("src/lib/ekspor-v1.ts");
const { arahV1, jenisKeluarV1 } = await modul("src/lib/keuangan-v1.ts");
pantau.setiap = SETIAP;

// ---------------------------------------------------------------------
// Kelompok, berurutan sesuai ketergantungan
// ---------------------------------------------------------------------
const KELOMPOK = [
  {
    kunci: "users:list",
    label: "Anggota tim",
    tabel: "users",
    jalankan: (t) => terap.terapkanUsersList(t),
  },
  {
    kunci: "affiliate-accounts:all",
    label: "Akun affiliator",
    tabel: "accounts",
    jalankan: (t) => terap.terapkanAkun(t),
  },
  {
    kunci: "daily-reports:all",
    label: "Laporan harian",
    tabel: "daily_reports",
    jalankan: (t) => terap.terapkanLaporan(t),
  },
  {
    kunci: "attendance:config",
    label: "Pengaturan absensi",
    tabel: "pengaturan",
    jalankan: (t) => terap.terapkanPengaturanAbsensi(t),
  },
  {
    kunci: "attendance:all",
    label: "Kehadiran",
    tabel: "attendance",
    jalankan: (t) => terap.terapkanKehadiran(t),
  },
  {
    kunci: "leave-requests:all",
    label: "Pengajuan izin",
    tabel: "attendance",
    jalankan: (t) => terap.terapkanIzin(t),
  },
  {
    kunci: "tasks:all",
    label: "Tugas & QC",
    tabel: "tasks",
    jalankan: (t) => terap.terapkanTugas(t),
  },
  {
    kunci: "todos:all",
    label: "Todo",
    tabel: "tasks",
    jalankan: (t) => terap.terapkanTodo(t),
  },
  {
    kunci: "keuangan:cashflow",
    label: "Arus kas",
    tabel: "transactions",
    jalankan: (t) => terap.terapkanKas(t),
  },
];
const TABEL = [
  "users",
  "accounts",
  "daily_reports",
  "attendance",
  "tasks",
  "transactions",
];

if (HANYA) {
  for (const k of HANYA) {
    if (!KELOMPOK.some((g) => g.kunci === k)) {
      console.error(
        `Kelompok tidak dikenali: ${k}. Pilihan: ${KELOMPOK.map((g) => g.kunci).join(", ")}`,
      );
      process.exit(2);
    }
  }
}

// ---------------------------------------------------------------------
// Pembacaan angka
// ---------------------------------------------------------------------
async function hitungTabel(sb) {
  const hasil = {};
  for (const t of TABEL) {
    const { count, error } = await sb
      .from(t)
      .select("id", { count: "exact", head: true });
    hasil[t] = error ? `galat: ${error.message}` : (count ?? 0);
  }
  return hasil;
}

async function petaPerKelompok(sb) {
  const { data, error } = await sb.rpc("ringkas_peta_kelompok");
  if (error) throw new Error(`ringkas_peta_kelompok: ${error.message}`);
  return Object.fromEntries(
    (data ?? []).map((r) => [r.kelompok, Number(r.jumlah)]),
  );
}

/** Jumlah catatan tiap kelompok di sumbernya, dalam satuan yang ditulis V2. */
function jumlahSumber(isi) {
  const n = (k) => (Array.isArray(isi[k]) ? isi[k].length : isi[k] ? 1 : 0);
  const izin = Array.isArray(isi["leave-requests:all"])
    ? isi["leave-requests:all"]
    : [];
  let hariIzinTotal = 0;
  for (const z of izin) {
    if (!z || typeof z !== "object") continue;
    const mulai = keTanggal(z.startDate ?? z.date);
    const selesai = keTanggal(z.endDate ?? z.dateEnd) ?? mulai;
    if (mulai && selesai) hariIzinTotal += hariIzin(mulai, selesai).length;
  }
  return {
    "users:list": n("users:list"),
    "affiliate-accounts:all": n("affiliate-accounts:all"),
    "daily-reports:all": n("daily-reports:all"),
    "attendance:config": n("attendance:config"),
    // Kejadian masuk/pulang → hari; itulah yang menjadi baris V2.
    "attendance:all": Array.isArray(isi["attendance:all"])
      ? hariDariKejadian(isi["attendance:all"]).length
      : 0,
    "attendance:all (kejadian)": n("attendance:all"),
    "leave-requests:all": n("leave-requests:all"),
    "leave-requests:all (hari)": hariIzinTotal,
    "tasks:all": n("tasks:all"),
    "todos:all": n("todos:all"),
    "keuangan:cashflow": n("keuangan:cashflow"),
  };
}

async function potretAnggota(sb) {
  const { data, error } = await sb
    .from("users")
    .select("id, nama, role, unit_id, status, jabatan, atasan_id, kontak")
    .order("nama");
  if (error) throw new Error(`users: ${error.message}`);
  return new Map((data ?? []).map((u) => [u.id, u]));
}

async function potretAkun(sb) {
  const { data, error } = await sb
    .from("accounts")
    .select(
      "id, username, unit_id, program_id, pic_user_id, co_leader_id, status",
    )
    .order("username");
  if (error) throw new Error(`accounts: ${error.message}`);
  return new Map((data ?? []).map((a) => [a.id, a]));
}

/**
 * Transaksi aset lama yang sudah punya padanan di register aset V2.
 *
 * Transaksi berjenis aset yang dibayar otomatis melahirkan baris `assets`
 * (0105). Kalau barangnya sudah dicatat orang di V2, migrasi akan membuat
 * barang kedua — dan itu tidak bisa dicegah dari luar basis data. Jadi
 * yang bertabrakan (tanggal dan nilai sama) tidak dipindahkan dulu, dan
 * disebut di laporan supaya diputuskan orang.
 */
async function asetBertabrakan(sb, isi) {
  const { data: aset, error } = await sb
    .from("assets")
    .select("id, kode, nama, tanggal, nilai_perolehan, transaction_id");
  if (error) throw new Error(`assets: ${error.message}`);
  if (!aset || aset.length === 0) return [];

  const perKunci = new Map();
  for (const a of aset) {
    if (a.transaction_id) continue;
    const k = `${a.tanggal}#${Number(a.nilai_perolehan)}`;
    perKunci.set(k, [...(perKunci.get(k) ?? []), a]);
  }

  const tabrakan = [];
  const kas = Array.isArray(isi["keuangan:cashflow"])
    ? isi["keuangan:cashflow"]
    : [];
  for (const k of kas) {
    if (!k || typeof k !== "object") continue;
    const arah = arahV1(k.type ?? k.tipe);
    if (arah !== "keluar" || jenisKeluarV1(k.category ?? k.kategori) !== "aset")
      continue;
    const tanggal = keTanggal(k.date ?? k.tanggal);
    const jumlah = keAngka(k.amount ?? k.jumlah);
    if (!tanggal || jumlah === null) continue;
    const cocok = perKunci.get(`${tanggal}#${jumlah}`);
    if (cocok)
      tabrakan.push({
        idLama: k.id,
        tanggal,
        jumlah,
        aset: cocok.map((a) => `${a.kode} ${a.nama}`),
      });
  }
  return tabrakan;
}

async function bacaPengaturan(sb) {
  const { data } = await sb
    .from("pengaturan")
    .select("jam_masuk, toleransi_menit, radius_meter, kantor_lat, kantor_lng")
    .maybeSingle();
  return data ?? null;
}

async function keteranganSumber(sb) {
  const { data } = await sb
    .from("kv_unggahan")
    .select("berkas, dimuat_pada, jumlah_kunci, jumlah_entri")
    .order("dimuat_pada", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function petaMenggantung(sb) {
  const { data, error } = await sb.rpc("peta_menggantung");
  if (error) return `galat: ${error.message}`;
  return (data ?? []).length;
}

async function jalanTerbuka(sb) {
  const { data } = await sb
    .from("migrasi_jalan")
    .select("id, tahap, dimulai_pada")
    .is("selesai_pada", null)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Pesan catatan disamakan polanya supaya bisa dihitung per sebab. */
function polaPesan(pesan) {
  return pesan
    .replace(/\([^)]*\)/g, "(…)")
    .replace(/'[^']*'/g, "'…'")
    .replace(/\d{4}-\d{2}-\d{2}/g, "<tanggal>")
    .replace(/\s+/g, " ")
    .trim();
}

function kelompokkanCatatan(catatan) {
  const peta = new Map();
  for (const c of catatan) {
    const pola = polaPesan(c.pesan);
    const ada = peta.get(pola) ?? { pola, jumlah: 0, contoh: [] };
    ada.jumlah += 1;
    if (ada.contoh.length < 3) ada.contoh.push(c.idLama);
    peta.set(pola, ada);
  }
  return [...peta.values()].sort((a, b) => b.jumlah - a.jumlah);
}

const angka = (n) =>
  typeof n === "number" ? n.toLocaleString("id-ID") : String(n);
const garis = (...sel) => `| ${sel.join(" | ")} |`;

// ---------------------------------------------------------------------
// Jalan
// ---------------------------------------------------------------------
const sb = await klienServer();
const proyek = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host;
const dipilih = KELOMPOK.filter((g) => !HANYA || HANYA.has(g.kunci));
const mulaiSemua = Date.now();
const stempel = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

console.log(
  `\n=== Migrasi V1 → V2 · tahap ${TAHAP} · proyek ${proyek} · ${new Date().toLocaleString("id-ID")}`,
);
console.log(`Kelompok: ${dipilih.map((g) => g.kunci).join(" → ")}`);
if (TAHAP === "uji_coba")
  console.log("Uji coba: tidak satu baris pun ditulis ke tabel tujuan.");

const sumberKeterangan = await keteranganSumber(sb);
if (sumberKeterangan) {
  console.log(
    `Sumber: kv_store_lama dari berkas "${sumberKeterangan.berkas}" (dimuat ${sumberKeterangan.dimuat_pada}, ${sumberKeterangan.jumlah_kunci} kunci, ${angka(sumberKeterangan.jumlah_entri)} entri)`,
  );
} else {
  console.log("Sumber: kv_store_lama (tidak ada catatan unggahan).");
}

const isi = await isiEksporLama();
if (Object.keys(isi).length === 0) {
  console.error(
    "kv_store_lama kosong atau tidak terbaca; tidak ada yang bisa dimigrasikan.",
  );
  process.exit(1);
}
const sumber = jumlahSumber(isi);

// Pembanding: berkas backup V1 di komputer ini, bila diberikan.
let sumberBerkas = null;
if (BERKAS_BACKUP) {
  const dibaca = bacaEksporV1(
    JSON.parse(fs.readFileSync(BERKAS_BACKUP, "utf8")),
  );
  if (!dibaca.ok) {
    console.error(`Berkas backup tidak terbaca: ${dibaca.sebab}`);
    process.exit(2);
  }
  const isiBerkas = Object.fromEntries(
    dibaca.isi.map((i) => [i.kunci, i.nilai]),
  );
  sumberBerkas = {
    nama: path.basename(BERKAS_BACKUP),
    diekspor: dibaca.meta?.diekspor ?? null,
    jumlah: jumlahSumber(isiBerkas),
  };
}

// Baseline
let barisAwal = null;
let petaAwal = null;
let anggotaAwal = null;
let akunAwal = null;
if (!TANPA_BASELINE) {
  console.log("\n--- Baseline (sebelum) ---");
  [barisAwal, petaAwal, anggotaAwal, akunAwal] = await Promise.all([
    hitungTabel(sb),
    petaPerKelompok(sb),
    potretAnggota(sb),
    potretAkun(sb),
  ]);
  for (const t of TABEL)
    console.log(`  ${t.padEnd(14)} ${angka(barisAwal[t])} baris`);
  console.log("  migrasi_peta per kelompok:");
  for (const g of KELOMPOK)
    console.log(
      `    ${g.kunci.padEnd(24)} ${angka(petaAwal[g.kunci] ?? 0)} / sumber ${angka(sumber[g.kunci] ?? 0)}`,
    );
  const menggantung = await petaMenggantung(sb);
  if (menggantung !== 0)
    console.log(
      `  ! peta menggantung (tujuan sudah tidak ada): ${menggantung}`,
    );
  const terbuka = await jalanTerbuka(sb);
  if (terbuka)
    console.log(
      `  ! ada jalan migrasi web yang masih terbuka: ${terbuka.tahap} sejak ${terbuka.dimulai_pada} (tidak disentuh skrip ini)`,
    );
  if (sumberBerkas) {
    console.log(
      `  berkas backup lokal: ${sumberBerkas.nama} (diekspor ${sumberBerkas.diekspor ?? "?"})`,
    );
    for (const k of Object.keys(sumber)) {
      const a = sumber[k] ?? 0;
      const b = sumberBerkas.jumlah[k] ?? 0;
      if (a !== b)
        console.log(
          `    ! ${k}: kv_store_lama ${angka(a)} ≠ berkas ${angka(b)}`,
        );
    }
  }
}

const pengaturanAwal = await bacaPengaturan(sb);
const konfigLama = isi["attendance:config"];
if (pengaturanAwal && konfigLama && typeof konfigLama === "object") {
  console.log(
    `  pengaturan absensi V2 sekarang: jam ${pengaturanAwal.jam_masuk}, toleransi ${pengaturanAwal.toleransi_menit} mnt, radius ${pengaturanAwal.radius_meter} m, (${pengaturanAwal.kantor_lat}, ${pengaturanAwal.kantor_lng})`,
  );
  console.log(
    `  pengaturan absensi V1: jam ${konfigLama.jamMasuk}, toleransi ${konfigLama.toleransiMenit} mnt, radius ${konfigLama.radiusMeter ?? konfigLama.radiusM} m, (${konfigLama.lokasi?.lat ?? konfigLama.lokasiLat}, ${konfigLama.lokasi?.lng ?? konfigLama.lokasiLng})`,
  );
}

// Transaksi aset yang sudah ada barangnya di V2: diputuskan orang, bukan
// digandakan diam-diam.
const tabrakanAset = await asetBertabrakan(sb, isi);
if (tabrakanAset.length > 0) {
  console.log(
    `\n! ${tabrakanAset.length} transaksi aset lama cocok dengan aset yang sudah ada di V2; kelompok keuangan:cashflow TIDAK dijalankan:`,
  );
  for (const t of tabrakanAset)
    console.log(
      `  · ${t.idLama} ${t.tanggal} Rp${angka(t.jumlah)} ↔ ${t.aset.join(", ")}`,
    );
}

// Eksekusi per kelompok
const hasilSemua = [];
for (const g of dipilih) {
  const total = sumber[g.kunci] ?? 0;
  console.log(`\n>>> ${g.label} (${g.kunci}) — ${angka(total)} catatan sumber`);
  pantau.reset(g.label, total);
  const mulai = Date.now();
  let hasil;
  try {
    if (g.kunci === "keuangan:cashflow" && tabrakanAset.length > 0) {
      throw new Error(
        `Ditunda: ${tabrakanAset.length} transaksi aset cocok dengan aset V2 yang sudah ada (${tabrakanAset.map((t) => t.idLama).join(", ")}). Putuskan dulu, lalu jalankan --hanya=keuangan:cashflow.`,
      );
    }
    hasil = await g.jalankan(TAHAP);
  } catch (e) {
    hasil = {
      kelompok: g.kunci,
      diperiksa: 0,
      ditulis: 0,
      tertahan: 0,
      gagalTotal: true,
      catatan: [
        { idLama: "-", pesan: e instanceof Error ? e.message : String(e) },
      ],
    };
  }
  const detik = ((Date.now() - mulai) / 1000).toFixed(1);
  hasilSemua.push({
    ...hasil,
    label: g.label,
    tabel: g.tabel,
    sumber: total,
    detik,
  });
  console.log(
    `    diperiksa ${angka(hasil.diperiksa)} · ditulis ${angka(hasil.ditulis)} · tertahan ${angka(hasil.tertahan)} · catatan ${angka(hasil.catatan.length)} · ${detik} dtk`,
  );
  for (const k of kelompokkanCatatan(hasil.catatan).slice(0, 6)) {
    console.log(`    · ${k.jumlah}× ${k.pola} (mis. ${k.contoh.join(", ")})`);
  }
}

// Verifikasi ulang
console.log("\n--- Verifikasi (sesudah) ---");
const [barisAkhir, petaAkhir, anggotaAkhir, akunAkhir] = await Promise.all([
  hitungTabel(sb),
  petaPerKelompok(sb),
  potretAnggota(sb),
  potretAkun(sb),
]);
for (const t of TABEL) {
  const awal = barisAwal ? barisAwal[t] : "?";
  console.log(`  ${t.padEnd(14)} ${angka(awal)} → ${angka(barisAkhir[t])}`);
}

const barisLaporan = [];
for (const h of hasilSemua) {
  const peta = petaAkhir[h.kelompok] ?? 0;
  const target =
    h.kelompok === "leave-requests:all"
      ? (sumber["leave-requests:all (hari)"] ?? 0)
      : h.sumber;
  const status =
    TAHAP === "uji_coba"
      ? "uji coba"
      : h.kelompok === "attendance:config"
        ? h.ditulis === 1
          ? "cocok"
          : "selisih"
        : peta >= target
          ? "cocok"
          : `selisih ${angka(target - peta)}`;
  barisLaporan.push({ ...h, peta, target, status });
  console.log(
    `  ${h.kunci ?? h.kelompok}`.padEnd(26) +
      ` sumber ${angka(target)} · peta ${angka(peta)} · ${status}`,
  );
}

// Perubahan profil anggota
const perubahanAnggota = [];
if (anggotaAwal) {
  for (const [id, sesudah] of anggotaAkhir) {
    const sebelum = anggotaAwal.get(id);
    if (!sebelum) continue;
    const beda = [];
    for (const k of [
      "role",
      "unit_id",
      "status",
      "jabatan",
      "atasan_id",
      "kontak",
    ]) {
      if ((sebelum[k] ?? null) !== (sesudah[k] ?? null))
        beda.push(`${k}: ${sebelum[k] ?? "∅"} → ${sesudah[k] ?? "∅"}`);
    }
    if (beda.length > 0) perubahanAnggota.push({ nama: sesudah.nama, beda });
  }
  if (perubahanAnggota.length > 0) {
    console.log(`\n  Profil anggota yang berubah: ${perubahanAnggota.length}`);
    for (const p of perubahanAnggota)
      console.log(`    · ${p.nama}: ${p.beda.join("; ")}`);
  }
}

// Perubahan akun affiliator
const perubahanAkun = [];
if (akunAwal) {
  for (const [id, sesudah] of akunAkhir) {
    const sebelum = akunAwal.get(id);
    if (!sebelum) {
      perubahanAkun.push({ username: sesudah.username, beda: ["baru dibuat"] });
      continue;
    }
    const beda = [];
    for (const k of [
      "unit_id",
      "program_id",
      "pic_user_id",
      "co_leader_id",
      "status",
    ]) {
      if ((sebelum[k] ?? null) !== (sesudah[k] ?? null))
        beda.push(`${k}: ${sebelum[k] ?? "∅"} → ${sesudah[k] ?? "∅"}`);
    }
    if (beda.length > 0)
      perubahanAkun.push({ username: sesudah.username, beda });
  }
  if (perubahanAkun.length > 0) {
    console.log(`\n  Akun yang dibuat/berubah: ${perubahanAkun.length}`);
    for (const p of perubahanAkun)
      console.log(`    · ${p.username}: ${p.beda.join("; ")}`);
  }
}

// ---------------------------------------------------------------------
// Laporan
// ---------------------------------------------------------------------
fs.mkdirSync(DIR_LAPORAN, { recursive: true });
const jalurMd = path.join(
  DIR_LAPORAN,
  `laporan-migrasi-v1-${TAHAP}-${stempel}.md`,
);
const jalurJson = path.join(
  DIR_LAPORAN,
  `catatan-migrasi-v1-${TAHAP}-${stempel}.json`,
);

const md = [];
md.push(`# Laporan migrasi K-Space V1 → V2`);
md.push("");
md.push(
  `- Waktu: ${new Date().toLocaleString("id-ID")} (durasi ${((Date.now() - mulaiSemua) / 1000).toFixed(0)} dtk)`,
);
md.push(`- Tahap: **${TAHAP}** · proyek \`${proyek}\``);
md.push(
  `- Sumber: kv_store_lama${sumberKeterangan ? ` — berkas "${sumberKeterangan.berkas}", dimuat ${sumberKeterangan.dimuat_pada}` : ""}`,
);
if (sumberBerkas)
  md.push(
    `- Pembanding: ${sumberBerkas.nama} (diekspor ${sumberBerkas.diekspor ?? "?"})`,
  );
md.push(`- Permintaan baca yang diulang karena jaringan: ${pantau.diulang}`);
md.push("");
md.push("## Jumlah baris tabel tujuan");
md.push("");
md.push(garis("Tabel", "Sebelum", "Sesudah", "Selisih"));
md.push(garis("---", "---:", "---:", "---:"));
for (const t of TABEL) {
  const a = barisAwal ? barisAwal[t] : null;
  const b = barisAkhir[t];
  md.push(
    garis(
      t,
      a === null ? "?" : angka(a),
      angka(b),
      typeof a === "number" && typeof b === "number" ? angka(b - a) : "?",
    ),
  );
}
md.push("");
md.push("## Hasil per kelompok");
md.push("");
md.push(
  garis(
    "Kelompok",
    "Tabel",
    "Sumber (expected)",
    "Diperiksa",
    "Ditulis",
    "Tertahan",
    "Peta sebelum",
    "Peta sesudah (actual)",
    "Status",
  ),
);
md.push(
  garis("---", "---", "---:", "---:", "---:", "---:", "---:", "---:", "---"),
);
for (const h of barisLaporan) {
  md.push(
    garis(
      h.kelompok,
      h.tabel,
      angka(h.target),
      angka(h.diperiksa),
      angka(h.ditulis),
      angka(h.tertahan),
      angka(petaAwal ? (petaAwal[h.kelompok] ?? 0) : "?"),
      angka(h.peta),
      h.status,
    ),
  );
}
md.push("");
md.push(
  "Catatan satuan: `attendance:all` dihitung per hari kehadiran (kejadian masuk/pulang digabung per orang per hari); " +
    `sumber punya ${angka(sumber["attendance:all (kejadian)"])} kejadian → ${angka(sumber["attendance:all"])} hari. ` +
    "`leave-requests:all` dihitung per hari izin (" +
    angka(sumber["leave-requests:all"]) +
    " pengajuan → " +
    angka(sumber["leave-requests:all (hari)"]) +
    " hari).",
);
md.push("");
md.push("## Sebab tertahan / gagal, dikelompokkan");
md.push("");
for (const h of barisLaporan) {
  if (h.catatan.length === 0) continue;
  md.push(`### ${h.kelompok} — ${angka(h.catatan.length)} catatan`);
  md.push("");
  for (const k of kelompokkanCatatan(h.catatan)) {
    md.push(
      `- ${angka(k.jumlah)}× ${k.pola} — mis. \`${k.contoh.join("`, `")}\``,
    );
  }
  md.push("");
}
if (anggotaAwal) {
  md.push("## Perubahan profil anggota (users)");
  md.push("");
  if (perubahanAnggota.length === 0) md.push("Tidak ada profil yang berubah.");
  for (const p of perubahanAnggota)
    md.push(`- **${p.nama}**: ${p.beda.join("; ")}`);
  md.push("");
  md.push("## Akun affiliator yang dibuat atau berubah");
  md.push("");
  if (perubahanAkun.length === 0) md.push("Tidak ada akun yang berubah.");
  for (const p of perubahanAkun)
    md.push(`- **${p.username}**: ${p.beda.join("; ")}`);
  md.push("");
}
if (tabrakanAset.length > 0) {
  md.push("## Transaksi aset yang ditunda (aset sudah ada di V2)");
  md.push("");
  for (const t of tabrakanAset)
    md.push(
      `- \`${t.idLama}\` ${t.tanggal} Rp${angka(t.jumlah)} ↔ ${t.aset.join(", ")}`,
    );
  md.push("");
}
md.push(
  `Daftar lengkap catatan per id lama: \`${path.relative(AKAR, jalurJson)}\`.`,
);
md.push("");

fs.writeFileSync(jalurMd, md.join("\n"));
fs.writeFileSync(
  jalurJson,
  JSON.stringify(
    hasilSemua.map((h) => ({
      kelompok: h.kelompok,
      diperiksa: h.diperiksa,
      ditulis: h.ditulis,
      tertahan: h.tertahan,
      catatan: h.catatan,
    })),
    null,
    2,
  ),
);

console.log(`\nLaporan: ${path.relative(AKAR, jalurMd)}`);
console.log(`Catatan lengkap: ${path.relative(AKAR, jalurJson)}`);
console.log(
  `Selesai dalam ${((Date.now() - mulaiSemua) / 1000).toFixed(0)} dtk.\n`,
);

process.exit(hasilSemua.some((h) => h.gagalTotal) ? 1 : 0);
