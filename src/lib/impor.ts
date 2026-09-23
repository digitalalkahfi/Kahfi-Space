/**
 * Mesin impor ekspor K-Space V1 → skema V2. Modul murni: tidak menyentuh
 * database, sehingga setiap aturannya bisa diuji tanpa Supabase.
 *
 * Satu kunci ekspor memuat seluruh catatannya sekaligus (`users:list`
 * berisi semua orang), jadi yang diproses di sini adalah kunci, dan tiap
 * catatan di dalamnya menjadi satu baris hasil tersendiri.
 *
 * Yang dikerjakan di sini adalah bagian yang paling gampang salah diam-
 * diam: mengubah nilai bergaya lama menjadi nilai yang benar. Angka
 * bertanda pemisah ribuan, tanggal terbalik, dan rujukan berupa nama —
 * semuanya bisa "berhasil" masuk database sebagai nilai yang salah bila
 * tidak diperiksa.
 */
import { entitasDari, type EntriKv } from "@/lib/kv-store";
import type { PemetaanEntitas, Ubahan } from "@/lib/pemetaan";
import { PEMETAAN_V1 } from "@/lib/pemetaan-v1";
import type { StatusMigrasi } from "@/lib/migrasi";

/**
 * Padanan nilai lama → id baru, dibangun dari database.
 *
 * Kuncinya sengaja bisa lebih dari satu bentuk untuk hal yang sama:
 * ekspor lama menyebut akun kadang lewat id-nya (`acc_001` di
 * `affiliate-gmv:daily`), kadang lewat username-nya (`"Akun"` di laporan
 * harian). Keduanya didaftarkan supaya pencarian tidak perlu menebak.
 */
export type Kamus = {
  unit: Record<string, string>;
  program: Record<string, string>;
  pengguna: Record<string, string>;
  akun: Record<string, string>;
};

export const KAMUS_KOSONG: Kamus = {
  unit: {},
  program: {},
  pengguna: {},
  akun: {},
};

export type HasilEntri = {
  entitas: string;
  kunciLama: string;
  status: StatusMigrasi;
  pesan: string;
  data: Record<string, unknown> | null;
};

/**
 * Angka dari sistem lama bisa berupa teks berpemisah ribuan.
 *
 * "2.500.000" harus menjadi 2500000, bukan 2.5 — salah tafsir di sini
 * mengecilkan GMV sejuta kali lipat tanpa satu pun galat.
 */
export function keAngka(nilai: unknown): number | null {
  if (typeof nilai === "number") return Number.isFinite(nilai) ? nilai : null;
  if (typeof nilai !== "string") return null;

  const bersih = nilai.trim();
  if (bersih === "") return null;

  // Titik sebagai pemisah ribuan (gaya Indonesia), koma sebagai desimal.
  const tanpaPemisah = bersih.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(tanpaPemisah)) return null;

  const angka = Number(tanpaPemisah);
  return Number.isFinite(angka) ? angka : null;
}

/**
 * Tanggal disatukan ke YYYY-MM-DD.
 *
 * Gaya "24-10-2024" dan "2024-10-24" sama-sama muncul di ekspor lama.
 * Menebaknya salah akan memindahkan laporan ke bulan yang keliru.
 */
export function keTanggal(nilai: unknown): string | null {
  if (typeof nilai !== "string") return null;
  const teks = nilai.trim();
  if (teks === "") return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(teks);
  if (iso) return sahkanTanggal(iso[1], iso[2], iso[3]);

  const terbalik = /^(\d{2})-(\d{2})-(\d{4})$/.exec(teks);
  if (terbalik) return sahkanTanggal(terbalik[3], terbalik[2], terbalik[1]);

  const garisMiring = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(teks);
  if (garisMiring)
    return sahkanTanggal(garisMiring[3], garisMiring[2], garisMiring[1]);

  return null;
}

function sahkanTanggal(th: string, bl: string, hr: string): string | null {
  const tahun = Number(th);
  const bulan = Number(bl);
  const hari = Number(hr);
  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return null;

  // Menolak 31 April dan kawan-kawannya.
  const d = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (
    d.getUTCFullYear() !== tahun ||
    d.getUTCMonth() !== bulan - 1 ||
    d.getUTCDate() !== hari
  ) {
    return null;
  }
  return `${th}-${bl.padStart(2, "0")}-${hr.padStart(2, "0")}`;
}

/** Kamus mana yang dipakai untuk mencari id sebuah kolom. */
function lacakKamus(kolom: string): keyof Kamus | null {
  if (kolom === "unit_id") return "unit";
  if (kolom === "program_id") return "program";
  if (kolom === "account_id") return "akun";
  if (
    kolom === "user_id" ||
    kolom === "pic_user_id" ||
    kolom === "co_leader_id" ||
    kolom === "atasan_id" ||
    kolom === "pemilik_id" ||
    kolom === "pembuat_id" ||
    kolom === "penerima_id" ||
    kolom === "diputuskan_oleh" ||
    kolom === "disetujui_oleh" ||
    kolom === "diajukan_oleh"
  ) {
    return "pengguna";
  }
  return null;
}

function ubah(
  ubahan: Ubahan,
  kolom: string,
  nilai: unknown,
  kamus: Kamus,
): { nilai: unknown; galat?: string } {
  switch (ubahan) {
    case "apa-adanya":
      return { nilai };

    case "huruf-kecil":
      return {
        nilai: typeof nilai === "string" ? nilai.trim().toLowerCase() : nilai,
      };

    case "angka-berpemisah": {
      const angka = keAngka(nilai);
      return angka === null
        ? { nilai: null, galat: `'${String(nilai)}' bukan angka yang sah` }
        : { nilai: angka };
    }

    case "tanggal": {
      const tanggal = keTanggal(nilai);
      return tanggal === null
        ? {
            nilai: null,
            galat: `'${String(nilai)}' bukan tanggal yang dikenali`,
          }
        : { nilai: tanggal };
    }

    case "cari-id": {
      if (nilai === null || nilai === undefined || nilai === "") {
        return { nilai: null };
      }
      const jenis = lacakKamus(kolom);
      if (!jenis)
        return { nilai: null, galat: `tidak tahu mencari id untuk ${kolom}` };

      const id = kamus[jenis][String(nilai)];
      return id
        ? { nilai: id }
        : {
            nilai: null,
            galat: `'${String(nilai)}' tidak ditemukan di ${jenis}`,
          };
    }

    case "bawaan":
      return { nilai: undefined };
  }
}

/** Penanda satu catatan di sistem lama; dipakai sebagai kunci idempoten. */
function idLama(sumber: Record<string, unknown>, urutan: number): string {
  const id = sumber.id;
  return typeof id === "string" && id !== "" ? id : `#${urutan}`;
}

/**
 * Menyiapkan satu catatan untuk ditulis, atau menjelaskan mengapa tidak
 * bisa.
 *
 * Tidak pernah melempar: setiap kegagalan menjadi baris log dengan
 * alasannya, karena migrasi yang berhenti di catatan ke-3.000 tanpa
 * penjelasan jauh lebih mahal daripada yang melaporkan semuanya.
 */
export function siapkanCatatan(
  pemetaan: PemetaanEntitas,
  catatan: unknown,
  kunciLama: string,
  kamus: Kamus,
): HasilEntri {
  if (!catatan || typeof catatan !== "object" || Array.isArray(catatan)) {
    return {
      entitas: pemetaan.kunci,
      kunciLama,
      status: "gagal",
      pesan: "Catatannya kosong atau bukan objek.",
      data: null,
    };
  }

  const sumber = catatan as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  const galat: string[] = [];

  for (const baris of pemetaan.baris) {
    if (baris.medanLama === null) continue;

    const mentah = sumber[baris.medanLama];
    const kosong = mentah === undefined || mentah === null || mentah === "";

    if (kosong) {
      if (baris.wajib) galat.push(`${baris.medanLama} wajib tapi kosong`);
      continue;
    }

    const hasil = ubah(baris.ubahan, baris.kolomBaru, mentah, kamus);
    if (hasil.galat) {
      galat.push(`${baris.medanLama}: ${hasil.galat}`);
      continue;
    }
    if (hasil.nilai === undefined) continue;

    // Beberapa medan bebas sengaja digabung ke satu kolom; yang kedua
    // menempel, bukan menimpa yang pertama.
    if (baris.gabung && typeof data[baris.kolomBaru] === "string") {
      const sudah = data[baris.kolomBaru] as string;
      data[baris.kolomBaru] = `${sudah}\n${String(hasil.nilai)}`.trim();
      continue;
    }
    data[baris.kolomBaru] = hasil.nilai;
  }

  if (galat.length > 0) {
    return {
      entitas: pemetaan.kunci,
      kunciLama,
      status: "gagal",
      pesan: galat.join("; "),
      data: null,
    };
  }

  return {
    entitas: pemetaan.kunci,
    kunciLama,
    status: "berhasil",
    pesan: "",
    data,
  };
}

/**
 * Menyiapkan seluruh catatan di balik satu kunci ekspor.
 *
 * Kunci yang tidak dipetakan dilaporkan sekali sebagai dilewati — bukan
 * diam-diam dibuang, dan bukan pula dihitung sebagai ribuan kegagalan
 * yang menenggelamkan kegagalan sungguhan.
 */
export function siapkanKunci(entri: EntriKv, kamus: Kamus): HasilEntri[] {
  const kunci = entitasDari(entri.key);
  const pemetaan = PEMETAAN_V1.find((p) => p.kunci === kunci);

  if (!pemetaan) {
    return [
      {
        entitas: kunci,
        kunciLama: entri.key,
        status: "dilewati",
        pesan:
          kunci === "(tanpa entitas)"
            ? "Entri tanpa kunci."
            : `Kunci '${kunci}' tidak dipetakan ke skema baru.`,
        data: null,
      },
    ];
  }

  // Kunci berisi satu objek pengaturan (attendance:config) tetap
  // diperlakukan sebagai satu catatan.
  const daftar = Array.isArray(entri.value) ? entri.value : [entri.value];

  return daftar.map((catatan, i) =>
    siapkanCatatan(
      pemetaan,
      catatan,
      `${pemetaan.kunci}:${idLama(
        catatan && typeof catatan === "object"
          ? (catatan as Record<string, unknown>)
          : {},
        i,
      )}`,
      kamus,
    ),
  );
}

/** Menyiapkan seluruh kunci, berurutan sesuai ketergantungannya. */
export function siapkanSemua(entri: EntriKv[], kamus: Kamus): HasilEntri[] {
  const urutan = new Map(PEMETAAN_V1.map((p, i) => [p.kunci, i]));

  return [...entri]
    .sort(
      (a, b) =>
        (urutan.get(entitasDari(a.key)) ?? 99) -
        (urutan.get(entitasDari(b.key)) ?? 99),
    )
    .flatMap((e) => siapkanKunci(e, kamus));
}

/** Ringkasan hasil per entitas, untuk ditampilkan dan disimpan. */
export function ringkasHasil(hasil: HasilEntri[]) {
  const peta = new Map<
    string,
    {
      entitas: string;
      total: number;
      berhasil: number;
      dilewati: number;
      gagal: number;
      menunggu: number;
    }
  >();

  for (const h of hasil) {
    const r = peta.get(h.entitas) ?? {
      entitas: h.entitas,
      total: 0,
      berhasil: 0,
      dilewati: 0,
      gagal: 0,
      menunggu: 0,
    };
    r.total += 1;
    r[h.status] += 1;
    peta.set(h.entitas, r);
  }

  return [...peta.values()].sort((a, b) => a.entitas.localeCompare(b.entitas));
}

/** Ekspor tipe pemetaan agar pemanggil tidak perlu dua impor. */
export type { PemetaanEntitas };
