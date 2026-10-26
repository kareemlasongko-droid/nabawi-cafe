"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BedDouble, Check, Users, View } from "lucide-react";
import { EmptyState, Field, Spinner, apiFetch, useToast } from "@/components/ui";
import { addDaysISO, calcTotal, rupiah, todayISO, unitTypeInfo } from "@/lib/constants";

type U = {
  id: number;
  name: string;
  type: string;
  description: string;
  price: number;
  capacity: number;
  quantity: number;
  imageUrl: string;
  sceneId: number | null;
};

export default function ReservationForm({ units, initialUnitId }: { units: U[]; initialUnitId?: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [unitId, setUnitId] = useState<number | undefined>(units.find((u) => u.id === initialUnitId)?.id ?? units[0]?.id);
  const [checkIn, setCheckIn] = useState(addDaysISO(todayISO(), 1));
  const [checkOut, setCheckOut] = useState(addDaysISO(todayISO(), 2));
  const [arrivalTime, setArrivalTime] = useState("17:00");
  const [guests, setGuests] = useState(2);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const unit = units.find((u) => u.id === unitId);

  if (units.length === 0) {
    return <EmptyState icon={<BedDouble className="size-7" />} title="Belum ada unit tersedia" description="Silakan kembali lagi nanti." />;
  }
  if (!unit) return null;

  const info = unitTypeInfo(unit.type);
  const { nights, total } = calcTotal(unit, checkIn, checkOut, qty);
  const invalidRange = info.multiNight && nights < 1;
  const overCap = guests > unit.capacity * qty;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!unit) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/reservations", "POST", {
        unitId: unit.id,
        checkIn,
        checkOut: info.multiNight ? checkOut : checkIn,
        arrivalTime: unit.type === "meja" ? arrivalTime : "",
        guests,
        qty,
        notes,
      });
      toast("success", "Reservasi dibuat! Lanjutkan dengan unggah bukti pembayaran.");
      router.push("/dashboard/reservasi?status=menunggu_pembayaran");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat reservasi.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="card p-5">
          <h2 className="mb-3 font-semibold text-forest-900">1. Pilih unit</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {units.map((u) => (
              <button
                type="button"
                key={u.id}
                onClick={() => {
                  setUnitId(u.id);
                  setGuests((g) => Math.min(g, u.capacity * qty));
                  setError("");
                }}
                className={`flex gap-3 rounded-xl p-2.5 text-left ring-2 transition ${
                  u.id === unitId ? "bg-forest-50 ring-forest-500" : "ring-stone-200 hover:ring-stone-300"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.imageUrl} alt="" className="size-16 shrink-0 rounded-lg bg-stone-100 object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-stone-800">{u.name}</span>
                  <span className="block text-xs text-stone-500">{unitTypeInfo(u.type).label} · {u.capacity} tamu</span>
                  <span className="block text-sm font-bold text-forest-700">{rupiah(u.price)}<span className="text-xs font-normal text-stone-400"> / {unitTypeInfo(u.type).unitLabel}</span></span>
                </span>
                {u.id === unitId && <Check className="size-5 shrink-0 text-forest-600" />}
              </button>
            ))}
          </div>
          {unit.sceneId && (
            <Link href={`/tur?scene=${unit.sceneId}`} target="_blank" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 hover:underline">
              <View className="size-4" /> Lihat {unit.name} dalam 360°
            </Link>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-semibold text-forest-900">2. Detail kunjungan</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={info.multiNight ? "Check-in" : "Tanggal"}>
              <input
                className="input"
                type="date"
                required
                min={todayISO()}
                value={checkIn}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  if (info.multiNight && checkOut <= e.target.value) setCheckOut(addDaysISO(e.target.value, 1));
                }}
              />
            </Field>
            {info.multiNight && (
              <Field label="Check-out">
                <input className="input" type="date" required min={addDaysISO(checkIn, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
              </Field>
            )}
            {unit.type === "meja" && (
              <Field label="Jam kedatangan">
                <input className="input" type="time" required value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} />
              </Field>
            )}
            <Field label={unit.type === "meja" ? "Jumlah meja" : "Jumlah unit"} hint={`Maksimal ${unit.quantity}`}>
              <input className="input" type="number" min={1} max={unit.quantity} required value={qty} onChange={(e) => setQty(Math.max(1, Math.min(unit.quantity, Number(e.target.value) || 1)))} />
            </Field>
            <Field label="Jumlah tamu" hint={`Kapasitas hingga ${unit.capacity * qty} tamu`}>
              <input className="input" type="number" min={1} max={unit.capacity * qty} required value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Catatan khusus (opsional)">
              <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contoh: perayaan ulang tahun, kursi bayi, alergi makanan…" />
            </Field>
          </div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={unit.imageUrl} alt="" className="h-36 w-full object-cover" />
          <div className="space-y-3 p-5">
            <h3 className="font-display text-lg font-semibold text-forest-900">{unit.name}</h3>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-stone-500">Harga</dt><dd>{rupiah(unit.price)} / {info.unitLabel}</dd></div>
              {info.multiNight && <div className="flex justify-between"><dt className="text-stone-500">Durasi</dt><dd>{Math.max(nights, 0)} malam</dd></div>}
              <div className="flex justify-between"><dt className="text-stone-500">Jumlah</dt><dd>{qty}</dd></div>
              <div className="flex justify-between"><dt className="flex items-center gap-1 text-stone-500"><Users className="size-3.5" /> Tamu</dt><dd>{guests}</dd></div>
            </dl>
            <div className="flex items-end justify-between border-t border-stone-100 pt-3">
              <span className="text-sm font-semibold text-stone-600">Total</span>
              <span className="text-2xl font-bold text-forest-800">{rupiah(invalidRange ? 0 : total)}</span>
            </div>
            {invalidRange && <p className="text-xs text-rose-600">Check-out harus setelah check-in.</p>}
            {overCap && <p className="text-xs text-rose-600">Jumlah tamu melebihi kapasitas.</p>}
            {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}
            <button className="btn btn-primary w-full !py-3" disabled={busy || invalidRange || overCap}>
              {busy && <Spinner />} Buat Reservasi
            </button>
            <p className="text-xs text-stone-400">Pembayaran dilakukan via transfer bank manual setelah reservasi dibuat. Admin akan memverifikasi bukti transfer Anda.</p>
          </div>
        </div>
      </aside>
    </form>
  );
}
