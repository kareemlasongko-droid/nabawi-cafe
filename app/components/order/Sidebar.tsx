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

export type ItemSidebar = {
  kunci: string;
  label: string;
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
}: {
  /** Nama portal, tampil di atas. "Kasir", "Dapur & Bar", dst. */
  judul: string;
  item: ItemSidebar[];
  /** `kunci` tujuan yang sedang dibuka. */
  aktif: string;
  /** Isi bagian bawah sidebar (mis. penanda mode demo). */
  kaki?: React.ReactNode;
}) {
  return (
    <nav
      aria-label={`Navigasi ${judul}`}
      className={[
        "sticky top-0 z-30 flex h-dvh shrink-0 flex-col",
        "border-r border-cream-50/10 bg-forest-950 text-cream-50",
        /*
          Lebar bertingkat. `w-[4.5rem]` = 72px: cukup untuk ikon 24px,
          lencana, dan area sentuh 56px tanpa label terpotong.
        */
        "w-[4.5rem] md:w-[14.5rem] xl:w-64",
        "print:hidden",
      ].join(" ")}
    >
      {/* ── Identitas ── */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-cream-50/10 px-3 md:px-4">
        {/*
          Monogram, bukan logo penuh. Logo Nabawi punya nama kafe di
          dalamnya; pada 72px ia jadi tidak terbaca dan hanya tampak
          sebagai noda. Huruf "N" dalam kotak terbaca di lebar apa pun.
        */}
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-[0.625rem] bg-cream-50 text-[0.9375rem] font-extrabold text-forest-900"
        >
          N
        </span>
        <div className="hidden min-w-0 md:block">
          <p className="truncate text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-cream-50/60">
            Nabawi Cafe
          </p>
          <p className="truncate text-[0.9375rem] font-extrabold leading-tight">{judul}</p>
        </div>
      </div>

      {/* ── Tujuan ── */}
      <ul className="flex-1 space-y-1 overflow-y-auto p-2 md:p-3">
        {item.map(({ kunci, label, href, Ikon, lencana = 0, warna = "netral" }) => {
          const ini = kunci === aktif;
          return (
            <li key={kunci}>
              <Link
                href={href}
                aria-current={ini ? "page" : undefined}
                /*
                  Area sentuh 48px di ponsel (rail) dan 44px di desktop.
                  Label disembunyikan di rail, tetapi tetap ada untuk
                  pembaca layar lewat `sr-only` — ikon tanpa nama aksesibel
                  adalah tautan tanpa tujuan bagi pengguna screen reader.
                */
                className={[
                  "relative flex h-12 items-center gap-3 rounded-[0.625rem] px-3 transition md:h-11",
                  "justify-center md:justify-start",
                  ini
                    ? "bg-cream-50 text-forest-900 shadow-[0_4px_14px_-8px_rgba(0,0,0,0.6)]"
                    : "text-cream-50/75 hover:bg-cream-50/10 hover:text-cream-50 active:bg-cream-50/15",
                ].join(" ")}
              >
                <Ikon className="size-[1.25rem] shrink-0" />
                <span className="hidden min-w-0 flex-1 truncate text-[0.875rem] font-bold md:block">
                  {label}
                </span>

                {lencana > 0 && (
                  <span
                    className={[
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[0.625rem] font-extrabold tabular-nums leading-none",
                      /*
                        Di rail, lencana MENUNGGU di pojok ikon (badge),
                        bukan sebaris — tidak ada ruang untuk keduanya.

                        Warna: "sela" (oranye) untuk yang menuntut tindakan
                        kasir sekarang, "netral" untuk hitungan biasa.
                        Kalau semua lencana berwarna sama, tidak ada yang
                        menonjol dan lencananya berhenti berarti.
                      */
                      "md:static md:ml-auto",
                      ini
                        ? "bg-forest-900 text-cream-50"
                        : warna === "sela"
                          ? "bg-sela-500 text-forest-950"
                          : "bg-cream-50/20 text-cream-50",
                      /* Di rail: tempel di pojok kanan-atas ikon. */
                      "absolute right-1.5 top-1.5 md:relative md:right-auto md:top-auto",
                    ].join(" ")}
                    aria-label={`${lencana} ${label}`}
                  >
                    {lencana > 99 ? "99+" : lencana}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {kaki && <div className="shrink-0 border-t border-cream-50/10 p-2 md:p-3">{kaki}</div>}
    </nav>
  );
}
