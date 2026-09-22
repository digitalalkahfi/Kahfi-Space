// Modul khusus server.
import "server-only";

import { dataContoh } from "@/lib/data/contoh";
import { modeData } from "@/lib/supabase/config";
import { klienServer } from "@/lib/supabase/server";
import { ringkasKeuangan } from "@/lib/keuangan";
import type {
  KeputusanTransaksi,
  RingkasKeuangan,
  Transaksi,
} from "@/lib/keuangan";
import type { JenisKeluar, StatusTransaksi } from "@/lib/keuangan";
import type { KodeUnit, Pengguna } from "@/lib/types";

function satu<T>(nilai: T | T[] | null | undefined): T | null {
  if (!nilai) return null;
  return Array.isArray(nilai) ? (nilai[0] ?? null) : nilai;
}

/**
 * Transaksi keuangan.
 *
 * Penyaringannya dikerjakan RLS — hanya Finance, Manager, dan CEO yang
 * melihat satu baris pun (migrasi 0097). Mode demo menirukan cakupan
 * yang sama lewat `bolehLihatKeuangan` di halamannya.
 */
export async function daftarTransaksi(
  pengguna: Pengguna,
): Promise<Transaksi[]> {
  if (modeData() === "demo") return transaksiDemo();

  void pengguna;
  const sb = await klienServer();
  const { data, error } = await sb
    .from("transactions")
    .select(
      `id, tanggal, arah, jenis, keterangan, jumlah, status,
       diajukan_id,
       unit:units (kode, nama),
       akun:accounts (username),
       pengaju:users!transactions_diajukan_id_fkey (nama),
       pemutus:users!transactions_disetujui_id_fkey (nama)`,
    )
    .order("tanggal", { ascending: false });

  if (error) throw new Error(`Gagal memuat transaksi: ${error.message}`);

  return (data ?? []).map((t) => {
    const unit = satu(t.unit);
    return {
      id: t.id,
      tanggal: t.tanggal,
      arah: t.arah as Transaksi["arah"],
      jenis: (t.jenis as JenisKeluar | null) ?? null,
      unitKode: (unit?.kode as KodeUnit) ?? null,
      unitNama: unit?.nama ? unit.nama.split(" (")[0] : "Perusahaan",
      akunUsername: satu(t.akun)?.username ?? null,
      keterangan: t.keterangan,
      jumlah: Number(t.jumlah),
      status: t.status as StatusTransaksi,
      diajukanId: t.diajukan_id,
      diajukanNama: satu(t.pengaju)?.nama ?? null,
      disetujuiNama: satu(t.pemutus)?.nama ?? null,
    } satisfies Transaksi;
  });
}

function transaksiDemo(): Transaksi[] {
  const { units, users } = dataContoh;

  return (dataContoh.transaksi ?? [])
    .map((t) => {
      const unit = t.unit ? units.find((u) => u.kode === t.unit) : null;
      return {
        // Id yang sama dengan seed.sql: mode demo dan Supabase menyebut
        // transaksi yang sama dengan nama yang sama.
        id: t.id,
        tanggal: t.tanggal,
        arah: t.arah as Transaksi["arah"],
        jenis: (t.jenis as JenisKeluar | null) ?? null,
        unitKode: (t.unit as KodeUnit) ?? null,
        unitNama: unit?.nama ? unit.nama.split(" (")[0] : "Perusahaan",
        akunUsername: t.akun ?? null,
        keterangan: t.keterangan,
        jumlah: t.jumlah,
        status: t.status as StatusTransaksi,
        diajukanId: users.find((u) => u.nama === t.diajukan)?.id ?? null,
        diajukanNama: t.diajukan ?? null,
        disetujuiNama: t.disetujui ?? null,
      } satisfies Transaksi;
    })
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}

/**
 * Ringkasan keuangan satu periode.
 *
 * Di mode Supabase dihitung basis data (migrasi 0099) — halaman yang
 * hanya butuh angkanya tidak perlu menarik seluruh transaksi lebih dulu.
 * Mode demo memakai fungsi murni yang sama dengan yang dipakai layar,
 * dan test skema menjaga keduanya menghasilkan angka yang sama.
 */
export async function ringkasPeriode(
  dari?: string,
  sampai?: string,
): Promise<RingkasKeuangan> {
  if (modeData() === "demo") {
    const semua = transaksiDemo();
    const dalamPeriode = semua.filter(
      (t) => (!dari || t.tanggal >= dari) && (!sampai || t.tanggal <= sampai),
    );
    const sebelumnya = dari ? semua.filter((t) => t.tanggal < dari) : [];
    const awal = ringkasKeuangan(sebelumnya, dataContoh.kas_awal ?? 0).saldoKas;
    return ringkasKeuangan(
      dalamPeriode,
      dari ? awal : (dataContoh.kas_awal ?? 0),
    );
  }

  const sb = await klienServer();
  const { data, error } = await sb.rpc("ringkas_keuangan", {
    p_dari: dari ?? null,
    p_sampai: sampai ?? null,
  });

  if (error)
    throw new Error(`Gagal memuat ringkasan keuangan: ${error.message}`);

  const r = data?.[0];
  return {
    pendapatan: Number(r?.pendapatan ?? 0),
    directCost: Number(r?.direct_cost ?? 0),
    creatorShare: Number(r?.creator_share ?? 0),
    netRevenue: Number(r?.net_revenue ?? 0),
    beban: Number(r?.beban ?? 0),
    aset: Number(r?.aset ?? 0),
    dividen: Number(r?.dividen ?? 0),
    labaBersih: Number(r?.laba_bersih ?? 0),
    npm: Number(r?.npm ?? 0),
    saldoKas: Number(r?.saldo_kas ?? 0),
    menungguPersetujuan: Number(r?.menunggu_persetujuan ?? 0),
  };
}

/**
 * Jejak keputusan atas satu transaksi, terbaru dulu.
 *
 * Di mode Supabase jejaknya nyata: satu baris per keputusan, lengkap
 * dengan posisi kas saat itu (migrasi 0098). Mode demo tidak punya tabel
 * itu, jadi jejaknya disusun ulang dari transaksinya sendiri — cukup
 * untuk menunjukkan bentuk alurnya, tetapi tanpa waktu dan kas yang
 * sebenarnya.
 */
export async function jejakKeputusan(
  transaksiId: string,
): Promise<KeputusanTransaksi[]> {
  if (modeData() === "demo") return jejakDemo(transaksiId);

  const sb = await klienServer();
  const { data, error } = await sb
    .from("transaction_approvals")
    .select(
      `id, dari, ke, catatan, saldo_kas, penyetuju_wajib, pada,
       oleh:users (nama)`,
    )
    .eq("transaction_id", transaksiId)
    .order("pada", { ascending: false });

  if (error) throw new Error(`Gagal memuat jejak keputusan: ${error.message}`);

  return (data ?? []).map((k) => ({
    id: k.id,
    dari: (k.dari as StatusTransaksi | null) ?? null,
    ke: k.ke as StatusTransaksi,
    olehNama: satu(k.oleh)?.nama ?? null,
    catatan: k.catatan,
    saldoKas: Number(k.saldo_kas),
    penyetujuWajib: k.penyetuju_wajib,
    pada: k.pada,
  }));
}

function jejakDemo(transaksiId: string): KeputusanTransaksi[] {
  const t = (dataContoh.transaksi ?? []).find((x) => x.id === transaksiId);
  if (!t || t.status === "diajukan" || !t.disetujui) return [];

  const langkah: StatusTransaksi[] =
    t.status === "dibayar" && t.arah === "keluar"
      ? ["disetujui", "dibayar"]
      : [t.status as StatusTransaksi];

  return langkah
    .map((ke, i) => ({
      id: `${transaksiId}-keputusan-${i + 1}`,
      dari: (i === 0 ? "diajukan" : langkah[i - 1]) as StatusTransaksi,
      ke,
      olehNama: t.disetujui ?? null,
      catatan: i === 0 ? ((t as { catatan?: string }).catatan ?? "") : "",
      saldoKas: 0,
      penyetujuWajib: null,
      pada: `${t.tanggal}T09:00:00+07:00`,
    }))
    .reverse();
}

/**
 * Saldo kas pembuka.
 *
 * Disimpan terpisah dari transaksinya karena ia bukan mutasi: ia titik
 * berangkat. Tanpa angka ini setiap laporan kas mulai dari nol dan
 * langsung salah.
 */
export async function kasAwal(): Promise<number> {
  if (modeData() === "demo") return dataContoh.kas_awal ?? 0;

  const sb = await klienServer();
  const { data, error } = await sb
    .from("keuangan_pengaturan")
    .select("kas_awal")
    .maybeSingle();

  // Pengguna tanpa hak baca angka perusahaan tidak melihat barisnya
  // sama sekali; nol lebih jujur daripada melempar galat di halaman
  // yang memang tidak menampilkan angka itu.
  if (error) throw new Error(`Gagal memuat kas awal: ${error.message}`);
  return Number(data?.kas_awal ?? 0);
}
