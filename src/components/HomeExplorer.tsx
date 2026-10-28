"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  Check,
  Coffee,
  Home,
  LayoutGrid,
  MapPin,
  Search,
  Trees,
  Users,
  View,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/ui";
import { UNIT_TYPES, rupiah, unitTypeInfo } from "@/lib/constants";

export type HomeUnit = {
  id: number;
  name: string;
  type: string;
  description: string;
  price: number;
  capacity: number;
  quantity: number;
  imageUrl: string;
  facilities: string[];
  sceneId: number | null;
};

const TYPE_ICONS: Record<string, typeof BedDouble> = {
  kamar: BedDouble,
  villa: Home,
  meja: Coffee,
  aula: Users,
};

/** Gambar dengan fallback gradien bila URL kosong/rusak. */
function UnitImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <span className={`relative block overflow-hidden bg-gradient-to-br from-forest-100 to-forest-300 ${className ?? ""}`}>
      <Trees className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-forest-500/50" />
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
          onError={(e) => {
            e.currentTarget.style.opacity = "0";
          }}
        />
      )}
    </span>
  );
}

export default function HomeExplorer({
  units,
  coverImage,
  sceneCount,
}: {
  units: HomeUnit[];
  coverImage: string;
  sceneCount: number;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("semua");
  const [detail, setDetail] = useState<HomeUnit | null>(null);

  const categories = useMemo(
    () => [
      { value: "semua", label: "Semua", icon: LayoutGrid, count: units.length },
      ...UNIT_TYPES.map((t) => ({
        value: t.value as string,
        label: t.label,
        icon: TYPE_ICONS[t.value] ?? LayoutGrid,
        count: units.filter((u) => u.type === t.value).length,
      })),
    ],
    [units],
  );

  const shown = units.filter((u) => {
    if (filter !== "semua" && u.type !== filter) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [u.name, u.description, unitTypeInfo(u.type).label, ...u.facilities].join(" ").toLowerCase().includes(s);
  });

  function pickCategory(value: string) {
    setFilter(value);
    document.getElementById("unit")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Kunci scroll + tombol Escape saat sheet detail terbuka.
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDetail(null);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [detail]);

  return (
    <>
      {/* ---------- HERO ---------- */}
      <section className="container-app pt-4 sm:pt-6">
        <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-forest-800 via-forest-900 to-forest-950 text-white shadow-lg">
          {coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImage}
              alt=""
              className="absolute inset-0 size-full object-cover opacity-45"
              onError={(e) => {
                e.currentTarget.style.opacity = "0";
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-forest-950/85 via-forest-950/25 to-transparent" />
          <div className="relative px-5 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-12">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-forest-100 backdrop-blur">
              <MapPin className="size-3.5" /> Lembang, Bandung Barat
            </p>
            <h1 className="mt-4 max-w-xl text-[28px] font-extrabold leading-[1.15] tracking-tight sm:text-4xl">
              Ngopi &amp; menginap di tengah rimba, <span className="text-forest-300">pesan dari HP saja.</span>
            </h1>
            <p className="mt-2.5 max-w-lg text-sm text-white/80 sm:text-base">
              Intip dulu tempatnya lewat tur 360°, pilih favoritmu, dan reservasi dalam waktu kurang dari semenit.
            </p>

            {/* Pencarian */}
            <div className="relative mt-5 max-w-lg">
              <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => document.getElementById("unit")?.scrollIntoView({ behavior: "smooth" })}
                placeholder="Cari villa, kamar, meja cafe…"
                aria-label="Cari tempat"
                className="h-[52px] w-full rounded-2xl bg-white pl-12 pr-11 text-[15px] text-stone-800 shadow-lg outline-none ring-forest-400 transition placeholder:text-stone-400 focus:ring-4"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  aria-label="Hapus pencarian"
                  className="absolute right-2.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-stone-400 hover:bg-stone-100"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">
                <View className="size-3.5" /> {sceneCount} area tur 360°
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">
                <BedDouble className="size-3.5" /> {units.length} pilihan tempat
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur">
                <Check className="size-3.5" /> Bayar setelah reservasi dibuat
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- JALAN PINTAS KATEGORI ---------- */}
      <section className="container-app mt-5" aria-label="Kategori">
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-6 sm:px-0">
          {categories.map((c) => {
            const active = filter === c.value;
            return (
              <button
                key={c.value}
                onClick={() => pickCategory(c.value)}
                className={`flex min-w-[78px] flex-col items-center gap-2 rounded-2xl p-3.5 shadow-sm ring-1 transition active:scale-[0.97] sm:min-w-0 ${
                  active ? "bg-forest-50 ring-2 ring-forest-600" : "bg-white ring-stone-200/80 hover:ring-forest-300"
                }`}
              >
                <span className={`grid size-11 place-items-center rounded-full ${active ? "bg-forest-600 text-white" : "bg-forest-50 text-forest-700"}`}>
                  <c.icon className="size-5" />
                </span>
                <span className={`whitespace-nowrap text-xs font-bold ${active ? "text-forest-800" : "text-stone-600"}`}>{c.label}</span>
              </button>
            );
          })}
          <Link
            href="/tur"
            className="flex min-w-[78px] flex-col items-center gap-2 rounded-2xl bg-forest-600 p-3.5 text-white shadow-sm transition active:scale-[0.97] sm:min-w-0"
          >
            <span className="grid size-11 place-items-center rounded-full bg-white/20">
              <View className="size-5" />
            </span>
            <span className="whitespace-nowrap text-xs font-bold">Tur 360°</span>
          </Link>
        </div>
      </section>

      {/* ---------- DAFTAR UNIT ---------- */}
      <section id="unit" className="container-app mt-8 scroll-mt-20">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-extrabold tracking-tight text-stone-900 sm:text-2xl">Pilih tempat favoritmu</h2>
          <p className="shrink-0 text-sm text-stone-500">{shown.length} tempat</p>
        </div>

        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:px-0">
          {categories.map((c) => (
            <button
              key={c.value}
              onClick={() => setFilter(c.value)}
              className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition ${
                filter === c.value
                  ? "bg-forest-600 text-white shadow-md shadow-forest-600/25"
                  : "bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-forest-300"
              }`}
            >
              {c.label}
              <span className={`rounded-full px-1.5 text-[11px] ${filter === c.value ? "bg-white/20" : "bg-stone-100 text-stone-500"}`}>
                {c.count}
              </span>
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<Search className="size-7" />}
              title="Belum ada yang cocok"
              description={
                q
                  ? `Tidak ada tempat untuk “${q}”. Coba kata kunci atau kategori lain.`
                  : "Kategori ini belum memiliki unit yang tersedia."
              }
              action={
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setQ("");
                    setFilter("semua");
                  }}
                >
                  Lihat semua tempat
                </button>
              }
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((u) => {
              const info = unitTypeInfo(u.type);
              return (
                <article key={u.id} className="card group flex flex-col overflow-hidden transition hover:shadow-lg">
                  <button onClick={() => setDetail(u)} className="relative block text-left" aria-label={`Lihat detail ${u.name}`}>
                    <UnitImage src={u.imageUrl} alt={u.name} className="aspect-[16/10] w-full" />
                    <span className="absolute left-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-xs font-bold text-forest-800 backdrop-blur">
                      {info.label}
                    </span>
                    {u.sceneId && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-forest-950/70 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
                        <View className="size-3.5" /> 360°
                      </span>
                    )}
                  </button>
                  <div className="flex flex-1 flex-col p-4">
                    <button onClick={() => setDetail(u)} className="text-left">
                      <h3 className="truncate text-[17px] font-bold text-stone-900">{u.name}</h3>
                      <p className="mt-1 flex items-center gap-1.5 truncate text-[13px] text-stone-500">
                        <Users className="size-3.5 shrink-0" /> s.d. {u.capacity} tamu
                        {u.facilities.length > 0 && <span className="truncate">· {u.facilities.slice(0, 2).join(" · ")}</span>}
                      </p>
                    </button>
                    <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                      <p>
                        <span className="text-lg font-extrabold text-forest-700">{rupiah(u.price)}</span>
                        <span className="block text-xs text-stone-500">per {info.unitLabel}</span>
                      </p>
                      <Link href={`/reservasi?unit=${u.id}`} className="btn btn-primary btn-sm !px-5">
                        Pesan
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------- PROMO TUR 360 ---------- */}
      <section className="container-app mt-10">
        <Link
          href="/tur"
          className="relative flex min-h-[190px] items-end overflow-hidden rounded-[24px] bg-forest-900 text-white shadow-lg transition active:scale-[0.99]"
        >
          {coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImage}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover opacity-55"
              onError={(e) => {
                e.currentTarget.style.opacity = "0";
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-forest-950/90 via-forest-950/30 to-transparent" />
          <View className="absolute -right-4 -top-4 size-32 text-white/10" />
          <div className="relative p-5 sm:p-7">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur">
              <View className="size-3.5" /> Tur Virtual 360°
            </p>
            <h3 className="mt-3 text-2xl font-extrabold tracking-tight">Lihat dulu tempatnya, baru pesan</h3>
            <p className="mt-1.5 max-w-md text-sm text-white/80">
              Putar panorama kamar, villa, kolam, dan cafe kami — seolah sudah tiba di Senja Rimba.
            </p>
            <span className="btn btn-primary mt-4">
              Mulai Tur <ArrowRight className="size-4" />
            </span>
          </div>
        </Link>
      </section>

      {/* ---------- SHEET DETAIL UNIT ---------- */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Detail ${detail.name}`}>
          <div className="fade-in absolute inset-0 bg-stone-950/50 backdrop-blur-[2px]" onClick={() => setDetail(null)} />
          <div className="sheet-in relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:max-w-xl sm:rounded-[24px]">
            <span className="absolute left-1/2 top-2 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-white/70 sm:hidden" />
            <button
              onClick={() => setDetail(null)}
              aria-label="Tutup detail"
              className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-white/92 text-stone-700 shadow backdrop-blur transition hover:bg-white"
            >
              <X className="size-5" />
            </button>
            <div className="overflow-y-auto">
              <UnitImage src={detail.imageUrl} alt={detail.name} className="h-56 w-full sm:h-64" />
              <div className="p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="rounded-full bg-forest-50 px-2.5 py-1 text-forest-800 ring-1 ring-forest-100">
                    {unitTypeInfo(detail.type).label}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">
                    <Users className="size-3.5" /> s.d. {detail.capacity} tamu / unit
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-extrabold tracking-tight text-stone-900">{detail.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  {detail.description || "Tempat nyaman untuk bersantai dan menikmati suasana Senja Rimba."}
                </p>

                {detail.facilities.length > 0 && (
                  <>
                    <h4 className="mt-5 text-sm font-extrabold text-stone-900">Fasilitas</h4>
                    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                      {detail.facilities.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-stone-700">
                          <Check className="mt-0.5 size-4 shrink-0 text-forest-600" /> {f}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  {[
                    [`${detail.capacity}`, "Tamu / unit"],
                    [`${detail.quantity}`, "Unit tersedia"],
                    [unitTypeInfo(detail.type).unitLabel, "Satuan sewa"],
                  ].map(([v, l]) => (
                    <div key={l} className="rounded-2xl bg-[#f5f6f4] px-2 py-3 ring-1 ring-stone-200/70">
                      <p className="truncate font-extrabold capitalize text-stone-900">{v}</p>
                      <p className="text-[11px] text-stone-500">{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div
              className="flex items-center gap-3 border-t border-stone-100 bg-white px-5 pt-3"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
            >
              <p className="shrink-0">
                <span className="block text-lg font-extrabold leading-tight text-forest-700">{rupiah(detail.price)}</span>
                <span className="text-xs text-stone-500">per {unitTypeInfo(detail.type).unitLabel}</span>
              </p>
              {detail.sceneId && (
                <Link href={`/tur?scene=${detail.sceneId}`} className="btn btn-outline shrink-0" aria-label="Lihat dalam 360 derajat">
                  <View className="size-4" /> 360°
                </Link>
              )}
              <Link href={`/reservasi?unit=${detail.id}`} className="btn btn-primary flex-1">
                Pesan Sekarang
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
