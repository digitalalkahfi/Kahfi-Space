"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  itemTerlihat,
  preferensiBawaan,
  selaraskanPreferensi,
  type ItemTampilan,
  type PermukaanTampilan,
  type PreferensiItem,
  type PreferensiTampilan,
} from "@/lib/tampilan";
import {
  kembalikanSusunanBawaan,
  simpanSusunan,
} from "@/app/actions/preferensi-tampilan";

type IsiKonteks = {
  preferensi: PreferensiTampilan;
  katalog: Record<PermukaanTampilan, ItemTampilan[]>;
  /** Mengganti susunan SATU permukaan; yang lain tidak ikut dikirim. */
  simpan: (permukaan: PermukaanTampilan, daftar: PreferensiItem[]) => void;
  /** Hapus seluruh pilihan; susunan kembali seperti belum pernah diatur. */
  kembalikanBawaan: () => void;
  /** Ada yang pernah diatur — tombol kembalikan baru berguna bila ini benar. */
  pernahDiatur: boolean;
  /** Perubahan terakhir gagal disimpan; layar dan server tidak sepakat. */
  galat: string | null;
};

const Konteks = createContext<IsiKonteks | null>(null);

/** Penyimpanan mode demo; mode sungguhan memakai tabel per pengguna. */
const KUNCI_SIMPAN = "kspace-tampilan";

/**
 * Tunggu sebentar sebelum menulis ke server.
 *
 * Cukup lama untuk menelan rentetan satu gerakan, cukup singkat untuk
 * tidak terasa sebagai penundaan — dan layar sudah berubah lebih dulu,
 * jadi tidak ada yang menunggu angka ini.
 */
const JEDA_SIMPAN_MS = 400;

const pendengar = new Set<() => void>();

function beritahu() {
  for (const f of pendengar) f();
}

function berlangganan(f: () => void) {
  pendengar.add(f);
  // Tab lain yang mengubah pengaturannya ikut terdengar — dua tab
  // dengan navigasi berbeda membuat orang mengira salah satunya rusak.
  window.addEventListener("storage", f);
  return () => {
    pendengar.delete(f);
    window.removeEventListener("storage", f);
  };
}

/**
 * Snapshot-nya sengaja string mentah, bukan objek hasil parse.
 *
 * `useSyncExternalStore` membandingkan hasil `getSnapshot` dengan
 * `Object.is`; objek baru di tiap panggilan berarti React menganggapnya
 * selalu berubah dan menggambar ulang tanpa henti.
 */
function bacaMentah(): string | null {
  try {
    return localStorage.getItem(KUNCI_SIMPAN);
  } catch {
    // Mode privat: anggap belum ada pengaturan tersimpan.
    return null;
  }
}

/** Di server tidak ada localStorage — dan tidak boleh ditebak. */
function bacaMentahServer(): string | null {
  return null;
}

/**
 * Preferensi tampilan yang dipakai bersama navigasi dan halaman
 * pengaturannya.
 *
 * Satu sumber untuk dua tempat: tanpa ini, mencentang di halaman
 * pengaturan tidak akan mengubah apa pun sampai halamannya dimuat
 * ulang — dan orang menyimpulkan pengaturannya tidak bekerja.
 *
 * Tempat simpannya dua, dan pilihannya bukan soal selera:
 *
 * - **Mode sungguhan** menyimpan ke tabel per pengguna lewat server
 *   action. localStorage sengaja TIDAK dipakai di sini: ia milik
 *   peramban, bukan milik orang, jadi di komputer bersama susunan
 *   orang pertama akan menempel pada orang berikutnya yang masuk.
 * - **Mode demo** tidak punya tabel, jadi localStorage satu-satunya
 *   tempat — dan layar menyebutnya apa adanya.
 */
export function PenyediaTampilan({
  katalog,
  bawaan,
  keServer = false,
  sudahTersimpan = false,
  children,
}: {
  katalog: Record<PermukaanTampilan, ItemTampilan[]>;
  /** Susunan yang berlaku menurut server; sudah digabung dengan bawaan. */
  bawaan: PreferensiTampilan;
  /** Simpan ke tabel per pengguna, bukan ke peramban. */
  keServer?: boolean;
  /** Sudah ada baris tersimpan di server sebelum sesi ini dibuka. */
  sudahTersimpan?: boolean;
  children: ReactNode;
}) {
  const mentah = useSyncExternalStore(
    berlangganan,
    bacaMentah,
    bacaMentahServer,
  );
  // Penimpa lokal atas nilai dari server. Null berarti "belum ada yang
  // diubah di sesi ini"; setelah reset ia diisi susunan bawaan, BUKAN
  // dikosongkan — mengosongkannya akan jatuh kembali ke nilai server,
  // yaitu susunan tersimpan yang barusan dihapus.
  const [penimpa, setPenimpa] = useState<PreferensiTampilan | null>(null);
  const [adaTersimpan, setAdaTersimpan] = useState(sudahTersimpan);
  const [galat, setGalat] = useState<string | null>(null);
  // Widget Beranda disaring DI SERVER, jadi yang disembunyikan tidak
  // ikut terkirim sama sekali. Tanpa render ulang, mengembalikannya ke
  // bawaan tidak akan memunculkannya lagi — penyaring klien hanya bisa
  // mengurangi apa yang sudah dikirim.
  const router = useRouter();

  // Penundaan singkat per permukaan sebelum menulis ke server.
  //
  // Satu seretan melewati lima posisi menghasilkan lima perubahan
  // keadaan, dan tiap penyimpanan mengganti SELURUH daftar permukaan
  // itu (hapus lalu sisip). Tanpa penundaan, yang dikirim adalah lima
  // kali pekerjaan penuh untuk satu gerakan — dan empat di antaranya
  // sudah basi sebelum sampai.
  const jeda = useRef(
    new Map<PermukaanTampilan, ReturnType<typeof setTimeout>>(),
  );

  const lokal = useMemo(() => {
    if (!mentah) return null;
    try {
      // Diselaraskan tiap kali dibaca: isi localStorage bisa tertinggal
      // versi lama, atau disunting orang. Yang tidak ada di katalog
      // dibuang, menu inti dipaksa ke tempatnya.
      return selaraskanPreferensi(katalog, JSON.parse(mentah));
    } catch {
      return null;
    }
  }, [mentah, katalog]);

  const preferensi = keServer ? (penimpa ?? bawaan) : (lokal ?? bawaan);

  const simpan = useCallback(
    (permukaan: PermukaanTampilan, daftar: PreferensiItem[]) => {
      // Diselaraskan seluruhnya supaya menu inti tetap tertambat dan
      // kunci asing terbuang, lalu yang dikirim ke server HANYA
      // permukaan yang berubah. Mengirim keempatnya di tiap centang
      // berarti empat kali kerja dan empat kali peluang gagal untuk
      // satu perubahan yang tidak menyentuh tiga di antaranya.
      const bersih = selaraskanPreferensi(katalog, {
        ...preferensi,
        [permukaan]: daftar,
      });

      if (keServer) {
        // Layar berubah lebih dulu, penyimpanan menyusul: menunggu
        // jawaban server untuk setiap centang membuat halaman ini
        // terasa macet, padahal yang diubah cuma tata letak.
        setPenimpa(bersih);
        setAdaTersimpan(true);
        setGalat(null);

        // Jawabannya tetap ditunggu. Tanpa ini, penolakan server —
        // sesi habis, basis data menolak — menghasilkan layar yang
        // menampilkan susunan baru padahal tidak ada yang tersimpan,
        // dan orangnya baru tahu saat membuka aplikasi besok.
        const tertunda = jeda.current.get(permukaan);
        if (tertunda) clearTimeout(tertunda);
        jeda.current.set(
          permukaan,
          setTimeout(() => {
            jeda.current.delete(permukaan);
            void simpanSusunan(permukaan, bersih[permukaan]).then((hasil) => {
              if (!hasil.ok) {
                setGalat(hasil.pesan ?? "Susunan gagal disimpan.");
                return;
              }
              if (permukaan === "beranda") router.refresh();
            });
          }, JEDA_SIMPAN_MS),
        );
        return;
      }

      try {
        localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(bersih));
      } catch {
        // Tidak tersimpan; biarkan yang di layar apa adanya.
      }
      beritahu();
    },
    [katalog, keServer, preferensi, router],
  );

  // Menghapus, bukan menulis ulang bawaan: kalau daftar menu bertambah
  // nanti, "bawaan" yang tersimpan hari ini justru jadi susunan lama
  // yang membekukan menu baru di luar layar.
  const kembalikanBawaan = useCallback(() => {
    if (keServer) {
      // Penyimpanan yang masih menunggu akan menulis susunan lama
      // SETELAH reset; batalkan dulu.
      for (const t of jeda.current.values()) clearTimeout(t);
      jeda.current.clear();
      setPenimpa(preferensiBawaan(katalog));
      setAdaTersimpan(false);
      setGalat(null);
      void kembalikanSusunanBawaan().then((hasil) => {
        if (!hasil.ok) {
          setGalat(hasil.pesan ?? "Gagal mengembalikan susunan.");
          return;
        }
        router.refresh();
      });
      return;
    }
    try {
      localStorage.removeItem(KUNCI_SIMPAN);
    } catch {
      // Tidak ada yang bisa dihapus; keadaannya memang sudah bawaan.
    }
    beritahu();
  }, [keServer, katalog, router]);

  const isi = useMemo(
    () => ({
      preferensi,
      katalog,
      simpan,
      kembalikanBawaan,
      // Bukan hanya "berubah di sesi ini": orang yang membuka halaman
      // dengan susunan tersimpan dari kemarin juga punya sesuatu untuk
      // dikembalikan — dan setelah reset, tidak ada lagi.
      pernahDiatur: keServer ? adaTersimpan : mentah !== null,
      galat,
    }),
    [
      preferensi,
      katalog,
      simpan,
      kembalikanBawaan,
      keServer,
      adaTersimpan,
      mentah,
      galat,
    ],
  );

  return <Konteks.Provider value={isi}>{children}</Konteks.Provider>;
}

/**
 * Preferensi tampilan, atau null di luar penyedianya.
 *
 * Null bukan galat: navigasi harus tetap tergambar lengkap kalau
 * konteksnya belum ada — lebih baik menu yang terlalu banyak daripada
 * aplikasi tanpa menu sama sekali.
 */
export function useTampilan() {
  return useContext(Konteks);
}

/**
 * Menyaring dan mengurutkan sebuah daftar menu menurut preferensi.
 *
 * Dibuat setelah rail, dock, dan bar pintasan masing-masing menyalin
 * rangkaian yang sama: ambil yang terlihat, susun ulang menurut urutan
 * tersimpan, biarkan apa adanya kalau penyedianya tidak ada. Tiga
 * salinan berarti tiga tempat yang bisa melenceng sendiri-sendiri —
 * dan yang melenceng di navigasi tidak kelihatan sampai ada yang
 * mengeluh menunya hilang.
 *
 * Preferensi hanya boleh MENGURANGI dan MENGURUTKAN daftar yang
 * dikirim pemanggil. Daftar itu sudah lolos pemeriksaan izin di
 * tempatnya masing-masing, dan kunci yang tidak ada di dalamnya
 * diabaikan — centang tidak pernah menjadi pintu masuk baru.
 */
export function useSusunan(permukaan: PermukaanTampilan) {
  const tampilan = useTampilan();

  return useCallback(
    <T extends { href: string }>(daftar: T[]): T[] => {
      if (!tampilan) return daftar;

      const terlihat = itemTerlihat(
        tampilan.katalog,
        tampilan.preferensi,
        permukaan,
      ).map((i) => i.kunci);
      const posisi = new Map(terlihat.map((kunci, i) => [kunci, i] as const));

      return daftar
        .filter((m) => posisi.has(m.href))
        .sort((a, b) => posisi.get(a.href)! - posisi.get(b.href)!);
    },
    [tampilan, permukaan],
  );
}
