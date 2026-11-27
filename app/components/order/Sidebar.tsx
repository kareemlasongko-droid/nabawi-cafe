"use client";

/**
 * Sidebar portal staf — navbar samping yang berubah bentuk menurut layar.
 *
 * ── TIGA BENTUK, SATU KOMPONEN ────────────────────────────────────────
 *
 *   < 768px   RAIL 72px, hanya ikon + lencana. Tetap terlihat, tidak
 *             memakan lebar. Tidak ada tombol "buka menu" — menu yang
 *             butuh dibuka dulu berarti satu ketukan tambahan untuk
 *             setiap perpindahan, dan itu satu-satunya navigasi di layar.
 *
 *   ≥ 768px   SIDEBAR 232px dengan label. Tablet 10" (perangkat yang
 *             benar-benar dipakai kasir) punya ruang untuk itu, dan
 *             label membuat staf baru tidak perlu menebak ikon.
 *
 *   ≥ 1280px  SIDEBAR 256px, area sentuh lebih lega.
 *
 * ── KENAPA BUKAN LACI GESER DI PONSEL ────────────────────────────────
 *
 * Laci butuh: tombol buka, latar gelap, tombol tutup, dan menangani
 * tombol kembali perangkat. Empat hal yang bisa salah, untuk menu berisi
 * empat tujuan. Rail ikon selalu terlihat, satu ketukan untuk berpindah,
 * dan tidak ada keadaan yang perlu ditutup.
 *
 * ── AKSESIBILITAS ────────────────────────────────────────────────────
 *
 * `<nav>` dengan `aria-label`, tiap tujuan `<a>` sungguhan (bukan
 * handler onClick) sehingga bisa dibuka di tab baru dan tetap bekerja
 * walau JS gagal. `aria-current="page"` menandai yang aktif.
 */

import Link from "next/link";
import type { ComponentType } from "react";
import { LogoNabawi } from "./LogoNabawi";

export type ItemSidebar = {
  kunci: string;
  label: string;
  /**
   * Tujuan navigasi. Salah satu:
   *
   *   · `onPilih` diisi → item dirender sebagai `<button>` yang memanggil
   *     `onPilih(kunci)`. Ini yang dipakai kasir: memilih LAYAR, bukan
   *     melompat ke anchor. `<button>` karena ia mengubah keadaan, bukan
   *     berpindah dokumen — dan pembaca layar mengumumkannya sebagai
   *     kontrol, bukan tautan.
   *   · `onPilih` kosong → `<Link href>`, untuk portal yang memang
   *     berpindah halaman.
   */
  href: string;
  Ikon: ComponentType<{ className?: string }>;
  /** Angka kecil di samping label. 0 = tidak ditampilkan. */
  lencana?: number;
  /** Warna lencana: "sela" untuk yang butuh tindakan, "netral" untuk hitungan. */
  warna?: "sela" | "netral";
};

export function Sidebar({
  judul,
  item,
  aktif,
  kaki,
  onPilih,
  terbuka = true,
  onToggle,
}: {
  /** Nama portal, tampil di atas. "Kasir", "Dapur & Bar", dst. */
  judul: string;
  item: ItemSidebar[];
  /** `kunci` tujuan yang sedang dibuka. */
  aktif: string;
  /** Bila diisi, item jadi tombol pemilih layar, bukan tautan. */
  onPilih?: (kunci: string) => void;
  /**
   * Bila `false`, sidebar menyusut jadi rel ikon saja di SEMUA lebar
   * layar. Tidak dihapus dari DOM dan tidak digeser keluar layar — rel
   * ikon tetap ada karena kasir masih harus bisa memilih layar lain
   * setelah menyembunyikannya. Tanpa rel, "sembunyikan" sama dengan
   * "keluar dari aplikasi".
   */
  terbuka?: boolean;
  /** Bila diisi, tombol lipat muncul. Bila tidak, lebar mengikuti layar. */
  onToggle?: () => void;
  /** Isi bagian bawah sidebar (mis. penanda mode demo). */
  kaki?: React.ReactNode;
}) {
  return (
    <nav
      id="navigasi-portal-staf"
      aria-label={`Navigasi ${judul}`}
      className={[
        "sticky top-0 z-30 flex h-dvh shrink-0 flex-col",
        "border-r border-cream-50/10 bg-forest-950 text-cream-50",
        /*
          Lebar bertingkat. `w-[4.5rem]` = 72px: cukup untuk ikon 24px,
          lencana, dan area sentuh 56px tanpa label terpotong.
        */
        terbuka ? "w-[4.5rem] md:w-[14.5rem] xl:w-64" : "w-[4.5rem]",
        "print:hidden",
      ].join(" ")}
    >
      {/*
        ── IDENTITAS: LOGO YANG SAMA DENGAN NAVBAR ──────────────────────

        Sebelumnya huruf "N" dalam kotak — monogram buatan sendiri.
        Alasannya waktu itu: logo asli memuat nama kafe di dalamnya,
        sehingga pada rel 72px ia "hanya tampak sebagai noda".

        Alasan itu tidak berlaku lagi karena dua hal. Pertama, logonya
        bulat dan dibaca sebagai merek bahkan dalam 28px — sama seperti
        favicon. Kedua, dan lebih penting: portal ini dipakai bergantian
        dengan aplikasi lain di perangkat yang sama, dan dua logo berbeda
        untuk satu kafe membuat staf ragu apakah mereka masih di sistem
        yang sama. Identitas harus persis sama di mana pun ia muncul.
      */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-cream-50/10 px-3 md:px-4">
        {/*
          ── LOGO SAAT TERBUKA, IKON LIPAT SAAT DISEMBUNYIKAN ──────────

          Saat rel 72px, logo diganti tombol lipat itu sendiri — dan
          tombolnya diberi bentuk logo, bukan dibiarkan sebagai panah
          kecil. Alasannya ruang: di 72px, logo 32px + tombol 36px tidak
          bisa berdampingan tanpa salah satunya terpotong.

          Konsekuensi yang harus dijaga: tombol ini jadi satu-satunya
          isyarat "klik untuk membuka", jadi ia harus TERLIHAT seperti
          tombol (latar, cincin) — bukan logo mati. Panahnya kecil di
          sudut, dan `title` + `sr-only` tetap menyebut aksinya.

          Saat terbuka, tombol panah pindah ke ujung kanan seperti biasa.
        */}
        {terbuka || !onToggle ? (
          <LogoNabawi tema="gelap" ukuran={32} hanyaLogo label="Nabawi Cafe" />
        ) : null}
        {terbuka && (
          <div className="hidden min-w-0 flex-1 md:block">
            <p className="truncate text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-cream-50/60">
              Nabawi Cafe
            </p>
            <p className="truncate text-[0.9375rem] font-extrabold leading-tight">{judul}</p>
          </div>
        )}

        {/*
          ── TOMBOL LIPAT: IKON SAJA, DI KEPALA ────────────────────────

          Dulu tombol teks "Sembunyikan" di kaki. Dipindah ke kepala,
          sebaris dengan logo dan nama kafe, karena:

          1. Ia mengatur lebar sidebar — tempatnya di sidebar itu sendiri,
             bukan di kaki yang jarang dilewati mata saat kasir bekerja.
          2. Ikon saja: kata "Sembunyikan" panjang dan mendorong logo serta
             nama kafe keluar dari rel 72px. Panah panel samping sudah
             dibaca benar oleh siapa pun yang pernah memakainya.

          Ikonnya BERUBAH ARAH, bukan berputar: panah kiri = lipat, panah
          kanan = buka. Tombol yang hanya berputar 180° terbaca sebagai
          hiasan.

          Disembunyikan di bawah 768px: sidebar di ponsel sudah berupa rel
          72px yang tidak bisa lebih sempit, jadi melipatnya tidak
          menghemat apa pun.

          `aria-expanded` + `aria-controls` tetap ada — ikon tanpa teks
          tidak memberi tahu pembaca layar apakah sidebar sedang terbuka.
        */}
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={terbuka}
            aria-controls="navigasi-portal-staf"
            title={terbuka ? "Sembunyikan sidebar" : "Tampilkan sidebar"}
            className={[
              /*
                Dua bentuk, satu tombol.

                TERBUKA: ikon 36px di ujung kanan kepala, tanpa latar —
                ia alat, bukan identitas.

                TERTUTUP: kotak 40px berisi logo, karena di rel 72px ia
                satu-satunya hal yang tersisa di kepala. Latar `cream-50/10`
                + cincin membuatnya terbaca sebagai tombol yang bisa
                ditekan, bukan sebagai logo mati. Panah kecil menempel di
                sudut kanan bawah supaya arah aksinya tetap terbaca.
              */
              "relative shrink-0 text-cream-50/60 transition hover:text-cream-50",
              terbuka
                ? "ml-auto hidden size-9 place-items-center rounded-[0.5rem] hover:bg-cream-50/10 md:grid"
                : "grid size-10 place-items-center rounded-[0.625rem] bg-cream-50/10 ring-1 ring-inset ring-cream-50/15 hover:bg-cream-50/20",
            ].join(" ")}
          >
            {terbuka ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="size-[1.125rem]"
              >
                <path d="M4 5.5h16M4 12h7M4 18.5h16M20.5 8.5 17 12l3.5 3.5" />
              </svg>
            ) : (
              /*
                Logo, bukan panah. `next/image` dipakai ulang lewat
                LogoNabawi supaya ukuran optiknya sama dengan logo di
                sidebar terbuka — logo yang tampak berbeda ukuran saat
                dilipat akan terlihat seperti gambar yang salah muat.
              */
              <span className="relative grid place-items-center">
                <LogoNabawi tema="gelap" ukuran={26} hanyaLogo label="Nabawi Cafe" />
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="absolute -bottom-1 -right-1.5 size-3 rounded-full bg-forest-950 text-cream-50"
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </span>
            )}
            <span className="sr-only">
              {terbuka ? "Sembunyikan sidebar" : "Tampilkan sidebar"}
            </span>
          </button>
        )}
      </div>

      {/* ── Tujuan ── */}
      <ul className="flex-1 space-y-1 overflow-y-auto p-2 md:p-3">
        {item.map(({ kunci, label, href, Ikon, lencana = 0, warna = "netral" }) => {
          const ini = kunci === aktif;
          return (
            <li key={kunci}>
              {(() => {
                const kelas = [
                  "relative flex w-full h-12 items-center gap-3 rounded-[0.625rem] px-3 transition md:h-11",
                  "justify-center md:justify-start",
                  ini
                    ? "bg-cream-50 text-forest-900 shadow-[0_4px_14px_-8px_rgba(0,0,0,0.6)]"
                    : "text-cream-50/75 hover:bg-cream-50/10 hover:text-cream-50 active:bg-cream-50/15",
                ].join(" ");
                const isi = (
                  <>
                    <Ikon className="size-[1.25rem] shrink-0" />
                    <span
                      className={[
                        "min-w-0 flex-1 truncate text-left text-[0.875rem] font-bold",
                        terbuka ? "hidden md:block" : "hidden",
                      ].join(" ")}
                    >
                      {label}
                    </span>
                    {lencana > 0 && (
                      <span
                        className={[
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[0.625rem] font-extrabold tabular-nums leading-none",
                          "md:static md:ml-auto",
                          ini
                            ? "bg-forest-900 text-cream-50"
                            : warna === "sela"
                              ? "bg-sela-500 text-forest-950"
                              : "bg-cream-50/20 text-cream-50",
                          "absolute right-1.5 top-1.5 md:relative md:right-auto md:top-auto",
                        ].join(" ")}
                        aria-label={`${lencana} ${label}`}
                      >
                        {lencana > 99 ? "99+" : lencana}
                      </span>
                    )}
                  </>
                );
                return onPilih ? (
                  <button
                    type="button"
                    onClick={() => onPilih(kunci)}
                    aria-current={ini ? "page" : undefined}
                    className={kelas}
                  >
                    {isi}
                  </button>
                ) : (
                  <Link href={href} aria-current={ini ? "page" : undefined} className={kelas}>
                    {isi}
                  </Link>
                );
              })()}
            </li>
          );
        })}
      </ul>

    </nav>
  );
}
