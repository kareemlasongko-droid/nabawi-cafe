"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BedDouble,
  Check,
  ChevronLeft,
  Clock,
  Copy,
  Eye,
  EyeOff,
  LayoutDashboard,
  MessageCircle,
  Minus,
  Plus,
  Trees,
  Users,
} from "lucide-react";
import { EmptyState, Field, ImageUpload, Spinner, apiFetch, useToast } from "@/components/ui";
import {
  BANKS,
  BRAND,
  UNIT_TYPES,
  addDaysISO,
  calcTotal,
  formatDate,
  rupiah,
  todayISO,
  unitTypeInfo,
} from "@/lib/constants";

export type BookingUnit = {
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

type FlowUser = { name: string; email: string; phone: string; role: string } | null;
type Created = { id: number; code: string; totalPrice: number };

const ARRIVAL_CHOICES = ["10:00", "12:00", "15:00", "17:00", "19:00"];

const STEP_LABELS: Record<string, string> = {
  unit: "Tempat",
  jadwal: "Jadwal",
  akun: "Akun",
  bayar: "Bayar",
};

function Thumb({ src, className }: { src: string; className?: string }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden bg-gradient-to-br from-forest-100 to-forest-300 ${className ?? ""}`}>
      <Trees className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-forest-500/50" />
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={(e) => {
            e.currentTarget.style.opacity = "0";
          }}
        />
      )}
    </span>
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3.5">
      <div>
        <p className="text-sm font-bold text-stone-800">{label}</p>
        {hint && <p className="text-xs text-stone-500">{hint}</p>}
      </div>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Kurangi ${label}`}
          className="grid size-10 place-items-center rounded-full bg-white text-stone-700 ring-1 ring-stone-300 transition enabled:active:scale-95 disabled:opacity-35"
        >
          <Minus className="size-4" />
        </button>
        <span className="w-7 text-center text-[15px] font-extrabold text-stone-900">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Tambah ${label}`}
          className="grid size-10 place-items-center rounded-full bg-white text-stone-700 ring-1 ring-stone-300 transition enabled:active:scale-95 disabled:opacity-35"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

export default function BookingFlow({
  units,
  initialUnitId,
  user,
}: {
  units: BookingUnit[];
  initialUnitId?: number;
  user: FlowUser;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [startedAsGuest] = useState(() => !user);
  const flow = startedAsGuest ? ["unit", "jadwal", "akun", "bayar"] : ["unit", "jadwal", "bayar"];

  const [me, setMe] = useState<{ name: string; email: string; phone: string } | null>(
    user ? { name: user.name, email: user.email, phone: user.phone } : null,
  );
  const [unitId, setUnitId] = useState<number | undefined>(units.find((u) => u.id === initialUnitId)?.id);
  const [step, setStep] = useState(() => (units.some((u) => u.id === initialUnitId) ? 1 : 0));
  const [typeFilter, setTypeFilter] = useState("semua");
  const [checkIn, setCheckIn] = useState(addDaysISO(todayISO(), 1));
  const [checkOut, setCheckOut] = useState(addDaysISO(todayISO(), 2));
  const [arrivalTime, setArrivalTime] = useState("17:00");
  const [guests, setGuests] = useState(2);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [authMode, setAuthMode] = useState<"daftar" | "masuk">("daftar");
  const [auth, setAuth] = useState({ name: "", phone: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);

  const [phoneFinal, setPhoneFinal] = useState(user?.phone ?? "");
  const [created, setCreated] = useState<Created | null>(null);
  const [pay, setPay] = useState({ bank: "BCA", senderName: "", amount: 0, paidAt: todayISO(), proofUrl: "", note: "" });
  const [payBusy, setPayBusy] = useState(false);
  const [paid, setPaid] = useState(false);

  const unit = units.find((u) => u.id === unitId);
  const current = flow[step];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, created]);

  function goTo(n: number) {
    setError("");
    setStep(n);
  }

  /* ---- layar khusus ---- */
  if (user?.role === "admin") {
    return (
      <div className="container-app">
        <div className="card mx-auto mt-10 max-w-lg p-6 text-center sm:p-8">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-forest-50 text-forest-700">
            <LayoutDashboard className="size-7" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold text-stone-900">Kamu masuk sebagai admin</h1>
          <p className="mt-2 text-sm text-stone-500">
            Halaman ini untuk pelanggan. Kelola dan verifikasi reservasi pelanggan dari dashboard admin.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Link href="/dashboard" className="btn btn-primary w-full">
              Ke Dashboard
            </Link>
            <Link href="/" className="btn btn-outline w-full">
              Lihat Situs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div className="container-app">
        <div className="mx-auto max-w-2xl pt-6">
          <EmptyState
            icon={<BedDouble className="size-7" />}
            title="Belum ada tempat tersedia"
            description="Unit sedang disiapkan. Silakan kembali lagi nanti atau hubungi kami lewat WhatsApp."
            action={
              <Link href="/" className="btn btn-primary">
                Kembali ke Beranda
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const info = unit ? unitTypeInfo(unit.type) : null;
  const calc = unit ? calcTotal(unit, checkIn, checkOut, qty) : { nights: 0, total: 0 };
  const invalidRange = !!info?.multiNight && calc.nights < 1;
  const overCap = !!unit && guests > unit.capacity * qty;
  const shownUnits = typeFilter === "semua" ? units : units.filter((u) => u.type === typeFilter);

  async function copyText(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("success", message);
    } catch {
      toast("error", "Gagal menyalin. Salin manual ya.");
    }
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (authMode === "daftar") {
        await apiFetch("/api/auth/register", "POST", auth);
        setMe({ name: auth.name.trim(), email: auth.email.trim(), phone: auth.phone.trim() });
        setPhoneFinal(auth.phone.trim());
      } else {
        await apiFetch("/api/auth/login", "POST", { email: auth.email, password: auth.password });
        setMe({ name: "", email: auth.email.trim(), phone: "" });
      }
      goTo(step + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReservation() {
    if (!unit || !info) return;
    setBusy(true);
    setError("");
    try {
      // Simpan nomor WhatsApp ke profil bila memungkinkan (best-effort).
      if (me?.name && phoneFinal.trim() && phoneFinal.trim() !== me.phone) {
        await apiFetch("/api/profile", "PATCH", { name: me.name, phone: phoneFinal.trim() }).catch(() => undefined);
      }
      const row = await apiFetch<Created>("/api/reservations", "POST", {
        unitId: unit.id,
        checkIn,
        checkOut: info.multiNight ? checkOut : checkIn,
        arrivalTime: unit.type === "meja" ? arrivalTime : "",
        guests,
        qty,
        notes,
      });
      setCreated(row);
      setPay((f) => ({ ...f, amount: row.totalPrice, senderName: me?.name || f.senderName }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat reservasi.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!created) return;
    if (!pay.proofUrl.startsWith("/api/media/proof/")) {
      toast("error", "Unggah foto bukti transfer terlebih dahulu.");
      return;
    }
    setPayBusy(true);
    try {
      await apiFetch(`/api/reservations/${created.id}/payment`, "POST", pay);
      setPaid(true);
      toast("success", "Bukti pembayaran terkirim. Admin akan segera memverifikasi.");
      router.refresh();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Gagal mengirim bukti.");
    } finally {
      setPayBusy(false);
    }
  }

  const primaryDisabled =
    busy ||
    (current === "unit" && !unit) ||
    (current === "jadwal" && (!unit || invalidRange || overCap));

  function onPrimary() {
    if (current === "unit" || current === "jadwal") goTo(step + 1);
    else if (current === "bayar") void submitReservation();
  }

  const primaryLabel =
    current === "unit"
      ? unit
        ? "Lanjut: Pilih Jadwal"
        : "Pilih tempat dulu ya"
      : current === "jadwal"
        ? startedAsGuest && !me
          ? "Lanjut"
          : "Lanjut: Pembayaran"
        : current === "akun"
          ? authMode === "daftar"
            ? "Daftar & Lanjut"
            : "Masuk & Lanjut"
          : "Buat Reservasi";

  /* ==================== SUKSES ==================== */
  if (created && unit && info) {
    const waText = encodeURIComponent(`Halo ${BRAND.name}, saya sudah membuat reservasi ${created.code} (${unit.name}).`);
    return (
      <div className="container-app">
        <div className="mx-auto max-w-2xl pb-16 pt-6">
          <div className="text-center">
            <span className="pop-in mx-auto grid size-16 place-items-center rounded-full bg-forest-600 text-white shadow-lg shadow-forest-600/30">
              <Check className="size-8" strokeWidth={3} />
            </span>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-stone-900">Reservasi dibuat!</h1>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-stone-500">
              {paid
                ? "Bukti pembayaranmu sudah terkirim. Admin akan memverifikasi dan statusnya bisa dipantau di Reservasi Saya."
                : "Tempatmu sudah kami tahan. Selesaikan pembayaran di bawah agar segera dikonfirmasi admin."}
            </p>
            <button
              onClick={() => copyText(created.code, "Kode reservasi tersalin.")}
              className="mx-auto mt-4 flex items-center gap-2 rounded-2xl bg-forest-50 px-5 py-3 ring-1 ring-forest-200 transition active:scale-[0.98]"
              aria-label={`Kode reservasi ${created.code}, ketuk untuk menyalin`}
            >
              <span className="font-mono text-xl font-extrabold tracking-widest text-forest-800">{created.code}</span>
              <Copy className="size-4 text-forest-600" />
            </button>
            <p className="mt-2 text-xs text-stone-400">Simpan kode ini — tunjukkan saat tiba di Senja Rimba.</p>
          </div>

          <div className="card mt-6 flex items-center gap-3 p-4">
            <Thumb src={unit.imageUrl} className="size-14 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-stone-900">{unit.name}</p>
              <p className="text-sm text-stone-500">
                {formatDate(checkIn)}
                {info.multiNight && ` – ${formatDate(checkOut)}`}
                {unit.type === "meja" && arrivalTime && ` · ${arrivalTime}`} · {guests} tamu
              </p>
            </div>
            <p className="shrink-0 font-extrabold text-forest-700">{rupiah(created.totalPrice)}</p>
          </div>

          {!paid ? (
            <section className="card mt-4 p-5">
              <h2 className="font-extrabold text-stone-900">Selesaikan pembayaran</h2>
              <p className="mt-1 text-sm text-stone-500">
                Transfer tepat <strong className="text-forest-800">{rupiah(created.totalPrice)}</strong> ke salah satu rekening, lalu
                unggah buktinya di sini.
              </p>
              <ul className="mt-3 space-y-2">
                {BANKS.map((b) => (
                  <li key={b.bank} className="flex items-center gap-3 rounded-xl bg-[#f5f6f4] px-3.5 py-2.5 ring-1 ring-stone-200/70">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-stone-800">{b.bank}</p>
                      <p className="truncate font-mono text-sm text-stone-600">{b.number}</p>
                      <p className="text-xs text-stone-400">a.n. {b.holder}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(b.number.replace(/\s/g, ""), `Nomor rekening ${b.bank} tersalin.`)}
                      className="btn btn-outline btn-sm shrink-0"
                    >
                      <Copy className="size-3.5" /> Salin
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => copyText(String(created.totalPrice), "Nominal transfer tersalin.")}
                className="btn btn-ghost btn-sm mt-2"
              >
                <Copy className="size-3.5" /> Salin nominal {rupiah(created.totalPrice)}
              </button>

              <form onSubmit={submitPayment} className="mt-4 space-y-3 border-t border-stone-100 pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Bank pengirim">
                    <input className="input" list="bf-banks" required value={pay.bank} onChange={(e) => setPay({ ...pay, bank: e.target.value })} />
                    <datalist id="bf-banks">
                      {BANKS.map((b) => (
                        <option key={b.bank} value={b.bank} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="Nama pemilik rekening">
                    <input className="input" required value={pay.senderName} onChange={(e) => setPay({ ...pay, senderName: e.target.value })} />
                  </Field>
                  <Field label="Nominal transfer (Rp)">
                    <input className="input" type="number" min={1} required value={pay.amount || ""} onChange={(e) => setPay({ ...pay, amount: Number(e.target.value) })} />
                  </Field>
                  <Field label="Tanggal transfer">
                    <input className="input" type="date" required max={todayISO()} value={pay.paidAt} onChange={(e) => setPay({ ...pay, paidAt: e.target.value })} />
                  </Field>
                </div>
                <ImageUpload label="Foto bukti transfer (wajib)" value={pay.proofUrl} onChange={(u) => setPay({ ...pay, proofUrl: u })} aspect="aspect-[3/4]" kind="proof" />
                <Field label="Catatan (opsional)">
                  <input className="input" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} placeholder="Contoh: transfer via m-banking" />
                </Field>
                <button className="btn btn-primary w-full !py-3.5" disabled={payBusy}>
                  {payBusy && <Spinner />} Kirim Bukti Pembayaran
                </button>
                <Link href="/akun/reservasi" className="btn btn-outline w-full">
                  Bayar Nanti — ke Reservasi Saya
                </Link>
              </form>
            </section>
          ) : (
            <div className="mt-4 rounded-2xl bg-forest-50 p-4 text-sm text-forest-800 ring-1 ring-forest-200">
              Bukti terkirim dan sedang menunggu verifikasi. Biasanya dikonfirmasi pada jam kerja — kami kabari lewat halaman
              Reservasi Saya.
            </div>
          )}

          <div className="mt-4 grid gap-2">
            <Link href="/akun/reservasi" className="btn btn-primary w-full !py-3.5">
              Lihat Reservasi Saya <ArrowRight className="size-4" />
            </Link>
            <a href={`https://wa.me/${BRAND.whatsapp}?text=${waText}`} target="_blank" rel="noreferrer" className="btn btn-outline w-full">
              <MessageCircle className="size-4" /> Kabari Admin via WhatsApp
            </a>
            <Link href="/" className="btn btn-ghost w-full">
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ==================== WIZARD ==================== */
  return (
    <div className="container-app">
      <div className="mx-auto max-w-2xl pb-36 pt-4 sm:pt-6">
        {/* Header + progres */}
        <div className="flex items-center gap-1">
          {step > 0 ? (
            <button onClick={() => goTo(step - 1)} className="btn btn-ghost btn-sm !px-2" aria-label="Kembali ke langkah sebelumnya">
              <ChevronLeft className="size-5" /> Kembali
            </button>
          ) : (
            <Link href="/" className="btn btn-ghost btn-sm !px-2">
              <ChevronLeft className="size-5" /> Beranda
            </Link>
          )}
          <h1 className="text-lg font-extrabold tracking-tight text-stone-900">Reservasi</h1>
        </div>
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {flow.map((k, i) => (
            <span key={k} className={`h-1.5 flex-1 rounded-full transition ${i <= step ? "bg-forest-600" : "bg-stone-200"}`} />
          ))}
        </div>
        <div className="mt-1.5 flex">
          {flow.map((k, i) => (
            <span
              key={k}
              className={`flex-1 text-[11px] font-bold ${i === 0 ? "text-left" : i === flow.length - 1 ? "text-right" : "text-center"} ${
                i === step ? "text-forest-700" : "text-stone-400"
              }`}
            >
              {STEP_LABELS[k]}
            </span>
          ))}
        </div>

        {error && (
          <p role="alert" className="pop-in mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
            {error}
          </p>
        )}

        {/* ===== LANGKAH: TEMPAT ===== */}
        {current === "unit" && (
          <section className="mt-5">
            <h2 className="text-xl font-extrabold tracking-tight text-stone-900">Mau pesan apa?</h2>
            <p className="mt-1 text-sm text-stone-500">Pilih satu tempat, jadwal menyusul di langkah berikutnya.</p>
            <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:px-0">
              {[{ value: "semua", label: "Semua" }, ...UNIT_TYPES.map((t) => ({ value: t.value as string, label: t.label }))].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTypeFilter(t.value)}
                  className={`h-10 shrink-0 rounded-full px-4 text-sm font-bold transition ${
                    typeFilter === t.value ? "bg-forest-600 text-white shadow-md shadow-forest-600/25" : "bg-white text-stone-600 ring-1 ring-stone-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <ul className="mt-3 space-y-2.5">
              {shownUnits.map((u) => {
                const selected = u.id === unitId;
                const inf = unitTypeInfo(u.type);
                return (
                  <li key={u.id}>
                    <button
                      onClick={() => {
                        setUnitId(u.id);
                        setQty((q) => Math.min(q, u.quantity));
                        setGuests((g) => Math.min(Math.max(g, 1), u.capacity * Math.min(qty, u.quantity)));
                        setError("");
                      }}
                      aria-pressed={selected}
                      className={`flex w-full items-center gap-3 rounded-[18px] p-3 text-left transition active:scale-[0.99] ${
                        selected ? "bg-forest-50 ring-2 ring-forest-600" : "bg-white ring-1 ring-stone-200/80 hover:ring-forest-300"
                      }`}
                    >
                      <Thumb src={u.imageUrl} className="size-[68px] rounded-xl" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-stone-900">{u.name}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
                          {inf.label} · <Users className="size-3" /> s.d. {u.capacity} tamu
                          {u.facilities.length > 0 && <span className="truncate">· {u.facilities.slice(0, 2).join(", ")}</span>}
                        </span>
                        <span className="mt-1 block text-[15px] font-extrabold text-forest-700">
                          {rupiah(u.price)}
                          <span className="text-xs font-semibold text-stone-400"> / {inf.unitLabel}</span>
                        </span>
                      </span>
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-full transition ${
                          selected ? "bg-forest-600 text-white" : "bg-white ring-2 ring-stone-300"
                        }`}
                      >
                        {selected && <Check className="size-4" strokeWidth={3} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {shownUnits.length === 0 && <p className="mt-4 text-center text-sm text-stone-500">Kategori ini belum tersedia.</p>}
          </section>
        )}

        {/* ===== LANGKAH: JADWAL ===== */}
        {current === "jadwal" && unit && info && (
          <section className="mt-5 space-y-4">
            <div className="card flex items-center gap-3 p-3.5">
              <Thumb src={unit.imageUrl} className="size-14 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-stone-900">{unit.name}</p>
                <p className="text-sm text-stone-500">
                  {info.label} · {rupiah(unit.price)} / {info.unitLabel}
                </p>
              </div>
              <button onClick={() => goTo(0)} className="btn btn-outline btn-sm shrink-0">
                Ganti
              </button>
            </div>

            <div className="card p-5">
              <h2 className="font-extrabold text-stone-900">Atur jadwalmu</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label={info.multiNight ? "Check-in" : "Tanggal kunjungan"}>
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
                    <input
                      className="input"
                      type="date"
                      required
                      min={addDaysISO(checkIn, 1)}
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                    />
                  </Field>
                )}
              </div>
              {info.multiNight && !invalidRange && (
                <p className="mt-2 text-xs font-semibold text-forest-700">
                  {formatDate(checkIn)} → {formatDate(checkOut)} · {calc.nights} malam
                </p>
              )}
              {invalidRange && <p className="mt-2 text-xs font-semibold text-rose-600">Check-out harus setelah check-in.</p>}

              {unit.type === "meja" && (
                <div className="mt-5">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                    <Clock className="size-3.5" /> Jam kedatangan
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {ARRIVAL_CHOICES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setArrivalTime(t)}
                        className={`h-11 rounded-full px-4 text-sm font-bold transition ${
                          arrivalTime === t ? "bg-forest-600 text-white shadow-md shadow-forest-600/25" : "bg-white text-stone-600 ring-1 ring-stone-200"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                    <input
                      className="input !w-32"
                      type="time"
                      aria-label="Jam kedatangan lain"
                      value={ARRIVAL_CHOICES.includes(arrivalTime) ? "" : arrivalTime}
                      onChange={(e) => e.target.value && setArrivalTime(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="mt-3 divide-y divide-stone-100 border-t border-stone-100">
                <Stepper
                  label={unit.type === "meja" ? "Jumlah meja" : "Jumlah unit"}
                  hint={`Maksimal ${unit.quantity}`}
                  value={qty}
                  min={1}
                  max={unit.quantity}
                  onChange={(v) => {
                    setQty(v);
                    setGuests((g) => Math.min(g, unit.capacity * v));
                  }}
                />
                <Stepper
                  label="Jumlah tamu"
                  hint={`Kapasitas hingga ${unit.capacity * qty} tamu`}
                  value={guests}
                  min={1}
                  max={Math.max(1, unit.capacity * qty)}
                  onChange={setGuests}
                />
              </div>
              {overCap && <p className="text-xs font-semibold text-rose-600">Jumlah tamu melebihi kapasitas.</p>}

              <div className="mt-4">
                <Field label="Catatan khusus (opsional)">
                  <textarea
                    className="input"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: ulang tahun, kursi bayi, meja dekat jendela…"
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-2xl bg-forest-50 p-4 ring-1 ring-forest-100">
              <div className="flex items-center justify-between text-sm text-stone-600">
                <span>
                  {rupiah(unit.price)}
                  {info.multiNight ? ` × ${Math.max(calc.nights, 0)} malam` : ""} × {qty}
                </span>
                <span className="text-lg font-extrabold text-forest-800">{rupiah(invalidRange ? 0 : calc.total)}</span>
              </div>
              <p className="mt-1 text-xs text-stone-500">Belum perlu bayar sekarang — transfer setelah reservasi dibuat.</p>
            </div>
          </section>
        )}

        {/* ===== LANGKAH: AKUN ===== */}
        {current === "akun" && (
          <section className="mt-5">
            <h2 className="text-xl font-extrabold tracking-tight text-stone-900">Satu langkah lagi</h2>
            <p className="mt-1 text-sm text-stone-500">
              Masuk atau daftar supaya reservasi tersimpan, bisa dipantau, dan dibayar kapan saja dari HP-mu.
            </p>

            <div className="mt-4 grid grid-cols-2 rounded-2xl bg-stone-200/70 p-1" role="tablist" aria-label="Pilih masuk atau daftar">
              {(["daftar", "masuk"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={authMode === m}
                  onClick={() => {
                    setAuthMode(m);
                    setError("");
                  }}
                  className={`rounded-xl py-2.5 text-sm font-extrabold capitalize transition ${
                    authMode === m ? "bg-white text-stone-900 shadow" : "text-stone-500"
                  }`}
                >
                  {m === "daftar" ? "Daftar Baru" : "Sudah Punya Akun"}
                </button>
              ))}
            </div>

            <form id="auth-step" onSubmit={submitAuth} className="card mt-4 space-y-4 p-5">
              {authMode === "daftar" && (
                <>
                  <Field label="Nama lengkap">
                    <input
                      className="input"
                      required
                      value={auth.name}
                      onChange={(e) => setAuth({ ...auth, name: e.target.value })}
                      placeholder="Contoh: Budi Santoso"
                      autoComplete="name"
                    />
                  </Field>
                  <Field label="No. WhatsApp" hint="Untuk kabar konfirmasi dari admin">
                    <input
                      className="input"
                      value={auth.phone}
                      onChange={(e) => setAuth({ ...auth, phone: e.target.value })}
                      placeholder="08xx-xxxx-xxxx"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </Field>
                </>
              )}
              <Field label="Email">
                <input
                  className="input"
                  type="email"
                  required
                  value={auth.email}
                  onChange={(e) => setAuth({ ...auth, email: e.target.value })}
                  placeholder="nama@email.com"
                  autoComplete="email"
                />
              </Field>
              <Field label="Kata sandi">
                <div className="relative">
                  <input
                    className="input pr-12"
                    type={showPw ? "text" : "password"}
                    required
                    minLength={authMode === "daftar" ? 6 : 1}
                    value={auth.password}
                    onChange={(e) => setAuth({ ...auth, password: e.target.value })}
                    placeholder={authMode === "daftar" ? "Minimal 6 karakter" : "Kata sandi Anda"}
                    autoComplete={authMode === "daftar" ? "new-password" : "current-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-stone-400 hover:text-stone-700"
                    aria-label="Tampilkan kata sandi"
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>
              <p className="text-xs text-stone-400">
                Dengan melanjutkan, kamu menyetujui ketentuan reservasi {BRAND.name} {BRAND.tagline}.
              </p>
            </form>
          </section>
        )}

        {/* ===== LANGKAH: BAYAR (ringkasan) ===== */}
        {current === "bayar" && unit && info && (
          <section className="mt-5 space-y-4">
            <div className="card overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <Thumb src={unit.imageUrl} className="size-16 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-extrabold text-stone-900">{unit.name}</p>
                  <p className="text-sm text-stone-500">{info.label}</p>
                </div>
                <button onClick={() => goTo(flow.indexOf("jadwal"))} className="btn btn-outline btn-sm shrink-0">
                  Ubah
                </button>
              </div>
              <dl className="divide-y divide-stone-100 border-t border-stone-100 text-sm">
                <div className="flex justify-between px-4 py-2.5">
                  <dt className="text-stone-500">{info.multiNight ? "Check-in — check-out" : "Tanggal"}</dt>
                  <dd className="font-semibold text-stone-800">
                    {formatDate(checkIn)}
                    {info.multiNight && ` – ${formatDate(checkOut)}`}
                  </dd>
                </div>
                {unit.type === "meja" && (
                  <div className="flex justify-between px-4 py-2.5">
                    <dt className="text-stone-500">Jam kedatangan</dt>
                    <dd className="font-semibold text-stone-800">{arrivalTime}</dd>
                  </div>
                )}
                {info.multiNight && (
                  <div className="flex justify-between px-4 py-2.5">
                    <dt className="text-stone-500">Durasi</dt>
                    <dd className="font-semibold text-stone-800">{calc.nights} malam</dd>
                  </div>
                )}
                <div className="flex justify-between px-4 py-2.5">
                  <dt className="text-stone-500">Tamu · Jumlah</dt>
                  <dd className="font-semibold text-stone-800">
                    {guests} tamu · {qty} {unit.type === "meja" ? "meja" : "unit"}
                  </dd>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <dt className="text-stone-500">Harga</dt>
                  <dd className="font-semibold text-stone-800">
                    {rupiah(unit.price)}
                    {info.multiNight ? ` × ${calc.nights} malam` : ""} × {qty}
                  </dd>
                </div>
                <div className="flex items-center justify-between bg-forest-50 px-4 py-3">
                  <dt className="font-bold text-stone-700">Total bayar</dt>
                  <dd className="text-xl font-extrabold text-forest-800">{rupiah(calc.total)}</dd>
                </div>
              </dl>
            </div>

            <div className="card space-y-3 p-5">
              <h2 className="font-extrabold text-stone-900">Data pemesan</h2>
              <p className="text-sm text-stone-600">
                {me?.name ? <strong className="text-stone-800">{me.name}</strong> : null} {me?.email && <span>· {me.email}</span>}
              </p>
              <Field label="No. WhatsApp" hint="Admin mengabari konfirmasi lewat nomor ini">
                <input
                  className="input"
                  value={phoneFinal}
                  onChange={(e) => setPhoneFinal(e.target.value)}
                  placeholder="08xx-xxxx-xxxx"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </Field>
            </div>

            <div className="card p-5">
              <h2 className="font-extrabold text-stone-900">Cara pembayaran</h2>
              <ol className="mt-3 space-y-2.5 text-sm text-stone-600">
                {[
                  "Ketuk tombol Buat Reservasi di bawah — tempat langsung kami tahan untukmu.",
                  `Transfer tepat ${rupiah(calc.total)} ke salah satu rekening resmi kami.`,
                  "Unggah foto bukti transfer — bisa langsung setelah ini, atau nanti dari menu Akun → Reservasi Saya.",
                ].map((t, i) => (
                  <li key={t} className="flex gap-2.5">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-forest-600 text-xs font-extrabold text-white">{i + 1}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
              <ul className="mt-4 space-y-2">
                {BANKS.map((b) => (
                  <li key={b.bank} className="flex items-center gap-3 rounded-xl bg-[#f5f6f4] px-3.5 py-2.5 ring-1 ring-stone-200/70">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-stone-800">
                        {b.bank} · <span className="font-mono font-semibold">{b.number}</span>
                      </p>
                      <p className="text-xs text-stone-400">a.n. {b.holder}</p>
                    </div>
                    <button type="button" onClick={() => copyText(b.number.replace(/\s/g, ""), `Nomor rekening ${b.bank} tersalin.`)} className="btn btn-outline btn-sm shrink-0">
                      <Copy className="size-3.5" /> Salin
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>

      {/* ===== CTA lengket bawah ===== */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="container-app">
          <div
            className="mx-auto flex max-w-2xl items-center gap-3 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
          >
            {(current === "jadwal" || current === "bayar") && unit && (
              <p className="shrink-0">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-stone-400">Total</span>
                <span className="block text-[17px] font-extrabold leading-tight text-forest-700">
                  {rupiah(invalidRange ? 0 : calc.total)}
                </span>
              </p>
            )}
            {step > 0 && (
              <button onClick={() => goTo(step - 1)} className="btn btn-outline shrink-0" disabled={busy}>
                Kembali
              </button>
            )}
            {current === "akun" ? (
              <button type="submit" form="auth-step" className="btn btn-primary h-12 flex-1" disabled={busy}>
                {busy && <Spinner />} {primaryLabel} <ArrowRight className="size-4" />
              </button>
            ) : (
              <button onClick={onPrimary} className="btn btn-primary h-12 flex-1" disabled={primaryDisabled}>
                {busy && <Spinner />} {primaryLabel} {current !== "bayar" && <ArrowRight className="size-4" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
