import type { Metadata } from "next";
import Link from "next/link";
import { count } from "drizzle-orm";
import {
  ArrowRight,
  BedDouble,
  CalendarCheck,
  CalendarClock,
  Clock,
  PlusCircle,
  TrendingUp,
  Users,
  View,
  Wallet,
} from "lucide-react";
import { db } from "@/db";
import { tourScenes, units, users } from "@/db/schema";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getReservations, type ReservationView } from "@/lib/queries";
import { formatDate, rupiah, todayISO } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ringkasan" };

function Stat({ icon: Icon, label, value, hint, tone = "forest" }: { icon: typeof Wallet; label: string; value: string | number; hint?: string; tone?: "forest" | "gold" | "sky" | "rose" }) {
  const tones = {
    forest: "bg-forest-50 text-forest-700",
    gold: "bg-gold-100 text-gold-700",
    sky: "bg-sky-50 text-sky-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-stone-500">{label}</p>
        <span className={`grid size-9 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold text-forest-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-400">{hint}</p>}
    </div>
  );
}

function ReservationRowItem({ r, showCustomer }: { r: ReservationView; showCustomer?: boolean }) {
  return (
    <li>
      <Link href="/dashboard/reservasi" className="flex items-center gap-3 px-4 py-3 transition hover:bg-stone-50 sm:px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={r.unit.imageUrl} alt="" className="size-12 shrink-0 rounded-xl bg-stone-100 object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-stone-800">{r.unit.name}</p>
          <p className="truncate text-xs text-stone-500">
            {showCustomer ? `${r.customer.name} · ` : ""}
            {r.code} · {formatDate(r.checkIn)}
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-stone-800">{rupiah(r.totalPrice)}</p>
        </div>
        <StatusBadge status={r.status} />
      </Link>
    </li>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const all = await getReservations(isAdmin ? {} : { userId: user.id });

  if (!isAdmin) {
    const today = todayISO();
    const upcoming = all
      .filter((r) => r.status === "dikonfirmasi" && r.checkOut >= today)
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];
    const needPay = all.filter((r) => r.status === "menunggu_pembayaran");
    return (
      <div>
        <PageHeader
          title={`Halo, ${user.name.split(" ")[0]} 👋`}
          description="Pantau reservasi dan pembayaran Anda di sini."
          action={
            <Link href="/dashboard/reservasi/baru" className="btn btn-primary">
              <PlusCircle className="size-4" /> Reservasi Baru
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={CalendarCheck} label="Total reservasi" value={all.length} />
          <Stat icon={Wallet} label="Perlu dibayar" value={needPay.length} tone="gold" hint="Menunggu bukti transfer" />
          <Stat icon={Clock} label="Menunggu konfirmasi" value={all.filter((r) => r.status === "menunggu_konfirmasi").length} tone="sky" />
          <Stat icon={TrendingUp} label="Terkonfirmasi" value={all.filter((r) => r.status === "dikonfirmasi").length} />
        </div>

        {needPay.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-200 bg-gold-50 p-4">
            <p className="text-sm text-gold-700">
              <strong>{needPay.length} reservasi</strong> menunggu pembayaran. Selesaikan transfer dan unggah bukti agar segera dikonfirmasi.
            </p>
            <Link href="/dashboard/reservasi" className="btn btn-gold btn-sm">Bayar sekarang</Link>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <section className="card overflow-hidden lg:col-span-2">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
              <h2 className="font-semibold text-forest-900">Reservasi terbaru</h2>
              <Link href="/dashboard/reservasi" className="text-sm font-semibold text-forest-700 hover:underline">Lihat semua</Link>
            </div>
            {all.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<CalendarCheck className="size-7" />}
                  title="Belum ada reservasi"
                  description="Mulai dengan menjelajahi tur 360° lalu pilih kamar atau meja favorit Anda."
                  action={<Link href="/dashboard/reservasi/baru" className="btn btn-primary">Buat reservasi pertama</Link>}
                />
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">{all.slice(0, 5).map((r) => <ReservationRowItem key={r.id} r={r} />)}</ul>
            )}
          </section>
          <section className="space-y-4">
            <div className="card overflow-hidden">
              <div className="border-b border-stone-100 px-5 py-4">
                <h2 className="font-semibold text-forest-900">Kunjungan berikutnya</h2>
              </div>
              {upcoming ? (
                <div className="p-5">
                  <p className="font-display text-lg font-semibold text-forest-900">{upcoming.unit.name}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-stone-600">
                    <CalendarClock className="size-4 text-gold-600" />
                    {formatDate(upcoming.checkIn)}
                    {upcoming.checkOut !== upcoming.checkIn && ` – ${formatDate(upcoming.checkOut)}`}
                  </p>
                  <p className="mt-2 text-xs text-stone-500">Kode: <span className="font-mono font-semibold">{upcoming.code}</span></p>
                </div>
              ) : (
                <p className="p-5 text-sm text-stone-500">Belum ada kunjungan terkonfirmasi.</p>
              )}
            </div>
            <Link href="/tur" className="card group relative flex items-center gap-4 overflow-hidden bg-forest-900 p-5 text-white">
              <span className="grid size-12 place-items-center rounded-xl bg-white/10 text-gold-300"><View className="size-6" /></span>
              <div className="flex-1">
                <p className="font-semibold">Jelajahi tur 360°</p>
                <p className="text-xs text-white/60">Lihat area resort sebelum datang</p>
              </div>
              <ArrowRight className="size-5 transition group-hover:translate-x-1" />
            </Link>
          </section>
        </div>
      </div>
    );
  }

  // ---- Admin ----
  const [[{ c: customerCount }], [{ c: unitCount }], [{ c: sceneCount }]] = await Promise.all([
    db.select({ c: count() }).from(users),
    db.select({ c: count() }).from(units),
    db.select({ c: count() }).from(tourScenes),
  ]);
  const paid = all.filter((r) => r.status === "dikonfirmasi" || r.status === "selesai");
  const revenue = paid.reduce((s, r) => s + r.totalPrice, 0);
  const pending = all.filter((r) => r.status === "menunggu_konfirmasi");

  // Pendapatan 6 bulan terakhir (berdasarkan tanggal reservasi dibuat)
  const months: { key: string; label: string; total: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({
      key: d.toISOString().slice(0, 7),
      label: new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" }).format(d),
      total: 0,
    });
  }
  for (const r of paid) {
    const m = months.find((x) => x.key === r.checkIn.slice(0, 7));
    if (m) m.total += r.totalPrice;
  }
  const maxM = Math.max(1, ...months.map((m) => m.total));

  const statusCount = (s: string) => all.filter((r) => r.status === s).length;

  return (
    <div>
      <PageHeader title="Ringkasan" description="Gambaran operasional Senja Rimba hari ini." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Wallet} label="Pendapatan terkonfirmasi" value={rupiah(revenue)} tone="gold" hint={`${paid.length} reservasi`} />
        <Stat icon={Clock} label="Perlu verifikasi" value={pending.length} tone="sky" hint="Pembayaran menunggu konfirmasi" />
        <Stat icon={BedDouble} label="Unit aktif" value={unitCount} hint={`${sceneCount} area tur 360°`} />
        <Stat icon={Users} label="Pengguna" value={customerCount} tone="rose" hint="Admin & pelanggan" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-forest-900">Pendapatan per bulan kunjungan</h2>
          <p className="text-xs text-stone-400">Reservasi terkonfirmasi & selesai, 6 bulan terakhir</p>
          <div className="mt-6 flex h-48 items-end gap-3 sm:gap-5">
            {months.map((m) => (
              <div key={m.key} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[10px] font-semibold text-stone-500 opacity-0 transition group-hover:opacity-100">
                  {m.total ? rupiah(m.total) : "-"}
                </span>
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-forest-700 to-forest-400 transition group-hover:from-gold-500 group-hover:to-gold-300"
                  style={{ height: `${Math.max(4, (m.total / maxM) * 100)}%`, opacity: m.total ? 1 : 0.2 }}
                />
                <span className="text-xs font-medium capitalize text-stone-500">{m.label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold text-forest-900">Status reservasi</h2>
          <ul className="mt-4 space-y-3">
            {(["menunggu_pembayaran", "menunggu_konfirmasi", "dikonfirmasi", "selesai", "ditolak", "dibatalkan"] as const).map((s) => (
              <li key={s} className="flex items-center justify-between text-sm">
                <StatusBadge status={s} />
                <span className="font-semibold text-stone-700">{statusCount(s)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h2 className="font-semibold text-forest-900">Perlu tindakan: verifikasi pembayaran</h2>
          <Link href="/dashboard/reservasi?status=menunggu_konfirmasi" className="text-sm font-semibold text-forest-700 hover:underline">Kelola</Link>
        </div>
        {pending.length === 0 ? (
          <p className="p-8 text-center text-sm text-stone-500">Semua pembayaran sudah diverifikasi. 🎉</p>
        ) : (
          <ul className="divide-y divide-stone-100">{pending.map((r) => <ReservationRowItem key={r.id} r={r} showCustomer />)}</ul>
        )}
      </section>

      <section className="card mt-6 overflow-hidden">
        <div className="border-b border-stone-100 px-5 py-4">
          <h2 className="font-semibold text-forest-900">Reservasi terbaru</h2>
        </div>
        {all.length === 0 ? (
          <p className="p-8 text-center text-sm text-stone-500">Belum ada reservasi.</p>
        ) : (
          <ul className="divide-y divide-stone-100">{all.slice(0, 6).map((r) => <ReservationRowItem key={r.id} r={r} showCustomer />)}</ul>
        )}
      </section>
    </div>
  );
}
