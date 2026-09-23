import { NextResponse, type NextRequest } from "next/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import { bolehMigrasi, orangPending } from "@/lib/data/migrasi";
import { tautanOrang } from "@/lib/data/resolusi";
import { abaikanOrang, tautkanOrang } from "@/app/actions/migrasi";

/**
 * Siapa yang menunggu keputusan, berapa data yang menggantung padanya,
 * dan bagaimana yang sudah tertaut itu tertaut.
 *
 * Layar sudah menampilkannya. Yang tidak bisa dilakukan layar adalah
 * menjadi bahan tinjauan di luar aplikasi: daftar tautan lewat nama —
 * yang paling mungkin keliru — sebaiknya bisa dibaca dan dibandingkan
 * orang lain sebelum migrasi sungguhan dijalankan.
 *
 * Yang dikirim hanya id dan nama, tanpa surel: ini daftar keputusan,
 * bukan salinan data pribadi karyawan.
 */
export async function GET() {
  const pengguna = await sesiSaatIni();
  if (!pengguna || !bolehMigrasi(pengguna)) {
    return NextResponse.json(
      { pesan: "Hanya CEO atau Manager yang boleh membaca daftar ini." },
      { status: 403 },
    );
  }

  const [menunggu, tautan] = await Promise.all([orangPending(), tautanOrang()]);

  const belum = menunggu.filter((o) => !o.userId && !o.diabaikan);

  return NextResponse.json(
    {
      ringkas: {
        menunggu: belum.length,
        sudahDiputuskan: menunggu.length - belum.length,
        tertautLewatNama: tautan.filter((t) => t.cara === "nama").length,
        catatanMenggantung: belum.reduce((a, o) => a + o.jumlah, 0),
      },
      menunggu: belum.map((o) => ({
        idLama: o.idLama,
        nama: o.nama,
        alasan: o.alasan,
        kemunculan: o.kemunculan,
        catatanMenggantung: o.jumlah,
      })),
      diputuskan: menunggu
        .filter((o) => o.userId || o.diabaikan)
        .map((o) => ({
          idLama: o.idLama,
          nama: o.nama,
          keputusan: o.diabaikan ? "diabaikan" : "ditautkan",
        })),
      // Yang tertaut lewat nama disebut lebih dulu: nama tidak menjamin
      // orang yang sama, dan salah tautan tidak menimbulkan galat apa pun.
      tautan: tautan.map((t) => ({
        idLama: t.idLama,
        namaLama: t.namaLama,
        namaBaru: t.namaBaru,
        cara: t.cara,
        tersimpan: t.tersimpan,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Berapa penautan boleh dikirim sekaligus. */
const BATAS_SEKALI = 200;

type Permintaan = {
  idLama?: unknown;
  userId?: unknown;
  abaikan?: unknown;
};

/**
 * Menautkan banyak orang sekaligus.
 *
 * Migrasi sungguhan bisa menyisakan puluhan orang yang harus diputuskan,
 * dan menautkannya satu per satu lewat layar memakan sore penuh. Daftar
 * padanannya biasanya sudah disiapkan di luar — dari berkas HR, misalnya
 * — dan jalur ini yang memasukkannya.
 *
 * Tiap penautan tetap melewati aturan yang sama dengan lewat layar:
 * pencatatan siapa yang memutuskan, dan satu orang V2 hanya boleh
 * menjadi padanan satu orang V1.
 */
export async function POST(permintaan: NextRequest) {
  const pengguna = await sesiSaatIni();
  if (!pengguna || !bolehMigrasi(pengguna)) {
    return NextResponse.json(
      { pesan: "Hanya CEO atau Manager yang boleh menautkan orang." },
      { status: 403 },
    );
  }

  let muatan: unknown;
  try {
    muatan = await permintaan.json();
  } catch {
    return NextResponse.json(
      { pesan: "Badannya bukan JSON." },
      { status: 400 },
    );
  }

  const daftar = (muatan as { tautan?: unknown })?.tautan;
  if (!Array.isArray(daftar) || daftar.length === 0) {
    return NextResponse.json(
      { pesan: "Kirim { tautan: [{ idLama, userId }] }." },
      { status: 400 },
    );
  }
  if (daftar.length > BATAS_SEKALI) {
    return NextResponse.json(
      { pesan: `Maksimal ${BATAS_SEKALI} penautan sekali kirim.` },
      { status: 400 },
    );
  }

  const hasil: { idLama: string; ok: boolean; pesan: string }[] = [];
  for (const mentah of daftar as Permintaan[]) {
    const idLama = typeof mentah?.idLama === "string" ? mentah.idLama : "";
    if (idLama === "") {
      hasil.push({ idLama: "", ok: false, pesan: "idLama tidak disebut." });
      continue;
    }

    const balas =
      mentah?.abaikan === true
        ? await abaikanOrang(idLama)
        : await tautkanOrang(
            idLama,
            typeof mentah?.userId === "string" ? mentah.userId : null,
          );

    hasil.push({
      idLama,
      ok: balas.ok,
      pesan: balas.pesan ?? "",
    });
  }

  const gagal = hasil.filter((h) => !h.ok).length;

  return NextResponse.json(
    {
      diminta: hasil.length,
      berhasil: hasil.length - gagal,
      gagal,
      hasil,
    },
    // Sebagian berhasil dan sebagian gagal bukan kegagalan permintaan;
    // yang menentukan tindak lanjut adalah isi `hasil`, bukan kodenya.
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
