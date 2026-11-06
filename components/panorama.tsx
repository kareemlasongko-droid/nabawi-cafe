"use client";

/**
 * Panel panorama 360° untuk halaman detail Virtual Tour.
 *
 * TIGA KEADAAN, dan kenapa begitu:
 *
 * 1. BELUM AKTIF (posisi awal). Gambar hanya ditampilkan, BELUM bisa
 *    digeser. Sengaja: pada percobaan pertama jari pengunjung biasanya
 *    dipakai untuk menggulir halaman, dan kalau panel langsung menangkap
 *    geseran horizontal, halaman terasa "nyangkut". Jadi muncul tombol
 *    "Geser untuk melihat" — satu ketukan eksplisit sebelum menggeser.
 *
 * 2. AKTIF. Geseran diteruskan ke transform. Geseran ditulis langsung
 *    lewat ref tanpa state React, karena kalau memakai state tiap piksel
 *    geseran memicu render ulang dan itu patah-patah di HP kelas bawah.
 *
 * 3. LAYAR PENUH. Panel membesar memenuhi perangkat (dibatasi tinggi
 *    layar, bukan lebar 440px), memakai `<dialog>` bawaan browser supaya
 *    fokus keyboard terkunci, Esc menutup, dan latar di belakangnya tidak
 *    ikut tergulir. Di mode ini gambar ditampilkan selebar mungkin.
 *
 * TANPA JAVASCRIPT tetap aman: posisi awal translateX(0) dengan gambar
 * lebih lebar dari wadahnya, jadi pemandangan tetap terlihat penuh.
 */

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const GESER_MAKS = 42; // persen lebar gambar yang boleh digeser
const ZOOM_MIN = 1;
const ZOOM_MAX = 2.2;
const ZOOM_BAWAAN = 1.15;
const FAKTOR_GESER = 1.6; // agar 1px gerakan jari terasa wajar

type Props = {
  src: string;
  alt: string;
};

/** Isi panel gambar — dipakai bersama oleh tampilan normal dan layar penuh,
 *  supaya perilaku geser/zoom di keduanya persis sama. */
function useGeser() {
  const bingkaiRef = useRef<HTMLDivElement | null>(null);
  const gambarRef = useRef<HTMLDivElement | null>(null);
  const [aktif, setAktif] = useState(false);
  const [sedangGeser, setSedangGeser] = useState(false);
  const [zoom, setZoom] = useState(ZOOM_BAWAAN);
  const [gerakanTereduksi, setGerakanTereduksi] = useState(false);

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

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ubah = () => setGerakanTereduksi(mq.matches);
    ubah();
    mq.addEventListener("change", ubah);
    return () => mq.removeEventListener("change", ubah);
  }, []);

  const mulai = (e: React.PointerEvent) => {
    if (!aktif) return; // belum aktif: biarkan halaman yang menggulir
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
    const delta = ((e.clientX - tarikanRef.current.x) / lebar) * 100 * FAKTOR_GESER;
    posisiRef.current = Math.min(0, Math.max(-GESER_MAKS, tarikanRef.current.mulai + delta));
    tulis();
  };

  const selesai = () => {
    tarikanRef.current = null;
    setSedangGeser(false);
  };

  const ubahZoom = (arah: 1 | -1) =>
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z + arah * 0.25).toFixed(2))));

  return {
    bingkaiRef,
    gambarRef,
    posisiRef,
    aktif,
    setAktif,
    sedangGeser,
    zoom,
    setZoom,
    gerakanTereduksi,
    mulai,
    gerak,
    selesai,
    ubahZoom,
  };
}

export function Panorama({ src, alt }: Props) {
  const g = useGeser();
  const [penuh, setPenuh] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  // buka/tutup <dialog> mengikuti state, dan sebaliknya (Esc / klik latar)
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (penuh && !d.open) d.showModal();
    if (!penuh && d.open) d.close();
  }, [penuh]);

  return (
    <div className="relative">
      {/* ── tampilan normal ───────────────────────────────────────── */}
      <div
        ref={g.bingkaiRef}
        onPointerDown={g.mulai}
        onPointerMove={g.gerak}
        onPointerUp={g.selesai}
        onPointerCancel={g.selesai}
        onPointerLeave={g.selesai}
        className={`relative aspect-[4/3] w-full overflow-hidden rounded-[1.25rem] bg-forest-950 select-none ${
          g.aktif ? (g.sedangGeser ? "cursor-grabbing touch-none" : "cursor-grab touch-none") : "cursor-pointer"
        }`}
        role="img"
        aria-label={`${alt} — pandangan 360 derajat`}
      >
        <div
          ref={g.gambarRef}
          className={`absolute inset-y-0 left-0 h-full w-[240%] ${
            g.gerakanTereduksi ? "" : "transition-transform duration-150 ease-out"
          }`}
          style={{ transform: `translateX(${g.posisiRef.current}%) scale(${ZOOM_BAWAAN})` }}
        >
          <Image src={src} alt="" fill sizes="(max-width: 440px) 240vw, 1056px" className="object-cover" priority />
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 shadow-[inset_0_0_40px_18px_rgba(20,35,26,0.55)]"
        />

        {/* Sudut kanan atas: zoom (hanya kalau sudah aktif) + layar penuh */}
        <div className="absolute top-3 right-3 flex gap-1.5">
          {g.aktif ? (
            <>
              <button
                type="button"
                onClick={() => g.ubahZoom(-1)}
                disabled={g.zoom <= ZOOM_MIN}
                aria-label="Perkecil pandangan"
                className="grid size-8 place-items-center rounded-full bg-forest-950/70 text-cream-100 backdrop-blur-[2px] transition active:scale-90 disabled:opacity-35"
              >
                <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                  <path d="M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => g.ubahZoom(1)}
                disabled={g.zoom >= ZOOM_MAX}
                aria-label="Perbesar pandangan"
                className="grid size-8 place-items-center rounded-full bg-forest-950/70 text-cream-100 backdrop-blur-[2px] transition active:scale-90 disabled:opacity-35"
              >
                <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setPenuh(true)}
            aria-label="Buka layar penuh"
            className="grid size-8 place-items-center rounded-full bg-forest-950/70 text-cream-100 backdrop-blur-[2px] transition active:scale-90"
          >
            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
              <path
                d="M6 2.5H2.5V6M10 2.5h3.5V6M6 13.5H2.5V10M10 13.5h3.5V10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-forest-950/60 px-2.5 py-1 text-[0.5625rem] font-bold tracking-[0.18em] text-cream-100/90 backdrop-blur-[2px]"
        >
          360°
        </div>

        {/* Ajakan satu ketukan sebelum bisa digeser (keadaan 1) */}
        {!g.aktif ? (
          <button
            type="button"
            onClick={() => g.setAktif(true)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-[0.375rem] bg-forest-950/25 transition active:bg-forest-950/35"
          >
            <span className="grid size-11 place-items-center rounded-full bg-cream-100/95 text-forest-900 shadow-[0_6px_18px_rgba(20,35,26,0.45)]">
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                <path
                  d="M8 7 4 11l4 4M16 7l4 4-4 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="rounded-full bg-forest-950/65 px-3 py-1 text-[0.625rem] font-bold text-cream-100 backdrop-blur-[2px]">
              Ketuk untuk melihat sekeliling
            </span>
          </button>
        ) : (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-forest-950/60 px-3 py-1 text-[0.625rem] font-medium whitespace-nowrap text-cream-100/90 backdrop-blur-[2px]">
            Geser untuk melihat sekeliling
          </p>
        )}
      </div>

      {/* ── layar penuh ───────────────────────────────────────────── */}
      <dialog
        ref={dialogRef}
        onClose={() => setPenuh(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setPenuh(false);
        }}
        aria-label={`${alt} — layar penuh`}
        className="m-0 h-[100dvh] max-h-none w-screen max-w-none bg-forest-950 p-0 backdrop:bg-forest-950/80"
      >
        <div className="flex h-full w-full flex-col">
          {/* kepala: tombol tutup */}
          <div className="flex shrink-0 items-center justify-between px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[0.5rem]">
            <p className="truncate pr-3 text-[0.75rem] font-extrabold text-cream-100/90">
              {alt}
            </p>
            <button
              type="button"
              onClick={() => setPenuh(false)}
              aria-label="Tutup layar penuh"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-white/12 text-cream-100 transition active:scale-90"
            >
              <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* gambar memenuhi sisa tinggi layar — inilah "full sesuai
              perangkat": tingginya mengikuti layar, lebarnya 100% layar,
              bukan dibatasi kanvas 440px. */}
          <div className="relative min-h-0 flex-1 overflow-hidden bg-forest-950">
            <div className="absolute inset-0">
              <Image
                src={src}
                alt={alt}
                fill
                sizes="100vw"
                className="object-cover"
                priority
              />
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 shadow-[inset_0_0_60px_28px_rgba(20,35,26,0.45)]"
            />
          </div>

          <p className="shrink-0 px-4 pt-[0.5rem] pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[0.625rem] text-cream-100/60">
            Ketuk latar gelap atau tombol × untuk menutup
          </p>
        </div>
      </dialog>
    </div>
  );
}
