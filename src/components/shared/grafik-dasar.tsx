import { cn } from "@/lib/utils";
import { bilangan, persen, rupiahRingkas, tanggalPendek } from "@/lib/format";
import {
  GAYA_GARIS_PEMBANDING,
  type KolomKomposisi,
  type TitikGrafik,
} from "@/lib/grafik";

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

/**
 * Batang harian terhadap target — satu batang per hari.
 *
 * Dibangun dari elemen HTML biasa, bukan SVG: 28 batang sempit di layar
 * 375px membuat `preserveAspectRatio` SVG memelarkan garis tipis secara
 * tidak merata, dan batang yang seharusnya sama lebar jadi berbeda.
 *
 * Targetnya digambar sebagai garis melintang pada tiap batang, bukan satu
 * garis lurus sepanjang grafik: target harian berubah saat berganti bulan,
 * dan garis lurus akan menyembunyikan perubahan itu.
 */
export function GrafikBatangTarget({
  judul,
  keterangan,
  hari,
  satuan = "rupiah",
  /** Label sumbu X hanya untuk sebagian hari supaya tidak bertumpuk. */
  jarakLabel = 7,
}: {
  judul: string;
  keterangan: string;
  hari: { tanggal: string; target: number; realisasi: number }[];
  satuan?: "rupiah" | "cacah";
  jarakLabel?: number;
}) {
  if (hari.length === 0) return null;

  const puncak = Math.max(
    1,
    ...hari.map((h) => Math.max(h.target, h.realisasi)),
  );
  const teks = (n: number) =>
    satuan === "rupiah" ? rupiahRingkas(n) : n.toLocaleString("id-ID");

  return (
    <section className="rounded-2xl bg-muted/50 p-3">
      <h3 className="text-[13px] leading-[18px] font-semibold">{judul}</h3>
      <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
        {keterangan}
      </p>

      <div
        role="img"
        aria-label={`Batang harian ${hari.length} hari: ${teks(
          hari.reduce((a, h) => a + h.realisasi, 0),
        )} dari target ${teks(hari.reduce((a, h) => a + h.target, 0))}. Rinciannya ada di tabel setelah grafik.`}
        className="mt-3 flex h-28 items-end gap-[2px]"
      >
        {hari.map((h) => {
          const tercapai = h.target > 0 && h.realisasi >= h.target;
          const kurang = h.target > 0 && h.realisasi < h.target * 0.8;
          return (
            <div
              key={h.tanggal}
              className="relative flex h-full flex-1 items-end"
              title={`${h.tanggal}: ${teks(h.realisasi)} dari ${teks(h.target)}`}
            >
              <span
                className={cn(
                  "w-full rounded-t-[3px]",
                  h.realisasi === 0
                    ? "bg-border"
                    : tercapai
                      ? "bg-ok"
                      : kurang
                        ? "bg-danger"
                        : "bg-warn",
                )}
                style={{
                  height: `${Math.max((h.realisasi / puncak) * 100, h.realisasi > 0 ? 2 : 1)}%`,
                }}
              />
              {h.target > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 h-px",
                    GAYA_GARIS_PEMBANDING.target.garis,
                  )}
                  style={{ bottom: `${(h.target / puncak) * 100}%` }}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-1 flex justify-between gap-1">
        {hari.map((h, i) =>
          i % jarakLabel === 0 || i === hari.length - 1 ? (
            <span
              key={h.tanggal}
              className="tabular text-[10px] leading-[14px] text-muted-foreground"
            >
              {tanggalPendek(h.tanggal).replace(/ \d{4}$/, "")}
            </span>
          ) : null,
        )}
      </div>

      {/* Batangnya hanya punya tooltip, dan tooltip tidak ada di layar
          sentuh maupun di pembaca layar. Tabel ini sumber angka yang
          sebenarnya; grafiknya ringkasan visual di atasnya. */}
      <table className="sr-only">
        <caption>{judul}</caption>
        <thead>
          <tr>
            <th scope="col">Tanggal</th>
            <th scope="col">Realisasi</th>
            <th scope="col">Target</th>
          </tr>
        </thead>
        <tbody>
          {hari.map((h) => (
            <tr key={h.tanggal}>
              <th scope="row">{tanggalPendek(h.tanggal)}</th>
              <td>{teks(h.realisasi)}</td>
              <td>{h.target > 0 ? teks(h.target) : "tanpa target"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-[14px] text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-ok" />
          Target tercapai
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-warn" />
          80–99%
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-danger" />
          Di bawah 80%
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-border" />
          Tidak ada laporan
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className={GAYA_GARIS_PEMBANDING.target.swatch} />
          {GAYA_GARIS_PEMBANDING.target.label} tiap hari
        </li>
      </ul>
    </section>
  );
}

/**
 * Batang unggahan harian.
 *
 * Saudara dekat `GrafikBatangTarget`, tapi sengaja terpisah: yang
 * dibandingkan di sini cacah, bukan rupiah, dan pembandingnya satu garis
 * mendatar yang sama sepanjang rentang — batas minimum level tidak
 * berubah tiap bulan seperti target GRD. Menyatukan keduanya berarti
 * satu komponen dengan dua mode yang tidak pernah dipakai bersamaan.
 *
 * Hari tanpa laporan digambar sebagai batang kosong setinggi satu piksel,
 * bukan dilewati: justru lubang itu yang ingin terlihat.
 */
export function GrafikBatangUnggahan({
  judul,
  keterangan,
  hari,
  minimum = null,
  jarakLabel = 7,
}: {
  judul: string;
  keterangan: string;
  hari: { tanggal: string; unggahan: number | null }[];
  /**
   * Batas minimum harian; digambar sebagai satu garis mendatar.
   *
   * null berarti tidak ada standar yang berlaku — dan tidak ada garis.
   * Menggambarnya di nol akan terbaca sebagai "minimumnya nol", yang
   * bukan hal yang sama dengan "belum ditetapkan".
   */
  minimum?: number | null;
  jarakLabel?: number;
}) {
  if (hari.length === 0) return null;

  // Puncak ikut memperhitungkan garis minimum: kalau tidak, minimum yang
  // belum pernah tercapai akan jatuh di luar bidang gambar dan justru
  // hilang tepat ketika ia paling perlu terlihat.
  const puncak = Math.max(1, ...hari.map((h) => h.unggahan ?? 0), minimum ?? 0);
  const total = hari.reduce((a, h) => a + (h.unggahan ?? 0), 0);
  const berlaporan = hari.filter((h) => h.unggahan !== null).length;
  const memenuhi =
    minimum === null
      ? 0
      : hari.filter((h) => (h.unggahan ?? 0) >= minimum).length;

  return (
    <section className="rounded-2xl bg-muted/50 p-3">
      <h3 className="text-[13px] leading-[18px] font-semibold">{judul}</h3>
      <p className="text-[11px] leading-[14px] text-pretty text-muted-foreground">
        {keterangan}
      </p>

      <div
        role="img"
        aria-label={`Batang unggahan ${hari.length} hari: ${bilangan(
          total,
        )} unggahan dari ${berlaporan} hari yang berlaporan.${
          minimum === null
            ? ""
            : ` Batas minimum ${bilangan(minimum)} per hari, terpenuhi ${memenuhi} hari.`
        } Rinciannya ada di tabel setelah grafik.`}
        className="relative mt-3 flex h-28 items-end gap-[2px]"
      >
        {hari.map((h) => {
          const kurang = minimum !== null && (h.unggahan ?? 0) < minimum;
          return (
            <div
              key={h.tanggal}
              className="relative flex h-full flex-1 items-end"
              title={`${h.tanggal}: ${
                h.unggahan === null
                  ? "tidak ada laporan"
                  : `${bilangan(h.unggahan)} unggahan`
              }${minimum === null ? "" : ` (min. ${bilangan(minimum)})`}`}
            >
              <span
                className={cn(
                  "w-full rounded-t-[3px]",
                  !h.unggahan ? "bg-border" : kurang ? "bg-warn" : "bg-ok",
                )}
                style={{
                  height: `${Math.max(((h.unggahan ?? 0) / puncak) * 100, h.unggahan ? 2 : 1)}%`,
                }}
              />
            </div>
          );
        })}

        {/* Satu garis lurus sepanjang rentang, bukan garis per batang
            seperti target GRD: batas minimum level tidak berubah saat
            berganti bulan. Dibedakan dari garis target dengan warna dan
            pola — putus-putus warna peringatan, bukan garis tipis pekat —
            supaya dua grafik bertetangga tidak tertukar artinya. */}
        {minimum !== null ? (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0",
              GAYA_GARIS_PEMBANDING.minimum.garis,
            )}
            style={{ bottom: `${(minimum / puncak) * 100}%` }}
          >
            {/* Label menempel pada garisnya, bukan hanya di legenda:
                legenda menjawab "garis itu apa", label menjawab "garis
                itu di angka berapa" — dan yang kedua itulah yang dicari
                mata saat melihat batang yang hampir menyentuhnya.
                Diletakkan di ujung kanan, tepat di atas garis, supaya
                tidak menutupi batang hari terakhir. */}
            <span
              className={cn(
                "tabular absolute right-0 rounded-full px-1.5",
                "text-[10px] leading-[14px] font-semibold",
                "bg-warn-fill text-warn-text",
                // Di atas garis seperti biasa; tapi bila garisnya nyaris
                // menyentuh puncak, label itu akan keluar dari bidang
                // grafik dan menimpa judulnya — di layar kecil bidangnya
                // paling sempit, jadi di sanalah ini paling sering
                // terjadi. Pindahkan ke bawah garis.
                minimum / puncak > 0.86 ? "top-[3px]" : "-top-[7px]",
              )}
            >
              min. {bilangan(minimum)}
            </span>
          </span>
        ) : null}
      </div>

      <div className="mt-1 flex justify-between gap-1">
        {hari.map((h, i) =>
          i % jarakLabel === 0 || i === hari.length - 1 ? (
            <span
              key={h.tanggal}
              className="tabular text-[10px] leading-[14px] text-muted-foreground"
            >
              {tanggalPendek(h.tanggal).replace(/ \d{4}$/, "")}
            </span>
          ) : null,
        )}
      </div>

      {/* Tooltip tidak ada di layar sentuh maupun di pembaca layar;
          tabel ini sumber angkanya yang sebenarnya. */}
      <table className="sr-only">
        <caption>{judul}</caption>
        <thead>
          <tr>
            <th scope="col">Tanggal</th>
            <th scope="col">Unggahan</th>
            {minimum === null ? null : <th scope="col">Batas minimum</th>}
          </tr>
        </thead>
        <tbody>
          {hari.map((h) => (
            <tr key={h.tanggal}>
              <th scope="row">{tanggalPendek(h.tanggal)}</th>
              <td>
                {h.unggahan === null
                  ? "tidak ada laporan"
                  : bilangan(h.unggahan)}
              </td>
              {minimum === null ? null : (
                <td>
                  {(h.unggahan ?? 0) >= minimum ? "terpenuhi" : "di bawah"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-[14px] text-muted-foreground">
        {minimum === null ? (
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-ok" />
            Unggahan hari itu
          </li>
        ) : (
          <>
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-ok" />
              Memenuhi minimum
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-warn" />
              Di bawah minimum
            </li>
          </>
        )}
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-border" />
          Tidak ada laporan
        </li>
        {minimum === null ? null : (
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("shrink-0", GAYA_GARIS_PEMBANDING.minimum.swatch)}
            />
            {GAYA_GARIS_PEMBANDING.minimum.label} {bilangan(minimum)}/hari
          </li>
        )}
      </ul>
    </section>
  );
}
