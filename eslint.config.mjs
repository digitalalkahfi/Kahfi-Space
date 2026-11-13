import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Folder kerja lokal, bukan sumber proyek: salinan checkout lain
    // (worktree) beserta hasil build-nya, dan berkas sementara. Tanpa
    // ini `npm run lint` memeriksa ribuan berkas milik checkout lain.
    ".claude/**",
    ".tmp/**",
  ]),
]);

export default eslintConfig;
