"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, Pencil, Plus, Search, Trash2, Users, View } from "lucide-react";
import { ConfirmDialog, EmptyState, Field, ImageUpload, Modal, Spinner, apiFetch, useToast } from "@/components/ui";
import { UNIT_TYPES, rupiah, unitTypeInfo } from "@/lib/constants";

export type UnitRow = {
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
  isActive: boolean;
};

type FormState = Omit<UnitRow, "id" | "facilities"> & { facilitiesText: string };

const blank: FormState = {
  name: "",
  type: "kamar",
  description: "",
  price: 500000,
  capacity: 2,
  quantity: 1,
  imageUrl: "",
  facilitiesText: "",
  sceneId: null,
  isActive: true,
};

export default function UnitManager({ initial, scenes }: { initial: UnitRow[]; scenes: { id: number; title: string }[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [q, setQ] = useState("");
  const [type, setType] = useState("semua");
  const [editing, setEditing] = useState<{ id: number | null; form: FormState } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<UnitRow | null>(null);

  useEffect(() => setItems(initial), [initial]);

  const shown = items.filter(
    (u) => (type === "semua" || u.type === type) && u.name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  function openEdit(u: UnitRow) {
    setEditing({ id: u.id, form: { ...u, facilitiesText: u.facilities.join(", ") } });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const { id, form } = editing;
    const payload = {
      name: form.name,
      type: form.type,
      description: form.description,
      price: Number(form.price),
      capacity: Number(form.capacity),
      quantity: Number(form.quantity),
      imageUrl: form.imageUrl,
      facilities: form.facilitiesText.split(",").map((s) => s.trim()).filter(Boolean),
      sceneId: form.sceneId,
      isActive: form.isActive,
    };
    setSaving(true);
    const prev = items;
    try {
      if (id === null) {
        const tempId = -Date.now();
        setItems((s) => [{ id: tempId, ...payload }, ...s]);
        setEditing(null);
        try {
          const row = await apiFetch<UnitRow>("/api/units", "POST", payload);
          setItems((s) => s.map((i) => (i.id === tempId ? row : i)));
          toast("success", "Unit berhasil ditambahkan.");
        } catch (err) {
          setItems(prev);
          throw err;
        }
      } else {
        setItems((s) => s.map((i) => (i.id === id ? { ...i, ...payload } : i)));
        setEditing(null);
        try {
          await apiFetch(`/api/units/${id}`, "PATCH", payload);
          toast("success", "Perubahan disimpan.");
        } catch (err) {
          setItems(prev);
          throw err;
        }
      }
      router.refresh();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(u: UnitRow) {
    const prev = items;
    setItems((s) => s.map((i) => (i.id === u.id ? { ...i, isActive: !u.isActive } : i)));
    try {
      await apiFetch(`/api/units/${u.id}`, "PATCH", { isActive: !u.isActive });
      toast("success", u.isActive ? `${u.name} dinonaktifkan.` : `${u.name} diaktifkan.`);
      router.refresh();
    } catch (err) {
      setItems(prev);
      toast("error", err instanceof Error ? err.message : "Gagal mengubah status.");
    }
  }

  async function remove() {
    if (!deleting) return;
    const u = deleting;
    const prev = items;
    setDeleting(null);
    setItems((s) => s.filter((i) => i.id !== u.id));
    try {
      await apiFetch(`/api/units/${u.id}`, "DELETE");
      toast("success", `${u.name} dihapus.`);
      router.refresh();
    } catch (err) {
      setItems(prev);
      toast("error", err instanceof Error ? err.message : "Gagal menghapus.");
    }
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setEditing((s) => (s ? { ...s, form: { ...s.form, [k]: v } } : s));

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto">
          {[{ value: "semua", label: "Semua" }, ...UNIT_TYPES].map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                type === t.value ? "bg-forest-800 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-60">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input className="input !pl-9" placeholder="Cari unit…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => setEditing({ id: null, form: blank })}>
            <Plus className="size-4" /> Tambah
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<BedDouble className="size-7" />} title="Belum ada unit" description="Tambahkan kamar, villa, meja cafe, atau aula agar pelanggan dapat melakukan reservasi." action={<button className="btn btn-primary" onClick={() => setEditing({ id: null, form: blank })}><Plus className="size-4" /> Tambah unit pertama</button>} />
      ) : shown.length === 0 ? (
        <EmptyState icon={<Search className="size-7" />} title="Tidak ditemukan" description="Tidak ada unit yang cocok dengan filter Anda." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((u) => (
            <article key={u.id} className={`card pop-in flex flex-col overflow-hidden ${u.id < 0 ? "opacity-60" : ""}`}>
              <div className="relative h-40 bg-stone-100">
                {u.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.imageUrl} alt="" className={`size-full object-cover ${u.isActive ? "" : "grayscale"}`} />
                )}
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-forest-800">{unitTypeInfo(u.type).label}</span>
                {!u.isActive && <span className="absolute right-3 top-3 rounded-full bg-stone-800/80 px-2.5 py-1 text-xs font-semibold text-white">Nonaktif</span>}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-display text-lg font-semibold text-forest-900">{u.name}</h3>
                <p className="mt-0.5 text-sm font-bold text-forest-700">{rupiah(u.price)} <span className="text-xs font-normal text-stone-400">/ {unitTypeInfo(u.type).unitLabel}</span></p>
                <p className="mt-2 flex items-center gap-3 text-xs text-stone-500">
                  <span className="flex items-center gap-1"><Users className="size-3.5" /> {u.capacity} tamu</span>
                  <span>Stok: {u.quantity}</span>
                  {u.sceneId && <span className="flex items-center gap-1 text-forest-600"><View className="size-3.5" /> 360°</span>}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-stone-600">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={u.isActive}
                      onClick={() => toggle(u)}
                      disabled={u.id < 0}
                      className={`relative h-5 w-9 rounded-full transition ${u.isActive ? "bg-forest-600" : "bg-stone-300"}`}
                    >
                      <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${u.isActive ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                    {u.isActive ? "Aktif" : "Nonaktif"}
                  </label>
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)} disabled={u.id < 0} aria-label={`Ubah ${u.name}`}><Pencil className="size-4" /></button>
                    <button className="btn btn-ghost btn-sm hover:!text-rose-600" onClick={() => setDeleting(u)} disabled={u.id < 0} aria-label={`Hapus ${u.name}`}><Trash2 className="size-4" /></button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id === null ? "Tambah unit" : "Ubah unit"}
        wide
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setEditing(null)} type="button">Batal</button>
            <button className="btn btn-primary" form="unit-form" disabled={saving}>{saving && <Spinner />} Simpan</button>
          </>
        }
      >
        {editing && (
          <form id="unit-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Nama unit"><input className="input" required minLength={3} value={editing.form.name} onChange={(e) => set("name", e.target.value)} placeholder="Contoh: Kamar Deluxe Hutan" /></Field></div>
            <Field label="Tipe">
              <select className="input" value={editing.form.type} onChange={(e) => set("type", e.target.value)}>
                {UNIT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label={`Harga per ${unitTypeInfo(editing.form.type).unitLabel} (Rp)`}><input className="input" type="number" min={0} required value={editing.form.price} onChange={(e) => set("price", Number(e.target.value))} /></Field>
            <Field label="Kapasitas tamu / unit"><input className="input" type="number" min={1} required value={editing.form.capacity} onChange={(e) => set("capacity", Number(e.target.value))} /></Field>
            <Field label="Jumlah unit tersedia" hint="Dipakai untuk cek ketersediaan otomatis"><input className="input" type="number" min={1} required value={editing.form.quantity} onChange={(e) => set("quantity", Number(e.target.value))} /></Field>
            <div className="sm:col-span-2"><Field label="Deskripsi"><textarea className="input" rows={3} value={editing.form.description} onChange={(e) => set("description", e.target.value)} /></Field></div>
            <div className="sm:col-span-2"><Field label="Fasilitas" hint="Pisahkan dengan koma"><input className="input" value={editing.form.facilitiesText} onChange={(e) => set("facilitiesText", e.target.value)} placeholder="Wi-Fi, Sarapan, Air hangat" /></Field></div>
            <div className="sm:col-span-2"><ImageUpload label="Foto unit" value={editing.form.imageUrl} onChange={(u) => set("imageUrl", u)} /></div>
            <Field label="Hubungkan ke area tur 360°">
              <select className="input" value={editing.form.sceneId ?? ""} onChange={(e) => set("sceneId", e.target.value ? Number(e.target.value) : null)}>
                <option value="">— Tidak ada —</option>
                {scenes.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-stone-700">
              <input type="checkbox" className="size-4 accent-forest-700" checked={editing.form.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Aktif (dapat dipesan)
            </label>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        danger
        title="Hapus unit?"
        confirmLabel="Hapus"
        message={<>Unit <strong>{deleting?.name}</strong> akan dihapus permanen. Unit yang memiliki riwayat reservasi tidak dapat dihapus — nonaktifkan saja.</>}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
