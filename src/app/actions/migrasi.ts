"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import {
  bolehMigrasi,
  eksporKvStore,
  persetujuanPemetaan,
} from "@/lib/data/migrasi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import { PEMETAAN, versiPemetaan } from "@/lib/pemetaan";
import { siapkanSemua, type Kamus } from "@/lib/impor";
import type { TahapMigrasi } from "@/lib/migrasi";

/**
 * Setujui pemetaan sebuah entitas.
 *
 * Versinya dihitung ulang di server dari pemetaan yang sedang berlaku,
 * bukan diterima dari browser: kalau tidak, halaman lama yang masih
 * terbuka bisa menyetujui pemetaan yang sudah berubah.
 */
export async function setujuiPemetaan(
  entitas: string,
  catatan: string,
): Promise<Hasil> {
  const pemetaan = PEMETAAN.find((p) => p.kunci === entitas);
  if (!pemetaan) return gagal("Entitas tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehMigrasi(pengguna)) {
    return gagal(
      "Hanya CEO atau Manager yang boleh menyetujui pemetaan.",
      "izin",
    );
  }

  const sb = await klienServer();
  const { error } = await sb.from("migrasi_persetujuan").insert({
    entitas,
    versi: versiPemetaan(pemetaan),
    disetujui_oleh: pengguna.id,
    // Isinya ikut disalin: versi hanya sidik, dan pemetaan di kode akan
    // berubah — tanpa salinan ini tidak ada cara mengetahui bentuk yang
    // pernah disetujui.
    pemetaan,
    catatan: catatan.trim().slice(0, 500),
  });

  if (error) {
    if (error.code === "23505") {
      return gagal("Pemetaan versi ini sudah disetujui.", "validasi");
    }
    return error.code === "42501"
      ? gagal("Kamu tidak berhak menyetujui pemetaan.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  revalidatePath("/migrasi");
  revalidatePath("/migrasi/pemetaan");
  return sukses(undefined, `Pemetaan ${pemetaan.label} disetujui.`);
}

/** Tarik kembali persetujuan sebuah entitas. */
export async function tarikPersetujuan(entitas: string): Promise<Hasil> {
  const pemetaan = PEMETAAN.find((p) => p.kunci === entitas);
  if (!pemetaan) return gagal("Entitas tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehMigrasi(pengguna)) {
    return gagal(
      "Hanya CEO atau Manager yang boleh menarik persetujuan.",
      "izin",
    );
  }

  const sb = await klienServer();
  const { error } = await sb
    .from("migrasi_persetujuan")
    .delete()
    .eq("entitas", entitas)
    .eq("versi", versiPemetaan(pemetaan));

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak menarik persetujuan.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  revalidatePath("/migrasi");
  revalidatePath("/migrasi/pemetaan");
  return sukses(undefined, `Persetujuan ${pemetaan.label} ditarik.`);
}

// ---------------------------------------------------------------------
// Menjalankan impor
// ---------------------------------------------------------------------

/** Tabel tujuan tiap entitas, beserta kolom yang menentukan keunikannya. */
const TUJUAN: Record<
  string,
  {
    tabel:
      "users" | "accounts" | "goals" | "daily_reports" | "attendance" | "tasks";
    kunci: string;
  }
> = {
  user: { tabel: "users", kunci: "id" },
  account: { tabel: "accounts", kunci: "username" },
  goal: { tabel: "goals", kunci: "id" },
  report: { tabel: "daily_reports", kunci: "tanggal" },
  attendance: { tabel: "attendance", kunci: "tanggal" },
  task: { tabel: "tasks", kunci: "judul" },
};

/**
 * Jalankan impor dari ekspor kv_store.
 *
 * `uji_coba` hanya menghitung dan mencatat apa yang akan terjadi — tidak
 * satu baris pun ditulis ke tabel tujuan. `sungguhan` menulis, dan hanya
 * boleh dijalankan setelah seluruh pemetaan disetujui: pemetaan yang
 * keliru jauh lebih mahal diperbaiki setelah datanya masuk.
 */
export async function jalankanMigrasi(
  tahap: TahapMigrasi,
): Promise<Hasil<{ jalanId: string; berhasil: number; gagal: number }>> {
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehMigrasi(pengguna)) {
    return gagal(
      "Hanya CEO atau Manager yang boleh menjalankan migrasi.",
      "izin",
    );
  }

  const sb = await klienServer();

  if (tahap === "sungguhan") {
    const disetujui = await persetujuanPemetaan();
    const kurang = PEMETAAN.filter(
      (p) =>
        !disetujui.some(
          (s) => s.entitas === p.kunci && s.versi === versiPemetaan(p),
        ),
    );
    if (kurang.length > 0) {
      return gagal(
        `Pemetaan ${kurang.map((p) => p.label).join(", ")} belum disetujui.`,
        "validasi",
      );
    }
  }

  const [ekspor, kamus] = await Promise.all([eksporKvStore(), bangunKamus()]);

  // Selagi `kv_store_lama` kosong, yang terbaca adalah berkas contoh di
  // repositori. Itu benar untuk uji coba dan berbahaya untuk sungguhan:
  // baris karangan akan tertulis ke tabel sungguhan, dan migrasi
  // sungguhan hanya boleh sekali. Database menolaknya juga (0122); di
  // sini supaya pesannya sampai sebelum satu baris pun disentuh.
  if (tahap === "sungguhan" && ekspor.tiruan) {
    return gagal(
      "Yang terbaca masih data contoh, bukan data sistem lama. Salin dulu kv_store lama ke tabel kv_store_lama sebelum menjalankan migrasi sungguhan.",
      "validasi",
    );
  }

  const hasil = siapkanSemua(ekspor.entri, kamus);

  // Dimulai lewat fungsi database supaya seluruh syaratnya berlaku lewat
  // jalur mana pun: satu jalan terbuka, sungguhan sekali saja, dan wajib
  // didahului uji coba (0073 & 0076).
  const { data: jalan, error: galatJalan } = await sb.rpc(
    "mulai_migrasi_jalan",
    {
      p_tahap: tahap,
      p_sumber: ekspor.sumber,
      p_pemetaan: PEMETAAN,
      p_catatan:
        tahap === "uji_coba"
          ? "Uji coba: tidak ada baris yang ditulis ke tabel tujuan."
          : "Migrasi sungguhan.",
    },
  );

  if (galatJalan || !jalan) {
    return gagal(galatJalan?.message ?? "Gagal memulai migrasi.", "validasi");
  }

  // Penulisan sungguhan dikerjakan berurutan sesuai ketergantungan
  // entitas — `siapkanSemua` sudah mengurutkannya.
  if (tahap === "sungguhan") {
    for (const h of hasil) {
      if (h.status !== "berhasil" || !h.data) continue;
      const tujuan = TUJUAN[h.entitas];
      if (!tujuan) continue;

      const { error } = await sb
        .from(tujuan.tabel)
        .upsert(h.data as never, { onConflict: tujuan.kunci });

      if (error) {
        h.status = "gagal";
        h.pesan = error.message;
      }
    }
  }

  const catatan = hasil.map((h) => ({
    jalan_id: jalan.id,
    entitas: h.entitas,
    kunci_lama: h.kunciLama,
    // Id baris barunya ikut dicatat: tanpa itu verifikasi hanya bisa
    // membandingkan jumlah, bukan membuktikan barisnya benar-benar ada.
    id_baru:
      h.status === "berhasil" && h.data && typeof h.data === "object"
        ? ((h.data as { id?: string }).id ?? null)
        : null,
    status: h.status,
    pesan: h.pesan.slice(0, 500),
  }));

  // Dimasukkan bertahap supaya satu permintaan tidak membawa ribuan baris.
  for (let i = 0; i < catatan.length; i += 200) {
    const { error } = await sb
      .from("migrasi_catatan")
      .insert(catatan.slice(i, i + 200));
    if (error) {
      return gagal(`Gagal mencatat hasil migrasi: ${error.message}`);
    }
  }

  // Ditutup lewat fungsi database supaya aturannya satu: jalan yang masih
  // punya catatan 'menunggu' tidak boleh dinyatakan selesai.
  const { error: galatTutup } = await sb.rpc("tutup_migrasi_jalan", {
    p_jalan: jalan.id,
  });
  if (galatTutup) {
    return gagal(
      `Migrasi berjalan, tetapi gagal ditutup: ${galatTutup.message}`,
    );
  }

  revalidatePath("/migrasi");

  const berhasil = hasil.filter((h) => h.status === "berhasil").length;
  const gagalJumlah = hasil.filter((h) => h.status === "gagal").length;

  return sukses(
    { jalanId: jalan.id, berhasil, gagal: gagalJumlah },
    tahap === "uji_coba"
      ? `Uji coba selesai: ${berhasil} entri siap, ${gagalJumlah} bermasalah. Tidak ada yang ditulis.`
      : `Migrasi selesai: ${berhasil} entri masuk, ${gagalJumlah} gagal.`,
  );
}

/** Padanan nama/kode lama → id, dibaca dari database saat itu juga. */
async function bangunKamus(): Promise<Kamus> {
  const sb = await klienServer();
  const [unit, program, orang, akun] = await Promise.all([
    sb.from("units").select("id, kode"),
    sb.from("programs").select("id, nama"),
    sb.from("users").select("id, nama"),
    sb.from("accounts").select("id, username"),
  ]);

  return {
    unit: Object.fromEntries((unit.data ?? []).map((u) => [u.kode, u.id])),
    program: Object.fromEntries(
      (program.data ?? []).map((p) => [p.nama, p.id]),
    ),
    pengguna: Object.fromEntries((orang.data ?? []).map((u) => [u.nama, u.id])),
    akun: Object.fromEntries((akun.data ?? []).map((a) => [a.username, a.id])),
  };
}

/**
 * Tandai K-Space lama sebagai hanya-baca, atau buka kembali.
 *
 * Yang dibekukan sebenarnya adalah kebiasaan orang, bukan sistemnya:
 * aplikasi ini tidak bisa mengunci server lama. Yang bisa dilakukan
 * adalah memastikan semua orang tahu, di setiap halaman, ke mana
 * pencatatan sekarang harus masuk.
 */
export async function ubahStatusKspaceLama(input: {
  readonly: boolean;
  url?: string;
}): Promise<Hasil> {
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehMigrasi(pengguna)) {
    return gagal(
      "Hanya CEO atau Manager yang boleh mengubah status ini.",
      "izin",
    );
  }

  const url = (input.url ?? "").trim();
  if (url && !/^https?:\/\//i.test(url)) {
    return gagal(
      "Alamat K-Space lama harus diawali http:// atau https://.",
      "validasi",
    );
  }

  const sb = await klienServer();
  const { error } = await sb
    .from("pengaturan")
    .update({ lama_readonly: input.readonly, lama_url: url })
    .eq("id", true);

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak mengubah pengaturan.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }

  // Spanduknya muncul di seluruh halaman, jadi semuanya disegarkan.
  revalidatePath("/", "layout");

  return sukses(
    undefined,
    input.readonly
      ? "K-Space lama ditandai hanya-baca. Pengingatnya kini tampil di seluruh halaman."
      : "Tanda hanya-baca dilepas.",
  );
}

/**
 * Menutup jalan migrasi yang tersangkut terbuka.
 *
 * Dibutuhkan karena percobaan yang terputus di tengah meninggalkan jalan
 * terbuka, dan hanya satu yang boleh terbuka pada satu waktu.
 */
export async function tutupMigrasi(jalanId: string): Promise<Hasil> {
  if (!jalanId) return gagal("Jalan migrasi tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehMigrasi(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh menutup migrasi.", "izin");
  }

  const sb = await klienServer();
  const { error } = await sb.rpc("tutup_migrasi_jalan", { p_jalan: jalanId });

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak menutup jalan migrasi.", "izin")
      : gagal(error.message, "validasi");
  }

  revalidatePath("/migrasi");
  return sukses(undefined, "Jalan migrasi ditutup.");
}
