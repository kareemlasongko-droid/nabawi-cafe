import Image from "next/image";
import { CalendarCheck } from "./icons";

/**
 * Kartu hero. Sengaja TANPA JavaScript: tombol utama adalah <a href="#selamat-datang">
 * sehingga tetap berfungsi di browser yang gagal menjalankan React
 * (mis. Safari iOS 15 pada iPhone 7).
 */
export function HeroCard() {
  return (
    <div className="animate-rise speech-card mr-auto ml-[9%] w-[73%] max-w-[19.5rem] px-[1.1rem] pt-[1.05rem] pb-[1.25rem]">
      {/* identitas cafe */}
      <div className="flex items-start gap-[0.7rem]">
        <Image
          src="/images/logo-nabawi.png"
          alt="Logo Nabawi Cafe &amp; Resto"
          width={100}
          height={100}
          priority
          className="mt-[0.1rem] size-[2.9rem] shrink-0 rounded-full"
        />
        <div className="min-w-0">
          <h1 className="text-[0.88rem] leading-[1.15] font-extrabold tracking-[-0.015em] text-ink-900">
            Nabawi Cafe &amp; Resto
          </h1>
          {/* Ukuran 11.5px dipilih dari pengukuran, bukan dikira-kira:
              ruang teks tersedia 197.8px, sedangkan baris terpanjang
              ("Nature escape riverside view & play") butuh:
                14.08px -> 233.3px  (tidak muat, pecah jadi 2 baris)
                12px    -> 198.9px  (masih kelebihan)
                11.5px  -> 190.6px  (muat, sisa 7.2px)
              Batas maksimumnya ≈ 11.93px; 11.5px dipilih agar aman dari
              pembulatan metrik font dan tetap kecil dibanding judul
              (14.08px) sehingga hierarkinya jelas. */}
          <p className="mt-[0.3rem] text-[0.71875rem] leading-[1.35] text-ink-900">
            Cafe and Resto berkonsep Maroko
            <br />
            Nature escape riverside view &amp; play
          </p>
        </div>
      </div>

      {/* jam buka: Setiap Hari | ikon | 09.00 – 21.00 */}
      <p
        className="mt-[0.6rem] flex w-full items-center justify-center gap-[0.45rem] rounded-full bg-mint-100 px-[0.6rem] py-[0.42rem] text-mint-700"
        aria-label="Buka setiap hari, pukul 09.00 sampai 21.00"
      >
        <span className="text-[0.85rem] leading-none font-extrabold tracking-[-0.01em]">
          Setiap Hari
        </span>
        <CalendarCheck className="size-[1.2rem] shrink-0 text-mint-600" />
        <span className="text-[0.85rem] leading-none font-extrabold tracking-[-0.01em] tabular-nums">
          09.00 – 21.00
        </span>
      </p>

      {/* tombol utama: tautan biasa, tidak butuh JS */}
      <a
        href="#selamat-datang"
        className="mt-[0.7rem] flex w-full items-center justify-center gap-[0.4rem] rounded-[0.7rem] bg-clay-600 px-[0.8rem] py-[0.72rem] text-cream-50 shadow-[0_8px_16px_-8px_rgba(122,51,22,0.85),inset_0_1px_0_rgba(255,255,255,0.18)] transition-transform duration-150 ease-out active:scale-[0.975] active:bg-clay-700"
      >
        <span className="text-[0.88rem] leading-none font-bold tracking-[-0.005em]">
          Mulai menjelajah
        </span>
        {/* Ikon dari aset yang dilampirkan (Sun 2-2.png, 96×96 putih).
            Dirender sebagai gambar, bukan SVG, karena sumbernya PNG.
            Ukuran tampil disamakan dengan ikon sebelumnya (1.05rem) agar
            layout tombol tidak bergeser; pada DPR 3 sisa resolusi aset
            (96px untuk 16.8px CSS ≈ 50px fisik) masih jauh lebih dari
            cukup, jadi tidak perlu image-rendering: pixelated lagi. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/icon-sun.png"
          alt=""
          aria-hidden="true"
          width={96}
          height={96}
          className="size-[1.05rem] shrink-0"
        />
      </a>
    </div>
  );
}
