"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  PlusCircle,
  Settings,
  User,
  View,
} from "lucide-react";
import ProfileForm from "@/components/ProfileForm";
import { Spinner, apiFetch } from "@/components/ui";
import { BRAND } from "@/lib/constants";

type AccountUser = { name: string; email: string; phone: string; role: string };

function MenuRow({
  icon: Icon,
  label,
  desc,
  badge,
  danger,
  href,
  external,
  onClick,
  trailing,
}: {
  icon: typeof CalendarCheck;
  label: string;
  desc?: string;
  badge?: number;
  danger?: boolean;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  const inner = (
    <>
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${
          danger ? "bg-rose-50 text-rose-600" : "bg-forest-50 text-forest-700"
        }`}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-bold ${danger ? "text-rose-600" : "text-stone-800"}`}>{label}</span>
        {desc && <span className="block truncate text-xs text-stone-500">{desc}</span>}
      </span>
      {!!badge && badge > 0 && (
        <span className="grid min-w-6 shrink-0 place-items-center rounded-full bg-forest-600 px-2 py-0.5 text-[11px] font-extrabold text-white">
          {badge}
        </span>
      )}
      {trailing ?? <ChevronRight className="size-5 shrink-0 text-stone-300" />}
    </>
  );
  const cls = "flex min-h-[58px] w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-[#f5f6f4] active:bg-[#eef1ea]";
  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

export function GuestAccount() {
  return (
    <div className="container-app">
      <div className="mx-auto max-w-md space-y-4 pt-6">
        <div className="card p-6 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-forest-50 text-forest-600">
            <User className="size-8" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight text-stone-900">Halo, selamat datang!</h1>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-stone-500">
            Masuk dulu yuk, biar reservasimu tersimpan rapi dan gampang dipantau.
          </p>
          <ul className="mx-auto mt-5 max-w-xs space-y-2 text-left text-sm text-stone-600">
            {[
              "Pantau status reservasi & pembayaran",
              "Unggah bukti transfer langsung dari HP",
              "Reservasi berikutnya jauh lebih cepat",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-forest-600" /> {t}
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-2">
            <Link href="/masuk?next=/akun" className="btn btn-primary w-full !py-3.5">
              Masuk
            </Link>
            <Link href="/daftar?next=/akun" className="btn btn-outline w-full">
              Daftar Akun Baru
            </Link>
          </div>
        </div>

        <div className="card divide-y divide-stone-100 overflow-hidden">
          <MenuRow icon={View} label="Tur Virtual 360°" desc="Lihat tempatnya sebelum pesan" href="/tur" />
          <MenuRow
            icon={MessageCircle}
            label="Chat WhatsApp"
            desc={BRAND.phone}
            href={`https://wa.me/${BRAND.whatsapp}`}
            external
          />
        </div>
      </div>
    </div>
  );
}

export function AccountHome({ user, activeCount }: { user: AccountUser; activeCount: number }) {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const isAdmin = user.role === "admin";

  async function logout() {
    setLoggingOut(true);
    await apiFetch("/api/auth/logout", "POST").catch(() => undefined);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="container-app">
      <div className="mx-auto max-w-2xl space-y-4 pt-4 sm:pt-6">
        {/* Kepala profil */}
        <div className="card flex items-center gap-4 p-5">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-forest-600 text-xl font-extrabold text-white shadow-md shadow-forest-600/25">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold tracking-tight text-stone-900">{user.name}</h1>
            <p className="truncate text-sm text-stone-500">{user.email}</p>
            {user.phone ? (
              <p className="truncate text-sm text-stone-500">{user.phone}</p>
            ) : (
              <button onClick={() => setProfileOpen(true)} className="text-sm font-bold text-forest-700 hover:underline">
                + Tambahkan no. WhatsApp
              </button>
            )}
          </div>
          {isAdmin && (
            <span className="ml-auto shrink-0 rounded-full bg-forest-50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-forest-800 ring-1 ring-forest-200">
              Admin
            </span>
          )}
        </div>

        {/* Menu */}
        <div className="card divide-y divide-stone-100 overflow-hidden">
          <MenuRow
            icon={CalendarCheck}
            label="Reservasi Saya"
            desc="Status, pembayaran & riwayat kunjungan"
            badge={activeCount}
            href="/akun/reservasi"
          />
          <MenuRow icon={PlusCircle} label="Buat Reservasi Baru" desc="Kamar, villa, meja cafe & aula" href="/reservasi" />
          <MenuRow icon={View} label="Tur Virtual 360°" desc="Jelajahi Senja Rimba dari HP" href="/tur" />
          {isAdmin && (
            <MenuRow icon={LayoutDashboard} label="Dashboard Admin" desc="Kelola reservasi, unit & pengguna" href="/dashboard" />
          )}
          <MenuRow
            icon={MessageCircle}
            label="Chat WhatsApp"
            desc={`${BRAND.phone} · tanya apa saja`}
            href={`https://wa.me/${BRAND.whatsapp}`}
            external
          />
          <MenuRow
            icon={Settings}
            label="Profil & Kata Sandi"
            desc="Nama, nomor WhatsApp, kata sandi"
            onClick={() => setProfileOpen((o) => !o)}
            trailing={
              <ChevronDown className={`size-5 shrink-0 text-stone-300 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
            }
          />
        </div>

        {profileOpen && (
          <div className="pop-in">
            <ProfileForm user={user} />
          </div>
        )}

        <div className="card overflow-hidden">
          <MenuRow
            icon={LogOut}
            label={loggingOut ? "Sedang keluar…" : "Keluar"}
            danger
            onClick={logout}
            trailing={loggingOut ? <Spinner className="size-5 shrink-0 text-rose-500" /> : <span className="size-5 shrink-0" />}
          />
        </div>

        <p className="pb-2 pt-1 text-center text-xs text-stone-400">
          {BRAND.name} {BRAND.tagline} · Lembang, Bandung Barat
        </p>
      </div>
    </div>
  );
}
