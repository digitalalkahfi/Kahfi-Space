"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { KartuTugas } from "@/components/tugas/kartu-tugas";
import { PesanAksi } from "@/components/shared/pesan-aksi";
import { cn } from "@/lib/utils";
import { kolomMenerima, periksaPindah } from "@/lib/kanban";
import { ubahStatusTugas } from "@/app/actions/tugas";
import type { JejakQc } from "@/lib/data/tugas";
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
 * Panah kiri/kanan memindahkan kartu satu kolom penuh, bukan 25 piksel
 * seperti bawaan dnd-kit. Kolom papan lebarnya ratusan piksel; dengan
 * langkah bawaan, memindahkan kartu lewat keyboard butuh belasan kali
 * tekan dan praktis tidak terpakai.
 */
const koordinatKolom: KeyboardCoordinateGetter = (
  event,
  { currentCoordinates, context },
) => {
  const arah =
    event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  if (arah === 0) return undefined;
  event.preventDefault();

  const kotak = KOLOM_KANBAN.map((k) =>
    context.droppableRects.get(`kolom:${k.status}`),
  );
  const terpakai = kotak.filter((r) => r !== undefined);
  if (terpakai.length === 0) return undefined;

  // Kolom yang sedang ditempati: yang pusatnya paling dekat dengan kartu.
  let kini = 0;
  let selisih = Number.POSITIVE_INFINITY;
  kotak.forEach((r, i) => {
    if (!r) return;
    const jarak = Math.abs(r.left + r.width / 2 - currentCoordinates.x);
    if (jarak < selisih) {
      selisih = jarak;
      kini = i;
    }
  });

  const tujuan = kotak[kini + arah];
  if (!tujuan) return undefined;

  return {
    x: tujuan.left + tujuan.width / 2,
    y: currentCoordinates.y,
  };
};

const PETUNJUK_LAYAR =
  "Tekan spasi pada pegangan untuk mengangkat kartu, panah kiri dan kanan untuk berpindah kolom, spasi lagi untuk melepas. Tombol di dalam kartu tetap bisa dipakai tanpa menyeret.";

/**
 * Kolom sebagai wadah jatuh.
 *
 * Penandanya membedakan kolom yang akan menerima dari yang akan menolak:
 * menyorot semua kolom dengan warna yang sama mengundang orang
 * menjatuhkan kartu ke tempat yang sudah pasti ditolak.
 */
function Kolom({
  status,
  anak,
  className,
  bolehTerima,
  ...sisa
}: {
  status: StatusTugas;
  anak: React.ReactNode;
  className?: string;
  /** null saat tidak ada kartu yang sedang diangkat. */
  bolehTerima: boolean | null;
  "aria-label": string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `kolom:${status}` });
  return (
    <section
      ref={setNodeRef}
      {...sisa}
      className={cn(
        className,
        "transition-colors",
        // Kolom yang siap menerima tetap tampak hidup meski kartunya
        // belum di atasnya — itu yang memberi tahu ke mana boleh menuju.
        bolehTerima === true && !isOver && "ring-1 ring-secondary/30",
        // null = kolom asal kartunya sendiri: menjatuhkannya di situ
        // bukan penolakan, hanya tidak terjadi apa-apa.
        isOver &&
          bolehTerima === true &&
          "bg-info-fill ring-2 ring-secondary/50",
        isOver &&
          bolehTerima === false &&
          "bg-danger-fill/40 ring-2 ring-danger/40",
      )}
    >
      {anak}
    </section>
  );
}

/**
 * Pegangan seret dipisah dari badan kartu dengan sengaja: kartu tugas
 * penuh tombol (Mulai kerjakan, QC, isi hasil), dan kalau seluruh kartu
 * bisa diseret, setiap ketukan di ponsel berisiko terbaca sebagai awal
 * seretan.
 */
function KartuSeret({
  tugas,
  anak,
  bisaSeret,
}: {
  tugas: Tugas;
  anak: React.ReactNode;
  bisaSeret: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: tugas.id,
    disabled: !bisaSeret,
    data: { status: tugas.status },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn("relative", isDragging && "opacity-40")}
    >
      {bisaSeret ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Pindahkan kartu ${tugas.judul}`}
          className="tekan-halus absolute top-2 right-2 z-10 flex size-7 touch-none items-center justify-center rounded-full bg-card/80 text-muted-foreground ring-1 ring-border-subtle hover:text-foreground"
        >
          <GripVertical className="size-3.5" />
        </button>
      ) : null}
      {anak}
    </div>
  );
}

/**
 * Papan Kanban empat kolom untuk halaman Tugas.
 *
 * Kartu bisa dipindah dengan menyeret pegangannya, dan perpindahannya
 * memanggil Server Action yang SAMA dengan tombol di dalam kartu
 * (`ubahStatusTugas`) — jadi perpindahan yang tidak sah ditolak dengan
 * pesan yang sama, dan tombolnya tetap ada bagi yang tidak menyeret.
 *
 * Seretannya memakai @dnd-kit yang sudah dipakai halaman Pengaturan
 * Tampilan. PRD meminta "tanpa dependensi baru", dan pustaka ini memang
 * bukan yang baru: menulis mesin seret kedua dengan Pointer Events
 * sendiri justru menambah satu perilaku keyboard & pembaca layar lagi
 * yang harus dirawat terpisah.
 *
 * Di mobile kolomnya digulir mendatar dengan snap — memampatkan empat
 * kolom ke layar selebar 375px hanya membuat kartunya tidak terbaca.
 */
export function PapanKanban({
  tugas,
  namaSaya,
  bolehQcSemua,
  hariIni,
  jejakQc = {},
}: {
  tugas: Tugas[];
  namaSaya: string;
  /** CEO/Manager/Leader boleh memeriksa tugas orang lain. */
  bolehQcSemua: boolean;
  hariIni: string;
  /** Riwayat pemeriksaan per id tugas. */
  jejakQc?: Record<string, JejakQc[]>;
}) {
  const [, mulai] = useTransition();
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(
    null,
  );
  // Status hasil geseran yang belum sempat di-revalidate server.
  const [pindahan, setPindahan] = useState<Record<string, StatusTugas>>({});
  // Kartu yang diminta membuka kolom hasil kerja; kuncinya ikut berubah
  // supaya kartunya dipasang ulang dengan kolom itu terbuka.
  const [mintaHasil, setMintaHasil] = useState<string | null>(null);
  const [diangkat, setDiangkat] = useState<string | null>(null);

  const sensor = useSensors(
    // Jarak aktivasi 6px: tanpa itu, ketukan biasa di ponsel sering
    // terbaca sebagai seretan sependek satu piksel.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: koordinatKolom }),
  );

  const statusKini = (t: Tugas) => pindahan[t.id] ?? t.status;

  const perKolom = useMemo(
    () =>
      KOLOM_KANBAN.map((kolom) => ({
        ...kolom,
        isi: urutkan(
          tugas.filter((t) => (pindahan[t.id] ?? t.status) === kolom.status),
          kolom.status,
        ),
      })),
    [tugas, pindahan],
  );

  const sayaPenerima = (t: Tugas) => t.penerimaLengkap === namaSaya;
  const melayang = tugas.find((t) => t.id === diangkat) ?? null;

  // Pengumuman bawaan dnd-kit berbahasa Inggris dan menyebut id mentah
  // ("contoh-0"); yang berguna bagi pembaca layar adalah judul tugas dan
  // nama kolomnya.
  const judulKartu = (id: string | number) =>
    tugas.find((t) => t.id === String(id))?.judul ?? "kartu";
  const namaKolom = (id: string | number | undefined) => {
    const kunci = String(id ?? "").slice("kolom:".length);
    return KOLOM_KANBAN.find((k) => k.status === kunci)?.judul ?? null;
  };
  const pengumuman = {
    onDragStart: ({ active }: { active: { id: string | number } }) =>
      `Mengangkat ${judulKartu(active.id)}. Panah kiri dan kanan untuk berpindah kolom, spasi untuk melepas, escape untuk membatalkan.`,
    onDragOver: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) => {
      const kolom = namaKolom(over?.id);
      return kolom
        ? `${judulKartu(active.id)} berada di atas kolom ${kolom}.`
        : `${judulKartu(active.id)} berada di luar kolom mana pun.`;
    },
    onDragEnd: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) => {
      const kolom = namaKolom(over?.id);
      return kolom
        ? `${judulKartu(active.id)} dilepas di kolom ${kolom}.`
        : `${judulKartu(active.id)} dilepas di luar kolom; kartunya tidak berpindah.`;
    },
    onDragCancel: ({ active }: { active: { id: string | number } }) =>
      `Pemindahan ${judulKartu(active.id)} dibatalkan.`,
  };

  // Aturannya sendiri hidup di `@/lib/kanban` supaya bisa diuji tanpa
  // merakit papan: yang tersisa di sini hanya status kartu yang sedang
  // berpindah dan belum di-revalidate server.
  const menerima = (kartu: Tugas, ke: StatusTugas): boolean | null =>
    kolomMenerima({
      dari: statusKini(kartu),
      ke,
      sayaPenerima: sayaPenerima(kartu),
      hasilKerja: kartu.hasilKerja,
    });

  const selesaikanSeret = (e: DragEndEvent) => {
    setDiangkat(null);
    const kartu = tugas.find((t) => t.id === e.active.id);
    const tujuan = String(e.over?.id ?? "");
    if (!kartu || !tujuan.startsWith("kolom:")) return;

    const ke = tujuan.slice("kolom:".length) as StatusTugas;
    const hasil = periksaPindah({
      dari: statusKini(kartu),
      ke,
      sayaPenerima: sayaPenerima(kartu),
      hasilKerja: kartu.hasilKerja,
    });

    if (!hasil.boleh) {
      if (hasil.mintaHasilKerja) {
        setMintaHasil(kartu.id);
        setPesan({
          ok: false,
          teks: "Tulis ringkasan hasil kerjamu dulu, lalu tekan Ajukan pemeriksaan.",
        });
        return;
      }
      if (hasil.pesan) setPesan({ ok: false, teks: hasil.pesan });
      return;
    }

    // Kartu pindah lebih dulu supaya papan terasa langsung, lalu
    // dikembalikan bila server menolak.
    const semula = statusKini(kartu);
    setPindahan((s) => ({ ...s, [kartu.id]: hasil.ke }));
    setPesan(null);

    mulai(async () => {
      const r = await ubahStatusTugas(kartu.id, hasil.ke, kartu.hasilKerja);
      if (r.ok) {
        setPesan(null);
        return;
      }
      // Mode demo: alurnya tetap diperlihatkan, datanya tidak disimpan.
      if (r.kode === "demo") {
        setPesan({ ok: false, teks: r.pesan });
        return;
      }
      setPindahan((s) => ({ ...s, [kartu.id]: semula }));
      setPesan({ ok: false, teks: r.pesan });
    });
  };

  return (
    <div className="space-y-2">
      {pesan ? (
        <PesanAksi nada={pesan.ok ? "berhasil" : "gagal"} ukuran="sedang">
          {pesan.teks}
        </PesanAksi>
      ) : null}

      <DndContext
        sensors={sensor}
        // closestCorners, bukan pointerWithin: pemindahan lewat keyboard
        // tidak punya penunjuk sama sekali, jadi pointerWithin membuat
        // kartu bisa diangkat tapi tidak pernah bisa dijatuhkan.
        collisionDetection={closestCorners}
        onDragStart={(e: DragStartEvent) => setDiangkat(String(e.active.id))}
        onDragCancel={() => setDiangkat(null)}
        onDragEnd={selesaikanSeret}
        accessibility={{
          announcements: pengumuman,
          screenReaderInstructions: { draggable: PETUNJUK_LAYAR },
        }}
      >
        <div
          className={cn(
            "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2",
            "lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0",
          )}
        >
          {perKolom.map((kolom) => (
            <Kolom
              key={kolom.status}
              status={kolom.status}
              bolehTerima={melayang ? menerima(melayang, kolom.status) : null}
              aria-label={`${kolom.judul} — ${kolom.isi.length} tugas`}
              className="flex w-[85vw] shrink-0 snap-start flex-col gap-2.5 rounded-3xl bg-muted/40 p-3 sm:w-[60vw] lg:w-auto"
              anak={
                <>
                  <header className="flex items-center gap-2 px-1">
                    <span
                      className={cn("size-1.5 rounded-full", kolom.aksen)}
                    />
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
                          <KartuSeret
                            tugas={{ ...t, status: statusKini(t) }}
                            bisaSeret={
                              sayaPenerima(t) && statusKini(t) !== "selesai"
                            }
                            anak={
                              <KartuTugas
                                key={
                                  mintaHasil === t.id ? `${t.id}-hasil` : t.id
                                }
                                tugas={{ ...t, status: statusKini(t) }}
                                sayaPenerima={sayaPenerima(t)}
                                bolehQc={
                                  t.tipe !== "pribadi" &&
                                  (bolehQcSemua ||
                                    t.pembuat.startsWith(
                                      namaSaya.split(" ")[0],
                                    ))
                                }
                                hariIni={hariIni}
                                jejakQc={jejakQc[t.id]}
                                hasilTerbukaAwal={mintaHasil === t.id}
                              />
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              }
            />
          ))}
        </div>

        <DragOverlay>
          {melayang ? (
            <div className="w-[85vw] rotate-1 sm:w-[60vw] lg:w-72">
              <KartuTugas
                tugas={{ ...melayang, status: statusKini(melayang) }}
                sayaPenerima={sayaPenerima(melayang)}
                bolehQc={false}
                hariIni={hariIni}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
