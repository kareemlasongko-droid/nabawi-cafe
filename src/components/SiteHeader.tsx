import Link from "next/link";
import { Trees } from "lucide-react";
import { BRAND } from "@/lib/constants";
import type { SessionUser } from "@/lib/auth";

export function Logo({ light }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`grid size-9 place-items-center rounded-xl ${light ? "bg-white/15 text-gold-300" : "bg-forest-800 text-gold-300"}`}>
        <Trees className="size-5" />
      </span>
      <span className="leading-tight">
        <span className={`block font-display text-lg font-semibold ${light ? "text-white" : "text-forest-900"}`}>{BRAND.name}</span>
        <span className={`block text-[10px] font-semibold uppercase tracking-[0.18em] ${light ? "text-gold-300" : "text-gold-600"}`}>
          {BRAND.tagline}
        </span>
      </span>
    </span>
  );
}

const links = [
  { href: "/tur", label: "Tur 360°" },
  { href: "/#unit", label: "Kamar & Cafe" },
  { href: "/#cara-reservasi", label: "Cara Reservasi" },
  { href: "/#kontak", label: "Kontak" },
];

export default function SiteHeader({ user, overlay }: { user: SessionUser | null; overlay?: boolean }) {
  return (
    <header
      className={`${overlay ? "absolute inset-x-0 top-0 z-30" : "sticky top-0 z-30 border-b border-stone-200/70 bg-[#faf8f3]/90 backdrop-blur"}`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Beranda">
          <Logo light={overlay} />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                overlay ? "text-white/85 hover:bg-white/10 hover:text-white" : "text-stone-600 hover:bg-stone-100 hover:text-forest-900"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Link href="/dashboard" className="btn btn-gold btn-sm sm:!px-4 sm:!py-2">
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/masuk"
                className={`btn btn-sm hidden sm:inline-flex ${overlay ? "text-white hover:bg-white/10" : "btn-ghost"}`}
              >
                Masuk
              </Link>
              <Link href="/daftar" className="btn btn-gold btn-sm sm:!px-4 sm:!py-2">
                Daftar
              </Link>
            </>
          )}
        </div>
      </div>
      {/* Navigasi mobile */}
      <nav className={`flex gap-1 overflow-x-auto px-3 pb-2 md:hidden ${overlay ? "" : ""}`}>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
              overlay ? "bg-white/10 text-white" : "bg-stone-100 text-stone-600"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
