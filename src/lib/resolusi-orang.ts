/**
 * Menautkan orang V1 ke orang V2 — modul murni.
 *
 * Hampir seluruh data lama menunjuk orang: laporan punya pelapor, tugas
 * punya penerima, transaksi punya pengaju. Semuanya memakai id V1, yang
 * tidak berarti apa-apa di V2. Modul inilah yang menjembatani keduanya.
 *
 * Aturannya sengaja ketat. Menebak salah orang tidak menimbulkan galat
 * apa pun — laporannya tetap masuk, tugasnya tetap punya penerima — dan
 * baru ketahuan ketika seseorang dinilai atas pekerjaan orang lain.
 * Karena itu yang meragukan tidak ditebak, melainkan dikembalikan
 * sebagai "butuh keputusan".
 */

export type OrangLama = {
  id: string;
  nama: string;
  email: string | null;
};

export type OrangBaru = {
  id: string;
  nama: string;
  email: string | null;
};

export type CaraTaut = "email" | "nama";

export type Padanan = {
  idLama: string;
  idBaru: string;
  nama: string;
  cara: CaraTaut;
};

export type BelumTertaut = {
  idLama: string;
  nama: string;
  alasan: string;
};

export type HasilResolusi = {
  padanan: Padanan[];
  belum: BelumTertaut[];
};

/** Surel disamakan bentuknya sebelum dibandingkan. */
function bakuSurel(nilai: string | null | undefined) {
  const teks = (nilai ?? "").trim().toLowerCase();
  return teks === "" ? null : teks;
}

/**
 * Nama disamakan bentuknya: huruf kecil, tanpa gelar dan tanda baca,
 * spasi dirapatkan.
 *
 * "Dr. Rian  Hidayat, S.Kom" dan "rian hidayat" adalah orang yang sama
 * di mata siapa pun kecuali pembandingan teks mentah.
 */
export function bakuNama(nilai: string | null | undefined) {
  const teks = (nilai ?? "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return teks === "" ? null : teks;
}

function petakan<T>(daftar: T[], kunci: (t: T) => string | null) {
  const peta = new Map<string, T[]>();
  for (const item of daftar) {
    const k = kunci(item);
    if (k === null) continue;
    peta.set(k, [...(peta.get(k) ?? []), item]);
  }
  return peta;
}

/**
 * Menautkan seluruh orang V1 ke orang V2.
 *
 * Urutannya: surel dulu — itu yang dijamin unik dan memang dipakai
 * masuk ke sistem — baru nama. Nama hanya dipakai kalau ia menunjuk
 * tepat satu orang di kedua sisi; dua orang bernama sama adalah hal
 * biasa, dan menebak salah satunya adalah cara paling halus menukar
 * riwayat kerja dua orang.
 */
export function resolusiOrang(
  lama: OrangLama[],
  baru: OrangBaru[],
): HasilResolusi {
  const perSurel = petakan(baru, (o) => bakuSurel(o.email));
  const perNama = petakan(baru, (o) => bakuNama(o.nama));
  const namaLamaGanda = petakan(lama, (o) => bakuNama(o.nama));

  const padanan: Padanan[] = [];
  const belum: BelumTertaut[] = [];
  const terpakai = new Map<string, string>();

  for (const o of lama) {
    const surel = bakuSurel(o.email);
    const nama = bakuNama(o.nama);

    let cocok: OrangBaru | null = null;
    let cara: CaraTaut = "email";

    const lewatSurel = surel ? (perSurel.get(surel) ?? []) : [];
    if (lewatSurel.length === 1) {
      cocok = lewatSurel[0];
    } else if (lewatSurel.length > 1) {
      belum.push({
        idLama: o.id,
        nama: o.nama,
        alasan: `Surel ${surel} dipakai lebih dari satu orang di V2.`,
      });
      continue;
    } else {
      const lewatNama = nama ? (perNama.get(nama) ?? []) : [];
      // Nama yang muncul dua kali di data lama juga tidak bisa dipakai:
      // keduanya akan menunjuk orang V2 yang sama.
      const gandaDiLama =
        (nama ? (namaLamaGanda.get(nama) ?? []) : []).length > 1;

      if (lewatNama.length === 1 && !gandaDiLama) {
        cocok = lewatNama[0];
        cara = "nama";
      } else if (lewatNama.length > 1 || gandaDiLama) {
        belum.push({
          idLama: o.id,
          nama: o.nama,
          alasan:
            lewatNama.length > 1
              ? `Ada ${lewatNama.length} orang bernama sama di V2; tidak boleh ditebak.`
              : "Nama ini muncul lebih dari sekali di data lama; tidak boleh ditebak.",
        });
        continue;
      }
    }

    if (!cocok) {
      belum.push({
        idLama: o.id,
        nama: o.nama,
        alasan: surel
          ? `Tidak ada orang V2 bersurel ${surel} atau bernama sama.`
          : "Tidak ada surel maupun nama yang cocok di V2.",
      });
      continue;
    }

    // Satu orang V2 tidak boleh diklaim dua orang V1 — kalau itu terjadi,
    // salah satunya pasti salah, dan sistem tidak tahu yang mana.
    const sudah = terpakai.get(cocok.id);
    if (sudah) {
      belum.push({
        idLama: o.id,
        nama: o.nama,
        alasan: `${cocok.nama} sudah tertaut ke ${sudah}; salah satunya perlu diperiksa orang.`,
      });
      continue;
    }

    terpakai.set(cocok.id, o.id);
    padanan.push({ idLama: o.id, idBaru: cocok.id, nama: o.nama, cara });
  }

  return { padanan, belum };
}

/** Berapa yang tertaut lewat surel, lewat nama, dan yang belum. */
export function ringkasResolusi(hasil: HasilResolusi) {
  return {
    lewatSurel: hasil.padanan.filter((p) => p.cara === "email").length,
    lewatNama: hasil.padanan.filter((p) => p.cara === "nama").length,
    belum: hasil.belum.length,
    total: hasil.padanan.length + hasil.belum.length,
  };
}

export type Saran = {
  id: string;
  nama: string;
  /** 0–1; semakin besar semakin mirip. */
  skor: number;
};

/** Kata-kata penting sebuah nama, tanpa gelar dan tanpa kata pendek. */
function kata(nama: string) {
  return new Set(
    (bakuNama(nama) ?? "")
      .split(" ")
      .filter((k) => k.length >= 3 && !["bin", "binti", "dan"].includes(k)),
  );
}

/**
 * Menyarankan padanan untuk orang yang belum tertaut.
 *
 * Bukan untuk menautkan otomatis — yang meragukan memang tidak boleh
 * ditebak. Ini hanya supaya yang memutuskan tidak perlu membaca dua
 * puluh enam nama satu per satu untuk menemukan yang jelas-jelas mirip,
 * lalu menyerah dan menautkan asal.
 */
export function saranPadanan(
  nama: string,
  calon: OrangBaru[],
  batas = 3,
): Saran[] {
  const kunci = kata(nama);
  if (kunci.size === 0) return [];

  const skorkan = (c: OrangBaru): number => {
    const lawan = kata(c.nama);
    if (lawan.size === 0) return 0;

    let sama = 0;
    for (const k of kunci) if (lawan.has(k)) sama += 1;
    if (sama > 0) return sama / Math.max(kunci.size, lawan.size);

    // Tidak ada kata yang sama persis: awalan yang sama masih berarti
    // sesuatu ("Rizki" vs "Rizky"), tetapi nilainya jauh lebih rendah.
    for (const k of kunci) {
      for (const l of lawan) {
        if (k.length >= 4 && l.length >= 4 && k.slice(0, 4) === l.slice(0, 4)) {
          return 0.25;
        }
      }
    }
    return 0;
  };

  return calon
    .map((c) => ({ id: c.id, nama: c.nama, skor: skorkan(c) }))
    .filter((s) => s.skor > 0)
    .sort((a, b) => b.skor - a.skor || a.nama.localeCompare(b.nama))
    .slice(0, batas);
}
