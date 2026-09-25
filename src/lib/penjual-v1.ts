/**
 * Daftar seller ekspor V1 → `sellers` V2 — modul murni.
 *
 * Sistem lama menyimpan komisi sebagai teks bebas ("17", "10%"), telepon
 * dalam beragam bentuk (kadang nama aplikasi pesan), dan toko yang sama
 * bisa tercatat dua kali. Di sini semuanya dibakukan: komisi jadi persen,
 * telepon yang bukan nomor dipindah ke catatan, dan entri yang tokonya
 * sama digabung — yang terakhir dicatat menjadi acuannya.
 */
import {
  bakukanTelepon,
  komisiDariTeks,
  type StatusPenjual,
} from "@/lib/penjual";
import { gabungBaris, potong, teksBersih } from "@/lib/teks-v1";

export type PenjualV1 = {
  idLama: string;
  namaToko: string;
  namaKontak: string;
  telepon: string;
  kategori: string;
  status: StatusPenjual;
  komisiPersen: number | null;
  catatan: string;
  /** Id orang lama yang mengelola (manager) — menjadi PIC dan penentu unit. */
  pengelolaLama: string | null;
  dibuatPada: string | null;
  /** Id lama entri lain yang digabung ke sini. */
  digabung: string[];
};

export function statusPenjualV1(nilai: unknown): StatusPenjual {
  const t = teksBersih(nilai).toLowerCase();
  if (["aktif", "active"].includes(t)) return "aktif";
  if (["nonaktif", "inactive", "berhenti", "stop"].includes(t))
    return "nonaktif";
  return "prospek";
}

/** Kunci penyamaan toko: huruf kecil, hanya huruf dan angka. */
export function kunciToko(nama: string): string {
  return nama.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function bacaPenjual(daftar: unknown[]): {
  siap: PenjualV1[];
  tertahan: { idLama: string; pesan: string }[];
} {
  const tertahan: { idLama: string; pesan: string }[] = [];
  const mentah: PenjualV1[] = [];

  for (const s of daftar) {
    if (s === null || typeof s !== "object") continue;
    const b = s as Record<string, unknown>;
    const idLama = typeof b.id === "string" ? b.id : "";
    if (idLama === "") continue;
    const namaToko = teksBersih(b.shopName ?? b.namaToko ?? b.toko);
    if (namaToko.length < 2) {
      tertahan.push({ idLama, pesan: "Seller tanpa nama toko." });
      continue;
    }
    const kontak = teksBersih(b.name ?? b.contact);
    const teleponMentah = teksBersih(b.phone);
    const teleponSah =
      teleponMentah !== "" && bakukanTelepon(teleponMentah) !== null;

    mentah.push({
      idLama,
      namaToko: potong(namaToko, 120),
      namaKontak: kontak === "-" ? "" : potong(kontak, 80),
      telepon: teleponSah ? potong(teleponMentah, 40) : "",
      kategori: potong(teksBersih(b.category), 60),
      status: statusPenjualV1(b.status),
      komisiPersen: komisiDariTeks(teksBersih(b.commission)),
      catatan: potong(
        gabungBaris(
          teksBersih(b.note),
          teleponMentah !== "" && !teleponSah
            ? `Kontak lewat: ${teleponMentah}`
            : null,
        ),
        1000,
      ),
      pengelolaLama:
        typeof b.managerId === "string" && b.managerId !== ""
          ? b.managerId
          : null,
      dibuatPada: typeof b.createdAt === "string" ? b.createdAt : null,
      digabung: [],
    });
  }

  // Toko yang sama digabung: yang terakhir dicatat jadi acuan, data yang
  // kosong padanya diisi dari entri lama, catatannya disatukan.
  const perToko = new Map<string, PenjualV1>();
  for (const p of [...mentah].sort((a, b) =>
    (a.dibuatPada ?? "").localeCompare(b.dibuatPada ?? ""),
  )) {
    const kunci = kunciToko(p.namaToko);
    const sudah = perToko.get(kunci);
    if (!sudah) {
      perToko.set(kunci, p);
      continue;
    }
    perToko.set(kunci, {
      ...p,
      namaKontak: p.namaKontak || sudah.namaKontak,
      telepon: p.telepon || sudah.telepon,
      kategori: p.kategori || sudah.kategori,
      komisiPersen: p.komisiPersen ?? sudah.komisiPersen,
      catatan: potong(gabungBaris(p.catatan, sudah.catatan), 1000),
      pengelolaLama: p.pengelolaLama ?? sudah.pengelolaLama,
      dibuatPada: sudah.dibuatPada ?? p.dibuatPada,
      digabung: [...sudah.digabung, sudah.idLama],
    });
  }

  return { siap: [...perToko.values()], tertahan };
}
