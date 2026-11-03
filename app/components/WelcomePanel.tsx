/**
 * Panel sambutan berbasis CSS murni.
 *
 * Mekanismenya: anchor #selamat-datang pada tombol "Mulai menjelajah" membuat
 * elemen ini cocok dengan selector :target, lalu panel tampil. Tombol tutup
 * mengarah ke #hero sehingga :target tidak lagi cocok.
 *
 * Tidak ada state React, tidak ada event handler — jadi tetap berfungsi
 * di browser yang gagal menjalankan JavaScript.
 */
export function WelcomePanel() {
  return (
    <div
      id="selamat-datang"
      className="fixed inset-0 z-50 flex justify-center bg-forest-950/55"
    >
      <a
        href="#hero"
        aria-label="Tutup panel sambutan"
        className="absolute inset-0 cursor-default"
      />

      {/* pointer-events-none membuat area gelap di luar kartu meneruskan tap ke
          tautan overlay di atas; kartu sendiri diaktifkan kembali. */}
      <div className="pointer-events-none relative flex w-full max-w-[26.875rem] items-end px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div
          role="dialog"
          aria-labelledby="welcome-title"
          className="pointer-events-auto animate-rise relative w-full rounded-[1.75rem] bg-cream-50 p-[1.4rem] shadow-[0_-10px_60px_-20px_rgba(20,35,26,0.65)]"
        >
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo-nabawi.png"
              alt="Logo Nabawi Cafe &amp; Resto"
              width={100}
              height={100}
              className="size-[2.9rem] shrink-0 rounded-full"
            />
            <div>
              <p className="font-mono text-[0.6rem] tracking-[0.18em] text-ink-500 uppercase">
                Selamat datang di
              </p>
              <h2
                id="welcome-title"
                className="mt-[0.2rem] text-[1.28rem] leading-[1.15] font-extrabold tracking-[-0.02em] text-ink-900"
              >
                Nabawi Cafe &amp; Resto
              </h2>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2.5 text-[0.72rem] text-ink-700">
            <span className="h-px flex-1 bg-cream-300" />
            <span className="font-mono tracking-[0.12em] text-mint-700">09.00 – 21.00</span>
            <span className="h-px flex-1 bg-cream-300" />
          </div>

          <p className="mt-4 text-[0.82rem] leading-[1.6] text-ink-700">
            Tempat paling pas buat melepas penat — suasana Maroko, pemandangan
            sungai, dan ruang bermain untuk keluarga.
          </p>

          <a
            href="#hero"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-[0.7rem] border border-cream-300 bg-cream-100 py-[0.7rem] text-[0.85rem] font-bold text-ink-900 transition-colors duration-150 active:bg-cream-200"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="size-[1.05rem]"
            >
              <path
                d="M14.5 6.5 9 12l5.5 5.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Kembali
          </a>
        </div>
      </div>
    </div>
  );
}
