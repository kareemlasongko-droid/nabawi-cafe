"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { ConfirmDialog, EmptyState, Field, Modal, Spinner, apiFetch, useToast } from "@/components/ui";
import { formatDate } from "@/lib/constants";

export type UserRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string;
  reservations: number;
};

type Form = { name: string; email: string; phone: string; role: string; password: string };
const blank: Form = { name: "", email: "", phone: "", role: "customer", password: "" };

export default function UserManager({ initial, currentUserId }: { initial: UserRow[]; currentUserId: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id: number | null; form: Form } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<UserRow | null>(null);

  useEffect(() => setItems(initial), [initial]);

  const shown = items.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEditing((s) => (s ? { ...s, form: { ...s.form, [k]: v } } : s));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const { id, form } = editing;
    setSaving(true);
    const prev = items;
    try {
      if (id === null) {
        const row = await apiFetch<Omit<UserRow, "reservations">>("/api/users", "POST", form);
        setItems((s) => [{ ...row, createdAt: String(row.createdAt), reservations: 0 }, ...s]);
        toast("success", "Pengguna ditambahkan.");
      } else {
        setItems((s) => s.map((u) => (u.id === id ? { ...u, name: form.name, email: form.email, phone: form.phone, role: form.role } : u)));
        try {
          await apiFetch(`/api/users/${id}`, "PATCH", form);
        } catch (err) {
          setItems(prev);
          throw err;
        }
        toast("success", "Perubahan disimpan.");
      }
      setEditing(null);
      router.refresh();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    const u = deleting;
    const prev = items;
    setDeleting(null);
    setItems((s) => s.filter((i) => i.id !== u.id));
    try {
      await apiFetch(`/api/users/${u.id}`, "DELETE");
      toast("success", `${u.name} dihapus.`);
      router.refresh();
    } catch (err) {
      setItems(prev);
      toast("error", err instanceof Error ? err.message : "Gagal menghapus.");
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-2 sm:justify-end">
        <div className="relative flex-1 sm:w-64 sm:flex-none">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input className="input !pl-9" placeholder="Cari nama atau email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ id: null, form: blank })}><Plus className="size-4" /> Tambah</button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<Users className="size-7" />} title="Belum ada pengguna" description="Pengguna yang mendaftar akan muncul di sini." />
      ) : shown.length === 0 ? (
        <EmptyState icon={<Search className="size-7" />} title="Tidak ditemukan" description="Tidak ada pengguna yang cocok dengan pencarian." />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-stone-100">
            {shown.map((u) => (
              <li key={u.id} className="pop-in flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-forest-100 text-sm font-bold text-forest-800">{u.name.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold text-stone-800">
                    {u.name}
                    {u.role === "admin" && <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-semibold text-gold-700"><ShieldCheck className="size-3" /> Admin</span>}
                    {u.id === currentUserId && <span className="text-[11px] font-medium text-stone-400">(Anda)</span>}
                  </p>
                  <p className="truncate text-xs text-stone-500">{u.email}{u.phone && ` · ${u.phone}`}</p>
                </div>
                <div className="hidden text-right text-xs text-stone-500 sm:block">
                  <p>{u.reservations} reservasi</p>
                  <p>Bergabung {formatDate(u.createdAt)}</p>
                </div>
                <div className="flex gap-1">
                  <button className="btn btn-ghost btn-sm" aria-label={`Ubah ${u.name}`} onClick={() => setEditing({ id: u.id, form: { name: u.name, email: u.email, phone: u.phone, role: u.role, password: "" } })}><Pencil className="size-4" /></button>
                  <button className="btn btn-ghost btn-sm hover:!text-rose-600" aria-label={`Hapus ${u.name}`} disabled={u.id === currentUserId} onClick={() => setDeleting(u)}><Trash2 className="size-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id === null ? "Tambah pengguna" : "Ubah pengguna"}
        footer={
          <>
            <button className="btn btn-outline" type="button" onClick={() => setEditing(null)}>Batal</button>
            <button className="btn btn-primary" form="user-form" disabled={saving}>{saving && <Spinner />} Simpan</button>
          </>
        }
      >
        {editing && (
          <form id="user-form" onSubmit={save} className="space-y-3">
            <Field label="Nama lengkap"><input className="input" required value={editing.form.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Email"><input className="input" type="email" required value={editing.form.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="No. WhatsApp"><input className="input" value={editing.form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="Peran">
              <select className="input" value={editing.form.role} onChange={(e) => set("role", e.target.value)} disabled={editing.id === currentUserId}>
                <option value="customer">Pelanggan</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label={editing.id === null ? "Kata sandi" : "Kata sandi baru"} hint={editing.id === null ? "Minimal 6 karakter" : "Kosongkan jika tidak diubah"}>
              <input className="input" type="password" minLength={6} required={editing.id === null} value={editing.form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
            </Field>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        danger
        title="Hapus pengguna?"
        confirmLabel="Hapus"
        message={<><strong>{deleting?.name}</strong> beserta seluruh reservasinya akan dihapus permanen.</>}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
