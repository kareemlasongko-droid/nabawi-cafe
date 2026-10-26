"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BedDouble, Compass, Hand, MapPin, Move3d } from "lucide-react";
import PanoramaViewer from "@/components/PanoramaViewer";
import { EmptyState } from "@/components/ui";
import { rupiah, unitTypeInfo } from "@/lib/constants";
import type { Hotspot } from "@/db/schema";

export type SceneLite = {
  id: number;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  hotspots: Hotspot[];
};

export type UnitLite = {
  id: number;
  name: string;
  type: string;
  price: number;
  sceneId: number | null;
  imageUrl: string;
};

export default function TourExplorer({
  scenes,
  units,
  initialSceneId,
  viewerClass = "h-[56vh] min-h-[360px] lg:h-[620px]",
}: {
  scenes: SceneLite[];
  units: UnitLite[];
  initialSceneId?: number;
  viewerClass?: string;
}) {
  const [currentId, setCurrentId] = useState(
    scenes.find((s) => s.id === initialSceneId)?.id ?? scenes[0]?.id,
  );
  const current = scenes.find((s) => s.id === currentId);

  const markers = useMemo(
    () =>
      (current?.hotspots ?? [])
        .filter((h) => scenes.some((s) => s.id === h.targetId))
        .map((h, i) => ({ id: `${current?.id}-${i}`, label: h.label, yaw: h.yaw, pitch: h.pitch, targetId: h.targetId })),
    [current, scenes],
  );

  if (!current) {
    return (
      <EmptyState
        icon={<Compass className="size-7" />}
        title="Tur virtual belum tersedia"
        description="Panorama 360° sedang disiapkan. Silakan kembali lagi nanti."
      />
    );
  }

  const linkedUnits = units.filter((u) => u.sceneId === current.id);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-4">
        <div className="relative">
          <PanoramaViewer
            src={current.imageUrl}
            markers={markers}
            onMarkerClick={(id) => setCurrentId(id)}
            className={viewerClass}
          />
          <div className="pointer-events-none absolute left-3 top-3 z-20 flex max-w-[80%] items-center gap-2 rounded-full bg-forest-950/70 px-3.5 py-1.5 text-sm font-semibold text-white backdrop-blur">
            <MapPin className="size-4 shrink-0 text-gold-300" />
            <span className="truncate">{current.title}</span>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 z-20 hidden items-center gap-2 rounded-full bg-forest-950/60 px-3 py-1.5 text-xs text-white/90 backdrop-blur sm:flex">
            <Hand className="size-3.5" /> Seret untuk melihat sekeliling · klik tombol bulat untuk berpindah ruang
          </div>
        </div>

        {/* Daftar scene */}
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {scenes.map((s) => (
            <button
              key={s.id}
              onClick={() => setCurrentId(s.id)}
              className={`group relative h-20 w-36 shrink-0 overflow-hidden rounded-xl text-left ring-2 transition sm:h-24 sm:w-44 ${
                s.id === current.id ? "ring-gold-400" : "ring-transparent opacity-80 hover:opacity-100"
              }`}
              aria-label={`Lihat ${s.title}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.imageUrl} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
              <span className="absolute inset-0 bg-gradient-to-t from-forest-950/85 via-forest-950/10 to-transparent" />
              <span className="absolute inset-x-2 bottom-1.5 text-xs font-semibold leading-tight text-white">{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-600">
            <Move3d className="size-4" /> {current.category}
          </div>
          <h3 className="mt-1 font-display text-xl font-semibold text-forest-900">{current.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{current.description || "Tidak ada deskripsi."}</p>
        </div>

        <div className="card p-5">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-forest-900">
            <BedDouble className="size-4 text-forest-600" /> Reservasi di area ini
          </h4>
          {linkedUnits.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">Belum ada unit yang terhubung dengan area ini.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {linkedUnits.map((u) => (
                <li key={u.id} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u.imageUrl} alt="" className="size-14 rounded-lg bg-stone-100 object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-800">{u.name}</p>
                    <p className="text-xs text-stone-500">
                      {rupiah(u.price)} / {unitTypeInfo(u.type).unitLabel}
                    </p>
                  </div>
                  <Link href={`/dashboard/reservasi/baru?unit=${u.id}`} className="btn btn-primary btn-sm">
                    Pesan
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link href="/dashboard/reservasi/baru" className="btn btn-gold w-full">
          Buat Reservasi <ArrowRight className="size-4" />
        </Link>
      </aside>
    </div>
  );
}
