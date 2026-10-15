import { CircleCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TombolGoogle } from "@/components/masuk/tombol-google";
import { pesanGalatGoogle } from "@/lib/pendaftaran";

/**
 * "Sambungkan Google" (jalur B, docs/DAFTAR-GOOGLE-PERSETUJUAN.md §4):
 * anggota yang masuk dengan sandi menempelkan Gmail-nya — boleh berbeda
 * dari email K-Space — ke akun yang sama, lalu bisa masuk lewat Google.
 */
export function KartuGoogle({
  tersambung,
  galat,
}: {
  tersambung: { email: string } | null;
  galat: string | null;
}) {
  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-3 px-5">
        <div>
          <h2 className="text-base leading-6 font-semibold">Masuk dengan Google</h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {tersambung
              ? "Akun Google sudah tersambung. Kamu bisa masuk lewat Google atau kata sandi."
              : "Sambungkan Gmail-mu supaya bisa masuk lewat Google. Gmail-nya boleh berbeda dari email K-Space; riwayatmu tetap di akun yang sama."}
          </p>
        </div>
        {tersambung ? (
          <p className="flex items-center gap-2 rounded-2xl bg-ok-fill px-3 py-2 text-[13px] leading-[18px] text-ok-text">
            <CircleCheck className="size-4 shrink-0" />
            <span className="break-all">{tersambung.email || "Google tersambung"}</span>
          </p>
        ) : (
          <TombolGoogle mode="sambung" lanjut="/profil" />
        )}
        {galat ? (
          <p
            role="alert"
            className="rounded-xl bg-danger-fill px-3 py-2 text-[11px] leading-[14px] text-danger-text"
          >
            {pesanGalatGoogle(galat)}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
