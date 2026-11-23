/**
 * Ikon garis untuk /menu — satu per kategori.
 *
 * Kenapa bukan emoji, bukan ilustrasi, bukan gradient blob:
 * seluruh ikon di situs ini memakai satu bahasa — bidang 24, stroke
 * 1.6px, ujung dan sambungan membulat, `currentColor`. Satu-satunya hal
 * yang lebih buruk daripada tanpa ikon adalah ikon yang gaya bahasanya
 * berbeda dari ikon di sebelahnya.
 *
 * KENAPA SATU IKON PER KATEGORI, BUKAN PER MENU
 * Memetakan 126 nama menu satu per satu ("Ayam Bakar" dapat apa?) adalah
 * tebakan yang cepat salah dan cepat basi saat pemilik menambah menu.
 * Kategori adalah sumbu yang stabil.
 *
 * SEMUA IKON DI SINI SUDAH DILIHAT DALAM UKURAN 32px, bukan 24px di
 * vector editor. Percobaan pertama (sendok-garpu menyilang) terbaca
 * sebagai huruf "Y" dan balon; percobaan kedua (piring + garpu) terlalu
 * ramai dan berubah jadi gelang. Yang tersisa lolos karena bentuknya
 * tetap dikenali saat kecil. Kalau ada ikon baru: render dulu di 32px,
 * jangan percaya pratinjau besar.
 */

type P = { className?: string };

const dasar = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Mangkuk beruap — hidangan hangat dari dapur. */
export function IkonMangkuk({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="M3.5 11.5h17" />
      <path d="M5.75 11.5a6.25 6.25 0 0 0 12.5 0" />
      <path d="M9.25 8c-1.1-1.3 1.1-2.5 0-3.8" />
      <path d="M14.25 8c-1.1-1.3 1.1-2.5 0-3.8" />
    </svg>
  );
}

/** Biskuit dengan empat lubang — camilan dan pastry. */
export function IkonBiskuit({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="9.5" cy="9.5" r="0.9" />
      <circle cx="14.5" cy="9.5" r="0.9" />
      <circle cx="9.5" cy="14.5" r="0.9" />
      <circle cx="14.5" cy="14.5" r="0.9" />
    </svg>
  );
}

/** Cangkir bercorong — kopi. */
export function IkonCangkir({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="M4 7.5h11v6.25A4.25 4.25 0 0 1 10.75 18h-2.5A4.25 4.25 0 0 1 4 13.75z" />
      <path d="M15 9.75h1.25a2.5 2.5 0 0 1 0 5H15" />
      <path d="M3 21h13" />
    </svg>
  );
}

/** Gelas tinggi dengan sedotan — minuman dingin tanpa susu. */
export function IkonGelas({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="M5 5.5h14l-1.6 14a2 2 0 0 1-2 1.8H8.6a2 2 0 0 1-2-1.8z" />
      <path d="M15.5 2.5 18 5.5" />
    </svg>
  );
}

/** Gelas dengan krim di atas dan sedotan — milkshake. */
export function IkonMilkshake({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="M5.75 11.5h12.5l-1.3 8.2a2 2 0 0 1-2 1.8H9a2 2 0 0 1-2-1.8z" />
      <path d="M5.5 11.5a6.5 6.5 0 0 1 13 0" />
      <path d="M15 9 17.5 3.5" />
    </svg>
  );
}

/** Es krim di atas kerucut — dessert. */
export function IkonEsKrim({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="M8.1 11.6h7.8" />
      <circle cx="12" cy="7.6" r="4" />
      <path d="M8.1 11.6 12 21.5l3.9-9.9" />
    </svg>
  );
}
