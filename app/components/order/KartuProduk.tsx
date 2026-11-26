"use client";

/**
 * Kartu produk untuk dashboard staf.
 *
 * ── BENTUKNYA MENGIKUTI KARTU PELANGGAN ───────────────────────────────
 *
 * Slot gambar di atas (4:3), teks di bawah, harga tebal di kiri-bawah,
 * aksi di kanan-bawah. Staf dan tamu melihat produk yang sama dengan
 * bahasa visual yang sama — jadi pelatihan staf baru tidak perlu
 * menerjemahkan dua tata letak.
 *
 * ── BEDANYA DENGAN KARTU PELANGGAN ────────────────────────────────────
 *
 * Pelanggan menekan "+" untuk membeli; staf mengelola. Karena itu kartu
 * ini punya SINYAL STATUS yang harus terbaca sebelum membaca apa pun:
 *
 *   · Habis     → seluruh kartu diredupkan + pita "Habis" di gambar
 *   · Rekomendasi → bintang di pojok gambar
 *   · harga     → angka terbesar, karena itu yang paling sering diubah
 *
 * ── TANPA FOTO: IKON KATEGORI, BUKAN INISIAL ──────────────────────────
 *
 * Sama dengan portal pelanggan. Diukur pada 126 menu: hanya 59 inisial
 * unik, dan 32 di antaranya dipakai lebih dari satu menu — "CH" mewakili
 * 8 menu berbeda. Inisial tidak membantu siapa pun.
 *
 * ── GRID DITENTUKAN PEMANGGIL, BUKAN KOMPONEN INI ─────────────────────
 *
 * Kartu ini tidak memasang `grid` pada dirinya sendiri: ia satu `<li>`.
 * Yang mengatur kolom adalah daftar di PortalKasir, karena jumlah kolom
 * bergantung pada sisa lebar setelah sidebar — bukan pada lebar layar
 * saja. Di 1280px sidebar 232px, di 1536px sidebar 256px; keduanya
 * memakai ambang yang berbeda.
 *
 *   panel Menu (kolom kanan, ≥1280px)
 *     360–479px  → 1 kolom  (kartu selebar panel; harga tidak terpotong)
 *     480px+     → 2 kolom
 *     1536px+    → 3 kolom
 *
 * Di 360px sengaja SATU kolom: dua kolom menyisakan ~150px per kartu,
 * dan harga Rp145.000 pada teks 15px butuh ~95px — belum termasuk
 * tombol. Angka harga yang terpotong ("Rp145.0…") adalah kegagalan yang
 * lebih mahal daripada daftar yang lebih panjang.
 *
 * `whitespace-nowrap` pada harga adalah lapisan kedua: kalau ada
 * pemanggil yang memasang grid lebih rapat, harga turun ke baris sendiri
 * alih-alih terpotong di tengah angka.
 */

import type { ComponentType } from "react";

export type Produk = {
  id: number;
  nama: string;
  harga: number;
  kategori: string;
  tersedia: boolean;
  rekomendasi: boolean;
  foto_url: string | null;
  kategori_id: number | null;
  /** Jumlah pilihan (sambal/rasa) — 0 berarti menu sederhana. */
  jumlahPilihan: number;
};

export function KartuProduk({
  produk,
  rupiah,
  IkonKategori,
  onUbah,
  onTersedia,
  sibuk = false,
}: {
  produk: Produk;
  /** Pemformat uang dari pemanggil — satu sumber, bukan salinan. */
  rupiah: (n: number) => string;
  IkonKategori: ComponentType<{ kategoriId: number | null | undefined; className?: string }>;
  onUbah: () => void;
  onTersedia: () => void;
  sibuk?: boolean;
}) {
  const { nama, harga, kategori, tersedia, rekomendasi, foto_url, kategori_id, jumlahPilihan } =
    produk;

  return (
    <li
      className={[
        "group relative flex flex-col overflow-hidden rounded-[0.875rem] border bg-bersih-0 transition",
        tersedia ? "border-bersih-200" : "border-sela-200",
        "shadow-[0_1px_2px_rgb(22_19_15/0.04),0_8px_20px_-16px_rgb(22_19_15/0.3)]",
      ].join(" ")}
    >
      {/* ── Slot gambar ── */}
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-daun-100">
        {foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto_url}
            alt=""
            loading="lazy"
            className={[
              "size-full object-cover transition duration-300",
              tersedia ? "group-hover:scale-[1.03]" : "opacity-40 grayscale",
            ].join(" ")}
          />
        ) : (
          <span aria-hidden="true" className="grid size-full place-items-center">
            <IkonKategori
              kategoriId={kategori_id}
              className={tersedia ? "size-9 text-forest-700/45" : "size-9 text-tinta-500/30"}
            />
          </span>
        )}

        {rekomendasi && tersedia && (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-cream-50/95 px-1.5 py-0.5 text-[0.625rem] font-bold text-sela-800 shadow-sm backdrop-blur">
            <svg viewBox="0 0 20 20" className="size-2.5" fill="currentColor" aria-hidden="true">
              <path d="M10 2.5l2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1L2.5 8l5.2-.8z" />
            </svg>
            Rekomendasi
          </span>
        )}

        {/*
          Pita "Habis" MENUTUPI gambar, bukan sekadar teks kecil di
          sudut. Ini satu-satunya keadaan yang membuat staf harus
          bertindak, jadi ia harus terlihat dari seberang meja.
        */}
        {!tersedia && (
          <span className="absolute inset-0 grid place-items-center bg-forest-950/60 text-[0.75rem] font-extrabold uppercase tracking-[0.16em] text-cream-50">
            Habis
          </span>
        )}
      </div>

      {/* ── Isi ── */}
      <div className="flex min-w-0 flex-1 flex-col p-2.5">
        <p className="line-clamp-2 text-[0.875rem] font-extrabold leading-snug text-tinta-900">
          {nama}
        </p>

        <p className="mt-0.5 flex items-center gap-1 truncate text-[0.6875rem] text-tinta-500">
          {kategori || "Tanpa kategori"}
          {jumlahPilihan > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-semibold">{jumlahPilihan} pilihan</span>
            </>
          )}
        </p>

        {/*
          Harga + aksi satu baris, rata bawah (`mt-auto`) supaya semua
          kartu di satu baris grid sejajar walau nama menunya 1 atau 2
          baris. Harga tidak pernah dipotong: `whitespace-nowrap`.
        */}
        <div className="mt-auto flex items-end justify-between gap-1 pt-2">
          <p className="min-w-0 whitespace-nowrap text-[1rem] font-extrabold leading-none tabular-nums text-forest-900">
            {rupiah(harga)}
          </p>

          <div className="flex shrink-0 items-center gap-1">
            {/*
              Tombol ketersediaan: 44px, ikon saja.
              Teks "Ada"/"Habis" tidak muat di 360px bersama harga, dan
              statusnya sudah dibawa oleh pita di gambar + warna kartu.
              `aria-label` menyebut tindakan berikutnya, bukan keadaannya.
            */}
            <button
              type="button"
              onClick={onTersedia}
              disabled={sibuk}
              aria-label={tersedia ? `Tandai ${nama} habis` : `Tandai ${nama} tersedia`}
              aria-pressed={tersedia}
              className={[
                "grid size-11 place-items-center rounded-[0.5rem] border transition disabled:opacity-50",
                tersedia
                  ? "border-daun-100 bg-daun-100 text-forest-700 hover:bg-daun-100/70"
                  : "border-sela-200 bg-sela-50 text-sela-800 hover:bg-sela-100",
              ].join(" ")}
            >
              {tersedia ? <IkonAda /> : <IkonHabis />}
            </button>

            <button
              type="button"
              onClick={onUbah}
              aria-label={`Ubah ${nama}`}
              className="grid size-11 place-items-center rounded-[0.5rem] border border-bersih-200 bg-bersih-100 text-tinta-700 transition hover:bg-bersih-200"
            >
              <IkonUbah />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function IkonAda() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
      <path d="m4.5 10.5 3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IkonHabis() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IkonUbah() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
      <path
        d="M13.5 3.5 16.5 6.5 7 16H4v-3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
