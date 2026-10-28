"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Field, Spinner, apiFetch } from "@/components/ui";

export default function AuthForm({ mode, next }: { mode: "masuk" | "daftar"; next?: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isLogin = mode === "masuk";
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await apiFetch<{ role?: string }>(isLogin ? "/api/auth/login" : "/api/auth/register", "POST", form);
      const dest =
        next && next.startsWith("/") && !next.startsWith("//")
          ? next
          : data.role === "admin"
            ? "/dashboard"
            : "/akun";
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {!isLogin && (
        <>
          <Field label="Nama lengkap">
            <input className="input" required value={form.name} onChange={set("name")} placeholder="Contoh: Budi Santoso" autoComplete="name" />
          </Field>
          <Field label="No. WhatsApp">
            <input className="input" value={form.phone} onChange={set("phone")} placeholder="08xx-xxxx-xxxx" inputMode="tel" autoComplete="tel" />
          </Field>
        </>
      )}
      <Field label="Email">
        <input className="input" type="email" required value={form.email} onChange={set("email")} placeholder="nama@email.com" autoComplete="email" />
      </Field>
      <Field label="Kata sandi">
        <div className="relative">
          <input
            className="input pr-12"
            type={show ? "text" : "password"}
            required
            minLength={isLogin ? 1 : 6}
            value={form.password}
            onChange={set("password")}
            placeholder={isLogin ? "Kata sandi Anda" : "Minimal 6 karakter"}
            autoComplete={isLogin ? "current-password" : "new-password"}
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-stone-400 hover:text-stone-700" aria-label="Tampilkan kata sandi">
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
          {error}
        </p>
      )}
      <button className="btn btn-primary w-full !py-3" disabled={busy}>
        {busy && <Spinner />} {isLogin ? "Masuk" : "Buat Akun"}
      </button>

      <p className="text-center text-sm text-stone-500">
        {isLogin ? (
          <>
            Belum punya akun?{" "}
            <Link href={next ? `/daftar?next=${encodeURIComponent(next)}` : "/daftar"} className="font-semibold text-forest-700 hover:underline">
              Daftar gratis
            </Link>
          </>
        ) : (
          <>
            Sudah punya akun?{" "}
            <Link href={next ? `/masuk?next=${encodeURIComponent(next)}` : "/masuk"} className="font-semibold text-forest-700 hover:underline">
              Masuk
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
