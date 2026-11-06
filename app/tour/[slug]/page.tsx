import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "../../components/Footer";
import { Navbar } from "../../components/Navbar";
import { Panorama } from "../../../components/panorama";
import { ambilVenues, type Aksen } from "../../lib/venues";

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const { venues } = await ambilVenues();
  return venues.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { venues } = await ambilVenues();
  const v = venues.find((x) => x.slug === slug);

  if (!v) return { title: "Tempat tidak ditemukan — Nabawi Cafe & Resto" };

  return {
    title: `${v.nama} — Virtual Tour Nabawi Cafe & Resto`,
    description: v.ringkasan,
  };
}

const WARNA_AKSEN: Record<Aksen, { pil: string; teks: string }> = {
  forest: { pil: "bg-forest-900 text-cream-100", teks: "text-cream-100" },
  clay: { pil: "bg-clay-600 text-cream-50", teks: "text-cream-50" },
  cream: { pil: "bg-cream-300 text-ink-900", teks: "text-ink-900" },
};

export default async function VenuePage({ params }: Params) {
  const { slug } = await params;
  const { venues } = await ambilVenues();

  const i = venues.findIndex((x) => x.slug === slug);
  if (i === -1) notFound();

  const v = venues[i];
  const sebelumnya = venues[(i - 1 + venues.length) % venues.length];
  const berikutnya = venues[(i + 1) % venues.length];
  const warna = WARNA_AKSEN[v.aksen];

  return (
    <main className="flex min-h-dvh justify-center bg-forest-950">
      <div className="relative isolate w-full max-w-[27.5rem] overflow-hidden bg-forest-950 shadow-[0_0_100px_-30px_rgba(0,0,0,0.9)]">
        <div className="relative z-10 flex min-h-dvh flex-col">
          <Navbar />

          {/* Kepala: nomor + kategori, lalu nama tempat */}
          <header className="px-5 pt-[0.5rem] text-center">
            <div className="flex items-center justify-center gap-[0.375rem]">
              <span className={`rounded-full px-[0.625rem] py-[0.1875rem] text-[0.5625rem] font-bold tracking-[0.1em] ${warna.pil}`}>
                {String(v.urutan).padStart(2, "0")} / {String(venues.length).padStart(2, "0")}
              </span>
              <span className="rounded-full border border-white/25 px-[0.625rem] py-[0.1875rem] text-[0.5625rem] font-bold tracking-[0.06em] text-white/80">
                {v.kategori}
              </span>
            </div>
            <h1 className="mt-[0.375rem] text-[1.375rem] leading-[1.1] font-extrabold tracking-[-0.01em] text-[#ffffff] [text-shadow:0_1px_10px_rgba(20,35,26,0.55)]">
              {v.nama}
            </h1>
            <p className="mx-auto mt-[0.25rem] max-w-[19rem] text-[0.6875rem] leading-[1.5] text-white/80">
              {v.ringkasan}
            </p>
          </header>

          <div className="px-5 pt-[0.75rem]">
            <Panorama
              src={v.panoramaUrl}
              alt={`Pandangan ${v.nama} di Nabawi Cafe`}
              petunjuk="Geser untuk melihat sekeliling"
            />
          </div>

          {/* Keterangan tempat */}
          <section className="px-5 pt-[0.875rem]">
            <div className="rounded-[1.25rem] border border-white/15 bg-forest-950/55 p-[0.875rem] backdrop-blur-[3px]">
              <p className="text-[0.75rem] leading-[1.6] text-cream-100/90">
                {v.deskripsi}
              </p>

              <dl className="mt-[0.75rem] grid grid-cols-2 gap-[0.5rem]">
                <div className="rounded-[0.75rem] bg-white/[0.07] px-[0.625rem] py-[0.5rem]">
                  <dt className="text-[0.5rem] font-bold tracking-[0.12em] text-cream-100/55">
                    DURASI
                  </dt>
                  <dd className="mt-[0.125rem] text-[0.75rem] font-extrabold text-cream-50">
                    ± {v.durasiMenit} menit
                  </dd>
                </div>
                <div className="rounded-[0.75rem] bg-white/[0.07] px-[0.625rem] py-[0.5rem]">
                  <dt className="text-[0.5rem] font-bold tracking-[0.12em] text-cream-100/55">
                    JAM BUKA
                  </dt>
                  <dd className="mt-[0.125rem] text-[0.75rem] font-extrabold text-cream-50">
                    {v.jamBuka ?? "Setiap Hari 09.00 – 21.00"}
                  </dd>
                </div>
              </dl>

              {v.fasilitas.length > 0 ? (
                <div className="mt-[0.75rem]">
                  <p className="text-[0.5rem] font-bold tracking-[0.12em] text-cream-100/55">
                    YANG ADA DI SINI
                  </p>
                  <ul className="mt-[0.375rem] flex flex-wrap gap-[0.3125rem]">
                    {v.fasilitas.map((f) => (
                      <li
                        key={f}
                        className="rounded-full bg-white/10 px-[0.5rem] py-[0.1875rem] text-[0.5625rem] font-semibold text-cream-100/85"
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>

          {/* Navigasi antar tempat — inti dari "tidak membosankan":
              pengunjung selalu punya langkah berikutnya tanpa harus
              kembali ke daftar. */}
          <nav className="px-5 pt-[0.75rem] pb-[0.875rem]" aria-label="Jelajahi tempat lain">
            <p className="mb-[0.375rem] text-center text-[0.5625rem] font-bold tracking-[0.14em] text-cream-100/50">
              LANJUTKAN MENJELAJAH
            </p>
            <div className="flex items-stretch gap-[0.5rem]">
              <Link
                href={`/tour/${sebelumnya.slug}`}
                className="flex min-w-0 flex-1 flex-col justify-center rounded-[1rem] bg-white/[0.08] px-[0.625rem] py-[0.5rem] transition active:scale-[0.98]"
              >
                <span className="text-[0.5rem] font-bold tracking-[0.1em] text-cream-100/50">
                  ← SEBELUMNYA
                </span>
                <span className="mt-[0.125rem] truncate text-[0.6875rem] font-extrabold text-cream-50">
                  {sebelumnya.nama}
                </span>
              </Link>
              <Link
                href={`/tour/${berikutnya.slug}`}
                className="flex min-w-0 flex-1 flex-col items-end justify-center rounded-[1rem] bg-cream-100 px-[0.625rem] py-[0.5rem] text-right transition active:scale-[0.98]"
              >
                <span className="text-[0.5rem] font-bold tracking-[0.1em] text-forest-900/50">
                  BERIKUTNYA →
                </span>
                <span className="mt-[0.125rem] w-full truncate text-[0.6875rem] font-extrabold text-forest-900">
                  {berikutnya.nama}
                </span>
              </Link>
            </div>

            <Link
              href="/tour"
              className="mt-[0.5rem] flex items-center justify-center gap-[0.25rem] rounded-full border border-white/20 px-3 py-[0.4375rem] text-[0.625rem] font-bold text-cream-100/85 transition active:scale-[0.98]"
            >
              Lihat semua 10 tempat
            </Link>
          </nav>

          <div className="mt-auto">
            <Footer />
          </div>
        </div>
      </div>
    </main>
  );
}
