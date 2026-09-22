/**
 * Tetapan gerak K-Space V2.
 * Dasbor ini dibuka tiap pagi & sore dari HP, jadi animasi dijaga singkat,
 * hanya menyentuh transform/opacity, dan selalu tunduk pada prefers-reduced-motion.
 */
export const durasi = {
  kilat: 0.22,
  cepat: 0.34,
  sedang: 0.5,
  angka: 0.9,
} as const;

export const easing = {
  keluar: "power2.out",
  halus: "power3.out",
  pegas: "back.out(1.4)",
} as const;

/** Jeda antar elemen dalam satu rombongan reveal. */
export const jedaStagger = 0.07;

/** Media query yang dipakai gsap.matchMedia untuk menonaktifkan animasi. */
export const gerakAman = "(prefers-reduced-motion: no-preference)";

/**
 * Menjalankan `pasang` hanya saat dokumen terlihat.
 *
 * Animasi "masuk" menyembunyikan elemen dulu lalu memunculkannya. Di tab
 * latar belakang requestAnimationFrame ditangguhkan, jadi kalau dipasang
 * begitu saja kontennya bisa tertinggal tak terlihat. Di sini pemasangan
 * ditunda sampai tab benar-benar dibuka; sebelum itu konten tampil apa adanya.
 *
 * Mengembalikan fungsi pembersih.
 */
export function saatTerlihat(pasang: () => void): () => void {
  if (typeof document === "undefined") return () => {};

  if (document.visibilityState === "visible") {
    pasang();
    return () => {};
  }

  const tangani = () => {
    if (document.visibilityState !== "visible") return;
    document.removeEventListener("visibilitychange", tangani);
    pasang();
  };

  document.addEventListener("visibilitychange", tangani);
  return () => document.removeEventListener("visibilitychange", tangani);
}

/** Bentuk minimal tween/timeline GSAP yang dipakai pengaman di bawah. */
type Gerakan = {
  progress(): number;
  progress(nilai: number): unknown;
};

/**
 * Pengaman animasi yang dipicu scroll.
 *
 * Animasi reveal menyembunyikan elemen lebih dulu, dan animasi angka menulis
 * nilai antara selama berjalan. Kalau pemicunya tidak pernah jalan atau
 * berhenti di tengah (mis. requestAnimationFrame ditangguhkan saat tab
 * berpindah), elemen di dalam viewport bisa tertinggal tak terlihat — atau,
 * lebih buruk, memampang angka yang belum sampai nilai sebenarnya.
 * Setelah `jeda`, elemen semacam itu dilompatkan ke keadaan akhir.
 * Elemen yang memang masih di bawah layar dibiarkan — itu bukan kemacetan.
 */
export function jagaTampil(el: Element, gerakan: Gerakan, jeda = 2500) {
  if (typeof window === "undefined") return () => {};

  const id = window.setTimeout(() => {
    if (gerakan.progress() >= 1) return;
    const kotak = el.getBoundingClientRect();
    const didalamLayar = kotak.top < window.innerHeight && kotak.bottom > 0;
    if (didalamLayar) gerakan.progress(1);
  }, jeda);

  return () => window.clearTimeout(id);
}

/**
 * Pengaman animasi yang jalan begitu komponen tampil (bukan dipicu scroll).
 *
 * Kalau animasinya sempat terhenti di tengah — misalnya tab dipindah saat
 * angka GMV masih merayap naik — nilai yang tertinggal di layar bisa salah.
 * Setelah `jeda`, animasi yang belum tuntas langsung dilompatkan ke akhir.
 */
export function jagaSelesai(gerakan: Gerakan, jeda = 2500) {
  if (typeof window === "undefined") return () => {};

  const id = window.setTimeout(() => {
    if (gerakan.progress() < 1) gerakan.progress(1);
  }, jeda);

  return () => window.clearTimeout(id);
}
