"use client";

/**
 * Panel panorama 360° yang bisa digeser dengan jari / mouse.
 *
 * Ini BUKAN foto 360° sungguhan (fotonya belum ada). Yang dilakukan:
 * gambar lebar (1536–2048px) direntangkan 240% lalu digeser horizontal,
 * jadi terasa seperti memutar pandangan. Batas geser kanan-kiri dibuat
 * "menempel" supaya tidak ada bagian kosong yang terlihat.
 *
 * KENAPA TANPA JAVASCRIPT TETAP AMAN:
 * posisi awal `translateX(0)` dan gambar lebih lebar dari wadahnya, jadi
 * tanpa JS pengunjung tetap melihat pemandangan penuh — hanya interaksinya
 * yang hilang. Tidak ada teks penting di dalam panel ini.
 *
 * Kinerja: geseran memakai `transform` (GPU), bukan `left/background-position`,
 * dan tidak ada state React saat jari bergerak — nilai transform ditulis
 * langsung ke elemen lewat ref. Kalau memakai state, tiap piksel geseran
 * memicu render ulang dan itu terasa patah-patah di HP kelas bawah.
 */

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const GESER_MAKS = 42; // persen lebar gambar yang boleh digeser ke kiri
const ZOOM_MIN = 1;
const ZOOM_MAX = 2.2;
const ZOOM_BAWAAN = 1.15;

type Props = {
  src: string;
  alt: string;
  /** Label kecil di pojok, mis. "360° · geser untuk melihat" */
  petunjuk?: string;
};

export function Panorama({ src, alt, petunjuk }: Props) {
  const bingkaiRef = useRef<HTMLDivElement | null>(null);
  const gambarRef = useRef<HTMLDivElement | null>(null);

  const [zoom, setZoom] = useState(ZOOM_BAWAAN);
  const [sedangGeser, setSedangGeser] = useState(false);
  const [gerakanTereduksi, setGerakanTereduksi] = useState(false);

  // posisi dalam persen (-GESER_MAKS .. 0), disimpan di ref agar tidak
  // memicu render tiap frame
  const posisiRef = useRef(-GESER_MAKS / 2);
  const tarikanRef = useRef<{ x: number; mulai: number } | null>(null);

  const tulis = useCallback(() => {
    const el = gambarRef.current;
    if (!el) return;
    el.style.transform = `translateX(${posisiRef.current}%) scale(${zoom})`;
  }, [zoom]);

  useEffect(() => {
    tulis();
  }, [tulis]);

  // hormati preferensi "kurangi gerakan"
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ubah = () => setGerakanTereduksi(mq.matches);
    ubah();
    mq.addEventListener("change", ubah);
    return () => mq.removeEventListener("change", ubah);
  }, []);

  const geserKe = useCallback(
    (x: number) => {
      const bingkai = bingkaiRef.current;
      if (!bingkai) return;
      const lebar = bingkai.clientWidth;
      if (lebar === 0) return;
      const delta = (x / lebar) * 100 * 1.6; // 1.6 = faktor agar terasa ringan
      posisiRef.current = Math.min(0, Math.max(-GESER_MAKS, posisiRef.current + delta));
      tulis();
    },
    [tulis],
  );

  // ── pointer events: mouse + jari sekaligus (lebih andal dari touch saja)
  const mulai = (e: React.PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    tarikanRef.current = { x: e.clientX, mulai: posisiRef.current };
    setSedangGeser(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const gerak = (e: React.PointerEvent) => {
    if (!tarikanRef.current) return;
    const bingkai = bingkaiRef.current;
    if (!bingkai) return;
    const lebar = bingkai.clientWidth || 1;
    const delta = ((e.clientX - tarikanRef.current.x) / lebar) * 100 * 1.6;
    posisiRef.current = Math.min(
      0,
      Math.max(-GESER_MAKS, tarikanRef.current.mulai + delta),
    );
    tulis();
  };

  const selesai = () => {
    tarikanRef.current = null;
    setSedangGeser(false);
  };

  const ubahZoom = (arah: 1 | -1) => {
    setZoom((z) => {
      const baru = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z + arah * 0.25).toFixed(2)));
      return baru;
    });
  };

  return (
    <div className="relative">
      <div
        ref={bingkaiRef}
        onPointerDown={mulai}
        onPointerMove={gerak}
        onPointerUp={selesai}
        onPointerCancel={selesai}
        onPointerLeave={selesai}
        className={`relative aspect-[4/3] w-full touch-pan-y overflow-hidden rounded-[1.25rem] bg-forest-950 select-none ${
          sedangGeser ? "cursor-grabbing" : "cursor-grab"
        }`}
        role="img"
        aria-label={`${alt} — pandangan 360 derajat, bisa digeser`}
      >
        <div
          ref={gambarRef}
          className={`absolute inset-y-0 left-0 h-full w-[240%] ${
            gerakanTereduksi ? "" : "transition-transform duration-150 ease-out"
          }`}
          style={{ transform: `translateX(${posisiRef.current}%) scale(${ZOOM_BAWAAN})` }}
        >
          <Image
            src={src}
            alt=""
            fill
            sizes="(max-width: 440px) 240vw, 1056px"
            className="object-cover"
            priority
          />
        </div>

        {/* tepi kiri-kanan dilembutkan supaya kesan "berputar" lebih terasa */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 shadow-[inset_0_0_40px_18px_rgba(20,35,26,0.55)]"
        />

        {/* penanda kompas kecil */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-forest-950/55 px-2.5 py-1 text-[0.5625rem] font-bold tracking-[0.18em] text-cream-100/90 backdrop-blur-[2px]"
        >
          360°
        </div>

        {petunjuk ? (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-forest-950/55 px-3 py-1 text-[0.625rem] font-medium whitespace-nowrap text-cream-100/90 backdrop-blur-[2px]">
            {petunjuk}
          </p>
        ) : null}
      </div>

      {/* Kontrol zoom — sengaja di luar panel geser supaya tidak ikut
          menangkap pointer saat jari mulai menggeser. */}
      <div className="absolute top-3 right-3 flex gap-1.5">
        <button
          type="button"
          onClick={() => ubahZoom(-1)}
          disabled={zoom <= ZOOM_MIN}
          aria-label="Perkecil pandangan"
          className="grid size-8 place-items-center rounded-full bg-forest-950/65 text-cream-100 backdrop-blur-[2px] transition active:scale-90 disabled:opacity-35"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
            <path d="M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => ubahZoom(1)}
          disabled={zoom >= ZOOM_MAX}
          aria-label="Perbesar pandangan"
          className="grid size-8 place-items-center rounded-full bg-forest-950/65 text-cream-100 backdrop-blur-[2px] transition active:scale-90 disabled:opacity-35"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
