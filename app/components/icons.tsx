type IconProps = React.SVGProps<SVGSVGElement>;

/**
 * Ikon kalender (gaya "Setiap Hari" di badge jam buka)
 */
export function CalendarCheck({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className} {...props}>
      <rect x="3" y="4.6" width="18" height="16.4" rx="3.6" fill="currentColor" />
      <path d="M3 9.7h18" stroke="var(--color-mint-100)" strokeWidth="1.7" />
      <path
        d="M7.9 2.8v3.4M16.1 2.8v3.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* titik-titik tanggal */}
      <circle cx="7.7" cy="13.5" r="1.15" fill="var(--color-mint-100)" />
      <circle cx="12" cy="13.5" r="1.15" fill="var(--color-mint-100)" />
      <circle cx="16.3" cy="13.5" r="1.15" fill="var(--color-mint-100)" />
      <circle cx="7.7" cy="17.3" r="1.15" fill="var(--color-mint-100)" />
      <circle cx="12" cy="17.3" r="1.15" fill="var(--color-mint-100)" />
      <circle cx="16.3" cy="17.3" r="1.15" fill="var(--color-mint-100)" />
    </svg>
  );
}

/**
 * KANDIDAT A — Es kopi susu dalam gelas bening + sedotan.
 * Paling harfiah menggambarkan "cob" (cold brew / coffee on the beach).
 */
export function CoffeeCup({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className} {...props}>
      {/* sedotan */}
      <path
        d="M14.1 3.2 12.4 8.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity=".9"
      />
      {/* gelas: es batu + kopi susu */}
      <path
        d="M6.4 7.6h11.2L16.2 20a1.6 1.6 0 0 1-1.6 1.4H9.4A1.6 1.6 0 0 1 7.8 20L6.4 7.6Z"
        fill="currentColor"
        opacity=".28"
      />
      <path
        d="M6.4 7.6h11.2L16.2 20a1.6 1.6 0 0 1-1.6 1.4H9.4A1.6 1.6 0 0 1 7.8 20L6.4 7.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {/* permukaan kopi */}
      <path d="M7.2 12.4h9.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {/* es batu */}
      <rect x="9.1" y="14.3" width="2.3" height="2.3" rx=".55" stroke="currentColor" strokeWidth="1.2" />
      <rect x="12.5" y="15.6" width="2.1" height="2.1" rx=".5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/**
 * KANDIDAT B — Cangkir kopi panas dengan gumpalan uap.
 * Metafora "kopi" yang paling langsung dikenali.
 */
export function CoffeeSteam({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className} {...props}>
      {/* uap */}
      <path
        d="M9 3.2c-1.1 1.5.9 2.3-.2 3.9M13 2.6c-1.1 1.5.9 2.3-.2 3.9M16.8 3.4c-.9 1.2.7 1.9-.2 3.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity=".85"
      />
      {/* badan cangkir */}
      <path
        d="M4.6 9.4h12.2v5.2a4.6 4.6 0 0 1-4.6 4.6H9.2a4.6 4.6 0 0 1-4.6-4.6V9.4Z"
        fill="currentColor"
        opacity=".28"
      />
      <path
        d="M4.6 9.4h12.2v5.2a4.6 4.6 0 0 1-4.6 4.6H9.2a4.6 4.6 0 0 1-4.6-4.6V9.4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {/* pegangan */}
      <path
        d="M16.8 11h1.1a2.9 2.9 0 0 1 0 5.8h-1.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* tatakan */}
      <path d="M3.6 21.1h14.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Panah kecil untuk tombol "Kembali" */
export function ArrowLeft({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className} {...props}>
      <path
        d="M14.5 6.5 9 12l5.5 5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
