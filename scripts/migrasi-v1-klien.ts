/**
 * Pengganti `@/lib/supabase/server` untuk skrip migrasi mandiri
 * (`scripts/jalankan-migrasi-v1.mjs`).
 *
 * Mesin migrasi (`@/lib/data/terapkan-migrasi`) meminta klien lewat
 * `klienServer()`, yang di aplikasi membaca sesi dari cookie Next.js. Di
 * luar Next.js tidak ada cookie; yang ada kunci service-role dari env
 * `SUPABASE_SERVICE_ROLE_KEY`. Hook pemuat di skrip utama mengalihkan
 * impor `@/lib/supabase/server` ke berkas ini, sehingga seluruh logika
 * migrasi — termasuk idempotensi lewat `migrasi_peta` — dipakai apa
 * adanya; hanya klien basis datanya yang berbeda.
 *
 * Kuncinya tidak pernah dicetak, tidak pernah dikembalikan, dan tidak
 * pernah disimpan ke berkas mana pun.
 *
 * Fungsi RPC migrasi (0158) memeriksa `lintas_unit()`; tanpa sesi
 * pengguna `auth.uid()` kosong sehingga pemeriksaannya bernilai NULL dan
 * PL/pgSQL melewatkannya — persis seperti seed. Trigger yang membedakan
 * pengguna dan sistem (0041, 0128, 0132) juga memakai `auth.uid() is
 * null` sebagai tanda "dijalankan sistem".
 */
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/types";

/** Kemajuan penulisan; skrip utama menyetel label dan totalnya. */
export const pantau = {
  label: "",
  total: 0,
  ditulis: 0,
  /** Cetak kemajuan tiap sekian catatan. */
  setiap: 20,
  mulai: Date.now(),
  /** Berapa kali permintaan baca diulang karena jaringan. */
  diulang: 0,
  reset(label: string, total: number) {
    this.label = label;
    this.total = total;
    this.ditulis = 0;
    this.mulai = Date.now();
  },
};

/** Setiap catatan yang berhasil pindah diakhiri satu upsert ke peta. */
const JALUR_PETA = /\/rest\/v1\/migrasi_peta(\?|$)/;

function catatTulis() {
  pantau.ditulis += 1;
  if (pantau.ditulis % pantau.setiap !== 0 && pantau.ditulis !== pantau.total) {
    return;
  }
  const detik = ((Date.now() - pantau.mulai) / 1000).toFixed(0);
  console.log(
    `   … ${pantau.ditulis}/${pantau.total} ${pantau.label} tertulis (${detik} dtk)`,
  );
}

const JEDA_ULANG_MS = 500;
const MAKS_ULANG = 3;

/**
 * fetch yang memantau kemajuan dan mengulang permintaan BACA yang putus
 * di jaringan. Penulisan sengaja tidak diulang: baris yang sebenarnya
 * sudah masuk sebelum jaringan putus akan digandakan bila dikirim lagi —
 * biarkan tercatat gagal, lalu jalankan ulang skripnya (idempoten).
 */
async function fetchDipantau(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const metode = (init?.method ?? "GET").toUpperCase();
  const bolehUlang = metode === "GET" || metode === "HEAD";

  for (let percobaan = 0; ; percobaan += 1) {
    try {
      const balasan = await fetch(input, init);
      if (metode === "POST" && balasan.ok && JALUR_PETA.test(url)) {
        catatTulis();
      }
      return balasan;
    } catch (galat) {
      if (!bolehUlang || percobaan >= MAKS_ULANG) throw galat;
      pantau.diulang += 1;
      await new Promise((r) => setTimeout(r, JEDA_ULANG_MS * 2 ** percobaan));
    }
  }
}

type KlienAdmin = ReturnType<typeof createClient<Database>>;

let tunggal: KlienAdmin | null = null;

/** Klien service-role — MELEWATI RLS; hanya untuk skrip migrasi ini. */
export async function klienServer(): Promise<KlienAdmin> {
  if (tunggal) return tunggal;

  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !kunci) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY dan NEXT_PUBLIC_SUPABASE_URL wajib diisi " +
        "(lihat .env.example).",
    );
  }

  tunggal = createClient<Database>(SUPABASE_URL, kunci, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchDipantau },
  });
  return tunggal;
}
