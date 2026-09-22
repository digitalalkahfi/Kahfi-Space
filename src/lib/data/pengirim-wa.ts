import "server-only";

import {
  BATAS_TUNGGU_MS,
  WA_PENGIRIM,
  WA_URL,
  alasanBelumSiap,
  gatewaySiap,
  headerGateway,
} from "@/lib/gateway-wa";
import {
  bacaBalasanGateway,
  galatJaringan,
  susunPesanWa,
  type HasilKirim,
  type IsiNotifikasi,
} from "@/lib/pesan-wa";

/**
 * Mengirim satu pesan lewat gateway WhatsApp.
 *
 * Satu pesan, satu panggilan. Tidak ada pengulangan di dalam fungsi
 * ini: yang mengulang adalah pekerjaan antrean, karena ia yang tahu
 * sudah berapa kali dicoba dan berapa lama jedanya. Fungsi yang
 * mengulang sendiri akan menahan antrean sambil tidur.
 *
 * Tidak pernah melempar. Kegagalan mengirim adalah keadaan yang
 * diharapkan — gateway pihak ketiga memang kadang tidak menjawab — dan
 * pemanggilnya perlu mencatatnya, bukan menangkap pengecualian.
 */
export async function kirimPesanWa(
  tujuan: string,
  notifikasi: IsiNotifikasi,
): Promise<HasilKirim> {
  if (!gatewaySiap()) {
    return {
      ok: false,
      galat: alasanBelumSiap() ?? "Gateway WhatsApp belum dikonfigurasi.",
      balasan: "",
      // Bukan salah pesannya; begitu kredensialnya ada, ia layak dicoba.
      bolehUlang: true,
    };
  }

  const isi = susunPesanWa(notifikasi);
  const batal = AbortSignal.timeout(BATAS_TUNGGU_MS);

  try {
    const jawaban = await fetch(WA_URL, {
      method: "POST",
      headers: headerGateway(),
      body: JSON.stringify({
        // Bentuk badan mengikuti gateway yang dipakai; disimpan di satu
        // tempat supaya berganti gateway hanya menyentuh berkas ini.
        from: WA_PENGIRIM || undefined,
        to: tujuan,
        type: "text",
        text: isi,
      }),
      signal: batal,
      // Jawaban gateway tidak boleh diambil dari cache mana pun.
      cache: "no-store",
    });

    const badan = await jawaban.text().catch(() => "");
    return bacaBalasanGateway(jawaban.status, badan);
  } catch (e) {
    const pesan = e instanceof Error ? e.message : String(e);
    return galatJaringan(pesan);
  }
}
