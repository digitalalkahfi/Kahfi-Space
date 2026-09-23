# Audit pemakaian @dnd-kit

_Ditulis saat penutasan Fase 4. Yang dicari: apakah drag-and-drop di
aplikasi ini memang perlu pustaka, apakah pemakaiannya konsisten, dan
apakah ada jalan yang tidak bisa dilalui tanpa tetikus._

## Di mana saja dipakai

| Berkas                                       | Paket                           | Bentuk                                                        |
| -------------------------------------------- | ------------------------------- | ------------------------------------------------------------- |
| `src/components/tugas/papan-kanban.tsx`      | `core`                          | `useDraggable` + `useDroppable` — kartu berpindah antar kolom |
| `src/components/tampilan/pilih-tampilan.tsx` | `core`, `sortable`, `modifiers` | `SortableContext` — mengurutkan menu                          |
| `src/components/tampilan/baris-tampilan.tsx` | `sortable`, `utilities`         | `useSortable` — satu baris menu                               |

Empat paket terpasang (`core`, `sortable`, `modifiers`, `utilities`) dan
keempatnya benar-benar dipakai. Tidak ada pustaka seret kedua, dan tidak
ada mesin seret buatan sendiri yang berjalan berdampingan.

## Yang sudah benar

- **Dua-duanya memakai `PointerSensor`**, bukan `MouseSensor` +
  `TouchSensor` terpisah. Satu jalur kejadian untuk tetikus, sentuh, dan
  pena — bukan tiga perilaku yang harus dirawat sendiri-sendiri.
- **Jarak aktivasi 6px** di keduanya. Tanpa itu, ketukan biasa di ponsel
  sering terbaca sebagai seretan sependek satu piksel.
- **`KeyboardSensor` di keduanya**, jadi tidak ada perpindahan yang
  hanya bisa dilakukan dengan tetikus. Papan Kanban memakai
  `coordinateGetter` khusus supaya panah kiri/kanan berpindah KOLOM,
  bukan bergeser sekian piksel.
- **`closestCorners`**, bukan `pointerWithin`: pemindahan lewat keyboard
  tidak punya penunjuk sama sekali, dan `pointerWithin` membuat kartu
  bisa diangkat tapi tidak pernah bisa dijatuhkan.
- **Pengumuman pembaca layar** (`announcements`) ditulis sendiri di
  papan Kanban, menyebut nama kartu dan nama kolom — bukan id.
- **Aturan perpindahannya murni** (`src/lib/kanban.ts`) dan dipakai
  bersama oleh papan dan tombol di dalam kartu, jadi tidak ada
  perpindahan yang diterima papan tapi ditolak Server Action.

## Yang diperbaiki di audit ini

- `baris-tampilan.tsx` — pegangan seretnya belum punya `touch-action:
none`. Di layar sentuh, browser mengambil alih gerakannya sebagai
  gulir halaman dan seretan tidak pernah dimulai. Papan Kanban sudah
  memakainya sejak awal; sekarang keduanya sama.
- `kolomMenerima` dipindahkan dari komponen ke `src/lib/kanban.ts` agar
  bisa diuji tanpa merakit papan.

## Yang sengaja dibiarkan

- **Tidak ada `DragOverlay` di papan Kanban.** Kartu yang diangkat
  diredupkan di tempatnya (`opacity-40`), dan kolom tujuan yang menandai
  dirinya. Overlay akan menggandakan kartu yang tingginya berbeda-beda,
  dan di layar 375px salinan itu menutupi kolom tujuannya sendiri.
- **Urutan di dalam kolom tidak bisa diseret.** Kanban di sini memindah
  STATUS, bukan menyusun antrean; urutannya ditentukan tenggat.
  Menambah pengurutan berarti menambah satu kolom database yang tidak
  dipakai siapa pun untuk memutuskan apa pun.

## Dampaknya pada papan Kanban

### Berapa yang ikut terunduh

Sumber ESM sebelum minify & gzip:

| Paket                | Ukuran  | Dipakai Kanban?                   |
| -------------------- | ------- | --------------------------------- |
| `@dnd-kit/core`      | ~102 KB | ya                                |
| `@dnd-kit/sortable`  | ~20 KB  | tidak — hanya Pengaturan Tampilan |
| `@dnd-kit/utilities` | ~8 KB   | tidak langsung                    |
| `@dnd-kit/modifiers` | ~3 KB   | tidak — hanya Pengaturan Tampilan |

Papan Kanban hanya menarik `core`. `sortable`, `modifiers`, dan
`utilities` masuk lewat halaman Pengaturan Tampilan, dan karena keduanya
komponen klien terpisah, ponsel yang tidak pernah membuka Pengaturan
Tampilan tidak ikut mengunduhnya.

### Yang didapat sebagai gantinya

Tiga hal yang harus ditulis sendiri kalau seretnya dibuat manual dengan
Pointer Events:

1. **Pembatalan yang benar.** Escape, pointer hilang (panggilan masuk,
   layar mati), dan pointer keluar jendela — ketiganya harus
   mengembalikan kartu ke tempatnya, bukan meninggalkannya menggantung.
2. **Jalur keyboard.** Mengangkat, berpindah kolom, menjatuhkan, dan
   membatalkan — lengkap dengan pengumuman pembaca layar di tiap
   langkah. Tanpa ini, memindahkan kartu jadi hal yang hanya bisa
   dilakukan dengan tetikus.
3. **Deteksi tumbukan.** Menentukan kolom mana yang sedang dituju, dan
   menentukannya dengan cara yang sama untuk penunjuk maupun keyboard.

### Kenapa tidak diganti saja

PRD Fase 4 meminta "tanpa dependensi baru". Pustaka ini memang bukan
yang baru — ia sudah dipakai Pengaturan Tampilan sebelum papan Kanban
ada. Menulis mesin seret kedua justru menambah satu perilaku keyboard
dan pembaca layar lagi yang harus dirawat terpisah, untuk menghemat
unduhan yang hanya terjadi pada halaman yang memang memakainya.

### Batas yang perlu diingat

- Kartu yang sedang diseret **tidak** dirender ulang sebagai overlay,
  jadi tinggi baris di kolom asal tidak berubah saat kartu diangkat.
- `activationConstraint: { distance: 6 }` berarti seretan sependek 5px
  tidak pernah terjadi — itu disengaja, dan juga berarti tes otomatis
  harus menggeser lebih dari 6px agar seretannya dikenali.

## Keputusan resmi

**@dnd-kit tetap dipakai, dan menjadi satu-satunya cara drag-and-drop
dibangun di K-Space V2.** Berlaku sejak penutasan Fase 4.

Artinya:

1. **Tidak ada pustaka seret kedua.** Kalau suatu saat ada kebutuhan
   seret baru, ia memakai @dnd-kit — bukan react-beautiful-dnd, bukan
   SortableJS, bukan mesin Pointer Events buatan sendiri. Dua pustaka
   seret berarti dua perilaku keyboard dan dua perilaku pembaca layar
   yang harus dirawat terpisah, dan yang kedua selalu ketinggalan.
2. **Setiap seretan wajib punya jalur non-tetikus.** `KeyboardSensor`
   terpasang, dan hasilnya benar-benar bisa dicapai lewat keyboard —
   bukan hanya sensornya terdaftar. Ini syarat, bukan penyempurnaan.
3. **Setiap pegangan seret wajib `touch-action: none`.** Tanpa itu
   fiturnya mati di ponsel, dan matinya sunyi: tidak ada galat, hanya
   halaman yang bergulir.
4. **Seretan bukan satu-satunya jalan.** Papan Kanban tetap punya tombol
   di dalam kartu yang memanggil Server Action yang sama. Seretan itu
   jalan pintas, bukan satu-satunya pintu — dan itulah sebabnya aturan
   perpindahannya hidup di modul murni yang dipakai keduanya.
5. **Aturan perpindahan tidak boleh tinggal di komponen.** Ia hidup di
   `src/lib/kanban.ts`, diuji sebagai fungsi murni, dan dipanggil papan
   maupun tombol. Aturan yang ditulis di dalam handler seret akan
   berbeda dari aturan Server Action cepat atau lambat.

Kalau suatu saat keputusan ini dicabut, yang perlu diganti bukan hanya
pustakanya: butir 2–5 di atas harus tetap berlaku pada penggantinya.
