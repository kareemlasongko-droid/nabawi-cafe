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
      {/*
        Bar ini WAJIB punya latar sendiri.

        Sebelumnya ia menempel tanpa latar, jadi kartu menu mengalir di
        belakang pil dan teksnya saling tabrakan — di /order hal ini
        ditangani `bg-bersih-50/95` + backdrop-blur.

        Warnanya hijau (forest-950/94), bukan terrakota seperti versi
        sebelumnya: latar halaman ini kini hijau seperti /tour, dan yang
        terrakota adalah kartunya. Bar terrakota + kartu terrakota akan
        menyatu, dan batas antara "saringan" dan "isi" hilang.

        `px-5` saja, TANPA `-mx-5`.
        Rencana awal `-mx-5 px-5` (bar lebih lebar dari kanvas) saya
        batalkan setelah dihitung: induk bar ini tidak punya padding,
        jadi -mx-5 mendorong latar bar 20px KELUAR kanvas di kiri dan
        kanan. Di HP 390px bar jadi 430px → scroll horizontal, dan di
        tablet latarnya menyeberang ke area gelap di luar kanvas.
        Dengan `px-5` saja, latar bar pas selebar kanvas dan pil tetap
        sejajar dengan isi halaman (section juga px-5).
      */}
      <div className="relative border-b border-forest-950/60 bg-forest-950/94 px-5 backdrop-blur-[6px]">
        <div
          ref={barisRef}
          role="group"
          aria-label="Saring menu menurut kategori"
          className="flex gap-[0.375rem] overflow-x-auto pb-[0.5rem] pt-[0.5rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
          /*
            `right-5` = selebar padding bar. Tanpa ini gradasi menutupi
            pil terakhir (ia menempel ke tepi LUAR bar, sedangkan pil
            berhenti di dalam padding). w-6 cukup untuk isyarat "masih
            ada lagi" tanpa memakan pil yang sedang dibaca.
          */
          className="pointer-events-none absolute inset-y-0 right-5 w-6 bg-gradient-to-l from-forest-950 to-transparent"
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
          DUA keadaan, dua latar. Sebelumnya pil pasif hanya bergaris —
          di atas bar terrakota ia terlihat seperti teks mengambang, bukan
          tombol.

          Pil TIDAK AKTIF: `cream-50/18` + teks krem, di bar hijau.
          Terukur terhadap bar hijau hasil blend (28,42,31):
            · teks    cream-50 di latar itu  → 8.30:1
            · vs bar  latar pil vs bar       → 1.78:1 (batas pil jelas)
            · vs aktif pil pasif vs cream-50 → 8.30:1
          Kandidat yang diukur lalu TOLAK:
            · cream-50/12 → batas vs bar cuma 1.45:1, pil nyaris hilang
            · cream-50/25 → batas 2.25:1, tapi pil mulai terlihat "aktif
              kedua" — dua tingkat krem di satu bar membingungkan
            · forest-900  → batas vs bar 1.09:1, praktis tak terlihat
          Sebelumnya halaman ini terrakota dan pil pasif memakai
          forest-950/50. Setelah latar jadi hijau, arahnya dibalik: pil
          pasif jadi krem transparan dan pil aktif tetap krem penuh.

          Pil AKTIF: cream-50 penuh + clay-700 → 6.77:1. Ia satu-satunya
          elemen krem di bar, jadi "yang dipilih" terbaca tanpa perlu
          diberi tahu.
        */
        aktif
          ? "bg-cream-50 text-clay-700 shadow-[0_2px_8px_-2px_rgba(20,35,26,0.45)]"
          : "bg-cream-50/18 text-cream-50 ring-1 ring-inset ring-cream-50/25",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
