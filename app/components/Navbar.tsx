import Image from "next/image";

/**
 * Navbar halaman menu — dibuat dari mockup `Frame 1058235018.png` (400×74).
 *
 * Angka di bawah adalah hasil pengukuran piksel gambar itu, bukan perkiraan:
 *   bentuk    bilah penuh selebar kanvas, tinggi 74, sudut membulat ~28
 *   latar     putih dengan alpha 204/255 = 80%, tanpa bayangan
 *   logo      lingkaran 53×53, mulai x=14, terpusat vertikal (y 11–63)
 *   judul     "Nabawi Cafe & Resto" 18px / 800, warna #30294d
 *             (Plus Jakarta Sans 18px/800 = 185.2px, mockup 186px)
 *   ikon      grid 2×2, empat kotak 6×6 berjarak 4px = 16×16,
 *             di x350–365 (≈35px dari tepi kanan), warna sama dengan judul
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

export function Navbar() {
  return (
    <header className="relative z-20 px-5 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <nav
        aria-label="Navigasi utama"
        className="flex h-[4.625rem] items-center rounded-[1.75rem] bg-white/80 pl-[0.875rem] pr-[2.1875rem] backdrop-blur-md"
      >
        {/* logo + nama resto — satu tautan pulang ke beranda */}
        <a href="/" className="flex min-w-0 items-center gap-[1.6875rem]">
          <Image
            src="/images/logo-nabawi.png"
            alt="Logo Nabawi Cafe & Resto"
            width={100}
            height={100}
            priority
            className="size-[3.3125rem] shrink-0 rounded-full"
          />
          <span className="truncate text-[1.125rem] leading-none font-extrabold text-ink-900">
            Nabawi Cafe &amp; Resto
          </span>
        </a>

        {/* ikon grid di mockup belum punya tujuan, jadi untuk sementara
            ditampilkan sebagai penanda visual, bukan tombol mati */}
        <span aria-hidden="true" className="ml-auto grid size-4 place-items-center text-ink-900">
          <GridIcon className="size-4" />
        </span>
      </nav>
    </header>
  );
}
