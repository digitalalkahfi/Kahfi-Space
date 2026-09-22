import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CobaSandi } from "@/components/profil/coba-sandi";

/**
 * Ringkasan cara akun ini diamankan.
 *
 * Bukan hiasan: orang sering tidak tahu akun kerjanya terikat ke email
 * yang mana, dan itu justru yang dibutuhkan saat ia kehilangan akses.
 */
export function KartuAkun({ email }: { email: string }) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-2 px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <ShieldCheck className="size-4 text-muted-foreground" />
          Cara akun ini diamankan
        </h2>

        <dl className="space-y-2">
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                Akun terikat ke
              </dt>
              <dd className="text-[13px] leading-[18px] break-all">
                {email || "Belum ada email"}
              </dd>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <KeyRound className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                Cara masuk
              </dt>
              <dd className="text-[13px] leading-[18px] text-pretty">
                Email dan kata sandi lewat Supabase Auth. Kata sandinya tidak
                pernah tersimpan sebagai teks — yang disimpan hanya sidik
                acaknya, jadi tidak ada yang bisa membacanya kembali, pengelola
                sekalipun.
              </dd>
            </div>
          </div>
        </dl>
      </div>
    </Card>
  );
}

/**
 * Aturan sandi aman — dan tempat mencobanya.
 *
 * Syaratnya diambil dari daftar yang sama yang dipakai memvalidasi
 * (lib/keamanan.ts), jadi apa yang tercentang di sini tidak bisa berbeda
 * dari apa yang benar-benar diterima saat menyimpan.
 *
 * Kotak isiannya bukan hiasan: orang biasanya baru tahu sandinya ditolak
 * setelah mengisi tiga kolom di form ganti sandi lalu gagal. Di sini ia
 * bisa mencobanya dulu tanpa mempertaruhkan apa pun — yang diketik tidak
 * dikirim ke mana pun.
 */
export function KartuAturanSandi({
  nama,
  email,
}: {
  nama?: string;
  email?: string;
}) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-2 px-5">
        <h2 className="text-base leading-6 font-semibold">Aturan sandi aman</h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Panjang lebih menolong daripada rumit. Kalimat pendek yang mudah kamu
          ingat tapi tidak bisa ditebak orang lain jauh lebih kuat daripada satu
          kata dengan angka di ujungnya.
        </p>

        <CobaSandi nama={nama} email={email} />
      </div>
    </Card>
  );
}
