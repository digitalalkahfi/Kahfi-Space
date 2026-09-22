import { Building2, Lock, Mail, Network, Phone, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { LencanaStatus } from "@/components/tim/lencana-status";
import { DialogIdentitas } from "@/components/profil/dialog-identitas";
import {
  formatKontak,
  medanTerkunci,
  nilaiMedan,
  type MedanTerkunci,
  type ProfilDiri,
} from "@/lib/profil";

/**
 * Kepala profil diri.
 *
 * Bentuknya mengikuti `KepalaProfil` di halaman /tim supaya orang yang
 * sudah pernah melihat profil rekannya langsung mengenali halamannya
 * sendiri — bedanya di sini nomor kontak ikut tampil, karena itu miliknya
 * sendiri dan tidak ditampilkan kepada orang lain.
 */
export function KepalaProfilDiri({ profil }: { profil: ProfilDiri }) {
  const kontak = formatKontak(profil.kontak);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start gap-4 px-5">
        <Avatar className="size-14 shrink-0">
          {profil.fotoUrl ? (
            <AvatarImage src={profil.fotoUrl} alt="" />
          ) : (
            <AvatarFallback className="bg-primary text-base font-bold text-primary-foreground">
              {profil.inisial}
            </AvatarFallback>
          )}
        </Avatar>

        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-[22px] leading-7 font-bold tracking-tight">
            {profil.nama}
            <LencanaStatus status={profil.status} />
          </h1>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {profil.jabatan}
          </p>

          <dl className="mt-2 space-y-1 text-[11px] leading-[16px] text-muted-foreground">
            {profil.email ? (
              <div className="flex items-center gap-1.5">
                <Mail className="size-3 shrink-0" />
                <dd className="truncate">{profil.email}</dd>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5">
              <Phone className="size-3 shrink-0" />
              <dd className="truncate">
                {kontak ?? "Nomor kontak belum diisi"}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 className="size-3 shrink-0" />
              <dd className="truncate">
                {profil.unitNama}
                {profil.program ? ` · ${profil.program}` : ""}
                {profil.departemen ? ` · dep. ${profil.departemen}` : ""}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <UserRound className="size-3 shrink-0" />
              <dd className="truncate">
                {profil.atasanNama
                  ? `Melapor ke ${profil.atasanNama}`
                  : "Belum punya atasan"}
              </dd>
            </div>
          </dl>

          <div className="mt-3 flex flex-wrap gap-2">
            <DialogIdentitas namaAwal={profil.nama} fotoAwal={profil.fotoUrl} />
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Satu baris data kepegawaian: nilai, dan alasan ia terkunci. */
function BarisTerkunci({ medan, isi }: { medan: MedanTerkunci; isi: string }) {
  return (
    <div className="border-b border-border-subtle py-2 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <dt className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            {medan.label}
          </dt>
          <dd className="text-[13px] leading-[18px] text-pretty">{isi}</dd>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] leading-[14px] font-medium text-muted-foreground">
          <Lock className="size-3" />
          Pengelola
        </span>
      </div>
      {/* Alasannya ditulis, bukan disembunyikan di tooltip: di layar
          sentuh tooltip tidak pernah muncul sama sekali. */}
      <p className="mt-0.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
        {medan.alasan}
      </p>
    </div>
  );
}

/**
 * Data kepegawaian — yang ditetapkan pengelola.
 *
 * Dibagi dua: yang menentukan wewenang (peran, unit, program, atasan)
 * dan yang sekadar mengikuti penempatan. Pembagian itu penting karena
 * keliru di kelompok pertama berarti seseorang melihat angka yang bukan
 * haknya — sementara keliru di kelompok kedua hanya salah tulis.
 *
 * Gemboknya ditampilkan di depan, bukan muncul belakangan sebagai pesan
 * galat: orang berhak tahu mana yang bisa ia perbaiki sendiri sebelum ia
 * mencoba. Penolakannya sendiri terjadi di basis data (trigger
 * jaga_ubah_diri, migrasi 0041).
 */
export function DataKepegawaian({ profil }: { profil: ProfilDiri }) {
  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-3 px-5">
        <div>
          <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
            <Network className="size-4 text-muted-foreground" />
            Data kepegawaian
          </h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Semuanya ditetapkan pengelola. Kalau ada yang keliru, mintalah ke
            CEO atau Manager — bukan karena birokrasi, melainkan karena empat
            baris pertama menentukan siapa boleh melihat angka siapa.
          </p>
        </div>

        <section>
          <h3 className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Menentukan wewenang
          </h3>
          <dl>
            {medanTerkunci("wewenang").map((m) => (
              <BarisTerkunci
                key={m.kunci}
                medan={m}
                isi={nilaiMedan(profil, m)}
              />
            ))}
          </dl>
        </section>

        <section>
          <h3 className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Mengikuti penempatan
          </h3>
          <dl>
            {medanTerkunci("penempatan").map((m) => (
              <BarisTerkunci
                key={m.kunci}
                medan={m}
                isi={nilaiMedan(profil, m)}
              />
            ))}
          </dl>
        </section>
      </div>
    </Card>
  );
}
