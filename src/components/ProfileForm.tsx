"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Spinner, apiFetch, useToast } from "@/components/ui";

export default function ProfileForm({ user }: { user: { name: string; email: string; phone: string; role: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [f, setF] = useState({ name: user.name, phone: user.phone, currentPassword: "", newPassword: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch("/api/profile", "PATCH", f);
      toast("success", "Profil diperbarui.");
      setF((s) => ({ ...s, currentPassword: "", newPassword: "" }));
      router.refresh();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card max-w-2xl space-y-5 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama lengkap"><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="No. WhatsApp"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Email"><input className="input" value={user.email} disabled /></Field>
        <Field label="Peran"><input className="input" value={user.role === "admin" ? "Administrator" : "Pelanggan"} disabled /></Field>
      </div>
      <div className="border-t border-stone-100 pt-5">
        <h3 className="mb-3 text-sm font-semibold text-forest-900">Ganti kata sandi</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kata sandi saat ini"><input className="input" type="password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} autoComplete="current-password" /></Field>
          <Field label="Kata sandi baru" hint="Kosongkan jika tidak diubah"><input className="input" type="password" minLength={6} value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} autoComplete="new-password" /></Field>
        </div>
      </div>
      <div className="flex justify-end">
        <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />} Simpan perubahan</button>
      </div>
    </form>
  );
}
