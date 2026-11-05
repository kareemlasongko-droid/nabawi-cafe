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
 * Tanpa JavaScript dan tanpa tag <a>: alamat akun di lampiran hanya
 * "@nabawi.cafe" tanpa URL, jadi belum dijadikan tautan agar tidak menuju
 * alamat yang salah. Ikonnya hanya penanda visual (aria-hidden).
 */
export function Footer() {
  return (
    <footer className="relative z-20 px-5 pt-[0.875rem] pb-[max(0.875rem,env(safe-area-inset-bottom))]">
      <div className="flex h-[3.25rem] items-center justify-center gap-[0.625rem] rounded-[1.5rem] bg-white/80 px-[0.75rem]">
        <Image
          src="/images/icon-instagram.png"
          alt=""
          aria-hidden="true"
          width={20}
          height={20}
          className="size-5 shrink-0"
        />

        <span className="text-[0.78125rem] leading-none font-extrabold text-ink-900">
          @nabawi.cafe
        </span>

        {/* pemisah titik di tengah tinggi baris */}
        <span
          aria-hidden="true"
          className="size-[0.3125rem] shrink-0 rounded-full bg-ink-900"
        />

        <span className="text-[0.78125rem] leading-none font-extrabold text-[#008b19]">
          Setiap Hari 09.00 – 21.00
        </span>
      </div>
    </footer>
  );
}
