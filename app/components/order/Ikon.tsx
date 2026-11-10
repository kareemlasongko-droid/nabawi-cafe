/**
 * Ikon garis untuk portal order.
 *
 * Diminta: jangan pakai emoji sebagai ikon. Emoji juga bukan pilihan yang
 * baik secara teknis — bentuknya berbeda di tiap perangkat (Apple, Android,
 * Windows), tidak bisa diwarnai, danContohnya emoji cangkir bisa muncul
 * sebagai gambar berwarna yang menabrak palet. Semua ikon di sini SVG
 * dengan stroke currentColor, ukuran 1.5px, sudut membulat, dan aria-hidden
 * karena selalu berpasangan dengan teks.
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

export function IkonTambah({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IkonKurang({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function IkonHapus({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </svg>
  );
}

export function IkonCari({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

/**
 * Kaca pembesar dengan silang: tombol "bersihkan pencarian".
 *
 * Dibuat terpisah, bukan memakai IkonSilang, karena di dalam kolom isian
 * ukuran dan ketebalannya perlu lebih kecil — silang 16px terlihat seperti
 * tombol hapus seluruh halaman.
 */
export function IkonCariHapus({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <circle cx="10" cy="10" r="6" />
      <path d="m14.5 14.5 3.5 3.5M7.5 7.5l5 5M12.5 7.5l-5 5" />
    </svg>
  );
}

export function IkonKeranjang({ className = "size-5" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="M4 5h2l2.2 10.2a2 2 0 0 0 2 1.6h7.1a2 2 0 0 0 2-1.55L21 8H7" />
      <circle cx="10" cy="20" r="1.2" />
      <circle cx="18" cy="20" r="1.2" />
    </svg>
  );
}

export function IkonBel({ className = "size-5" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IkonBill({ className = "size-5" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

export function IkonCentang({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="m5 13 4 4 10-11" />
    </svg>
  );
}

export function IkonSilang({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IkonKiri({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="m14 6-6 6 6 6" />
    </svg>
  );
}

export function IkonKanan({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="m10 6 6 6-6 6" />
    </svg>
  );
}

export function IkonJam({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IkonMeja({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="M3 9h18M6 9v11M18 9v11M9 4h6l1.5 5h-9L9 4Z" />
    </svg>
  );
}

export function IkonPanah({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

export function IkonMatikanSuara({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
      <path d="m16 9 5 6M21 9l-5 6" />
    </svg>
  );
}

export function IkonSuara({ className = "size-4" }: P) {
  return (
    <svg {...dasar} className={className}>
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  );
}
