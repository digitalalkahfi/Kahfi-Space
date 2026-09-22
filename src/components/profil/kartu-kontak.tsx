"use client";

import { useState } from "react";
import { Phone, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogKonfirmasi } from "@/components/shared/dialog-konfirmasi";
import { ubahKontakSaya } from "@/app/actions/profil";
import { OptinWhatsapp } from "@/components/profil/optin-whatsapp";
import {
  formatKontak,
  kontakSah,
  normalkanKontak,
  type KesiapanWhatsapp,
} from "@/lib/profil";

/**
 * Nomor kontak — nomor WhatsApp resmi pengguna.
 *
 * Disendirikan dari dialog identitas karena akibatnya berbeda: nama dan
 * foto hanya dilihat orang, sedangkan nomor ini yang akan dituju kanal
 * WhatsApp. Salah satu angka berarti pemberitahuan mendarat di ponsel
 * orang lain — karena itu ada langkah konfirmasi yang menampilkan nomor
 * dalam bentuk bakunya sebelum disimpan.
 */
export function KartuKontak({
  kontakAwal,
  kesiapan,
  optin,
}: {
  kontakAwal: string | null;
  /** Sejauh mana nomor ini siap dipakai kanal WhatsApp. */
  kesiapan: KesiapanWhatsapp;
  /** Sudah setuju dihubungi lewat WhatsApp? */
  optin: boolean;
}) {
  const [nilai, setNilai] = useState(
    kontakAwal ? (formatKontak(kontakAwal) ?? kontakAwal) : "",
  );

  const bersih = nilai.trim();
  const kosong = bersih === "";
  const sah = kosong || kontakSah(bersih);
  const baku = kosong ? null : normalkanKontak(bersih);
  const berubah = baku !== kontakAwal;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="space-y-2 px-5">
        <h2 className="flex items-center gap-2 text-base leading-6 font-semibold">
          <Phone className="size-4 text-muted-foreground" />
          Nomor kontak
        </h2>
        <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
          Nomor WhatsApp yang akan dituju pemberitahuan. Ditulis bagaimanapun —
          08…, 62…, atau +62… — disimpan dalam satu bentuk baku, supaya nomor
          yang sama tidak pernah terbaca sebagai dua nomor berbeda.
        </p>

        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <label htmlFor="nomor-kontak" className="sr-only">
              Nomor kontak
            </label>
            <Input
              id="nomor-kontak"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={nilai}
              onChange={(e) => setNilai(e.target.value)}
              aria-invalid={!sah}
              aria-describedby="nomor-kontak-bantuan"
              placeholder="0812-3456-7890"
            />
            <p
              id="nomor-kontak-bantuan"
              className={
                sah
                  ? "text-[11px] leading-[14px] text-pretty text-muted-foreground"
                  : "text-[11px] leading-[14px] text-pretty text-warn-text"
              }
            >
              {!sah
                ? "Belum berupa nomor seluler Indonesia. Contoh: 0812-3456-7890."
                : kosong
                  ? "Dikosongkan berarti tidak ada nomor yang dituju; pemberitahuan tetap muncul di dalam aplikasi."
                  : `Akan disimpan sebagai ${formatKontak(bersih)}`}
            </p>
          </div>

          <DialogKonfirmasi
            judul={kosong ? "Hapus nomor kontak?" : "Simpan nomor ini?"}
            pesan={
              kosong
                ? "Tanpa nomor, pemberitahuan WhatsApp tidak dikirim ke mana pun. Yang di dalam aplikasi tetap jalan."
                : `Pemberitahuan WhatsApp akan dikirim ke ${formatKontak(bersih)}. Pastikan angkanya benar — nomor yang keliru berarti pesan mendarat di ponsel orang lain.`
            }
            labelYa={kosong ? "Hapus nomor" : "Simpan nomor"}
            berbahaya={kosong}
            onSetuju={() => ubahKontakSaya(bersih)}
            pemicu={
              <Button
                type="button"
                disabled={!sah || !berubah}
                className="tekan-halus sentuh-nyaman h-9 rounded-full px-4 text-[11px] font-semibold"
              >
                <ShieldCheck className="size-3.5" />
                Simpan
              </Button>
            }
          />
        </div>
        <OptinWhatsapp kesiapan={kesiapan} optin={optin} />
      </div>
    </Card>
  );
}
