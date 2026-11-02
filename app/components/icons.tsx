type IconProps = React.SVGProps<SVGSVGElement>;

/**
 * Emblem Nabawi: kubah + menara masjid dalam lingkaran.
 * Placeholder logo — ganti dengan file logo asli kapan saja.
 */
export function LogoNabawi({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Logo Nabawi Cafe and Resto"
      className={className}
      {...props}
    >
      <circle cx="32" cy="32" r="31" fill="var(--color-cream-100)" />
      <circle cx="32" cy="32" r="31" fill="none" stroke="var(--color-clay-600)" strokeWidth="1.6" />
      <circle cx="32" cy="32" r="26" fill="var(--color-forest-900)" />

      {/* kubah utama */}
      <path
        d="M32 16.5c.9 3.2 4.6 4.6 4.6 8.4H27.4c0-3.8 3.7-5.2 4.6-8.4Z"
        fill="var(--color-cream-100)"
      />
      <path
        d="M25 25h14v3H25zM24 30h16v10.5H24z"
        fill="var(--color-cream-100)"
      />
      {/* pintu lengkung */}
      <path
        d="M29.4 40.5v-4.6a2.6 2.6 0 0 1 5.2 0v4.6z"
        fill="var(--color-forest-900)"
      />
      {/* menara kiri & kanan */}
      <path d="M18.6 22.4c.6 1.6 2 2.2 2 4.1h-4c0-1.9 1.4-2.5 2-4.1Z" fill="var(--color-cream-100)" />
      <path d="M16.6 26.5h4v14h-4z" fill="var(--color-cream-100)" />
      <path d="M45.4 22.4c.6 1.6 2 2.2 2 4.1h-4c0-1.9 1.4-2.5 2-4.1Z" fill="var(--color-cream-100)" />
      <path d="M43.4 26.5h4v14h-4z" fill="var(--color-cream-100)" />
      {/* garis tanah */}
      <path d="M14.5 42.5h35" stroke="var(--color-cream-100)" strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

/** Ikon kalender (gaya "Setiap Hari" di badge jam buka) */
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

/** Ikon masjid + sinar matahari di tombol utama */
export function SalatMark({ className, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className} {...props}>
      <path
        d="M14 6.2c.5 2.2 3.4 3.3 3.4 6.1H10.6c0-2.8 2.9-3.9 3.4-6.1Z"
        fill="currentColor"
      />
      <path d="M9.4 13.5h9.2v4.2H9.4z" fill="currentColor" />
      <path
        d="M12.6 17.7v-1.9a1.4 1.4 0 0 1 2.8 0v1.9z"
        fill="var(--color-clay-600)"
      />
      <path
        d="M7.2 21.4h13.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* sinar */}
      <path
        d="M14 2.4v1.7M4.6 7.1l1.2 1.2M23.4 7.1l-1.2 1.2M2.8 17.6l1.6.6M25.2 17.6l-1.6.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity=".85"
      />
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
