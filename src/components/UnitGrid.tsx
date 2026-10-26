"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Search, Users, View } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { UNIT_TYPES, rupiah, unitTypeInfo } from "@/lib/constants";

export type UnitCard = {
  id: number;
  name: string;
  type: string;
  description: string;
  price: number;
  capacity: number;
  imageUrl: string;
  facilities: string[];
  sceneId: number | null;
};

export default function UnitGrid({ units }: { units: UnitCard[] }) {
  const [filter, setFilter] = useState<string>("semua");
  const shown = filter === "semua" ? units : units.filter((u) => u.type === filter);
  const tabs = [{ value: "semua", label: "Semua" }, ...UNIT_TYPES.map((t) => ({ value: t.value as string, label: t.label }))];

  return (
    <div>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilter(t.value)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              filter === t.value ? "bg-forest-800 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={<Search className="size-7" />} title="Belum ada pilihan" description="Kategori ini belum memiliki unit yang tersedia." />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((u) => {
            const info = unitTypeInfo(u.type);
            return (
              <article key={u.id} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u.imageUrl} alt={u.name} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-forest-800 backdrop-blur">
                    {info.label}
                  </span>
                  {u.sceneId && (
                    <Link
                      href={`/tur?scene=${u.sceneId}`}
                      className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-forest-950/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-gold-500"
                    >
                      <View className="size-3.5" /> Lihat 360°
                    </Link>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-display text-lg font-semibold text-forest-900">{u.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-stone-500">{u.description}</p>
                  <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-600">
                    {u.facilities.slice(0, 3).map((f) => (
                      <li key={f} className="flex items-center gap-1">
                        <Check className="size-3.5 text-forest-500" /> {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                    <div>
                      <p className="text-lg font-bold text-forest-800">{rupiah(u.price)}</p>
                      <p className="flex items-center gap-1 text-xs text-stone-500">
                        / {info.unitLabel} · <Users className="size-3" /> {u.capacity} tamu
                      </p>
                    </div>
                    <Link href={`/dashboard/reservasi/baru?unit=${u.id}`} className="btn btn-primary btn-sm">
                      Reservasi
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
