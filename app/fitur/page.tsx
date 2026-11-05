import type { Metadata } from "next";
import Image from "next/image";
import { Footer } from "../components/Footer";
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
 * Halaman ini FIXED setinggi satu layar — tidak ada scroll. Konsekuensinya
 * tidak boleh ada isi yang melebihi layar: navbar 86px + footer 68px +
 * jarak 28px menyisakan 495px untuk tiga kartu di layar terpendek
 * (iPhone SE 667px), dan tiap kartu mengisi 165px. Kalau nanti kartu
 * ditambah, jangan tambah keempat-empatnya di halaman ini tanpa mengukur
 * ulang — lihat catatan di MenuCards.tsx.
 *
 * Sama seperti beranda: Server Component tanpa JavaScript. Navigasi pulang
 * memakai <a href="/"> biasa di navbar, jadi tetap berfungsi di Safari
 * iOS 15 (iPhone 7) yang gagal menjalankan bundle modern.
 */
export default function FiturPage() {
  return (
    <main className="flex min-h-dvh justify-center bg-forest-950">
      {/* Kanvas mobile-only, lebar maks 440px — sama dengan beranda.
          Di layar lebih lebar (tablet) kanvas tetap 440px di tengah. */}
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

        {/* Satu layar penuh, tanpa gulir (diminta). `h-dvh` mengikuti tinggi
            layar dinamis (aman dari address bar Safari iOS), `overflow-hidden`
            memastikan tidak ada sisa piksel yang bisa digulir, dan `flex-1`
            pada blok kartu membuatnya mengambil sisa ruang setelah navbar dan
            footer — jadi tidak ada ruang menganggur di layar tinggi.

            PENGECUALIAN layar pendek (< 600px, umumnya HP lanskap): `pendek:`
            mengubahnya jadi `h-auto` + `min-h-dvh` sehingga halaman BOLEH
            digulir. Di 844x390 ruang untuk kartu hanya ~240px sedangkan
            kebutuhannya 279px — memaksa fixed di situ berarti isi terpotong. */}
        {/* Lapisan isi dibatasi selebar kanvas (440px) dan diletakkan di
            tengah, jadi di tablet pun isinya tetap selebar ponsel. */}
        <div className="relative flex h-dvh flex-col overflow-hidden *:mx-auto *:w-full *:max-w-[27.5rem] pendek:h-auto pendek:min-h-dvh pendek:overflow-y-auto">
          <Navbar />

          {/* Judul bagian (diminta). Dua baris dengan peran berbeda:
              "JELAJAHI" kecil, tidak tebal, huruf jarang — berfungsi sebagai
              penanda; "Fitur Unggulan" besar dan tebal berwarna putih murni
              (#FFFFFF) sebagai judul. Keduanya rata tengah (diminta).

              Jarak ke kartu di bawahnya dibuat
              rapat supaya tinggi yang dimakan tetap kecil — halaman ini
              dipaksa muat satu layar.

              Catatan keterbacaan: di atas ilustrasi ini teks putih hanya
              mencapai kontras 2.0-2.9:1 (terukur dari piksel latar di
              belakang judul), sedangkan ambang WCAG untuk teks besar 3:1.
              Warnanya tetap #FFFFFF sesuai permintaan, jadi sebagai
              penolong dipasang bayangan gelap tipis (text-shadow) yang
              tidak mengubah warna teks maupun tata letak. Kalau suatu saat
              perlu kontras penuh, obatnya bukan mengganti warna melainkan
              menambah lapisan gelap di belakang blok judul ini. */}
          <div className="px-5 pt-[0.625rem] pb-[0.625rem] text-center tablet:pt-[0.75rem] tablet:pb-[0.75rem]">
            <p className="text-[0.625rem] leading-none font-medium tracking-[0.16em] text-white/75 tablet:text-[0.6875rem]">
              JELAJAHI
            </p>
            <h1 className="mt-[0.1875rem] text-[1.25rem] leading-[1.1] font-extrabold tracking-[-0.01em] text-[#ffffff] [text-shadow:0_1px_10px_rgba(20,35,26,0.55)] tablet:text-[1.375rem]">
              Fitur Unggulan
            </h1>
          </div>

          {/* Tiga kartu menu mengisi semua sisa ruang di antara judul dan
              footer. `min-h-0` wajib: tanpa itu item flex menolak mengecil
              di bawah tinggi isinya dan halaman justru memanjang. Padding
              atas DIHAPUS (pt-0) karena jarak dari judul sudah diurus blok
              judul di atasnya. Kalau dibiarkan, keduanya menumpuk jadi 14px.

              Angka ruangnya (terukur): di 320x568 tinggi layar 568px
              sedangkan header 72 + judul 39 + tiga kartu 360 + celah 20
              + footer 60 = 551px. Menambah margin 6px atas + 6px bawah
              pada judul membuat totalnya 563px... 575px, yaitu 7px lebih
              dari layar. Karena tinggi 568px sudah masuk rentang `pendek`
              (<600px), halaman di ukuran itu memang boleh tergulir
              sedikit; di 360px ke atas ruangnya masih longgar sehingga
              tetap tanpa gulir. */}
          <div className="min-h-0 flex-1 px-5 pt-0 pb-[0.625rem]">
            <MenuCards />
          </div>

          {/* Footer selalu di dasar layar. Karena induknya sudah setinggi
              satu layar dan blok kartu `flex-1`, footer otomatis terdorong
              ke bawah tanpa perlu `mt-auto`. Lebarnya mengikuti batas isi
              induk (640px di tablet), sama dengan kartu di atasnya. */}
          <Footer />
        </div>
      </div>
    </main>
  );
}
