import { cn } from "@/lib/utils";
import { persen, rupiahRingkas } from "@/lib/format";
import type { KolomKomposisi, TitikGrafik } from "@/lib/grafik";

/** Format nilai sumbu sesuai satuannya. */
function nilaiTeks(nilai: number, satuan: "rupiah" | "persen") {
  return satuan === "persen" ? persen(nilai) : rupiahRingkas(nilai);
}

/**
 * Grafik garis sederhana.
 *
 * Digambar sebagai SVG polos, tanpa pustaka grafik: bentuk yang
 * dibutuhkan dasbor ini sederhana, dan menambah pustaka berarti
 * menambah bundel yang harus diunduh ponsel di lapangan. Garis nol
 * ditarik bila serinya menyeberang, supaya rugi tidak terbaca seperti
 * untung kecil.
 *
 * Tinggal di `shared/` sejak dasbor analitik GMV ikut memakainya — dua
 * modul yang berbeda menggambar garis yang sama, dan menyalinnya berarti
 * keduanya akan melenceng sendiri-sendiri.
 */
export function GrafikGaris({
  judul,
  keterangan,
  titik,
  satuan = "rupiah",
  pembanding,
}: {
  judul: string;
  keterangan: string;
  titik: TitikGrafik[];
  satuan?: "rupiah" | "persen";
  /**
   * Garis kedua sebagai pembanding, mis. target harian.
   *
   * Digambar putus-putus dan lebih redup: yang diceritakan grafik ini
   * tetap garis utamanya; pembanding hanya menjawab "di atas atau di
   * bawah". Skalanya ikut dihitung bersama garis utama, kalau tidak
   * keduanya tidak bisa dibandingkan secara visual sama sekali.
   */
  pembanding?: { label: string; titik: TitikGrafik[] };
}) {
  if (titik.length < 2) return null;

  const lebar = 300;
  const tinggi = 90;
  const nilai = titik.map((t) => t.nilai);
  const nilaiBanding = pembanding?.titik.map((t) => t.nilai) ?? [];
  const max = Math.max(...nilai, ...nilaiBanding, 0);
  const min = Math.min(...nilai, ...nilaiBanding, 0);
  const rentang = max - min || 1;

  const y = (n: number) => tinggi - ((n - min) / rentang) * tinggi;
  const x = (i: number) => (i / (titik.length - 1)) * lebar;

  const garis = titik.map(
    (t, i) => `${x(i).toFixed(1)},${y(t.nilai).toFixed(1)}`,
  );
  const area = `${x(0)},${y(min)} ${garis.join(" ")} ${x(titik.length - 1)},${y(min)}`;
  const terakhir = titik.at(-1)!;

  // Pembanding hanya digambar bila panjangnya sama; garis yang titiknya
  // tidak sejajar akan berbohong tentang hari mana yang di atas target.
  const garisBanding =
    pembanding && pembanding.titik.length === titik.length
      ? pembanding.titik.map(
          (t, i) => `${x(i).toFixed(1)},${y(t.nilai).toFixed(1)}`,
        )
      : null;

  return (
    <section className="rounded-2xl bg-muted/50 p-3">
      <h3 className="text-[13px] leading-[18px] font-semibold">{judul}</h3>
      <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
        {keterangan}
      </p>

      <svg
        viewBox={`0 0 ${lebar} ${tinggi}`}
        role="img"
        aria-label={`${judul}: ${titik
          .map((t) => `${t.label} ${nilaiTeks(t.nilai, satuan)}`)
          .join(", ")}${
          garisBanding
            ? `. ${pembanding!.label}: ${pembanding!.titik
                .map((t) => `${t.label} ${nilaiTeks(t.nilai, satuan)}`)
                .join(", ")}`
            : ""
        }`}
        preserveAspectRatio="none"
        className="mt-2 h-24 w-full"
      >
        <polygon points={area} className="fill-secondary/15" />
        {garisBanding ? (
          <polyline
            points={garisBanding.join(" ")}
            fill="none"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            strokeLinecap="round"
            className="stroke-muted-foreground/70"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <polyline
          points={garis.join(" ")}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-secondary"
          vectorEffect="non-scaling-stroke"
        />
        {/* Titik terakhir adalah periode yang sedang dibuka; ditandai
            supaya mata tahu di mana "sekarang" pada garis ini. */}
        <circle
          cx={x(titik.length - 1)}
          cy={y(terakhir.nilai)}
          r={3}
          className="fill-secondary"
        />
        {min < 0 ? (
          <line
            x1={0}
            x2={lebar}
            y1={y(0)}
            y2={y(0)}
            strokeDasharray="4 4"
            className="stroke-border"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>

      <p className="tabular mt-1 flex flex-wrap items-baseline justify-between gap-x-2 text-[11px] leading-[14px] text-muted-foreground">
        <span>
          {titik[0].label} → {terakhir.label}
        </span>
        <span className="font-semibold text-foreground">
          {terakhir.label}: {nilaiTeks(terakhir.nilai, satuan)}
        </span>
      </p>

      {garisBanding ? (
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-[14px] text-muted-foreground">
          <span
            aria-hidden
            className="h-0 w-4 shrink-0 border-t-2 border-dashed border-muted-foreground/70"
          />
          {pembanding!.label}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Grafik batang bertumpuk untuk komposisi biaya.
 *
 * Tiap kolom satu periode; tingginya sebanding dengan total biayanya,
 * jadi periode yang lebih mahal memang terlihat lebih tinggi — bukan
 * dinormalkan jadi seratus persen yang menyamarkan besarannya.
 */
export function GrafikKomposisi({
  judul,
  keterangan,
  kolom,
}: {
  judul: string;
  keterangan: string;
  kolom: KolomKomposisi[];
}) {
  if (kolom.length === 0) return null;

  const puncak = Math.max(1, ...kolom.map((k) => k.total));
  const legenda = kolom[0].bagian;

  return (
    <section className="rounded-2xl bg-muted/50 p-3">
      <h3 className="text-[13px] leading-[18px] font-semibold">{judul}</h3>
      <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
        {keterangan}
      </p>

      <div className="mt-3 flex h-24 items-end gap-1.5">
        {kolom.map((k, i) => (
          <div
            key={k.label}
            className={cn(
              "flex flex-1 flex-col items-center gap-1",
              // Kolom terakhir adalah periode yang sedang dibuka.
              i === kolom.length - 1 ? "opacity-100" : "opacity-70",
            )}
          >
            <div
              className="flex w-full flex-col-reverse overflow-hidden rounded-t-lg"
              style={{ height: `${(k.total / puncak) * 100}%` }}
              title={`${k.label}: ${rupiahRingkas(k.total)}`}
            >
              {k.bagian.map((b) => (
                <span
                  key={b.label}
                  className={cn("w-full", b.warna)}
                  style={{
                    height:
                      k.total > 0 ? `${(b.nilai / k.total) * 100}%` : "0%",
                  }}
                />
              ))}
            </div>
            <span
              className={cn(
                "truncate text-[10px] leading-[14px]",
                i === kolom.length - 1
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {k.label}
            </span>
          </div>
        ))}
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {legenda.map((b) => (
          <li
            key={b.label}
            className="flex items-center gap-1.5 text-[11px] leading-[14px] text-muted-foreground"
          >
            <span className={cn("size-2 rounded-full", b.warna)} />
            {b.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
