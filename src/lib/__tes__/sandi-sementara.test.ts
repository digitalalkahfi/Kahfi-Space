import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  buatSandiSementara,
  harusGantiSandiDulu,
  periksaSandi,
} from "../keamanan.ts";

test("kata sandi sementara selalu lolos aturan sandi dan tidak berulang", () => {
  const konteks = { nama: "Muhammad Najib", email: "najib@contoh.id" };
  const semua = new Set<string>();
  for (let i = 0; i < 500; i += 1) {
    const s = buatSandiSementara(konteks);
    assert.match(s, /^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
    assert.ok(periksaSandi(s, konteks).ok, s);
    assert.doesNotMatch(s, /[01OIl]/, "tanpa karakter yang mudah tertukar");
    semua.add(s);
  }
  assert.equal(semua.size, 500);
});

test("pemilik kata sandi sementara diarahkan ke Keamanan dulu", () => {
  const wajib = { wajib_ganti_sandi: true };
  assert.equal(harusGantiSandiDulu(wajib, "/beranda"), true);
  assert.equal(harusGantiSandiDulu(wajib, "/grd/goal"), true);
  assert.equal(harusGantiSandiDulu(wajib, "/keamanan"), false);
  assert.equal(harusGantiSandiDulu(wajib, "/masuk"), false);
  assert.equal(harusGantiSandiDulu(wajib, "/api/keamanan/sandi"), false);
  // Bukan "/keamanan-lain".
  assert.equal(harusGantiSandiDulu(wajib, "/keamananx"), true);
  assert.equal(
    harusGantiSandiDulu({ wajib_ganti_sandi: false }, "/beranda"),
    false,
  );
  assert.equal(harusGantiSandiDulu(undefined, "/beranda"), false);
});
