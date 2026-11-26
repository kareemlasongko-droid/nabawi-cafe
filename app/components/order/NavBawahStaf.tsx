"use client";

/**
 * Nav bawah untuk portal STAF (kasir & admin).
 *
 * ── MENGAPA NAV BAWAH, BUKAN TAB DI ATAS ────────────────────────────────
 *
 * Kedua portal ini dipakai sambil berdiri: kasir melayani tamu di depan
 * meja, admin berjalan memeriksa meja sambil memegang ponsel satu tangan.
 * Di layar 360–430px, tab di atas (atau baris tab yang digeser horizontal)
 * menaruh tujuan navigasi di jangkauan TERSULIT — sudut kiri atas — dan
 * sebagian tabnya tersembunyi di luar layar, jadi harus digeser dulu untuk
 * diketahui keberadaannya.
 *
 * Nav bawah mengubah dua hal sekaligus:
 *   1. Semua tujuan terlihat bersamaan, tanpa menggeser apa pun.
 *   2. Jangkauannya ibu jari, bukan ujung jari.
 *
 * Ini pola yang sama dengan portal pelanggan, jadi staf yang juga memakai
 * layar tamu tidak perlu mempelajari dua kebiasaan berbeda.
 *
 * ── KENAPA IKON + LABEL, BUKAN IKON SAJA ────────────────────────────────
 *
 * Enam tujuan (admin) terlalu banyak untuk dihafal dari ikonnya. Label 10px
 * tetap terbaca di 360px dan menghilangkan tebakan. Tinggi baris dijaga
 * tetap 48px agar sasaran sentuh tidak mengecil.
 */

import type { ReactNode } from "react";

export type ItemNavBawah = {
  kunci: string;
  label: string;
  Ikon: (p: { className?: string }) => ReactNode;
  /** Angka kecil di pojok ikon — jumlah antrean, dsb. */
  lencana?: number;
};

export function NavBawahStaf({
  judul,
  item,
  aktif,
  onPilih,
}: {
  /** Nama untuk pembaca layar: "Navigasi kasir" / "Navigasi admin". */
  judul: string;
  item: ItemNavBawah[];
  aktif: string;
  onPilih: (kunci: string) => void;
}) {
  return (
    /*
      `pb-[max(0.4rem,env(safe-area-inset-bottom))]` — di iPhone tanpa
      tombol Home, baris paling bawah tertutup gesekan sistem. Tanpa ini
      label terakhir tidak bisa dibaca, apalagi ditekan.

      `print:hidden` karena struk & invoice dicetak dari halaman yang sama;
      bilah navigasi tidak boleh ikut tercetak di kertas.
    */
    <nav
      aria-label={judul}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-bersih-200 bg-cream-50/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md print:hidden"
    >
      <ul className="mx-auto flex max-w-[45rem] items-stretch justify-around px-2">
        {item.map(({ kunci, label, Ikon, lencana }) => {
          const iniAktif = aktif === kunci;
          return (
            <li key={kunci} className="flex-1">
              <button
                type="button"
                onClick={() => onPilih(kunci)}
                aria-current={iniAktif ? "page" : undefined}
                className={[
                  "flex w-full flex-col items-center gap-1 rounded-[0.625rem] px-0.5 py-1.5 font-bold transition",
                  iniAktif
                    ? "text-forest-900"
                    : "text-tinta-500 hover:text-tinta-700",
                ].join(" ")}
              >
                <span className="relative">
                  <Ikon className={iniAktif ? "size-[1.375rem]" : "size-[1.375rem] opacity-70"} />
                  {/*
                    Lencana jumlah: tanpa ini kasir harus membuka tab untuk
                    tahu ada pesanan baru. Angkanya dibatasi "9+" supaya
                    tidak melebar menutupi label di sebelahnya.
                  */}
                  {typeof lencana === "number" && lencana > 0 && (
                    <span
                      className="absolute -right-2 -top-1.5 grid min-w-[1rem] place-items-center rounded-full bg-sela-700 px-1 text-[0.5625rem] font-extrabold leading-[1rem] text-white tabular-nums"
                      aria-hidden="true"
                    >
                      {lencana > 9 ? "9+" : lencana}
                    </span>
                  )}
                </span>
                {/*
                  ── LABEL TIDAK BOLEH MEMBUNGKUS ──────────────────────

                  Di layar 360px, enam tab menyisakan ~57px per slot, dan
                  "Penjualan" memakan ~56px. Itu sisa 1,5px — cukup untuk
                  hari ini, tetapi tidak cukup kalau pengguna memperbesar
                  huruf sistem (dan banyak staf melakukannya), atau kalau
                  kelak ada tab dengan label lebih panjang.

                  Kalau label membungkus dua baris, TINGGI bilah ikut
                  berubah, dan tombol yang sedang ditekan bergeser di
                  bawah jari. Karena itu label dibuat satu baris dengan
                  ukuran 10px (bukan 9.5px) dan huruf yang bisa menyusut
                  sendiri (`text-[clamp()]`) — bukan dipotong dengan
                  elipsis, karena "Penjua…" lebih buruk daripada huruf
                  yang sedikit lebih kecil.
                */}
                <span className="block w-full whitespace-nowrap text-center text-[clamp(0.5625rem,2.6vw,0.6875rem)] leading-tight">
                  {label}
                </span>
                {typeof lencana === "number" && lencana > 0 && (
                  <span className="sr-only">({lencana} menunggu)</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
