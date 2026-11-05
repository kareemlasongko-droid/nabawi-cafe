import Image from "next/image";

/**
 * Tiga kartu menu halaman `/fitur` — versi ramping TANPA gambar latar.
 *
 * Setiap kartu punya warna sendiri. Warna dipilih dari palet situs lalu
 * diuji kontrasnya (WCAG), bukan dikira-kira:
 *
 *   kartu                 latar          teks        kontras teks
 *   Virtual Tour 360      #1b3325 hijau  cream-50    13.35 : 1
 *   Menu Kami             #b4502c terra  cream-50     5.01 : 1
 *   Galeri & Aktivitas    #e8d3ae krem   ink-900      9.63 : 1
 *
 * Ketiganya lolos ambang 4.5:1 untuk teks kecil. Dua kartu gelap memakai
 * ikon versi terang (kotak krem, glyph navy) karena ikon navy asli hanya
 * punya kontras 1.04:1 di atas hijau tua — praktis tak terlihat. Kartu
 * krem tetap memakai ikon navy asli (9.63:1).
 *
 * Ikon tetap berasal dari lampiran pemilik: versi terang dibuat dari file
 * yang sama dengan memetakan ulang dua warnanya, bukan digambar ulang.
 *
 * Tanpa gambar berarti tidak ada foto yang perlu menutupi tinggi kartu,
 * jadi tinggi kartu murni mengikuti isi.
 *
 * LAYAR PENUH (tanpa scroll): halaman ini dipaksa muat dalam satu layar,
 * jadi tiga kartu harus berbagi sisa tinggi yang tersedia. Caranya:
 *   - daftar memakai `h-full` + `flex-1` sehingga mengambil semua sisa
 *     ruang, dan tiap kartu `flex-1` membagi rata (tinggi bertambah
 *     proporsional di layar tinggi, tidak ada ruang menganggur)
 *   - `flex-1 basis-0` + `max-h-[10rem]` (160px) pada tiap item: kartu
 *     membesar mengisi layar sampai 160px, yaitu sedikit di atas tinggi
 *     isinya (125px), lalu berhenti. Tanpa batas, di 440x956 kartu melar
 *     sampai 251px sehingga 130px menganga di dalam kartu; dengan batas
 *     ini sisa ruang dibiarkan di bawah kartu agar ilustrasi latar tetap
 *     terlihat (halaman ini memang berlatarkan ilustrasi penuh).
 *   - kartu memakai `justify-between`: ikon menempel atas, judul dan
 *     deskripsi menempel bawah, meniru kartu desain.
 * SKALA RESPONSIF (permintaan: di HP diperkecil, di tablet penuh):
 *   < 768px   ikon 34px, judul 16px, deskripsi 11px, radius 20,
 *             padding 12/16/14, tinggi kartu 120-144px
 *   >= 768px  ikon 40px, judul 17px, deskripsi 11.5px, radius 24,
 *             padding 14/20/16, tinggi kartu 134-160px
 *
 *   - `min-h-[8.375rem]` (134px) = tinggi isi terukur saat teks paling
 *     panjang. Tanpa ini, menambah kartu ke-4 dan seterusnya membuat
 *     kartu menyusut sampai 71px dan teksnya terpotong tanpa terlihat
 *     (diuji). Dengan batas ini kartu jujur memanjang; halaman memang
 *     lalu bisa digulir, tapi itu lebih baik daripada isi hilang.
 *     Layar 320x568 menyisakan 122px/kartu — di bawah 134px — sehingga
 *     di ukuran itu kartu memanjang sedikit dan halaman bisa digulir.
 *   - isi kartu dipadatkan: ikon 52 -> 40px, judul 18 -> 17px, padding
 *     20 -> 14px, subjudul turun ke 11.5px.
 */

type MenuCard = {
  icon: string;
  iconAlt: string;
  title: string;
  description: string;
  badge: string;
  /** Kelas latar kartu. */
  surface: string;
  /** Kelas warna judul + deskripsi. */
  text: string;
  /** Kelas latar + warna teks badge. */
  badgeClass: string;
};

const CARDS: MenuCard[] = [
  {
    icon: "/images/menu/icon-virtual-tour-light.png",
    iconAlt: "Ikon panorama 360 derajat",
    title: "Virtual Tour 360",
    description: "Jelajahi suasana kafe secara virtual dari mana saja",
    badge: "360°",
    surface: "bg-forest-900",
    text: "text-cream-50",
    badgeClass: "bg-cream-50/20 text-cream-50",
  },
  {
    icon: "/images/menu/icon-menu-kami-light.png",
    iconAlt: "Ikon empat kotak menu",
    title: "Menu Kami",
    description:
      "Temukan hidangan autentik khas Maroko dan pilihan kopi terbaik",
    badge: "Terbaru",
    surface: "bg-clay-600",
    text: "text-cream-50",
    badgeClass: "bg-cream-50/20 text-cream-50",
  },
  {
    icon: "/images/menu/icon-galeri-aktivitas.png",
    iconAlt: "Ikon kamera galeri",
    title: "Galeri & Aktivitas",
    description: "Lihat momen seru dan aktivitas seru di Nabawi Cafe",
    badge: "Galeri",
    surface: "bg-cream-300",
    text: "text-ink-900",
    badgeClass: "bg-ink-900/12 text-ink-900",
  },
];

export function MenuCards() {
  return (
    <ul
      className="flex h-full flex-col gap-[0.625rem] tablet:gap-[0.75rem]"
    >
      {CARDS.map((card, i) => (
        <li
          key={card.title}
          /* `card-enter` menjalankan animasi muncul; --card-delay membuat
             kartu berikutnya menyusul, jadi muncul satu per satu tanpa JS. */
          className="card-enter flex max-h-[9rem] min-h-[7.5rem] flex-1 basis-0 flex-col tablet:max-h-[10rem] tablet:min-h-[8.375rem]"
          style={{ "--card-delay": `${i * 140}ms` } as React.CSSProperties}
        >
          <article
            className={`flex h-full min-h-0 flex-col justify-between gap-[0.375rem] rounded-[1.25rem] p-[0.75rem_1rem_0.875rem] shadow-[0_14px_28px_-14px_rgba(20,35,26,0.55),0_3px_10px_-5px_rgba(20,35,26,0.35)] tablet:gap-[0.5rem] tablet:rounded-[1.5rem] tablet:p-[0.875rem_1.25rem_1rem] ${card.surface}`}
          >
            {/* baris atas: ikon kiri, penanda kanan */}
            <div className="flex items-start justify-between">
              <Image
                src={card.icon}
                alt={card.iconAlt}
                width={40}
                height={40}
                priority
                className="size-[2.125rem] shrink-0 tablet:size-[2.5rem]"
              />
              <span
                className={`rounded-full px-[0.6rem] py-[0.24rem] text-[0.625rem] leading-none font-bold whitespace-nowrap tablet:px-[0.7rem] tablet:py-[0.28rem] tablet:text-[0.6875rem] ${card.badgeClass}`}
              >
                {card.badge}
              </span>
            </div>

            <div>
              <h2
                className={`text-[1rem] leading-[1.15] font-extrabold tracking-[-0.01em] tablet:text-[1.0625rem] ${card.text}`}
              >
                {card.title}
              </h2>
              <p
                className={`mt-[0.15rem] text-[0.6875rem] leading-[1.45] opacity-90 tablet:mt-[0.2rem] tablet:max-w-[17.5rem] tablet:text-[0.71875rem] ${card.text}`}
              >
                {card.description}
              </p>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
