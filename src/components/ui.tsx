"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, ImagePlus, Loader2, X, XCircle } from "lucide-react";
import { PAYMENT_STATUS, RESERVATION_STATUS } from "@/lib/constants";

/* ---------- fetch helper ---------- */
export async function apiFetch<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Terjadi kesalahan. Coba lagi.");
  return data as T;
}

/* ---------- Toast ---------- */
type Toast = { id: number; type: "success" | "error"; message: string };
const ToastCtx = createContext<{ toast: (type: Toast["type"], message: string) => void }>({
  toast: () => undefined,
});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, type, message }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] lg:bottom-4 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pop-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm shadow-lg"
          >
            {t.type === "success" ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-forest-600" />
            ) : (
              <XCircle className="mt-0.5 size-5 shrink-0 text-rose-600" />
            )}
            <p className="flex-1 text-stone-800">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Modal ---------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="fade-in absolute inset-0 bg-forest-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`modal-panel relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <span className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-stone-300 sm:hidden" />
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-forest-900">{title}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm !p-1.5" aria-label="Tutup">
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Ya, lanjutkan",
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-3 text-sm text-stone-600">
        <AlertTriangle className={`mt-0.5 size-5 shrink-0 ${danger ? "text-rose-500" : "text-gold-500"}`} />
        <div>{message}</div>
      </div>
    </Modal>
  );
}

/* ---------- Kecil-kecil ---------- */
export function Spinner({ className = "size-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-forest-50 text-forest-600">{icon}</div>
      <h3 className="mt-4 font-display text-lg font-semibold text-forest-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-stone-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = RESERVATION_STATUS[status as keyof typeof RESERVATION_STATUS];
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${s?.cls ?? ""}`}>
      {s?.label ?? status}
    </span>
  );
}

export function PaymentBadge({ status }: { status: string }) {
  const s = PAYMENT_STATUS[status as keyof typeof PAYMENT_STATUS];
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${s?.cls ?? ""}`}>
      {s?.label ?? status}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold text-forest-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-400">{hint}</span>}
    </label>
  );
}

/* ---------- Unggah gambar ---------- */

/** Jenis berkas: "media" = bucket publik (foto unit/panorama), "proof" = bucket privat (bukti transfer). */
export type UploadKind = "media" | "proof";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Pengecekan awal di browser; server tetap menjadi penentu akhir. */
const CLIENT_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Unggah langsung (client-direct) ke Supabase Storage.
 *
 * Alurnya dua langkah:
 *   1. POST /api/upload  → server memverifikasi login, lalu menerbitkan
 *                          signed upload URL untuk satu path acak.
 *   2. PUT ke Supabase   → file dikirim browser langsung ke storage.
 *
 * File tidak pernah melewati server aplikasi, jadi batas body 4.5 MB milik
 * Vercel tidak berlaku dan tidak ada penulisan ke filesystem yang read-only.
 * supabase-js diimpor secara lazy agar tidak membebani bundle awal.
 */
export function ImageUpload({
  value,
  onChange,
  label,
  aspect = "aspect-video",
  kind = "media",
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
  aspect?: string;
  kind?: UploadKind;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast("error", "Format harus JPG, PNG, atau WebP.");
      if (ref.current) ref.current.value = "";
      return;
    }
    if (file.size > CLIENT_MAX_BYTES) {
      toast("error", `Ukuran file maksimal ${Math.round(CLIENT_MAX_BYTES / 1024 / 1024)} MB.`);
      if (ref.current) ref.current.value = "";
      return;
    }

    setBusy(true);
    try {
      const grant = await apiFetch<{ bucket: string; path: string; token: string; value: string }>(
        "/api/upload",
        "POST",
        { kind, contentType: file.type, size: file.size },
      );

      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      // Integrasi Supabase di Vercel Marketplace menyinkronkan nama
      // NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — terima keduanya. Keduanya
      // ditulis sebagai akses literal agar Next.js bisa meng-inline-nya
      // saat build.
      const anonKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !anonKey) {
        throw new Error(
          "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum di-set. " +
            "Keduanya wajib ada saat build agar unggahan bisa berjalan.",
        );
      }

      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { error } = await supabase.storage
        .from(grant.bucket)
        .uploadToSignedUrl(grant.path, grant.token, file, { contentType: file.type });
      if (error) throw new Error(error.message);

      onChange(grant.value);
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Gagal mengunggah.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</span>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className={`relative grid w-36 shrink-0 ${aspect} place-items-center overflow-hidden rounded-xl border border-dashed border-stone-300 bg-stone-50 text-stone-400 transition hover:border-forest-400 hover:text-forest-600`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <ImagePlus className="size-6" />
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-white/70">
              <Spinner className="size-5 text-forest-700" />
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            className="input"
            placeholder="Tempel URL gambar atau unggah file"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => ref.current?.click()} disabled={busy}>
            <ImagePlus className="size-4" /> Unggah dari perangkat
          </button>
        </div>
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <p className="mt-1.5 text-[11px] text-stone-400">
        JPG, PNG, atau WebP · maks. {Math.round(CLIENT_MAX_BYTES / 1024 / 1024)} MB
        {kind === "proof" ? " · tersimpan di bucket privat, hanya Anda & admin yang bisa membuka" : ""}
      </p>
    </div>
  );
}
