/**
 * Tombol utama — dipakai bersama oleh beranda dan halaman fitur.
 *
 * Sengaja berupa <a href>, bukan <button onClick>, supaya navigasi tetap
 * berjalan di browser yang gagal menjalankan React (Safari iOS 15 pada
 * iPhone 7). Semua nilai visual disamakan dengan tombol yang sudah ada di
 * beranda agar kedua halaman terasa satu keluarga.
 */
type Props = {
  href: string;
  children: React.ReactNode;
  /** kelas tambahan untuk margin/posisi, bukan untuk mengubah warna */
  className?: string;
};

export function PrimaryButton({ href, children, className = "" }: Props) {
  return (
    <a
      href={href}
      className={`flex w-full items-center justify-center gap-[0.4rem] rounded-[0.7rem] bg-accent-500 px-[0.8rem] py-[0.72rem] text-cream-50 shadow-[0_8px_16px_-8px_rgba(242,106,30,0.85),inset_0_1px_0_rgba(255,255,255,0.22)] transition-transform duration-150 ease-out active:scale-[0.975] active:bg-accent-600 ${className}`}
    >
      <span className="text-[0.88rem] leading-none font-bold tracking-[-0.005em]">
        {children}
      </span>
      {/* Ikon dari aset yang dilampirkan (Sun 2-2.png, 96×96 putih).
          Dirender sebagai gambar, bukan SVG, karena sumbernya PNG.
          Ukuran tampil 1.05rem agar layout tombol tidak bergeser; pada
          DPR 3 sisa resolusi aset masih jauh lebih dari cukup, jadi tidak
          perlu image-rendering: pixelated. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/icon-sun.png"
        alt=""
        aria-hidden="true"
        width={96}
        height={96}
        className="size-[1.05rem] shrink-0"
      />
    </a>
  );
}
