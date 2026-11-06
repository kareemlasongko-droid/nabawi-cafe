/**
 * Tombol kembali yang berdiri sendiri — SENGAJA tidak di dalam navbar
 * (diminta). Navbar kembali seperti mockup: logo, judul, ikon grid.
 *
 * Dua varian:
 *   - "pill"   : tombol kecil membulat, dipakai di kepala halaman /tour
 *                (di atas judul) dan di kepala halaman detail.
 *   - "sticky" : menempel di kiri-atas saat halaman digulir, dipakai di
 *                halaman detail. Varian ini yang menggantikan fungsi back
 *                di navbar, tapi secara visual ia melayang di area konten,
 *                bukan menempel di bilah putih navbar.
 *
 * Memakai <a href> biasa (bukan next/link) supaya navigasi tetap jalan
 * walau bundle JS gagal dimuat di perangkat lama — sama seperti tautan lain
 * di situs ini.
 */

type Props = {
  href: string;
  /** Teks yang terlihat, mis. "Kembali" */
  label: string;
  /** Untuk aria-label, mis. "Kembali ke daftar Virtual Tour" */
  aria: string;
  varian?: "pill" | "sticky";
};

export function BackLink({ href, label, aria, varian = "pill" }: Props) {
  if (varian === "sticky") {
    return (
      <a
        href={href}
        aria-label={aria}
        /* sticky (bukan fixed) supaya tetap terkurung di kanvas 440px dan
           tidak ikut melayang ke area gelap di kiri-kanan layar tablet.

           Jarak tempelnya HARUS sepadan tinggi navbar, bukan 8px: navbar
           sticky setinggi 64px + padding 8px = 72px (4.625rem + 12px = 86px
           di tablet). Dengan top-[0.5rem] tombolnya berhenti di 8px dan
           TERTUTUP di belakang navbar — terukur lewat elementFromPoint:
           yang kena IMG panorama, bukan tombolnya. z-20 tetap di bawah
           header (z-30) supaya tidak pernah menutupi navbar. */
        className="sticky top-[calc(max(0.5rem,env(safe-area-inset-top))+4rem+0.5rem)] tablet:top-[calc(max(0.75rem,env(safe-area-inset-top))+4.625rem+0.5rem)] z-20 mx-5 mb-[0.5rem] inline-flex w-fit items-center gap-[0.375rem] rounded-full border border-white/20 bg-forest-950/80 py-[0.3125rem] pr-[0.625rem] pl-[0.4375rem] text-[0.625rem] font-bold text-cream-100 backdrop-blur-[6px] transition active:scale-95"
      >
        <svg viewBox="0 0 16 16" className="size-3" aria-hidden="true">
          <path
            d="M10 3.5 5.5 8 10 12.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {label}
      </a>
    );
  }

  return (
    <a
      href={href}
      aria-label={aria}
      className="inline-flex items-center gap-[0.3125rem] rounded-full border border-white/20 px-[0.625rem] py-[0.3125rem] text-[0.625rem] font-bold text-cream-100/85 transition active:scale-95"
    >
      <svg viewBox="0 0 16 16" className="size-3" aria-hidden="true">
        <path
          d="M10 3.5 5.5 8 10 12.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </a>
  );
}
