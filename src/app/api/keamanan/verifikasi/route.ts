import { NextResponse, type NextRequest } from "next/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { verifikasiSandi } from "@/lib/data/keamanan";

/**
 * Membuktikan kata sandi saat ini tanpa menggantinya.
 *
 * Gunanya: form ganti sandi bisa memberi tahu "sandi lama salah" sebelum
 * orang selesai mengetik dua kolom berikutnya, dan langkah berisiko lain
 * di kemudian hari (menonaktifkan akun, mengganti email) bisa meminta
 * bukti yang sama tanpa menirukan caranya sendiri-sendiri.
 *
 * POST, bukan GET: kata sandi tidak boleh pernah muncul di URL — ia akan
 * mengendap di riwayat peramban, log server, dan header Referer.
 *
 * Hanya sandi MILIK PEMANGGIL yang bisa diperiksa; tidak ada parameter
 * email atau id. Percobaannya dibatasi (5 per 5 menit per akun), karena
 * tanpa itu endpoint ini adalah alat tebak sandi bagi siapa pun yang
 * berhasil mencuri satu sesi.
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

  const sandi =
    typeof badan === "object" && badan !== null && "sandi" in badan
      ? (badan as { sandi: unknown }).sandi
      : undefined;

  if (typeof sandi !== "string") {
    return NextResponse.json(
      { pesan: 'Sertakan medan "sandi" berupa teks.' },
      { status: 400 },
    );
  }

  const hasil = await verifikasiSandi(pengguna, sandi);

  const balasan = NextResponse.json(
    { cocok: hasil.ok, pesan: hasil.pesan },
    {
      status: hasil.ok
        ? 200
        : hasil.kode === "validasi"
          ? 400
          : hasil.kode === "demo"
            ? 409
            : 401,
    },
  );
  // Jawaban ini bergantung pada satu sesi dan satu tebakan; tidak boleh
  // mengendap di cache mana pun.
  balasan.headers.set("cache-control", "private, no-store");
  return balasan;
}
