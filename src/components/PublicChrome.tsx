"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Home, MessageCircle, User, View } from "lucide-react";
import Logo from "@/components/Logo";
import { BRAND } from "@/lib/constants";

type ChromeUser = { name: string; role: "admin" | "customer" } | null;

/** Halaman fokus (tur imersif, auth, wizard reservasi): bottom nav disembunyikan. */
const HIDE_NAV_ON = ["/tur", "/masuk", "/daftar", "/reservasi"];

const NAV_ITEMS = [
  { href: "/", label: "Beranda", icon: Home, match: (p: string) => p === "/" },
  { href: "/tur", label: "Tur 360°", icon: View, match: (p: string) => p.startsWith("/tur") },
  { href: "/reservasi", label: "Reservasi", icon: CalendarCheck, match: (p: string) => p.startsWith("/reservasi"), fab: true },
  { href: "/akun", label: "Akun", icon: User, match: (p: string) => p.startsWith("/akun") },
] as const;

const TOP_LINKS = [
  { href: "/", label: "Beranda", match: (p: string) => p === "/" },
  { href: "/tur", label: "Tur 360°", match: (p: string) => p.startsWith("/tur") },
  { href: "/reservasi", label: "Reservasi", match: (p: string) => p.startsWith("/reservasi") },
  { href: "/akun/reservasi", label: "Reservasi Saya", match: (p: string) => p.startsWith("/akun") },
] as const;

export default function PublicChrome({ user, children }: { user: ChromeUser; children: ReactNode }) {
  const pathname = usePathname();
  const hideNav = HIDE_NAV_ON.includes(pathname);

  return (
    <div className="min-h-dvh">
      {/* ---------- Top bar ---------- */}
      <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-[#f5f6f4]/85 backdrop-blur">
        <div className="container-app flex h-14 items-center justify-between gap-3 sm:h-16">
          <Link href="/" aria-label="Senja Rimba — beranda" className="shrink-0">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Utama">
            {TOP_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  l.match(pathname) ? "bg-forest-50 text-forest-800" : "text-stone-600 hover:bg-white hover:text-stone-900"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/${BRAND.whatsapp}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Chat WhatsApp"
              className="grid size-10 place-items-center rounded-full bg-white text-forest-700 ring-1 ring-stone-200 transition hover:bg-forest-50"
            >
              <MessageCircle className="size-5" />
            </a>
            {user ? (
              <Link
                href={user.role === "admin" ? "/dashboard" : "/akun"}
                aria-label={user.role === "admin" ? "Ke dashboard admin" : "Akun saya"}
                className="grid size-10 place-items-center rounded-full bg-forest-600 text-sm font-extrabold text-white shadow-sm transition hover:bg-forest-700"
              >
                {user.name.slice(0, 1).toUpperCase()}
              </Link>
            ) : (
              <Link
                href="/masuk"
                className="inline-flex h-10 items-center rounded-full bg-forest-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-forest-700"
              >
                Masuk
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ---------- Konten ---------- */}
      <main className={hideNav ? undefined : "pb-24 lg:pb-0"}>{children}</main>

      {/* ---------- Bottom nav (mobile) ---------- */}
      {!hideNav && (
        <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden" aria-label="Navigasi bawah">
          <div
            className="border-t border-stone-200 bg-white/95 shadow-[0_-6px_24px_-16px_rgb(26_32_24/0.25)] backdrop-blur"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <ul className="mx-auto grid h-16 max-w-md grid-cols-4">
              {NAV_ITEMS.map((item) => {
                const active = item.match(pathname);
                if ("fab" in item && item.fab) {
                  return (
                    <li key={item.href} className="relative">
                      <Link href={item.href} className="flex h-full flex-col items-center justify-end pb-1.5" aria-label="Buat reservasi">
                        <span className="absolute -top-5 grid size-12 place-items-center rounded-full bg-forest-600 text-white shadow-lg shadow-forest-600/40 ring-4 ring-[#f5f6f4] transition active:scale-95">
                          <item.icon className="size-6" />
                        </span>
                        <span className="text-[11px] font-bold text-forest-700">{item.label}</span>
                      </Link>
                    </li>
                  );
                }
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`relative flex h-full flex-col items-center justify-center gap-0.5 transition ${
                        active ? "text-forest-700" : "text-stone-400 hover:text-stone-600"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      <item.icon className="size-6" strokeWidth={active ? 2.4 : 2} />
                      <span className={`text-[11px] ${active ? "font-bold" : "font-semibold"}`}>{item.label}</span>
                      {active && <span className="absolute bottom-1.5 size-1 rounded-full bg-forest-600" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      )}
    </div>
  );
}
