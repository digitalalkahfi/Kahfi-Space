# Audit komponen & style — konsistensi UX antar modul

Tanggal audit: 18 September 2026. Cakupan: seluruh `src/components` dan `src/app`
(53 halaman, 16 primitif `ui/`, ±240 komponen modul).

Tujuan audit ini bukan mencari yang jelek, melainkan mencari yang **sama tapi
ditulis berkali-kali**. Setiap salinan adalah satu tempat baru yang bisa
melenceng sendiri, dan melencengnya justru tidak terasa saat menulis — baru
terasa saat orang pindah dari satu modul ke modul lain dan merasa aplikasinya
"agak beda".

Empat temuan di bawah semuanya terukur, bukan kesan.

---

## 1. Tombol pil saringan: 13 salinan, 2 bentuk

Tiga belas berkas masing-masing mendeklarasikan helper lokalnya sendiri
bernama `pil`:

| Bentuk                          | Kelas                                                                                                           | Jumlah |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------ |
| Saringan (bar, bisa digulir)    | `tekan-halus sentuh-nyaman rounded-full px-3 py-1.5 text-[11px] leading-[14px] font-semibold whitespace-nowrap` | 9      |
| Dalam dialog (pilihan kategori) | `tekan-halus h-10 rounded-xl px-3 text-[11px] font-semibold`                                                    | 4      |

Berkasnya: `aset/dialog-aset`, `aset/saring-aset`, `aset/saring-log-aset`,
`budget/dialog-alokasi`, `budget/dialog-anggaran`, `budget/saring-anggaran`,
`keuangan/dialog-transaksi`, `keuangan/saring-transaksi`, `lms/saring-progres`,
`masalah/saring-masalah`, `masukan/saring-masukan`, `sampel/saring-riwayat`,
`tim/saring-anggota`.

Kabar baiknya: di dalam tiap bentuk, string kelasnya **identik karakter per
karakter** — jadi ini duplikasi murni, bukan tiga belas keputusan desain yang
berbeda. Tanda tangan fungsinya yang sedikit berbeda (sebagian menerima `kunci`
untuk `key`, sebagian memakai `label` sebagai `key`), dan itu justru sumber bug
diam-diam: label yang kebetulan sama akan bentrok sebagai `key`.

**Rencana:** satu komponen `src/components/shared/pil.tsx` dengan prop
`bentuk: "saringan" | "dialog"`, `aktif`, `onClick`, dan `key` wajib dari
pemanggil. Ganti tiga belas helper lokal, hapus deklarasinya.

## 2. Banner pesan hasil aksi: 59 titik, 16 varian kelas

56 berkas merender `{pesan ? … : null}` setelah Server Action, total 59 titik
render. Untuk kotak yang tugasnya sama persis, dipakai 16 string kelas berbeda.
Tiga terbanyak:

- `rounded-xl bg-warn-fill px-3 py-2 text-[11px] leading-[14px] text-warn-text` — 19×
- `rounded-xl bg-muted px-3 py-2 text-[11px] leading-[14px] text-pretty text-muted-foreground` — 4×
- `mx-5 rounded-2xl bg-muted px-4 py-2.5 text-[11px] leading-[14px] text-pretty text-muted-foreground` — 3×

Perbedaannya bukan cuma kosmetik: radius berbeda (`xl` vs `2xl`), ukuran teks
berbeda (11px vs 13px), dan yang paling penting **warnanya berbeda untuk arti
yang sama** — sebagian pakai `warn-fill`, sebagian `danger-fill`, sebagian
`muted`. Orang tidak bisa belajar "kuning = gagal" kalau gagal kadang abu-abu.

`lms/kelola-modul` sudah melangkah benar: ia memilih `ok-fill` atau `warn-fill`
berdasarkan `berhasil`. Pola itulah yang perlu jadi milik bersama.

**Rencana:** komponen `PesanAksi` dengan `nada: "berhasil" | "gagal" | "netral"`,
`role="status"` sudah terpasang, satu ukuran per konteks (dalam kartu vs dalam
dialog). Semua 59 titik diarahkan ke sana.

## 3. Keadaan kosong: 57 berkas, 7 bentuk wadah, tapi satu konvensi kalimat

57 berkas menulis sendiri kalimat kosongnya. Bentuk wadahnya beragam — 19×
`px-5 text-[13px] leading-[18px] text-muted-foreground`, 6× varian
`text-pretty`, 3× tanpa `px-5`, 2× kotak `bg-muted`, dan seterusnya.

Yang **tidak** perlu diubah: konvensi kalimatnya ternyata sudah rapi dan
konsisten di seluruh aplikasi —

- _"Belum ada X"_ → memang belum pernah ada datanya;
- _"Tidak ada X yang cocok dengan saringan ini"_ → datanya ada, saringannya yang
  menyisakan nol.

Perbedaan itu penting dan sudah dipakai benar hampir di mana-mana. Audit ini
merekomendasikan **mempertahankan** kalimatnya dan hanya menyeragamkan wadah
serta menjaga perbedaan dua kondisi itu tetap eksplisit lewat prop.

`src/components/shared/keadaan.tsx` sudah menyediakan `KeadaanKosong`, tetapi
baru dipakai di 1 tempat (halaman contoh). Itu pekerjaan berikutnya, bukan
komponen baru lagi.

**Rencana:** `KeadaanKosong` dapat prop `sisip` supaya bisa dipakai di dalam
kartu yang sudah punya judul sendiri tanpa menumpuk dua garis tepi. Perbedaan
"belum pernah ada" vs "tersaring habis" tetap dibawa oleh `judul`/`pesan`,
karena kalimatnya memang sudah benar. Migrasi bertahap per modul, bukan sekali
sapu, supaya tiap modul tetap bisa dites.

## 4. Keadaan memuat & gagal: hampir tidak ada batasnya

- `loading.tsx`: **2** dari 53 halaman (`/keuangan`, `/keuangan/budget`).
- `error.tsx`: **2** dari 53 halaman (keduanya sama).
- `not-found.tsx`: **0**.
- `<Suspense>`: 2 berkas.

Di sisi lain, **59 berkas** memakai `useTransition` — artinya keadaan "sedang
memproses" untuk aksi sudah tertangani baik; yang belum adalah keadaan "sedang
mengambil data" saat pindah halaman dan keadaan "gagal mengambil data".

Ini temuan paling berdampak: modul di luar Keuangan tidak punya jaring pengaman
sama sekali. Kalau query gagal, yang muncul adalah error boundary bawaan
Next.js, bukan bahasa aplikasi ini.

**Rencana:** `loading.tsx` + `error.tsx` per segmen rute utama, isinya memakai
`KeadaanMemuat` dan `KeadaanGagal` yang sudah ada. Bukan 53 berkas — cukup di
tiap akar modul (`/absensi`, `/aset`, `/grd`, `/lms`, `/masalah`, `/sampel`,
`/tim`, `/tugas`, `/kalender`, `/masukan`, `/pengumuman`), karena segmen anak
mewarisinya. Isi `error.tsx` ditarik ke satu komponen
`shared/batas-galat.tsx`; yang jadi prop hanya nama modul dan kalimat
judulnya, supaya menambah batas untuk modul berikutnya cuma sepuluh baris.

## 5. Dialog konfirmasi: 5 salinan tangan

Lima dialog konfirmasi ditulis manual (dikenali dari `DialogTitle` berakhiran
tanda tanya): `lms/kelola-soal`, `lms/kelola-modul`, `grd/panel-kunci-kpi`,
`migrasi/panel-jalankan`, `sampel/tombol-hapus-sampel`. Tidak ada satupun yang
memakai `window.confirm` — bagus, dan tidak ada `AlertDialog` — jadi tidak ada
dua sistem yang bertabrakan.

Struktur kelimanya mirip: buka via state, `DialogFooter` dengan Batal + aksi,
`useTransition` untuk tombol yang sedang jalan. `shared/dialog-konfirmasi.tsx`
sudah menyalin struktur itu, baru dipakai di halaman contoh.

**Rencana:** arahkan kelimanya ke `DialogKonfirmasi`. Perhatian khusus untuk
`migrasi/panel-jalankan` dan `grd/panel-kunci-kpi`: keduanya aksi yang **tidak
bisa dibatalkan** (trigger database mengunci), jadi teks penjelasnya harus tetap
spesifik — komponen bersama tidak boleh memaksa kalimat generik.

---

## Yang sengaja TIDAK diubah

- **Radius kartu `rounded-3xl shadow-card ring-border-subtle`** muncul di 108
  berkas. Itu bukan duplikasi yang perlu dibungkus — itu memang bahasa visual
  Warm Modern Corporate, dan membungkusnya jadi `<KartuModul>` hanya menambah
  lapisan tanpa mengurangi keputusan.
- **Pemilih periode.** Ada enam: `shared/pilih-periode`, `shared/pilih-rentang`,
  `keuangan/pilih-periode-finance`, `depresiasi/pilih-periode`,
  `grd/pilih-bulan-kpi`, `tugas/pilih-tampilan`. Sempat terlihat seperti
  duplikasi, tetapi setelah dibaca isinya berbeda secara domain: bulan-KPI
  terikat penguncian KPI, periode-finance punya lima jenis rentang, rentang
  absensi punya batas tanggal. Menyatukannya akan menghasilkan satu komponen
  dengan enam mode — lebih sulit dibaca daripada enam komponen kecil.

  **Menyusul (18 Sep 2026):** `shared/pilih-periode` ternyata bukan salah satu
  dari keenamnya — ia tidak terhubung ke apa pun. Dua pemakaiannya (app-bar
  atas dan kartu sapaan Beranda) hanya memindah warna di state lokal. Berkasnya
  dihapus; tinggal lima pemilih periode, semuanya sungguhan.

- **Konvensi kalimat kosong** (poin 3) dipertahankan apa adanya.

## Urutan kerja yang disarankan

1. Batas rute (`loading.tsx`/`error.tsx`) — dampak terbesar, risiko terkecil,
   tidak menyentuh komponen yang sudah jalan.
2. `PesanAksi` — 59 titik, tapi penggantinya mekanis.
3. `Pil` bersama — 13 berkas.
4. `KeadaanKosong` per modul — paling banyak sentuhan, dikerjakan bertahap.
5. `DialogKonfirmasi` untuk lima dialog yang ada.

Setiap langkah dijaga dengan `npm run typecheck`, `npm run lint`,
`npm run build`, dan `npm run test:unit` sebelum dianggap selesai.

---

## Status penerapan

Dicatat di sini supaya audit ini tidak jadi dokumen yang benar sekali lalu
basi. Diperbarui tiap kali satu langkah selesai.

| Langkah                                                                                        | Keadaan                                                                       |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Batas rute untuk modul yang diubah plan ini (`/tugas`, `/sampel`, `/aset`, `/masukan-masalah`) | selesai — `loading.tsx` + `error.tsx` terpasang                               |
| `shared/batas-galat.tsx` + refaktor `/keuangan`, `/keuangan/budget`                            | selesai                                                                       |
| `KeadaanKosong` pada halaman yang diubah plan ini                                              | selesai — 10 titik: aset (3), sampel (3), keuangan (2), budget (1), tugas (1) |
| Batas rute untuk modul lain (`/absensi`, `/grd`, `/lms`, `/tim`, …)                            | belum                                                                         |
| `PesanAksi`                                                                                    | belum                                                                         |
| `Pil` bersama                                                                                  | belum                                                                         |
| `KeadaanKosong` untuk modul di luar cakupan plan ini                                           | belum                                                                         |
| `DialogKonfirmasi` untuk lima dialog yang ada                                                  | belum                                                                         |

Rujukan visualnya ada di `/referensi-desain` — halaman di dalam aplikasi, tidak
masuk menu, berisi token, tipografi, primitif, pola berulang, dan keempat
keadaan dalam bentuk yang sudah disepakati.
