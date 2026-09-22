import { NextResponse, type NextRequest } from "next/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { profilSaya, simpanKontak } from "@/lib/data/profil";
import { formatKontak, kelengkapanProfil } from "@/lib/profil";

/**
 * Profil pengguna yang sedang masuk, sebagai JSON.
 *
 * Halaman /profil tidak memerlukannya — ia server component dan membaca
 * `profilSaya()` langsung. Endpoint ini ada untuk yang tidak bisa:
 * komponen klien yang perlu menyegarkan profil setelah tersimpan, dan
 * nanti lonceng notifikasi yang perlu tahu nomor kontak tujuan tanpa
 * memuat ulang halaman.
 *
 * Yang dikembalikan selalu profil MILIK PEMANGGIL. Tidak ada parameter
 * id sama sekali — bukan karena lupa, melainkan supaya tidak ada yang
 * bisa membaca profil orang lain dengan menebak URL. Profil orang lain
 * sudah punya tempatnya sendiri di /tim/[id], lengkap dengan pagar
 * cakupan perannya.
 */
export async function GET() {
  const pengguna = await sesiSaatIni();
  if (!pengguna) {
    return NextResponse.json(
      { pesan: "Silakan masuk lebih dulu." },
      { status: 401 },
    );
  }

  const profil = await profilSaya(pengguna);
  if (!profil) {
    return NextResponse.json(
      {
        pesan:
          "Akun ini belum punya profil kepegawaian. Pengelola yang melengkapinya.",
      },
      { status: 404 },
    );
  }

  const { lengkap, kurang } = kelengkapanProfil(profil);

  return NextResponse.json(
    {
      profil: {
        id: profil.id,
        nama: profil.nama,
        email: profil.email,
        role: profil.role,
        jabatan: profil.jabatan,
        unit: profil.unitNama,
        unitKode: profil.unitKode,
        departemen: profil.departemen,
        program: profil.program,
        atasan: profil.atasanNama,
        status: profil.status,
        fotoUrl: profil.fotoUrl,
        kontak: profil.kontak,
        kontakTampil: formatKontak(profil.kontak),
        akunDipegang: profil.akunDipegang,
      },
      kelengkapan: { lengkap, kurang },
    },
    {
      headers: {
        // Profil menempel pada sesi; satu salinan di cache bersama akan
        // menjadi profil orang lain bagi pemanggil berikutnya.
        "cache-control": "private, no-store",
      },
    },
  );
}

/**
 * Memperbarui nomor kontak pemanggil.
 *
 * Aturannya tidak ditulis ulang di sini — `simpanKontak()` yang sama
 * dipakai Server Action di halaman profil. Endpoint ini ada supaya alat
 * lain (skrip pendaftaran nomor massal, misalnya, atau layar pengaturan
 * yang dibangun belakangan) tidak perlu menirukan normalisasinya sendiri
 * dan berakhir menyimpan bentuk yang berbeda untuk nomor yang sama.
 *
 * Hanya nomor MILIK PEMANGGIL. Tidak ada parameter id, sama seperti GET.
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

  if (
    typeof badan !== "object" ||
    badan === null ||
    !("kontak" in badan) ||
    typeof (badan as { kontak: unknown }).kontak !== "string"
  ) {
    return NextResponse.json(
      {
        pesan:
          'Sertakan medan "kontak" berupa teks; kosongkan untuk menghapus.',
      },
      { status: 400 },
    );
  }

  const hasil = await simpanKontak(
    pengguna,
    (badan as { kontak: string }).kontak,
  );

  if (!hasil.ok) {
    // Validasi salah ketik (400) dibedakan dari mode demo dan kegagalan
    // simpan (409/500) supaya pemanggil tahu mana yang perlu diperbaiki
    // di sisinya dan mana yang tidak.
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
    { kontak: hasil.data.kontak, pesan: hasil.pesan },
    { headers: { "cache-control": "private, no-store" } },
  );
}
