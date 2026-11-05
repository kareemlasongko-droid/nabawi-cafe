import Image from "next/image";

/**
 * Footer halaman menu — mengikuti lampiran `footer.png` (400×52).
 *
 * Angka di bawah hasil pengukuran piksel gambar tersebut:
 *   bentuk   bilah penuh 400×52, keempat sudut membulat, radius ≈24px
 *            (pencocokan kurva: R=24 galat 0.5px)
 *   latar    putih alpha 204/255 = 80% — persis nilai yang diminta.
 *            Di mockup latarnya sudah 80%, jadi opacity tidak ditumpuk lagi.
 *   isi      satu baris, rata tengah, jarak antar bagian 10px:
 *              ikon  kotak navy membulat 20×20 (dipotong dari lampiran)
 *              akun  "@nabawi.cafe"  navy #2d264b, 12.5px/800
 *              dot   pemisah 5×5 navy
 *              jam   "Setiap Hari 09.00 – 21.00"  hijau #008b19, 12.5px/800
 *
 * Ukuran font dicocokkan, bukan dikira-kira: 12.5px/800 menghasilkan
 * 89.3px (target 89) untuk akun dan 155.6px (target 155) untuk jam.
 *
 * CATATAN: tinggi bilah diringkas 52 -> 48px dan padding luar 14 -> 10px
 * (total 80 -> 68px) agar halaman menu bisa muat dalam satu layar tanpa
 * scroll. Ukuran isi (ikon 20px, teks 12.5px) TIDAK diubah di layar normal.
 *
 * SKALA RESPONSIF (permintaan: di HP diperkecil, di tablet penuh):
 *   < 768px  bilah 44px, ikon 18px, teks 11.5px  (dulu 48/20/12.5 + aturan
 *            khusus di bawah 360px yang kini tidak perlu lagi: isi bilah
 *            turun dari 283px ke 253px sehingga layar 320px pun muat
 *            tanpa penyesuaian tambahan)
 *   >= 768px  bilah 48px, ikon 20px, teks 12.5px — ukuran hasil pengukuran
 *            lampiran, dipakai lagi di tablet.
 *
 * Tanpa JavaScript dan tanpa tag <a>: alamat akun di lampiran hanya
 * "@nabawi.cafe" tanpa URL, jadi belum dijadikan tautan agar tidak menuju
 * alamat yang salah. Ikonnya hanya penanda visual (aria-hidden).
 */
export function Footer() {
  return (
    <footer className="relative z-20 shrink-0 px-4 pt-[0.5rem] pb-[max(0.5rem,env(safe-area-inset-bottom))] tablet:px-5 tablet:pt-[0.625rem] tablet:pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      <div className="flex h-[2.75rem] items-center justify-center gap-[0.5rem] rounded-[1rem] bg-white/80 px-[0.625rem] tablet:h-[3rem] tablet:gap-[0.625rem] tablet:rounded-[1.25rem] tablet:px-[0.75rem]">
        <Image
          src="/images/icon-instagram.png"
          alt=""
          aria-hidden="true"
          width={20}
          height={20}
          className="size-[1.125rem] shrink-0 tablet:size-5"
        />

        <span className="text-[0.71875rem] leading-none font-extrabold whitespace-nowrap text-ink-900 tablet:text-[0.78125rem]">
          @nabawi.cafe
        </span>

        {/* pemisah titik di tengah tinggi baris */}
        <span
          aria-hidden="true"
          className="size-[0.25rem] shrink-0 rounded-full bg-ink-900 tablet:size-[0.3125rem]"
        />

        <span className="text-[0.71875rem] leading-none font-extrabold whitespace-nowrap text-[#008b19] tablet:text-[0.78125rem]">
          Setiap Hari 09.00 – 21.00
        </span>
      </div>
    </footer>
  );
}
