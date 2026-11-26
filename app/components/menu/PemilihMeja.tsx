"use client";

/**
 * Pemilih meja untuk tombol "Pesan" di /menu.
 *
 * ── MASALAH YANG DIPERBAIKI ───────────────────────────────────────────
 *
 * Tombol pesan per kartu menu dulu menulis `/order?meja=&menu=<id>` —
 * nomor meja KOSONG. Portal pelanggan menolak nomor kosong, jadi tamu
 * yang menekan tombol itu mendarat di layar "Scan QR di meja Anda" dan
 * kehilangan menu yang sudah dipilihnya. Tombol yang dibuat untuk
 * mengurangi friksi justru membuat friksi baru.
 *
 * ── BENTUKNYA ────────────────────────────────────────────────────────
 *
 * Satu tombol "<n> meja" di bilah bawah. Menekannya membuka lembar
 * berisi daftar nomor meja. Setelah tamu memilih, tombolnya berubah jadi
 * "Pesan · Meja 7" dan tautan tiap kartu menu langsung membawa nomor
 * meja itu.
 *
 * ── KENAPA TIDAK OTOMATIS MEMILIHKAN ─────────────────────────────────
 *
 * Halaman /menu dibuka dari mana saja — bukan dari QR meja. Menebak meja
 * berarti pesanan mendarat di meja yang salah, dan itu kesalahan yang
 * jauh lebih mahal daripada satu ketukan tambahan. Tamu yang duduk di
 * meja 7 memilih 7 sendiri; tamu yang belum duduk melihat petunjuk
 * untuk memindai QR.
 *
 * Pilihan disimpan di localStorage supaya tamu yang membuka menu lagi
 * (mis. setelah menutup tab) tidak perlu memilih ulang.
 */

import { useEffect, useState } from "react";

type MejaRingkas = { nomor: string; area: string };

const KUNCI_MEJA = "nabawi.meja";

export function PemilihMeja({
  meja,
  tersedia,
}: {
  meja: MejaRingkas[];
  /**
   * `false` bila daftar meja gagal dimuat (env kosong / DB bermasalah).
   * UI lalu menampilkan petunjuk scan QR saja — dua jalan yang tetap
   * benar tanpa mengenal nomor meja.
   */
  tersedia: boolean;
}) {
  const [terbuka, setTerbuka] = useState(false);
  const [dipilih, setDipilih] = useState<string | null>(null);

  // Baca pilihan yang tersimpan. Di efek, bukan useState, supaya render
  // pertama di server dan klien sama (localStorage tidak ada di server).
  useEffect(() => {
    try {
      const ada = localStorage.getItem(KUNCI_MEJA);
      if (ada && meja.some((m) => m.nomor === ada)) setDipilih(ada);
    } catch {
      /* Mode privat: tamu cukup memilih ulang. */
    }
  }, [meja]);

  function pilih(nomor: string) {
    setDipilih(nomor);
    setTerbuka(false);
    try {
      localStorage.setItem(KUNCI_MEJA, nomor);
    } catch {
      /* Diabaikan: mengingat meja adalah kenyamanan, bukan syarat. */
    }

    /*
      Perbarui SEMUA tautan pesan sekaligus.

      Tautan kartu dirender server, jadi mengubahnya lewat state React
      akan berarti merender ulang 126 kartu. Cukup tulis ulang atribut
      `href`-nya: pola `/order?meja=&menu=<id>` diganti nomor meja.
    */
    for (const a of document.querySelectorAll<HTMLAnchorElement>("a[data-pesan]")) {
      const id = a.dataset.pesan;
      if (id) a.href = `/order?meja=${encodeURIComponent(nomor)}&menu=${id}`;
    }
  }

  /*
    Tanpa daftar meja: jangan tampilkan tombol yang tidak bisa dibuka.
    Petunjuk scan QR di bilah tetap ada (dirender halaman), jadi tamu
    tidak kehilangan jalan — hanya kehilangan pintasan.
  */
  if (!tersedia || meja.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setTerbuka(true)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-[0.625rem] border border-cream-50/30 bg-cream-50/10 px-3 text-left text-[0.8125rem] font-bold text-cream-50 backdrop-blur"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <IkonMeja />
          <span className="truncate">
            {dipilih ? `Meja ${dipilih}` : "Pilih meja Anda"}
          </span>
        </span>
        <span className="shrink-0 text-[0.6875rem] font-semibold text-cream-50/80">
          {dipilih ? "ganti" : `${meja.length} meja`}
        </span>
      </button>

      {terbuka && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-forest-950/60"
          role="dialog"
          aria-modal="true"
          aria-label="Pilih meja"
        >
          <button
            type="button"
            aria-label="Tutup pemilih meja"
            onClick={() => setTerbuka(false)}
            className="flex-1"
          />
          <div className="max-h-[80dvh] overflow-y-auto rounded-t-[1.25rem] bg-cream-50 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="sticky top-0 flex items-center gap-2 border-b border-bersih-200 bg-cream-50 px-4 py-3">
              <h2 className="flex-1 text-[0.9375rem] font-extrabold text-tinta-900">
                Anda duduk di meja berapa?
              </h2>
              <button
                type="button"
                onClick={() => setTerbuka(false)}
                className="grid size-11 place-items-center rounded-[0.625rem] border border-bersih-200 text-tinta-900"
                aria-label="Tutup"
              >
                <IkonSilang />
              </button>
            </div>

            <p className="px-4 pt-3 text-[0.75rem] leading-snug text-tinta-500">
              Nomornya tertempel di meja. Kalau tidak menemukannya, panggil pelayan
              atau pindai QR di meja Anda.
            </p>

            {/*
              Daftar tombol, bukan <select>. Di ponsel, <select> membuka
              pemilih bawaan sistem yang menutupi seluruh layar dan
              mengharuskan menekan "Selesai" — dua ketukan lebih banyak
              untuk satu pilihan yang bisa diselesaikan satu ketukan.
            */}
            <ul className="mt-3 grid grid-cols-4 gap-2 px-4">
              {meja.map((m) => (
                <li key={m.nomor}>
                  <button
                    type="button"
                    onClick={() => pilih(m.nomor)}
                    aria-current={dipilih === m.nomor ? "true" : undefined}
                    className={[
                      "flex h-14 w-full flex-col items-center justify-center rounded-[0.625rem] text-[0.9375rem] font-extrabold tabular-nums transition",
                      dipilih === m.nomor
                        ? "bg-forest-900 text-cream-50"
                        : "border border-bersih-200 bg-bersih-0 text-tinta-900 active:bg-bersih-100",
                    ].join(" ")}
                  >
                    {m.nomor}
                    {/* Area hanya ruang teks kecil — membantu saat meja
                        bernomor sama di dua area (mis. "Teras 3" dan
                        "Indoor 3" adalah dua meja berbeda). */}
                    {m.area && (
                      <span
                        className={[
                          "mt-0.5 max-w-full truncate px-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide",
                          dipilih === m.nomor ? "text-cream-50/80" : "text-tinta-500",
                        ].join(" ")}
                      >
                        {m.area}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            <p className="mt-3 px-4 pb-1 text-center text-[0.6875rem] leading-snug text-tinta-500">
              Memilih meja yang salah membuat pesanan diantar ke meja lain.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function IkonMeja() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M3 8.5h14M5.5 8.5v7M14.5 8.5v7M10 4v4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M7.5 4h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IkonSilang() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
