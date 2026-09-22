import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Boxes } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  KeadaanGagal,
  KeadaanKosong,
  KeadaanMemuat,
} from "@/components/shared/keadaan";
import {
  Bagian,
  ContohWarna,
  Petak,
  Spesimen,
} from "@/components/shared/spesimen";
import { ContohKonfirmasi } from "@/components/shared/contoh-konfirmasi";
import { peranValid, sesiSaatIni } from "@/lib/data/sesi";

export const metadata: Metadata = {
  title: "Referensi Desain — K-Space V2",
  description:
    "Rujukan visual design system Warm Modern Corporate: token, tipografi, primitif, pola berulang, dan empat keadaan modul.",
};

/** Kelas tombol pil, disalin persis dari modul yang sudah ada. */
const PIL_SARINGAN =
  "tekan-halus sentuh-nyaman rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap";
const PIL_DIALOG =
  "tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold inline-flex items-center";

/**
 * Referensi visual design system Warm Modern Corporate (PRD Fase 5).
 *
 * Sengaja tidak masuk menu: ia bukan alur kerja siapa pun. Gunanya satu —
 * jadi tempat menyalin, supaya modul berikutnya tidak menulis versinya
 * sendiri. Audit di docs/audit-ux.md menghitung 13 salinan tombol pil,
 * 59 banner pesan dengan 16 varian kelas, dan 57 kalimat kosong buatan
 * tangan; halaman ini adalah lawan dari kebiasaan itu.
 *
 * Semua contoh di sini adalah spesimen — tampilannya asli, perilakunya
 * tidak ada — kecuali bagian konfirmasi, yang memang harus dicoba untuk
 * dimengerti.
 */
export default async function ReferensiDesainPage({
  searchParams,
}: PageProps<"/referensi-desain">) {
  const { persona } = await searchParams;
  const pengguna = await sesiSaatIni(peranValid(persona) ? persona : undefined);
  if (!pengguna) redirect("/masuk");

  return (
    <AppShell pengguna={pengguna} halaman="Referensi desain">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
            Referensi desain
          </h1>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Design system Warm Modern Corporate seperti yang benar-benar dipakai
            K-Space hari ini — bukan cita-cita, melainkan rekaman. Halaman ini
            tidak masuk menu; ia ada supaya modul berikutnya menyalin dari satu
            tempat.
          </p>
        </div>

        {/* ---------------------------------------------------------- */}
        <Bagian
          judul="Warna status"
          keterangan="Empat nada, dan hanya empat. Satu arti satu warna: orang tidak bisa belajar bahwa kuning berarti gagal kalau gagal kadang abu-abu."
        >
          <Petak className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ContohWarna
              kelas="bg-ok-fill"
              kelasTeks="text-ok-text"
              nama="Berhasil"
              nilai="ok-fill / ok-text"
            />
            <ContohWarna
              kelas="bg-warn-fill"
              kelasTeks="text-warn-text"
              nama="Perlu perhatian"
              nilai="warn-fill / warn-text"
            />
            <ContohWarna
              kelas="bg-danger-fill"
              kelasTeks="text-danger-text"
              nama="Gagal"
              nilai="danger-fill / danger-text"
            />
            <ContohWarna
              kelas="bg-info-fill"
              kelasTeks="text-info-text"
              nama="Keterangan"
              nilai="info-fill / info-text"
            />
          </Petak>
        </Bagian>

        <Bagian
          judul="Warna unit"
          keterangan="Dipakai hanya untuk menandai unit, tidak pernah untuk status. Empat unit, empat warna tetap."
        >
          <Petak className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ContohWarna
              kelas="bg-unit-affiliator"
              nama="Affiliator"
              nilai="#f97316"
            />
            <ContohWarna kelas="bg-unit-mcn" nama="MCN" nilai="#2563eb" />
            <ContohWarna kelas="bg-unit-tap" nama="TAP" nilai="#8b5cf6" />
            <ContohWarna kelas="bg-unit-grosir" nama="Grosir" nilai="#c2410c" />
          </Petak>
        </Bagian>

        <Bagian
          judul="Permukaan & sudut"
          keterangan="Kartu memakai rounded-3xl (108 berkas memakainya). Radius yang lebih kecil dipakai untuk isi di dalam kartu, supaya sudut tidak pernah lebih tumpul daripada wadahnya."
        >
          <Petak className="flex flex-wrap items-end gap-3">
            {[
              ["rounded-xl", "1.25rem"],
              ["rounded-2xl", "1.5rem"],
              ["rounded-3xl", "1.75rem"],
              ["rounded-4xl", "penuh"],
            ].map(([kelas, nilai]) => (
              <div key={kelas} className="space-y-1 text-center">
                <span
                  aria-hidden
                  className={`block size-14 bg-card ring-1 ring-border-subtle ${kelas}`}
                />
                <p className="font-mono text-[11px] leading-[14px] text-muted-foreground">
                  {kelas}
                </p>
                <p className="text-[11px] leading-[14px] text-muted-foreground">
                  {nilai}
                </p>
              </div>
            ))}
            <div className="space-y-1 text-center">
              <span
                aria-hidden
                className="block size-14 rounded-3xl bg-card shadow-card"
              />
              <p className="font-mono text-[11px] leading-[14px] text-muted-foreground">
                shadow-card
              </p>
              <p className="text-[11px] leading-[14px] text-muted-foreground">
                bayangan kartu
              </p>
            </div>
          </Petak>
        </Bagian>

        {/* ---------------------------------------------------------- */}
        <Bagian
          judul="Tipografi"
          keterangan="Lima ukuran, dipakai berulang di seluruh aplikasi. Ukuran di luar daftar ini pertanda ada keputusan yang belum dibicarakan."
        >
          <Petak className="space-y-3">
            <div>
              <p className="text-[22px] leading-7 font-bold tracking-tight lg:text-[28px] lg:leading-9">
                Judul halaman
              </p>
              <p className="font-mono text-[11px] leading-[14px] text-muted-foreground">
                text-[22px] leading-7 font-bold · lg:text-[28px] lg:leading-9
              </p>
            </div>
            <div>
              <p className="text-[16px] leading-[22px] font-semibold">
                Judul kartu
              </p>
              <p className="font-mono text-[11px] leading-[14px] text-muted-foreground">
                text-[16px] leading-[22px] font-semibold
              </p>
            </div>
            <div>
              <p className="text-[13px] leading-[18px]">
                Teks isi — kalimat penjelas, isi kartu, keterangan.
              </p>
              <p className="font-mono text-[11px] leading-[14px] text-muted-foreground">
                text-[13px] leading-[18px]
              </p>
            </div>
            <div>
              <p className="text-[11px] leading-[14px]">
                Teks kecil — label, meta, isi pil.
              </p>
              <p className="font-mono text-[11px] leading-[14px] text-muted-foreground">
                text-[11px] leading-[14px]
              </p>
            </div>
            <div>
              <p className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                Label bagian
              </p>
              <p className="font-mono text-[11px] leading-[14px] text-muted-foreground">
                text-[11px] font-semibold tracking-[0.06em] uppercase
              </p>
            </div>
            <div>
              <p className="tabular text-[16px] leading-[22px] font-semibold">
                Rp 12.480.000
              </p>
              <p className="font-mono text-[11px] leading-[14px] text-muted-foreground">
                .tabular — angka KPI sejajar vertikal antar kartu
              </p>
            </div>
          </Petak>
        </Bagian>

        {/* ---------------------------------------------------------- */}
        <Bagian
          judul="Primitif"
          keterangan="Berasal dari shadcn/ui dan sudah disetel untuk tema ini. Spesimen di bawah tidak menjalankan apa pun."
        >
          <Petak className="space-y-3">
            <Spesimen
              kelas='<Button variant="default" | "secondary" | "outline" | "ghost" | "destructive" />'
              isi={
                <>
                  <Button type="button" disabled>
                    Simpan
                  </Button>
                  <Button type="button" variant="secondary" disabled>
                    Kirim
                  </Button>
                  <Button type="button" variant="outline" disabled>
                    Batal
                  </Button>
                  <Button type="button" variant="ghost" disabled>
                    Lewati
                  </Button>
                  <Button type="button" variant="destructive" disabled>
                    Hapus
                  </Button>
                </>
              }
              catatan="Tombol aksi utama memakai tinggi h-9 rounded-full px-4 di dalam kartu; ukuran bawaan dipakai di dalam dialog."
            />
            <Spesimen
              kelas='<Badge variant="default" | "secondary" | "outline" />'
              isi={
                <>
                  <Badge>Selesai</Badge>
                  <Badge variant="secondary">Berjalan</Badge>
                  <Badge variant="outline">Menunggu</Badge>
                </>
              }
              catatan="Badge menandai keadaan sebuah baris, bukan hasil sebuah aksi."
            />
          </Petak>
        </Bagian>

        {/* ---------------------------------------------------------- */}
        <Bagian
          judul="Tombol pil"
          keterangan="Dua bentuk, dan hanya dua: bulat penuh untuk bar saringan, persegi tinggi untuk pilihan di dalam dialog. Audit menemukan tiga belas berkas menulis ulang keduanya."
        >
          <Petak className="space-y-3">
            <Spesimen
              kelas={PIL_SARINGAN}
              isi={
                <>
                  <span
                    aria-hidden
                    className={`${PIL_SARINGAN} bg-primary text-primary-foreground`}
                  >
                    Semua
                  </span>
                  <span
                    aria-hidden
                    className={`${PIL_SARINGAN} bg-muted text-muted-foreground`}
                  >
                    Masuk
                  </span>
                  <span
                    aria-hidden
                    className={`${PIL_SARINGAN} bg-muted text-muted-foreground`}
                  >
                    Keluar
                  </span>
                </>
              }
              catatan="Yang aktif memakai bg-primary; sisanya bg-muted. Wajib aria-pressed pada tombol aslinya."
            />
            <Spesimen
              kelas={PIL_DIALOG}
              isi={
                <>
                  <span
                    aria-hidden
                    className={`${PIL_DIALOG} bg-primary text-primary-foreground`}
                  >
                    Pemasukan
                  </span>
                  <span
                    aria-hidden
                    className={`${PIL_DIALOG} bg-muted text-muted-foreground`}
                  >
                    Pengeluaran
                  </span>
                </>
              }
            />
          </Petak>
        </Bagian>

        {/* ---------------------------------------------------------- */}
        <Bagian
          judul="Pesan hasil aksi"
          keterangan="Muncul setelah Server Action selesai, di dalam kartu atau dialog yang sama dengan tombolnya — bukan di pojok layar, supaya tidak terlewat."
        >
          <Petak className="space-y-2">
            <p
              role="status"
              className="rounded-xl bg-ok-fill px-3 py-2 text-[11px] leading-[14px] text-pretty text-ok-text"
            >
              Transaksi tersimpan.
            </p>
            <p
              role="status"
              className="rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-pretty text-warn-text"
            >
              Nominal harus lebih besar dari nol.
            </p>
            <p
              role="status"
              className="rounded-xl bg-muted px-3 py-2 text-[11px] leading-[14px] text-pretty text-muted-foreground"
            >
              Mode demo: perubahan tidak disimpan.
            </p>
            <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
              Selalu <code className="font-mono">role=&quot;status&quot;</code>{" "}
              supaya pembaca layar mengumumkannya tanpa merebut fokus.
            </p>
          </Petak>
        </Bagian>

        {/* ---------------------------------------------------------- */}
        <Bagian
          judul="Keadaan: memuat"
          keterangan="Kerangkanya mengikuti bentuk isi aslinya, supaya tata letak tidak melompat saat data datang."
        >
          <KeadaanMemuat label="Memuat transaksi" />
        </Bagian>

        <Bagian
          judul="Keadaan: kosong"
          keterangan={
            'Bedakan dua hal: "Belum ada X" berarti memang belum pernah ada; "Tidak ada X yang cocok dengan saringan ini" berarti datanya ada, saringannya yang menyisakan nol.'
          }
        >
          <KeadaanKosong
            ikon={<Boxes className="size-4" />}
            judul="Belum ada aset tercatat"
            pesan="Aset lahir dari transaksi berjenis aset yang sudah dibayar, atau dicatat manual untuk barang lama."
            aksi={
              <span
                aria-hidden
                className="tekan-halus sentuh-nyaman inline-flex h-9 items-center rounded-full bg-primary px-4 text-[11px] font-semibold text-primary-foreground"
              >
                Catat aset
              </span>
            }
          />
        </Bagian>

        <Bagian
          judul="Keadaan: gagal"
          keterangan="Menawarkan tindakan, bukan permintaan maaf. Pesan galat mentah tidak ditampilkan — yang berguna bagi pelapor adalah kode galatnya."
        >
          <KeadaanGagal
            pesan="Angkanya tidak ditampilkan setengah-setengah: lebih baik kosong daripada salah."
            kode="a1b2c3"
            aksi={
              <span
                aria-hidden
                className="tekan-halus sentuh-nyaman inline-flex h-9 items-center rounded-full border border-border bg-background px-4 text-[11px] font-semibold"
              >
                Coba lagi
              </span>
            }
          />
        </Bagian>

        <Bagian
          judul="Keadaan: konfirmasi"
          keterangan="Satu-satunya contoh di halaman ini yang benar-benar jalan — konfirmasi hanya bisa dinilai dengan mencobanya."
        >
          <Card className="rounded-3xl shadow-card ring-border-subtle">
            <div className="space-y-2 px-5">
              <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
                Kalimatnya menyebutkan akibatnya, bukan bertanya
                &quot;yakin?&quot;. Orang menekan ya pada pertanyaan yang tidak
                ia baca; ia berhenti pada kalimat yang menyebut akibatnya.
              </p>

              <ContohKonfirmasi />
            </div>
          </Card>
        </Bagian>

        {/* ---------------------------------------------------------- */}
        <Bagian
          judul="Gerak"
          keterangan="Hanya transform dan opacity, semuanya tunduk pada prefers-reduced-motion. Tidak ada animasi yang menunda interaksi."
        >
          <Petak className="space-y-2">
            <p className="text-[13px] leading-[18px] text-pretty">
              <code className="font-mono text-[11px]">.tekan-halus</code> —
              menyusut sedikit saat ditekan. Dipakai pada semua tombol dan pil.
            </p>
            <p className="text-[13px] leading-[18px] text-pretty">
              <code className="font-mono text-[11px]">.kartu-interaktif</code> —
              terangkat saat disentuh kursor. Hanya untuk kartu yang bisa
              diklik.
            </p>
            <p className="text-[13px] leading-[18px] text-pretty">
              <code className="font-mono text-[11px]">.sentuh-nyaman</code> —
              memperluas area sentuh sampai 44px di layar sentuh tanpa mengubah
              tampilannya.
            </p>
            <p className="text-[13px] leading-[18px] text-pretty">
              <code className="font-mono text-[11px]">.area-cetak</code> —
              satu-satunya bagian yang ikut tercetak; sisanya disembunyikan oleh{" "}
              <code className="font-mono text-[11px]">@media print</code>.
            </p>
          </Petak>
        </Bagian>
      </div>
    </AppShell>
  );
}
