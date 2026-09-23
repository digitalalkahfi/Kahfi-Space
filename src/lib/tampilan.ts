/**
 * Personalisasi tampilan — katalog item dan preferensi; modul murni.
 *
 * Yang diatur di sini bukan gaya visual, melainkan item mana yang
 * tampil di empat permukaan navigasi dan dalam urutan apa. Design
 * system Warm Modern Corporate tidak disentuh sama sekali.
 *
 * Modul ini sengaja tidak mengimpor `lib/navigasi.ts`: di sana ada
 * ikon Lucide, dan menariknya ke sini membuat modul murni ini butuh
 * React untuk sekadar menghitung urutan. Daftar menunya dititipkan
 * pemanggil lewat `SumberNavigasi` — aplikasi mengirim daftar yang
 * sungguhan, test mengirim contoh kecil, dan tidak ada daftar kedua
 * yang bisa melenceng dari yang pertama.
 */
import { bolehLihat, type WidgetBeranda } from "@/lib/akses";
import type { IzinMenu } from "@/lib/navigasi";
import type { Peran } from "@/lib/types";

export const PERMUKAAN = ["sidebar", "dock", "pintasan", "beranda"] as const;

export type PermukaanTampilan = (typeof PERMUKAAN)[number];

export const LABEL_PERMUKAAN: Record<
  PermukaanTampilan,
  { judul: string; keterangan: string }
> = {
  sidebar: {
    judul: "Rail sidebar",
    keterangan: "Ikon menu di sisi kiri layar komputer.",
  },
  dock: {
    judul: "Dock & laci ponsel",
    keterangan: "Lima teratas jadi isi dock bawah; sisanya masuk laci.",
  },
  pintasan: {
    judul: "Pintasan atas",
    keterangan: "Tombol cepat di bar atas layar komputer.",
  },
  beranda: {
    judul: "Widget Beranda",
    keterangan: "Kartu ringkasan yang tampil di halaman Beranda.",
  },
};

export type ItemTampilan = {
  /** Penanda tetap; inilah yang tersimpan sebagai `kunci_item`. */
  kunci: string;
  label: string;
  keterangan: string;
  /** Selalu tampil: tidak bisa dicentang ulang maupun digeser. */
  inti: boolean;
  /**
   * Tempat tetap menu inti: awal atau akhir daftar.
   *
   * Keduanya "selalu tampil", tapi artinya berbeda. Beranda ditambat di
   * depan — ia tujuan setiap kali orang tersesat. Halaman pengaturan
   * ditambat di BELAKANG: kalau ikut di depan, ia memakan satu dari
   * lima slot dock yang seharusnya diisi menu yang dipakai tiap hari,
   * demi halaman yang dibuka sekali sebulan. "Selalu bisa dibuka"
   * sudah dipenuhi laci.
   */
  jangkar: "awal" | "akhir" | null;
  /**
   * Kelompok tempat item ini tergambar.
   *
   * Rail desktop punya dua kelompok terpisah — menu utama di atas,
   * menu pendamping menempel di dasar layar — dan urutan hanya berlaku
   * DI DALAM kelompoknya. Menyimpan kelompoknya di sini membuat
   * pratinjau bisa mengatakannya apa adanya, alih-alih menjanjikan
   * susunan bebas yang tidak akan terjadi.
   */
  grup: "utama" | "pendamping" | null;
};

export type PreferensiItem = { kunci: string; tampil: boolean };

/** Satu daftar berurutan per permukaan. */
export type PreferensiTampilan = Record<PermukaanTampilan, PreferensiItem[]>;

/**
 * Menu yang tidak pernah bisa disembunyikan.
 *
 * Beranda karena ia tujuan setiap kali orang tersesat, dan halaman
 * pengaturan ini sendiri karena menyembunyikannya berarti tidak ada
 * lagi jalan untuk menampilkannya kembali.
 */
export const KUNCI_INTI = ["/beranda", "/tampilan"] as const;

/** Menu inti yang duduk di ujung daftar, bukan di depannya. */
const INTI_DI_AKHIR: readonly string[] = ["/tampilan"];

/** Item dock yang muat di layar ponsel; sisanya pindah ke laci. */
export const MAKS_DOCK = 5;

/**
 * Urutan widget sebagaimana Beranda benar-benar menggambarnya.
 *
 * Bukan urutan `widgetPerPeran` — itu daftar izin, dan urutannya di
 * sana tidak berarti apa-apa. Memakainya sebagai urutan bawaan membuat
 * halaman ini berbohong sejak dibuka: "Posisi kas" ada di baris
 * pertama daftar izin, padahal ia kartu ketujuh di layar.
 */
export const URUTAN_WIDGET: WidgetBeranda[] = [
  "capaianPribadi",
  "wrm",
  "targetBulanan",
  "gmvUnit",
  "statusTim",
  "pantauKehadiran",
  "toDo",
  "tugas",
  "posisiKas",
  "agenda",
  "pengumuman",
];

export const LABEL_WIDGET: Record<
  WidgetBeranda,
  { label: string; keterangan: string }
> = {
  capaianPribadi: {
    label: "Capaian saya",
    keterangan: "Target vs realisasi sasaranmu, 28 hari terakhir",
  },
  wrm: { label: "Matriks WRM", keterangan: "Keputusan ritme pekan ini" },
  targetBulanan: {
    label: "Target bulanan",
    keterangan: "Capaian tiap lini terhadap targetnya",
  },
  gmvUnit: {
    label: "GMV per lini",
    keterangan: "Sumbangan tiap unit hari ini",
  },
  statusTim: {
    label: "Status tim",
    keterangan: "Siapa hadir, izin, dan telat",
  },
  pantauKehadiran: {
    label: "Pantau kehadiran",
    keterangan: "Rekap absensi anggota yang kamu pegang",
  },
  toDo: { label: "To-do hari ini", keterangan: "Daftar pekerjaanmu sendiri" },
  tugas: { label: "Tugas mendesak", keterangan: "Tiket dan tugas jatuh tempo" },
  agenda: {
    label: "Agenda terdekat",
    keterangan: "Jadwal beberapa hari ke depan",
  },
  posisiKas: { label: "Posisi kas", keterangan: "Saldo dan arus kas berjalan" },
  pengumuman: {
    label: "Pengumuman",
    keterangan: "Kabar terbaru dari manajemen",
  },
};

/**
 * Daftar menu yang dititipkan aplikasi.
 *
 * Bentuknya minimal — hanya medan yang dibutuhkan katalog — supaya
 * `menuUtama` dan `menuPendamping` yang membawa ikon tetap bisa
 * dikirim apa adanya.
 */
export type SumberNavigasi = {
  utama: { label: string; href: string }[];
  pendamping: {
    label: string;
    keterangan: string;
    href: string;
    izin?: IzinMenu;
    /** Tidak tergambar di rail desktop; lihat `lib/navigasi.ts`. */
    pintuLainDiDesktop?: boolean;
  }[];
  pintasan: { label: string; keterangan: string; href: string }[];
};

export type KonteksTampilan = {
  peran: Peran;
  izin: Record<IzinMenu, boolean>;
};

function intiKah(href: string) {
  return (KUNCI_INTI as readonly string[]).includes(href);
}

function jangkarDari(href: string): ItemTampilan["jangkar"] {
  if (!intiKah(href)) return null;
  return INTI_DI_AKHIR.includes(href) ? "akhir" : "awal";
}

/**
 * Item yang boleh dipilih pengguna ini, per permukaan.
 *
 * Penyaringannya dua lapis dan keduanya penting: menu pendamping
 * disaring izinnya (`keuangan`, `migrasi`), widget Beranda disaring
 * `widgetPerPeran`. Yang tidak boleh dilihat tidak pernah masuk
 * katalog, jadi ia juga tidak bisa dicentang.
 */
export function katalogTampilan(
  sumber: SumberNavigasi,
  konteks: KonteksTampilan,
): Record<PermukaanTampilan, ItemTampilan[]> {
  const utama: ItemTampilan[] = sumber.utama.map((m) => ({
    kunci: m.href,
    label: m.label,
    keterangan: "Menu utama",
    inti: intiKah(m.href),
    jangkar: jangkarDari(m.href),
    grup: "utama",
  }));

  const pendamping = sumber.pendamping
    .filter((m) => !m.izin || konteks.izin[m.izin])
    .map((m) => ({
      item: {
        kunci: m.href,
        label: m.label,
        keterangan: m.keterangan,
        inti: intiKah(m.href),
        jangkar: jangkarDari(m.href),
        grup: "pendamping" as const,
      },
      diRail: !m.pintuLainDiDesktop,
    }));

  return {
    // Rail desktop tidak memuat menu yang punya pintu masuk lain di
    // desktop. Kalau katalog ini tetap menawarkannya, orang mencentang
    // sesuatu yang memang tidak pernah tergambar di sana — dan mengira
    // pengaturannya rusak.
    sidebar: [
      ...utama,
      ...pendamping.filter((m) => m.diRail).map((m) => m.item),
    ],
    dock: [...utama, ...pendamping.map((m) => m.item)],
    pintasan: sumber.pintasan.map((p) => ({
      kunci: p.href,
      label: p.label,
      keterangan: p.keterangan,
      inti: false,
      jangkar: null,
      grup: null,
    })),
    beranda: URUTAN_WIDGET.filter((w) => bolehLihat(konteks.peran, w)).map(
      (w) => ({
        kunci: w,
        label: LABEL_WIDGET[w].label,
        keterangan: LABEL_WIDGET[w].keterangan,
        inti: false,
        jangkar: null,
        grup: null,
      }),
    ),
  };
}

/**
 * Susunan awal: semua tercentang, urutan katalog, jangkar diterapkan.
 *
 * Bukan sekadar menyalin urutan katalog. Katalog menaruh halaman
 * pengaturan di tengah daftar menu pendamping, sementara jangkarnya
 * menempatkannya di paling akhir — jadi "urutan katalog" bukan susunan
 * yang pernah dilihat siapa pun. Bawaan harus sama persis dengan yang
 * tergambar saat belum ada yang diatur, kalau tidak perbandingan
 * apa pun terhadapnya (mis. `urutanBerubah`) akan selalu bilang
 * "sudah berubah".
 */
export function preferensiBawaan(
  katalog: Record<PermukaanTampilan, ItemTampilan[]>,
): PreferensiTampilan {
  return selaraskanPreferensi(katalog, null);
}

/**
 * Menyelaraskan preferensi tersimpan dengan katalog yang berlaku.
 *
 * Tiga hal dikerjakan sekaligus, dan ketiganya harus terjadi di server
 * juga (bukan hanya di layar):
 *
 * - **Kunci asing dibuang.** Baris yang tersimpan di luar wewenang
 *   peran — entah karena perannya turun atau karena seseorang menulis
 *   langsung ke tabelnya — tidak pernah ikut tergambar. Personalisasi
 *   hanya boleh mengurangi akses, tidak pernah menambah.
 * - **Item baru ikut muncul.** Menu yang lahir setelah preferensinya
 *   tersimpan diletakkan di akhir dalam keadaan tampil, bukan hilang
 *   diam-diam sampai orangnya menekan "kembalikan ke bawaan".
 * - **Menu inti dipaksa tampil dan kembali ke tempatnya.** Ia tidak
 *   bisa dimatikan lewat jalur mana pun, dan posisinya tidak
 *   bergantung pada urutan tersimpan — Beranda di depan, halaman
 *   pengaturan di belakang (lihat `jangkar`).
 */
export function selaraskanPreferensi(
  katalog: Record<PermukaanTampilan, ItemTampilan[]>,
  tersimpan: Partial<PreferensiTampilan> | null,
): PreferensiTampilan {
  const hasil = {} as PreferensiTampilan;

  for (const permukaan of PERMUKAAN) {
    const sah = new Map(katalog[permukaan].map((i) => [i.kunci, i]));
    const urut: PreferensiItem[] = [];
    const sudah = new Set<string>();

    for (const baris of tersimpan?.[permukaan] ?? []) {
      const item = sah.get(baris.kunci);
      if (!item || sudah.has(baris.kunci)) continue;
      sudah.add(baris.kunci);
      urut.push({ kunci: baris.kunci, tampil: item.inti || baris.tampil });
    }

    for (const item of katalog[permukaan]) {
      if (sudah.has(item.kunci)) continue;
      urut.push({ kunci: item.kunci, tampil: true });
    }

    // Menu inti tidak ikut digeser, jadi posisinya tidak boleh
    // bergantung pada urutan yang tersimpan.
    const jangkar = (b: PreferensiItem) => sah.get(b.kunci)?.jangkar ?? null;
    hasil[permukaan] = [
      ...urut.filter((b) => jangkar(b) === "awal"),
      ...urut.filter((b) => jangkar(b) === null),
      ...urut.filter((b) => jangkar(b) === "akhir"),
    ];
  }

  return hasil;
}

/** Item yang benar-benar tergambar di sebuah permukaan, sudah urut. */
export function itemTerlihat(
  katalog: Record<PermukaanTampilan, ItemTampilan[]>,
  preferensi: PreferensiTampilan,
  permukaan: PermukaanTampilan,
): ItemTampilan[] {
  const peta = new Map(katalog[permukaan].map((i) => [i.kunci, i]));
  return preferensi[permukaan]
    .filter((b) => b.tampil)
    .map((b) => peta.get(b.kunci))
    .filter((i): i is ItemTampilan => i !== undefined);
}

/**
 * Apakah urutannya sudah berbeda dari susunan bawaan?
 *
 * Dipakai dialog konfirmasi reset. Menyebut "urutan kembali seperti
 * semula" pada orang yang tidak pernah menggeser apa pun membuat
 * peringatannya terasa mengada-ada — dan peringatan yang terasa
 * mengada-ada adalah peringatan yang dilewati tanpa dibaca.
 */
export function urutanBerubah(
  katalog: Record<PermukaanTampilan, ItemTampilan[]>,
  preferensi: PreferensiTampilan,
): boolean {
  const awal = preferensiBawaan(katalog);
  for (const permukaan of PERMUKAAN) {
    const bawaan = awal[permukaan].map((b) => b.kunci);
    const kini = preferensi[permukaan].map((b) => b.kunci);
    if (kini.length !== bawaan.length) return true;
    if (kini.some((kunci, i) => kunci !== bawaan[i])) return true;
  }
  return false;
}

/**
 * Memindahkan satu item ke posisi item lain.
 *
 * Dipisah dari komponennya supaya bisa diuji tanpa browser: gestur
 * seretnya milik pustaka, tapi apa yang terjadi pada urutannya milik
 * kita. Kunci yang tidak dikenal dikembalikan apa adanya — seretan
 * yang berakhir di luar daftar tidak boleh mengacak isinya.
 */
export function pindahkanItem(
  daftar: PreferensiItem[],
  dari: string,
  ke: string,
): PreferensiItem[] {
  if (dari === ke) return daftar;
  const i = daftar.findIndex((b) => b.kunci === dari);
  const j = daftar.findIndex((b) => b.kunci === ke);
  if (i < 0 || j < 0) return daftar;

  const hasil = [...daftar];
  const [pindah] = hasil.splice(i, 1);
  hasil.splice(j, 0, pindah);
  return hasil;
}

/**
 * Memecah daftar dock jadi isi dock dan isi laci.
 *
 * Batasnya lebar layar, bukan selera: enam ikon berjajar di ponsel
 * membuat masing-masing terlalu sempit untuk disentuh dengan yakin.
 */
export function pecahDock<T>(item: T[]): { dock: T[]; laci: T[] } {
  return { dock: item.slice(0, MAKS_DOCK), laci: item.slice(MAKS_DOCK) };
}
