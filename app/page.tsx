import Image from "next/image";
import { HeroCard } from "./components/HeroCard";

/**
 * Halaman ini sengaja dirender sebagai Server Component tanpa state React.
 * Tombol "Mulai menjelajah" adalah tautan biasa ke /fitur, bukan handler
 * JavaScript, supaya tetap berfungsi di browser lama yang gagal
 * menjalankan bundle modern (mis. Safari iOS 15.x pada iPhone 7).
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

        {/* Overlay gradasi bawah → atas: paling pekat di bawah, memudar
            sampai benar-benar 0% di tepi atas. Stopenya dibuat bertingkat
            (bukan dua titik) supaya peralihannya terasa halus dan tidak
            terlihat seperti garis. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(20,35,26,0.62)_0%,rgba(20,35,26,0.46)_26%,rgba(20,35,26,0.29)_50%,rgba(20,35,26,0.14)_72%,rgba(20,35,26,0.05)_88%,rgba(20,35,26,0)_100%)]"
        />

        <div className="relative flex min-h-dvh flex-col px-4 pt-[19dvh] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <HeroCard />
        </div>
      </div>
    </main>
  );
}
