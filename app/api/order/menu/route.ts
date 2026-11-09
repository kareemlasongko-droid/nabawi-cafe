/**
 * /api/order/menu — kelola menu (admin).
 *
 * POST  : tambah menu
 * PATCH : ubah nama/harga/ketersediaan/kategori
 *
 * Catatan penting: perubahan harga TIDAK mengubah tagihan yang sudah
 * terbuka, karena item_pesanan menyimpan harga_satuan saat dipesan
 * (PRD bagian 11: "harga satuan dicatat ulang pada setiap item").
 *
 * Endpoint ini menolak semua penulisan kalau kunci server belum dipasang.
 * Halaman admin tetap terbuka untuk dilihat, tetapi tidak bisa menyimpan.
 */
import { NextResponse } from "next/server";
import { db, PUNYA_KUNCI_SERVER } from "@/app/lib/order/db";

export const dynamic = "force-dynamic";

type Badan = {
  id?: number;
  nama?: string;
  deskripsi?: string;
  harga?: number;
  kategori_id?: number | null;
  foto_url?: string | null;
  tersedia?: boolean;
  urutan?: number;
};

function bersihkan(b: Badan, untukBaru: boolean): Record<string, unknown> | null {
  const hasil: Record<string, unknown> = {};
  if (typeof b.nama === "string" && b.nama.trim()) hasil.nama = b.nama.trim().slice(0, 80);
  if (typeof b.deskripsi === "string") hasil.deskripsi = b.deskripsi.trim().slice(0, 240);
  if (b.harga !== undefined) {
    const h = Math.round(Number(b.harga));
    if (!Number.isFinite(h) || h < 0) return null;
    hasil.harga = h;
  }
  if (b.kategori_id !== undefined) {
    hasil.kategori_id = b.kategori_id === null ? null : Number(b.kategori_id);
  }
  if (b.foto_url !== undefined) {
    hasil.foto_url = b.foto_url ? String(b.foto_url).slice(0, 400) : null;
  }
  if (typeof b.tersedia === "boolean") hasil.tersedia = b.tersedia;
  if (b.urutan !== undefined) hasil.urutan = Math.round(Number(b.urutan)) || 0;

  if (untukBaru && (!hasil.nama || hasil.harga === undefined)) return null;
  return hasil;
}

export async function POST(req: Request) {
  if (!PUNYA_KUNCI_SERVER) {
    return NextResponse.json(
      { pesan: "Kunci server database belum dipasang, jadi menu tidak bisa disimpan." },
      { status: 503 }
    );
  }
  let b: Badan;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ pesan: "Isi permintaan tidak terbaca." }, { status: 400 });
  }

  const data = bersihkan(b, true);
  if (!data) {
    return NextResponse.json({ pesan: "Nama dan harga menu wajib diisi." }, { status: 400 });
  }

  const res = await db("menu", { method: "POST", prefer: "return=representation", body: data });
  if (!res.ok) return NextResponse.json({ pesan: res.pesan }, { status: 400 });
  return NextResponse.json({ ok: true, data: res.data });
}

export async function PATCH(req: Request) {
  if (!PUNYA_KUNCI_SERVER) {
    return NextResponse.json(
      { pesan: "Kunci server database belum dipasang, jadi menu tidak bisa diubah." },
      { status: 503 }
    );
  }
  let b: Badan;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ pesan: "Isi permintaan tidak terbaca." }, { status: 400 });
  }

  const id = Number(b.id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ pesan: "Menu tidak sah." }, { status: 400 });
  }

  const data = bersihkan(b, false);
  if (!data || Object.keys(data).length === 0) {
    return NextResponse.json({ pesan: "Tidak ada perubahan." }, { status: 400 });
  }

  const res = await db("menu", {
    method: "PATCH",
    prefer: "return=representation",
    q: `id=eq.${id}`,
    body: data,
  });
  if (!res.ok) return NextResponse.json({ pesan: res.pesan }, { status: 400 });
  return NextResponse.json({ ok: true, data: res.data });
}
