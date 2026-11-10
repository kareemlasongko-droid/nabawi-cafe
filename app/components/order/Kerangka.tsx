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
}: {
  judul: string;
  keterangan?: string;
  kanan?: ReactNode;
  demo?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-bersih-200 bg-bersih-0/92 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        {/*
          Identitas dulu, baru nama layar. Sebelumnya kepala portal staf
          hanya berisi "Kasir" / "Admin menu" tanpa penanda milik siapa
          layar itu — kalau tablet kasir dan tablet dapur tertukar, tidak
          ada yang bisa memastikannya dari layar.
        */}
        {/*
          SATU BARIS, dan urutannya disengaja: identitas → garis → peran.
          Nama layar ("Kasir") diletakkan paling kanan karena ia yang
          membedakan tablet satu dengan lainnya; identitas kafe selalu sama
          di semua layar, jadi tidak perlu jadi yang pertama dibaca.

          `min-w-0` di tiap tingkat wajib: tanpa itu, `truncate` tidak
          bekerja di dalam flex dan nama yang panjang akan mendorong
          tombol keluar layar, bukan terpotong.
        */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <LogoNabawi ukuran={30} sebaris keterangan={keterangan} />
          <span aria-hidden="true" className="h-6 w-px shrink-0 bg-bersih-200" />
          <h1 className="min-w-0 shrink-0 truncate text-[0.9375rem] font-extrabold tracking-tight text-tinta-900">
            {judul}
          </h1>
        </div>
        {demo && (
          <span
            className="shrink-0 rounded-full bg-tanah-100 px-2.5 py-1 text-[0.6875rem] font-bold text-clay-800"
            title="Kunci server database belum dipasang, jadi data tidak disimpan permanen."
          >
            Mode demo
          </span>
        )}
        {kanan}
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
