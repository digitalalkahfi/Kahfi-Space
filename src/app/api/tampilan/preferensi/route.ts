import { NextResponse, type NextRequest } from "next/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import {
  kembalikanSusunanBawaan,
  simpanSusunan,
} from "@/app/actions/preferensi-tampilan";
import {
  katalogUntuk,
  preferensiTampilanSaya,
} from "@/lib/data/preferensi-tampilan";
import {
  itemTerlihat,
  pecahDock,
  LABEL_PERMUKAAN,
  MAKS_DOCK,
  PERMUKAAN,
  type PermukaanTampilan,
} from "@/lib/tampilan";

/**
 * Susunan tampilan pemanggil, sebagai JSON.
 *
 * Dua hal yang membuat jawaban ini bisa dipercaya pemanggil:
 *
 * - Yang dikirim adalah susunan YANG BERLAKU — tersimpan sudah
 *   digabung dengan bawaan — bukan isi tabelnya. Orang yang belum
 *   pernah membuka halaman pengaturan tetap punya susunan, dan
 *   pemanggil yang menerima daftar kosong akan salah menyimpulkan
 *   bahwa ia tidak punya menu apa pun.
 * - Penyaringan perannya dikerjakan DI SINI, bukan dititipkan ke
 *   pemanggil. Item di luar wewenang peran tidak ikut terkirim,
 *   sehingga tidak ada jalan bagi pemanggil untuk menampilkannya —
 *   personalisasi hanya mengurangi akses, tidak pernah menambah.
 *
 * Pembagian dock/laci ikut dihitung di sini dengan alasan yang sama
 * seperti `bolehMematikan` pada preferensi notifikasi: aturan yang
 * ditirukan pemanggil cepat melenceng dari aslinya.
 */
export async function GET() {
  const pengguna = await sesiSaatIni();
  if (!pengguna) {
    return NextResponse.json(
      { pesan: "Silakan masuk lebih dulu." },
      { status: 401 },
    );
  }

  const katalog = katalogUntuk(pengguna);
  const { preferensi } = await preferensiTampilanSaya(pengguna);

  const permukaan = Object.fromEntries(
    PERMUKAAN.map((p) => {
      const terlihat = itemTerlihat(katalog, preferensi, p);
      return [
        p,
        {
          judul: LABEL_PERMUKAAN[p].judul,
          keterangan: LABEL_PERMUKAAN[p].keterangan,
          item: preferensi[p].map((b) => {
            const item = katalog[p].find((i) => i.kunci === b.kunci)!;
            return {
              kunci: b.kunci,
              label: item.label,
              tampil: b.tampil,
              inti: item.inti,
            };
          }),
          tampil: terlihat.map((i) => i.kunci),
        },
      ];
    }),
  );

  const dock = pecahDock(itemTerlihat(katalog, preferensi, "dock"));

  return NextResponse.json(
    {
      maksDock: MAKS_DOCK,
      permukaan,
      // Hasil akhirnya, supaya pemanggil tidak menghitung ulang
      // pembagian lima-teratas dan melenceng dari yang di layar.
      dockPonsel: {
        dock: dock.dock.map((i) => i.kunci),
        laci: dock.laci.map((i) => i.kunci),
      },
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}

/** Terjemahan kode gagal jadi status HTTP; sama untuk kedua verb. */
function status(kode?: string) {
  if (kode === "validasi") return 400;
  if (kode === "izin") return 403;
  if (kode === "demo") return 409;
  return 500;
}

/**
 * Menyimpan susunan satu permukaan.
 *
 * Aturannya tidak ditulis ulang di sini — Server Action yang sama
 * dipakai halaman pengaturan, jadi permintaan lewat HTTP tidak bisa
 * menempuh jalur yang lebih longgar daripada lewat layar. Penyaringan
 * per peran terjadi di `simpanPreferensiTampilan`: kunci di luar
 * katalog peran ini dibuang sebelum menyentuh tabel.
 */
export async function PUT(request: NextRequest) {
  const pengguna = await sesiSaatIni();
  if (!pengguna) {
    return NextResponse.json(
      { pesan: "Silakan masuk lebih dulu." },
      { status: 401 },
    );
  }

  let badan: unknown;
  try {
    badan = await request.json();
  } catch {
    return NextResponse.json(
      { pesan: "Badan permintaan harus JSON." },
      { status: 400 },
    );
  }

  const isi = (badan ?? {}) as { permukaan?: unknown; item?: unknown };
  if (typeof isi.permukaan !== "string") {
    return NextResponse.json(
      {
        pesan:
          'Sertakan "permukaan" (sidebar|dock|pintasan|beranda) dan "item" (daftar {kunci, tampil}).',
      },
      { status: 400 },
    );
  }

  const hasil = await simpanSusunan(isi.permukaan, isi.item);
  if (!hasil.ok) {
    return NextResponse.json(
      { pesan: hasil.pesan },
      { status: status(hasil.kode) },
    );
  }

  // Keadaan sesudahnya ikut dikirim, dan ini bukan kemewahan: yang
  // tersimpan belum tentu sama dengan yang dikirim. Penyelaras
  // membuang kunci di luar wewenang peran, menambat Beranda di depan
  // dan halaman pengaturan di belakang, serta menambahkan menu yang
  // belum pernah diatur. Pemanggil yang cuma menerima "ok" akan
  // menampilkan susunan yang sudah tidak benar.
  const { preferensi: sesudah } = await preferensiTampilanSaya(pengguna);
  const permukaanIni = isi.permukaan as PermukaanTampilan;

  return NextResponse.json(
    {
      ok: true,
      pesan: hasil.pesan,
      item: sesudah[permukaanIni].map((b) => ({
        kunci: b.kunci,
        tampil: b.tampil,
      })),
      tampil: itemTerlihat(katalogUntuk(pengguna), sesudah, permukaanIni).map(
        (i) => i.kunci,
      ),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}

/** Menghapus seluruh preferensi; susunan kembali ke bawaan. */
export async function DELETE() {
  const pengguna = await sesiSaatIni();
  if (!pengguna) {
    return NextResponse.json(
      { pesan: "Silakan masuk lebih dulu." },
      { status: 401 },
    );
  }

  const hasil = await kembalikanSusunanBawaan();
  return hasil.ok
    ? NextResponse.json({ ok: true, pesan: hasil.pesan })
    : NextResponse.json({ pesan: hasil.pesan }, { status: status(hasil.kode) });
}
