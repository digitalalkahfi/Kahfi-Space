import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bersihkanIsi,
  bolehLihatLaporan,
  ISI_KOSONG,
  kolomLaporan,
  periksaIsiLaporan,
  perubahanRevisi,
  punyaKolom,
  unitSasaran,
  type IsiLaporan,
} from "@/lib/laporan";
import type { AkunAffiliator, SasaranLaporan } from "@/lib/types";

const isi = (p: Partial<IsiLaporan> = {}): IsiLaporan => ({
  ...ISI_KOSONG,
  gmv: 1_000_000,
  ...p,
});

test("Affiliator melapor lima kolom, MCN & TAP hanya dua", () => {
  assert.deepEqual(kolomLaporan("affiliator"), [
    "gmv",
    "komisi",
    "jumlahUpload",
    "coSampel",
    "catatan",
  ]);
  assert.deepEqual(kolomLaporan("mcn"), ["gmv", "catatan"]);
  assert.deepEqual(kolomLaporan("tap"), ["gmv", "catatan"]);
});

test("unit yang belum diketahui tetap menerima GMV dan catatan", () => {
  // Sebelum sasaran dipilih, form tetap harus punya bentuk yang sah.
  assert.deepEqual(kolomLaporan(null), ["gmv", "catatan"]);
  assert.equal(punyaKolom(null, "komisi"), false);
});

test("unitSasaran membaca unit akun, bukan jenis sasarannya", () => {
  const akun: AkunAffiliator = {
    id: "a1",
    platform: "TikTok Shop",
    username: "@toko",
    picNama: "Rian",
    unitId: "affiliator",
    program: null,
    targetHarian: 1000,
    level: 3,
    status: "aktif",
  };
  const perAkun: SasaranLaporan = { jenis: "akun", akun };
  const perUnit: SasaranLaporan = {
    jenis: "unit",
    unitId: "mcn",
    nama: "MCN",
    targetHarian: 5000,
  };
  assert.equal(unitSasaran(perAkun), "affiliator");
  assert.equal(unitSasaran(perUnit), "mcn");
});

test("bersihkanIsi membuang kolom milik departemen lain", () => {
  // Skenario nyata: pelapor mengetik komisi untuk akun Affiliator, lalu
  // berpindah ke sasaran MCN sebelum menekan kirim.
  const hasil = bersihkanIsi("mcn", isi({ komisi: 50_000, jumlahUpload: 3 }));
  assert.equal(hasil.komisi, null);
  assert.equal(hasil.jumlahUpload, null);
  assert.equal(hasil.gmv, 1_000_000);
});

test("bersihkanIsi mempertahankan kolom Affiliator dan merapikan catatan", () => {
  const hasil = bersihkanIsi(
    "affiliator",
    isi({ komisi: 50_000, jumlahUpload: 3, catatan: "  ada kendala  " }),
  );
  assert.equal(hasil.komisi, 50_000);
  assert.equal(hasil.jumlahUpload, 3);
  assert.equal(hasil.catatan, "ada kendala");
});

test("GMV nol, negatif, atau di luar batas ditolak", () => {
  assert.equal(periksaIsiLaporan("mcn", isi({ gmv: 0 })), "GMV belum diisi.");
  assert.match(String(periksaIsiLaporan("mcn", isi({ gmv: -1 }))), /tidak sah/);
  assert.match(
    String(periksaIsiLaporan("mcn", isi({ gmv: 100_000_000_001 }))),
    /batas wajar/,
  );
  assert.match(
    String(periksaIsiLaporan("mcn", isi({ gmv: NaN }))),
    /tidak sah/,
  );
});

test("isian sah untuk departemennya lolos tanpa pesan", () => {
  assert.equal(periksaIsiLaporan("mcn", isi()), null);
  assert.equal(
    periksaIsiLaporan("affiliator", isi({ komisi: 0, jumlahUpload: 0 })),
    null,
  );
});

test("komisi di luar departemennya ditolak, bukan diam-diam dibuang", () => {
  // Kiriman yang tidak lewat form (skrip, tab lama) harus dijawab jelas.
  assert.match(
    String(periksaIsiLaporan("tap", isi({ komisi: 10_000 }))),
    /tidak diisi untuk departemen ini/,
  );
  assert.match(
    String(periksaIsiLaporan("mcn", isi({ jumlahUpload: 2 }))),
    /tidak diisi untuk departemen ini/,
  );
});

test("komisi tidak boleh melebihi GMV-nya sendiri", () => {
  assert.match(
    String(
      periksaIsiLaporan("affiliator", isi({ gmv: 100_000, komisi: 100_001 })),
    ),
    /melebihi GMV/,
  );
  assert.equal(
    periksaIsiLaporan("affiliator", isi({ gmv: 100_000, komisi: 100_000 })),
    null,
    "sama besar masih mungkin, meski jarang",
  );
});

test("jumlah upload harus bilangan bulat yang wajar", () => {
  assert.match(
    String(periksaIsiLaporan("affiliator", isi({ jumlahUpload: 2.5 }))),
    /bilangan bulat/,
  );
  assert.match(
    String(periksaIsiLaporan("affiliator", isi({ jumlahUpload: -1 }))),
    /bilangan bulat/,
  );
  assert.match(
    String(periksaIsiLaporan("affiliator", isi({ jumlahUpload: 501 }))),
    /batas wajar/,
  );
});

test("pemeriksaan form dan server memakai jalur yang sama", () => {
  // Yang dikirim form selalu hasil bersihkanIsi; keduanya harus sepakat.
  const mentah = isi({ komisi: 9_000, jumlahUpload: 4 });
  for (const unit of ["affiliator", "mcn", "tap"] as const) {
    assert.equal(
      periksaIsiLaporan(unit, bersihkanIsi(unit, mentah)),
      null,
      `isi yang sudah dibersihkan untuk ${unit} seharusnya lolos`,
    );
  }
});

const jejak = (p: Partial<Parameters<typeof perubahanRevisi>[0]> = {}) => ({
  gmvLama: 1_000_000,
  gmvBaru: 1_000_000,
  komisiLama: null,
  komisiBaru: null,
  uploadLama: null,
  uploadBaru: null,
  ...p,
});

test("jejak yang hanya menyentuh komisi tidak menampilkan GMV", () => {
  // GMV selalu tersimpan di barisnya, berubah atau tidak; layar tidak
  // boleh memperlihatkannya sebagai perbaikan.
  const hasil = perubahanRevisi(
    jejak({ komisiLama: 100_000, komisiBaru: 120_000 }),
  );
  assert.deepEqual(hasil, [{ kolom: "komisi", dari: 100_000, ke: 120_000 }]);
});

test("perubahan GMV, komisi, dan upload muncul berurutan", () => {
  const hasil = perubahanRevisi(
    jejak({
      gmvBaru: 2_000_000,
      komisiLama: 100_000,
      komisiBaru: 120_000,
      uploadLama: 2,
      uploadBaru: 5,
    }),
  );
  assert.deepEqual(
    hasil.map((p) => p.kolom),
    ["gmv", "komisi", "jumlahUpload"],
  );
});

test("komisi yang berubah dari kosong dibaca sebagai nol", () => {
  const hasil = perubahanRevisi(
    jejak({ komisiLama: null, komisiBaru: 50_000 }),
  );
  assert.deepEqual(hasil, [{ kolom: "komisi", dari: 0, ke: 50_000 }]);
});

test("baris jejak tanpa perubahan menghasilkan daftar kosong", () => {
  assert.deepEqual(perubahanRevisi(jejak()), []);
});

test("upload turun ke nol tetap terhitung sebagai perubahan", () => {
  // uploadBaru 0 bukan null: `??` yang salah pakai akan menelannya.
  const hasil = perubahanRevisi(jejak({ uploadLama: 3, uploadBaru: 0 }));
  assert.deepEqual(hasil, [{ kolom: "jumlahUpload", dari: 3, ke: 0 }]);
});

const orang = (
  role: string,
  nama: string,
  unitId: "affiliator" | "mcn" | "tap" | null,
) => ({ role, nama, unitId }) as const;

const lap = (p: Partial<Parameters<typeof bolehLihatLaporan>[1]> = {}) => ({
  pelapor: "Rian Hidayat",
  unitLaporan: null,
  departemen: "affiliator" as const,
  picAkun: "Rian Hidayat",
  ...p,
});

test("CEO, Manager, dan Finance melihat seluruh laporan", () => {
  for (const role of ["CEO", "Manager", "Finance"]) {
    assert.equal(
      bolehLihatLaporan(
        orang(role, "Siapa Saja", null),
        lap({ departemen: "tap" }),
      ),
      true,
    );
  }
});

test("Staff hanya melihat laporannya sendiri dan akun yang ia pegang", () => {
  const rian = orang("Staff", "Rian Hidayat", "affiliator");
  assert.equal(bolehLihatLaporan(rian, lap()), true);
  assert.equal(
    bolehLihatLaporan(
      rian,
      lap({ pelapor: "Nabila Putri", picAkun: "Nabila Putri" }),
    ),
    false,
    "laporan rekan sejawat tidak boleh terlihat",
  );
});

test("Leader melihat laporan seluruh unitnya, bukan unit lain", () => {
  const dewi = orang("Leader", "Dewi Lestari", "affiliator");
  assert.equal(
    bolehLihatLaporan(
      dewi,
      lap({ pelapor: "Nabila Putri", picAkun: "Nabila Putri" }),
    ),
    true,
    "rekap Leader mencakup anggotanya",
  );
  assert.equal(
    bolehLihatLaporan(
      dewi,
      lap({ pelapor: "Galih Prakoso", departemen: "mcn", picAkun: null }),
    ),
    false,
  );
});

test("Leader melihat laporan tingkat unitnya sendiri", () => {
  const galih = orang("Leader", "Galih Prakoso", "mcn");
  assert.equal(
    bolehLihatLaporan(
      galih,
      lap({
        pelapor: "Orang Lain",
        unitLaporan: "mcn",
        departemen: "mcn",
        picAkun: null,
      }),
    ),
    true,
  );
});

test("Leader tanpa unit tidak melihat apa pun selain miliknya", () => {
  const tanpaUnit = orang("Leader", "Belum Ditempatkan", null);
  assert.equal(
    bolehLihatLaporan(tanpaUnit, lap({ picAkun: null })),
    false,
    "unit kosong tidak boleh cocok dengan departemen mana pun",
  );
});
