"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BedDouble,
  CalendarCheck,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  Compass,
  UserCircle,
  Users,
  View,
  X,
} from "lucide-react";
import { Logo } from "@/components/SiteHeader";
import { apiFetch, Spinner } from "@/components/ui";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; badge?: number; external?: boolean };

export default function DashboardShell({
  user,
  pending,
  children,
}: {
  user: { name: string; email: string; role: "admin" | "customer" };
  pending: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const isAdmin = user.role === "admin";

  const nav: { title: string; items: NavItem[] }[] = isAdmin
    ? [
        {
          title: "Menu Utama",
          items: [
            { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard, exact: true },
            { href: "/dashboard/reservasi", label: "Reservasi", icon: CalendarCheck, badge: pending },
          ],
        },
        {
          title: "Kelola",
          items: [
            { href: "/dashboard/unit", label: "Unit & Menu Meja", icon: BedDouble },
            { href: "/dashboard/tur", label: "Tur 360°", icon: View },
            { href: "/dashboard/pelanggan", label: "Pengguna", icon: Users },
          ],
        },
        {
          title: "Akun",
          items: [
            { href: "/dashboard/profil", label: "Profil Saya", icon: UserCircle },
            { href: "/", label: "Lihat Situs", icon: Globe, external: true },
          ],
        },
      ]
    : [
        {
          title: "Menu Utama",
          items: [
            { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard, exact: true },
            { href: "/dashboard/reservasi", label: "Reservasi Saya", icon: CalendarCheck, badge: pending },
            { href: "/dashboard/reservasi/baru", label: "Reservasi Baru", icon: PlusCircle },
          ],
        },
        {
          title: "Jelajahi",
          items: [
            { href: "/tur", label: "Tur Virtual 360°", icon: Compass, external: true },
            { href: "/", label: "Halaman Utama", icon: Globe, external: true },
          ],
        },
        { title: "Akun", items: [{ href: "/dashboard/profil", label: "Profil Saya", icon: UserCircle }] },
      ];

  const isActive = (i: NavItem) => {
    if (i.exact) return pathname === i.href;
    if (i.href === "/dashboard/reservasi") return pathname === i.href || (pathname.startsWith(i.href + "/") && !pathname.startsWith("/dashboard/reservasi/baru"));
    return pathname === i.href || pathname.startsWith(i.href + "/");
  };

  async function logout() {
    setLoggingOut(true);
    await apiFetch("/api/auth/logout", "POST").catch(() => undefined);
    router.push("/masuk");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-forest-950 text-white">
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/" onClick={() => setOpen(false)}><Logo light /></Link>
        <button className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Tutup menu">
          <X className="size-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {nav.map((g) => (
          <div key={g.title}>
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((i) => (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={() => setOpen(false)}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive(i) ? "bg-white/12 text-white shadow-inner ring-1 ring-white/10" : "text-white/65 hover:bg-white/6 hover:text-white"
                    }`}
                  >
                    <i.icon className={`size-[18px] ${isActive(i) ? "text-gold-300" : "text-white/50 group-hover:text-gold-200"}`} />
                    <span className="flex-1">{i.label}</span>
                    {!!i.badge && i.badge > 0 && (
                      <span className="grid min-w-5 place-items-center rounded-full bg-gold-400 px-1.5 text-[11px] font-bold text-forest-950">{i.badge}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold-400 text-sm font-bold text-forest-950">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-white/50">{isAdmin ? "Administrator" : "Pelanggan"}</p>
          </div>
          <button onClick={logout} disabled={loggingOut} className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Keluar" title="Keluar">
            {loggingOut ? <Spinner /> : <LogOut className="size-[18px]" />}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fade-in absolute inset-0 bg-forest-950/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] shadow-2xl">{sidebar}</aside>
        </div>
      )}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-[#faf8f3]/90 px-4 py-3 backdrop-blur lg:hidden">
        <button className="btn btn-outline btn-sm !p-2" onClick={() => setOpen(true)} aria-label="Buka menu">
          <Menu className="size-5" />
        </button>
        <Logo />
        <span className="size-9" />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
