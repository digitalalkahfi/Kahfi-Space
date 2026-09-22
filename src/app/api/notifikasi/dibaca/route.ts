import { NextResponse, type NextRequest } from "next/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { tandaiDibaca, tandaiSemuaDibaca } from "@/app/actions/notifikasi";

/**
 * Menandai notifikasi sudah dibaca.
 *
 * Aturannya tidak ditulis ulang di sini — Server Action yang sama
 * dipakai tombol di halaman. Endpoint ini ada untuk yang tidak bisa
 * memanggil Server Action: pekerja latar, dan nanti pemberi tahu
 * WhatsApp yang menandai sebuah notifikasi begitu pesannya dibuka.
 *
 * POST dengan badan `{ "id": "…" }` menandai satu; `{ "semua": true }`
 * menandai seluruhnya. Dua bentuk pada satu endpoint karena keduanya
 * satu tindakan yang sama — yang berbeda hanya cakupannya.
 *
 * Tidak ada jalan membalikkan. Menandai dibaca adalah pernyataan "aku
 * sudah lihat", dan membatalkannya tidak mengembalikan apa pun.
 */
export async function POST(request: NextRequest) {
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

  const isi = (badan ?? {}) as { id?: unknown; semua?: unknown };
  const semua = isi.semua === true;
  const id = typeof isi.id === "string" ? isi.id : null;

  if (!semua && id === null) {
    return NextResponse.json(
      { pesan: 'Sertakan "id" berupa teks, atau "semua": true.' },
      { status: 400 },
    );
  }
  if (semua && id !== null) {
    // Menerima keduanya sekaligus berarti menebak maksud pemanggil, dan
    // tebakan yang salah di sini menandai seluruh kotak masuk.
    return NextResponse.json(
      { pesan: 'Pilih salah satu: "id" atau "semua".' },
      { status: 400 },
    );
  }

  const hasil = semua ? await tandaiSemuaDibaca() : await tandaiDibaca(id!);

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

  return NextResponse.json(
    {
      ok: true,
      pesan: hasil.pesan,
      ...(semua && "jumlah" in (hasil.data as object)
        ? { jumlah: (hasil.data as { jumlah: number }).jumlah }
        : {}),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
