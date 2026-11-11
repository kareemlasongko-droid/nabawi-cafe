/**
 * Tombol untuk kepala portal order (bar kanan navbar).
 *
 * KENAPA ADA KOMPONEN SENDIRI, PADAHAL TINGGAL SATU BARIS CLASSNAME
 * Kepala portal harus muat satu baris di ponsel 360px sekaligus tetap
 * terbaca di tablet. Dua aturan itu bertabrakan: label seperti "Muat ulang"
 * (70px) tidak mungkin muat bersamaan dengan identitas kafe. Solusinya
 * bukan mengecilkan semua tombol, tapi menyembunyikan LABEL di ponsel dan
 * menyisakan ikon — dengan `aria-label` supaya pembaca layar tetap
 * mengumumkan nama tombolnya. Pola itu ditulis sekali di sini.
 *
 * Ukuran sentuh tetap 40px (h-10) di semua lebar: ibu jari tidak tahu
 * apakah layarnya ponsel atau tablet.
 */
import type { ReactNode } from "react";

export function TombolKepala({
  onClick,
  ikon,
  label,
  aktif = false,
  tema = "terang",
  judul,
  expanded,
  className = "",
  hanyaIkon = false,
  children,
}: {
  onClick: () => void;
  ikon?: ReactNode;
  /** Teks tombol. Disembunyikan di bawah 640px bila `ikon` tersedia. */
  label: string;
  /** Gaya tertekan/aktif (mis. tombol bunyi sedang menyala). */
  aktif?: boolean;
  tema?: "terang" | "gelap";
  /** Tooltip + aria-label. Default: `label`. */
  judul?: string;
  expanded?: boolean;
  className?: string;
  /**
   * Sembunyikan label di SEMUA lebar, bukan hanya di ponsel.
   * Dipakai tombol bunyi di kepala pelayan: ia satu-satunya tombol di sana,
   * jadi label tidak perlu disembunyikan karena sempit — ia disembunyikan
   * karena tombol 40px berikon lebih jelas daripada tombol 100px berlabel
   * "Bunyi" yang tidak menambah arti. Nama untuk pembaca layar tetap dari
   * `judul`.
   */
  hanyaIkon?: boolean;
  /** Isi tambahan setelah label, mis. angka jumlah menu habis. */
  children?: ReactNode;
}) {
  const gelap = tema === "gelap";

  const dasar = gelap
    ? aktif
      ? "border-forest-700 bg-daun-100 text-tinta-900"
      : "border-tinta-700 text-gelap-samar"
    : aktif
      ? "border-forest-700/40 bg-daun-100 text-forest-700"
      : "border-bersih-200 bg-bersih-100 text-tinta-500";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={judul ?? label}
      aria-expanded={expanded}
      title={judul ?? label}
      className={[
        "flex h-10 shrink-0 items-center gap-1.5 rounded-[0.625rem] border px-2 text-[0.8125rem] font-bold sm:px-3",
        dasar,
        className,
      ].join(" ")}
    >
      {ikon}
      {/*
        `hidden sm:inline` pada label, bukan pada seluruh tombol: ikon harus
        tetap terlihat di ponsel. Kalau tidak ada ikon (mis. tab "Menu" di
        admin), label dibiarkan tampil — tombol tanpa isi tidak bisa ditekan
        dengan yakin.
      */}
      {hanyaIkon ? null : (
        <span className={ikon ? "hidden sm:inline" : undefined}>{label}</span>
      )}
      {children}
    </button>
  );
}
