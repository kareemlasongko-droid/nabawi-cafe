import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/SiteHeader";

export default function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-forest-950 lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/villa-kolam.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-950 via-forest-950/30 to-forest-950/40" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <Link href="/"><Logo light /></Link>
          <div>
            <p className="font-display text-4xl font-semibold leading-tight">
              &ldquo;Kopi hangat, udara sejuk, dan senja yang tak terlupakan.&rdquo;
            </p>
            <p className="mt-3 text-sm text-white/70">— Tamu Senja Rimba</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-8 inline-block lg:hidden"><Logo /></Link>
          <h1 className="font-display text-3xl font-semibold text-forest-900">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-stone-500">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
