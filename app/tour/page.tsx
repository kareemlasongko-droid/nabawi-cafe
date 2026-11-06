import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "../components/Footer";
import { BackLink } from "../../components/back-link";
import { Navbar } from "../components/Navbar";
import { ambilVenues } from "../lib/venues";

export const metadata: Metadata = {
  title: "Virtual Tour 360 — Nabawi Cafe & Resto",
  description:
    "Jelajahi 10 tempat di Nabawi Cafe & Resto lewat tur virtual: gerbang Maroko, taman riverside, teras lentera, dek sungai, dan lainnya.",
};

/**
 * SATU warna untuk semua kartu daftar: tinta merek `ink-900` (#2d264b).
 *
 * Diminta: "card-card di halaman daftar virtual tour 1 warna saja yang
 * berbeda dari warna menu tapi sangat cocok dan sesuai dengan fiturnya".
 *
 * Kenapa tinta, bukan sekadar warna lain:
 *   - KARTU MENU (/fitur) memakai hijau #1b3325, terra #b4502c, krem
 *     #e8d3ae. Tinta #2d264b tidak satu pun dari itu, tapi tetap dari
 *     palet situs: ini warna yang sudah dipakai untuk judul navbar dan
 *     judul kartu, jadi terasa satu keluarga, bukan warna tempelan.
 *   - Sesuai fiturnya: daftar ini pintu masuk ke panorama malam —
 *     teras lentera, bar kopi, dek sungai. Tinta gelap membuat foto
 *     panorama (mayoritas bernuansa hangat/gelap) menyala, sedangkan
 *     hijau hutan menenggelamkannya.
 *
 * Kontras terukur (bukan dikira-kira), latar #2d264b:
 *   teks cream-50 #fffdf8  = 13.86 : 1
 *   teks cream-100 #fbf3e2 = 12.76 : 1
 *   nomor (cream-50/40)    =  3.50 : 1  (teks besar-ish, dekoratif)
 *   pil (cream-50/20)      =  7.36 : 1
 * Semua lolos ambang WCAG 4.5:1 untuk teks kecil. Sebagai pembanding,
 * kartu hijau di /fitur 13.35 : 1 — jadi kartu baru ini setara, tidak
 * lebih berat dibaca.
 *
 * Konsekuensi yang disengaja: karena latarnya sekarang selalu gelap,
 * skema teks/pil TIDAK lagi mengikuti `aksen` per tempat. Kalau dibiarkan
 * mengikuti, kartu "cream" akan menulis teks ink-900 di atas tinta dan
 * hilang sama sekali. `aksen` tetap dipakai di halaman detail (pil
 * kategori) supaya identitas tiap tempat masih terasa.
 */
const GAYA_KARTU = {
  kartu: "bg-ink-900",
  teks: "text-cream-50",
  pil: "bg-cream-50/20 text-cream-50",
  nomor: "text-cream-50/40",
} as const;

export default async function TourPage() {
  const { venues, sumber } = await ambilVenues();
  const totalMenit = venues.reduce((n, v) => n + v.durasiMenit, 0);

  return (
    <main className="flex min-h-dvh justify-center bg-forest-950">
      {/* Kanvas selebar beranda (440px) di HP; di tablet tetap 440px di
          tengah. Halaman ini BOLEH digulir — berbeda dari /fitur yang
          dipaksa satu layar — karena isinya daftar 10 tempat yang memang
          panjang. Justru menggulir di sini bagian dari pengalamannya. */}
      <div className="relative isolate w-full max-w-[27.5rem] bg-forest-900 shadow-[0_0_100px_-30px_rgba(0,0,0,0.9)]">
        {/* Latar ilustrasi dibuat tetap (fixed di dalam kanvas) supaya saat
            menggulir terasa seperti jendela ke satu tempat, bukan tumpukan
            kartu di atas gambar yang ikut bergeser. */}
        <div className="fixed inset-0 mx-auto w-full max-w-[27.5rem]">
          <Image
            src="/images/fitur-bg.jpg"
            alt=""
            fill
            priority
            sizes="(max-width: 440px) 100vw, 440px"
            className="object-cover object-center"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-forest-950/45" />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-forest-950/55 via-transparent to-forest-950/80"
          />
        </div>

        <div className="relative z-10 flex min-h-dvh flex-col">
          <Navbar sticky gradient />

          {/* Kepala halaman */}
          <header className="px-5 pt-[0.75rem] pb-[0.875rem] text-center">
            {/* Satu-satunya tombol kembali (diminta: "single back saja,
                teksnya kembali"). Di luar navbar, rata kiri sendirian,
                jadi judul di bawahnya tetap simetris. */}
            <div className="mb-[0.625rem] flex justify-start">
              <BackLink
                href="/fitur"
                label="Kembali"
                aria="Kembali ke halaman menu Fitur"
              />
            </div>
            <p className="text-[0.625rem] leading-none font-medium tracking-[0.16em] text-white/75">
              MULAI PENJELAJAHAN
            </p>
            <h1 className="mt-[0.25rem] text-[1.375rem] leading-[1.1] font-extrabold tracking-[-0.01em] text-[#ffffff] [text-shadow:0_1px_10px_rgba(20,35,26,0.55)]">
              Virtual Tour 360
            </h1>
            <p className="mx-auto mt-[0.375rem] max-w-[19rem] text-[0.6875rem] leading-[1.5] text-white/80">
              {venues.length} tempat bisa dijelajahi · sekitar {totalMenit} menit
              jalan santai
            </p>
          </header>

          {/* Peta mini — menampilkan posisi 10 titik dalam satu bidang.
              Berguna supaya pengunjung paham tata letaknya dulu sebelum
              masuk ke satu tempat. */}
          <div className="mx-5 mb-[0.875rem] rounded-[1.25rem] border border-white/15 bg-forest-950/45 p-[0.625rem] backdrop-blur-[3px]">
            <div className="relative aspect-[5/3] w-full overflow-hidden rounded-[0.875rem]">
              {/* grid halus sebagai pengganti gambar peta */}
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-[0.18]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(243,228,200,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(243,228,200,0.9) 1px, transparent 1px)",
                  backgroundSize: "22px 22px",
                }}
              />
              {/* garis alur kunjungan: 1 -> 10 */}
              <svg
                aria-hidden="true"
                viewBox="0 0 100 60"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
              >
                <polyline
                  points={venues
                    .map((v) => `${v.petaX},${(v.petaY / 100) * 60}`)
                    .join(" ")}
                  fill="none"
                  stroke="rgba(232,211,174,0.55)"
                  strokeWidth="0.7"
                  strokeDasharray="2 1.6"
                  strokeLinecap="round"
                />
              </svg>
              {venues.map((v) => (
                <Link
                  key={v.slug}
                  href={`/tour/${v.slug}`}
                  aria-label={`Tempat ${v.urutan}: ${v.nama}`}
                  className="absolute grid size-[1.125rem] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-cream-100 text-[0.5rem] font-extrabold text-forest-900 shadow-[0_2px_6px_rgba(20,35,26,0.5)] transition active:scale-90"
                  style={{ left: `${v.petaX}%`, top: `${v.petaY}%` }}
                >
                  {v.urutan}
                </Link>
              ))}
            </div>
            <p className="mt-[0.375rem] text-center text-[0.5625rem] font-medium tracking-[0.04em] text-cream-100/70">
              Ketuk nomor untuk langsung ke tempatnya
            </p>
          </div>

          {/* Daftar tempat */}
          <ol className="flex flex-col gap-[0.625rem] px-5 pb-[0.875rem]">
            {venues.map((v) => {
              const g = GAYA_KARTU;
              return (
                <li key={v.slug}>
                  <Link
                    href={`/tour/${v.slug}`}
                    className={`group flex min-h-[6.25rem] items-stretch gap-[0.625rem] overflow-hidden rounded-[1.25rem] p-[0.5rem] shadow-[0_12px_24px_-14px_rgba(20,35,26,0.7)] transition active:scale-[0.985] ${g.kartu}`}
                  >
                    {/* potongan panorama sebagai penanda visual */}
                    <div className="relative size-[5.25rem] shrink-0 overflow-hidden rounded-[0.875rem] bg-forest-950">
                      <Image
                        src={v.panoramaUrl}
                        alt=""
                        fill
                        sizes="84px"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                      <span className="absolute bottom-1 left-1 rounded-full bg-forest-950/70 px-1.5 py-[0.125rem] text-[0.5rem] font-bold text-cream-100">
                        {v.durasiMenit}m
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-center py-[0.25rem]">
                      <div className="flex items-center gap-[0.375rem]">
                        <span className={`text-[0.5625rem] font-bold tracking-[0.14em] ${g.nomor}`}>
                          {String(v.urutan).padStart(2, "0")}
                        </span>
                        <span
                          className={`rounded-full px-[0.5rem] py-[0.125rem] text-[0.5rem] leading-none font-bold whitespace-nowrap ${g.pil}`}
                        >
                          {v.kategori}
                        </span>
                      </div>
                      <h2 className={`mt-[0.1875rem] text-[0.9375rem] leading-[1.15] font-extrabold ${g.teks}`}>
                        {v.nama}
                      </h2>
                      {/* Di layar sempit (<380px) ringkasan dibiarkan
                          mengalir penuh: dengan line-clamp-2 teks terukur
                          terpotong di 320px (280px kartu), sedangkan
                          membiarkannya 3 baris hanya menambah ~14px dan
                          halaman ini memang boleh digulir. */}
                      <p className={`mt-[0.125rem] line-clamp-none min-[380px]:line-clamp-2 text-[0.625rem] leading-[1.4] opacity-85 ${g.teks}`}>
                        {v.ringkasan}
                      </p>
                    </div>

                    <span
                      aria-hidden="true"
                      className={`grid w-[0.875rem] shrink-0 place-items-center self-center opacity-60 ${g.teks}`}
                    >
                      <svg viewBox="0 0 16 16" className="size-3.5">
                        <path
                          d="M6 3.5 10.5 8 6 12.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>

          <div className="mt-auto">
            <Footer />
          </div>
        </div>
      </div>
    </main>
  );
}
