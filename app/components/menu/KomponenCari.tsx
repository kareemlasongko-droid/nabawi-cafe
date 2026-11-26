"use client";

/**
 * Kotak cari /menu.
 *
 * ── KENAPA INI KOMPONEN KLIEN TERPISAH ────────────────────────────────
 *
 * Daftar 126 kartu dirender di server. Kalau pencarian ada di dalam
 * halaman yang sama, setiap ketikan akan merender ulang 126 kartu — di
 * ponsel itu berarti keyboard terasa berat dan foto berkedip.
 *
 * Di sini pencarian TIDAK menyentuh daftar sama sekali. Ia hanya menulis
 * atribut `hidden` pada elemen yang sudah ada di DOM. Tidak ada React di
 * jalur pencarian sesudah render pertama, dan tidak ada kartu yang
 * dirender ulang.
 *
 * ── KENAPA TIDAK MEMAKAI CSS `:has()` / data-attribute seperti saringan
 *    kategori ────────────────────────────────────────────────────────
 *
 * Saringan kategori menulis `data-saring` ke <body> dan membiarkan CSS
 * menyembunyikan kartu. Untuk pencarian, teks yang dicocokkan ada di
 * 126 atribut berbeda — CSS tidak bisa membandingkan dua atribut tanpa
 * `:has()` per kombinasi. JavaScript di sini lebih sederhana dan bisa
 * memberi tahu jumlah hasil, yang justru bagian terpentingnya.
 */

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Hanya daftar id. Teks pencarian tidak dikirim sama sekali — baik lewat
 * props maupun lewat atribut — karena keduanya sama-sama berakhir di
 * payload RSC. Teksnya dibaca dari isi kartu yang sudah tampil.
 */
type Ringkas = { id: number };

export function KomponenCari({
  ringkas,
  kelompok,
}: {
  ringkas: Ringkas[];
  kelompok: { id: number; nama: string }[];
}) {
  const [kueri, setKueri] = useState("");
  const [jumlah, setJumlah] = useState(ringkas.length);
  const refInput = useRef<HTMLInputElement>(null);
  /*
    Indeks teks dibaca dari DOM sekali, saat komponen dipasang.

    Disimpan di ref, bukan state: membacanya tidak boleh memicu render,
    dan isinya tidak pernah berubah selama halaman hidup (kartu hanya
    disembunyikan, tidak pernah dibuat ulang).
  */
  const indeks = useRef<{ id: number; teks: string }[] | null>(null);

  /*
    Kata kunci dipecah per spasi dan SEMUA harus cocok (AND), bukan salah
    satu (OR). "nasi goreng" harus mempersempit ke nasi goreng, bukan
    menampilkan semua nasi DAN semua gorengan — perilaku OR membuat kotak
    cari terasa tidak bekerja pada daftar 126 menu.
  */
  const kata = useMemo(
    () => kueri.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [kueri],
  );

  const cocok = useMemo(() => {
    if (kata.length === 0) return null;
    if (!indeks.current) {
      /*
        Sekali saja: baca teks yang SUDAH ADA di kartu.

        `textContent` mengambil nama, deskripsi, dan daftar pilihan
        sekaligus — persis yang dicari tamu — tanpa satu byte tambahan di
        HTML maupun di payload RSC. Dilakukan di sini (bukan di useEffect)
        supaya ketikan pertama sudah benar: efek berjalan sesudah render,
        jadi hasil ketikan pertama akan salah kalau indeksnya belum ada.

        `toLowerCase()` sekali per kartu, bukan per ketikan.
      */
      const akar = typeof document === "undefined" ? null : document.getElementById("daftar-menu");
      indeks.current = akar
        ? [...akar.querySelectorAll<HTMLElement>("li[data-menu]")].map((li) => ({
            id: Number(li.dataset.menu),
            teks: (li.textContent ?? "").toLowerCase(),
          }))
        : [];
    }
    const set = new Set<number>();
    for (const m of indeks.current) {
      if (kata.every((k) => m.teks.includes(k))) set.add(m.id);
    }
    return set;
  }, [kata]);

  /*
    Terapkan ke DOM — BUKAN state React.

    `useEffect` berjalan sesudah render, jadi biayanya satu lintasan
    querySelectorAll atas 126 elemen: di bawah 1ms, dan tidak ada
    rekonsiliasi React. `hidden` dipakai (bukan `display:none` lewat
    kelas) karena `hidden` tidak bisa ditimpa aturan CSS lain di halaman
    dan terbaca benar oleh pembaca layar.
  */
  useEffect(() => {
    const akar = document.getElementById("daftar-menu");
    if (!akar) return;

    // 1. Kartu
    const kartu = akar.querySelectorAll<HTMLElement>("li[data-menu]");
    for (const li of kartu) {
      const id = Number(li.dataset.menu);
      li.hidden = cocok !== null && !cocok.has(id);
    }

    // 2. Seksi yang seluruh kartunya tersembunyi.
    //    Judul kategori kosong ("KOPI 0") adalah kebingungan yang dibuat
    //    sendiri; kalau tidak ada isinya, judulnya ikut disembunyikan.
    for (const seksi of akar.querySelectorAll<HTMLElement>("section[data-kat]")) {
      const ada = [...seksi.querySelectorAll<HTMLElement>("li[data-menu]")].some(
        (li) => !li.hidden,
      );
      seksi.hidden = !ada;
    }

    setJumlah(cocok === null ? ringkas.length : cocok.size);
  }, [cocok, ringkas.length]);

  const kosong = cocok !== null && cocok.size === 0;

  return (
    <div>
      <label className="flex h-11 items-center gap-2 rounded-[0.625rem] bg-cream-50/95 px-3 shadow-[0_6px_18px_-12px_rgba(0,0,0,0.7)]">
        <IkonCari />
        <input
          ref={refInput}
          value={kueri}
          onChange={(e) => setKueri(e.target.value)}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          placeholder="Cari menu — mis. matcha, sambal"
          aria-label="Cari menu"
          aria-describedby="cari-jumlah"
          /* 16px di ponsel: di bawah itu iOS memperbesar halaman saat
             kotak difokus, dan halaman yang memperbesar diri sendiri
             membuat pil kategori di bawahnya bergeser keluar layar. */
          className="w-full bg-transparent text-[1rem] font-semibold text-tinta-900 outline-none placeholder:font-normal placeholder:text-tinta-500"
        />
        {kueri && (
          <button
            type="button"
            onClick={() => {
              setKueri("");
              refInput.current?.focus();
            }}
            aria-label="Hapus pencarian"
            className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-tinta-500 active:bg-bersih-100"
          >
            <IkonHapus />
          </button>
        )}
      </label>

      {/*
        Pengumuman hasil, ARIA live.

        Dibaca pembaca layar setiap kali jumlah berubah, dan terlihat oleh
        semua orang saat nol hasil. Kalimat "0 menu cocok" sengaja tidak
        disembunyikan secara visual: daftar kosong tanpa penjelasan terbaca
        sebagai halaman gagal, dan tamu akan menutup tab alih-alih
        menghapus kata kuncinya.
      */}
      <div aria-live="polite" id="cari-jumlah">
        {kosong ? (
          <div className="mt-2 rounded-[0.625rem] bg-forest-950/70 px-3 py-2.5 text-center backdrop-blur">
            <p className="text-[0.75rem] font-bold leading-snug text-cream-50">
              Tidak ada menu yang cocok dengan &ldquo;{kueri.trim()}&rdquo;
            </p>
            <p className="mt-0.5 text-[0.6875rem] leading-snug text-white/85">
              Coba kata lain, atau lihat semua menu.
            </p>
            <button
              type="button"
              onClick={() => {
                setKueri("");
                refInput.current?.focus();
              }}
              className="mt-2 h-11 rounded-[0.5rem] bg-cream-50 px-4 text-[0.8125rem] font-extrabold text-forest-900"
            >
              Hapus pencarian
            </button>
          </div>
        ) : (
          cocok !== null && (
            <p className="mt-1.5 text-center text-[0.6875rem] font-semibold text-white/85">
              {jumlah} menu cocok · {kelompok.length} kategori
            </p>
          )
        )}
      </div>
    </div>
  );
}

function IkonCari() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-tinta-500" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="m12.5 12.5 3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IkonHapus() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
