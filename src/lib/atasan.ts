/**
 * Aturan garis pelaporan — modul murni, dipakai server maupun browser.
 *
 * Hierarkinya satu dan tegas, dari atas ke bawah:
 *
 *     CEO → Manager → Leader → Co-Leader → Staff
 *
 * Manager melapor ke CEO. Seluruh Leader melapor ke Manager — bukan ke
 * CEO, bukan ke Leader lain. Co-Leader melapor ke Leader unitnya. Staff
 * melapor ke Co-Leader atau Leader unitnya. Finance berdiri di luar unit
 * dan melapor ke CEO atau Manager.
 *
 * Aturannya ditegakkan di sini, lalu dipakai tiga tempat yang harus
 * bercerita sama: dialog atasan, formulir anggota, dan Server Action
 * yang menyimpannya. Basis data ikut menjaga peringkatnya (0070), tetapi
 * pesan yang dibaca orang harus menyebut aturannya, bukan nomor kendala.
 */
import { peringkatPeran } from "@/lib/peran";
import type { AnggotaTim, MataRantai, Peran } from "@/lib/types";

export type Peringatan = {
  nada: "hati-hati" | "salah";
  pesan: string;
};

/** Potongan anggota yang cukup untuk menilai sebuah garis pelaporan. */
export type OrangPelaporan = Pick<
  AnggotaTim,
  "id" | "nama" | "role" | "unitNama"
> & {
  /** Program di dalam unit (mis. Mabit Scholar); mempersempit usulan. */
  programId?: string | null;
};

export type OpsiAturan = {
  /**
   * Ada Manager aktif? Tanpa satu pun Manager, Leader boleh melapor
   * langsung ke CEO — organisasi tidak boleh putus hanya karena kursi
   * Manager sedang kosong.
   */
  adaManager?: boolean;
};

/** Peran yang boleh menjadi atasan langsung tiap peran, urut prioritas. */
export const ATASAN_UNTUK: Record<Peran, readonly Peran[]> = {
  CEO: [],
  Manager: ["CEO"],
  Leader: ["Manager"],
  "Co-Leader": ["Leader"],
  Staff: ["Co-Leader", "Leader"],
  Finance: ["CEO", "Manager"],
};

/** Peran yang atasannya harus dari unit yang sama. */
const SEUNIT: ReadonlySet<Peran> = new Set<Peran>(["Co-Leader", "Staff"]);

/** Nama unit semu bagi yang tidak ditempatkan di unit mana pun. */
export const UNIT_MANAJEMEN = "Manajemen";

/**
 * Staff tim manajemen: tanpa unit, bekerja langsung di bawah CEO atau
 * Manager — administrasi, tata kelola, sekretariat. Bukan bagian dari
 * unit pelaporan mana pun, jadi tidak tertagih laporan unit.
 */
export function stafManajemen(a: Pick<OrangPelaporan, "role" | "unitNama">) {
  return a.role === "Staff" && a.unitNama === UNIT_MANAJEMEN;
}

/** Ke siapa seseorang melapor menurut aturan, dan apakah harus seunit. */
export function jenjangAtasan(
  a: Pick<OrangPelaporan, "role" | "unitNama">,
  opsi: OpsiAturan = {},
): { boleh: Peran[]; seunit: boolean } {
  if (stafManajemen(a)) return { boleh: ["Manager", "CEO"], seunit: false };
  const boleh: Peran[] = [...ATASAN_UNTUK[a.role]];
  if (a.role === "Leader" && opsi.adaManager === false) boleh.push("CEO");
  return { boleh, seunit: SEUNIT.has(a.role) };
}

export function sebutPeran(daftar: readonly Peran[]) {
  if (daftar.length <= 1) return daftar.join("");
  return `${daftar.slice(0, -1).join(", ")} atau ${daftar.at(-1)}`;
}

/** Ada Manager aktif di daftar? Dipakai menilai apakah Leader boleh ke CEO. */
export function adaManagerAktif(
  semua: readonly Pick<AnggotaTim, "role" | "status">[],
) {
  return semua.some((a) => a.status === "aktif" && a.role === "Manager");
}

/**
 * Mengapa `calon` tidak boleh menjadi atasan `anggota`, atau null bila
 * boleh. Inilah satu-satunya tempat aturannya ditulis.
 */
export function sebabAtasanTakSah(
  anggota: OrangPelaporan,
  calon: OrangPelaporan,
  opsi: OpsiAturan = {},
): string | null {
  if (calon.id === anggota.id) {
    return "Seseorang tidak bisa menjadi atasan dirinya sendiri.";
  }
  if (anggota.role === "CEO") {
    return "CEO berada di puncak dan tidak melapor kepada siapa pun.";
  }

  const { boleh, seunit } = jenjangAtasan(anggota, opsi);
  if (!boleh.includes(calon.role)) {
    const sebutan = stafManajemen(anggota)
      ? "Staff tim manajemen"
      : anggota.role;
    return `${sebutan} melapor kepada ${sebutPeran(boleh)}, bukan kepada ${calon.role} (${calon.nama}).`;
  }

  if (seunit && calon.unitNama !== anggota.unitNama) {
    return `${calon.nama} memimpin ${calon.unitNama}, sedangkan ${anggota.nama} di ${anggota.unitNama}. ${anggota.role} melapor ke pimpinan unitnya sendiri.`;
  }

  return null;
}

/**
 * Peringatan atas sebuah penetapan atasan.
 *
 * Yang melanggar hierarki ditandai salah dan tidak bisa disimpan. Tanpa
 * atasan tidak dilarang — tetapi disebut akibatnya, karena atasan
 * menentukan siapa boleh menugasi dan menyetujui izin.
 */
export function peringatanAtasan(
  anggota: OrangPelaporan,
  calon: OrangPelaporan | null,
  opsi: OpsiAturan = {},
): Peringatan[] {
  if (!calon) {
    if (anggota.role === "CEO") return [];
    return [
      {
        nada: "hati-hati",
        pesan:
          "Tanpa atasan, tidak ada yang berwenang menyetujui izin atau menugasi orang ini di luar unitnya.",
      },
    ];
  }

  const sebab = sebabAtasanTakSah(anggota, calon, opsi);
  return sebab ? [{ nada: "salah", pesan: sebab }] : [];
}

/**
 * Calon atasan yang sah: aktif, bukan dirinya, bukan bawahannya, dan
 * memenuhi hierarki. Diurutkan dari cakupan terluas, lalu nama.
 */
export function calonAtasan(
  semua: readonly AnggotaTim[],
  anggota: OrangPelaporan,
  idBawahan: ReadonlySet<string>,
): AnggotaTim[] {
  const opsi = { adaManager: adaManagerAktif(semua) };
  return semua
    .filter(
      (a) =>
        a.status === "aktif" &&
        a.id !== anggota.id &&
        !idBawahan.has(a.id) &&
        sebabAtasanTakSah(anggota, a, opsi) === null,
    )
    .sort(
      (a, b) =>
        peringkatPeran(a.role) - peringkatPeran(b.role) ||
        a.nama.localeCompare(b.nama),
    );
}

/**
 * Atasan yang paling masuk akal untuk seseorang, atau null bila harus
 * diputuskan orang.
 *
 * Mesin hanya mengusulkan bila jawabannya tunggal. Untuk Manager, Leader,
 * dan Finance, jenjang dicoba berurutan (Leader: Manager dulu, CEO hanya
 * bila Manager tidak ada). Untuk Co-Leader dan Staff, pimpinan unitnya
 * yang seprogram didahulukan (Staff Mabit Scholar → Leader Mabit
 * Scholar); bila masih lebih dari satu — unit dengan Leader dan
 * Co-Leader sekaligus — pilihannya bukan urusan mesin.
 */
export function atasanDisarankan(
  semua: readonly AnggotaTim[],
  anggota: OrangPelaporan,
  idBawahan: ReadonlySet<string> = new Set(),
): AnggotaTim | null {
  // Keambiguan dinilai dari seluruh calon yang sah menurut aturan, tanpa
  // mengecualikan bawahannya dulu. Kalau tidak, rantai yang terlanjur
  // terbalik membuat dua calon tampak satu — dan mesin "memutuskan"
  // sesuatu yang sebenarnya bukan urusannya.
  let calon = calonAtasan(semua, anggota, new Set());
  if (calon.length === 0) return null;

  const { boleh: urutan, seunit } = jenjangAtasan(anggota, {
    adaManager: adaManagerAktif(semua),
  });
  if (seunit) {
    const seprogram = calon.filter(
      (c) => (c.programId ?? null) === (anggota.programId ?? null),
    );
    if (seprogram.length > 0) calon = seprogram;
  } else {
    for (const peran of urutan) {
      const seperan = calon.filter((c) => c.role === peran);
      if (seperan.length > 0) {
        calon = seperan;
        break;
      }
    }
  }

  if (calon.length !== 1) return null;
  // Calon tunggal yang saat ini masih bawahannya: rantainya terbalik dan
  // harus dibetulkan dari atas lebih dulu.
  return idBawahan.has(calon[0].id) ? null : calon[0];
}

export type UbahanAtasan = {
  id: string;
  nama: string;
  role: Peran;
  /** Nama atasan saat ini; null bila belum punya. */
  dari: string | null;
  /** Atasan barunya; null berarti dilepas (hanya untuk CEO). */
  ke: { id: string; nama: string; role: Peran } | null;
};

export type ButuhKeputusan = {
  id: string;
  nama: string;
  role: Peran;
  sebab: string;
};

export type PeriksaStruktur = {
  /** Perubahan yang bisa dilakukan mesin tanpa menebak. */
  ubah: UbahanAtasan[];
  /** Orang yang atasannya harus dipilih manusia. */
  butuhKeputusan: ButuhKeputusan[];
};

/**
 * Memeriksa seluruh garis pelaporan anggota aktif terhadap aturannya.
 *
 * Atasan yang sudah sah dibiarkan — merapikan bukan alasan mengganti
 * keputusan yang sudah benar. Yang kosong atau melanggar aturan diberi
 * usulan bila usulannya tunggal; sisanya dikembalikan untuk diputuskan.
 */
export function periksaStruktur(semua: readonly AnggotaTim[]): PeriksaStruktur {
  const perId = new Map(semua.map((a) => [a.id, a]));
  const opsi = { adaManager: adaManagerAktif(semua) };
  const bawahan = petaBawahan(semua);
  const ubah: UbahanAtasan[] = [];
  const butuhKeputusan: ButuhKeputusan[] = [];

  for (const a of semua) {
    if (a.status !== "aktif") continue;

    const kini = a.atasanId ? perId.get(a.atasanId) : undefined;

    // CEO adalah puncak: atasan yang tercatat padanya pasti keliru, dan
    // membiarkannya membuat seluruh rantai di bawahnya tampak berputar.
    if (a.role === "CEO") {
      if (a.atasanId) {
        ubah.push({
          id: a.id,
          nama: a.nama,
          role: a.role,
          dari: kini?.nama ?? a.atasanNama,
          ke: null,
        });
      }
      continue;
    }
    const sahKini =
      kini !== undefined &&
      kini.status === "aktif" &&
      sebabAtasanTakSah(a, kini, opsi) === null;
    if (sahKini) continue;

    const usul = atasanDisarankan(semua, a, new Set(bawahan[a.id] ?? []));
    if (usul) {
      ubah.push({
        id: a.id,
        nama: a.nama,
        role: a.role,
        dari: kini?.nama ?? null,
        ke: { id: usul.id, nama: usul.nama, role: usul.role },
      });
      continue;
    }

    const sebab = kini
      ? kini.status !== "aktif"
        ? `Atasannya (${kini.nama}) sudah nonaktif.`
        : (sebabAtasanTakSah(a, kini, opsi) ?? "")
      : "Belum punya atasan.";
    butuhKeputusan.push({
      id: a.id,
      nama: a.nama,
      role: a.role,
      sebab: `${sebab} Calon yang memenuhi aturan tidak tunggal atau tidak ada; pilih lewat kartu anggotanya.`,
    });
  }

  return { ubah, butuhKeputusan };
}

/**
 * Garis pelaporan tiap orang, diturunkan dari daftar yang sudah dimuat.
 *
 * Dihitung sekali di memori alih-alih satu query per orang. Penelusuran
 * dibatasi agar data yang terlanjur berputar tidak menggantung halaman —
 * database menolak siklus (migrasi 0044), tapi tampilan tidak boleh
 * bergantung pada itu.
 */
export function petaRantai(
  semua: readonly AnggotaTim[],
): Record<string, MataRantai[]> {
  const perId = new Map(semua.map((a) => [a.id, a]));
  const hasil: Record<string, MataRantai[]> = {};

  for (const a of semua) {
    const rantai: MataRantai[] = [];
    const dilewati = new Set<string>([a.id]);
    let kini = a.atasanId ? perId.get(a.atasanId) : undefined;
    let tingkat = 1;

    while (kini && !dilewati.has(kini.id) && tingkat <= 20) {
      rantai.push({
        tingkat,
        userId: kini.id,
        nama: kini.nama,
        jabatan: kini.jabatan,
        role: kini.role,
      });
      dilewati.add(kini.id);
      kini = kini.atasanId ? perId.get(kini.atasanId) : undefined;
      tingkat += 1;
    }

    hasil[a.id] = rantai;
  }

  return hasil;
}

/** Seluruh bawahan tiap orang, langsung maupun lewat bawahannya. */
export function petaBawahan(
  semua: readonly AnggotaTim[],
): Record<string, string[]> {
  const rantai = petaRantai(semua);
  const hasil: Record<string, string[]> = Object.fromEntries(
    semua.map((a) => [a.id, [] as string[]]),
  );

  for (const a of semua) {
    for (const m of rantai[a.id] ?? []) {
      hasil[m.userId]?.push(a.id);
    }
  }

  return hasil;
}
