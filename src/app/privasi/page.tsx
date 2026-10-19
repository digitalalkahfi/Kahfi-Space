import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — K-Space V2",
  description: "Data apa yang dipakai K-Space dan untuk apa.",
};

/** Kontak pengelola untuk pertanyaan dan permintaan hapus data. */
const KONTAK = "digitalalkahfi@gmail.com";

const BAGIAN: { judul: string; isi: string[] }[] = [
  {
    judul: "Untuk siapa K-Space",
    isi: [
      "K-Space adalah ruang kerja internal Al-Kahfi Corp. Hanya anggota tim yang disetujui CEO atau Manager yang bisa memakainya.",
    ],
  },
  {
    judul: "Data yang kami terima saat masuk dengan Google",
    isi: [
      "Nama, alamat email, dan foto profil akun Google Anda. Kami tidak meminta akses ke Gmail, Drive, kontak, atau data Google lainnya.",
      "Data ini dipakai untuk mengenali Anda saat masuk dan untuk menampilkan nama Anda di dalam aplikasi.",
    ],
  },
  {
    judul: "Data yang Anda isi sendiri",
    isi: [
      "Data kerja yang Anda masukkan di K-Space, misalnya absensi, laporan harian, tugas, dan nomor WhatsApp saat mendaftar. Data ini dipakai untuk pekerjaan tim dan hanya terlihat oleh orang yang berwenang sesuai perannya.",
    ],
  },
  {
    judul: "Yang tidak kami lakukan",
    isi: [
      "Kami tidak menjual, menyewakan, atau membagikan data Anda kepada pihak lain untuk iklan atau keperluan di luar pekerjaan Al-Kahfi Corp.",
    ],
  },
  {
    judul: "Tempat data disimpan",
    isi: [
      "Data disimpan di layanan basis data Supabase dan aplikasi dijalankan di Vercel. Akses ke data dijaga per peran di dalam basis data.",
    ],
  },
  {
    judul: "Menghapus data atau bertanya",
    isi: [
      `Untuk pertanyaan, atau bila Anda ingin akun dan data Anda dihapus, hubungi ${KONTAK}.`,
    ],
  },
];

/**
 * Kebijakan privasi publik. Halaman ini sengaja terbuka tanpa login
 * (lihat `TERBUKA` di middleware): Google mensyaratkannya sebelum login
 * Google bisa dipublikasikan untuk semua anggota.
 */
export default function PrivasiPage() {
  return (
    <main className="flex min-h-dvh justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-4">
        <div className="space-y-1.5">
          <h1 className="text-[22px] leading-7 font-bold tracking-tight">
            Kebijakan Privasi K-Space
          </h1>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Berlaku sejak 19 Oktober 2026 · Al-Kahfi Corp.
          </p>
        </div>

        <Card className="rounded-3xl shadow-card ring-border-subtle">
          <div className="space-y-5 px-5">
            {BAGIAN.map((b) => (
              <section key={b.judul} className="space-y-1.5">
                <h2 className="text-[15px] leading-5 font-semibold">
                  {b.judul}
                </h2>
                {b.isi.map((p) => (
                  <p
                    key={p}
                    className="text-[13px] leading-5 text-pretty text-muted-foreground"
                  >
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </Card>

        <Link
          href="/masuk"
          className="inline-block px-1 text-[13px] leading-[18px] font-semibold underline-offset-2 hover:underline"
        >
          ← Kembali ke halaman masuk
        </Link>
      </div>
    </main>
  );
}
