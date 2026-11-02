"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ArrowLeft } from "./icons";

type WelcomePanelProps = {
  onClose: () => void;
};

export function WelcomePanel({ onClose }: WelcomePanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-forest-950/55 backdrop-blur-[3px] animate-fade"
      onClick={onClose}
    >
      <div className="flex w-full max-w-[26.875rem] items-end px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-title"
          onClick={(event) => event.stopPropagation()}
          className="animate-rise w-full rounded-[1.75rem] bg-cream-50 p-[1.4rem] shadow-[0_-10px_60px_-20px_rgba(20,35,26,0.65)]"
        >
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo-nabawi.png"
              alt="Logo Nabawi Cafe and Resto"
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

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-[0.7rem] border border-cream-300 bg-cream-100 py-[0.7rem] text-[0.85rem] font-bold text-ink-900 transition-colors duration-150 active:bg-cream-200"
          >
            <ArrowLeft className="size-[1.05rem]" />
            Kembali
          </button>
        </div>
      </div>
    </div>
  );
}
