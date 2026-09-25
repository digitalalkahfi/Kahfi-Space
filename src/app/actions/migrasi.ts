"use server";

import { revalidatePath } from "next/cache";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { sesiSaatIni } from "@/lib/data/sesi";
import {
  bolehMigrasi,
  eksporKvStore,
  isiEksporLama,
  persetujuanPemetaan,
} from "@/lib/data/migrasi";
import { BALASAN_DEMO, gagal, sukses, type Hasil } from "@/lib/data/hasil";
import { versiPemetaan } from "@/lib/pemetaan";
import { PEMETAAN_V1 } from "@/lib/pemetaan-v1";
import { rekapPemetaan } from "@/lib/rekap-pemetaan";
import {
  catatKunciTakDipetakan,
  kumpulkanOrangPending,
  terapkanAkun,
  terapkanIzin,
  terapkanKas,
  terapkanKehadiran,
  terapkanLaporan,
  terapkanRekapGmv,
  terapkanPengumuman,
  terapkanAgenda,
  terapkanMasalah,
  terapkanMasukan,
  terapkanSampel,
  terapkanLms,
  terapkanPengaturanAbsensi,
  terapkanTodo,
  terapkanTugas,
  terapkanUsersList,
  type HasilTerap,
} from "@/lib/data/terapkan-migrasi";
import { bacaEksporV1, tolakBerkas, type RingkasUnggah } from "@/lib/ekspor-v1";
import type { TahapMigrasi } from "@/lib/migrasi";

/**
 * Setujui pemetaan sebuah entitas.
 *
 * Versinya dihitung ulang di server dari pemetaan yang sedang berlaku,
 * bukan diterima dari browser: kalau tidak, halaman lama yang masih
 * terbuka bisa menyetujui pemetaan yang sudah berubah.
 */
/** Mencari pemetaan sebuah kelompok ekspor V1. */
function cariPemetaan(entitas: string) {
  return PEMETAAN_V1.find((p) => p.kunci === entitas);
}

export async function setujuiPemetaan(
  entitas: string,
  catatan: string,
): Promise<Hasil> {
  const pemetaan = cariPemetaan(entitas);
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

  // Angka yang dilihat saat menyetujui ikut disimpan.
  //
  // Persetujuan atas pemetaan tanpa angkanya hanya menyetujui bentuk;
  // yang sebenarnya diputuskan orang adalah "pemetaan ini, untuk data
  // sebanyak ini, dengan sekian yang masih menunggu keputusan". Kalau
  // angkanya berubah sesudah itu — ekspor diunggah ulang, misalnya —
  // perbedaannya harus bisa dilihat, bukan ditebak.
  const rekapSaatIni = rekapPemetaan(await isiEksporLama(), PEMETAAN_V1).find(
    (r) => r.kunci === entitas,
  );

  const sb = await klienServer();
  const { error } = await sb.from("migrasi_persetujuan").insert({
    entitas,
    versi: versiPemetaan(pemetaan),
    disetujui_oleh: pengguna.id,
    // Isinya ikut disalin: versi hanya sidik, dan pemetaan di kode akan
    // berubah — tanpa salinan ini tidak ada cara mengetahui bentuk yang
    // pernah disetujui.
    pemetaan: {
      ...pemetaan,
      rekap: rekapSaatIni
        ? {
            ekspor: rekapSaatIni.ekspor,
            terpetakan: rekapSaatIni.terpetakan,
            butuhKeputusan: rekapSaatIni.butuhKeputusan,
          }
        : null,
    },
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
  const pemetaan = cariPemetaan(entitas);
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
    const kurang = PEMETAAN_V1.filter(
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

  const ekspor = await eksporKvStore();

  // Selagi `kv_store_lama` kosong, yang terbaca adalah contoh ekspor di
  // repositori. Itu benar untuk uji coba dan berbahaya untuk sungguhan:
  // baris contoh akan tertulis ke tabel sungguhan, dan migrasi sungguhan
  // hanya boleh sekali. Database menolaknya juga (0122); di sini supaya
  // pesannya sampai sebelum satu baris pun disentuh.
  if (tahap === "sungguhan" && ekspor.tiruan) {
    return gagal(
      "Yang terbaca masih contoh ekspor, bukan data sistem lama. Unggah dulu ekspor K-Space lama sebelum menjalankan migrasi sungguhan.",
      "validasi",
    );
  }

  // Dimulai lewat fungsi database supaya seluruh syaratnya berlaku lewat
  // jalur mana pun: satu jalan terbuka, sungguhan sekali saja, dan wajib
  // didahului uji coba (0073 & 0076).
  const { data: jalan, error: galatJalan } = await sb.rpc(
    "mulai_migrasi_jalan",
    {
      p_tahap: tahap,
      p_sumber: ekspor.sumber,
      p_pemetaan: PEMETAAN_V1,
      p_catatan:
        tahap === "uji_coba"
          ? "Uji coba: tidak ada baris yang ditulis ke tabel tujuan."
          : "Migrasi sungguhan.",
    },
  );

  if (galatJalan || !jalan) {
    return gagal(galatJalan?.message ?? "Gagal memulai migrasi.", "validasi");
  }

  // Urutannya bukan hiasan: akun menunjuk orang, laporan menunjuk
  // keduanya, dan seluruh data operasional menunjuk orang. Yang
  // dijalankan lebih dulu adalah pengumpulan orang yang menunggu —
  // supaya yang tidak tertaut sudah terdaftar sebelum barisnya ditemui.
  const langkah: { label: string; jalankan: () => Promise<HasilTerap> }[] = [
    { label: "Orang menunggu", jalankan: () => kumpulkanOrangPending(tahap) },
    { label: "Anggota tim", jalankan: () => terapkanUsersList(tahap) },
    { label: "Akun affiliator", jalankan: () => terapkanAkun(tahap) },
    { label: "Laporan harian", jalankan: () => terapkanLaporan(tahap) },
    // Rekap GMV mengisi sasaran yang tidak punya laporan dan menyamakan
    // angka yang sudah ada; jadi dijalankan sesudah laporannya.
    {
      label: "GMV harian unit",
      jalankan: () => terapkanRekapGmv(tahap, "gmv:daily"),
    },
    {
      label: "GMV affiliator harian",
      jalankan: () => terapkanRekapGmv(tahap, "affiliate-gmv:daily"),
    },
    { label: "Kehadiran", jalankan: () => terapkanKehadiran(tahap) },
    { label: "Pengajuan izin", jalankan: () => terapkanIzin(tahap) },
    { label: "Tugas & QC", jalankan: () => terapkanTugas(tahap) },
    { label: "Todo", jalankan: () => terapkanTodo(tahap) },
    { label: "Arus kas", jalankan: () => terapkanKas(tahap) },
    { label: "Pengumuman", jalankan: () => terapkanPengumuman(tahap) },
    { label: "Kalender", jalankan: () => terapkanAgenda(tahap) },
    { label: "Masalah", jalankan: () => terapkanMasalah(tahap) },
    { label: "Masukan", jalankan: () => terapkanMasukan(tahap) },
    { label: "Sampel", jalankan: () => terapkanSampel(tahap) },
    { label: "Portal belajar", jalankan: () => terapkanLms(tahap) },
    {
      label: "Pengaturan absensi",
      jalankan: () => terapkanPengaturanAbsensi(tahap),
    },
    // Tidak menulis apa pun; hanya menuliskan keputusannya ke catatan.
    { label: "Kunci tak dipetakan", jalankan: catatKunciTakDipetakan },
  ];

  const hasil: HasilTerap[] = [];
  for (const l of langkah) {
    try {
      hasil.push(await l.jalankan());
    } catch (e) {
      // Satu kelompok yang gagal tidak boleh menghentikan sisanya:
      // migrasi yang berhenti di tengah meninggalkan keadaan setengah
      // jadi yang lebih sulit dijelaskan daripada kegagalan penuh.
      hasil.push({
        kelompok: l.label,
        diperiksa: 0,
        ditulis: 0,
        tertahan: 0,
        catatan: [
          {
            idLama: "-",
            pesan: e instanceof Error ? e.message : "Kegagalan tak terduga.",
          },
        ],
      });
    }
  }

  // Hasil tiap kelompok disimpan sebagai angka, bukan disimpulkan dari
  // catatan: yang berhasil tidak dicatat per entri, jadi jumlahnya tidak
  // bisa dihitung dari sana.
  const { error: galatRingkas } = await sb.from("migrasi_ringkas").insert(
    hasil.map((h) => ({
      jalan_id: jalan.id,
      kelompok: h.kelompok,
      diperiksa: h.diperiksa,
      ditulis: h.ditulis,
      tertahan: h.tertahan,
    })),
  );
  if (galatRingkas) {
    return gagal(`Gagal mencatat ringkasan migrasi: ${galatRingkas.message}`);
  }

  // Tiap catatan yang tidak jadi ditulis disimpan beserta alasannya:
  // migrasi yang berhenti di entri ke-3.000 tanpa penjelasan jauh lebih
  // mahal daripada yang melaporkan semuanya.
  const catatan = hasil.flatMap((h) =>
    h.catatan.slice(0, 500).map((c) => ({
      jalan_id: jalan.id,
      entitas: h.kelompok,
      kunci_lama: c.idLama,
      id_baru: null,
      status: "dilewati" as const,
      pesan: c.pesan.slice(0, 500),
    })),
  );

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
  revalidatePath("/migrasi/pemetaan");
  revalidatePath("/migrasi/verifikasi");

  const ditulis = hasil.reduce((a, h) => a + h.ditulis, 0);
  const tertahan = hasil.reduce((a, h) => a + h.tertahan, 0);
  const diperiksa = hasil.reduce((a, h) => a + h.diperiksa, 0);

  return sukses(
    { jalanId: jalan.id, berhasil: ditulis, gagal: tertahan },
    tahap === "uji_coba"
      ? `Uji coba selesai: ${diperiksa} catatan diperiksa, ${tertahan} tertahan. Tidak ada yang ditulis.`
      : `Migrasi selesai: ${ditulis} baris ditulis, ${tertahan} tertahan. Aman diulang — catatan yang sudah pindah tidak dibuat dua kali.`,
  );
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

// ---------------------------------------------------------------------
// Unggah ekspor K-Space lama
// ---------------------------------------------------------------------

/**
 * Menerima berkas ekspor K-Space lama dan mengisi `kv_store_lama`.
 *
 * Sebelum ini satu-satunya jalan mengisi tabel itu adalah menempel SQL
 * langsung ke basis data — pekerjaan yang tidak masuk akal diminta dari
 * orang yang justru berhak melakukannya, dan yang membuat migrasi
 * sungguhan tidak pernah punya jalan masuk sama sekali.
 *
 * Kata sandi dibuang di sini, sebelum satu baris pun dikirim
 * (`buangKredensial`). Basis data menolaknya juga (0152); yang di sini
 * supaya berkas yang wajar tetap bisa diunggah tanpa disunting manual,
 * yang di sana supaya tidak ada jalan lain yang melewatkannya.
 */
export async function unggahEksporV1(
  data: FormData,
): Promise<Hasil<RingkasUnggah>> {
  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehMigrasi(pengguna)) {
    return gagal(
      "Hanya CEO atau Manager yang boleh mengunggah ekspor sistem lama.",
      "izin",
    );
  }
  if (modeData() === "demo") return BALASAN_DEMO;

  const berkas = data.get("berkas");
  if (!(berkas instanceof File)) {
    return gagal("Tidak ada berkas yang terkirim.", "validasi");
  }

  // Aturannya sama persis dengan yang dipakai browser; yang mengikat
  // adalah yang di sini.
  const tolakan = tolakBerkas({ nama: berkas.name, ukuran: berkas.size });
  if (tolakan) return gagal(tolakan, "validasi");

  let mentah: unknown;
  try {
    mentah = JSON.parse(await berkas.text());
  } catch {
    return gagal(
      "Berkasnya bukan JSON yang utuh. Pastikan yang diunggah berkas ekspor, bukan potongannya.",
      "validasi",
    );
  }

  const dibaca = bacaEksporV1(mentah);
  if (!dibaca.ok) return gagal(dibaca.sebab, "validasi");

  const disimpan = dibaca.isi.filter((i) => i.disimpan);
  const sb = await klienServer();

  const { data: unggahan, error: galatUnggahan } = await sb
    .from("kv_unggahan")
    .insert({
      berkas: berkas.name,
      meta: dibaca.meta?.mentah ?? {},
      jumlah_kunci: disimpan.length,
      jumlah_entri: disimpan.reduce((a, i) => a + i.jumlah, 0),
      oleh: pengguna.id,
    })
    .select("id")
    .single();

  if (galatUnggahan || !unggahan) {
    return galatUnggahan?.code === "42501"
      ? gagal("Kamu tidak berhak mengunggah ekspor sistem lama.", "izin")
      : gagal(
          `Gagal mencatat unggahan: ${galatUnggahan?.message ?? "tidak diketahui"}`,
        );
  }

  // Ditulis satu kunci per permintaan: satu kunci saja — `daily-reports:all`
  // misalnya — bisa berisi belasan megabita, dan menumpuknya jadi satu
  // permintaan hanya membuat kegagalannya tidak bisa ditelusuri ke kunci
  // mana pun.
  const masuk: string[] = [];
  for (const isi of disimpan) {
    const { error } = await sb.from("kv_store_lama").upsert(
      {
        key: isi.kunci,
        value: isi.nilai,
        unggahan_id: unggahan.id,
      },
      { onConflict: "key" },
    );

    if (!error) {
      masuk.push(isi.kunci);
      continue;
    }

    // Penjagaan terakhir di basis data (0152). Kalau sampai di sini,
    // ejaan medan kata sandinya belum dikenali `buangKredensial`.
    const sebab = /kata sandi/i.test(error.message)
      ? `Kunci ${isi.kunci} masih memuat medan kata sandi yang belum dikenali. Laporkan kuncinya supaya daftarnya ditambah — jangan disunting manual.`
      : `Gagal menyimpan kunci ${isi.kunci}: ${error.message}`;

    // Yang sudah telanjur masuk disebut apa adanya. Unggahan yang
    // berhenti di tengah meninggalkan tabel setengah terisi, dan orang
    // yang tidak tahu bagian mana akan mengulang seluruhnya atau — lebih
    // buruk — mengira semuanya gagal lalu memetakan yang setengah itu.
    const sudah =
      masuk.length > 0
        ? ` ${masuk.length} kunci sebelumnya sudah tersimpan (${masuk.join(", ")}); mengunggah ulang berkas yang sama aman dan akan menimpanya.`
        : " Belum ada satu kunci pun yang tersimpan.";

    if (masuk.length === 0) {
      // Tidak ada gunanya menyimpan catatan unggahan yang tidak membawa
      // sebaris pun data.
      await sb.from("kv_unggahan").delete().eq("id", unggahan.id);
    } else {
      await sb
        .from("kv_unggahan")
        .update({
          jumlah_kunci: masuk.length,
          jumlah_entri: disimpan
            .filter((i) => masuk.includes(i.kunci))
            .reduce((a, i) => a + i.jumlah, 0),
        })
        .eq("id", unggahan.id);
    }

    return gagal(`${sebab}${sudah}`, "validasi");
  }

  revalidatePath("/migrasi");
  revalidatePath("/migrasi/pemetaan");
  revalidatePath("/migrasi/verifikasi");

  const dilewati = dibaca.isi.length - disimpan.length;

  // Kunci dari unggahan sebelumnya yang tidak ada di berkas ini tetap
  // tinggal — sengaja, karena bisa jadi ia datang dari ekspor lain yang
  // masih dibutuhkan. Tetapi ia harus disebut: kunci lama yang diam-diam
  // ikut terbaca sebagai bagian dari ekspor baru adalah campuran dua
  // ekspor yang tidak pernah diminta siapa pun.
  const { data: semua } = await sb
    .from("kv_store_lama")
    .select("key")
    .neq("unggahan_id", unggahan.id);
  const tertinggal = (semua ?? []).map((b) => b.key);

  return sukses(
    {
      berkas: berkas.name,
      meta: dibaca.meta,
      baris: dibaca.isi.map(({ kunci, golongan, jumlah, disimpan }) => ({
        kunci,
        golongan,
        jumlah,
        disimpan,
      })),
    },
    `${disimpan.length} kunci tersimpan${dilewati > 0 ? `, ${dilewati} dilewatkan` : ""}.${
      tertinggal.length > 0
        ? ` ${tertinggal.length} kunci dari unggahan sebelumnya masih tersimpan dan ikut dipetakan (${tertinggal.slice(0, 5).join(", ")}${tertinggal.length > 5 ? ", …" : ""}).`
        : ""
    } Data lama siap dipetakan.`,
  );
}

// ---------------------------------------------------------------------
// Menautkan orang V1 ke orang V2
// ---------------------------------------------------------------------

/**
 * Menautkan seorang V1 ke profil V2, atau mencabut tautannya.
 *
 * Penautan menentukan siapa pemilik laporan, tugas, dan kehadiran yang
 * ikut pindah. Salah tautan tidak menimbulkan galat apa pun — datanya
 * tetap masuk, hanya menempel pada orang yang keliru — jadi setiap
 * keputusan mencatat siapa yang mengambilnya (0154).
 */
export async function tautkanOrang(
  idLama: string,
  userId: string | null,
): Promise<Hasil> {
  if (!idLama.trim()) return gagal("Orang lama tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehMigrasi(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh menautkan orang.", "izin");
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("migrasi_orang_pending")
    .update({
      user_id: userId,
      diabaikan: false,
      diputuskan_oleh: userId ? pengguna.id : null,
    })
    .eq("id_lama", idLama)
    .select("id_lama");

  if (error) {
    if (error.code === "42501") {
      return gagal("Kamu tidak berhak menautkan orang.", "izin");
    }
    // Satu orang V2 hanya boleh menjadi padanan satu orang V1 (0160):
    // dua yang menunjuk orang yang sama akan menyatukan riwayat kerja
    // dua orang, dan itu tidak bisa dipisahkan lagi sesudahnya.
    if (error.code === "23505") {
      return gagal(
        "Orang V2 itu sudah menjadi padanan orang lama yang lain. Cabut tautan yang itu dulu kalau yang ini yang benar.",
        "validasi",
      );
    }
    return gagal(`Gagal menyimpan: ${error.message}`);
  }
  if ((data ?? []).length === 0) {
    return gagal(
      "Orang itu tidak ada di daftar yang menunggu keputusan.",
      "validasi",
    );
  }

  revalidatePath("/migrasi/orang");
  revalidatePath("/migrasi/pemetaan");
  return sukses(
    undefined,
    userId ? "Tautan disimpan." : "Tautan dicabut; orangnya kembali menunggu.",
  );
}

/**
 * Menandai seorang V1 sengaja tidak ditautkan.
 *
 * Bukan hal yang sama dengan membiarkannya menunggu: data yang
 * menunjuknya tetap masuk tanpa penunjuk orang, dan itu keputusan yang
 * harus ada pemiliknya.
 */
export async function abaikanOrang(idLama: string): Promise<Hasil> {
  if (!idLama.trim()) return gagal("Orang lama tidak dikenali.", "validasi");
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehMigrasi(pengguna)) {
    return gagal("Hanya CEO atau Manager yang boleh memutuskan ini.", "izin");
  }

  const sb = await klienServer();
  const { data, error } = await sb
    .from("migrasi_orang_pending")
    .update({ user_id: null, diabaikan: true, diputuskan_oleh: pengguna.id })
    .eq("id_lama", idLama)
    .select("id_lama");

  if (error) {
    return error.code === "42501"
      ? gagal("Kamu tidak berhak memutuskan ini.", "izin")
      : gagal(`Gagal menyimpan: ${error.message}`);
  }
  if ((data ?? []).length === 0) {
    return gagal(
      "Orang itu tidak ada di daftar yang menunggu keputusan.",
      "validasi",
    );
  }

  revalidatePath("/migrasi/orang");
  revalidatePath("/migrasi/pemetaan");
  return sukses(
    undefined,
    "Ditandai sengaja tidak ditautkan. Data yang menunjuknya masuk tanpa penunjuk orang.",
  );
}

/**
 * Menyegarkan daftar orang yang menunggu keputusan.
 *
 * Daftar ini biasanya terisi saat migrasi dijalankan, tetapi orang perlu
 * bisa melihatnya lebih dulu — sebelum menjalankan apa pun — untuk tahu
 * berapa banyak yang harus diputuskan. Menjalankan uji coba penuh hanya
 * untuk itu terlalu mahal, dan orang yang enggan menjalankannya akan
 * mengerjakan penautannya belakangan, saat sudah terburu-buru.
 */
export async function segarkanOrangPending(): Promise<
  Hasil<{ ditulis: number; menunggu: number }>
> {
  if (modeData() === "demo") return BALASAN_DEMO;

  const pengguna = await sesiSaatIni();
  if (!pengguna) return gagal("Sesi berakhir, silakan masuk lagi.", "izin");
  if (!bolehMigrasi(pengguna)) {
    return gagal(
      "Hanya CEO atau Manager yang boleh memeriksa daftar ini.",
      "izin",
    );
  }

  const hasil = await kumpulkanOrangPending("sungguhan");
  if (hasil.ditulis === 0 && hasil.diperiksa > 0) {
    return gagal(
      `Gagal menyimpan daftar: ${hasil.catatan[0]?.pesan ?? "sebab tidak diketahui"}`,
    );
  }

  revalidatePath("/migrasi/orang");
  revalidatePath("/migrasi/pemetaan");

  return sukses(
    { ditulis: hasil.ditulis, menunggu: hasil.diperiksa },
    hasil.diperiksa === 0
      ? "Tidak ada orang yang menunggu keputusan — seluruh rujukan di data lama sudah punya padanan."
      : `${hasil.diperiksa} orang menunggu keputusan; daftarnya diperbarui.`,
  );
}
