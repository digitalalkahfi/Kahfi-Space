import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  LABEL_KEKUATAN,
  SANDI_MAKS,
  SANDI_MIN,
  SYARAT_SANDI,
  kekuatanSandi,
  periksaSandi,
  ragamKarakter,
  sandiBaruSah,
} from "@/lib/keamanan";

test("sandi yang memenuhi semua syarat diterima", () => {
  for (const sandi of [
    "Jalanan Sepi 7",
    "KopiPagi2026",
    "b3rasPutihEnak",
    "Sandi-Yang-Panjang9",
  ]) {
    assert.equal(periksaSandi(sandi).ok, true, sandi);
  }
});

test("sandi yang kurang menyebut syarat mana yang belum terpenuhi", () => {
  const hasil = periksaSandi("pendek");
  assert.equal(hasil.ok, false);
  assert.ok(hasil.belum.includes(`Minimal ${SANDI_MIN} karakter`));
  assert.ok(hasil.belum.includes("Ada huruf besar"));
  assert.ok(hasil.belum.includes("Ada angka"));
});

test("yang sudah terpenuhi tidak ikut disebut kurang", () => {
  const hasil = periksaSandi("hurufkecilsaja");
  assert.equal(hasil.ok, false);
  assert.ok(!hasil.belum.includes(`Minimal ${SANDI_MIN} karakter`));
  assert.ok(!hasil.belum.includes("Ada huruf kecil"));
  assert.ok(hasil.belum.includes("Ada huruf besar"));
});

test("sandi yang terlalu sering dipakai ditolak meski memenuhi syarat bentuk", () => {
  const hasil = periksaSandi("kataSandi1");
  // Bentuknya lolos — 10 karakter, ada huruf besar, kecil, dan angka;
  // yang menolaknya adalah daftar sandi umum.
  assert.equal(hasil.belum.length, 0);
  assert.equal(hasil.ok, false);
  assert.match(hasil.pesan ?? "", /sering dipakai/i);
});

test("pencocokan sandi umum tidak peduli besar-kecil huruf", () => {
  for (const tulisan of ["katasandi1", "KATASANDI1", "KataSandi1"]) {
    assert.equal(periksaSandi(tulisan).ok, false, tulisan);
  }
});

test("sandi yang memuat nama atau email pemiliknya ditolak", () => {
  const konteks = { nama: "Farhan Pratama", email: "farhan@alkahfi.co.id" };
  // Sengaja tanpa deret angka, supaya yang menolaknya benar-benar
  // pemeriksaan nama dan bukan pemeriksaan pola.
  const pakaiNama = periksaSandi("FarhanMendung7", konteks);
  assert.equal(pakaiNama.ok, false);
  assert.match(pakaiNama.pesan ?? "", /nama atau alamat email/i);

  // Orang lain dengan sandi yang sama tidak ikut tertolak.
  assert.equal(
    periksaSandi("FarhanMendung7", { nama: "Dewi Lestari" }).ok,
    true,
  );
});

test("sandi melebihi batas bcrypt ditolak dengan jelas", () => {
  const hasil = periksaSandi("A1" + "b".repeat(SANDI_MAKS));
  assert.equal(hasil.ok, false);
  assert.match(hasil.pesan ?? "", new RegExp(String(SANDI_MAKS)));
});

test("kekuatan naik seiring ragam dan panjang", () => {
  assert.equal(kekuatanSandi(""), "lemah");
  assert.equal(kekuatanSandi("abcdefgh"), "lemah");
  assert.equal(kekuatanSandi("KopiPagi26"), "sedang");
  assert.equal(kekuatanSandi("KopiPagi-Sekali-2026"), "kuat");
});

test("setiap tingkat kekuatan punya label", () => {
  for (const tingkat of ["lemah", "sedang", "kuat"] as const) {
    assert.ok(LABEL_KEKUATAN[tingkat].length > 0, tingkat);
  }
});

test("setiap syarat benar-benar bisa dipenuhi dan bisa gagal", () => {
  for (const s of SYARAT_SANDI) {
    assert.equal(
      s.penuhi("KopiPagi2026xyz"),
      true,
      `${s.kunci} harusnya lolos`,
    );
    assert.equal(s.penuhi(""), false, `${s.kunci} harusnya gagal untuk kosong`);
  }
});

test("penggantian ditolak saat sandi lama kosong, sama, atau ulangan beda", () => {
  assert.deepEqual(sandiBaruSah("", "Baru123456", "Baru123456"), {
    ok: false,
    pesan: "Isi kata sandi saat ini dulu.",
  });
  assert.equal(sandiBaruSah("Lama123456", "", "").ok, false);
  assert.match(
    sandiBaruSah("Sama123456", "Sama123456", "Sama123456").pesan ?? "",
    /masih sama/i,
  );
  assert.match(
    sandiBaruSah("Lama123456", "Baru123456", "Baru12345").pesan ?? "",
    /belum sama/i,
  );
  assert.equal(sandiBaruSah("Lama123456", "Baru123456", "Baru123456").ok, true);
});

test("sandi yang memenuhi bentuk tapi berpola tetap ditolak", () => {
  // Keempat syarat bentuk terpenuhi pada semuanya; yang menolak adalah
  // pemeriksaan pola.
  const berpola = {
    Aaaaaaaaa1: /berulang beruntun/i,
    Abcdefghi1: /urutan yang mudah ditebak/i,
    Qwertyuio1: /urutan yang mudah ditebak/i,
    Poiuytrew1: /urutan yang mudah ditebak/i,
    Ab1Ab1Ab1A: /karakter berbeda/i,
  };
  for (const [sandi, pola] of Object.entries(berpola)) {
    const hasil = periksaSandi(sandi);
    assert.equal(hasil.belum.length, 0, `${sandi}: bentuknya seharusnya lolos`);
    assert.equal(hasil.ok, false, `${sandi} seharusnya ditolak`);
    assert.match(hasil.pesan ?? "", pola, sandi);
  }
});

test("urutan terbalik juga ditangkap", () => {
  assert.equal(periksaSandi("Zyxw4321Kq").ok, false);
});

test("sandi acak yang wajar tetap diterima setelah pemeriksaan pola", () => {
  for (const sandi of [
    "Jalanan Sepi 7",
    "KopiPagi-2026",
    "b3rasPutihEnak",
    "Mendung7Tebal",
  ]) {
    const hasil = periksaSandi(sandi);
    assert.equal(
      hasil.ok,
      true,
      `${sandi}: ${hasil.pesan ?? hasil.belum.join()}`,
    );
  }
});

test("ragam karakter dihitung dari karakter berlainan, bukan panjang", () => {
  assert.equal(ragamKarakter("aaaa"), 1);
  assert.equal(ragamKarakter("abcabc"), 3);
  assert.equal(ragamKarakter("KopiPagi-2026"), 11);
});
