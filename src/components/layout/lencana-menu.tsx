/** Angka kecil di pojok ikon menu, mis. pendaftaran yang menunggu. */
export function LencanaMenu({ jumlah }: { jumlah: number | undefined }) {
  if (!jumlah) return null;
  return (
    <span
      aria-label={`${jumlah} menunggu`}
      className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none font-semibold text-white"
    >
      {jumlah > 99 ? "99+" : jumlah}
    </span>
  );
}
