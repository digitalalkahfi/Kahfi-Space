#!/bin/bash
# Membuat sandi acak untuk peran database asisten_baca, menyimpannya di
# Keychain macOS, lalu menyalin perintah SQL-nya ke clipboard.
#
# Sandi TIDAK ditampilkan di layar dan tidak ditulis ke berkas mana pun.
# Sesudah ini: buka SQL Editor Supabase, tekan Cmd+V, lalu Run.
#
# Jalankan lagi kapan saja untuk MENGGANTI sandi (sandi lama langsung
# tidak berlaku begitu perintah SQL-nya dijalankan).
set -euo pipefail

SANDI="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | cut -c1-40)"
if [ "${#SANDI}" -lt 32 ]; then
  echo "Gagal membuat sandi. Coba jalankan lagi." >&2
  exit 1
fi

security add-generic-password -a asisten_baca -s kspace-mcp -U -w "$SANDI"
printf "alter role asisten_baca with login password '%s';" "$SANDI" | pbcopy
unset SANDI

cat <<'PESAN'
✓ Sandi baru tersimpan di Keychain (nama: kspace-mcp).
✓ Perintah SQL sudah ada di clipboard.

Langkah Anda sekarang:
  1. Buka Supabase → SQL Editor → tab baru.
  2. Tekan Cmd+V, lalu klik Run. Hasilnya harus "Success".
  3. Tutup tab itu TANPA menyimpannya (isinya memuat sandi).
  4. Salin teks lain apa saja supaya sandi hilang dari clipboard.
PESAN
