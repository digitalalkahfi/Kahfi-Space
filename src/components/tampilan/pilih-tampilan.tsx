"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Check, Lock } from "lucide-react";
import { PesanAksi } from "@/components/shared/pesan-aksi";
import { Card } from "@/components/ui/card";
import {
  BarisSortable,
  BarisTetap,
} from "@/components/tampilan/baris-tampilan";
import { cn } from "@/lib/utils";
import { PratinjauDock } from "@/components/tampilan/pratinjau-dock";
import { useTampilan } from "@/components/tampilan/penyedia-tampilan";
import {
  itemTerlihat,
  pindahkanItem,
  PERMUKAAN,
  LABEL_PERMUKAAN,
  type PermukaanTampilan,
} from "@/lib/tampilan";

/**
 * Pemilih item per permukaan.
 *
 * Satu kartu per permukaan, bukan satu daftar panjang bertab: yang
 * ditanyakan orang saat membuka halaman ini adalah "kenapa menu X
 * tidak ada di ponsel saya", dan jawabannya harus terbaca tanpa
 * berpindah tab lebih dulu.
 *
 * Tahap ini masih memakai keadaan di browser saja — belum ada yang
 * tersimpan ke server. Itu disebut terus terang di layar supaya tidak
 * ada yang mengira susunannya sudah aman.
 */
/** Satu kalimat, dipakai di gembok maupun keterangan kartunya. */
const ALASAN_INTI =
  "Beranda tujuan setiap kali orang tersesat, dan menyembunyikan halaman ini berarti tidak ada lagi jalan untuk menampilkannya kembali.";

/**
 * Pengumuman untuk pembaca layar, dalam bahasa yang dipakai aplikasi.
 *
 * Bawaan dnd-kit berbahasa Inggris. Orang yang menyusun menunya lewat
 * keyboard adalah justru orang yang paling bergantung pada kalimat
 * ini; membiarkannya asing membuat fitur ini tidak bisa dipakai olehnya.
 */
const PENGUMUMAN = {
  onDragStart: ({ active }: { active: { id: string | number } }) =>
    `Mengangkat ${active.id}. Pakai panah atas dan bawah untuk memindahkan, spasi untuk melepas, escape untuk membatalkan.`,
  onDragOver: ({
    active,
    over,
  }: {
    active: { id: string | number };
    over: { id: string | number } | null;
  }) =>
    over
      ? `${active.id} berada di atas ${over.id}.`
      : `${active.id} berada di luar daftar.`,
  onDragEnd: ({
    active,
    over,
  }: {
    active: { id: string | number };
    over: { id: string | number } | null;
  }) =>
    over
      ? `${active.id} dilepas di posisi ${over.id}. Urutannya tersimpan.`
      : `${active.id} dilepas di luar daftar; urutannya tidak berubah.`,
  onDragCancel: ({ active }: { active: { id: string | number } }) =>
    `Pemindahan ${active.id} dibatalkan.`,
};

const PETUNJUK_LAYAR =
  "Tekan spasi pada pegangan untuk mulai memindahkan item, panah atas dan bawah untuk menggeser, spasi lagi untuk melepas.";

export function PilihTampilan() {
  const tampilan = useTampilan();
  // Pointer dengan jarak aktivasi 6px: tanpa itu, ketukan biasa di
  // ponsel sering terbaca sebagai seretan sependek satu piksel dan
  // centangnya tidak jadi. Keyboard ikut disertakan — orang yang tidak
  // memakai tetikus tetap harus bisa mengurutkan.
  // Penanda "tersimpan" untuk penyimpanan otomatis.
  //
  // Tanpa tombol simpan, tidak ada satu pun tanda bahwa perubahan
  // sudah tercatat — dan orang cenderung mengulangi tindakannya, atau
  // tidak berani menutup halaman. Penanda ini hilang sendiri setelah
  // dua detik supaya ia tidak jadi hiasan tetap.
  const [tandaSimpan, setTandaSimpan] = useState(0);

  useEffect(() => {
    if (tandaSimpan === 0) return;
    const jam = setTimeout(() => setTandaSimpan(0), 2000);
    return () => clearTimeout(jam);
  }, [tandaSimpan]);

  const sensor = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (!tampilan) return null;
  const { katalog, preferensi, simpan, galat } = tampilan;

  // Disimpan lewat penyedia, bukan keadaan sendiri: navigasi di sekitar
  // halaman ini membaca sumber yang sama, jadi centangnya langsung
  // terlihat hasilnya tanpa memuat ulang.
  const tandai = () => setTandaSimpan((n) => n + 1);

  const geser = (permukaan: PermukaanTampilan, e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    // Disimpan langsung tanpa tombol simpan: begitu dilepas, urutannya
    // sudah berlaku di navigasi sebelah.
    tandai();
    simpan(
      permukaan,
      pindahkanItem(preferensi[permukaan], String(active.id), String(over.id)),
    );
  };

  const alihkan = (permukaan: PermukaanTampilan, kunci: string) => {
    tandai();
    simpan(
      permukaan,
      preferensi[permukaan].map((b) =>
        b.kunci === kunci ? { ...b, tampil: !b.tampil } : b,
      ),
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-[16px] text-pretty text-muted-foreground">
        Daftar di bawah sudah disaring menurut peranmu — menu dan widget yang
        memang bukan wewenangmu tidak muncul di sini, dan mencentangnya pun
        tidak akan menampilkannya.
      </p>

      {galat ? (
        <PesanAksi nada="gagal" ukuran="sedang">
          {galat} Susunan di layar belum tentu sama dengan yang tersimpan — muat
          ulang halaman untuk melihat yang benar-benar tercatat.
        </PesanAksi>
      ) : null}

      <p
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-center gap-1.5 text-[11px] leading-[14px] font-semibold transition-opacity",
          tandaSimpan === 0 ? "opacity-0" : "text-ok-text opacity-100",
        )}
      >
        <Check aria-hidden className="size-3.5" strokeWidth={3} />
        {tandaSimpan === 0 ? "" : "Tersimpan"}
      </p>

      {PERMUKAAN.map((permukaan) => {
        const peta = new Map(katalog[permukaan].map((i) => [i.kunci, i]));
        const baris = preferensi[permukaan];
        const terlihat = itemTerlihat(katalog, preferensi, permukaan);
        const terkunci = katalog[permukaan].filter((i) => i.inti);
        const jangkar = (kunci: string) => peta.get(kunci)?.jangkar ?? null;
        const ada = baris.filter((b) => peta.has(b.kunci));
        const jangkarAwal = ada.filter((b) => jangkar(b.kunci) === "awal");
        const bisaDigeser = ada.filter((b) => jangkar(b.kunci) === null);
        const jangkarAkhir = ada.filter((b) => jangkar(b.kunci) === "akhir");

        return (
          <Card
            key={permukaan}
            className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle"
          >
            <div className="space-y-3 px-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div>
                  <h2 className="text-base leading-6 font-semibold">
                    {LABEL_PERMUKAAN[permukaan].judul}
                  </h2>
                  <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
                    {LABEL_PERMUKAAN[permukaan].keterangan}
                  </p>
                </div>
                <span className="tabular shrink-0 text-[11px] leading-[14px] text-muted-foreground">
                  {terlihat.length} dari {katalog[permukaan].length} tampil
                </span>
              </div>

              {terkunci.length > 0 ? (
                <p
                  id={`alasan-inti-${permukaan}`}
                  className="flex items-start gap-1.5 text-[11px] leading-[14px] text-pretty text-muted-foreground"
                >
                  <Lock aria-hidden className="mt-px size-3 shrink-0" />
                  <span>
                    {terkunci.map((i) => i.label).join(" dan ")} selalu tampil —{" "}
                    {ALASAN_INTI}
                  </span>
                </p>
              ) : null}

              {/* Menu inti dirender di luar area geser: di dalamnya, ia
                  masih bisa ditimpa item lain dan daftarnya melompat
                  setelah dilepas. */}
              <ul className="grid gap-2">
                {jangkarAwal.map((b) => (
                  <BarisTetap
                    key={b.kunci}
                    item={peta.get(b.kunci)!}
                    aktif={b.tampil}
                    idAlasan={`alasan-inti-${permukaan}`}
                    onAlih={() => alihkan(permukaan, b.kunci)}
                  />
                ))}
              </ul>

              <DndContext
                sensors={sensor}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={(e) => geser(permukaan, e)}
                accessibility={{
                  announcements: PENGUMUMAN,
                  screenReaderInstructions: { draggable: PETUNJUK_LAYAR },
                }}
              >
                <SortableContext
                  items={bisaDigeser.map((b) => b.kunci)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="grid gap-2">
                    {bisaDigeser.map((b) => (
                      <BarisSortable
                        key={b.kunci}
                        item={peta.get(b.kunci)!}
                        aktif={b.tampil}
                        idAlasan={`alasan-inti-${permukaan}`}
                        onAlih={() => alihkan(permukaan, b.kunci)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>

              {jangkarAkhir.length > 0 ? (
                <ul className="grid gap-2">
                  {jangkarAkhir.map((b) => (
                    <BarisTetap
                      key={b.kunci}
                      item={peta.get(b.kunci)!}
                      aktif={b.tampil}
                      idAlasan={`alasan-inti-${permukaan}`}
                      onAlih={() => alihkan(permukaan, b.kunci)}
                    />
                  ))}
                </ul>
              ) : null}

              {/* Rail desktop tidak punya batas jumlah, tapi punya
                  batas kesabaran: pratinjau ini yang membuat "lebih
                  lega" terasa sebelum halaman ditutup. */}
              {permukaan === "sidebar" ? (
                <div className="space-y-1 rounded-2xl bg-muted/50 px-4 py-3 text-[11px] leading-[16px] text-pretty text-muted-foreground">
                  <p>
                    <span className="font-semibold text-foreground">
                      Rail atas:
                    </span>{" "}
                    {terlihat
                      .filter((i) => i.grup === "utama")
                      .map((i) => i.label)
                      .join(" · ") || "kosong"}
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">
                      Menempel di dasar:
                    </span>{" "}
                    {terlihat
                      .filter((i) => i.grup === "pendamping")
                      .map((i) => i.label)
                      .join(" · ") || "kosong"}
                  </p>
                  <p>
                    Rail punya dua kelompok itu sejak awal, jadi urutan hanya
                    berlaku di dalam kelompoknya sendiri — menu tidak bisa
                    berpindah dari dasar ke atas. Yang disembunyikan tetap bisa
                    dibuka lewat tautan langsung.
                  </p>
                </div>
              ) : null}

              {permukaan === "dock" ? (
                <PratinjauDock terlihat={terlihat} />
              ) : null}

              {/* Urutan kartu Beranda lebih mudah dinilai sebagai
                  tumpukan daripada sebagai daftar bercentang. */}
              {permukaan === "beranda" ? (
                <div className="space-y-2 rounded-2xl bg-muted/50 p-3">
                  <p className="text-[11px] leading-[14px] font-semibold">
                    Urutan kartu di Beranda
                  </p>
                  {terlihat.length === 0 ? (
                    <p className="text-[11px] leading-[16px] text-pretty text-muted-foreground">
                      Semua widget disembunyikan — Beranda tinggal kartu sapaan.
                    </p>
                  ) : (
                    <ol className="space-y-1">
                      {terlihat.map((item, i) => (
                        <li
                          key={item.kunci}
                          className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 ring-1 ring-border-subtle"
                        >
                          <span className="tabular w-4 shrink-0 text-[10px] leading-[14px] font-semibold text-muted-foreground">
                            {i + 1}
                          </span>
                          <span className="truncate text-[11px] leading-[14px] font-semibold">
                            {item.label}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ) : null}

              {/* Bentuknya sama persis dengan bar atas yang sungguhan
                  (NavigasiAtas) — pratinjau yang cuma daftar teks tidak
                  menjawab pertanyaan "muat berapa sebelum berdesakan". */}
              {permukaan === "pintasan" ? (
                <div className="space-y-2 rounded-2xl bg-muted/50 p-3">
                  <p className="text-[11px] leading-[14px] font-semibold">
                    Tampak di bar atas
                  </p>
                  {terlihat.length === 0 ? (
                    <p className="text-[11px] leading-[16px] text-pretty text-muted-foreground">
                      Tidak ada pintasan yang dipilih — bar atas akan berisi
                      lonceng dan kartu profil saja.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <nav
                        aria-hidden
                        className="inline-flex min-w-fit items-center gap-1 rounded-full bg-card p-1 ring-1 ring-border-subtle"
                      >
                        {terlihat.map((item, i) => (
                          <span
                            key={item.kunci}
                            className={cn(
                              "rounded-full px-4 py-2 text-xs leading-4 font-semibold whitespace-nowrap",
                              i === 0
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            {item.label}
                          </span>
                        ))}
                      </nav>
                    </div>
                  )}
                  <p className="text-[11px] leading-[16px] text-pretty text-muted-foreground">
                    Bar ini hanya ada di layar komputer. Di ponsel, pintasan
                    yang sama dijangkau lewat dock dan laci.
                  </p>
                </div>
              ) : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
