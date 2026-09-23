import { AlertTriangle, CheckCircle2, Clock, Database } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TombolTutupJalan } from "@/components/migrasi/tombol-tutup-jalan";
import { cn } from "@/lib/utils";
import { tanggalPanjang } from "@/lib/format";
import { ENTITAS_MIGRASI, type JalanMigrasi } from "@/lib/migrasi";
import type { CatatanMigrasi, RingkasKelompokJalan } from "@/lib/data/migrasi";

/** Keadaan awal: sistem lama belum pernah disentuh. */
export function BelumAdaMigrasi({ demo }: { demo: boolean }) {
  return (
    <Card className="rounded-3xl shadow-card ring-border-subtle">
      <div className="flex items-start gap-3 px-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Database className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base leading-6 font-semibold">
            Belum ada migrasi yang dijalankan
          </h2>
          <p className="text-[13px] leading-[18px] text-pretty text-muted-foreground">
            {demo
              ? "Mode demo tidak terhubung ke sistem lama, jadi tidak ada yang bisa dipindahkan. Hubungkan Supabase dan kv_store untuk memulai."
              : "Jalankan uji coba lebih dulu: ia membaca seluruh data lama dan melaporkan apa yang akan terjadi, tanpa menulis apa pun."}
          </p>
        </div>
      </div>
    </Card>
  );
}

/** Urutan entitas beserta hasilnya. */
export function TabelEntitas({ ringkas }: { ringkas: RingkasKelompokJalan[] }) {
  const perEntitas = new Map(ringkas.map((r) => [r.kelompok, r]));

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">Urutan pemindahan</h2>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          Dijalankan berurutan karena data yang belakangan menunjuk data
          sebelumnya.
        </p>
      </div>

      <ol className="space-y-2 px-5">
        {ENTITAS_MIGRASI.map((e, i) => {
          const r = perEntitas.get(e.kunci);
          const selesai = r && r.tertahan === 0 && r.diperiksa > 0;

          return (
            <li
              key={e.kunci}
              className="flex items-start gap-3 rounded-2xl bg-muted/50 p-3"
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  selesai
                    ? "bg-ok-fill text-ok-text"
                    : r && r.tertahan > 0
                      ? "bg-danger-fill text-danger-text"
                      : "bg-card text-muted-foreground",
                )}
              >
                {selesai ? <CheckCircle2 className="size-4" /> : i + 1}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-[13px] leading-[18px] font-semibold">
                  {e.label}
                </span>
                <span className="block text-[11px] leading-[14px] text-pretty text-muted-foreground">
                  {e.catatan}
                </span>
                {r ? (
                  <span className="tabular mt-1 flex flex-wrap gap-1">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-muted-foreground">
                      {r.diperiksa} diperiksa
                    </span>
                    {r.ditulis > 0 ? (
                      <span className="rounded-full bg-ok-fill px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-ok-text">
                        {r.ditulis} ditulis
                      </span>
                    ) : null}
                    {r.tertahan > 0 ? (
                      <span className="rounded-full bg-warn-fill px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-warn-text">
                        {r.tertahan} tertahan
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="mt-1 block text-[11px] leading-[14px] text-muted-foreground">
                    belum tersentuh
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/** Ringkasan satu eksekusi: kapan, oleh siapa, dan hasil akhirnya. */
export function RingkasJalan({
  jalan,
  ringkas,
  bolehTutup = false,
}: {
  jalan: JalanMigrasi;
  ringkas: RingkasKelompokJalan[];
  /** CEO/Manager boleh menutup jalan yang tersangkut terbuka. */
  bolehTutup?: boolean;
}) {
  // "Tertahan" bukan "gagal": sebagian besar memang sengaja tidak
  // dipindahkan — menunggu keputusan orang, atau sudah ada di V2.
  const tertahan = ringkas.reduce((a, r) => a + r.tertahan, 0);
  const ditulis = ringkas.reduce((a, r) => a + r.ditulis, 0);
  const beres = ringkas.length > 0 && tertahan === 0;
  const total = ringkas.reduce((a, r) => a + r.diperiksa, 0);

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-base leading-6 font-semibold">
            {jalan.tahap === "uji_coba" ? "Uji coba" : "Migrasi sungguhan"}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] leading-[14px] font-semibold",
                jalan.tahap === "uji_coba"
                  ? "bg-info-fill text-info-text"
                  : "bg-accentmuted-fill text-accentmuted-text",
              )}
            >
              {jalan.sumber}
            </span>
          </h2>
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {tanggalPanjang(jalan.dimulaiPada)}
            {jalan.olehNama ? ` · ${jalan.olehNama}` : ""}
            {jalan.selesaiPada ? "" : " · masih berjalan"}
          </p>
        </div>

        <span className="tabular shrink-0 text-right">
          <span className="block text-2xl leading-[30px] font-bold tracking-tight">
            {total}
          </span>
          <span className="block text-[11px] leading-[14px] text-muted-foreground">
            entri diperiksa
          </span>
        </span>
      </div>

      {tertahan > 0 ? (
        <p className="mx-5 flex items-start gap-2 rounded-2xl bg-warn-fill px-4 py-2.5 text-[13px] leading-[18px] text-warn-text">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span className="text-pretty">
            {tertahan} catatan tertahan dan {ditulis} ditulis. Tertahan belum
            tentu rusak — sebagian memang menunggu keputusan orang, sebagian
            sudah ada di V2. Rinciannya ada di daftar di bawah.
          </span>
        </p>
      ) : beres ? (
        <p className="mx-5 flex items-start gap-2 rounded-2xl bg-ok-fill px-4 py-2.5 text-[13px] leading-[18px] text-ok-text">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span className="text-pretty">
            Seluruh catatan sudah diperiksa dan tidak ada yang tertahan.
          </span>
        </p>
      ) : (
        <p className="mx-5 flex items-start gap-2 rounded-2xl bg-muted px-4 py-2.5 text-[13px] leading-[18px] text-muted-foreground">
          <Clock className="mt-0.5 size-4 shrink-0" />
          <span className="text-pretty">Masih ada entri yang menunggu.</span>
        </p>
      )}

      {jalan.catatan ? (
        <p className="px-5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
          {jalan.catatan}
        </p>
      ) : null}

      {bolehTutup && !jalan.selesaiPada ? (
        <TombolTutupJalan jalanId={jalan.id} />
      ) : null}
    </Card>
  );
}

/** Entri yang gagal atau dilewati — yang perlu ditindaklanjuti orang. */
export function DaftarBermasalah({ daftar }: { daftar: CatatanMigrasi[] }) {
  if (daftar.length === 0) return null;

  return (
    <Card className="kartu-interaktif rounded-3xl shadow-card ring-border-subtle">
      <div className="px-5">
        <h2 className="text-base leading-6 font-semibold">
          Perlu ditindaklanjuti
        </h2>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          {daftar.length} entri tidak berpindah mulus. Kunci aslinya disimpan
          supaya bisa ditelusuri balik di sistem lama.
        </p>
      </div>

      <ul className="space-y-1.5 px-5">
        {daftar.map((c) => (
          <li key={c.id} className="rounded-2xl bg-muted/50 px-3 py-2.5">
            <p className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] leading-[14px] font-semibold text-muted-foreground">
                tertahan
              </span>
              <span className="text-[11px] leading-[14px] text-muted-foreground">
                {c.entitas}
              </span>
            </p>
            <p className="mt-1 font-mono text-[11px] leading-[14px] break-all">
              {c.kunciLama}
            </p>
            {c.pesan ? (
              <p className="mt-0.5 text-[11px] leading-[14px] text-pretty text-muted-foreground">
                {c.pesan}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
