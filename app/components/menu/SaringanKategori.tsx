"use client";

/**
 * Saringan kategori untuk /menu.
 *
 * BENTUKNYA MENGIKUTI /order: satu baris pil yang bisa digeser
 * horizontal, menempel di bawah navbar saat halaman digulir, dengan
 * gradasi tipis di tepi kanan sebagai isyarat "masih ada kategori lain".
 *
 * BEDA YANG DISENGAJA DARI /order
 * Di /order, saringan menyembunyikan kartu yang tidak cocok (`display`
 * diatur ulang tiap render). Di sini saringan hanya MENGUBAH
 * `data-saring` pada <body> dan sisanya dikerjakan CSS:
 *
 *     body[data-saring="3"] [data-kat]:not([data-kat="3"]) { display: none }
 *
 * Alasannya bukan gaya-gayaan. Server merender SELURUH 126 kartu, lalu
 * browser menerapkan aturan di atas sebelum melukis apa pun. Artinya:
 *   · tanpa JS, daftar tetap lengkap (halaman ini sering dibuka dari QR);
 *   · tidak ada 126 kartu yang dihidrasi ulang saat pil ditekan —
 *     React tidak menyentuh daftarnya sama sekali;
 *   · menyaring jadi kerja CSS, bukan kerja render ulang.
 *
 * KENAPA TIDAK MEMAKAI TAUTAN JANGKAR (#kategori-3)
 * Itu memang nol JS, tapi tidak menyaring: tamu tetap melihat semua
 * kategori dan harus menggulir sendiri. Permintaan pemilik jelas —
 * "filter menu seperti halaman order" — dan di /order pil itu benar-
 * benar menyembunyikan yang tidak relevan.
 */

import { useEffect, useRef, useState } from "react";
import type { KategoriMenu } from "@/app/lib/order/tipe";

type Props = { kategori: KategoriMenu[] };

/** `"semua"` atau id kategori. */
type Aktif = number | "semua";

export function SaringanKategori({ kategori }: Props) {
  const [aktif, setAktif] = useState<Aktif>("semua");
  const barisRef = useRef<HTMLDivElement>(null);

  /*
    `data-saring` ditulis ke <body>, bukan ke elemen di dalam halaman.

    Kalau atributnya ditaruh di <main>, CSS-nya harus memakai :has() untuk
    menjangkau kartu — dan :has() baru ada di Safari 15.4+. <body> bisa
    dijangkau dari mana saja, termasuk dari baris pil yang menempel ini.
    Dibersihkan saat komponen dilepas supaya tidak tertinggal ke halaman
    lain saat navigasi klien.
  */
  useEffect(() => {
    const b = document.body;
    if (aktif === "semua") b.removeAttribute("data-saring");
    else b.setAttribute("data-saring", String(aktif));
    return () => b.removeAttribute("data-saring");
  }, [aktif]);

  /*
    Pilih kategori → gulir ke judul kategorinya.

    Tanpa ini, tamu yang menekan "Kopi" saat sedang di bagian "Jus &
    Dessert" akan melihat layar kosong: kartu di atasnya hilang, tapi
    pandangan matanya tetap di posisi lama. `scrollIntoView` dipanggil
    dengan `block: "start"` lalu dikoreksi `scroll-margin-top` di CSS
    sebesar tinggi navbar + baris pil.
  */
  /** Cadangan untuk kategori ber-id tidak valid: menempel ke judulnya. */
  function lompatKe(id: number) {
    document.getElementById(`kategori-${id}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function pilih(nilai: Aktif) {
    setAktif(nilai);
    if (nilai === "semua") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const target = document.getElementById(`kategori-${nilai}`);
    target?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return (
    /*
      `top-[calc(...)]` = tinggi navbar sebenarnya.
      Navbar: pt max(0.5rem, safe-area) + nav h-[4rem] (HP) / h-[4.625rem]
      (tablet). Angka ini WAJIB ikut berubah kalau Navbar berubah — bug
      lama di /order (68px vs 60px) terjadi persis karena angka ini tidak
      pernah diperbarui.
    */
    <div className="sticky top-[calc(max(0.5rem,env(safe-area-inset-top))+4rem)] z-20 tablet:top-[calc(max(0.75rem,env(safe-area-inset-top))+4.625rem)]">
      <div className="relative">
        <div
          ref={barisRef}
          role="group"
          aria-label="Saring menu menurut kategori"
          className="flex gap-[0.375rem] overflow-x-auto px-5 pb-[0.625rem] pt-[0.375rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Pil aktif={aktif === "semua"} onClick={() => pilih("semua")}>
            Semua
          </Pil>
          {kategori.map((k) => (
            <Pil
              key={k.id}
              aktif={aktif === k.id}
              /*
                Kategori yang id-nya tidak bulat (NaN, pecahan) TIDAK bisa
                disaring: aturan CSS-nya ditulis dengan id yang sama, jadi
                menekannya akan menyembunyikan seluruh daftar. Pilnya tetap
                ditampilkan — menyembunyikan kategori dari tamu karena satu
                baris data rusak lebih buruk — tetapi ia melompat ke judul
                kategorinya saja, seperti tautan jangkar.
              */
              onClick={() => (Number.isInteger(k.id) ? pilih(k.id) : lompatKe(k.id))}
            >
              {k.nama}
            </Pil>
          ))}
        </div>
        {/* Isyarat tepi: pil terakhir terpotong gradasi, bukan terpotong
            mendadak — tanpa ini tamu mengira kategori yang terlihat saja
            yang ada. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-clay-600 to-transparent"
        />
      </div>
    </div>
  );
}

function Pil({
  aktif,
  onClick,
  children,
}: {
  aktif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktif}
      className={[
        "shrink-0 rounded-full px-[0.6875rem] py-[0.3125rem] text-[0.75rem] font-bold transition active:scale-[0.97]",
        /*
          Pil AKTIF: krem penuh + teks clay-700 → 6.77:1.
          Pil PASIF: `text-cream-50` penuh, TIDAK diredupkan. Di atas
          terrakota hanya cream-50 penuh yang lolos (5.01:1);
          `cream-50/70` tinggal 3.04:1 dan gagal untuk teks kecil.
          Bedanya pil aktif vs pasif dibawa oleh latar + bayangan, bukan
          oleh opasitas teks.
        */
        aktif
          ? "bg-cream-50 text-clay-700 shadow-[0_2px_8px_-2px_rgba(20,35,26,0.45)]"
          : "border border-cream-50/60 text-cream-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
