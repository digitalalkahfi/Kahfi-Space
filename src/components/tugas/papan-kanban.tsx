import { KartuTugas } from "@/components/tugas/kartu-tugas";
import { cn } from "@/lib/utils";
import type { StatusTugas, Tugas } from "@/lib/types";

/**
 * Empat kolom papan, dipetakan langsung ke status tugas yang sudah ada
 * di basis data (`status_tugas`). Tidak ada status baru yang ditambahkan:
 * papan ini cara lain membaca data yang sama, bukan alur kerja kedua.
 */
export const KOLOM_KANBAN: {
  status: StatusTugas;
  judul: string;
  keterangan: string;
  aksen: string;
}[] = [
  {
    status: "todo",
    judul: "To Do",
    keterangan: "Belum disentuh",
    aksen: "bg-muted-foreground/40",
  },
  {
    status: "berjalan",
    judul: "Sedang Dikerjakan",
    keterangan: "Sudah dimulai",
    aksen: "bg-secondary",
  },
  {
    status: "menunggu_qc",
    judul: "Review/Approval",
    keterangan: "Menunggu pemeriksa",
    aksen: "bg-warn",
  },
  {
    status: "selesai",
    judul: "Selesai",
    keterangan: "Lolos pemeriksaan",
    aksen: "bg-ok",
  },
];

const BOBOT = { tinggi: 0, sedang: 1, rendah: 2 } as const;

/**
 * Urutan di dalam kolom mengikuti yang paling menuntut perhatian:
 * prioritas lebih dulu, lalu tenggat terdekat. Kolom "Selesai" justru
 * kebalikannya — yang baru saja beres yang paling berguna dilihat.
 */
function urutkan(daftar: Tugas[], status: StatusTugas) {
  const salinan = [...daftar];

  if (status === "selesai") {
    return salinan.sort((a, b) =>
      (b.selesaiPada ?? b.tenggat ?? "").localeCompare(
        a.selesaiPada ?? a.tenggat ?? "",
      ),
    );
  }

  return salinan.sort((a, b) => {
    const p = BOBOT[a.prioritas] - BOBOT[b.prioritas];
    if (p !== 0) return p;
    return (a.tenggat || "9999").localeCompare(b.tenggat || "9999");
  });
}

/**
 * Papan Kanban empat kolom untuk halaman Tugas.
 *
 * Di mobile kolomnya digulir mendatar dengan snap — memampatkan empat
 * kolom ke layar selebar 375px hanya membuat kartunya tidak terbaca.
 * Di layar lebar keempatnya berdampingan, tinggi kolom dibatasi supaya
 * satu kolom yang panjang tidak mendorong tiga lainnya jauh ke bawah.
 */
export function PapanKanban({
  tugas,
  namaSaya,
  bolehQcSemua,
  hariIni,
}: {
  tugas: Tugas[];
  namaSaya: string;
  /** CEO/Manager/Leader boleh memeriksa tugas orang lain. */
  bolehQcSemua: boolean;
  hariIni: string;
}) {
  const perKolom = KOLOM_KANBAN.map((kolom) => ({
    ...kolom,
    isi: urutkan(
      tugas.filter((t) => t.status === kolom.status),
      kolom.status,
    ),
  }));

  return (
    <div
      className={cn(
        "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2",
        "lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0",
      )}
    >
      {perKolom.map((kolom) => (
        <section
          key={kolom.status}
          aria-label={`${kolom.judul} — ${kolom.isi.length} tugas`}
          className="flex w-[85vw] shrink-0 snap-start flex-col gap-2.5 rounded-3xl bg-muted/40 p-3 sm:w-[60vw] lg:w-auto"
        >
          <header className="flex items-center gap-2 px-1">
            <span className={cn("size-1.5 rounded-full", kolom.aksen)} />
            <h2 className="text-[13px] leading-[18px] font-semibold">
              {kolom.judul}
            </h2>
            <span className="tabular rounded-full bg-card px-1.5 text-[10px] leading-[16px] font-semibold text-muted-foreground ring-1 ring-border-subtle">
              {kolom.isi.length}
            </span>
          </header>

          {kolom.isi.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border-subtle px-3 py-6 text-center text-[11px] leading-[14px] text-pretty text-muted-foreground">
              {kolom.keterangan} — belum ada tugas di sini.
            </p>
          ) : (
            <ul className="space-y-2.5 lg:max-h-[calc(100dvh-18rem)] lg:overflow-y-auto lg:pr-0.5">
              {kolom.isi.map((t) => (
                <li key={t.id}>
                  <KartuTugas
                    tugas={t}
                    sayaPenerima={t.penerimaLengkap === namaSaya}
                    bolehQc={
                      t.tipe !== "pribadi" &&
                      (bolehQcSemua ||
                        t.pembuat.startsWith(namaSaya.split(" ")[0]))
                    }
                    hariIni={hariIni}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
