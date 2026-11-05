import Image from "next/image";

/**
 * Tiga kartu menu halaman `/fitur`.
 *
 * STRUKTUR — ikon dan teks adalah elemen HTML tersendiri, bukan bagian dari
 * gambar. Gambar hanya berfungsi sebagai LATAR kartu, sehingga:
 *   - teks bisa diganti tanpa membuka editor gambar
 *   - teks tetap terbaca mesin (SEO) dan pembaca layar
 *   - tinggi kartu mengikuti isi: kalau deskripsi jadi 3 baris atau ada
 *     penanda tambahan, kartu ikut memanjang. Tidak ada rasio tetap.
 *
 * Asal-usul gambar (semuanya dari lampiran pemilik):
 *   - icon-*.png  dipotong langsung dari lampiran, 52×52 (ukuran terukur)
 *   - bg-*.webp   lampiran yang sama setelah teks + ikon + badge dihapus,
 *                 dipotong ke sudut membulat 25×(800/400) px lalu
 *                 diperkecil ke 800×420 (2× lebar tampil) dan dijadikan WebP
 *                 (total 316 KB, dari 8 MB versi PNG).
 *
 * Teks sengaja DITULIS ulang di sini (judul + subjudul) dan ukurannya
 * dicocokkan dengan lampiran: judul tinggi glyph ~14-15px, subjudul 12px
 * (terukur 239.3px vs 239px pada baris terpanjang).
 *
 * Tanpa JavaScript: animasi CSS berjalan sendiri saat halaman dimuat, jadi
 * kartu tetap muncul. `prefers-reduced-motion` dihormati aturan global.
 */

type MenuCard = {
  /** Latar kartu tanpa teks/ikon. */
  bg: string;
  /** Ikon bulat navy, dipotong dari lampiran. */
  icon: string;
  iconAlt: string;
  title: string;
  description: string;
  /** Penanda kecil di kanan atas; tidak semua kartu punya. */
  badge?: string;
};

const CARDS: MenuCard[] = [
  {
    bg: "/images/menu/bg-virtual-tour.webp",
    icon: "/images/menu/icon-virtual-tour.png",
    iconAlt: "Ikon panorama 360 derajat",
    title: "Virtual Tour 360",
    description: "Jelajahi suasana kafe secara virtual dari mana saja",
    badge: "360°",
  },
  {
    bg: "/images/menu/bg-menu-kami.webp",
    icon: "/images/menu/icon-menu-kami.png",
    iconAlt: "Ikon empat kotak menu",
    title: "Menu Kami",
    description:
      "Temukan hidangan autentik khas Maroko dan pilihan kopi terbaik",
    badge: "Terbaru",
  },
  {
    bg: "/images/menu/bg-galeri-aktivitas.webp",
    icon: "/images/menu/icon-galeri-aktivitas.png",
    iconAlt: "Ikon kamera galeri",
    title: "Galeri & Aktivitas",
    description: "Lihat momen seru dan aktivitas seru di Nabawi Cafe",
    badge: "Galeri",
  },
];

export function MenuCards() {
  return (
    <ul className="flex flex-col gap-[0.875rem]">
      {CARDS.map((card, i) => (
        <li
          key={card.bg}
          /* `card-enter` menjalankan animasi muncul; --card-delay membuat
             kartu kedua dan ketiga menyusul, jadi munculnya satu per satu
             (staggered) tanpa perlu JavaScript. */
          className="card-enter"
          style={{ "--card-delay": `${i * 140}ms` } as React.CSSProperties}
        >
          <article className="relative isolate overflow-hidden rounded-[1.75rem] shadow-[0_16px_32px_-14px_rgba(20,35,26,0.65),0_4px_12px_-6px_rgba(20,35,26,0.45)]">
            {/* latar foto: menutupi seluruh kartu berapa pun tingginya.
                `sizes` 400px karena kartu tampil 400px di kanvas 440. */}
            <Image
              src={card.bg}
              alt=""
              aria-hidden="true"
              fill
              priority
              sizes="(max-width: 440px) calc(100vw - 2.5rem), 400px"
              className="object-cover object-center"
            />

            {/* isi kartu — teks & ikon di atas latar, bukan bagian gambar */}
            <div className="relative flex min-h-[13.125rem] flex-col justify-between gap-[1.5rem] p-[1.875rem_1.875rem_1.5rem]">
              {/* baris atas: ikon kiri, penanda kanan */}
              <div className="flex items-start justify-between">
                <Image
                  src={card.icon}
                  alt={card.iconAlt}
                  width={52}
                  height={52}
                  priority
                  className="size-[3.25rem] shrink-0"
                />
                {card.badge ? (
                  <span className="rounded-full bg-ink-900 px-[0.75rem] py-[0.3rem] text-[0.75rem] leading-none font-bold text-cream-50">
                    {card.badge}
                  </span>
                ) : null}
              </div>

              {/* judul + subjudul. margin-top otomatis mendorong teks ke
                  bawah seperti di mockup, tanpa mengunci tinggi kartu. */}
              <div className="mt-auto">
                <h2 className="text-[1.375rem] leading-[1.1] font-extrabold tracking-[-0.01em] text-cream-50">
                  {card.title}
                </h2>
                <p className="mt-[0.35rem] max-w-[17.5rem] text-[0.75rem] leading-[1.5] text-cream-50/95">
                  {card.description}
                </p>
              </div>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
