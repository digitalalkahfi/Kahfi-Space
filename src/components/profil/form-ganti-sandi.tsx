"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PetunjukSandi } from "@/components/profil/petunjuk-sandi";
import {
  PesanAksi,
  nadaHasil,
  type NadaPesan,
} from "@/components/shared/pesan-aksi";
import { DialogKonfirmasi } from "@/components/shared/dialog-konfirmasi";
import { gantiSandi } from "@/app/actions/auth";
import type { Hasil } from "@/lib/data/hasil";
import { periksaSandi, sandiBaruSah } from "@/lib/keamanan";

/** Satu isian sandi dengan tombol lihat/sembunyi. */
function IsianSandi({
  id,
  label,
  nilai,
  onUbah,
  autoComplete,
  galat,
  bantuan,
}: {
  id: string;
  label: string;
  nilai: string;
  onUbah: (v: string) => void;
  autoComplete: string;
  galat?: string | null;
  bantuan?: string;
}) {
  const [terlihat, setTerlihat] = useState(false);

  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="text-[11px] leading-[14px] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
      >
        {label}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          type={terlihat ? "text" : "password"}
          value={nilai}
          autoComplete={autoComplete}
          onChange={(e) => onUbah(e.target.value)}
          aria-invalid={Boolean(galat)}
          aria-describedby={galat || bantuan ? `${id}-bantuan` : undefined}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          aria-label={terlihat ? `Sembunyikan ${label}` : `Tampilkan ${label}`}
          aria-pressed={terlihat}
          onClick={() => setTerlihat((t) => !t)}
          className="tekan-halus sentuh-nyaman size-9 shrink-0 rounded-full p-0"
        >
          {terlihat ? (
            <EyeOff className="size-3.5" />
          ) : (
            <Eye className="size-3.5" />
          )}
        </Button>
      </div>
      {galat || bantuan ? (
        <p
          id={`${id}-bantuan`}
          className={
            galat
              ? "text-[11px] leading-[14px] text-pretty text-warn-text"
              : "text-[11px] leading-[14px] text-pretty text-muted-foreground"
          }
        >
          {galat ?? bantuan}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Form ganti kata sandi.
 *
 * Tiga isian, dan ketiganya wajib. Sandi lama bukan formalitas: tanpa
 * itu, laptop yang ditinggal terbuka sebentar cukup bagi siapa pun untuk
 * mengunci pemiliknya keluar dari akunnya sendiri.
 *
 * Yang salah diberitahukan di sebelah isian yang salah, bukan sebagai
 * satu pesan di bawah tombol — orang tidak seharusnya menebak kolom mana
 * yang dimaksud.
 */
export function FormGantiSandi({
  nama,
  email,
}: {
  nama: string;
  email: string;
}) {
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");
  const [pesan, setPesan] = useState<string | null>(null);
  const [nada, setNada] = useState<NadaPesan>("netral");
  // Sandi lama yang salah adalah kegagalan paling sering, dan satu-
  // satunya yang bisa ditunjuk ke kolom tertentu. Ditaruh di sebelah
  // kolomnya, bukan di banner bawah yang tidak menjelaskan kolom mana.
  const [galatLama, setGalatLama] = useState<string | null>(null);
  const [selesai, setSelesai] = useState(false);
  const [mengirim, mulai] = useTransition();

  const layak = periksaSandi(baru, { nama, email });
  const cocok = sandiBaruSah(lama, baru, ulang);

  // Peringatan baru muncul setelah kolomnya benar-benar diisi: menyalak
  // pada kolom kosong yang belum sempat disentuh hanya bikin gaduh.
  const galatBaru =
    baru !== "" && baru === lama
      ? "Kata sandi baru masih sama dengan yang lama."
      : baru !== "" && !layak.ok
        ? (layak.pesan ??
          `Belum memenuhi: ${layak.belum.join(", ").toLowerCase()}.`)
        : null;
  const galatUlang =
    ulang !== "" && ulang !== baru ? "Ulangannya belum sama." : null;

  const siap = cocok.ok && layak.ok && !mengirim;

  // Dibungkus Promise supaya DialogKonfirmasi bisa menunggu hasilnya dan
  // menutup dirinya sendiri hanya kalau benar-benar berhasil.
  const kirim = () =>
    new Promise<Hasil>((beres) => {
      mulai(async () => {
        const hasil = await gantiSandi(lama, baru, ulang);
        const sandiLamaSalah = !hasil.ok && hasil.kode === "izin";

        setGalatLama(sandiLamaSalah ? hasil.pesan : null);
        setNada(nadaHasil(hasil));
        // Yang sudah ditunjuk ke kolomnya tidak diulang di banner bawah.
        setPesan(sandiLamaSalah ? null : (hasil.pesan ?? null));
        setSelesai(hasil.ok);

        if (hasil.ok) {
          setLama("");
          setBaru("");
          setUlang("");
        }
        beres(hasil);
      });
    });

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-3 px-5">
        <div>
          <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
            <KeyRound className="size-4 text-muted-foreground" />
            Ganti kata sandi
          </h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            Kata sandi saat ini diminta lebih dulu — itu yang membedakan kamu
            dari siapa pun yang kebetulan menemukan layarmu masih terbuka.
          </p>
        </div>

        <IsianSandi
          id="sandi-lama"
          label="Kata sandi saat ini"
          nilai={lama}
          onUbah={(v) => {
            setLama(v);
            setGalatLama(null);
            setSelesai(false);
          }}
          autoComplete="current-password"
          galat={galatLama}
        />

        <IsianSandi
          id="sandi-baru"
          label="Kata sandi baru"
          nilai={baru}
          onUbah={setBaru}
          autoComplete="new-password"
          galat={galatBaru}
        />

        <PetunjukSandi sandi={baru} konteks={{ nama, email }} />

        <IsianSandi
          id="sandi-ulang"
          label="Ulangi kata sandi baru"
          nilai={ulang}
          onUbah={setUlang}
          autoComplete="new-password"
          galat={galatUlang}
          bantuan="Diketik dua kali supaya salah ketik tidak mengunci akunmu sendiri."
        />

        {selesai ? (
          <div className="flex items-start gap-2 rounded-2xl bg-ok-fill px-4 py-2.5 text-ok-text">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0" role="status">
              <p className="text-[13px] leading-[18px] font-semibold">
                Kata sandi diganti
              </p>
              <p className="text-[11px] leading-[14px] text-pretty">
                Perangkat lain yang masih masuk ke akun ini akan diminta masuk
                ulang dengan sandi baru. Sesi di perangkat ini tetap berjalan.
              </p>
            </div>
          </div>
        ) : pesan ? (
          <PesanAksi nada={nada}>{pesan}</PesanAksi>
        ) : null}

        {/* Konfirmasi karena akibatnya tidak bisa ditarik kembali dari
            sini: semua perangkat lain yang masih masuk akan terlempar
            keluar, termasuk ponsel yang sedang tidak di tangan. */}
        <DialogKonfirmasi
          judul="Ganti kata sandi sekarang?"
          pesan="Setelah diganti, perangkat lain yang masih masuk ke akun ini akan diminta masuk ulang dengan sandi baru. Pastikan kamu mengingatnya — tidak ada yang bisa membacanya kembali, pengelola sekalipun."
          labelYa="Ya, ganti sandi"
          onSetuju={kirim}
          pemicu={
            <Button
              type="button"
              disabled={!siap}
              className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
            >
              {mengirim ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Ganti kata sandi
            </Button>
          }
        />
      </div>
    </Card>
  );
}
