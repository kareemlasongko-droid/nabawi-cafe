/**
 * Ikon tambahan untuk portal dapur/pelayan.
 * Dipisah dari Ikon.tsx karena bentuknya lebih besar (dibaca dari jauh)
 * dan beberapa memakai isi penuh agar tetap terlihat di layar gelap.
 */

type P = { className?: string };

const garis = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function IkonBel({ className = "size-4" }: P) {
  return (
    <svg {...garis} className={className}>
      <path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IkonKanan({ className = "size-4" }: P) {
  return (
    <svg {...garis} className={className}>
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

export function IkonKembali({ className = "size-4" }: P) {
  return (
    <svg {...garis} className={className}>
      <path d="M19 12H6M11 6l-6 6 6 6" />
    </svg>
  );
}

/** Piring dengan tutup terangkat — penanda "siap diantar". */
export function IkonSegar({ className = "size-5" }: P) {
  return (
    <svg {...garis} className={className}>
      <path d="M4 16h16a8 8 0 0 0-16 0Z" />
      <path d="M2 19h20" />
      <path d="M12 8V4M9 6l3-2 3 2" />
    </svg>
  );
}

export function IkonCentang({ className = "size-4" }: P) {
  return (
    <svg {...garis} className={className}>
      <path d="m5 13 4 4 10-11" />
    </svg>
  );
}

export function IkonBill({ className = "size-5" }: P) {
  return (
    <svg {...garis} className={className}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

export function IkonMeja({ className = "size-4" }: P) {
  return (
    <svg {...garis} className={className}>
      <path d="M3 9h18M6 9v11M18 9v11M9 4h6l1.5 5h-9L9 4Z" />
    </svg>
  );
}
