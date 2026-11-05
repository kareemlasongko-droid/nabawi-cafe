import Image from "next/image";

/**
 * Tiga kartu menu halaman `/fitur`.
 *
 * Gambar kartu (foto + overlay oranye + judul + subjudul + ikon + badge)
 * dipakai APA ADANYA dari lampiran pemilik: ketiganya sudah berupa kartu
 * jadi berukuran 400×210. Membangun ulang dengan HTML akan berisiko
 * berbeda dari desain, jadi yang ditambahkan di sini hanya:
 *   - sudut membulat (terukur ≈25px pada lebar 400 → 28px di kanvas 440)
 *   - bayangan (diminta)
 *   - animasi muncul satu per satu saat halaman dibuka (diminta)
 *   - teks alternatif yang menyebut judul + subjudul, karena teks di
 *     dalam gambar tidak terbaca pembaca layar kalau hanya alt="kartu".
 *
 * Tanpa JavaScript: animasi CSS berjalan sendiri begitu halaman dimuat,
 * jadi kartu tetap muncul (tidak "kosong" seperti animasi berbasis React).
 * `prefers-reduced-motion` dihormati lewat aturan global yang sudah ada.
 */

type MenuCard = {
  src: string;
  /** Judul yang tertulis di gambar — dipakai untuk alt. */
  title: string;
  /** Penjelasan yang tertulis di gambar — dipakai untuk alt. */
  description: string;
};

const CARDS: MenuCard[] = [
  {
    src: "/images/card-virtual-tour.png",
    title: "Virtual Tour 360",
    description: "Jelajahi suasana kafe secara virtual dari mana saja",
  },
  {
    src: "/images/card-menu-kami.png",
    title: "Menu Kami",
    description:
      "Temukan hidangan autentik khas Maroko dan pilihan kopi terbaik",
  },
  {
    src: "/images/card-galeri-aktivitas.png",
    title: "Galeri & Aktivitas",
    description: "Lihat momen seru dan aktivitas seru di Nabawi Cafe",
  },
];

export function MenuCards() {
  return (
    <ul className="flex flex-col gap-[0.875rem]">
      {CARDS.map((card, i) => (
        <li
          key={card.src}
          /* `card-enter` menjalankan animasi muncul; --card-delay membuat
             kartu kedua dan ketiga menyusul, jadi munculnya satu per satu
             (staggered) tanpa perlu JavaScript. */
          className="card-enter"
          style={{ "--card-delay": `${i * 140}ms` } as React.CSSProperties}
        >
          <Image
            src={card.src}
            alt={`${card.title}. ${card.description}`}
            width={400}
            height={210}
            sizes="(max-width: 440px) calc(100vw - 2.5rem), 400px"
            /* prioritas: ketiganya ada di layar pertama halaman ini */
            priority
            className="h-auto w-full rounded-[1.75rem] shadow-[0_16px_32px_-14px_rgba(20,35,26,0.65),0_4px_12px_-6px_rgba(20,35,26,0.45)]"
          />
        </li>
      ))}
    </ul>
  );
}
