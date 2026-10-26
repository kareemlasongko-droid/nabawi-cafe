"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCheck,
  Eye,
  ImageIcon,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  EmptyState,
  Field,
  ImageUpload,
  Modal,
  PaymentBadge,
  Spinner,
  StatusBadge,
  apiFetch,
  useToast,
} from "@/components/ui";
import {
  BANKS,
  formatDate,
  formatDateTime,
  rupiah,
  todayISO,
  unitTypeInfo,
} from "@/lib/constants";
import type { ReservationView } from "@/lib/queries";

type Role = "admin" | "customer";
type Pending =
  | { kind: "cancel" | "delete" | "complete" | "confirm"; r: ReservationView }
  | { kind: "reject" | "reject_payment"; r: ReservationView }
  | null;

const FILTERS = [
  { value: "semua", label: "Semua" },
  { value: "menunggu_pembayaran", label: "Belum bayar" },
  { value: "menunggu_konfirmasi", label: "Perlu verifikasi" },
  { value: "dikonfirmasi", label: "Terkonfirmasi" },
  { value: "selesai", label: "Selesai" },
  { value: "ditolak", label: "Ditolak" },
  { value: "dibatalkan", label: "Dibatalkan" },
];

export default function ReservationManager({
  initial,
  role,
  userName,
  initialStatus = "semua",
}: {
  initial: ReservationView[];
  role: Role;
  userName: string;
  initialStatus?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState(FILTERS.some((f) => f.value === initialStatus) ? initialStatus : "semua");
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [payFor, setPayFor] = useState<ReservationView | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [note, setNote] = useState("");
  const isAdmin = role === "admin";

  useEffect(() => setItems(initial), [initial]);

  const detail = items.find((i) => i.id === detailId) ?? null;

  const counts = useMemo(() => {
    const c: Record<string, number> = { semua: items.length };
    for (const i of items) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [items]);

  const shown = items.filter((i) => {
    if (filter !== "semua" && i.status !== filter) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [i.code, i.unit.name, i.customer.name, i.customer.email].some((x) => x.toLowerCase().includes(s));
  });

  /** Update optimistis: ubah UI dulu, rollback jika server menolak. */
  async function mutate(
    id: number,
    patch: Partial<ReservationView>,
    request: () => Promise<unknown>,
    successMsg: string,
  ) {
    const prev = items;
    setItems((s) => s.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    try {
      await request();
      toast("success", successMsg);
      router.refresh();
    } catch (e) {
      setItems(prev);
      toast("error", e instanceof Error ? e.message : "Gagal memproses.");
    }
  }

  async function runPending() {
    if (!pending) return;
    const { kind, r } = pending;
    const adminNote = note.trim();
    setPending(null);
    setNote("");
    const act = (action: string) => () => apiFetch(`/api/reservations/${r.id}`, "PATCH", { action, adminNote });
    const payStatus = (s: string) => r.payments.map((p, i) => (i === 0 ? { ...p, status: s } : p));
    switch (kind) {
      case "cancel":
        await mutate(r.id, { status: "dibatalkan" }, act("cancel"), "Reservasi dibatalkan.");
        break;
      case "confirm":
        await mutate(r.id, { status: "dikonfirmasi", payments: payStatus("diterima"), adminNote }, act("confirm"), `Pembayaran ${r.code} dikonfirmasi.`);
        break;
      case "reject_payment":
        await mutate(r.id, { status: "menunggu_pembayaran", payments: payStatus("ditolak"), adminNote: adminNote || "Bukti pembayaran tidak sesuai. Silakan unggah ulang." }, act("reject_payment"), "Bukti pembayaran ditolak, pelanggan diminta mengunggah ulang.");
        break;
      case "reject":
        await mutate(r.id, { status: "ditolak", adminNote }, act("reject"), "Reservasi ditolak.");
        break;
      case "complete":
        await mutate(r.id, { status: "selesai" }, act("complete"), "Reservasi ditandai selesai.");
        break;
      case "delete": {
        const prev = items;
        setItems((s) => s.filter((i) => i.id !== r.id));
        if (detailId === r.id) setDetailId(null);
        try {
          await apiFetch(`/api/reservations/${r.id}`, "DELETE");
          toast("success", "Reservasi dihapus.");
          router.refresh();
        } catch (e) {
          setItems(prev);
          toast("error", e instanceof Error ? e.message : "Gagal menghapus.");
        }
      }
    }
  }

  const pendingCopy: Record<string, { title: string; message: string; label: string; danger?: boolean; askNote?: boolean }> = {
    cancel: { title: "Batalkan reservasi?", message: "Reservasi akan dibatalkan dan slot dibuka kembali untuk tamu lain.", label: "Ya, batalkan", danger: true },
    delete: { title: "Hapus reservasi?", message: "Data reservasi dan riwayat pembayarannya akan dihapus permanen.", label: "Hapus", danger: true },
    complete: { title: "Tandai selesai?", message: "Gunakan setelah tamu selesai berkunjung.", label: "Tandai selesai" },
    confirm: { title: "Konfirmasi pembayaran?", message: "Pastikan dana sudah masuk ke rekening. Reservasi akan berstatus terkonfirmasi.", label: "Konfirmasi", askNote: true },
    reject_payment: { title: "Tolak bukti pembayaran?", message: "Pelanggan akan diminta mengunggah bukti transfer yang benar. Tulis alasan di bawah.", label: "Tolak bukti", danger: true, askNote: true },
    reject: { title: "Tolak reservasi?", message: "Reservasi ditolak dan slot dibuka kembali. Tulis alasan penolakan.", label: "Tolak reservasi", danger: true, askNote: true },
  };

  const actionButtons = (r: ReservationView, compact = false) => {
    const sz = compact ? "btn-sm" : "";
    const btns: React.ReactNode[] = [];
    if (!isAdmin && r.status === "menunggu_pembayaran") {
      btns.push(
        <button key="pay" className={`btn btn-gold ${sz}`} onClick={() => setPayFor(r)}>
          <Upload className="size-4" /> Bayar & unggah bukti
        </button>,
      );
    }
    if (isAdmin && r.status === "menunggu_konfirmasi") {
      btns.push(
        <button key="confirm" className={`btn btn-primary ${sz}`} onClick={() => setPending({ kind: "confirm", r })}>
          <Check className="size-4" /> Konfirmasi
        </button>,
        <button key="rp" className={`btn btn-outline ${sz}`} onClick={() => setPending({ kind: "reject_payment", r })}>
          <X className="size-4" /> Tolak bukti
        </button>,
      );
    }
    if (isAdmin && r.status === "menunggu_pembayaran") {
      btns.push(
        <button key="confirm" className={`btn btn-outline ${sz}`} onClick={() => setPending({ kind: "confirm", r })}>
          <Check className="size-4" /> Tandai lunas
        </button>,
      );
    }
    if (isAdmin && r.status === "dikonfirmasi") {
      btns.push(
        <button key="complete" className={`btn btn-primary ${sz}`} onClick={() => setPending({ kind: "complete", r })}>
          <CheckCheck className="size-4" /> Selesaikan
        </button>,
      );
    }
    if (isAdmin && ["menunggu_pembayaran", "menunggu_konfirmasi"].includes(r.status)) {
      btns.push(
        <button key="reject" className={`btn btn-outline ${sz} text-rose-600`} onClick={() => setPending({ kind: "reject", r })}>
          <Ban className="size-4" /> Tolak
        </button>,
      );
    }
    const cancellable = isAdmin ? ["menunggu_pembayaran", "menunggu_konfirmasi", "dikonfirmasi"] : ["menunggu_pembayaran", "menunggu_konfirmasi"];
    if (cancellable.includes(r.status) && !(isAdmin && r.status !== "dikonfirmasi")) {
      btns.push(
        <button key="cancel" className={`btn btn-outline ${sz} text-rose-600`} onClick={() => setPending({ kind: "cancel", r })}>
          <Ban className="size-4" /> Batalkan
        </button>,
      );
    }
    if (isAdmin || ["dibatalkan", "ditolak"].includes(r.status)) {
      btns.push(
        <button key="del" className={`btn btn-ghost ${sz} text-stone-500 hover:!text-rose-600`} onClick={() => setPending({ kind: "delete", r })} aria-label="Hapus">
          <Trash2 className="size-4" />
        </button>,
      );
    }
    return btns;
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                filter === f.value ? "bg-forest-800 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
              }`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 text-[11px] ${filter === f.value ? "bg-white/20" : "bg-stone-100 text-stone-500"}`}>{counts[f.value] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input className="input !pl-9" placeholder="Cari kode, unit, atau nama…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="size-7" />}
          title="Belum ada reservasi"
          description={isAdmin ? "Reservasi dari pelanggan akan muncul di sini." : "Anda belum membuat reservasi. Pilih kamar, villa, atau meja favorit Anda."}
          action={!isAdmin && <Link href="/dashboard/reservasi/baru" className="btn btn-primary">Buat reservasi</Link>}
        />
      ) : shown.length === 0 ? (
        <EmptyState icon={<Search className="size-7" />} title="Tidak ada hasil" description="Coba ubah filter status atau kata kunci pencarian." action={<button className="btn btn-outline" onClick={() => { setFilter("semua"); setQ(""); }}>Reset filter</button>} />
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => {
            const info = unitTypeInfo(r.unit.type);
            return (
              <li key={r.id} className="card pop-in overflow-hidden">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.unit.imageUrl} alt="" className="h-36 w-full shrink-0 rounded-xl bg-stone-100 object-cover sm:size-20 sm:h-20" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-stone-500">{r.code}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    <h3 className="mt-1 truncate font-display text-lg font-semibold text-forest-900">{r.unit.name}</h3>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500">
                      <span className="flex items-center gap-1.5"><CalendarDays className="size-4" />{formatDate(r.checkIn)}{r.checkOut !== r.checkIn && ` – ${formatDate(r.checkOut)}`}{r.arrivalTime && ` · ${r.arrivalTime}`}</span>
                      <span className="flex items-center gap-1.5"><Users className="size-4" />{r.guests} tamu · {r.qty} {info.value === "meja" ? "meja" : "unit"}</span>
                      {isAdmin && <span className="truncate">• {r.customer.name}</span>}
                    </p>
                    {r.status === "menunggu_pembayaran" && r.adminNote && (
                      <p className="mt-2 rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700 ring-1 ring-rose-100">Catatan admin: {r.adminNote}</p>
                    )}
                  </div>
                  <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <p className="text-lg font-bold text-forest-800">{rupiah(r.totalPrice)}</p>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDetailId(r.id)}>
                      <Eye className="size-4" /> Detail
                    </button>
                  </div>
                </div>
                {actionButtons(r, true).length > 0 && (
                  <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 bg-stone-50/60 px-4 py-2.5 sm:px-5">{actionButtons(r, true)}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* DETAIL */}
      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail ? `Reservasi ${detail.code}` : ""} wide footer={detail ? actionButtons(detail) : undefined}>
        {detail && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><StatusBadge status={detail.status} /><span className="text-xs text-stone-400">Dibuat {formatDateTime(detail.createdAt)}</span></div>
              <dl className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                {[
                  ["Unit", detail.unit.name],
                  ["Tanggal", `${formatDate(detail.checkIn)}${detail.checkOut !== detail.checkIn ? ` – ${formatDate(detail.checkOut)}` : ""}`],
                  ...(detail.arrivalTime ? [["Jam kedatangan", detail.arrivalTime]] : []),
                  ["Tamu", `${detail.guests} orang`],
                  ["Jumlah", `${detail.qty}`],
                  ["Pemesan", `${detail.customer.name}`],
                  ["Kontak", `${detail.customer.phone || "-"} · ${detail.customer.email}`],
                  ["Total", rupiah(detail.totalPrice)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-3 py-2"><dt className="text-stone-500">{k}</dt><dd className="text-right font-medium text-stone-800">{v}</dd></div>
                ))}
              </dl>
              {detail.notes && <p className="rounded-xl bg-stone-50 p-3 text-stone-600"><strong className="text-stone-700">Catatan tamu:</strong> {detail.notes}</p>}
              {detail.adminNote && <p className="rounded-xl bg-gold-50 p-3 text-gold-700"><strong>Catatan admin:</strong> {detail.adminNote}</p>}
            </div>
            <div className="space-y-3 text-sm">
              <h3 className="font-semibold text-forest-900">Riwayat pembayaran</h3>
              {detail.payments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-300 p-4 text-stone-500">
                  Belum ada bukti pembayaran.
                  {!isAdmin && detail.status === "menunggu_pembayaran" && (
                    <div className="mt-3 space-y-2">
                      <p className="font-semibold text-stone-700">Transfer ke salah satu rekening:</p>
                      {BANKS.map((b) => (
                        <p key={b.bank} className="rounded-lg bg-stone-50 px-3 py-2 text-xs"><strong>{b.bank}</strong> <span className="font-mono">{b.number}</span> · {b.holder}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                detail.payments.map((p) => (
                  <div key={p.id} className="rounded-xl border border-stone-200 p-3">
                    <div className="flex items-center justify-between"><p className="font-semibold text-stone-800">{rupiah(p.amount)}</p><PaymentBadge status={p.status} /></div>
                    <p className="mt-1 text-xs text-stone-500">{p.bank} · a.n. {p.senderName} · {formatDate(p.paidAt)}</p>
                    {p.note && <p className="mt-1 text-xs text-stone-500">“{p.note}”</p>}
                    {p.proofUrl ? (
                      <a href={p.proofUrl} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-lg ring-1 ring-stone-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.proofUrl} alt="Bukti transfer" className="max-h-56 w-full object-cover object-top" />
                      </a>
                    ) : (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-400"><ImageIcon className="size-3.5" /> Tanpa lampiran bukti</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* KONFIRMASI AKSI */}
      {pending && (
        <Modal
          open
          onClose={() => { setPending(null); setNote(""); }}
          title={pendingCopy[pending.kind].title}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => { setPending(null); setNote(""); }}>Batal</button>
              <button className={`btn ${pendingCopy[pending.kind].danger ? "btn-danger" : "btn-primary"}`} onClick={runPending}>
                {pendingCopy[pending.kind].label}
              </button>
            </>
          }
        >
          <p className="text-sm text-stone-600">{pendingCopy[pending.kind].message}</p>
          <p className="mt-2 text-sm font-semibold text-stone-800">{pending.r.code} · {pending.r.unit.name} · {rupiah(pending.r.totalPrice)}</p>
          {pendingCopy[pending.kind].askNote && (
            <div className="mt-4">
              <Field label="Catatan untuk pelanggan (opsional)">
                <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: Nominal transfer kurang Rp50.000" />
              </Field>
            </div>
          )}
        </Modal>
      )}

      {/* FORM PEMBAYARAN */}
      {payFor && (
        <PaymentModal
          r={payFor}
          userName={userName}
          onClose={() => setPayFor(null)}
          onSubmit={async (data) => {
            const r = payFor;
            setPayFor(null);
            await mutate(
              r.id,
              {
                status: "menunggu_konfirmasi",
                adminNote: "",
                payments: [{ id: -Date.now(), ...data, note: data.note, status: "menunggu", createdAt: new Date().toISOString() }, ...r.payments],
              },
              () => apiFetch(`/api/reservations/${r.id}/payment`, "POST", data),
              "Bukti pembayaran terkirim. Admin akan segera memverifikasi.",
            );
          }}
        />
      )}
    </div>
  );
}

function PaymentModal({
  r,
  userName,
  onClose,
  onSubmit,
}: {
  r: ReservationView;
  userName: string;
  onClose: () => void;
  onSubmit: (d: { bank: string; senderName: string; amount: number; paidAt: string; proofUrl: string; note: string }) => Promise<void>;
}) {
  const { toast } = useToast();
  const [f, setF] = useState({ bank: "BCA", senderName: userName, amount: r.totalPrice, paidAt: todayISO(), proofUrl: "", note: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.proofUrl.startsWith("/api/media/")) {
      toast("error", "Unggah foto bukti transfer terlebih dahulu.");
      return;
    }
    setBusy(true);
    await onSubmit(f);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Konfirmasi pembayaran"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose} type="button">Batal</button>
          <button className="btn btn-primary" form="pay-form" disabled={busy}>{busy && <Spinner />} Kirim bukti</button>
        </>
      }
    >
      <div className="mb-4 rounded-xl bg-forest-50 p-4 text-sm">
        <p className="text-stone-600">Total tagihan <strong className="text-forest-800">{rupiah(r.totalPrice)}</strong> untuk {r.unit.name}. Transfer ke:</p>
        <ul className="mt-2 space-y-1.5">
          {BANKS.map((b) => (
            <li key={b.bank} className="flex flex-wrap items-center justify-between gap-x-3 rounded-lg bg-white px-3 py-1.5 text-xs ring-1 ring-forest-100">
              <span><strong>{b.bank}</strong> · <span className="font-mono">{b.number}</span></span>
              <span className="text-stone-500">{b.holder}</span>
            </li>
          ))}
        </ul>
      </div>
      <form id="pay-form" onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bank pengirim"><input className="input" list="banks" required value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} /><datalist id="banks">{BANKS.map((b) => <option key={b.bank} value={b.bank} />)}</datalist></Field>
          <Field label="Nama pemilik rekening"><input className="input" required value={f.senderName} onChange={(e) => setF({ ...f, senderName: e.target.value })} /></Field>
          <Field label="Nominal transfer (Rp)"><input className="input" type="number" min={1} required value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></Field>
          <Field label="Tanggal transfer"><input className="input" type="date" required max={todayISO()} value={f.paidAt} onChange={(e) => setF({ ...f, paidAt: e.target.value })} /></Field>
        </div>
        <ImageUpload label="Bukti transfer (wajib)" value={f.proofUrl} onChange={(u) => setF({ ...f, proofUrl: u })} aspect="aspect-[3/4]" />
        <Field label="Catatan (opsional)"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Contoh: transfer via m-banking" /></Field>
      </form>
    </Modal>
  );
}

