"use client";

import { CalendarCheck, LogoNabawi, SalatMark } from "./icons";

type HeroCardProps = {
  onStart: () => void;
};

export function HeroCard({ onStart }: HeroCardProps) {
  return (
    <div className="animate-rise speech-card mr-auto ml-[9%] w-[73%] max-w-[19.5rem] px-[1.1rem] pt-[1.05rem] pb-[1.25rem]">
      {/* identitas cafe */}
      <div className="flex items-start gap-[0.7rem]">
        <LogoNabawi className="mt-[0.1rem] size-[2.9rem] shrink-0" />
        <div className="min-w-0">
          <h1 className="text-[0.95rem] leading-[1.15] font-extrabold tracking-[-0.015em] text-ink-900">
            Nabawi Cafe and Resto
          </h1>
          <p className="mt-[0.3rem] text-[0.66rem] leading-[1.35] text-ink-700">
            Cafe and Resto berkonsep Maroko
            <br />
            Nature escape riverside view &amp; play
          </p>
        </div>
      </div>

      {/* jam buka */}
      <p
        className="mt-[0.8rem] flex w-fit items-center gap-[0.4rem] rounded-full bg-mint-100 py-[0.28rem] pr-[0.7rem] pl-[0.32rem] text-mint-700"
        aria-label="Buka setiap hari, pukul 09.00 sampai 21.00"
      >
        <CalendarCheck className="size-[1.15rem] text-mint-600" />
        <span className="font-mono text-[0.72rem] leading-none font-bold tracking-[0.01em]">
          09.00 – 21.00
        </span>
      </p>

      {/* tombol utama */}
      <button
        type="button"
        onClick={onStart}
        className="group mt-[0.9rem] flex w-full items-center justify-center gap-[0.5rem] rounded-[0.7rem] bg-clay-600 py-[0.9rem] pr-[0.9rem] pl-[1.05rem] text-cream-50 shadow-[0_10px_20px_-10px_rgba(122,51,22,0.9),inset_0_1px_0_rgba(255,255,255,0.18)] transition-transform duration-150 ease-out active:scale-[0.975] active:bg-clay-700"
      >
        <span className="text-[1.02rem] leading-none font-bold tracking-[0.005em]">
          Start Journey
        </span>
        <SalatMark className="size-[1.15rem] text-cream-100 transition-transform duration-300 ease-out group-hover:rotate-[-6deg]" />
      </button>

      {/* ekor kartu mengarah ke ilustrasi */}
      <span aria-hidden="true" className="speech-tail bottom-[-0.75rem] left-[38%]" />
    </div>
  );
}
