/**
 * Menerjemahkan alias "@/..." untuk tes unit Node.
 *
 * Node menjalankan TypeScript dengan menanggalkan tipe, tetapi tidak
 * membaca `paths` di tsconfig dan tidak menebak ekstensi. Hook ini
 * memetakan "@/x" ke <akar>/src/x.ts sehingga modul murni bisa diuji
 * tanpa memaksa kode sumber memakai impor relatif.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const AKAR = pathToFileURL(`${path.resolve(process.cwd(), "src")}/`).href;

export async function resolve(spesifier, konteks, berikutnya) {
  if (!spesifier.startsWith("@/")) return berikutnya(spesifier, konteks);

  const jalur = spesifier.slice(2);
  const punyaEkstensi = /\.(ts|tsx|mjs|js|json)$/.test(jalur);
  const url = new URL(punyaEkstensi ? jalur : `${jalur}.ts`, AKAR).href;
  return berikutnya(url, konteks);
}

register(import.meta.url, import.meta.url);
