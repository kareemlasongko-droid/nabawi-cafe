import Image from "next/image";
import { HeroCard } from "./components/HeroCard";
import { WelcomePanel } from "./components/WelcomePanel";

/**
 * Halaman ini sengaja dirender sebagai Server Component tanpa state React.
 * Interaksi tombol ditangani CSS (:target), bukan JavaScript, supaya tetap
 * berfungsi di browser lama yang gagal menjalankan bundle modern
 * (mis. Safari iOS 15.x pada iPhone 7).
 */
export default function HomePage() {
  return (
    <main className="flex min-h-dvh justify-center bg-forest-950">
      {/* Kanvas mobile-only: lebar tetap 430px, tanpa breakpoint responsive */}
      <div
        id="hero"
        className="relative isolate w-full max-w-[26.875rem] overflow-hidden bg-forest-900 shadow-[0_0_100px_-30px_rgba(0,0,0,0.9)]"
      >
        <Image
          src="/images/hero-bg.jpg"
          alt="Ilustrasi hutan tropis dengan cafe bergaya Maroko di tepi sungai dan tiga camper van di jalan setapak"
          fill
          priority
          sizes="(max-width: 430px) 100vw, 430px"
          className="object-cover object-center"
        />

        {/* Lapisan kontras lembut supaya kartu & teks selalu terbaca */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,35,26,0.34)_0%,rgba(20,35,26,0.06)_30%,rgba(20,35,26,0)_52%,rgba(20,35,26,0.18)_100%)]"
        />

        <div className="relative flex min-h-dvh flex-col px-4 pt-[19dvh] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <HeroCard />
        </div>
      </div>

      <WelcomePanel />
    </main>
  );
}
