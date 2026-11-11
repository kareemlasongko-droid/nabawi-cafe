/**
 * Kerangka halaman order.
 *
 * KEPUTUSAN DESAIN — dan alasannya
 *
 * 1. TIDAK memakai ilustrasi latar seperti beranda. Alasannya bukan selera:
 *    portal pelanggan dibuka di meja dengan sinyal tidak selalu kuat (PRD
 *    bagian 4). Ilustrasi penuh layar 4,8 MB membuat halaman tidak muncul
 *    dalam 3 detik. Latar di sini warna solid + tekstur halus dari CSS.
 *
 * 2. Lebar maksimum 720px untuk portal pelanggan, 1280px untuk portal staf.
 *    Ini bukan "mobile-first" tanpa alasan: pelanggan memakai HP (≤430px),
 *    kasir dan dapur memakai tablet landscape. Memaksa kanvas 440px seperti
 *    beranda akan membuang separuh layar tablet dapur, padahal tiket harus
 *    terbaca dari 2 meter.
 *
 * 3. Palet tetap dari token situs (forest/cream/clay/ink) supaya terasa satu
 *    produk, tetapi bobotnya dibalik: di sini latar terang (cream) dan teks
 *    gelap, karena dibaca lama di bawah cahaya siang area terbuka. Beranda
 *    gelap karena hanya dilihat sekilas.
 */

import type { ReactNode } from "react";
import { LogoNabawi } from "./LogoNabawi";

export function Kerangka({
  children,
  lebar = "pelanggan",
  className = "",
}: {
  children: ReactNode;
  lebar?: "pelanggan" | "staf";
  className?: string;
}) {
  return (
    <div className="min-h-dvh bg-bersih-50 text-tinta-900">
      <div
        className={[
          "mx-auto min-h-dvh w-full",
          lebar === "staf" ? "max-w-[80rem]" : "max-w-[45rem]",
          className,
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Bilah atas portal staf.
 *
 * Status koneksi ditempatkan di sini, bukan di pojok kecil, karena PRD
 * bagian 14 meminta tablet menampilkan penanda offline. Kasir harus tahu
 * saat pesanan tidak akan masuk SEBELUM pelanggan mengeluh.
 */
export function BilahStaf({
  judul,
  keterangan,
  kanan,
  demo,
  ringkasan,
}: {
  judul: string;
  keterangan?: string;
  kanan?: ReactNode;
  demo?: boolean;
  /**
   * Versi ringkas identitas untuk ponsel: nama layar yang lebih pendek
   * ("Admin menu" → "Admin") dan satu angka status ("126").
   *
   * Kenapa perlu: "Admin menu" (92px) + "Nabawi Cafe" (95px) + dua tab
   * (143px) = 330px dari 336px yang tersedia di layar 360px — tanpa sisa
   * untuk jarak, dan langsung meluber begitu ada satu tombol lagi.
   */
  ringkasan?: { layar?: string; keteranganPonsel?: string };
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-bersih-200 bg-bersih-0/92 backdrop-blur-md">
      {/*
        DUA KELOMPOK, SATU BARIS: identitas menempel kiri, alat menempel
        kanan. `justify-between` yang mengatur jarak — bukan `flex-1` pada
        salah satu sisi, karena itu membuat kelompok kanan terdorong ke tepi
        hanya kalau sisi kiri kebetulan pendek.

        `flex-nowrap` disengaja: kepala yang membungkus ke baris kedua adalah
        persis hal yang diminta untuk dihindari.
      */}
      <div className="mx-auto flex max-w-[80rem] items-center justify-between gap-3 px-3 py-2.5 sm:px-6">
        {/* ── KIRI: identitas kafe ── */}
        <div className="flex min-w-0 items-center">
          <LogoNabawi
            keterangan={keterangan}
            layar={ringkasan?.layar ?? judul}
            keteranganPonsel={ringkasan?.keteranganPonsel}
            ringkas={Boolean(ringkasan)}
          />
        </div>

        {/* ── KANAN: alat layar ── */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Mode demo dipindah ke sini dari baris kedua: pita penuh selebar
              layar dulu memakan 28px tinggi dan mendorong kepala jadi dua
              baris di ponsel. Di sini ia jadi chip kecil yang tetap terlihat
              tapi tidak lagi dihitung sebagai bagian kepala. */}
          {demo && (
            <span
              className="hidden rounded-full bg-tanah-100 px-2.5 py-1 text-[0.6875rem] font-bold text-clay-800 sm:inline"
              title="Kunci server database belum dipasang, jadi data tidak disimpan permanen."
            >
              Mode demo
            </span>
          )}
          {kanan}
        </div>
      </div>
    </header>
  );
}

/**
 * Penanda status layar untuk mode demo.
 * Sengaja ditulis sebagai kalimat, bukan pita warna: pengguna harus paham
 * apa artinya, bukan sekadar melihat ada sesuatu yang berbeda.
 */
export function PitaDemo({ pesan }: { pesan?: string }) {
  return (
    <div className="border-b border-clay-700/25 bg-tanah-100 px-4 py-2 sm:px-6">
      <p className="text-[0.6875rem] leading-snug text-clay-800">
        <strong className="font-bold">Mode demo.</strong>{" "}
        {pesan ??
          "Pesanan yang dibuat di sini hanya tersimpan sementara di server dan hilang saat server dimulai ulang. Pasang SUPABASE_SERVICE_KEY di Vercel untuk menyimpan sungguhan."}
      </p>
    </div>
  );
}
