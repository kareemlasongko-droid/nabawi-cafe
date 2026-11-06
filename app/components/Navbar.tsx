import Image from "next/image";

/**
 * Navbar halaman menu — dibuat dari mockup `Frame 1058235018.png` (400×74).
 *
 * Angka di bawah adalah hasil pengukuran piksel gambar itu, bukan perkiraan:
 *   bentuk    bilah penuh selebar kanvas, tinggi 74, sudut membulat ~28
 *   latar     putih dengan alpha 204/255 = 80%, rata, tanpa bayangan
 *             (sempat saya beri backdrop-blur; itu menambah kabut di atas
 *             80% sehingga bilah terlihat lebih pekat dari mockup, dan
 *             mockup sendiri tidak ber-blur — jadi blur dihapus)
 *   logo      lingkaran 53×53, mulai x=14, terpusat vertikal (y 11–63)
 *   judul     "Nabawi Cafe & Resto" 18px / 800, warna #30294d
 *             (Plus Jakarta Sans 18px/800 = 185.2px, mockup 186px)
 *   ikon      grid 2×2, empat kotak 6×6 berjarak 4px = 16×16,
 *             di x350–365 (≈35px dari tepi kanan), warna sama dengan judul
 *
 * SKALA RESPONSIF (permintaan: di HP diperkecil, di tablet penuh):
 *   < 768px  bilah 64px, logo 44px, judul 16px, ikon 14px
 *   >= 768px  bilah 74px, logo 53px, judul 18px, ikon 16px — yaitu ukuran
 *             asli hasil pengukuran mockup 400x74, dipakai lagi di tablet.
 *
 * Keempat sudut bilah membulat (baris paling atas pun sudah masuk 22px dari
 * tepi), jadi ini bilah melayang, bukan header yang menempel penuh. Mockup
 * 400px di kanvas 440px = sisa 40px, maka jarak kiri/kanan 20px. Ukuran di
 * atas dipakai apa adanya supaya teks tetap nyaman dibaca dan konsisten
 * dengan halaman lain, bukan diperbesar 10% mengikuti selisih kanvas.
 *
 * Tanpa JavaScript: logo + judul adalah <a href="/"> biasa, jadi navigasi
 * tetap jalan di Safari iOS 15 (iPhone 7) yang gagal memuat bundle.
 */

/** Ikon grid 2×2: empat kotak 6×6 dengan sela 4px (total 16×16). */
function GridIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
      <rect width="6" height="6" fill="currentColor" />
      <rect x="10" width="6" height="6" fill="currentColor" />
      <rect y="10" width="6" height="6" fill="currentColor" />
      <rect x="10" y="10" width="6" height="6" fill="currentColor" />
    </svg>
  );
}

type NavbarProps = {
  /**
   * Kalau diisi, navbar menampilkan tombol kembali di kanan (menggantikan
   * ikon grid dekoratif). `label` dipakai untuk aria-label dan sebagai
   * teks pendek di samping panah pada layar >= 380px.
   */
  back?: { href: string; label: string };
  /**
   * Menempel di atas saat halaman digulir. Hanya dipakai di halaman yang
   * memang bisa digulir (/tour dan /tour/[slug]); /fitur sengaja dibiarkan
   * statis karena isinya dipaksa muat satu layar tanpa gulir.
   */
  sticky?: boolean;
  /** Gradasi gelap di belakang navbar supaya konten yang lewat di
   *  belakangnya tidak bertabrakan dengan bilah putih. */
  gradient?: boolean;
};

/**
 * Gradasi di belakang navbar dibuat sebagai ::before pada <header>, BUKAN
 * elemen <div> terpisah. Dua percobaan dengan <div> gagal, penyebabnya
 * terukur:
 *
 *   1. `-z-10` + header yang tidak membentuk stacking context -> gradasi
 *      naik ke ATAS bilah putih 80%, bilah jadi hijau gelap
 *      rgb(27,51,37) padahal seharusnya ~rgb(222,230,231).
 *   2. `z-index:-1` pada elemen absolute -> justru melukis di atas bilah
 *      DAN bergeser ke luar layar, sehingga saat digulir navbar terlihat
 *      HILANG sama sekali.
 *
 * Dengan ::before hasilnya benar, TAPI ada satu syarat yang mudah
 * terlewat dan sempat bikin bug ketiga: <nav> WAJIB `relative`.
 * Tanpa position, nav adalah elemen in-flow biasa yang dilukis SEBELUM
 * ::before (yang berposisi absolute), sehingga gradasi menutupi bilah.
 * Terukur: warna dalam bilah rgb(31,43,37) — seharusnya ~rgb(222,230,231).
 * Dengan `relative` pada nav, keduanya berada di lapisan yang sama dan
 * nav menang karena datang belakangan di urutan DOM.
 */
export function Navbar({ back, sticky, gradient }: NavbarProps = {}) {
  return (
    <header
      className={[
        sticky ? "sticky top-0 z-30" : "relative z-20",
        "px-4 pt-[max(0.5rem,env(safe-area-inset-top))] tablet:px-5 tablet:pt-[max(0.75rem,env(safe-area-inset-top))]",
        gradient
          ? "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[calc(100%+1.125rem)] before:bg-[linear-gradient(to_bottom,#14231a_0%,rgba(20,35,26,0.85)_55%,rgba(20,35,26,0)_100%)] before:content-['']"
          : "",
      ].join(" ")}
    >
      <nav
        aria-label="Navigasi utama"
        className="relative flex h-[4rem] items-center rounded-[1.5rem] bg-white/80 pl-[0.75rem] pr-[1.5rem] tablet:h-[4.625rem] tablet:rounded-[1.75rem] tablet:pl-[0.875rem] tablet:pr-[2.1875rem]"
      >
        {/* logo + nama resto — satu tautan pulang ke beranda. Jarak sengaja
            rapat (8px di HP, 14px di tablet) supaya logo dan nama terbaca
            sebagai satu kesatuan; sebelumnya 16px/27px terasa terpisah. */}
        <a href="/" className="flex min-w-0 items-center gap-[0.5rem] tablet:gap-[0.875rem]">
          <Image
            src="/images/logo-nabawi.png"
            alt="Logo Nabawi Cafe & Resto"
            width={100}
            height={100}
            priority
            className="size-[2.75rem] shrink-0 rounded-full tablet:size-[3.3125rem]"
          />
          <span className="truncate text-[1rem] leading-none font-extrabold text-ink-900 tablet:text-[1.125rem]">
            Nabawi Cafe &amp; Resto
          </span>
        </a>

        {back ? (
          /* Tombol kembali. Menggantikan ikon grid dekoratif supaya slot
             kanan navbar tidak lagi jadi elemen mati. Ukuran sentuh 32px
             dan teks labelnya disembunyikan di bawah 380px karena di
             320px ruangnya tidak cukup (lebar tersedia 280px, sedangkan
             logo+judul sudah 217px). */
          <a
            href={back.href}
            aria-label={`Kembali ke ${back.label}`}
            className="ml-auto flex shrink-0 items-center gap-[0.25rem] rounded-full bg-ink-900/[0.07] py-[0.3125rem] pr-[0.3125rem] pl-[0.3125rem] text-ink-900 transition active:scale-95 min-[380px]:pr-[0.5rem]"
          >
            <span className="grid size-[1.375rem] place-items-center">
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                <path
                  d="M10 3.5 5.5 8 10 12.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="hidden text-[0.625rem] leading-none font-bold min-[380px]:inline">
              {back.label}
            </span>
          </a>
        ) : (
          /* ikon grid di mockup belum punya tujuan, jadi untuk sementara
             ditampilkan sebagai penanda visual, bukan tombol mati */
          <span
            aria-hidden="true"
            className="ml-auto grid size-[0.875rem] place-items-center text-ink-900 tablet:size-4"
          >
            <GridIcon className="size-[0.875rem] tablet:size-4" />
          </span>
        )}
      </nav>
    </header>
  );
}
