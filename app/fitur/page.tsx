import type { Metadata } from "next";
import Image from "next/image";
import { MenuCards } from "../components/MenuCards";
import { Navbar } from "../components/Navbar";

export const metadata: Metadata = {
  title: "Fitur — Nabawi Cafe & Resto",
  description:
    "Jelajahi Nabawi Cafe & Resto: suasana Maroko, pemandangan sungai, dan ruang bermain untuk keluarga.",
};

/**
 * Halaman yang terbuka setelah menekan "Mulai menjelajah" di beranda.
 *
 * Isi halaman: navbar + tiga kartu menu (Virtual Tour 360, Menu Kami,
 * Galeri & Aktivitas) sesuai lampiran pemilik. Kartu muncul satu per satu
 * lewat animasi CSS, jadi tetap tampil walau JavaScript gagal dimuat.
 *
 * Sama seperti beranda: Server Component tanpa JavaScript. Navigasi pulang
 * memakai <a href="/"> biasa di navbar, jadi tetap berfungsi di Safari
 * iOS 15 (iPhone 7) yang gagal menjalankan bundle modern.
 */
export default function FiturPage() {
  return (
    <main className="flex min-h-dvh justify-center bg-forest-950">
      {/* Kanvas mobile-only, lebar maks 440px — sama dengan beranda */}
      <div
        id="fitur"
        className="relative isolate w-full max-w-[27.5rem] overflow-hidden bg-forest-900 shadow-[0_0_100px_-30px_rgba(0,0,0,0.9)]"
      >
        <Image
          src="/images/fitur-bg.jpg"
          alt="Ilustrasi bangunan Nabawi Cafe bergaya Maroko dengan pintu masuk melengkung dan lentera, dikelilingi pepohonan"
          fill
          priority
          sizes="(max-width: 440px) 100vw, 440px"
          className="object-cover object-center"
        />

        {/* Overlay rata 30% di seluruh ilustrasi (diminta). Opacity-nya
            seragam, jadi seluruh latar sedikit diredupkan tanpa bagian
            yang lebih gelap.

            Warna memakai forest-950 (token yang sama dengan beranda) dan
            ditulis rgba langsung supaya angkanya terbaca jelas di kode.

            Gradasi gelap di bagian bawah sudah dibuang bersama teksnya:
            lapisan itu dulu dibuat hanya agar tulisan putih tetap terbaca
            di atas paving yang terang, jadi tanpa teks ia cuma menggelapkan
            ilustrasi tanpa manfaat. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[rgba(20,35,26,0.30)]"
        />

        {/* navbar melayang di atas ilustrasi; logo + judul berfungsi sebagai
            jalan kembali ke beranda, jadi tombol "Kembali" terpisah tidak
            diperlukan lagi */}
        <div className="relative flex min-h-dvh flex-col">
          <Navbar />

          {/* Tiga kartu menu. Ditaruh setelah Navbar (bukan lewat mt-auto)
              supaya mulai dari atas dan halaman bisa digulir seperti biasa;
              sebelumnya kolom ini memaksa isi menempel di bawah layar. */}
          <div className="px-5 pt-[1.125rem] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <MenuCards />
          </div>
        </div>
      </div>
    </main>
  );
}
