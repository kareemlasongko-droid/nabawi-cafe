"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Link2, MapPin, Pencil, Plus, Trash2, View, Crosshair } from "lucide-react";
import PanoramaViewer from "@/components/PanoramaViewer";
import { ConfirmDialog, EmptyState, Field, ImageUpload, Modal, Spinner, apiFetch, useToast } from "@/components/ui";
import { SCENE_CATEGORIES } from "@/lib/constants";
import type { Hotspot } from "@/db/schema";

export type SceneRow = {
  id: number;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  sortOrder: number;
  isPublished: boolean;
  hotspots: Hotspot[];
};

type Form = Omit<SceneRow, "id">;

const blank: Form = { title: "", description: "", category: "Resort", imageUrl: "", sortOrder: 0, isPublished: true, hotspots: [] };

export default function SceneManager({ initial }: { initial: SceneRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<{ id: number | null; form: Form } | null>(null);
  const [activeHs, setActiveHs] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<SceneRow | null>(null);

  useEffect(() => setItems(initial), [initial]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEditing((s) => (s ? { ...s, form: { ...s.form, [k]: v } } : s));
  const targets = items.filter((s) => s.id > 0 && s.id !== editing?.id);

  const markers = useMemo(
    () =>
      (editing?.form.hotspots ?? []).map((h, i) => ({
        id: `e-${i}`,
        label: h.label || "Hotspot",
        yaw: h.yaw,
        pitch: h.pitch,
        targetId: h.targetId,
      })),
    [editing?.form.hotspots],
  );

  function open(id: number | null, form: Form) {
    setActiveHs(null);
    setEditing({ id, form });
  }

  function updateHs(i: number, patch: Partial<Hotspot>) {
    if (!editing) return;
    set("hotspots", editing.form.hotspots.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  }

  function addHs() {
    if (!editing) return;
    const t = targets[0];
    if (!t) {
      toast("error", "Buat minimal dua area tur untuk menambahkan hotspot.");
      return;
    }
    const list = [...editing.form.hotspots, { targetId: t.id, label: `Ke ${t.title}`, yaw: 0, pitch: -5 }];
    set("hotspots", list);
    setActiveHs(list.length - 1);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const { id, form } = editing;
    setSaving(true);
    const prev = items;
    try {
      if (id === null) {
        const tempId = -Date.now();
        setItems((s) => [...s, { id: tempId, ...form }]);
        setEditing(null);
        try {
          const row = await apiFetch<SceneRow>("/api/scenes", "POST", form);
          setItems((s) => s.map((i) => (i.id === tempId ? row : i)));
          toast("success", "Area tur ditambahkan.");
        } catch (err) {
          setItems(prev);
          throw err;
        }
      } else {
        setItems((s) => s.map((i) => (i.id === id ? { ...i, ...form } : i)));
        setEditing(null);
        try {
          await apiFetch(`/api/scenes/${id}`, "PATCH", form);
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

  async function toggle(s: SceneRow) {
    const prev = items;
    setItems((a) => a.map((i) => (i.id === s.id ? { ...i, isPublished: !s.isPublished } : i)));
    try {
      await apiFetch(`/api/scenes/${s.id}`, "PATCH", { isPublished: !s.isPublished });
      toast("success", s.isPublished ? "Area disembunyikan dari tur publik." : "Area dipublikasikan.");
      router.refresh();
    } catch (err) {
      setItems(prev);
      toast("error", err instanceof Error ? err.message : "Gagal mengubah status.");
    }
  }

  async function remove() {
    if (!deleting) return;
    const s = deleting;
    const prev = items;
    setDeleting(null);
    setItems((a) => a.filter((i) => i.id !== s.id).map((i) => ({ ...i, hotspots: i.hotspots.filter((h) => h.targetId !== s.id) })));
    try {
      await apiFetch(`/api/scenes/${s.id}`, "DELETE");
      toast("success", `${s.title} dihapus.`);
      router.refresh();
    } catch (err) {
      setItems(prev);
      toast("error", err instanceof Error ? err.message : "Gagal menghapus.");
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn btn-primary" onClick={() => open(null, blank)}>
          <Plus className="size-4" /> Tambah Area 360°
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<View className="size-7" />} title="Belum ada area tur" description="Unggah foto panorama equirectangular (rasio 2:1) untuk membuat tur virtual 360°." action={<button className="btn btn-primary" onClick={() => open(null, blank)}><Plus className="size-4" /> Tambah area pertama</button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((s) => (
            <article key={s.id} className={`card pop-in overflow-hidden ${s.id < 0 ? "opacity-60" : ""}`}>
              <div className="relative h-40 bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.imageUrl} alt="" loading="lazy" className={`size-full object-cover ${s.isPublished ? "" : "grayscale"}`} />
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-forest-800">{s.category}</span>
                <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-forest-950/70 px-2.5 py-1 text-xs font-semibold text-white"><Link2 className="size-3" /> {s.hotspots.length} hotspot</span>
              </div>
              <div className="p-4">
                <h3 className="font-display text-lg font-semibold text-forest-900">{s.title}</h3>
                <p className="mt-1 line-clamp-2 min-h-10 text-sm text-stone-500">{s.description || "Tanpa deskripsi."}</p>
                <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
                  <label className="flex items-center gap-2 text-xs font-medium text-stone-600">
                    <button type="button" role="switch" aria-checked={s.isPublished} onClick={() => toggle(s)} disabled={s.id < 0} className={`relative h-5 w-9 rounded-full transition ${s.isPublished ? "bg-forest-600" : "bg-stone-300"}`}>
                      <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${s.isPublished ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                    {s.isPublished ? "Publik" : "Draf"}
                  </label>
                  <div className="flex gap-1">
                    <a className="btn btn-ghost btn-sm" href={`/tur?scene=${s.id}`} target="_blank" rel="noreferrer" aria-label="Pratinjau"><ExternalLink className="size-4" /></a>
                    <button className="btn btn-ghost btn-sm" onClick={() => open(s.id, { ...s })} disabled={s.id < 0} aria-label={`Ubah ${s.title}`}><Pencil className="size-4" /></button>
                    <button className="btn btn-ghost btn-sm hover:!text-rose-600" onClick={() => setDeleting(s)} disabled={s.id < 0} aria-label={`Hapus ${s.title}`}><Trash2 className="size-4" /></button>
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
        title={editing?.id === null ? "Tambah area 360°" : "Ubah area 360°"}
        wide
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setEditing(null)} type="button">Batal</button>
            <button className="btn btn-primary" form="scene-form" disabled={saving}>{saving && <Spinner />} Simpan</button>
          </>
        }
      >
        {editing && (
          <form id="scene-form" onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Judul area"><input className="input" required minLength={3} value={editing.form.title} onChange={(e) => set("title", e.target.value)} placeholder="Contoh: Teras Senja" /></Field>
              <Field label="Kategori">
                <select className="input" value={editing.form.category} onChange={(e) => set("category", e.target.value)}>
                  {SCENE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2"><Field label="Deskripsi"><textarea className="input" rows={2} value={editing.form.description} onChange={(e) => set("description", e.target.value)} /></Field></div>
              <div className="sm:col-span-2"><ImageUpload label="Foto panorama 360° (equirectangular 2:1)" value={editing.form.imageUrl} onChange={(u) => set("imageUrl", u)} /></div>
              <Field label="Urutan tampil"><input className="input" type="number" value={editing.form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} /></Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-stone-700">
                <input type="checkbox" className="size-4 accent-forest-700" checked={editing.form.isPublished} onChange={(e) => set("isPublished", e.target.checked)} /> Tampilkan di tur publik
              </label>
            </div>

            <div className="rounded-2xl border border-stone-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold text-forest-900"><MapPin className="size-4 text-gold-600" /> Hotspot navigasi</h3>
                  <p className="text-xs text-stone-500">Pilih hotspot lalu klik pada panorama untuk menentukan posisinya.</p>
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={addHs}><Plus className="size-4" /> Tambah hotspot</button>
              </div>
              {editing.form.imageUrl ? (
                <div className="mt-3">
                  <PanoramaViewer
                    src={editing.form.imageUrl}
                    markers={markers}
                    className="h-64 sm:h-80"
                    onPick={(yaw, pitch) => {
                      if (activeHs === null) {
                        toast("error", "Pilih atau tambah hotspot terlebih dahulu.");
                        return;
                      }
                      updateHs(activeHs, { yaw, pitch });
                    }}
                  />
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-stone-50 p-4 text-center text-sm text-stone-400">Unggah panorama untuk mengatur hotspot.</p>
              )}
              {editing.form.hotspots.length === 0 ? (
                <p className="mt-3 text-sm text-stone-400">Belum ada hotspot.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {editing.form.hotspots.map((h, i) => (
                    <li key={i} className={`grid gap-2 rounded-xl p-2.5 ring-1 sm:grid-cols-[1fr_1fr_70px_70px_auto] ${activeHs === i ? "bg-gold-50 ring-gold-300" : "ring-stone-200"}`}>
                      <select className="input" value={h.targetId} onChange={(e) => updateHs(i, { targetId: Number(e.target.value) })} aria-label="Tujuan">
                        {!targets.some((t) => t.id === h.targetId) && <option value={h.targetId}>(area dihapus)</option>}
                        {targets.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                      </select>
                      <input className="input" value={h.label} onChange={(e) => updateHs(i, { label: e.target.value })} placeholder="Label tombol" aria-label="Label" />
                      <input className="input" type="number" value={h.yaw} onChange={(e) => updateHs(i, { yaw: Number(e.target.value) })} aria-label="Yaw" title="Yaw (°)" />
                      <input className="input" type="number" value={h.pitch} onChange={(e) => updateHs(i, { pitch: Number(e.target.value) })} aria-label="Pitch" title="Pitch (°)" />
                      <div className="flex gap-1">
                        <button type="button" className={`btn btn-sm ${activeHs === i ? "btn-gold" : "btn-outline"}`} onClick={() => setActiveHs(activeHs === i ? null : i)}><Crosshair className="size-4" /> {activeHs === i ? "Aktif" : "Atur"}</button>
                        <button type="button" className="btn btn-ghost btn-sm hover:!text-rose-600" aria-label="Hapus hotspot" onClick={() => { set("hotspots", editing.form.hotspots.filter((_, idx) => idx !== i)); setActiveHs(null); }}><Trash2 className="size-4" /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        danger
        title="Hapus area tur?"
        confirmLabel="Hapus"
        message={<>Area <strong>{deleting?.title}</strong> beserta hotspot yang mengarah ke sana akan dihapus. Unit yang terhubung akan kehilangan tautan 360°.</>}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
