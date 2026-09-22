import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  MEDAN_TERKUNCI,
  bolehUbahSendiri,
  formatKontak,
  inisialNama,
  kelengkapanProfil,
  kesiapanWhatsapp,
  kontakSah,
  medanTerkunci,
  nilaiMedan,
  normalkanKontak,
  periksaBerkasAvatar,
  PESAN_KESIAPAN,
  periksaNama,
  rapikanNama,
  type ProfilDiri,
} from "@/lib/profil";

function profil(ubah: Partial<ProfilDiri> = {}): ProfilDiri {
  return {
    id: "u1",
    nama: "Farhan Pratama",
    email: "farhan@alkahfi.co.id",
    role: "Manager",
    jabatan: "Manager Operasional",
    unitKode: null,
    unitNama: "Manajemen",
    departemenId: null,
    departemen: null,
    programId: null,
    program: null,
    atasanId: null,
    atasanNama: "Hafidz Alkahfi",
    inisial: "FP",
    status: "aktif",
    akunDipegang: 0,
    kontak: "+628123456789",
    kontakTerverifikasiPada: null,
    whatsappOptin: false,
    fotoUrl: null,
    ...ubah,
  };
}

test("nomor yang sama ditulis berbeda-beda tetap jadi satu bentuk", () => {
  const baku = "+62812345678";
  for (const mentah of [
    "0812345678",
    "0812-345-678",
    "0812 345 678",
    "+62812345678",
    "62812345678",
    "812345678",
    "(0812) 345-678",
  ]) {
    assert.equal(normalkanKontak(mentah), baku, `gagal untuk: ${mentah}`);
  }
});

test("yang bukan nomor seluler Indonesia ditolak, bukan dibetulkan diam-diam", () => {
  for (const mentah of [
    "", // kosong
    "abcd", // bukan angka
    "021555123", // nomor rumah, bukan seluler
    "0812345", // terlalu pendek
    "0812345678901234", // terlalu panjang
    "+1 415 555 0100", // bukan Indonesia
    "08a12345678", // huruf menyelip
  ]) {
    assert.equal(normalkanKontak(mentah), null, `harusnya ditolak: ${mentah}`);
  }
});

test("kontakSah sejalan dengan normalkanKontak", () => {
  assert.equal(kontakSah("0812-3456-7890"), true);
  assert.equal(kontakSah("021555123"), false);
});

test("nomor ditampilkan berkelompok supaya bisa dibaca ulang", () => {
  assert.equal(formatKontak("081234567890"), "+62 812-3456-7890");
  assert.equal(formatKontak("+62 811 2233 4455"), "+62 811-2233-4455");
});

test("nomor yang tidak sah tidak dipaksakan tampil", () => {
  assert.equal(formatKontak(null), null);
  assert.equal(formatKontak("021555123"), null);
});

test("hanya nama, foto, dan kontak yang boleh diubah sendiri", () => {
  for (const medan of ["nama", "fotoUrl", "kontak"]) {
    assert.equal(bolehUbahSendiri(medan), true, medan);
  }
  // Sejalan trigger jaga_ubah_diri (migrasi 0041).
  for (const medan of [
    "role",
    "unitKode",
    "jabatan",
    "email",
    "atasanId",
    "status",
  ]) {
    assert.equal(bolehUbahSendiri(medan), false, medan);
  }
});

test("setiap medan terkunci menyebutkan alasannya", () => {
  assert.ok(MEDAN_TERKUNCI.length > 0);
  for (const m of MEDAN_TERKUNCI) {
    assert.ok(m.label.length > 0, "label kosong");
    assert.ok(m.alasan.length > 0, `alasan kosong untuk ${m.label}`);
  }
});

test("empat medan yang disebut PRD ada di golongan wewenang", () => {
  const label = medanTerkunci("wewenang").map((m) => m.label);
  assert.deepEqual(label, ["Peran", "Unit", "Program", "Atasan"]);
});

test("tidak ada medan terkunci yang juga boleh diubah sendiri", () => {
  for (const m of MEDAN_TERKUNCI) {
    assert.equal(
      bolehUbahSendiri(m.kunci),
      false,
      `${m.label} terkunci tapi ikut daftar yang boleh diubah sendiri`,
    );
  }
});

test("semua medan terkunci benar-benar dijaga basis data", () => {
  // Sejalan trigger jaga_ubah_diri: 0041 untuk peran/unit/status/atasan/
  // jabatan/email, 0108 untuk program dan departemen.
  for (const m of MEDAN_TERKUNCI) {
    assert.equal(
      m.dijagaDb,
      true,
      `${m.label} terkunci di layar tapi tidak di basis data`,
    );
  }
});

test("medan yang kosong ditulis 'Belum ditetapkan', bukan tanda hubung", () => {
  const tanpaAtasan = profil({ atasanNama: null, program: null });
  const atasan = MEDAN_TERKUNCI.find((m) => m.kunci === "atasanNama")!;
  const program = MEDAN_TERKUNCI.find((m) => m.kunci === "program")!;
  assert.equal(nilaiMedan(tanpaAtasan, atasan), "Belum ditetapkan");
  assert.equal(nilaiMedan(tanpaAtasan, program), "Belum ditetapkan");
  assert.equal(
    nilaiMedan(profil({ atasanNama: "Hafidz Alkahfi" }), atasan),
    "Hafidz Alkahfi",
  );
});

test("kelengkapan menyebut apa yang kurang, bukan sekadar 'belum lengkap'", () => {
  assert.deepEqual(kelengkapanProfil(profil({ fotoUrl: "foto.png" })), {
    lengkap: true,
    kurang: [],
  });
  assert.deepEqual(kelengkapanProfil(profil({ kontak: null })), {
    lengkap: false,
    kurang: ["nomor kontak", "foto"],
  });
});

test("nama dirapikan, bukan ditolak, saat cuma kelebihan spasi", () => {
  assert.equal(rapikanNama("  Farhan   Pratama  "), "Farhan Pratama");
  assert.equal(rapikanNama("Siti\tNurhaliza"), "Siti Nurhaliza");
});

test("nama yang layak diterima, termasuk yang memakai tanda hubung dan apostrof", () => {
  for (const nama of [
    "Farhan Pratama",
    "Siti Nurhaliza",
    "Abdul Mu'ti",
    "Anne-Marie Suryadi",
    "R.A. Kartini",
    "Ayu", // pendek tapi wajar
  ]) {
    assert.equal(periksaNama(nama).ok, true, nama);
  }
});

test("nama yang tidak layak ditolak dengan alasan yang bisa dibaca", () => {
  for (const nama of [
    "",
    "   ",
    "A",
    "Farhan 123",
    "Budi <script>",
    "x".repeat(81),
  ]) {
    const hasil = periksaNama(nama);
    assert.equal(hasil.ok, false, `harusnya ditolak: ${JSON.stringify(nama)}`);
    assert.ok(hasil.pesan && hasil.pesan.length > 0, "alasan kosong");
  }
});

test("foto di luar format atau ukuran ditolak sebelum diunggah", () => {
  assert.equal(
    periksaBerkasAvatar({ type: "image/png", size: 500_000 }).ok,
    true,
  );
  assert.equal(
    periksaBerkasAvatar({ type: "image/jpeg", size: 2 * 1024 * 1024 }).ok,
    true,
  );
  assert.equal(
    periksaBerkasAvatar({ type: "image/gif", size: 1000 }).ok,
    false,
  );
  assert.equal(
    periksaBerkasAvatar({ type: "application/pdf", size: 1000 }).ok,
    false,
  );
  assert.equal(
    periksaBerkasAvatar({ type: "image/png", size: 3 * 1024 * 1024 }).ok,
    false,
  );
  assert.equal(periksaBerkasAvatar({ type: "image/png", size: 0 }).ok, false);
});

test("pesan foto terlalu besar menyebut ukurannya, supaya orang tahu seberapa jauh", () => {
  const hasil = periksaBerkasAvatar({
    type: "image/png",
    size: 3.5 * 1024 * 1024,
  });
  assert.equal(hasil.ok, false);
  assert.match(hasil.pesan ?? "", /3\.5 MB/);
});

test("inisial diambil dari kata pertama dan terakhir", () => {
  assert.equal(inisialNama("Farhan Pratama"), "FP");
  assert.equal(inisialNama("Laras Ayu Ningtyas"), "LN");
  assert.equal(inisialNama("Ayu"), "AY");
  assert.equal(inisialNama("   "), "?");
});

test("kelengkapan menganggap foto ada saat fotoUrl terisi", () => {
  const dengan = profil({
    fotoUrl: "https://x/storage/v1/object/public/foto-profil/u1/profil.png",
  });
  assert.equal(kelengkapanProfil(dengan).lengkap, true);
});

test("kesiapan WhatsApp melaporkan satu kekurangan pada satu waktu", () => {
  // Yang belum punya nomor tidak perlu tahu soal opt-in.
  assert.equal(
    kesiapanWhatsapp({
      kontak: null,
      kontakTerverifikasiPada: null,
      whatsappOptin: false,
    }),
    "belum-ada-nomor",
  );
  assert.equal(
    kesiapanWhatsapp({
      kontak: "+628123456789",
      kontakTerverifikasiPada: null,
      whatsappOptin: false,
    }),
    "belum-diverifikasi",
  );
  assert.equal(
    kesiapanWhatsapp({
      kontak: "+628123456789",
      kontakTerverifikasiPada: "2024-10-20T00:00:00Z",
      whatsappOptin: false,
    }),
    "belum-setuju",
  );
  assert.equal(
    kesiapanWhatsapp({
      kontak: "+628123456789",
      kontakTerverifikasiPada: "2024-10-20T00:00:00Z",
      whatsappOptin: true,
    }),
    "siap",
  );
});

test("opt-in tanpa verifikasi tetap belum siap", () => {
  // Persetujuan atas nomor yang belum dibuktikan miliknya tidak
  // membuktikan apa pun.
  assert.equal(
    kesiapanWhatsapp({
      kontak: "+628123456789",
      kontakTerverifikasiPada: null,
      whatsappOptin: true,
    }),
    "belum-diverifikasi",
  );
});

test("setiap keadaan kesiapan punya kalimatnya", () => {
  for (const k of [
    "siap",
    "belum-ada-nomor",
    "belum-diverifikasi",
    "belum-setuju",
  ] as const) {
    assert.ok(PESAN_KESIAPAN[k].length > 0, k);
  }
});
