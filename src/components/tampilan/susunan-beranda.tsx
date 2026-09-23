"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { KeadaanKosong } from "@/components/shared/keadaan";
import { useTampilan } from "@/components/tampilan/penyedia-tampilan";
import type { WidgetBeranda } from "@/lib/akses";

export type SlotWidget = { kunci: WidgetBeranda; isi: ReactNode };

/**
 * Tata letak Beranda yang mengikuti pilihan pengguna.
 *
 * Yang diikuti hanya DUA hal: widget mana yang tampil, dan urutannya.
 * Kerangkanya — hero di atas, tiga kolom di bawahnya — tidak ikut
 * berubah, karena PRD meminta personalisasi tanpa mengubah design
 * system, dan karena kolom kanan memang untuk kartu sempit.
 *
 * Urutan disortir DI DALAM tiap kolom memakai satu daftar urutan yang
 * sama. Jadi menaikkan sebuah widget menaikkannya relatif terhadap
 * teman sekolomnya, bukan memindahkannya ke kolom lain. Itu batas yang
 * jujur: memindah antar kolom berarti kartu lebar masuk kolom sempit,
 * dan yang rusak bukan urutannya melainkan tampilannya.
 *
 * Isi widget datang sudah jadi dari server (RSC): halaman ini tetap
 * mengambil datanya di server, komponen ini cuma memilih dan menyusun.
 */
export function SusunanBeranda({
  hero,
  tengah,
  kanan,
  kiri,
}: {
  hero: SlotWidget[];
  tengah: SlotWidget[];
  kanan: SlotWidget[];
  kiri: SlotWidget[];
}) {
  const tampilan = useTampilan();

  const susun = (slot: SlotWidget[]) => {
    if (!tampilan) return slot;
    const pref = tampilan.preferensi.beranda;
    const urutan = new Map(pref.map((b, i) => [b.kunci, i] as const));
    const tampil = new Set(pref.filter((b) => b.tampil).map((b) => b.kunci));
    return slot
      .filter((s) => tampil.has(s.kunci))
      .sort(
        (a, b) =>
          (urutan.get(a.kunci) ?? Number.MAX_SAFE_INTEGER) -
          (urutan.get(b.kunci) ?? Number.MAX_SAFE_INTEGER),
      );
  };

  const atas = susun(hero);
  const isiTengah = susun(tengah);
  const isiKanan = susun(kanan);
  const isiKiri = susun(kiri);
  const adaKolomKanan = isiKanan.length > 0;
  const kosong =
    atas.length === 0 &&
    isiTengah.length === 0 &&
    isiKanan.length === 0 &&
    isiKiri.length === 0;

  // Beranda tanpa satu kartu pun bukan halaman rusak, tapi tanpa
  // penjelasan ia terbaca begitu — dan pintu keluarnya justru halaman
  // yang membuatnya kosong.
  if (kosong) {
    return (
      <KeadaanKosong
        ikon={<SlidersHorizontal className="size-4" />}
        judul="Semua widget Beranda kamu sembunyikan"
        pesan="Tidak ada yang rusak — halaman ini memang sedang kosong karena pilihanmu sendiri. Nyalakan lagi yang kamu perlukan kapan saja."
        aksi={
          <Link
            href="/tampilan"
            className="tekan-halus sentuh-nyaman inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] leading-[18px] font-semibold text-primary-foreground"
          >
            <SlidersHorizontal className="size-3.5" />
            Atur tampilan
          </Link>
        }
      />
    );
  }

  return (
    <>
      {atas.map((s) => (
        <div key={s.kunci}>{s.isi}</div>
      ))}

      {/* Urutan DOM = urutan mobile; di desktop kolom ditata ulang lewat order. */}
      <div className="grid items-start gap-4 lg:grid-cols-12 lg:gap-6">
        <div
          className={`space-y-4 lg:order-2 lg:space-y-6 ${
            adaKolomKanan ? "lg:col-span-6" : "lg:col-span-9"
          }`}
        >
          {isiTengah.map((s) => (
            <div key={s.kunci}>{s.isi}</div>
          ))}
        </div>

        {adaKolomKanan ? (
          <div className="space-y-4 lg:order-3 lg:col-span-3 lg:space-y-6">
            {isiKanan.map((s) => (
              <div key={s.kunci}>{s.isi}</div>
            ))}
          </div>
        ) : null}

        <div className="space-y-4 lg:order-1 lg:col-span-3 lg:space-y-6">
          {isiKiri.map((s) => (
            <div key={s.kunci}>{s.isi}</div>
          ))}
        </div>
      </div>
    </>
  );
}
