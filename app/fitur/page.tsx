import type { Metadata } from "next";
import Image from "next/image";
import { ArrowLeft } from "../components/icons";

export const metadata: Metadata = {
  title: "Fitur — Nabawi Cafe & Resto",
  description:
    "Jelajahi Nabawi Cafe & Resto: suasana Maroko, pemandangan sungai, dan ruang bermain untuk keluarga.",
};

/**
 * Halaman yang terbuka setelah menekan "Mulai menjelajah" di beranda.
 *
 * TAHAP SEMENTARA: yang tampil baru latar ilustrasi + judul + tombol
 * kembali. Daftar fiturnya belum diisi karena menunggu materi dari pemilik.
 *
 * Sama seperti beranda: Server Component tanpa JavaScript. Tombol kembali
 * memakai <a href="/"> biasa, jadi tetap berfungsi di Safari iOS 15
 * (iPhone 7) yang gagal menjalankan bundle modern.
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

        {/* Gradasi bawah → atas, senada dengan beranda. Bagian atas dibiarkan
            bening supaya langit dan bangunan tetap terlihat utuh; bagian bawah
            dibuat lebih pekat agar teks putih selalu terbaca. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,35,26,0.72)_0%,rgba(20,35,26,0.52)_18%,rgba(20,35,26,0.22)_38%,rgba(20,35,26,0)_62%)]"
        />

        <div className="relative flex min-h-dvh flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {/* kembali ke beranda — tautan biasa, tanpa JS */}
          <a
            href="/"
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-forest-950/45 px-[0.7rem] py-[0.45rem] text-[0.7rem] font-bold text-cream-50 backdrop-blur-[2px] active:bg-forest-950/65"
          >
            <ArrowLeft className="size-3" />
            Kembali
          </a>

          {/* isi sementara, menempel di bawah agar tidak menutupi bangunan */}
          <div className="mt-auto">
            <p className="font-mono text-[0.6rem] tracking-[0.18em] text-cream-100/90 uppercase">
              Selamat datang di
            </p>
            <h1 className="mt-[0.35rem] text-[1.6rem] leading-[1.1] font-extrabold tracking-[-0.03em] text-cream-50 drop-shadow-[0_2px_10px_rgba(20,35,26,0.55)]">
              Nabawi Cafe &amp; Resto
            </h1>
            <p className="mt-2 max-w-[19rem] text-[0.78rem] leading-[1.55] text-cream-100/95 drop-shadow-[0_1px_6px_rgba(20,35,26,0.6)]">
              Sebentar lagi kamu bisa lihat menu, suasana, dan cara reservasi
              di sini. Halaman ini masih tahap awal.
            </p>

            {/* penanda tahap: jujur ke pengunjung bahwa isinya belum lengkap */}
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-cream-50/12 px-[0.7rem] py-[0.35rem] text-[0.62rem] font-bold text-cream-50 ring-1 ring-cream-50/25">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-mint-400"
              />
              Segera hadir
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
