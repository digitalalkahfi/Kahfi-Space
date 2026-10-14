import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FormMasuk } from "@/components/masuk/form-masuk";
import { TombolGoogle } from "@/components/masuk/tombol-google";
import { loginGoogleAktif, modeData } from "@/lib/supabase/config";
import { pesanGalatGoogle } from "@/lib/pendaftaran";
import { jalurAman } from "@/lib/rute";

export const metadata: Metadata = {
  title: "Masuk — K-Space V2",
  description: "Masuk ke ruang kerja K-Space V2 Al-Kahfi Corp.",
};

export default async function MasukPage({
  searchParams,
}: PageProps<"/masuk">) {
  const { lanjut, galat_google: galatGoogle } = await searchParams;
  const tujuan = jalurAman(typeof lanjut === "string" ? lanjut : null);

  const demo = modeData() === "demo";
  const google = loginGoogleAktif();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <div className="space-y-1.5 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <span className="text-lg font-bold tracking-tight">K</span>
          </span>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight">
            K-Space <span className="text-secondary">V2</span>
          </h1>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            Ruang kerja tim Al-Kahfi Corp.
          </p>
        </div>

        <Card className="rounded-3xl shadow-card ring-border-subtle">
          <div className="px-5">
            <FormMasuk lanjut={tujuan} />
            {google ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="h-px flex-1 bg-border-subtle" />
                  atau
                  <span className="h-px flex-1 bg-border-subtle" />
                </div>
                <TombolGoogle mode="masuk" lanjut={tujuan} />
                <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  Belum punya akun? Masuk dengan Google, lalu tunggu
                  persetujuan Manager atau CEO.
                </p>
              </div>
            ) : null}
            {typeof galatGoogle === "string" ? (
              <p
                role="alert"
                className="mt-3 rounded-xl bg-danger-fill px-3 py-2 text-[11px] leading-[14px] text-danger-text"
              >
                {pesanGalatGoogle(galatGoogle)}
              </p>
            ) : null}
          </div>
        </Card>

        {demo ? (
          <Card className="rounded-3xl bg-warn-fill shadow-none ring-0">
            <div className="flex items-start gap-2 px-5 text-warn-text">
              <FlaskConical className="mt-0.5 size-4 shrink-0" />
              <p className="text-[13px] leading-[18px] text-pretty">
                Supabase belum dikonfigurasi, jadi belum ada akun yang bisa
                dipakai masuk.{" "}
                <Link href="/beranda" className="font-semibold underline">
                  Buka mode demo
                </Link>{" "}
                untuk meninjau aplikasinya dengan data contoh.
              </p>
            </div>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
