import { NextResponse, type NextRequest } from "next/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { preferensiSaya } from "@/lib/data/preferensi-notifikasi";
import { profilSaya } from "@/lib/data/profil";
import { ubahSatuPreferensi } from "@/app/actions/preferensi-notifikasi";
import {
  KETERANGAN_KATEGORI,
  LABEL_KATEGORI,
  type KategoriNotifikasi,
} from "@/lib/notifikasi";
import { bolehMematikan, ringkasPreferensi } from "@/lib/preferensi-notifikasi";

/**
 * Preferensi notifikasi pemanggil, sebagai JSON.
 *
 * Yang dikembalikan adalah preferensi YANG BERLAKU — tersimpan digabung
 * dengan bawaan — bukan isi tabelnya. Bedanya penting: pengguna yang
 * belum pernah membuka halaman ini tetap punya pengaturan yang berlaku,
 * dan pemanggil yang menerima daftar kosong akan salah menyimpulkan
 * bahwa ia tidak menerima apa-apa.
 *
 * Kemampuan perannya ikut dikirim (`bolehMematikan`) supaya pemanggil
 * tidak menirukan aturan itu sendiri lalu melenceng.
 */
export async function GET() {
  const pengguna = await sesiSaatIni();
  if (!pengguna) {
    return NextResponse.json(
      { pesan: "Silakan masuk lebih dulu." },
      { status: 401 },
    );
  }

  const [preferensi, profil] = await Promise.all([
    preferensiSaya(pengguna),
    profilSaya(pengguna),
  ]);

  return NextResponse.json(
    {
      bolehMematikan: bolehMematikan(pengguna.role),
      // Kanal WhatsApp tidak berarti apa-apa tanpa nomor tujuan;
      // disebut di sini supaya pemanggil tidak menyalakannya lalu
      // bertanya-tanya kenapa tidak ada yang sampai.
      kontakTerisi: (profil?.kontak ?? null) !== null,
      ringkasan: ringkasPreferensi(preferensi),
      preferensi: preferensi.map((p) => ({
        kategori: p.kategori,
        label: LABEL_KATEGORI[p.kategori as KategoriNotifikasi],
        keterangan: KETERANGAN_KATEGORI[p.kategori as KategoriNotifikasi],
        inApp: p.inApp,
        whatsapp: p.whatsapp,
      })),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}

/**
 * Mengubah satu kanal pada satu kategori.
 *
 * Aturannya tidak ditulis ulang di sini — Server Action yang sama
 * dipakai saklar di halaman, dan trigger `jaga_matikan_notifikasi`
 * (migrasi 0115) menjaga pagar perannya di basis data.
 */
export async function PATCH(request: NextRequest) {
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

  const isi = (badan ?? {}) as {
    kategori?: unknown;
    kanal?: unknown;
    nyala?: unknown;
  };

  if (
    typeof isi.kategori !== "string" ||
    typeof isi.kanal !== "string" ||
    typeof isi.nyala !== "boolean"
  ) {
    return NextResponse.json(
      {
        pesan:
          'Sertakan "kategori" (teks), "kanal" (inApp|whatsapp), dan "nyala" (true/false).',
      },
      { status: 400 },
    );
  }

  const hasil = await ubahSatuPreferensi(isi.kategori, isi.kanal, isi.nyala);

  if (!hasil.ok) {
    const status =
      hasil.kode === "validasi"
        ? 400
        : hasil.kode === "izin"
          ? 403
          : hasil.kode === "demo"
            ? 409
            : 500;
    return NextResponse.json({ pesan: hasil.pesan }, { status });
  }

  // Keadaan sesudahnya ikut dikirim: satu perubahan bisa menyeret yang
  // lain (mematikan in-app ikut mematikan WhatsApp-nya), dan pemanggil
  // yang hanya menerima "ok" akan menampilkan keadaan yang sudah tidak
  // benar sampai ia menyegarkan sendiri.
  const sesudah = await preferensiSaya(pengguna);

  return NextResponse.json(
    {
      ok: true,
      pesan: hasil.pesan,
      ringkasan: ringkasPreferensi(sesudah),
      preferensi: sesudah.find((p) => p.kategori === isi.kategori) ?? null,
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
