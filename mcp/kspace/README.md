# MCP `kspace` — Claude membaca data K-Space (hanya-baca)

Server kecil yang berjalan di Mac Manager supaya Claude Code dan Claude
Desktop bisa menjawab pertanyaan dari data K-Space V2 yang terbaru:
siapa belum lapor, GMV per unit, dan tugas yang lewat tenggat.

- **Hanya membaca.** Ia masuk ke database sebagai peran `asisten_baca`,
  yang hanya boleh menjalankan fungsi di skema `asisten`. Ia tidak bisa
  menulis, tidak bisa membaca tabel, dan tidak punya tool "jalankan SQL".
- **Tidak menghitung sendiri.** Satu tool = satu fungsi `asisten.*`, dan
  fungsi itu membungkus fungsi yang sama dengan Beranda.
- **Hanya di Mac ini.** Bukan connector online, bukan untuk Leader/staf.

## TOMBOL DARURAT

Kalau sandi diduga bocor atau Anda ingin mematikan akses seketika,
jalankan ini di Supabase → SQL Editor:

```sql
alter role asisten_baca nologin;
```

Akses langsung mati. Untuk menyalakan lagi, setel sandi baru (lihat
"Cara ganti sandi").

## Daftar tool

| Tool | Untuk pertanyaan | Sumber |
|---|---|---|
| `tanggal_hari_ini` | Hari ini tanggal berapa (WIB), hari kerja terakhir | `asisten.hari_ini()`, `asisten.hari_kerja_terakhir()` |
| `status_lapor(tanggal?)` | Berapa yang wajib lapor, sudah, dan belum, per Leader | `asisten.status_lapor()` |
| `belum_lapor(tanggal?)` | Siapa yang belum lapor, per Leader | `asisten.belum_lapor()` |
| `gmv_unit(tanggal?)` | GMV satu tanggal dan bulan berjalan per unit vs target prorata | `asisten.gmv_unit()` |
| `gmv_harian(dari, sampai, unit?)` | GMV per hari per unit, maksimal 92 hari | `asisten.gmv_harian()` |
| `tugas_telat(waktu?, min_hari_telat?)` | Tiket lewat tenggat seluruh tim dan to-do pribadi Manager; "menunggu QC" dipisah | `asisten.tugas_telat()` |

Yang perlu diingat saat membaca jawabannya:

- **Aturan H-1.** Laporan yang ditagih hari ini berisi GMV kemarin. Untuk
  "GMV kemarin", tanggalnya tanggal kemarin.
- **Kosong bukan nol.** Tanggal tanpa laporan ditulis "tidak ada laporan".
- **GMV adalah input manual K-Space**; acuan resmi tetap Partner Center.
- **Target per unit** hanya muncul bila diisi di K-Space. Target GRD
  (goal 1, 1.1, 1.2 dan lead measure) belum punya tool.
- **Di luar cakupan:** keuangan/kas, gaji, komisi, absensi, lokasi,
  selfie, email, nomor HP, alamat. Claude akan menjawab "data ini tidak
  bisa diakses".

## Cara pasang (sekali saja)

Semua perintah dijalankan di aplikasi Terminal.

**1. Pasang salinan server di luar repo**

```bash
cd "<folder repo>/mcp/kspace" && npm install && npm run pasang
```

Server disalin ke `~/.kspace-mcp/server`. Claude menjalankan salinan itu,
jadi berpindah branch di repo tidak mematikan MCP.

**2. Buat berkas setelan** `~/.kspace-mcp/config.json`

```json
{
  "host": "<alamat pooler Supabase, mode sesi>",
  "port": 5432,
  "database": "postgres",
  "user": "asisten_baca.<kode-proyek>",
  "caPath": "/Users/<nama>/.kspace-mcp/supabase-ca.crt"
}
```

- Alamat pooler dan kode proyek ada di dasbor Supabase → tombol
  **Connect** → "Session pooler".
- Berkas ini **tidak boleh** berisi sandi. Server menolaknya bila ada.
- `user` harus `asisten_baca`. Nama lain ditolak.

**3. Unduh sertifikat Supabase**

Dasbor Supabase → Database → Settings → **SSL Configuration** →
**Download certificate**. Pindahkan berkasnya ke
`~/.kspace-mcp/supabase-ca.crt`. Sertifikat ini bukan rahasia.

**4. Pastikan database siap**

Migration `0217_asisten_baca.sql`, `0218_pagar_asisten_baca.sql`, dan
`0219_asisten_todo_pribadi.sql` harus sudah diterapkan. Untuk memeriksanya, jalankan isi
[`sql/periksa-pagar.sql`](sql/periksa-pagar.sql) di SQL Editor. Yang
diharapkan: `fungsi_asisten` = 7, `definer_terbuka_di_luar_asisten` = 0,
`tabel_terbaca` = 0.

**5. Setel sandi** — lihat bagian berikutnya.

**6. Daftarkan di Claude Code** (berlaku dari folder mana pun)

```bash
claude mcp add --transport stdio --scope user kspace -- "$(which node)" "$HOME/.kspace-mcp/server/index.mjs"
```

Supaya tool-nya tidak ditanya izin setiap kali (aman karena hanya-baca),
tambahkan ke `~/.claude/settings.json`:

```json
{ "permissions": { "allow": ["mcp__kspace"] } }
```

**7. Daftarkan di Claude Desktop**

Tambahkan ke `~/Library/Application Support/Claude/claude_desktop_config.json`,
lalu keluar penuh dari Claude Desktop dan buka lagi:

```json
{
  "mcpServers": {
    "kspace": {
      "command": "/usr/local/bin/node",
      "args": ["/Users/<nama>/.kspace-mcp/server/index.mjs"]
    }
  }
}
```

Tidak ada sandi di berkas ini; server mengambilnya sendiri dari Keychain.

**8. Uji**

```bash
npm run cek
```

Harus berakhir dengan "✓ Sambungan dan keenam tool bekerja." Perintah ini
tidak mencetak data, hanya jumlah baris.

## Cara ganti sandi

```bash
cd "<folder repo>/mcp/kspace" && npm run setel-sandi
```

Skrip membuat sandi acak, menyimpannya di Keychain macOS, dan menyalin
perintah SQL-nya ke clipboard. Sandi tidak tampil di layar. **Langsung
setelah itu** (jangan menyalin teks lain dulu):

1. Supabase → SQL Editor → tab baru.
2. Tekan Cmd+V, klik **Run**. Hasilnya harus "Success".
3. Tutup tab itu tanpa menyimpan, lalu salin teks lain apa saja.

Sandi lama langsung tidak berlaku. Kedua langkah (Terminal dan SQL
Editor) harus dikerjakan; salah satu saja tidak cukup.

## Setelah kode MCP berubah

```bash
cd "<folder repo>/mcp/kspace" && npm install && npm run pasang
```

Lalu mulai sesi Claude baru.

## Catatan panggilan (log)

`~/Library/Logs/kspace-mcp/panggilan.log` — satu baris per panggilan:
waktu, nama tool, parameter, jumlah baris, sukses/gagal, lama. Isi data
(nama orang, angka GMV) tidak dicatat.

## Kalau tidak jalan

| Pesan | Artinya | Yang dilakukan |
|---|---|---|
| "MCP kspace belum disetel" | Berkas setelan tidak ada | Langkah 2 |
| "Sandi asisten_baca belum ada di Keychain" | Sandi belum disimpan di Mac ini | `npm run setel-sandi` |
| "Peran asisten_baca belum boleh login" | Perintah SQL sandi belum dijalankan, atau tombol darurat aktif | Ganti sandi (dua langkah) |
| "Database menolak login" | Sandi di Keychain beda dengan di database | Ganti sandi (dua langkah) |
| "Sambungan aman (SSL) gagal diverifikasi" | Sertifikat tidak ada atau salah | Langkah 3, periksa `caPath` |
| "Pooler tidak mengenali nama pengguna" | `user` salah | Bentuknya `asisten_baca.<kode-proyek>` |
| "Tidak bisa menghubungi database" | Internet/jaringan Mac | Periksa Wi-Fi |
| "Fungsi asisten.* belum ada" | Migration 0217 belum diterapkan | Langkah 4 |

Rincian error database sengaja tidak ditampilkan supaya alamat server
dan sandi tidak pernah bocor ke layar atau log.

## Untuk pengembang

- Tes: `npm test` (PGlite, tidak menyentuh produksi). Tes pagar hak akses
  ada di `supabase/tests/asisten-pagar.test.mjs` dan ikut `npm run db:test`.
- Menambah data baru: tambah fungsi pembungkus di skema `asisten` lewat
  migration baru dengan pola 0217, plus tes yang membuktikan angkanya sama
  dengan fungsi aslinya, baru tambah tool di `lib/tools.mjs`.
- Sejak 0218, fungsi baru di skema `public` tidak otomatis terbuka ke
  semua peran. `anon`/`authenticated`/`service_role` tetap mendapat hak
  lewat setelan bawaan Supabase; peran lain perlu `grant execute`.
- Jangan pernah menulis ke stdout (`console.log`): itu saluran protokol.
